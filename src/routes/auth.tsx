import { PlayerAvatar } from "@/components/PlayerAvatar";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import { loginPlayer } from "@/lib/api/auth.functions";
import type { Player } from "@/lib/types";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "Sign in · الغُربة و كاس العالم" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { choose } = usePlayer();
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const loginFn = useServerFn(loginPlayer);

  const [selected, setSelected] = useState<Player | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: players = [], isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, slug, name, avatar_color, is_admin, avatar_url")
        .order("name");
      if (error) throw error;
      return data as Player[];
    },
  });

  const submit = async () => {
    if (!selected) return;
    if (!/^\d{4,8}$/.test(pin)) {
      toast.error("PIN must be 4-8 digits");
      return;
    }
    setBusy(true);
    try {
      const res = await loginFn({ data: { slug: selected.slug, pin } });
      if (res.firstTime) toast.success("PIN set · welcome");
      choose(selected.slug);
      navigate({ to: redirect || "/dashboard" });
    } catch (e: any) {
      toast.error(e?.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-12 stadium-night">
      <div className="max-w-lg w-full">
        <div className="text-center mb-10">
          <div className="font-arabic text-3xl gold-text mb-2">الغُربة و كاس العالم</div>
          <div className="font-display tracking-[0.4em] text-xs text-muted-foreground">WC 2026 · SIGN IN</div>
        </div>

        {!selected && (
          <>
            <h1 className="font-display text-3xl sm:text-5xl text-center gold-text">PICK YOUR PLAYER</h1>
            <p className="text-center text-sm text-muted-foreground mt-3">
              Then enter your PIN. First time logging in? Your PIN is set on first entry.
            </p>
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-2 gap-4">
              {isLoading && <div className="col-span-2 text-center text-muted-foreground">Lining up the squad… (no Messi, sorry)</div>}
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="gold-border bg-card hover:bg-card-mid transition rounded-2xl p-6 flex flex-col items-center gap-3 group"
                >
                  <PlayerAvatar name={p.name} color={p.avatar_color} url={p.avatar_url} size={80} className="group-hover:scale-105 transition" />
                  <span className="font-display tracking-wider text-xl">{p.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {selected && (
          <div className="gold-border bg-card rounded-2xl p-8 space-y-5">
            <div className="flex items-center gap-4">
              <PlayerAvatar name={selected.name} color={selected.avatar_color} url={selected.avatar_url} size={64} />
              <div className="flex-1">
                <div className="font-display tracking-wider text-2xl">{selected.name}</div>
                <div className="text-xs text-muted-foreground">Enter your PIN to continue</div>
              </div>
            </div>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={8}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full bg-card-mid border border-border rounded-lg px-3 py-4 text-center text-3xl font-display tracking-[0.5em]"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setSelected(null); setPin(""); }}
                className="flex-1 py-3 rounded-lg border border-border font-display tracking-widest text-xs hover:bg-card-mid"
              >
                BACK
              </button>
              <button
                disabled={busy}
                onClick={submit}
                className="flex-1 btn-hero py-3 text-sm disabled:opacity-50"
              >
                {busy ? "..." : "ENTER"}
              </button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Forgot your PIN? Pray for Ronaldo to lift the cup 🙏🐐 — and maybe it'll come back to you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
