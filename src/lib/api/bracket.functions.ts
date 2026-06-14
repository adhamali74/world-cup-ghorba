import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const R32_DEADLINE_ISO = "2026-06-28T21:00:00.000Z";

const SubmitSchema = z.object({
  player_slug: z.string().min(1).max(64),
  semi_finalists: z.array(z.string().min(1).max(64)).length(4),
  winner: z.string().min(1).max(64),
});

export const submitBracket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SubmitSchema.parse(d))
  .handler(async ({ data }) => {
    if (Date.now() >= new Date(R32_DEADLINE_ISO).getTime()) {
      throw new Error("Bracket locked — R32 already started 🔒");
    }

    const unique = new Set(data.semi_finalists);
    if (unique.size !== 4) throw new Error("Pick 4 different teams");
    if (!unique.has(data.winner)) throw new Error("Winner must be one of your 4 semi-finalists");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Validate teams exist in group-stage matches
    const { data: groupMatches } = await supabaseAdmin
      .from("matches")
      .select("team_a, team_b")
      .eq("stage", "group");
    const validTeams = new Set<string>();
    (groupMatches ?? []).forEach((m) => {
      validTeams.add(m.team_a);
      validTeams.add(m.team_b);
    });
    for (const t of data.semi_finalists) {
      if (!validTeams.has(t)) throw new Error(`Unknown team: ${t}`);
    }

    const { data: player, error: pErr } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("slug", data.player_slug)
      .maybeSingle();
    if (pErr || !player) throw new Error("Player not found");

    const { error: upErr } = await supabaseAdmin
      .from("bracket_predictions")
      .upsert(
        {
          player_id: player.id,
          semi_finalist_1: data.semi_finalists[0],
          semi_finalist_2: data.semi_finalists[1],
          semi_finalist_3: data.semi_finalists[2],
          semi_finalist_4: data.semi_finalists[3],
          winner: data.winner,
          submitted_at: new Date().toISOString(),
          points_earned: null,
        },
        { onConflict: "player_id" },
      );
    if (upErr) throw new Error(upErr.message);

    return { ok: true };
  });
