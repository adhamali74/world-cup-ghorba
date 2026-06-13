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
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg grid place-items-center px-4">
      <div className="max-w-md w-full">
        <h2 className="font-display text-4xl text-center gold-text">WHO ARE YOU?</h2>
        <p className="text-center text-sm text-muted-foreground mt-2">
          Tap your name to enter the competition
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3">
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p.slug)}
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
        <p className="text-center text-xs text-muted-foreground mt-6">
          Saved to this device. You can switch anytime.
        </p>
      </div>
    </div>
  );
}
