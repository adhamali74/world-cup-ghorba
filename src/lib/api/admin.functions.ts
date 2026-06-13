import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SubmitSchema = z.object({
  password: z.string().min(1).max(200),
  match_id: z.string().uuid(),
  home_score: z.number().int().min(0).max(20),
  away_score: z.number().int().min(0).max(20),
});

export const submitResult = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SubmitSchema.parse(d))
  .handler(async ({ data }) => {
    if (!process.env.ADMIN_PASSWORD || data.password !== process.env.ADMIN_PASSWORD) {
      throw new Error("Wrong password");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Update match
    const { error: mErr } = await supabaseAdmin
      .from("matches")
      .update({ home_score: data.home_score, away_score: data.away_score })
      .eq("id", data.match_id);
    if (mErr) throw new Error(mErr.message);

    // Recalc points for every prediction on this match
    const { data: preds, error: pErr } = await supabaseAdmin
      .from("predictions")
      .select("id, predicted_home, predicted_away")
      .eq("match_id", data.match_id);
    if (pErr) throw new Error(pErr.message);

    const updates = (preds ?? []).map((p) => {
      const ph = p.predicted_home;
      const pa = p.predicted_away;
      const ah = data.home_score;
      const aa = data.away_score;
      let pts = 0;
      if (ph === ah && pa === aa) pts = 3;
      else if (Math.sign(ph - pa) === Math.sign(ah - aa)) pts = 1;
      return { id: p.id, points_earned: pts };
    });

    for (const u of updates) {
      await supabaseAdmin.from("predictions").update({ points_earned: u.points_earned }).eq("id", u.id);
    }
    return { ok: true, updated: updates.length };
  });

const VerifySchema = z.object({ password: z.string().min(1).max(200) });

export const verifyAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => VerifySchema.parse(d))
  .handler(async ({ data }) => {
    if (!process.env.ADMIN_PASSWORD || data.password !== process.env.ADMIN_PASSWORD) {
      throw new Error("Wrong password");
    }
    return { ok: true };
  });
