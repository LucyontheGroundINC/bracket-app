ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS tournament_id integer;

UPDATE public.matches m
SET tournament_id = t.id
FROM public.tournaments t
WHERE m.tournament_id IS NULL
  AND t.is_active = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'matches_tournament_id_tournaments_id_fk'
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_tournament_id_tournaments_id_fk
      FOREIGN KEY (tournament_id)
      REFERENCES public.tournaments(id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS matches_tournament_region_round_order_idx
  ON public.matches (tournament_id, region, round, match_order);
