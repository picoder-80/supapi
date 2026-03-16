-- Remove legacy provider tags from assistant memory answers.
UPDATE public.ai_assistant_memory
SET answer = btrim(
  regexp_replace(
    regexp_replace(
      COALESCE(answer, ''),
      '\s*\[provider:(anthropic|openai|deepseek|heuristic)\]\s*',
      ' ',
      'gi'
    ),
    '\s{2,}',
    ' ',
    'g'
  )
)
WHERE answer ~* '\[provider:(anthropic|openai|deepseek|heuristic)\]';
