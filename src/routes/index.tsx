import { PlayerAvatar } from "@/components/PlayerAvatar";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import type { Player, Match } from "@/lib/types";
import trophyAsset from "@/assets/trophy-hero.png";

function useCountdown(target?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const diff = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, done: diff === 0 };
}



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "كُسكُسي في كاس العالم — The Final Chapter" },
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
        .select("id, slug, name, avatar_color, is_admin, avatar_url")
        .order("name");
      return (data ?? []) as Player[];
    },
  });

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

  const countdown = useCountdown(nextMatch?.kickoff_at);


  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Stadium spotlight backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.22),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(0,90,40,0.18),_transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(212,175,55,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.4)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      {/* Giant 26 watermark */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid place-items-center select-none"
      >
        <span className="font-display text-[38vw] sm:text-[28vw] leading-none text-primary/[0.04] tracking-tighter">
          26
        </span>
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-8 flex flex-col min-h-screen">
        <header className="relative flex items-center justify-center">
          <div className="text-center">
            <div className="font-arabic text-3xl sm:text-4xl gold-text leading-tight">كُسكُسي في كاس العالم</div>
            <div className="font-display tracking-[0.3em] text-xs text-muted-foreground mt-1">
              FIFA WORLD CUP · 2026
            </div>
          </div>
          {ready && slug && (
            <Link to="/dashboard" className="absolute right-0 text-xs font-display tracking-widest text-primary hover:text-primary-glow">
              ENTER →
            </Link>
          )}
        </header>

        <div className="flex-1 grid lg:grid-cols-2 gap-10 items-center py-10">
          {/* LEFT — Trophy showcase */}
          <div className="relative order-2 lg:order-1 flex justify-center">
            {/* Golden halo */}
            <div className="absolute inset-0 -m-12 rounded-full bg-[radial-gradient(circle,_rgba(212,175,55,0.35),_transparent_60%)] blur-3xl animate-pulse" />
            {/* Ground shadow */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-6 rounded-[100%] bg-black/70 blur-xl" />
            <img
              src={trophyAsset}
              alt="FIFA World Cup 2026 Trophy"
              className="relative w-[78%] sm:w-[70%] max-w-[480px] drop-shadow-[0_20px_60px_rgba(212,175,55,0.45)] [animation:trophy-float_6s_ease-in-out_infinite]"
              loading="eager"
            />
          </div>

          {/* RIGHT — Manifesto */}
          <div className="relative order-1 lg:order-2 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/40 bg-primary/5 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="font-display tracking-[0.25em] text-[10px] text-primary">
                THE LAST DANCE · CR7
              </span>
            </div>

            <h1 className="mt-5 font-display text-6xl sm:text-7xl lg:text-8xl gold-text leading-[0.85]">
              THE FINAL<br />CHAPTER
            </h1>

            <div className="mt-5 space-y-2">
              <p className="font-display tracking-[0.2em] text-sm text-primary/90">
                FORÇA PORTUGAL · BRING IT HOME
              </p>
              <p className="max-w-md mx-auto lg:mx-0 text-muted-foreground leading-relaxed">
                Cristiano Ronaldo — the greatest athlete the world has ever seen. Five Ballons d'Or, every league conquered,
                every record broken. No one has earned this trophy more. 2026 is his coronation.
              </p>
              <p className="max-w-md mx-auto lg:mx-0 text-xs italic text-muted-foreground/80 border-l-2 border-primary/40 pl-3">
                ⚠️ Disclaimer: if Ronaldo doesn't lift this cup, this website will self-destruct and shut down automatically.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 justify-center lg:justify-start">
              <button
                onClick={() => navigate({ to: slug ? "/dashboard" : "/auth" })}
                className="btn-hero pulse-gold"
              >
                {slug ? "ENTER THE COMPETITION" : "SIGN IN TO PLAY"}
              </button>
              <Link
                to="/matches"
                className="font-display tracking-widest text-xs px-5 py-3 rounded border border-border hover:border-primary/60 hover:text-primary transition-colors self-center"
              >
                SEE FIXTURES →
              </Link>
            </div>

            {nextMatch && (
              <Link
                to="/matches"
                className="mt-8 block gold-border bg-card/60 rounded-2xl px-5 py-4 hover:bg-card/80 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-display tracking-[0.25em] text-[10px] text-primary">NEXT KICKOFF</span>
                  <span className="text-[10px] font-display tracking-widest text-muted-foreground">
                    {new Date(nextMatch.kickoff_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-center gap-3 text-base sm:text-lg">
                  <span>{nextMatch.flag_a} {nextMatch.team_a}</span>
                  <span className="text-muted-foreground text-xs">vs</span>
                  <span>{nextMatch.team_b} {nextMatch.flag_b}</span>
                </div>
                {countdown && !countdown.done && (
                  <div className="mt-3 flex items-center justify-center gap-2 font-display tabular-nums">
                    {[
                      { v: countdown.d, l: "D" },
                      { v: countdown.h, l: "H" },
                      { v: countdown.m, l: "M" },
                      { v: countdown.s, l: "S" },
                    ].map(({ v, l }) => (
                      <div key={l} className="flex flex-col items-center bg-background/60 border border-primary/20 rounded-md px-2 py-1 min-w-[44px]">
                        <span className="text-lg sm:text-xl text-primary leading-none">{String(v).padStart(2, "0")}</span>
                        <span className="text-[9px] tracking-widest text-muted-foreground mt-0.5">{l}</span>
                      </div>
                    ))}
                  </div>
                )}
                {countdown?.done && (
                  <div className="mt-3 text-center font-display tracking-widest text-xs text-primary animate-pulse">KICKOFF</div>
                )}
              </Link>
            )}
          </div>
        </div>


        {/* Player teaser */}
        <div className="border-t border-border pt-8">
          <div className="font-display tracking-[0.3em] text-sm text-muted-foreground text-center mb-6">
            THE LEAGUE
          </div>
          <div className="flex justify-center gap-8 sm:gap-12 flex-wrap">
            {players.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-3">
                <PlayerAvatar name={p.name} color={p.avatar_color} url={p.avatar_url} size={112} />
                <span className="font-display text-base sm:text-lg tracking-wider">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
