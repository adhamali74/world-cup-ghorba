import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import type { Player, Match } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "الغُربة و كاس العالم — The Final Chapter" },
      { name: "description", content: "5 friends. 104 matches. One trophy. World Cup 2026 prediction league." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const { ready, slug } = usePlayer();

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("id, slug, name, avatar_color, is_admin")
        .order("name");
      return (data ?? []) as Player[];
    },
  });

  const { data: nextMatch } = useQuery({
    queryKey: ["next-portugal"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("*")
        .or("team_a.eq.Portugal,team_b.eq.Portugal")
        .gte("kickoff_at", new Date().toISOString())
        .order("kickoff_at")
        .limit(1)
        .maybeSingle();
      return data as Match | null;
    },
  });

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Decorative 2026 backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid place-items-center select-none"
      >
        <span className="font-display text-[28vw] leading-none text-primary/5 tracking-tighter">
          2026
        </span>
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-10 flex flex-col min-h-screen">
        <header className="flex items-center justify-between">
          <div>
            <div className="font-arabic text-2xl sm:text-3xl gold-text">الغُربة و كاس العالم</div>
            <div className="font-display tracking-[0.3em] text-xs text-muted-foreground mt-1">
              FIFA WORLD CUP · 2026
            </div>
          </div>
          {ready && slug && (
            <Link to="/dashboard" className="text-xs font-display tracking-widest text-primary hover:text-primary-glow">
              ENTER →
            </Link>
          )}
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
          {/* Trophy / CR7 silhouette in CSS */}
          <div className="relative mb-6">
            <div className="text-[10rem] sm:text-[14rem] leading-none drop-shadow-[0_0_60px_rgba(212,175,55,0.4)] animate-pulse">
              🏆
            </div>
            <div className="absolute -inset-10 rounded-full bg-primary/10 blur-3xl -z-10" />
          </div>

          <h1 className="font-display text-6xl sm:text-8xl gold-text leading-[0.9]">
            THE FINAL<br />CHAPTER
          </h1>
          <p className="mt-6 max-w-md text-muted-foreground">
            Ronaldo. Portugal. 2026. Five friends in exile. One trophy on the line.
          </p>

          <button
            onClick={() => navigate({ to: slug ? "/dashboard" : "/auth" })}
            className="btn-hero mt-10 pulse-gold"
          >
            {slug ? "ENTER THE COMPETITION" : "SIGN IN TO PLAY"}
          </button>

          {nextMatch && (
            <div className="mt-10 inline-flex items-center gap-3 text-sm text-muted-foreground gold-border bg-card/60 px-4 py-2 rounded-full">
              <span className="font-display tracking-widest text-primary">NEXT</span>
              <span className="text-lg">{nextMatch.flag_a} {nextMatch.team_a}</span>
              <span className="text-muted-foreground">vs</span>
              <span className="text-lg">{nextMatch.team_b} {nextMatch.flag_b}</span>
              <span className="text-xs">
                {new Date(nextMatch.kickoff_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </div>
          )}
        </div>

        {/* Player teaser */}
        <div className="border-t border-border pt-6">
          <div className="font-display tracking-widest text-xs text-muted-foreground text-center mb-3">
            THE LEAGUE
          </div>
          <div className="flex justify-center gap-4 sm:gap-6 flex-wrap">
            {players.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-1">
                <span
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full grid place-items-center font-display text-lg"
                  style={{ background: p.avatar_color, color: "#0A0A0C" }}
                >
                  {p.name.charAt(0)}
                </span>
                <span className="font-display text-xs tracking-wider">{p.name}</span>
              </div>
            ))}
            {players.length < 5 && (
              <div className="flex flex-col items-center gap-1 opacity-50">
                <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-full grid place-items-center font-display text-lg border border-dashed border-border">
                  ?
                </span>
                <span className="font-display text-xs tracking-wider">OPEN</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
