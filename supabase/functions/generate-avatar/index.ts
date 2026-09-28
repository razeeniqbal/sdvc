import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// generate-avatar — turns a player's uploaded photo into their VSB chibi identity.
//
//   1. authenticate the caller from their JWT
//   2. reserve a generation (reserve_avatar_generation: row-locked, idempotent,
//      enforces 1 free + admin grants; admins unlimited)
//   3. read the private source photo + the approved VSB style reference (the
//      client uploads the app's /brand/avatar-style-v1.webp next to the photo;
//      its SHA-256 is pinned below, so it can't be swapped for another image),
//      call the image model
//   4. store full image + thumbnail in the public player-avatars bucket,
//      point player_avatars at them, mark the attempt succeeded
//   5. ALWAYS delete the source photo (the club keeps no originals)
// A failed attempt is marked 'failed', which does not count against the
// player's free generation.
//
// Secrets: OPENAI_API_KEY (required). Optional: OPENAI_IMAGE_MODEL
// (default gpt-image-1), OPENAI_IMAGE_QUALITY (default medium).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STYLE_VERSION = 1;
// SHA-256 of public/brand/avatar-style-v1.webp. Bump STYLE_VERSION + this hash together.
const STYLE_SHA256 = "58e6f85e19b8b19400ceef34dfb276117af81f516661e32a49256b59eb3a1874";
const THUMB_SIZE = 256;

const PROMPT = [
  "Create ONE full-body chibi volleyball player character.",
  "Art style: match the second reference image exactly — premium modern chibi proportions, large expressive eyes, clean line art, soft cel shading, same rendering quality.",
  "Identity: base the character on the person in the first reference image. Keep their face shape, skin tone, hairstyle, hair colour and eyebrows, and keep glasses, facial hair or a hijab exactly if they are present. Do not add accessories that are not in the photo.",
  "Outfit (VSB home kit): black short-sleeve volleyball jersey with electric-blue geometric side panels and a small 'VSB' chest logo, black volleyball shorts, black knee pads, black socks, white volleyball shoes. If the person wears a hijab, keep it and add black long sleeves and black leggings under the kit.",
  "Pose: standing, relaxed and confident, facing the viewer, holding a blue-and-yellow volleyball at the hip.",
  "No jersey number, no text, no name, no background, no ground shadow. Transparent background, character centred with a little padding, whole body visible from hair to shoes.",
].join(" ");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Thumbnail for 32–64px avatars. Falls back to the full image if the image
// library can't load in this runtime — the avatar still works, just heavier.
async function makeThumb(png: Uint8Array): Promise<Uint8Array> {
  try {
    const { Image } = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
    const img = await Image.decode(png);
    // Head-and-shoulders crop: top ~45% of the figure, square.
    const side = Math.min(img.width, Math.round(img.height * 0.45));
    const x = Math.max(0, Math.round((img.width - side) / 2));
    img.crop(x, 0, side, side);
    img.resize(THUMB_SIZE, THUMB_SIZE);
    return await img.encode(1);
  } catch (e) {
    console.error("thumbnail fallback:", e);
    return png;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1. Who is calling?
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: "Not authenticated", code: "UNAUTHENTICATED" }, 401);

  let body: { source_path?: string; style_path?: string; idempotency_key?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON", code: "BAD_REQUEST" }, 400); }
  const sourcePath = body.source_path || "";
  const stylePath = body.style_path || "";
  const key = body.idempotency_key || "";
  if (!sourcePath.startsWith(`${user.id}/`) || !stylePath.startsWith(`${user.id}/`) || !/^[\w-]{8,80}$/.test(key)) {
    return json({ error: "Invalid request", code: "BAD_REQUEST" }, 400);
  }

  const removeSource = () => admin.storage.from("player-sources").remove([sourcePath, stylePath]).catch(() => {});

  // Verify the style reference BEFORE reserving, so a bad upload never costs a generation.
  const { data: styleFile } = await admin.storage.from("player-sources").download(stylePath);
  const styleBytes = styleFile ? new Uint8Array(await styleFile.arrayBuffer()) : null;
  if (!styleBytes || (await sha256Hex(styleBytes)) !== STYLE_SHA256) {
    await removeSource();
    return json({ error: "Style reference missing or modified. Refresh the page and try again.", code: "BAD_STYLE" }, 400);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    await removeSource();
    return json({ error: "Avatar generation is not configured yet.", code: "NOT_CONFIGURED" }, 503);
  }

  // 2. Reserve (server-side entitlement + idempotency).
  const { data: reservation, error: reserveError } = await admin.rpc("reserve_avatar_generation", {
    p_user_id: user.id, p_idempotency_key: key, p_source_path: sourcePath,
  });
  if (reserveError) {
    await removeSource();
    const msg = reserveError.message || "";
    if (msg.includes("NO_GENERATIONS_LEFT")) return json({ error: "No generations left.", code: "NO_GENERATIONS_LEFT" }, 403);
    if (msg.includes("GENERATION_IN_PROGRESS")) return json({ error: "A generation is already in progress.", code: "IN_PROGRESS" }, 409);
    return json({ error: "Could not start generation.", code: "RESERVE_FAILED" }, 500);
  }
  const r = Array.isArray(reservation) ? reservation[0] : reservation;
  const generationId: string = r.generation_id;

  if (r.already_existed) {
    // Same request retried: never run (or charge) it twice.
    await removeSource();
    if (r.generation_status === "succeeded") {
      const { data: av } = await admin.from("player_avatars").select("*").eq("user_id", user.id).maybeSingle();
      return json({ status: "succeeded", generation_id: generationId, avatar: av });
    }
    return json({ status: r.generation_status, generation_id: generationId, code: r.generation_status === "processing" ? "IN_PROGRESS" : "FAILED" }, 409);
  }

  const fail = async (reason: string, userMessage: string, status = 502) => {
    await admin.from("player_avatar_generations")
      .update({ status: "failed", failure_reason: reason.slice(0, 500), completed_at: new Date().toISOString(), source_path: null })
      .eq("id", generationId);
    await removeSource();
    return json({ error: userMessage, code: "GENERATION_FAILED" }, status);
  };

  try {
    // 3. Source photo (private bucket) + style reference → image model.
    const { data: photo, error: dlError } = await admin.storage.from("player-sources").download(sourcePath);
    if (dlError || !photo) return await fail(`download: ${dlError?.message}`, "We couldn't read your photo. Please upload it again.", 400);

    const form = new FormData();
    form.append("model", Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-1");
    form.append("prompt", PROMPT);
    form.append("image[]", new File([photo], "player.jpg", { type: photo.type || "image/jpeg" }));
    form.append("image[]", new File([styleBytes], "vsb-style.webp", { type: "image/webp" }));
    form.append("size", "1024x1536");
    form.append("background", "transparent");
    form.append("output_format", "png");
    form.append("quality", Deno.env.get("OPENAI_IMAGE_QUALITY") || "medium");
    form.append("n", "1");

    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const providerMsg: string = payload?.error?.message || `HTTP ${res.status}`;
      const moderated = /safety|moderation|policy/i.test(providerMsg);
      return await fail(`provider: ${providerMsg}`, moderated
        ? "This photo couldn't be used. Try a clear, front-facing photo of just you."
        : "The image service is busy or unavailable. Your free generation wasn't used — please try again later.");
    }
    const b64 = payload?.data?.[0]?.b64_json;
    if (!b64) return await fail("provider: empty result", "No image came back. Your free generation wasn't used — please try again.");

    // 4. Store full + thumbnail with unique (immutable) names.
    const full = b64ToBytes(b64);
    const thumb = await makeThumb(full);
    const imagePath = `${user.id}/${generationId}.png`;
    const thumbPath = `${user.id}/${generationId}-thumb.png`;
    const opts = { contentType: "image/png", cacheControl: "31536000", upsert: false };
    const up1 = await admin.storage.from("player-avatars").upload(imagePath, full, opts);
    const up2 = await admin.storage.from("player-avatars").upload(thumbPath, thumb, opts);
    if (up1.error || up2.error) return await fail(`upload: ${up1.error?.message || up2.error?.message}`, "Saving your player failed. Your free generation wasn't used — please try again.", 500);

    const { data: previous } = await admin.from("player_avatars").select("image_path, thumb_path").eq("user_id", user.id).maybeSingle();
    const { error: saveError } = await admin.from("player_avatars").upsert({
      user_id: user.id, image_path: imagePath, thumb_path: thumbPath, style_version: STYLE_VERSION, updated_at: new Date().toISOString(),
    });
    if (saveError) return await fail(`save: ${saveError.message}`, "Saving your player failed. Your free generation wasn't used — please try again.", 500);

    await admin.from("player_avatar_generations")
      .update({ status: "succeeded", output_path: imagePath, source_path: null, style_version: STYLE_VERSION, completed_at: new Date().toISOString() })
      .eq("id", generationId);

    // Replace, don't accumulate: drop the previous avatar files.
    if (previous) await admin.storage.from("player-avatars").remove([previous.image_path, previous.thumb_path]).catch(() => {});
    await removeSource();

    return json({ status: "succeeded", generation_id: generationId, avatar: { image_path: imagePath, thumb_path: thumbPath } });
  } catch (err) {
    return await fail(`exception: ${(err as Error).message}`, "Something went wrong. Your free generation wasn't used — please try again.", 500);
  }
});
