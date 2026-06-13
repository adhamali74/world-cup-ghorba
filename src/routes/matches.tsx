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
      { title: "Matches · الغُربة و كاس العالم" },
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
  const filtered = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
    const isFinished = (m: Match) => m.home_score != null && m.away_score != null;
    return matches
      .filter((m) => m.stage === stage)
      // only show matches kicking off today (local time), and not yet finished
      .filter((m) => {
        const ko = new Date(m.kickoff_at).getTime();
        if (isFinished(m)) return false;
        return ko >= startOfDay && ko < endOfDay;
      })
      .sort((a, b) => +new Date(a.kickoff_at) - +new Date(b.kickoff_at));
  }, [matches, stage]);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl gold-text">FIXTURES</h1>

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
}: {
  match: Match;
  me: Player | null;
  predictions: Prediction[];
  players: Player[];
}) {
  const lockFn = useServerFn(lockPrediction);
  const qc = useQueryClient();

  const my = predictions.find((p) => p.player_id === me?.id);
  const [home, setHome] = useState(my?.predicted_home ?? 0);
  const [away, setAway] = useState(my?.predicted_away ?? 0);

  useEffect(() => {
    if (my) {
      setHome(my.predicted_home);
      setAway(my.predicted_away);
    }
  }, [my?.id]);

  const kickoff = new Date(match.kickoff_at).getTime();
  const now = Date.now();
  const started = kickoff <= now;
  const minsToKickoff = (kickoff - now) / 60000;
  const closing = !started && minsToKickoff < 30;
  const finished = match.home_score != null && match.away_score != null;

  const mut = useMutation({
    mutationFn: () => lockFn({ data: { player_slug: me!.slug, match_id: match.id, home, away } }),
    onSuccess: () => {
      toast.success("LOCKED IN 🔒", { description: "Sealed tighter than Messi's trophy case is empty. SIUUU 🐐" });
      qc.invalidateQueries({ queryKey: ["predictions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not lock it in. Ronaldo would've scored already."),
  });

  return (
    <div
      className={`gold-border bg-card rounded-2xl p-4 sm:p-5 transition ${
        closing ? "border-destructive/50 animate-pulse" : ""
      }`}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <div className="font-display tracking-widest">
          {match.group_letter ? `GROUP ${match.group_letter}` : STAGE_LABEL[match.stage]}
          {match.match_no ? ` · M${match.match_no}` : ""}
        </div>
        <div className="font-display">
          {new Date(match.kickoff_at).toLocaleString(undefined, {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          })}
        </div>
      </div>

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

      {!finished && (
        <div className="mt-4 flex justify-center">
          {started ? (
            <span className="font-display tracking-widest text-xs text-muted-foreground">
              🔒 PREDICTIONS LOCKED
            </span>
          ) : me ? (
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
              className={`btn-hero text-base px-6 py-3 ${
                closing ? "!bg-destructive !text-destructive-foreground" : ""
              }`}
            >
              {mut.isPending ? "LOCKING..." : my ? "UPDATE PICK" : closing ? "⚠ CLOSING SOON" : "LOCK IN"}
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
              const color =
                p.points_earned === 3
                  ? "text-correct"
                  : p.points_earned === 1
                  ? "text-partial"
                  : p.points_earned === 0
                  ? "text-wrong"
                  : "text-foreground";
              return (
                <span
                  key={p.id}
                  className={`text-xs font-display tracking-wider px-2 py-1 rounded bg-card-mid ${color}`}
                >
                  {player.name}: {p.predicted_home}–{p.predicted_away}
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
