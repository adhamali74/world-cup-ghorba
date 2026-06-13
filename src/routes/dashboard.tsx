import { PlayerAvatar } from "@/components/PlayerAvatar";
import trophyAsset from "@/assets/world-cup-trophy.webp.asset.json";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import type { Match, Player, Prediction } from "@/lib/types";
import { getLiveMatch, type LiveMatchData } from "@/lib/api/live-match.functions";

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

  const liveFn = useServerFn(getLiveMatch);
  const { data: liveMatch } = useQuery({
    queryKey: ["espn-live-match"],
    queryFn: () => liveFn(),
    refetchInterval: 30_000,
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
      {/* Matchday + countdown + next match details */}
      <section className="gold-border bg-card rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
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

        {nextMatch && (
          <div className="mt-5 pt-5 border-t border-border/50">
            <div className="flex items-center justify-around gap-4">
              <div className="flex flex-col items-center gap-1 flex-1">
                <span className="text-4xl sm:text-5xl">{nextMatch.flag_a}</span>
                <span className="font-display tracking-wider text-sm sm:text-base">{nextMatch.team_a}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="font-display text-xl sm:text-2xl text-muted-foreground">VS</span>
                <span className="text-[10px] tracking-[0.2em] text-muted-foreground">
                  {new Date(nextMatch.kickoff_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 flex-1">
                <span className="text-4xl sm:text-5xl">{nextMatch.flag_b}</span>
                <span className="font-display tracking-wider text-sm sm:text-base">{nextMatch.team_b}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 mt-3 text-xs text-muted-foreground">
              {nextMatch.venue && <span>📍 {nextMatch.venue}</span>}
              {nextMatch.stage && <span className="uppercase tracking-widest">· {nextMatch.stage}{nextMatch.group_letter ? ` ${nextMatch.group_letter}` : ""}</span>}
            </div>
            <div className="text-center mt-4">
              <Link to="/matches" className="btn-hero text-base px-6 py-3 inline-block">PREDICT THIS</Link>
            </div>
          </div>
        )}
      </section>

      {/* Leaderboard */}
      <section className="gold-border bg-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display tracking-widest text-lg">LEADERBOARD</h3>
          <Link to="/leaderboard" className="text-xs text-muted-foreground hover:text-primary">
            VIEW ALL →
          </Link>
        </div>
        <ul className="space-y-3">
          {standings.slice(0, 4).map((p, i) => {
            const medal = ["🥇", "🥈", "🥉"][i];
            const ringClass =
              i === 0
                ? "ring-2 ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.35)]"
                : i === 1
                ? "ring-2 ring-slate-300 shadow-[0_0_16px_rgba(203,213,225,0.25)]"
                : i === 2
                ? "ring-2 ring-amber-600 shadow-[0_0_16px_rgba(217,119,6,0.25)]"
                : "ring-1 ring-border";
            return (
              <li
                key={p.id}
                className="flex items-center justify-between py-3 px-4 rounded-xl bg-card-mid hover:bg-card-mid/80 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="font-display text-lg w-8 text-center shrink-0">
                    {medal ?? `${i + 1}.`}
                  </span>
                  <div className={`relative rounded-full ${ringClass}`}>
                    <PlayerAvatar name={p.name} color={p.avatar_color} url={p.avatar_url} size={56} />
                  </div>
                  <span className="font-display tracking-wider text-base sm:text-lg truncate">
                    {p.name}
                  </span>
                </div>
                <span className="font-display text-2xl sm:text-3xl gold-text tabular-nums shrink-0">
                  {p.points}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Live now — under leaderboard */}
      {liveMatch && <LiveMatchCard match={liveMatch} />}

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

function LiveMatchCard({ match }: { match: LiveMatchData }) {
  const isLive = match.state === "in";
  const isPre = match.state === "pre";
  const isPost = match.state === "post";

  const statusBadge = isLive ? (
    <span className="flex items-center gap-1.5 text-xs font-display tracking-widest text-red-400">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      LIVE
    </span>
  ) : isPost ? (
    <span className="text-xs font-display tracking-widest text-muted-foreground">FULL TIME</span>
  ) : (
    <span className="text-xs font-display tracking-widest text-muted-foreground">UPCOMING</span>
  );

  const clockLine = isLive
    ? match.clock || `${match.statusText}`
    : isPre
      ? new Date(match.kickoff).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })
      : "FT";

  return (
    <section className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-card via-card to-card-mid gold-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <span className="font-display tracking-widest text-sm">{match.competition.toUpperCase()}</span>
        </div>
        {statusBadge}
      </div>

      <div className="grid grid-cols-3 items-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <img src={match.home.logo} alt={match.home.name} className="w-14 h-14 object-contain" loading="lazy" />
          <span className="font-display tracking-wider text-sm text-center">{match.home.name}</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="font-display text-5xl sm:text-6xl gold-text tabular-nums">
            {isPre ? "vs" : (
              <>
                {match.home.score} <span className="text-muted-foreground">-</span> {match.away.score}
              </>
            )}
          </div>
          <div className={`mt-1 font-display text-sm tabular-nums ${isLive ? "text-red-400" : "text-muted-foreground"}`}>
            {clockLine}
          </div>
          {match.venue && <div className="mt-2 text-[10px] text-muted-foreground text-center">📍 {match.venue}</div>}
        </div>
        <div className="flex flex-col items-center gap-2">
          <img src={match.away.logo} alt={match.away.name} className="w-14 h-14 object-contain" loading="lazy" />
          <span className="font-display tracking-wider text-sm text-center">{match.away.name}</span>
        </div>
      </div>
    </section>
  );
}
