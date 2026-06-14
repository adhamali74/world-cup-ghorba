import { PlayerAvatar } from "@/components/PlayerAvatar";
import trophyAsset from "@/assets/world-cup-trophy.webp.asset.json";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import type { Player } from "@/lib/types";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard · الغُربة و كاس العالم" },
      { name: "description", content: "Live World Cup 2026 prediction standings for the 5-friend league." },
    ],
  }),
  component: () => (
    <AppShell>
      <LeaderboardPage />
    </AppShell>
  ),
});

function LeaderboardPage() {
  const qc = useQueryClient();
  const { slug } = usePlayer();

  useEffect(() => {
    // Auto-sync any finished match scores from ESPN on page load
    fetch("/api/public/hooks/sync-results", { method: "POST" })
      .then((r) => r.ok && r.json())
      .then((res) => {
        if (res?.updated > 0) qc.invalidateQueries({ queryKey: ["board"] });
      })
      .catch(() => {});

    const ch = supabase
      .channel("lb")
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, () =>
        qc.invalidateQueries({ queryKey: ["board"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data } = useQuery({
    queryKey: ["board"],
    queryFn: async () => {
      const [{ data: players }, { data: preds }, { data: matches }] = await Promise.all([
        supabase.from("players").select("id, slug, name, avatar_color, is_admin, avatar_url"),
        supabase.from("predictions").select("player_id, points_earned, match_id, predicted_home, predicted_away"),
        supabase.from("matches").select("id, team_a, team_b, flag_a, flag_b, home_score, away_score, kickoff_at"),
      ]);
      return { players: (players ?? []) as Player[], preds: preds ?? [], matches: matches ?? [] };
    },
  });

  if (!data) return null;

  const totals: Record<string, { pts: number; exact: number }> = {};
  data.preds.forEach((p: any) => {
    if (p.points_earned == null) return;
    const cur = totals[p.player_id] ?? { pts: 0, exact: 0 };
    cur.pts += p.points_earned;
    if (p.points_earned === 3) cur.exact += 1;
    totals[p.player_id] = cur;
  });

  const board = data.players
    .map((p) => ({ ...p, pts: totals[p.id]?.pts ?? 0, exact: totals[p.id]?.exact ?? 0 }))
    .sort((a, b) => b.pts - a.pts || b.exact - a.exact);

  const max = Math.max(1, ...board.map((b) => b.pts));
  const top = board[0]?.pts ?? 0;

  // Most recent finished match
  const finished = data.matches
    .filter((m: any) => m.home_score != null)
    .sort((a: any, b: any) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime());
  const last = finished[0];
  const lastPreds = last ? data.preds.filter((p: any) => p.match_id === last.id) : [];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <img
          src={trophyAsset.url}
          alt="FIFA World Cup trophy"
          className="mx-auto mb-3 h-32 w-auto drop-shadow-[0_8px_24px_rgba(250,204,21,0.45)]"
        />
        <h1 className="font-display text-5xl gold-text">LEADERBOARD</h1>
        <p className="font-arabic text-muted-foreground mt-1">الغُربة و كاس العالم · 2026</p>
      </div>

      <section className="gold-border bg-card rounded-2xl p-5 space-y-3">
        {board.map((p, i) => {
          const isMe = p.slug === slug;
          const gap = top - p.pts;
          return (
            <div key={p.id} className={`p-4 rounded-xl ${isMe ? "bg-primary/10 border border-primary/30" : "bg-card-mid"}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="font-display text-2xl sm:text-3xl w-10 text-center shrink-0">
                    {["🥇","🥈","🥉"][i] ?? `${i+1}.`}
                  </span>
                  <div
                    className={`relative rounded-full shrink-0 ${
                      i === 0
                        ? "ring-2 ring-yellow-400 shadow-[0_0_22px_rgba(250,204,21,0.4)]"
                        : i === 1
                        ? "ring-2 ring-slate-300 shadow-[0_0_18px_rgba(203,213,225,0.28)]"
                        : i === 2
                        ? "ring-2 ring-amber-600 shadow-[0_0_18px_rgba(217,119,6,0.28)]"
                        : "ring-1 ring-border"
                    }`}
                  >
                    <PlayerAvatar name={p.name} color={p.avatar_color} url={p.avatar_url} size={64} />
                  </div>
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-display tracking-wider text-base sm:text-lg truncate">{p.name}</span>
                    {i === 0 && <span className="text-xl">👑</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-3xl sm:text-4xl gold-text tabular-nums leading-none">{p.pts}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{p.exact} exact</div>
                </div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-background overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-deep via-primary to-primary-glow transition-all duration-700"
                  style={{ width: `${(p.pts / max) * 100}%` }}
                />
              </div>
              {isMe && i > 0 && (
                <div className="text-xs text-muted-foreground mt-2">Gap to 1st: −{gap} pts</div>
              )}
              {isMe && i === board.length - 1 && board.length > 1 && (
                <div className="text-xs text-muted-foreground mt-2">Last place? Ronaldo started at Sporting CP. Comebacks are written in CR7. 🐐</div>
              )}
            </div>
          );
        })}
      </section>

      {last && (
        <section className="gold-border bg-card rounded-2xl p-5">
          <h3 className="font-display tracking-widest text-lg mb-3">LAST MATCH</h3>
          <div className="font-display text-xl mb-3">
            {last.flag_a} {last.team_a} <span className="gold-text">{last.home_score}–{last.away_score}</span> {last.team_b} {last.flag_b}
          </div>
          <ul className="space-y-1">
            {lastPreds.map((p: any) => {
              const player = data.players.find((x) => x.id === p.player_id);
              if (!player) return null;
              const tag = p.points_earned === 3 ? "✅ +3 EXACT" : p.points_earned === 1 ? "🟡 +1" : "❌ 0";
              const cls = p.points_earned === 3 ? "text-correct" : p.points_earned === 1 ? "text-partial" : "text-wrong";
              return (
                <li key={p.id} className="flex justify-between text-sm">
                  <span className="font-display tracking-wider">{player.name}: {p.predicted_home}–{p.predicted_away}</span>
                  <span className={`font-display ${cls}`}>{tag}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
