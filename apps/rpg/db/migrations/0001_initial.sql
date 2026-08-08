CREATE TABLE IF NOT EXISTS works (
  id text PRIMARY KEY,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS works_publication_order_idx
  ON works (status, published_at DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS work_revisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  work_id text NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_id, version)
);

COMMENT ON TABLE works IS 'Current RPG work documents; content follows the Work TypeScript model.';
COMMENT ON TABLE work_revisions IS 'Immutable snapshots used for recovery and publication history.';
