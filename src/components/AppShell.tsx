import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import { loginPlayer } from "@/lib/api/auth.functions";
import type { Player } from "@/lib/types";

const NAV = [
  { to: "/dashboard", label: "Home", icon: "⚽" },
  { to: "/matches", label: "Matches", icon: "📋" },
  { to: "/leaderboard", label: "Board", icon: "🏆" },
  { to: "/cr7", label: "CR7", icon: "👑" },
  { to: "/rules", label: "Rules", icon: "📖" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { slug, ready, choose, clear } = usePlayer();
  const loc = useLocation();

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, slug, name, avatar_color, is_admin")
        .order("name");
      if (error) throw error;
      return data as Player[];
    },
  });

  const me = players.find((p) => p.slug === slug) ?? null;
  const showPicker = ready && !me;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <span className="font-arabic text-lg sm:text-xl gold-text">الغُربة و كاس العالم</span>
            <span className="hidden sm:inline font-display tracking-widest text-xs text-muted-foreground">
              WC 2026
            </span>
          </Link>
          {me && (
            <button
              onClick={clear}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition"
            >
              <span
                className="w-7 h-7 rounded-full grid place-items-center font-display text-sm"
                style={{ background: me.avatar_color, color: "#0A0A0C" }}
              >
                {me.name.charAt(0)}
              </span>
              <span className="font-display tracking-wider">{me.name}</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6">{children}</main>

      {me && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 backdrop-blur-md bg-background/80 border-t border-border">
          <div className="max-w-5xl mx-auto grid grid-cols-5">
            {NAV.map((n) => {
              const active = loc.pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex flex-col items-center gap-1 py-3 text-[10px] font-display tracking-widest transition ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="text-lg">{n.icon}</span>
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {showPicker && <PlayerPicker players={players} onPick={choose} />}
    </div>
  );
}

function PlayerPicker({ players, onPick }: { players: Player[]; onPick: (slug: string) => void }) {
  const [selected, setSelected] = useState<Player | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const loginFn = useServerFn(loginPlayer);

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
      onPick(selected.slug);
    } catch (e: any) {
      toast.error(e?.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg grid place-items-center px-4">
      <div className="max-w-md w-full">
        <h2 className="font-display text-4xl text-center gold-text">WHO ARE YOU?</h2>
        <p className="text-center text-sm text-muted-foreground mt-2">
          {selected ? "Enter your PIN" : "Tap your name to enter the competition"}
        </p>

        {!selected && (
          <div className="mt-8 grid grid-cols-2 gap-3">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="gold-border bg-card hover:bg-card-mid transition rounded-xl p-4 flex flex-col items-center gap-2"
              >
                <span
                  className="w-14 h-14 rounded-full grid place-items-center font-display text-2xl"
                  style={{ background: p.avatar_color, color: "#0A0A0C" }}
                >
                  {p.name.charAt(0)}
                </span>
                <span className="font-display tracking-wider text-lg">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="mt-8 gold-border bg-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span
                className="w-12 h-12 rounded-full grid place-items-center font-display text-xl"
                style={{ background: selected.avatar_color, color: "#0A0A0C" }}
              >
                {selected.name.charAt(0)}
              </span>
              <div>
                <div className="font-display tracking-wider text-lg">{selected.name}</div>
                <div className="text-xs text-muted-foreground">First time? Your PIN will be set now.</div>
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
              className="w-full bg-card-mid border border-border rounded-lg px-3 py-3 text-center text-2xl font-display tracking-[0.5em]"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setSelected(null); setPin(""); }}
                className="flex-1 py-2 rounded-lg border border-border font-display tracking-widest text-xs hover:bg-card-mid"
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
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          Forgot your PIN? Ask the admin to reset it.
        </p>
      </div>
    </div>
  );
}
