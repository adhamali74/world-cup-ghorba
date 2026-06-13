import { PlayerAvatar } from "@/components/PlayerAvatar";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import type { Match, Player, Prediction } from "@/lib/types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · الغُربة و كاس العالم" },
      { name: "description", content: "Your World Cup 2026 prediction dashboard — next match, leaderboard, last result." },
    ],
  }),
  component: Dashboard,
});

function useCountdown(target?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return null;
  const diff = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, done: diff === 0 };
}

function Dashboard() {
  return (
    <AppShell>
      <DashboardInner />
    </AppShell>
  );
}

function DashboardInner() {
  const { slug } = usePlayer();

  const { data: nextMatch } = useQuery({
    queryKey: ["next-match"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("*")
        .gte("kickoff_at", new Date().toISOString())
        .order("kickoff_at")
        .limit(1)
        .maybeSingle();
      return data as Match | null;
    },
  });

  const { data: standings = [] } = useQuery({
    queryKey: ["standings"],
    queryFn: async () => {
      const { data: players } = await supabase.from("players").select("id, slug, name, avatar_color, is_admin, avatar_url");
      const { data: preds } = await supabase.from("predictions").select("player_id,points_earned");
      const totals: Record<string, number> = {};
      (preds ?? []).forEach((p) => {
        if (p.points_earned != null) totals[p.player_id] = (totals[p.player_id] ?? 0) + p.points_earned;
      });
      return (players ?? [])
        .map((p: Player) => ({ ...p, points: totals[p.id] ?? 0 }))
        .sort((a, b) => b.points - a.points);
    },
  });

  const { data: liveMatch } = useQuery({
    queryKey: ["live-match"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const windowStart = new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("matches")
        .select("*")
        .lte("kickoff_at", nowIso)
        .gte("kickoff_at", windowStart)
        .order("kickoff_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as Match | null;
    },
  });

  const { data: lastResult } = useQuery({
    queryKey: ["last-result", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data: me } = await supabase.from("players").select("id").eq("slug", slug!).maybeSingle();
      if (!me) return null;
      const { data } = await supabase
        .from("predictions")
        .select("predicted_home, predicted_away, points_earned, match:matches(team_a,team_b,flag_a,flag_b,home_score,away_score,kickoff_at)")
        .eq("player_id", me.id)
        .not("points_earned", "is", null)
        .order("locked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const cd = useCountdown(nextMatch?.kickoff_at);

  return (
    <div className="space-y-6">
      {/* Matchday + countdown */}
      <section className="gold-border bg-card rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-xs tracking-[0.3em] text-muted-foreground">MATCHDAY</div>
            <div className="font-display text-2xl mt-1">
              {nextMatch
                ? new Date(nextMatch.kickoff_at).toLocaleDateString(undefined, {
                    weekday: "long", month: "short", day: "numeric",
                  })
                : "Tournament complete"}
            </div>
          </div>
          {cd && (
            <div className="text-right">
              <div className="font-display text-xs tracking-[0.3em] text-muted-foreground">KICKOFF IN</div>
              <div className="font-display text-2xl sm:text-4xl gold-text mt-1 tabular-nums">
                {String(cd.d).padStart(2, "0")}:{String(cd.h).padStart(2, "0")}:{String(cd.m).padStart(2, "0")}:{String(cd.s).padStart(2, "0")}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <section className="gold-border bg-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display tracking-widest text-lg">LEADERBOARD</h3>
            <Link to="/leaderboard" className="text-xs text-muted-foreground hover:text-primary">
              VIEW ALL →
            </Link>
          </div>
          <ul className="space-y-2">
            {standings.slice(0, 4).map((p, i) => (
              <li key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-card-mid">
                <div className="flex items-center gap-3">
                  <span className="font-display w-6 text-center">
                    {["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`}
                  </span>
                  <PlayerAvatar name={p.name} color={p.avatar_color} url={p.avatar_url} size={28} />
                  <span className="font-display tracking-wider">{p.name}</span>
                </div>
                <span className="font-display text-2xl gold-text tabular-nums">{p.points}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Next match */}
        <section className="gold-border bg-card rounded-2xl p-5">
          <h3 className="font-display tracking-widest text-lg mb-3">NEXT MATCH</h3>
          {nextMatch ? (
            <div className="text-center">
              <div className="flex items-center justify-around gap-4">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-4xl">{nextMatch.flag_a}</span>
                  <span className="font-display tracking-wider">{nextMatch.team_a}</span>
                </div>
                <span className="font-display text-2xl text-muted-foreground">VS</span>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-4xl">{nextMatch.flag_b}</span>
                  <span className="font-display tracking-wider">{nextMatch.team_b}</span>
                </div>
              </div>
              <Link to="/matches" className="btn-hero mt-5 text-base px-6 py-3">
                PREDICT THIS
              </Link>
            </div>
          ) : (
            <div className="text-muted-foreground">No upcoming matches.</div>
          )}
        </section>
      </div>

      {/* Last prediction */}
      {lastResult && (
        <section className="gold-border bg-card rounded-2xl p-5">
          <h3 className="font-display tracking-widest text-lg mb-3">YOUR LAST PREDICTION</h3>
          <div className="flex items-center justify-between">
            <div className="font-display text-xl">
              {(lastResult as any).match.flag_a} {(lastResult as any).match.team_a}{" "}
              <span className="gold-text">{lastResult.predicted_home}</span>
              <span className="text-muted-foreground"> – </span>
              <span className="gold-text">{lastResult.predicted_away}</span>{" "}
              {(lastResult as any).match.team_b} {(lastResult as any).match.flag_b}
            </div>
            <ResultBadge pts={lastResult.points_earned} />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Final: {(lastResult as any).match.home_score}–{(lastResult as any).match.away_score}
          </div>
        </section>
      )}
    </div>
  );
}

function ResultBadge({ pts }: { pts: number | null }) {
  if (pts === 3) return <span className="font-display text-correct">✅ EXACT +3</span>;
  if (pts === 1) return <span className="font-display text-partial">🟡 WINNER +1</span>;
  return <span className="font-display text-wrong">❌ 0</span>;
}
