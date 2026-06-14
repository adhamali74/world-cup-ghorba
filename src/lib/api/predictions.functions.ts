import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LockSchema = z.object({
  player_slug: z.string().min(1).max(64),
  match_id: z.string().uuid(),
  home: z.number().int().min(0).max(20),
  away: z.number().int().min(0).max(20),
  joker: z.boolean().optional().default(false),
});

export const lockPrediction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LockSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: player, error: pErr } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("slug", data.player_slug)
      .maybeSingle();
    if (pErr || !player) throw new Error("Player not found");

    const { data: match, error: mErr } = await supabaseAdmin
      .from("matches")
      .select("id, kickoff_at, home_score, away_score, stage")
      .eq("id", data.match_id)
      .maybeSingle();
    if (mErr || !match) throw new Error("Match not found");

    if (new Date(match.kickoff_at).getTime() <= Date.now()) {
      throw new Error("Too late to predict this one 😤");
    }

    if (data.joker) {
      // Find all matches in the same stage
      const { data: stageMatches } = await supabaseAdmin
        .from("matches")
        .select("id")
        .eq("stage", match.stage);
      const stageMatchIds = (stageMatches ?? []).map((m) => m.id);

      const { data: existingJokers } = await supabaseAdmin
        .from("predictions")
        .select("id, match_id")
        .eq("player_id", player.id)
        .eq("joker_used", true)
        .in("match_id", stageMatchIds);

      const otherJoker = (existingJokers ?? []).find((p) => p.match_id !== match.id);
      if (otherJoker) throw new Error("Joker already used in this stage 🔥");
    }

    const { error: upErr } = await supabaseAdmin
      .from("predictions")
      .upsert(
        {
          player_id: player.id,
          match_id: match.id,
          predicted_home: data.home,
          predicted_away: data.away,
          locked_at: new Date().toISOString(),
          points_earned: null,
          joker_used: data.joker,
        },
        { onConflict: "player_id,match_id" },
      );
    if (upErr) throw new Error(upErr.message);

    return { ok: true };
  });
