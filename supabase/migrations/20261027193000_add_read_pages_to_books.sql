ALTER TABLE books ADD COLUMN IF NOT EXISTS read_pages integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_books_read_pages ON books(read_pages);
