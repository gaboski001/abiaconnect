-- How long each stage of a call took (app open time when the call arrived,
-- ringing until answered, answered until voice flows), e.g. "page3200 answer4100 connect1800".
ALTER TABLE public.call_health ADD COLUMN IF NOT EXISTS timing text CHECK (length(timing) <= 120);
