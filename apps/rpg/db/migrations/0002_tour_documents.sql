CREATE TABLE IF NOT EXISTS tour_documents (
  slug text PRIMARY KEY,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS tour_documents_publication_idx
  ON tour_documents (status, published_at DESC, updated_at DESC);

COMMENT ON TABLE tour_documents IS 'Private-source product tour documents served by the hosted API.';
