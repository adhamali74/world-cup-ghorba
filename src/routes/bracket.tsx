import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import { submitBracket, R32_DEADLINE_ISO } from "@/lib/api/bracket.functions";

export const Route = createFileRoute("/bracket")({
  head: () => ({
    meta: [
      { title: "Final 4 Bracket · كسكسي في كاس العالم" },
      { name: "description", content: "Pick your 4 semi-finalists and the World Cup 2026 winner. One bracket per player, locks at R32 kickoff." },
    ],
  }),
  component: () => (
    <AppShell>
      <BracketPage />
    </AppShell>
  ),
});

function BracketPage() {
  const { slug } = usePlayer();
  const qc = useQueryClient();
  const submitFn = useServerFn(submitBracket);

  const { data: teams = [] } = useQuery({
    queryKey: ["bracket-teams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("team_a, team_b")
        .eq("stage", "group");
      const set = new Set<string>();
      (data ?? []).forEach((m) => { set.add(m.team_a); set.add(m.team_b); });
      return Array.from(set).sort();
    },
  });

  const { data: me } = useQuery({
    queryKey: ["me-id", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data } = await supabase.from("players").select("id").eq("slug", slug!).maybeSingle();
      return data;
    },
  });

  const { data: mine } = useQuery({
    queryKey: ["my-bracket", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("bracket_predictions")
        .select("*")
        .eq("player_id", me!.id)
        .maybeSingle();
      return data;
    },
  });

  const [s1, setS1] = useState("");
  const [s2, setS2] = useState("");
  const [s3, setS3] = useState("");
  const [s4, setS4] = useState("");
  const [winner, setWinner] = useState("");

  useEffect(() => {
    if (mine) {
      setS1(mine.semi_finalist_1);
      setS2(mine.semi_finalist_2);
      setS3(mine.semi_finalist_3);
      setS4(mine.semi_finalist_4);
      setWinner(mine.winner);
    }
  }, [mine?.id]);

  const semis = useMemo(() => [s1, s2, s3, s4].filter(Boolean), [s1, s2, s3, s4]);
  const locked = Date.now() >= new Date(R32_DEADLINE_ISO).getTime();

  const mut = useMutation({
    mutationFn: () => submitFn({ data: { player_slug: slug!, semi_finalists: [s1, s2, s3, s4], winner } }),
    onSuccess: () => {
      toast.success("BRACKET LOCKED 🔒", { description: "Submitted. Now we wait for fate (and ESPN). 🐐" });
      qc.invalidateQueries({ queryKey: ["my-bracket"] });
      qc.invalidateQueries({ queryKey: ["all-brackets"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const ready = s1 && s2 && s3 && s4 && winner && new Set([s1, s2, s3, s4]).size === 4 && semis.includes(winner);

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div className="text-center">
        <h1 className="font-display text-4xl gold-text">FINAL 4 BRACKET</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {locked
            ? "🔒 Bracket locked — R32 has started"
            : "Predict before R32 starts · June 28, 2026"}
        </p>
      </div>

      <div className="gold-border bg-card rounded-2xl p-5 space-y-4">
        {mine && (
          <div className="text-center text-sm">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/30 font-display tracking-widest text-xs">
              ✅ SUBMITTED — you can {locked ? "view" : "update"} below
            </span>
          </div>
        )}

        {(["1", "2", "3", "4"] as const).map((n, i) => {
          const value = [s1, s2, s3, s4][i];
          const setter = [setS1, setS2, setS3, setS4][i];
          const otherPicks = [s1, s2, s3, s4].filter((_, j) => j !== i);
          return (
            <div key={n} className="flex items-center gap-3">
              <label className="font-display tracking-wider text-xs w-32 shrink-0">SEMI-FINALIST {n}</label>
              <select
                disabled={locked}
                value={value}
                onChange={(e) => {
                  const next = e.target.value;
                  setter(next);
                  if (winner && !next) setWinner("");
                  if (winner === value && next !== value) setWinner(next);
                }}
                className="flex-1 bg-card-mid border border-border rounded-lg px-3 py-2 disabled:opacity-60"
              >
                <option value="">— pick a team —</option>
                {teams
                  .filter((t) => !otherPicks.includes(t))
                  .map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
              </select>
            </div>
          );
        })}

        <div className="border-t border-border pt-4 flex items-center gap-3">
          <label className="font-display tracking-wider text-xs w-32 shrink-0 gold-text">🏆 WINNER</label>
          <select
            disabled={locked || semis.length < 4}
            value={winner}
            onChange={(e) => setWinner(e.target.value)}
            className="flex-1 bg-card-mid border border-border rounded-lg px-3 py-2 disabled:opacity-60"
          >
            <option value="">{semis.length < 4 ? "pick 4 semi-finalists first" : "— pick the winner —"}</option>
            {semis.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
          <div>• Each correct semi-finalist: <span className="text-foreground">+3 pts</span> (max 12)</div>
          <div>• Correct winner (must also be a correct semi-finalist): <span className="text-foreground">+5 pts</span></div>
          <div className="font-display tracking-wider">TOTAL POSSIBLE: <span className="gold-text">17 PTS</span></div>
        </div>

        {!locked && slug && (
          <button
            onClick={() => mut.mutate()}
            disabled={!ready || mut.isPending}
            className="btn-hero w-full text-base px-4 py-3 disabled:opacity-40"
          >
            {mut.isPending ? "SUBMITTING..." : mine ? "UPDATE BRACKET" : "SUBMIT BRACKET"}
          </button>
        )}
        {!slug && (
          <Link to="/auth" className="block text-center text-sm text-muted-foreground">
            Sign in to submit your bracket
          </Link>
        )}
      </div>
    </div>
  );
}
