import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Scoring Rules · الغُربة و كاس العالم" },
      { name: "description", content: "Simple scoring rules for the World Cup 2026 friends-only prediction league." },
    ],
  }),
  component: () => (
    <AppShell>
      <Rules />
    </AppShell>
  ),
});

function Rules() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="font-display text-5xl gold-text">RULES</h1>

      <section className="gold-border bg-card rounded-2xl divide-y divide-border">
        {[
          ["🎯", "EXACT SCORE", "+3 points"],
          ["✅", "CORRECT WINNER / DRAW", "+1 point"],
          ["❌", "WRONG", "0 points"],
        ].map(([i, l, p]) => (
          <div key={l} className="flex items-center justify-between p-5">
            <div className="flex items-center gap-4">
              <span className="text-3xl">{i}</span>
              <span className="font-display tracking-widest">{l}</span>
            </div>
            <span className="font-display gold-text text-xl">{p}</span>
          </div>
        ))}
      </section>

      <section className="gold-border bg-card rounded-2xl p-5 space-y-3 text-sm">
        <h3 className="font-display tracking-widest text-base">FINE PRINT</h3>
        <ul className="space-y-2 text-muted-foreground list-disc pl-5">
          <li>Predictions must be locked <strong className="text-foreground">before kickoff</strong>.</li>
          <li>Late predictions are not accepted. Too slow? Too bad 😤</li>
          <li>If a match goes to extra time or penalties, the <strong className="text-foreground">90-minute score</strong> counts.</li>
          <li>Tie on points? Most <strong className="text-foreground">exact scores</strong> wins.</li>
          <li>Adham is admin. Adham enters the official results. Adham is always right.</li>
        </ul>
      </section>
    </div>
  );
}
