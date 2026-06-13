CREATE OR REPLACE FUNCTION public.calculate_points(ph int, pa int, ah int, aa int)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN ph IS NULL OR pa IS NULL OR ah IS NULL OR aa IS NULL THEN NULL
    WHEN ph = ah AND pa = aa THEN 3
    WHEN sign(ph - pa) = sign(ah - aa) THEN 1
    ELSE 0
  END;
$$;