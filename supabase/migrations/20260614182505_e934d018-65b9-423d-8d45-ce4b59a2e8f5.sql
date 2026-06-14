CREATE TABLE public.bracket_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  semi_finalist_1 text NOT NULL,
  semi_finalist_2 text NOT NULL,
  semi_finalist_3 text NOT NULL,
  semi_finalist_4 text NOT NULL,
  winner text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  points_earned int,
  UNIQUE(player_id)
);

GRANT SELECT ON public.bracket_predictions TO anon, authenticated;
GRANT ALL ON public.bracket_predictions TO service_role;

ALTER TABLE public.bracket_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brackets readable by all" ON public.bracket_predictions
  FOR SELECT USING (true);