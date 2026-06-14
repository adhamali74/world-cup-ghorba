import { createFileRoute } from "@tanstack/react-router";

type EspnCompetitor = { homeAway: "home" | "away"; score?: string; team: { displayName: string; shortDisplayName?: string; name?: string } };
type EspnEvent = {
  date: string;
  competitions: Array<{
    status: { type: { state: "pre" | "in" | "post" } };
    competitors: EspnCompetitor[];
  }>;
};

const TEAM_ALIASES: Record<string, string> = {
  turkiye: "turkey",
  trkiye: "turkey",
  usa: "unitedstates",
  usmnt: "unitedstates",
};

const norm = (s: string) => {
  const normalized = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
  return TEAM_ALIASES[normalized] ?? normalized;
};

async function fetchEspnForDate(yyyymmdd: string): Promise<EspnEvent[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${yyyymmdd}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = (await res.json()) as { events?: EspnEvent[] };
  return data.events ?? [];
}

function addDaysKey(yyyymmdd: string, days: number) {
  const date = new Date(`${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}

function teamMatches(espnName: string, dbName: string) {
  const a = norm(espnName);
  const b = norm(dbName);
  return a === b || a.includes(b) || b.includes(a);
}

function calculatePoints(predictedHome: number, predictedAway: number, actualHome: number, actualAway: number) {
  if (predictedHome === actualHome && predictedAway === actualAway) return 3;
  if (Math.sign(predictedHome - predictedAway) === Math.sign(actualHome - actualAway)) return 1;
  return 0;
}

export const Route = createFileRoute("/api/public/hooks/sync-results")({
  server: {
    handlers: {
      GET: async () => handle(),
      POST: async () => handle(),
    },
  },
});

async function handle() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Find finished-but-unscored matches (past kickoff + missing score)
  const { data: matches, error: mErr } = await supabaseAdmin
    .from("matches")
    .select("id, team_a, team_b, kickoff_at, home_score, away_score")
    .lt("kickoff_at", new Date(Date.now() - 90 * 60 * 1000).toISOString())
    .is("home_score", null);
  if (mErr) return Response.json({ error: mErr.message }, { status: 500 });

  if (!matches || matches.length === 0) {
    return Response.json({ ok: true, checked: 0, updated: 0 });
  }

  // Group matches by date, fetch ESPN once per date
  const byDate = new Map<string, typeof matches>();
  for (const m of matches) {
    const d = new Date(m.kickoff_at);
    const key = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(m);
  }

  let updated = 0;
  let rescored = 0;
  const details: any[] = [];

  const eventsByDate = new Map<string, EspnEvent[]>();

  for (const [date, ms] of byDate) {
    const dateKeys = [addDaysKey(date, -1), date, addDaysKey(date, 1)];
    const events = (
      await Promise.all(
        dateKeys.map(async (key) => {
          if (!eventsByDate.has(key)) eventsByDate.set(key, await fetchEspnForDate(key));
          return eventsByDate.get(key)!;
        }),
      )
    ).flat();
    const finished = events.filter((e) => e.competitions[0]?.status.type.state === "post");
    for (const m of ms) {
      const ev = finished.find((e) => {
        const comp = e.competitions[0];
        const home = comp.competitors.find((c) => c.homeAway === "home");
        const away = comp.competitors.find((c) => c.homeAway === "away");
        if (!home || !away) return false;
        return (
          (teamMatches(home.team.displayName, m.team_a) && teamMatches(away.team.displayName, m.team_b)) ||
          (teamMatches(home.team.displayName, m.team_b) && teamMatches(away.team.displayName, m.team_a))
        );
      });
      if (!ev) continue;

      const comp = ev.competitions[0];
      const eHome = comp.competitors.find((c) => c.homeAway === "home")!;
      const eAway = comp.competitors.find((c) => c.homeAway === "away")!;
      // Map back to our team_a / team_b
      const aIsHome = teamMatches(eHome.team.displayName, m.team_a);
      const scoreA = Number((aIsHome ? eHome : eAway).score ?? 0);
      const scoreB = Number((aIsHome ? eAway : eHome).score ?? 0);

      const { error: upErr } = await supabaseAdmin
        .from("matches")
        .update({ home_score: scoreA, away_score: scoreB })
        .eq("id", m.id);
      if (upErr) {
        details.push({ match: `${m.team_a}-${m.team_b}`, error: upErr.message });
        continue;
      }

      // Recalculate prediction points
      const { data: preds } = await supabaseAdmin
        .from("predictions")
        .select("id, predicted_home, predicted_away")
        .eq("match_id", m.id);

      for (const p of preds ?? []) {
        const pts = calculatePoints(p.predicted_home, p.predicted_away, scoreA, scoreB);
        await supabaseAdmin.from("predictions").update({ points_earned: pts }).eq("id", p.id);
        rescored += 1;
      }

      updated += 1;
      details.push({ match: `${m.team_a} ${scoreA}-${scoreB} ${m.team_b}`, predictions: preds?.length ?? 0 });
    }
  }

  const { data: scoredMatches } = await supabaseAdmin
    .from("matches")
    .select("id, home_score, away_score")
    .not("home_score", "is", null)
    .not("away_score", "is", null);

  for (const match of scoredMatches ?? []) {
    const { data: preds } = await supabaseAdmin
      .from("predictions")
      .select("id, predicted_home, predicted_away, points_earned")
      .eq("match_id", match.id);

    for (const p of preds ?? []) {
      const pts = calculatePoints(p.predicted_home, p.predicted_away, match.home_score!, match.away_score!);
      if (p.points_earned === pts) continue;
      await supabaseAdmin.from("predictions").update({ points_earned: pts }).eq("id", p.id);
      rescored += 1;
    }
  }

  return Response.json({ ok: true, checked: matches.length, updated, rescored, details });
}
