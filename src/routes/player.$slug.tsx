import { PlayerAvatar } from "@/components/PlayerAvatar";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { calculatePoints } from "@/lib/scoring";
import type { Player } from "@/lib/types";

export const Route = createFileRoute("/player/$slug")({
  head: () => ({ meta: [{ title: "Player · كسكسي في كاس العالم" }] }),
  component: () => (
    <AppShell>
      <PlayerDetail />
    </AppShell>
  ),
});

function tierLabel(pts: number | null): string {
  if (pts === 5) return "+5 PERFECT";
  if (pts === 3) return "+3 GD MATCH";
  if (pts === 2) return "+2 CLOSE";
  if (pts === 1) return "+1 WINNER";
  if (pts === 0) return "0 WRONG";
  return `+${pts}`;
}

function tierClass(pts: number | null): string {
  if (pts != null && pts >= 2) return "text-correct";
  if (pts === 1) return "text-partial";
  return "text-wrong";
}

function tierReason(pts: number | null): string {
  if (pts === 5) return "Perfect score — exact match!";
  if (pts === 3) return "Correct goal difference.";
  if (pts === 2) return "Right winner, close scores.";
  if (pts === 1) return "Right winner / draw.";
  return "Wrong outcome.";
}

function PlayerDetail() {
  const { slug } = Route.useParams();
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["player-detail", slug],
    queryFn: async () => {
      const { data: player, error: pErr } = await supabase
        .from("players")
        .select("id, slug, name, avatar_color, is_admin, avatar_url")
        .eq("slug", slug)
        .maybeSingle();
      if (pErr) throw new Error(pErr.message);
      if (!player) throw new Error("Player not found");

      const [{ data: preds, error: predErr }, { data: matches, error: matchErr }] = await Promise.all([
        supabase
          .from("predictions")
          .select("id, match_id, predicted_home, predicted_away, points_earned, joker_used")
          .eq("player_id", (player as Player).id),
        supabase
          .from("matches")
          .select("id, team_a, team_b, flag_a, flag_b, home_score, away_score, kickoff_at, stage")
          .order("kickoff_at"),
      ]);
      if (predErr) throw new Error(predErr.message);
      if (matchErr) throw new Error(matchErr.message);

      return { player: player as Player, preds: preds ?? [], matches: matches ?? [] };
    },
    retry: 1,
    throwOnError: false,
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">{error}</p>
        <button onClick={() => { setError(null); window.location.reload(); }} className="btn-hero text-sm px-4 py-2">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;

  try {
    return renderPlayer(data);
  } catch (e: any) {
    console.error("Player detail render error:", e);
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Something went wrong loading this profile.</p>
        <button onClick={() => { setError(null); window.location.reload(); }} className="btn-hero text-sm px-4 py-2">
          Retry
        </button>
      </div>
    );
  }
}

function renderPlayer(data: { player: Player; preds: any[]; matches: any[] }) {
  const { player, preds, matches } = data;

  const matchById = new Map<string, any>();
  for (const m of matches) {
    if (m?.id) matchById.set(m.id, m);
  }

  const rows = preds
    .map((p: any) => ({ p, m: matchById.get(p.match_id) }))
    .filter((r) => r.m)
    .sort((a, b) => new Date(b.m.kickoff_at).getTime() - new Date(a.m.kickoff_at).getTime());

  const finished = rows.filter((r) => r.m.home_score != null);
  const upcoming = rows.filter((r) => r.m.home_score == null);

  const total = finished.reduce((s, r) => s + (r.p.points_earned ?? 0), 0);
  const exact = finished.filter((r) => r.p.points_earned === 5).length;
  const gdMatch = finished.filter((r) => r.p.points_earned === 3).length;
  const close = finished.filter((r) => r.p.points_earned === 2).length;
  const winner = finished.filter((r) => r.p.points_earned === 1).length;
  const wrong = finished.filter((r) => r.p.points_earned === 0).length;

  const statParts: string[] = [];
  if (exact > 0) statParts.push(`${exact} exact`);
  if (gdMatch > 0) statParts.push(`${gdMatch} GD`);
  if (close > 0) statParts.push(`${close} close`);
  if (winner > 0) statParts.push(`${winner} winner`);
  if (wrong > 0) statParts.push(`${wrong} wrong`);
  const statsText = statParts.length > 0 ? statParts.join(" · ") : "no matches scored yet";

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
            <span className="text-muted-foreground self-end mb-1">pts · {statsText}</span>
          </div>
        </div>
      </div>

      <section className="gold-border bg-card rounded-2xl p-5">
        <h2 className="font-display tracking-widest text-lg mb-3">SCORED MATCHES</h2>
        {finished.length === 0 && <p className="text-sm text-muted-foreground">No scored matches yet.</p>}
        <ul className="space-y-2">
          {finished.map(({ p, m }) => (
            <li key={p.id} className="bg-card-mid rounded-xl p-3">
              <div className="flex justify-between items-center gap-3">
                <div className="font-display text-sm sm:text-base truncate">
                  {m.flag_a} {m.team_a}{" "}
                  <span className="gold-text">{m.home_score}–{m.away_score}</span>{" "}
                  {m.team_b} {m.flag_b}
                </div>
                <div className={`font-display text-sm ${tierClass(p.points_earned)} shrink-0`}>
                  {tierLabel(p.points_earned)}
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>
                  Predicted:{" "}
                  <span className="text-foreground">{p.predicted_home}–{p.predicted_away}</span>
                  {p.joker_used && <span className="ml-1 text-primary">🔥 x2</span>}
                </span>
                <span>{tierReason(p.points_earned)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {upcoming.length > 0 && (
        <section className="gold-border bg-card rounded-2xl p-5">
          <h2 className="font-display tracking-widest text-lg mb-3">UPCOMING PREDICTIONS</h2>
          <p className="text-xs text-muted-foreground mb-2">Hidden until each match kicks off.</p>
          <ul className="space-y-2">
            {upcoming.map(({ p, m }) => {
              const kicked = m.kickoff_at ? new Date(m.kickoff_at).getTime() <= Date.now() : false;
              return (
                <li key={p.id} className="bg-card-mid rounded-xl p-3 flex justify-between items-center gap-3">
                  <div className="font-display text-sm truncate">
                    {m.flag_a} {m.team_a} <span className="text-muted-foreground">vs</span> {m.team_b} {m.flag_b}
                  </div>
                  <div className="font-display text-sm shrink-0">
                    {kicked ? (
                      <span>
                        {p.predicted_home}–{p.predicted_away}
                        {p.joker_used && <span className="ml-1 text-primary">🔥</span>}
                      </span>
                    ) : (
                      "🔒"
                    )}
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
