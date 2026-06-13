import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import type { Player } from "@/lib/types";
import trophyAsset from "@/assets/world-cup-trophy.webp.asset.json";

const NAV = [
  { to: "/dashboard", label: "Home", icon: "⚽", iconUrl: null as string | null },
  { to: "/matches", label: "Matches", icon: "📋", iconUrl: null },
  { to: "/leaderboard", label: "Board", icon: "", iconUrl: trophyAsset.url },
  { to: "/cr7", label: "CR7", icon: "👑", iconUrl: null },
  { to: "/profile", label: "Profile", icon: "👤", iconUrl: null },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { slug, ready } = usePlayer();
  const loc = useLocation();
  const navigate = useNavigate();

  const { data: players = [] } = useQuery({
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

  const me = players.find((p) => p.slug === slug) ?? null;

  useEffect(() => {
    if (ready && !slug) {
      navigate({ to: "/auth", search: { redirect: loc.pathname } });
    }
  }, [ready, slug, loc.pathname, navigate]);

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
            <Link
              to="/profile"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition"
            >
              <PlayerAvatar name={me.name} color={me.avatar_color} url={me.avatar_url} size={28} />
              <span className="font-display tracking-wider">{me.name}</span>
            </Link>
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
                  {n.iconUrl ? (
                    <img src={n.iconUrl} alt="" className="h-6 w-6 object-contain" />
                  ) : (
                    <span className="text-lg">{n.icon}</span>
                  )}
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
