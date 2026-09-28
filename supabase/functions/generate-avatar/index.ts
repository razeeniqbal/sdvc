import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// generate-avatar: turns a player's photo into their permanent VSB player art.
//
//   1. authenticate the caller from their JWT
//   2. reserve a generation (reserve_avatar_generation: row-locked, idempotent,
//      enforces 1 free + admin grants; admins unlimited, decided by DB role)
//   3. send the image model TWO references:
//        image 1 = VSB STYLE MASTER (production Player #10, pinned by SHA-256;
//                  the client uploads /brand/avatar-style-v2.webp next to the
//                  photo and the hash below rejects any other file)
//        image 2 = the player's photo (identity only)
//   4. store full image + thumbnail in the public player-avatars bucket,
//      point player_avatars at them, mark the attempt succeeded (earlier
//      results are kept, never deleted automatically)
//   5. ALWAYS delete the source photo (the club keeps no originals)
// A failed attempt is marked 'failed', which does not count against the
// player's free generation.
//
// Only the character is generated. Name, number, position, stats, logo and
// card frame are drawn live by the app (PlayerCard), never baked into art.
//
// Secrets: OPENAI_API_KEY (required). Optional: OPENAI_IMAGE_MODEL
// (default gpt-image-1), OPENAI_IMAGE_QUALITY (default high).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Bump all three together when the style master or prompt changes.
const STYLE_VERSION = 2;
const PROMPT_VERSION = "VSB_PLAYER_V2";
// SHA-256 of public/brand/avatar-style-v2.webp (production Player #10).
const STYLE_SHA256 = "7374dabed86d5a9177b2c39954b42c0c86dfd22b246ac1caee41a9ec944048af";
const THUMB_SIZE = 256;

function buildPrompt(gender: string | null): string {
  const genderLine = gender === "Male"
    ? "The player's profile says they are male; draw a male player."
    : gender === "Female"
      ? "The player's profile says they are female; draw a female player."
      : "";
  return [
    "You are illustrating a new member of the VSB volleyball roster.",
    "IMAGE 1 is the VSB STYLE MASTER: an existing character from the roster. IMAGE 2 is a photo of a real person.",
    "Draw the person from IMAGE 2 as a new VSB roster character, illustrated in exactly the same art system as IMAGE 1, so the two look like they come from the same game.",

    "STYLE, copied strictly from IMAGE 1: premium contemporary chibi volleyball athlete; head-to-body ratio about 1:2.5 to 1:3;",
    "slightly oversized head on a small, athletic body; large expressive anime-style eyes with bright catchlights, the same eye shape and size as IMAGE 1;",
    "clean, simplified facial geometry; crisp, controlled dark outlines; soft cel shading with gentle highlights; detailed, glossy hair drawn in defined strands like IMAGE 1;",
    "the same line weight, colour saturation, lighting and level of detail. A high-quality 2D anime-style sports illustration.",
    "Do NOT copy the face, hairstyle or identity of the character in IMAGE 1. Copy only its visual system.",

    "IDENTITY, taken from IMAGE 2: keep the person's face shape, skin tone, hairstyle, hair colour and eyebrows.",
    "Keep glasses only if they wear glasses, facial hair only if they have facial hair, and a hijab or religious head covering only if they wear one.",
    "Do not change ethnicity or skin tone, do not beautify or age them, and do not add facial hair or accessories that are not in the photo.",
    genderLine,
    "IGNORE everything else in the photo: their clothing, caps and hats, bags, jewellery, watches, background and lighting (a hijab is the only headwear to keep).",

    "UNIFORM, always, matching IMAGE 1: a deep-ink, near-black short-sleeve volleyball jersey with electric-blue (#168BFF) geometric shoulder and side panels;",
    "a plain jersey front with NO number and NO text or letters; black volleyball shorts with a blue side stripe; black knee pads; black athletic socks;",
    "white volleyball shoes with dark accents. If the person wears a hijab, add black long sleeves under the jersey and black full-length leggings.",
    "Never a hoodie, sweatshirt, tracksuit, jacket, cap, casual clothes or another sport's kit.",

    "POSE: full body, standing, body turned 10 to 20 degrees from the front, face clearly visible, a confident friendly smile;",
    "one arm holding a blue-and-yellow volleyball at the hip, the other arm relaxed; arms slightly apart from the torso; both feet visible;",
    "the whole figure from the top of the hair to the shoes, nothing cropped, a small empty margin all round, clean silhouette.",

    "BACKGROUND: fully transparent. Only the character. No court, floor, shadow, card, frame, text, name, numbers, logos or effects.",

    "AVOID: 3D render, Pixar or Disney style, vinyl toy, Funko, bobblehead, mascot, realistic or semi-realistic human, small realistic eyes,",
    "toddler proportions, extreme kawaii, generic mobile-game style, esports mascot, cyberpunk or fantasy styling.",
  ].filter(Boolean).join(" ");
}

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

// One structured line per attempt for review. Never includes keys, prompts
// with personal data, or image bytes.
function trace(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: "generate-avatar", event, prompt_version: PROMPT_VERSION, style_version: STYLE_VERSION, at: new Date().toISOString(), ...fields }));
}

// Thumbnail for 32–64px avatars. Falls back to the full image if the image
// library can't load in this runtime; the avatar still works, just heavier.
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

  // Verify the style master BEFORE reserving, so a bad upload never costs a generation.
  const { data: styleFile } = await admin.storage.from("player-sources").download(stylePath);
  const styleBytes = styleFile ? new Uint8Array(await styleFile.arrayBuffer()) : null;
  if (!styleBytes || (await sha256Hex(styleBytes)) !== STYLE_SHA256) {
    await removeSource();
    trace("rejected_style", { user_id: user.id });
    return json({ error: "Style reference missing or out of date. Refresh the page and try again.", code: "BAD_STYLE" }, 400);
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

  const model = Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-1";
  let requestId: string | null = null;
  await admin.from("player_avatar_generations")
    .update({ prompt_version: PROMPT_VERSION, style_version: STYLE_VERSION, model })
    .eq("id", generationId);

  const fail = async (reason: string, userMessage: string, status = 502) => {
    await admin.from("player_avatar_generations")
      .update({ status: "failed", failure_reason: reason.slice(0, 500), completed_at: new Date().toISOString(), source_path: null, provider_request_id: requestId })
      .eq("id", generationId);
    await removeSource();
    trace("failed", { generation_id: generationId, user_id: user.id, request_id: requestId, reason: reason.slice(0, 200) });
    return json({ error: userMessage, code: "GENERATION_FAILED" }, status);
  };

  try {
    // Explicit profile data only (never inferred from the photo).
    const { data: prof } = await admin.from("profiles").select("gender").eq("id", user.id).maybeSingle();

    // 3. Style master (image 1) + source photo (image 2) → image model.
    const { data: photo, error: dlError } = await admin.storage.from("player-sources").download(sourcePath);
    if (dlError || !photo) return await fail(`download: ${dlError?.message}`, "We couldn't read your photo. Please upload it again.", 400);

    const form = new FormData();
    form.append("model", model);
    form.append("prompt", buildPrompt(prof?.gender ?? null));
    form.append("image[]", new File([styleBytes], "vsb-style-master.webp", { type: "image/webp" }));
    form.append("image[]", new File([photo], "player-photo.jpg", { type: photo.type || "image/jpeg" }));
    form.append("size", "1024x1536"); // tallest portrait the model offers (2:3)
    form.append("background", "transparent");
    form.append("output_format", "png");
    form.append("quality", Deno.env.get("OPENAI_IMAGE_QUALITY") || "high");
    form.append("n", "1");

    trace("started", { generation_id: generationId, user_id: user.id, model });
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    requestId = res.headers.get("x-request-id");
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const providerMsg: string = payload?.error?.message || `HTTP ${res.status}`;
      const moderated = /safety|moderation|policy/i.test(providerMsg);
      return await fail(`provider: ${providerMsg}`, moderated
        ? "This photo couldn't be used. Try a clear, front-facing photo of just you."
        : "The image service is busy or unavailable. Your free generation wasn't used, so please try again later.");
    }
    const b64 = payload?.data?.[0]?.b64_json;
    if (!b64) return await fail("provider: empty result", "No image came back. Your free generation wasn't used, so please try again.");

    // 4. Store full + thumbnail with unique (immutable) names.
    const full = b64ToBytes(b64);
    const thumb = await makeThumb(full);
    const imagePath = `${user.id}/${generationId}.png`;
    const thumbPath = `${user.id}/${generationId}-thumb.png`;
    const opts = { contentType: "image/png", cacheControl: "31536000", upsert: false };
    const up1 = await admin.storage.from("player-avatars").upload(imagePath, full, opts);
    const up2 = await admin.storage.from("player-avatars").upload(thumbPath, thumb, opts);
    if (up1.error || up2.error) return await fail(`upload: ${up1.error?.message || up2.error?.message}`, "Saving your player failed. Your free generation wasn't used, so please try again.", 500);

    const { error: saveError } = await admin.from("player_avatars").upsert({
      user_id: user.id, image_path: imagePath, thumb_path: thumbPath, style_version: STYLE_VERSION, prompt_version: PROMPT_VERSION, updated_at: new Date().toISOString(),
    });
    if (saveError) return await fail(`save: ${saveError.message}`, "Saving your player failed. Your free generation wasn't used, so please try again.", 500);

    await admin.from("player_avatar_generations")
      .update({ status: "succeeded", output_path: imagePath, source_path: null, provider_request_id: requestId, completed_at: new Date().toISOString() })
      .eq("id", generationId);

    // Earlier results are kept (each attempt's output_path stays valid) so
    // style versions can be compared; player_avatars points at the newest.
    await removeSource();
    trace("succeeded", { generation_id: generationId, user_id: user.id, request_id: requestId, output_path: imagePath });

    return json({ status: "succeeded", generation_id: generationId, avatar: { image_path: imagePath, thumb_path: thumbPath } });
  } catch (err) {
    return await fail(`exception: ${(err as Error).message}`, "Something went wrong. Your free generation wasn't used, so please try again.", 500);
  }
});
