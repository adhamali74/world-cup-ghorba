import { PlayerAvatar } from "@/components/PlayerAvatar";
import trophyAsset from "@/assets/world-cup-trophy.webp.asset.json";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import type { Match, Player, Prediction } from "@/lib/types";
import { getLiveMatch, type LiveMatchData } from "@/lib/api/live-match.functions";
import { lockPrediction } from "@/lib/api/predictions.functions";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · كسكسي في كاس العالم" },
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
  const qc = useQueryClient();

  useEffect(() => {
    fetch("/api/public/hooks/sync-results", { method: "POST" })
      .then((r) => r.ok && r.json())
      .then((res) => {
        if (res?.updated > 0 || res?.rescored > 0) {
          qc.invalidateQueries({ queryKey: ["standings"] });
          qc.invalidateQueries({ queryKey: ["last-result"] });
          qc.invalidateQueries({ queryKey: ["next-match"] });
        }
      })
      .catch(() => {});

    const channel = supabase
      .channel("dashboard-scores")
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, () => {
        qc.invalidateQueries({ queryKey: ["standings"] });
        qc.invalidateQueries({ queryKey: ["last-result"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        qc.invalidateQueries({ queryKey: ["next-match"] });
        qc.invalidateQueries({ queryKey: ["last-result"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

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

  const { data: lastResults } = useQuery({
    queryKey: ["last-result", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data: me } = await supabase.from("players").select("id").eq("slug", slug!).maybeSingle();
      if (!me) return null;
      const { data } = await supabase
        .from("predictions")
        .select("id, predicted_home, predicted_away, points_earned, match:matches(team_a,team_b,flag_a,flag_b,home_score,away_score,kickoff_at)")
        .eq("player_id", me.id)
        .not("points_earned", "is", null)
        .order("locked_at", { ascending: false });
      if (!data || data.length === 0) return null;
      // Group by match day (local date), return the most recent day's rows
      const dayKey = (iso: string) => new Date(iso).toLocaleDateString();
      const latestDay = dayKey((data[0] as any).match.kickoff_at);
      const rows = data.filter((r: any) => dayKey(r.match.kickoff_at) === latestDay);
      return { day: latestDay, rows };
    },
  });

  const cd = useCountdown(nextMatch?.kickoff_at);

  const r32Deadline = new Date("2026-06-28T21:00:00.000Z").getTime();
  const showBracketBanner = Date.now() < r32Deadline;

  // Get current player ID
  const { data: me } = useQuery({
    queryKey: ["me", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data } = await supabase.from("players").select("id, slug").eq("slug", slug!).maybeSingle();
      return data as { id: string; slug: string } | null;
    },
  });

  // Get user's prediction for the next match
  const { data: myNextPrediction } = useQuery({
    queryKey: ["my-prediction", nextMatch?.id, me?.id],
    enabled: !!nextMatch && !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("predictions")
        .select("id, predicted_home, predicted_away, joker_used")
        .eq("player_id", me!.id)
        .eq("match_id", nextMatch!.id)
        .maybeSingle();
      return data as Prediction | null;
    },
  });

  const [predHome, setPredHome] = useState(myNextPrediction?.predicted_home ?? 0);
  const [predAway, setPredAway] = useState(myNextPrediction?.predicted_away ?? 0);
  const [predJoker, setPredJoker] = useState(myNextPrediction?.joker_used ?? false);

  useEffect(() => {
    if (myNextPrediction) {
      setPredHome(myNextPrediction.predicted_home);
      setPredAway(myNextPrediction.predicted_away);
      setPredJoker(myNextPrediction.joker_used);
    } else {
      setPredHome(0);
      setPredAway(0);
      setPredJoker(false);
    }
  }, [myNextPrediction?.id]);

  const lockFn = useServerFn(lockPrediction);
  const predMut = useMutation({
    mutationFn: () => lockFn({ data: { player_slug: slug!, match_id: nextMatch!.id, home: predHome, away: predAway, joker: predJoker } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-prediction"] });
      qc.invalidateQueries({ queryKey: ["next-match"] });
      qc.invalidateQueries({ queryKey: ["predictions"] });
    },
    onError: (e: any) => { /* handled by toast in UI */ },
  });

  const nextStarted = nextMatch ? new Date(nextMatch.kickoff_at).getTime() <= Date.now() : false;
  const minsToNextKickoff = nextMatch ? (new Date(nextMatch.kickoff_at).getTime() - Date.now()) / 60000 : Infinity;
  const nextClosingSoon = !nextStarted && minsToNextKickoff < 10;

  // Urgent matches closing within 10 minutes
  const { data: urgentMatches } = useQuery({
    queryKey: ["urgent-matches"],
    queryFn: async () => {
      const tenMinFromNow = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("matches")
        .select("id, team_a, team_b, flag_a, flag_b, kickoff_at")
        .gte("kickoff_at", new Date().toISOString())
        .lte("kickoff_at", tenMinFromNow)
        .is("home_score", null)
        .order("kickoff_at")
        .limit(3);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  // Joker availability for next match
  const { data: allMatches = [] } = useQuery({
    queryKey: ["all-matches"],
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("id, stage");
      return data ?? [];
    },
  });
  const { data: allMyPredictions = [] } = useQuery({
    queryKey: ["all-my-predictions", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase.from("predictions").select("id, match_id, joker_used").eq("player_id", me!.id);
      return data ?? [];
    },
  });
  const nextJokerAvailable = useMemo(() => {
    if (!nextMatch || !me) return false;
    const stageMatchIds = new Set(allMatches.filter((m) => m.stage === nextMatch.stage).map((m) => m.id));
    const alreadyUsed = allMyPredictions.some(
      (p) => p.joker_used && p.match_id !== nextMatch.id && stageMatchIds.has(p.match_id),
    );
    return !alreadyUsed;
  }, [nextMatch, me, allMatches, allMyPredictions]);

  return (
    <div className="space-y-6">
      {showBracketBanner && (
        <Link
          to="/bracket"
          className="block gold-border bg-gradient-to-r from-primary/15 via-primary/5 to-primary/15 rounded-2xl p-4 hover:from-primary/25 hover:to-primary/25 transition"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display tracking-widest text-sm gold-text">🏆 FINAL 4 BRACKET</div>
              <div className="text-xs text-muted-foreground mt-1">Submit your semi-finalists + winner before June 28!</div>
            </div>
            <span className="font-display tracking-widest text-xs gold-text shrink-0">PREDICT →</span>
          </div>
        </Link>
      )}

      {urgentMatches && urgentMatches.length > 0 && (
        <section className="border border-red-500/60 bg-red-950/20 rounded-2xl p-4 animate-pulse-fast">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">⏰</span>
            <span className="font-display tracking-widest text-sm text-red-400">PREDICTIONS CLOSING</span>
          </div>
          <div className="space-y-2">
            {urgentMatches.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between">
                <span className="font-display tracking-wider text-sm">
                  {m.flag_a} {m.team_a} vs {m.team_b} {m.flag_b}
                </span>
                <Link to="/matches" className="font-display tracking-widest text-xs text-red-400 hover:text-red-300">
                  PREDICT →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Matchday + countdown + next match details */}
      <section className="gold-border bg-card rounded-2xl p-5">
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3">
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
          <img
            src={trophyAsset.url}
            alt="FIFA World Cup trophy"
            className="hidden sm:block h-24 w-auto justify-self-center drop-shadow-[0_6px_20px_rgba(250,204,21,0.4)] [animation:trophy-float_6s_ease-in-out_infinite]"
          />
          {cd ? (
            <div className="text-right justify-self-end">
              <div className="font-display text-xs tracking-[0.3em] text-muted-foreground">KICKOFF IN</div>
              <div className="font-display text-2xl sm:text-4xl gold-text mt-1 tabular-nums">
                {String(cd.d).padStart(2, "0")}:{String(cd.h).padStart(2, "0")}:{String(cd.m).padStart(2, "0")}:{String(cd.s).padStart(2, "0")}
              </div>
            </div>
          ) : <div />}
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
            <div className="mt-5 pt-4 border-t border-border/50">
              {!slug ? (
                <p className="text-center text-xs text-muted-foreground">Pick your name to predict</p>
              ) : nextStarted ? (
                <div className="text-center">
                  <div className="font-display tracking-widest text-xs text-muted-foreground mb-2">YOUR PREDICTION</div>
                  {myNextPrediction ? (
                    <>
                      <div className="flex items-center justify-center gap-3">
                        <span className="scoreboard-digit">{myNextPrediction.predicted_home}</span>
                        <span className="font-display text-2xl text-muted-foreground">–</span>
                        <span className="scoreboard-digit">{myNextPrediction.predicted_away}</span>
                      </div>
                      {myNextPrediction.joker_used && <span className="text-xs text-primary mt-1 inline-block">🔥 Joker played</span>}
                    </>
                  ) : (
                    <span className="text-muted-foreground text-sm">No prediction</span>
                  )}
                  <div className="mt-2 font-display tracking-widest text-xs text-muted-foreground">🔒 PREDICTIONS LOCKED</div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="font-display tracking-widest text-xs text-muted-foreground mb-3">
                    {myNextPrediction ? "YOUR PREDICTION" : "LOCK IN YOUR PREDICTION"}
                  </div>
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <button
                      onClick={() => setPredHome((v) => Math.max(0, v - 1))}
                      className="text-primary hover:text-primary-glow font-display text-xl"
                    >▼</button>
                    <span className="scoreboard-digit tabular-nums">{predHome}</span>
                    <button
                      onClick={() => setPredHome((v) => Math.min(9, v + 1))}
                      className="text-primary hover:text-primary-glow font-display text-xl"
                    >▲</button>
                    <span className="font-display text-2xl text-muted-foreground">–</span>
                    <button
                      onClick={() => setPredAway((v) => Math.max(0, v - 1))}
                      className="text-primary hover:text-primary-glow font-display text-xl"
                    >▼</button>
                    <span className="scoreboard-digit tabular-nums">{predAway}</span>
                    <button
                      onClick={() => setPredAway((v) => Math.min(9, v + 1))}
                      className="text-primary hover:text-primary-glow font-display text-xl"
                    >▲</button>
                  </div>
                  {predJoker && (
                    <div className="text-xs text-primary mb-2 font-display tracking-wider">🔥 JOKER</div>
                  )}
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => predMut.mutate()}
                      disabled={predMut.isPending}
                      className={`btn-hero text-base px-6 py-3 ${nextClosingSoon ? "!bg-red-600 !text-white" : ""}`}
                    >
                      {predMut.isPending ? "LOCKING..." : myNextPrediction ? "UPDATE" : nextClosingSoon ? "⚠ EXPIRING" : "LOCK IN"}
                    </button>
                  </div>
                  {nextJokerAvailable && !predJoker && (
                    <button
                      onClick={() => setPredJoker(true)}
                      className="mt-2 font-display tracking-widest text-xs text-muted-foreground hover:text-primary transition"
                    >
                      + Play Joker 🔥
                    </button>
                  )}
                  {predJoker && (
                    <button
                      onClick={() => setPredJoker(false)}
                      className="mt-2 font-display tracking-widest text-xs text-muted-foreground hover:text-primary transition"
                    >
                      Remove Joker
                    </button>
                  )}
                </div>
              )}
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
          {standings.map((p, i) => {
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

      {/* Last matchday predictions */}
      {lastResults && lastResults.rows.length > 0 && (
        <section className="gold-border bg-card rounded-2xl p-5">
          <h3 className="font-display tracking-widest text-lg mb-1">YOUR LAST MATCHDAY</h3>
          <p className="text-xs text-muted-foreground mb-3">{lastResults.day}</p>
          <ul className="space-y-2">
            {lastResults.rows.map((r: any) => (
              <li key={r.id} className="bg-card-mid rounded-xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-display text-sm sm:text-base truncate">
                    {r.match.flag_a} {r.match.team_a}{" "}
                    <span className="gold-text">{r.predicted_home}</span>
                    <span className="text-muted-foreground"> – </span>
                    <span className="gold-text">{r.predicted_away}</span>{" "}
                    {r.match.team_b} {r.match.flag_b}
                  </div>
                  <ResultBadge pts={r.points_earned} />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Final: {r.match.home_score}–{r.match.away_score}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ResultBadge({ pts }: { pts: number | null }) {
  if (pts === 5) return <span className="font-display text-correct">🎯 EXACT +5</span>;
  if (pts === 3) return <span className="font-display text-correct">📊 GD +3</span>;
  if (pts === 2) return <span className="font-display text-partial">🎯 CLOSE +2</span>;
  if (pts === 1) return <span className="font-display text-partial">✅ WINNER +1</span>;
  if (pts === 0) return <span className="font-display text-wrong">❌ 0</span>;
  return <span className="font-display text-partial">🟡 +{pts}</span>;
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
          <img src={trophyAsset.url} alt="" className="h-6 w-6 object-contain" />
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
