-- Backfill legacy dispute reasoning text to be cleaner and more reviewer-like.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'disputes' AND column_name = 'ai_reasoning'
  ) THEN
    UPDATE public.disputes
    SET ai_reasoning = CASE
      WHEN length(clean_reasoning) < 140 THEN
        clean_reasoning || ' Case review note: finalize only after confirming order timeline, delivery proof, and buyer-seller chat evidence.'
      ELSE
        clean_reasoning
    END
    FROM (
      SELECT
        id,
        btrim(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                coalesce(ai_reasoning, ''),
                '\s*\[provider:(anthropic|openai|deepseek|heuristic)\]\s*',
                ' ',
                'gi'
              ),
              '(?i)as an ai( language model)?[,]?\s*',
              ' ',
              'g'
            ),
            '\s{2,}',
            ' ',
            'g'
          )
        ) AS clean_reasoning
      FROM public.disputes
      WHERE coalesce(ai_reasoning, '') <> ''
    ) cleaned
    WHERE public.disputes.id = cleaned.id
      AND coalesce(public.disputes.ai_reasoning, '') <> cleaned.clean_reasoning;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'supascrow_disputes' AND column_name = 'ai_reasoning'
  ) THEN
    UPDATE public.supascrow_disputes
    SET ai_reasoning = CASE
      WHEN length(clean_reasoning) < 140 THEN
        clean_reasoning || ' Case review note: finalize only after confirming deal timeline, shipment evidence, and both parties'' latest message trail.'
      ELSE
        clean_reasoning
    END
    FROM (
      SELECT
        id,
        btrim(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                coalesce(ai_reasoning, ''),
                '\s*\[provider:(anthropic|openai|deepseek|heuristic)\]\s*',
                ' ',
                'gi'
              ),
              '(?i)as an ai( language model)?[,]?\s*',
              ' ',
              'g'
            ),
            '\s{2,}',
            ' ',
            'g'
          )
        ) AS clean_reasoning
      FROM public.supascrow_disputes
      WHERE coalesce(ai_reasoning, '') <> ''
    ) cleaned
    WHERE public.supascrow_disputes.id = cleaned.id
      AND coalesce(public.supascrow_disputes.ai_reasoning, '') <> cleaned.clean_reasoning;
  END IF;
END $$;
