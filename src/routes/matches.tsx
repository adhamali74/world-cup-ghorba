import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import { lockPrediction } from "@/lib/api/predictions.functions";
import type { Match, Player, Prediction } from "@/lib/types";

export const Route = createFileRoute("/matches")({
  head: () => ({
    meta: [
      { title: "Matches · كسكسي في كاس العالم" },
      { name: "description", content: "Lock in your World Cup 2026 score predictions before kickoff." },
    ],
  }),
  component: () => (
    <AppShell>
      <MatchesPage />
    </AppShell>
  ),
});

const STAGES = ["group", "r32", "r16", "qf", "sf", "third", "final"] as const;
const STAGE_LABEL: Record<string, string> = {
  group: "Group Stage",
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarterfinals",
  sf: "Semifinals",
  third: "Third Place",
  final: "Final",
};

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

function MatchesPage() {
  const { slug } = usePlayer();
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["me", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data } = await supabase.from("players").select("id, slug, name, avatar_color, is_admin, avatar_url").eq("slug", slug!).maybeSingle();
      return data as Player | null;
    },
  });

  const { data: matches = [] } = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("*").order("kickoff_at");
      return (data ?? []) as Match[];
    },
  });

  const { data: predictions = [] } = useQuery({
    queryKey: ["predictions", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase.from("predictions").select("*");
      return (data ?? []) as Prediction[];
    },
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("id, slug, name, avatar_color, is_admin, avatar_url");
      return (data ?? []) as Player[];
    },
  });

  // Realtime: refresh predictions on changes
  useEffect(() => {
    const channel = supabase
      .channel("predictions-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, () => {
        qc.invalidateQueries({ queryKey: ["predictions"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        qc.invalidateQueries({ queryKey: ["matches"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const [stage, setStage] = useState<string>("group");

  const nextMatch = useMemo(() => {
    const now = Date.now();
    return matches.find((m) => new Date(m.kickoff_at).getTime() > now && m.home_score == null) ?? null;
  }, [matches]);

  const cd = useCountdown(nextMatch?.kickoff_at);
  const minsToLock = nextMatch ? (new Date(nextMatch.kickoff_at).getTime() - Date.now()) / 60000 : Infinity;

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfTomorrow = startOfDay + 2 * 24 * 60 * 60 * 1000;
    const isFinished = (m: Match) => m.home_score != null && m.away_score != null;
    return matches
      .filter((m) => m.stage === stage)
      // show matches kicking off today or tomorrow (local time), and not yet finished
      .filter((m) => {
        const ko = new Date(m.kickoff_at).getTime();
        if (isFinished(m)) return false;
        return ko >= startOfDay && ko < endOfTomorrow;
      })
      .sort((a, b) => +new Date(a.kickoff_at) - +new Date(b.kickoff_at));
  }, [matches, stage]);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl gold-text">FIXTURES</h1>

      {cd && nextMatch && (
        <div className={`gold-border rounded-2xl p-4 ${minsToLock < 10 ? "bg-red-950/20 border-red-500/60 animate-pulse-fast" : "bg-card"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display tracking-widest text-xs text-muted-foreground">
                NEXT LOCK · {nextMatch.flag_a} {nextMatch.team_a} vs {nextMatch.team_b} {nextMatch.flag_b}
              </div>
              <div className="font-display text-xs text-muted-foreground mt-0.5">
                {new Date(nextMatch.kickoff_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">PREDICTIONS LOCK IN</div>
              <div className={`font-display text-xl sm:text-2xl tabular-nums ${minsToLock < 10 ? "text-red-400" : "gold-text"}`}>
                {String(cd.h).padStart(2, "0")}:{String(cd.m).padStart(2, "0")}:{String(cd.s).padStart(2, "0")}
                <span className="text-[10px] text-muted-foreground font-normal tracking-normal ml-1">to lock</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => setStage(s)}
            className={`px-3 py-1.5 rounded-full font-display tracking-wider text-xs whitespace-nowrap border transition ${
              stage === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {STAGE_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filtered.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            me={me ?? null}
            predictions={predictions.filter((p) => p.match_id === m.id)}
            players={players}
            allMatches={matches}
            allPredictions={predictions}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-muted-foreground text-center py-12">No matches today. Even Ronaldo took a rest day (only one in his life).</div>
        )}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  me,
  predictions,
  players,
  allMatches,
  allPredictions,
}: {
  match: Match;
  me: Player | null;
  predictions: Prediction[];
  players: Player[];
  allMatches: Match[];
  allPredictions: Prediction[];
}) {
  const lockFn = useServerFn(lockPrediction);
  const qc = useQueryClient();

  const my = predictions.find((p) => p.player_id === me?.id);
  const [home, setHome] = useState(my?.predicted_home ?? 0);
  const [away, setAway] = useState(my?.predicted_away ?? 0);
  const [joker, setJoker] = useState(my?.joker_used ?? false);

  useEffect(() => {
    if (my) {
      setHome(my.predicted_home);
      setAway(my.predicted_away);
      setJoker(my.joker_used);
    }
  }, [my?.id]);

  const kickoff = new Date(match.kickoff_at).getTime();
  const now = Date.now();
  const started = kickoff <= now;
  const minsToKickoff = (kickoff - now) / 60000;
  const closing = !started && minsToKickoff < 30;
  const closingSoon = !started && minsToKickoff < 10;
  const finished = match.home_score != null && match.away_score != null;

  const cd = useCountdown(match.kickoff_at);

  // Joker availability: has the player used their joker on a DIFFERENT match in this stage?
  const stageMatchIds = useMemo(
    () => new Set(allMatches.filter((m) => m.stage === match.stage).map((m) => m.id)),
    [allMatches, match.stage],
  );
  const jokerUsedElsewhere = !!me && allPredictions.some(
    (p) => p.player_id === me.id && p.joker_used && p.match_id !== match.id && stageMatchIds.has(p.match_id),
  );
  const jokerAvailable = !jokerUsedElsewhere;

  const mut = useMutation({
    mutationFn: () => lockFn({ data: { player_slug: me!.slug, match_id: match.id, home, away, joker } }),
    onSuccess: () => {
      toast.success("LOCKED IN 🔒", { description: joker ? "🔥 x2 POINTS ACTIVATED!" : "Sealed tighter than Messi's trophy case is empty. SIUUU 🐐" });
      qc.invalidateQueries({ queryKey: ["predictions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not lock it in. Ronaldo would've scored already."),
  });

  return (
    <div
      className={`gold-border bg-card rounded-2xl p-4 sm:p-5 transition ${
        closingSoon ? "border-red-500/60 bg-red-950/20 animate-pulse-fast" : closing ? "border-destructive/50 animate-pulse" : ""
      }`}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <div className="font-display tracking-widest">
          {match.group_letter ? `GROUP ${match.group_letter}` : STAGE_LABEL[match.stage]}
          {match.match_no ? ` · M${match.match_no}` : ""}
        </div>
        {started && !finished && <span className="text-red-400 animate-pulse font-display tracking-widest">LIVE</span>}
        {finished && <span className="font-display tracking-widest">FT</span>}
      </div>

      {!started && (
        <div className="text-center mb-3">
          <div className="text-xs tracking-widest text-muted-foreground">
            {new Date(match.kickoff_at).toLocaleString(undefined, {
              weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </div>
          {cd && (
            <div className={`font-display text-xl sm:text-2xl tabular-nums mt-0.5 ${closingSoon ? "text-red-400 animate-pulse-fast" : "gold-text"}`}>
              {cd.h > 0 && `${String(cd.h).padStart(2, "0")}:`}{String(cd.m).padStart(2, "0")}:{String(cd.s).padStart(2, "0")}
              <span className="text-[10px] text-muted-foreground font-normal tracking-normal ml-1">to lock</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
        <div className="text-right">
          <div className="text-3xl sm:text-4xl">{match.flag_a}</div>
          <div className="font-display tracking-wider text-sm sm:text-base">{match.team_a}</div>
        </div>

        {finished ? (
          <div className="flex items-center gap-2">
            <div className="scoreboard-digit">{match.home_score}</div>
            <span className="font-display text-2xl text-muted-foreground">–</span>
            <div className="scoreboard-digit">{match.away_score}</div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <ScorePicker value={home} onChange={setHome} disabled={started || !me} />
            <span className="font-display text-2xl text-muted-foreground">–</span>
            <ScorePicker value={away} onChange={setAway} disabled={started || !me} />
          </div>
        )}

        <div>
          <div className="text-3xl sm:text-4xl">{match.flag_b}</div>
          <div className="font-display tracking-wider text-sm sm:text-base">{match.team_b}</div>
        </div>
      </div>

      {!finished && !started && /portugal/i.test(`${match.team_a} ${match.team_b}`) && (
        <div className="mt-3 text-center text-[11px] sm:text-xs italic text-primary/80 border border-primary/30 bg-primary/5 rounded-md px-3 py-2 mx-auto max-w-md">
          🤫 Insider tip: CR7 is scoring a hat-trick this match. Build your prediction around 3 Portugal goals — that's the secret to winning. 🐐🔥
        </div>
      )}

      {!finished && !started && me && (
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-center gap-3">
          {jokerAvailable ? (
            <>
              <button
                type="button"
                onClick={() => setJoker((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  joker ? "bg-primary shadow-[0_0_12px_rgba(250,204,21,0.5)]" : "bg-card-mid border border-border"
                }`}
                aria-pressed={joker}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-background transition ${
                    joker ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="font-display tracking-wider text-xs">
                🔥 x2 POINTS <span className="text-muted-foreground">(1 left this stage)</span>
              </span>
            </>
          ) : (
            <span className="font-display tracking-wider text-xs text-muted-foreground">
              🔥 x2 Points already used in this stage
            </span>
          )}
        </div>
      )}

      {!finished && (
        <div className="mt-4 flex justify-center">
          {started ? (
            <span className="font-display tracking-widest text-xs text-muted-foreground">
              🔒 PREDICTIONS LOCKED {my?.joker_used && <span className="ml-1">🔥</span>}
            </span>
          ) : me ? (
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
              className={`btn-hero text-base px-6 py-3 ${
                closingSoon ? "!bg-red-600 !text-white animate-pulse-fast" : closing ? "!bg-destructive !text-destructive-foreground" : ""
              } ${joker ? "ring-2 ring-primary shadow-[0_0_24px_rgba(250,204,21,0.6)]" : ""}`}
            >
              {mut.isPending ? "LOCKING..." : my ? (joker ? "UPDATE PICK 🔥" : "UPDATE PICK") : closingSoon ? "⚠ EXPIRING" : closing ? "⚠ CLOSING SOON" : joker ? "LOCK IN 🔥 x2" : "LOCK IN"}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Pick your name to predict</span>
          )}
        </div>
      )}

      {(started || finished) && predictions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="font-display tracking-widest text-xs text-muted-foreground mb-2">
            FRIENDS&apos; PICKS
          </div>
          <div className="flex flex-wrap gap-2">
            {predictions.map((p) => {
              const player = players.find((pp) => pp.id === p.player_id);
              if (!player) return null;
              const pts = p.points_earned;
              const color =
                pts == null
                  ? "text-foreground"
                  : pts >= 5
                  ? "text-correct"
                  : pts >= 1
                  ? "text-partial"
                  : "text-wrong";
              return (
                <span
                  key={p.id}
                  className={`text-xs font-display tracking-wider px-2 py-1 rounded bg-card-mid ${color}`}
                >
                  {player.name}: {p.predicted_home}–{p.predicted_away}{p.joker_used && " 🔥"}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ScorePicker({
  value, onChange, disabled,
}: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const bump = (d: number) => onChange(Math.max(0, Math.min(9, value + d)));
  return (
    <div className="flex flex-col items-center">
      <button
        onClick={() => bump(1)}
        disabled={disabled}
        className="text-primary hover:text-primary-glow disabled:opacity-30 font-display text-xl"
        aria-label="increase"
      >
        ▲
      </button>
      <div className="scoreboard-digit tabular-nums">{value}</div>
      <button
        onClick={() => bump(-1)}
        disabled={disabled}
        className="text-primary hover:text-primary-glow disabled:opacity-30 font-display text-xl"
        aria-label="decrease"
      >
        ▼
      </button>
    </div>
  );
}
