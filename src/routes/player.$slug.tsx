import { PlayerAvatar } from "@/components/PlayerAvatar";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import type { Player } from "@/lib/types";

export const Route = createFileRoute("/player/$slug")({
  head: () => ({ meta: [{ title: "Player · كسكسي في كاس العالم" }] }),
  component: () => (
    <AppShell>
      <PlayerDetail />
    </AppShell>
  ),
});

function PlayerDetail() {
  const { slug } = Route.useParams();

  const { data } = useQuery({
    queryKey: ["player-detail", slug],
    queryFn: async () => {
      const { data: player } = await supabase
        .from("players")
        .select("id, slug, name, avatar_color, is_admin, avatar_url")
        .eq("slug", slug)
        .maybeSingle();
      if (!player) return null;
      const [{ data: preds }, { data: matches }] = await Promise.all([
        supabase
          .from("predictions")
          .select("id, match_id, predicted_home, predicted_away, points_earned")
          .eq("player_id", (player as Player).id),
        supabase
          .from("matches")
          .select("id, team_a, team_b, flag_a, flag_b, home_score, away_score, kickoff_at, stage"),
      ]);
      return { player: player as Player, preds: preds ?? [], matches: matches ?? [] };
    },
  });

  if (!data) return null;
  const { player, preds, matches } = data;

  const matchById = new Map(matches.map((m: any) => [m.id, m]));
  const rows = preds
    .map((p: any) => ({ p, m: matchById.get(p.match_id) }))
    .filter((r) => r.m)
    .sort((a, b) => new Date(b.m.kickoff_at).getTime() - new Date(a.m.kickoff_at).getTime());

  const finished = rows.filter((r) => r.m.home_score != null);
  const upcoming = rows.filter((r) => r.m.home_score == null);

  const total = finished.reduce((s, r) => s + (r.p.points_earned ?? 0), 0);
  const exact = finished.filter((r) => r.p.points_earned === 3).length;
  const partial = finished.filter((r) => r.p.points_earned === 1).length;
  const wrong = finished.filter((r) => r.p.points_earned === 0).length;

  return (
    <div className="space-y-6">
      <Link to="/leaderboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to leaderboard
      </Link>

      <div className="gold-border bg-card rounded-2xl p-6 flex items-center gap-5">
        <PlayerAvatar name={player.name} color={player.avatar_color} url={player.avatar_url} size={88} />
        <div className="min-w-0">
          <h1 className="font-display text-3xl tracking-wider">{player.name}</h1>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="font-display gold-text text-2xl tabular-nums">{total}</span>
            <span className="text-muted-foreground self-end mb-1">pts · {exact} exact · {partial} partial · {wrong} wrong</span>
          </div>
        </div>
      </div>

      <section className="gold-border bg-card rounded-2xl p-5">
        <h2 className="font-display tracking-widest text-lg mb-3">SCORED MATCHES</h2>
        {finished.length === 0 && <p className="text-sm text-muted-foreground">No scored matches yet.</p>}
        <ul className="space-y-2">
          {finished.map(({ p, m }) => {
            const tag = p.points_earned === 3 ? "+3 EXACT" : p.points_earned === 1 ? "+1 DIRECTION" : "0";
            const cls = p.points_earned === 3 ? "text-correct" : p.points_earned === 1 ? "text-partial" : "text-wrong";
            const reason =
              p.points_earned === 3
                ? "Perfect score predicted."
                : p.points_earned === 1
                ? "Right winner / draw, wrong score."
                : "Wrong outcome.";
            return (
              <li key={p.id} className="bg-card-mid rounded-xl p-3">
                <div className="flex justify-between items-center gap-3">
                  <div className="font-display text-sm sm:text-base truncate">
                    {m.flag_a} {m.team_a} <span className="gold-text">{m.home_score}–{m.away_score}</span> {m.team_b} {m.flag_b}
                  </div>
                  <div className={`font-display text-sm ${cls} shrink-0`}>{tag}</div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Predicted: <span className="text-foreground">{p.predicted_home}–{p.predicted_away}</span></span>
                  <span>{reason}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {upcoming.length > 0 && (
        <section className="gold-border bg-card rounded-2xl p-5">
          <h2 className="font-display tracking-widest text-lg mb-3">UPCOMING PREDICTIONS</h2>
          <p className="text-xs text-muted-foreground mb-2">Hidden until each match kicks off.</p>
          <ul className="space-y-2">
            {upcoming.map(({ p, m }) => {
              const kicked = new Date(m.kickoff_at).getTime() <= Date.now();
              return (
                <li key={p.id} className="bg-card-mid rounded-xl p-3 flex justify-between items-center gap-3">
                  <div className="font-display text-sm truncate">
                    {m.flag_a} {m.team_a} <span className="text-muted-foreground">vs</span> {m.team_b} {m.flag_b}
                  </div>
                  <div className="font-display text-sm shrink-0">
                    {kicked ? `${p.predicted_home}–${p.predicted_away}` : "🔒"}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
