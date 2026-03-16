-- Create supapod-audio storage bucket (public for streaming)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supapod-audio',
  'supapod-audio',
  true,
  104857600,  -- 100MB
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-m4a']
)
ON CONFLICT (id) DO NOTHING;
