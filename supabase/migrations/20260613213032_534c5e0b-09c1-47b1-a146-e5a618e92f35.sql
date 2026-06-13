
-- Players
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  avatar_color text NOT NULL DEFAULT '#D4AF37',
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players readable by all" ON public.players FOR SELECT USING (true);

-- Matches
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_no int UNIQUE,
  stage text NOT NULL DEFAULT 'group',  -- group | r32 | r16 | qf | sf | third | final
  group_letter text,
  team_a text NOT NULL,
  team_b text NOT NULL,
  flag_a text,
  flag_b text,
  kickoff_at timestamptz NOT NULL,
  venue text,
  home_score int,
  away_score int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX matches_kickoff_idx ON public.matches(kickoff_at);
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches readable by all" ON public.matches FOR SELECT USING (true);

-- Predictions
CREATE TABLE public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  predicted_home int NOT NULL,
  predicted_away int NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  points_earned int,
  UNIQUE (player_id, match_id)
);
CREATE INDEX predictions_match_idx ON public.predictions(match_id);
CREATE INDEX predictions_player_idx ON public.predictions(player_id);
GRANT SELECT ON public.predictions TO anon, authenticated;
GRANT ALL ON public.predictions TO service_role;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "predictions readable by all" ON public.predictions FOR SELECT USING (true);

-- Scoring function
CREATE OR REPLACE FUNCTION public.calculate_points(ph int, pa int, ah int, aa int)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN ph IS NULL OR pa IS NULL OR ah IS NULL OR aa IS NULL THEN NULL
    WHEN ph = ah AND pa = aa THEN 3
    WHEN sign(ph - pa) = sign(ah - aa) THEN 1
    ELSE 0
  END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.predictions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
