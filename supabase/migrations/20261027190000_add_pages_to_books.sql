ALTER TABLE books ADD COLUMN IF NOT EXISTS pages integer;

CREATE INDEX IF NOT EXISTS idx_books_pages ON books(pages);
