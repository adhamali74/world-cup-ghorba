export type Player = {
  id: string;
  slug: string;
  name: string;
  avatar_color: string;
  is_admin: boolean;
};

export type Match = {
  id: string;
  match_no: number | null;
  stage: "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final";
  group_letter: string | null;
  team_a: string;
  team_b: string;
  flag_a: string | null;
  flag_b: string | null;
  kickoff_at: string;
  venue: string | null;
  home_score: number | null;
  away_score: number | null;
};

export type Prediction = {
  id: string;
  player_id: string;
  match_id: string;
  predicted_home: number;
  predicted_away: number;
  locked_at: string;
  points_earned: number | null;
};
