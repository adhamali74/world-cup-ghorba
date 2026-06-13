import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import trophyAsset from "@/assets/world-cup-trophy.webp.asset.json";

export const Route = createFileRoute("/cr7")({
  head: () => ({
    meta: [
      { title: "The Final Chapter · CR7" },
      { name: "description", content: "Cristiano Ronaldo's World Cup journey — 5 tournaments, 9 goals, one trophy left." },
    ],
  }),
  component: () => (
    <AppShell>
      <CR7 />
    </AppShell>
  ),
});

const TIMELINE = [
  { y: "2006", flag: "🇩🇪", t: "Portugal 3rd place — Ronaldo scores 1, just 21 years old." },
  { y: "2010", flag: "🇿🇦", t: "Eliminated in Round of 16 by Spain." },
  { y: "2014", flag: "🇧🇷", t: "Group stage exit." },
  { y: "2018", flag: "🇷🇺", t: "Hat-trick vs Spain. Eliminated by Uruguay." },
  { y: "2022", flag: "🇶🇦", t: "1 goal. Heartbreak vs Morocco in the quarters." },
];

function CR7() {
  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center">
        <h1 className="font-display text-5xl gold-text">THE FINAL CHAPTER</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          5 World Cups · 9 goals · 0 trophies… <span className="text-primary">until now?</span>
        </p>
      </div>

      <ol className="relative border-l border-border ml-3 space-y-5">
        {TIMELINE.map((row) => (
          <li key={row.y} className="ml-6">
            <span className="absolute -left-2.5 w-5 h-5 rounded-full bg-card border border-border grid place-items-center text-[10px]">
              {row.flag}
            </span>
            <div className="gold-border bg-card rounded-xl p-4">
              <div className="font-display tracking-widest text-sm text-muted-foreground">{row.y}</div>
              <div className="mt-1">{row.t}</div>
            </div>
          </li>
        ))}
        <li className="ml-6">
          <span className="absolute -left-4 w-8 h-8 rounded-full bg-primary/20 grid place-items-center pulse-gold overflow-hidden">
            <img src={trophyAsset.url} alt="" className="h-6 w-6 object-contain" />
          </span>
          <div className="gold-border bg-primary/10 rounded-xl p-5 border-primary/50">
            <div className="font-display tracking-widest text-sm text-primary">2026</div>
            <div className="font-display text-3xl gold-text mt-1">THE LAST DANCE 🔥</div>
            <div className="mt-2 text-sm">
              Portugal is here. The world is watching. Will he finally lift it?
            </div>
          </div>
        </li>
      </ol>

      <blockquote className="text-center italic text-muted-foreground border-t border-border pt-6">
        &ldquo;Some stories don&apos;t end — they culminate.&rdquo;
      </blockquote>
    </div>
  );
}
