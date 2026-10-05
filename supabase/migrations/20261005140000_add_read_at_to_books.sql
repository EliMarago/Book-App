ALTER TABLE books ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_books_read_at ON books(read_at);
