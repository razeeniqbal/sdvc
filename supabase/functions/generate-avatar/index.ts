import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { defaultPose, isPose, poseBlock, type Pose } from "./pose.ts";

// generate-avatar: turns a player's photo into their permanent VSB player art.
//
//   1. authenticate the caller from their JWT
//   2. reserve a generation (reserve_avatar_generation: row-locked, idempotent,
//      enforces 1 free + admin grants; admins unlimited, decided by DB role)
//   3. image EDIT (POST /v1/images/edits) with two real image inputs:
//        image 1 = VSB STYLE MASTER: the lossless production Player #10 PNG on
//                  a 1024x1536 transparent canvas (public/brand/avatar-style-v3.png,
//                  uploaded by the client next to the photo, pinned by SHA-256)
//        image 2 = the player's photo (1024x1024 JPEG crop; identity only)
//      The task is "edit image 1: keep its illustration system, kit and body;
//      replace the identity with the person in image 2", with high input
//      fidelity so the master's rendering is preserved, not re-imagined.
//   4. store the 1024x1536 PNG master untouched + a 256px thumbnail in the
//      public player-avatars bucket, point player_avatars at them
//   5. ALWAYS delete the source photo (the club keeps no originals)
// Glasses come from the player's answer (profiles.wears_glasses), not the
// model's reading of the photo; unanswered means only glasses clearly worn.
// Pose (pose.ts): one of six calm identity poses from the profile, or a
// stable default; only the pose instruction changes, style/kit/framing don't.
// A failed attempt is marked 'failed', which does not count against the
// player's free generation. Earlier results are kept, never auto-deleted.
//
// Only the character is generated, in a clean VSB kit with no jersey number
// (VSB has no real player numbers; none is ever invented). Name, position,
// stats, logo and card frame are drawn live by the app (PlayerCard).
//
// Secrets: OPENAI_API_KEY (required). Optional: OPENAI_IMAGE_MODEL
// (default gpt-image-1.5), OPENAI_IMAGE_QUALITY (default high).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Bump all three together when the style master or prompt changes.
const STYLE_VERSION = 3;
const PROMPT_VERSION = "VSB_PLAYER_V6"; // V6: V5 + glasses from the player's own answer
// SHA-256 of public/brand/avatar-style-v3.png (production Player #10, lossless).
const STYLE_SHA256 = "d2c7fd2dcb2686acce39a04f9be6719137b47a9fe5dd90e14f9fd95ab5c44b66";
const DEFAULT_MODEL = "gpt-image-1.5";
const FALLBACK_MODEL = "gpt-image-1";
const THUMB_SIZE = 256;

function headwearRule(gender: string | null): string {
  if (gender === "Male") {
    return "HEAD: draw the person's own hair uncovered, following their visible hairline, hair colour and hairstyle from IMAGE 2. Never draw a cap, hat, hood, scarf or any head covering.";
  }
  const hijab = "If the person in IMAGE 2 wears a hijab, keep it as a clean, fitted black sports hijab drawn in IMAGE 1's style (same outline and shading quality as IMAGE 1's hair), and add a fitted black long-sleeve base layer and full-length black leggings UNDER the same short-sleeve jersey and shorts. The jersey and shorts stay exactly as in IMAGE 1. Otherwise draw their own hair uncovered.";
  return `HEAD: ${hijab} Never draw a cap, hat or hood.`;
}

// The player says whether they wear glasses; the model was adding them.
function glassesRule(wearsGlasses: boolean | null): string {
  if (wearsGlasses === true) {
    return "GLASSES: the player wears glasses. Draw glasses matching the frame shape and colour in IMAGE 2, in IMAGE 1's style, with large anime eyes visible behind them.";
  }
  if (wearsGlasses === false) {
    return "GLASSES: the player does NOT wear glasses. Draw no glasses, sunglasses, goggles or any eyewear, even if IMAGE 2 shows some.";
  }
  return "GLASSES: only if IMAGE 2 clearly shows glasses worn on the face. If there is any doubt, draw no glasses or eyewear of any kind.";
}

function buildPrompt(gender: string | null, pose: Pose, wearsGlasses: boolean | null): string {
  const genderLine = gender === "Male" ? "The player's profile says male." : gender === "Female" ? "The player's profile says female." : "";
  return [
    "Edit IMAGE 1. IMAGE 1 is the approved VSB production character (Player #10). IMAGE 2 is a photo of a real person.",
    "Transform the person in IMAGE 2 into this established VSB illustration. Keep IMAGE 1's illustration system unchanged:",
    "the same premium 2D soft-dimensional anime-chibi sports rendering, head-to-body proportion, large expressive anime eye construction with catchlights,",
    "line weight and outline quality, soft dimensional shading, hand detail, athletic silhouette, knee-pad treatment, shoe detail, volleyball rendering,",
    "uniform construction and fabric, blue saturation, lighting and overall production polish.",

    "Change ONLY the identity, taken from IMAGE 2: face shape, skin tone (face, neck, arms and legs), hairstyle, hair colour and eyebrows;",
    "and facial hair only if they have it. Draw these in IMAGE 1's anime style.",
    glassesRule(wearsGlasses),
    "Do not keep IMAGE 1's face or hairstyle. Do not beautify, age, or change ethnicity or skin tone. Ignore the clothing, accessories and background of IMAGE 2.",
    genderLine,
    headwearRule(gender),

    `UNIFORM, exactly IMAGE 1's kit: short-sleeve deep-ink V-neck volleyball jersey with the same electric-blue geometric shoulder and side panels,`,
    `matching black volleyball shorts with blue side panels, black knee pads, black athletic socks and white volleyball shoes.`,
    "Remove the jersey number: the jersey front is plain, with no number, no letters and no text. Keep only IMAGE 1's small emblems.",
    "Never a hoodie, sweatshirt, tracksuit, jacket, long-sleeve top over the jersey, casual clothes or another sport's kit.",

    poseBlock(pose),
    "OUTPUT: only the character on a fully transparent background, the whole figure from the top of the head to the shoes, nothing cropped.",
    "No card, name, badge, statistics, logo, background, floor or shadow.",
    "AVOID: 3D render, Pixar, Funko, Mii, Bitmoji, mobile-game avatar, corporate mascot, flat vector avatar, realistic or semi-realistic human, small realistic eyes, children's cartoon, generic chibi-generator look.",
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

// One structured line per attempt for review. Never includes keys, the prompt
// or image bytes.
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

interface EditPayload { error?: { message?: string }; data?: { b64_json?: string }[] }
interface EditResult { ok: boolean; status: number; requestId: string | null; payload: EditPayload; model: string; fidelity: boolean }

async function callEdit(apiKey: string, model: string, fidelity: boolean, prompt: string, style: Uint8Array, photo: Blob): Promise<EditResult> {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("image[]", new File([style], "vsb-style-master.png", { type: "image/png" }));
  form.append("image[]", new File([photo], "player-photo.jpg", { type: photo.type || "image/jpeg" }));
  if (fidelity) form.append("input_fidelity", "high");
  form.append("size", "1024x1536"); // tallest portrait offered; matches the master canvas
  form.append("background", "transparent");
  form.append("output_format", "png");
  form.append("quality", Deno.env.get("OPENAI_IMAGE_QUALITY") || "high");
  form.append("n", "1");
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const payload: EditPayload = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, requestId: res.headers.get("x-request-id"), payload, model, fidelity };
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

  let requestId: string | null = null;
  let usedModel = Deno.env.get("OPENAI_IMAGE_MODEL") || DEFAULT_MODEL;
  await admin.from("player_avatar_generations")
    .update({ prompt_version: PROMPT_VERSION, style_version: STYLE_VERSION, model: usedModel })
    .eq("id", generationId);

  const fail = async (reason: string, userMessage: string, status = 502) => {
    await admin.from("player_avatar_generations")
      .update({ status: "failed", failure_reason: reason.slice(0, 500), completed_at: new Date().toISOString(), source_path: null, provider_request_id: requestId, model: usedModel })
      .eq("id", generationId);
    await removeSource();
    trace("failed", { generation_id: generationId, user_id: user.id, request_id: requestId, model: usedModel, reason: reason.slice(0, 200) });
    return json({ error: userMessage, code: "GENERATION_FAILED" }, status);
  };

  try {
    // Explicit profile data only (never inferred from the photo).
    const { data: prof } = await admin.from("profiles").select("gender, player_pose, wears_glasses").eq("id", user.id).maybeSingle();
    const wearsGlasses: boolean | null = typeof prof?.wears_glasses === "boolean" ? prof.wears_glasses : null;
    const gender = prof?.gender ?? null;
    // Pose: the player's choice, or a stable default that is saved so the
    // same pose is kept for later regenerations (never random per attempt).
    const pose: Pose = isPose(prof?.player_pose) ? prof!.player_pose : defaultPose(user.id);
    if (!isPose(prof?.player_pose)) {
      await admin.from("profiles").update({ player_pose: pose }).eq("id", user.id);
    }
    await admin.from("player_avatar_generations").update({ pose, glasses: wearsGlasses }).eq("id", generationId);
    const prompt = buildPrompt(gender, pose, wearsGlasses);

    const { data: photo, error: dlError } = await admin.storage.from("player-sources").download(sourcePath);
    if (dlError || !photo) return await fail(`download: ${dlError?.message}`, "We couldn't read your photo. Please upload it again.", 400);

    // 3. Edit the style master with the photo as identity reference.
    trace("started", { generation_id: generationId, user_id: user.id, model: usedModel, input_fidelity: "high", pose, glasses: wearsGlasses });
    let result = await callEdit(apiKey, usedModel, true, prompt, styleBytes, photo);

    // Explicit, recorded fallbacks (never a silent switch to text-only):
    // the model isn't available to this key → gpt-image-1; the model rejects
    // input_fidelity → retry once without it.
    const errMsg = () => String(result.payload?.error?.message || "");
    if (!result.ok && usedModel !== FALLBACK_MODEL && /model/i.test(errMsg()) && [400, 403, 404].includes(result.status)) {
      trace("model_fallback", { generation_id: generationId, from: usedModel, to: FALLBACK_MODEL, request_id: result.requestId, reason: errMsg().slice(0, 200) });
      usedModel = FALLBACK_MODEL;
      result = await callEdit(apiKey, usedModel, true, prompt, styleBytes, photo);
    }
    if (!result.ok && result.status === 400 && /input_fidelity/i.test(errMsg())) {
      trace("fidelity_fallback", { generation_id: generationId, model: usedModel, request_id: result.requestId });
      result = await callEdit(apiKey, usedModel, false, prompt, styleBytes, photo);
    }
    requestId = result.requestId;

    if (!result.ok) {
      const providerMsg: string = errMsg() || `HTTP ${result.status}`;
      const moderated = /safety|moderation|policy/i.test(providerMsg);
      return await fail(`provider (${usedModel}): ${providerMsg}`, moderated
        ? "This photo couldn't be used. Try a clear, front-facing photo of just you."
        : "The image service is busy or unavailable. Your free generation wasn't used, so please try again later.");
    }
    const b64 = result.payload?.data?.[0]?.b64_json;
    if (!b64) return await fail("provider: empty result", "No image came back. Your free generation wasn't used, so please try again.");

    // 4. Store the full-resolution master untouched + a thumbnail derivative.
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
      .update({ status: "succeeded", output_path: imagePath, source_path: null, provider_request_id: requestId, model: `${usedModel}${result.fidelity ? "" : " (no input_fidelity)"}`, completed_at: new Date().toISOString() })
      .eq("id", generationId);

    await removeSource();
    trace("succeeded", { generation_id: generationId, user_id: user.id, request_id: requestId, model: usedModel, input_fidelity: result.fidelity, output_path: imagePath });

    return json({ status: "succeeded", generation_id: generationId, avatar: { image_path: imagePath, thumb_path: thumbPath } });
  } catch (err) {
    return await fail(`exception: ${(err as Error).message}`, "Something went wrong. Your free generation wasn't used, so please try again.", 500);
  }
});
