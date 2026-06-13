import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PinSchema = z.string().regex(/^\d{4,8}$/, "PIN must be 4-8 digits");

async function hashPin(pin: string): Promise<string> {
  const pepper = process.env.ADMIN_PASSWORD ?? "ghorba-pepper";
  const data = new TextEncoder().encode(`${pepper}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const LoginSchema = z.object({
  slug: z.string().min(1).max(64),
  pin: PinSchema,
});

export const loginPlayer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LoginSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: player, error } = await supabaseAdmin
      .from("players")
      .select("id, slug, name, pin_hash")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!player) throw new Error("Player not found");

    const incoming = await hashPin(data.pin);

    if (!player.pin_hash) {
      // First-time set: claim this PIN
      const { error: uErr } = await supabaseAdmin
        .from("players")
        .update({ pin_hash: incoming })
        .eq("id", player.id);
      if (uErr) throw new Error(uErr.message);
      return { ok: true, firstTime: true, slug: player.slug };
    }

    if (!safeEq(player.pin_hash, incoming)) throw new Error("Wrong PIN");
    return { ok: true, firstTime: false, slug: player.slug };
  });

const SetPinSchema = z.object({
  password: z.string().min(1).max(200),
  slug: z.string().min(1).max(64),
  pin: PinSchema,
});

export const adminSetPin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SetPinSchema.parse(d))
  .handler(async ({ data }) => {
    if (!process.env.ADMIN_PASSWORD || data.password !== process.env.ADMIN_PASSWORD) {
      throw new Error("Wrong admin password");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = await hashPin(data.pin);
    const { error } = await supabaseAdmin
      .from("players")
      .update({ pin_hash: hash })
      .eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ClearPinSchema = z.object({
  password: z.string().min(1).max(200),
  slug: z.string().min(1).max(64),
});

export const adminClearPin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ClearPinSchema.parse(d))
  .handler(async ({ data }) => {
    if (!process.env.ADMIN_PASSWORD || data.password !== process.env.ADMIN_PASSWORD) {
      throw new Error("Wrong admin password");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("players")
      .update({ pin_hash: null })
      .eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



const ChangePinSchema = z.object({
  slug: z.string().min(1).max(64),
  oldPin: PinSchema,
  newPin: PinSchema,
});

export const changePin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ChangePinSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: player, error } = await supabaseAdmin
      .from("players")
      .select("id, pin_hash")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!player) throw new Error("Player not found");
    if (!player.pin_hash) throw new Error("PIN not set yet");

    const oldHash = await hashPin(data.oldPin);
    if (!safeEq(player.pin_hash, oldHash)) throw new Error("Current PIN is wrong");

    const newHash = await hashPin(data.newPin);
    const { error: uErr } = await supabaseAdmin
      .from("players")
      .update({ pin_hash: newHash })
      .eq("id", player.id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });

