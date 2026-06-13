import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { submitResult, verifyAdmin } from "@/lib/api/admin.functions";
import { adminSetPin, adminClearPin } from "@/lib/api/auth.functions";
import type { Match, Player } from "@/lib/types";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · الغُربة و كاس العالم" }] }),
  component: () => (
    <AppShell>
      <Admin />
    </AppShell>
  ),
});

function Admin() {
  const [pw, setPw] = useState("");
  const [ok, setOk] = useState(false);
  const verifyFn = useServerFn(verifyAdmin);

  if (!ok) {
    return (
      <div className="max-w-sm mx-auto mt-10 gold-border bg-card rounded-2xl p-6 space-y-4">
        <h1 className="font-display text-2xl gold-text">ADMIN ONLY</h1>
        <input
          type="password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full bg-card-mid border border-border rounded-lg px-3 py-2"
        />
        <button
          className="btn-hero w-full text-base px-4 py-3"
          onClick={async () => {
            try {
              await verifyFn({ data: { password: pw } });
              setOk(true);
            } catch {
              toast.error("Wrong password");
            }
          }}
        >
          UNLOCK
        </button>
      </div>
    );
  }
  return <AdminPanel pw={pw} />;
}

function AdminPanel({ pw }: { pw: string }) {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitResult);

  const { data: matches = [] } = useQuery({
    queryKey: ["admin-matches"],
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("*").order("kickoff_at");
      return (data ?? []) as Match[];
    },
  });

  const mut = useMutation({
    mutationFn: (v: { match_id: string; h: number; a: number }) =>
      submitFn({ data: { password: pw, match_id: v.match_id, home_score: v.h, away_score: v.a } }),
    onSuccess: () => {
      toast.success("Result saved · leaderboard updated");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl gold-text">ADMIN</h1>
        <p className="text-muted-foreground text-sm">Enter final scores. Points recalc instantly.</p>
      </div>

      <PinManager pw={pw} />

      <div className="space-y-3">
        <h2 className="font-display tracking-widest text-sm text-muted-foreground">MATCHES</h2>
        {matches.map((m) => (
          <AdminRow key={m.id} m={m} onSubmit={(h, a) => mut.mutate({ match_id: m.id, h, a })} />
        ))}
      </div>
    </div>
  );
}

function PinManager({ pw }: { pw: string }) {
  const setFn = useServerFn(adminSetPin);
  const clearFn = useServerFn(adminClearPin);
  const { data: players = [] } = useQuery({
    queryKey: ["admin-players"],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("id, slug, name, avatar_color, is_admin")
        .order("name");
      return (data ?? []) as Player[];
    },
  });

  return (
    <div className="space-y-3">
      <h2 className="font-display tracking-widest text-sm text-muted-foreground">PLAYER PINS</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {players.map((p) => (
          <PinRow
            key={p.id}
            p={p}
            onSet={async (pin) => {
              try {
                await setFn({ data: { password: pw, slug: p.slug, pin } });
                toast.success(`${p.name}: PIN updated`);
              } catch (e: any) {
                toast.error(e?.message ?? "Failed");
              }
            }}
            onClear={async () => {
              try {
                await clearFn({ data: { password: pw, slug: p.slug } });
                toast.success(`${p.name}: PIN cleared`);
              } catch (e: any) {
                toast.error(e?.message ?? "Failed");
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PinRow({ p, onSet, onClear }: { p: Player; onSet: (pin: string) => void; onClear: () => void }) {
  const [pin, setPin] = useState("");
  return (
    <div className="gold-border bg-card rounded-xl p-3 flex items-center gap-2">
      <span
        className="w-9 h-9 rounded-full grid place-items-center font-display"
        style={{ background: p.avatar_color, color: "#0A0A0C" }}
      >
        {p.name.charAt(0)}
      </span>
      <span className="font-display tracking-wider flex-1 truncate">{p.name}</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder="new PIN"
        maxLength={8}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        className="w-20 bg-card-mid border border-border rounded px-2 py-1 text-center text-sm"
      />
      <button
        onClick={() => { if (/^\d{4,8}$/.test(pin)) { onSet(pin); setPin(""); } else toast.error("4-8 digits"); }}
        className="font-display tracking-widest text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary-glow"
      >
        SET
      </button>
      <button
        onClick={onClear}
        className="font-display tracking-widest text-[10px] px-2 py-1 rounded border border-border hover:bg-card-mid"
      >
        CLEAR
      </button>
    </div>
  );
}

function AdminRow({ m, onSubmit }: { m: Match; onSubmit: (h: number, a: number) => void }) {
  const [h, setH] = useState(m.home_score ?? 0);
  const [a, setA] = useState(m.away_score ?? 0);
  return (
    <div className="gold-border bg-card rounded-xl p-3 flex items-center gap-3 flex-wrap">
      <div className="text-xs text-muted-foreground font-display w-20">
        {m.match_no ? `M${m.match_no}` : m.stage}
      </div>
      <div className="font-display flex-1 min-w-0 truncate">
        {m.flag_a} {m.team_a} <span className="text-muted-foreground">vs</span> {m.team_b} {m.flag_b}
      </div>
      <input type="number" min="0" max="20" value={h} onChange={(e)=>setH(+e.target.value)}
        className="w-16 bg-card-mid border border-border rounded px-2 py-1 text-center" />
      <span className="text-muted-foreground">–</span>
      <input type="number" min="0" max="20" value={a} onChange={(e)=>setA(+e.target.value)}
        className="w-16 bg-card-mid border border-border rounded px-2 py-1 text-center" />
      <button
        onClick={() => onSubmit(h, a)}
        className="font-display tracking-widest text-xs px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary-glow"
      >
        SAVE
      </button>
      {m.home_score != null && (
        <span className="text-xs text-correct font-display">✓ {m.home_score}–{m.away_score}</span>
      )}
    </div>
  );
}
