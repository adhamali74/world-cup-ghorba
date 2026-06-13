import { createServerFn } from "@tanstack/react-start";

export type LiveMatchData = {
  state: "pre" | "in" | "post";
  statusText: string; // "Second Half", "Half Time", "Full Time", "Scheduled"
  clock: string; // "70'", "45'+2'", "0'"
  period: number | null;
  venue: string | null;
  competition: string;
  home: { abbr: string; name: string; logo: string; score: number };
  away: { abbr: string; name: string; logo: string; score: number };
  kickoff: string; // ISO
};

type EspnCompetitor = {
  homeAway: "home" | "away";
  score?: string;
  team: { abbreviation: string; displayName: string; logo?: string };
};
type EspnEvent = {
  date: string;
  name: string;
  competitions: Array<{
    venue?: { fullName?: string };
    status: {
      type: { state: "pre" | "in" | "post"; description: string };
      displayClock?: string;
      period?: number;
    };
    competitors: EspnCompetitor[];
  }>;
};

export const getLiveMatch = createServerFn({ method: "GET" }).handler(async (): Promise<LiveMatchData | null> => {
  // ESPN public scoreboard for FIFA World Cup — no API key required
  const url = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as { events?: EspnEvent[] };
  const events = data.events ?? [];
  if (events.length === 0) return null;

  // Prefer a match in progress; otherwise the next scheduled; otherwise the most recently finished.
  const live = events.find((e) => e.competitions[0]?.status.type.state === "in");
  const upcoming = events
    .filter((e) => e.competitions[0]?.status.type.state === "pre")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))[0];
  const recent = events
    .filter((e) => e.competitions[0]?.status.type.state === "post")
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))[0];
  const event = live ?? upcoming ?? recent;
  if (!event) return null;

  const comp = event.competitions[0];
  const home = comp.competitors.find((c) => c.homeAway === "home")!;
  const away = comp.competitors.find((c) => c.homeAway === "away")!;

  const norm = (c: EspnCompetitor) => ({
    abbr: c.team.abbreviation,
    name: c.team.displayName,
    logo: c.team.logo ?? `https://a.espncdn.com/i/teamlogos/countries/500/${c.team.abbreviation.toLowerCase()}.png`,
    score: Number(c.score ?? 0),
  });

  return {
    state: comp.status.type.state,
    statusText: comp.status.type.description,
    clock: comp.status.displayClock ?? "",
    period: comp.status.period ?? null,
    venue: comp.venue?.fullName ?? null,
    competition: "FIFA World Cup",
    home: norm(home),
    away: norm(away),
    kickoff: event.date,
  };
});
