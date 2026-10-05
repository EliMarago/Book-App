/*
# Create books and notes tables (multi-user, owner-scoped)

1. New Tables
- `books`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users with cascade delete)
  - `title` (text, not null)
  - `author` (text, not null)
  - `cover_url` (text, nullable — fetched from Google Books API)
  - `rating` (numeric(2,1), not null, default 0 — supports 0.0 to 5.0 in 0.5 increments)
  - `status` (text, not null, default 'reading' — one of: reading, completed, want)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
- `notes`
  - `id` (uuid, primary key)
  - `book_id` (uuid, not null, references books with cascade delete)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users with cascade delete)
  - `content` (text, not null)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Indexes
- Index on books.user_id for fast per-user queries
- Index on notes.book_id for fast per-book queries

3. Security
- Enable RLS on both tables.
- Owner-scoped CRUD on books: each authenticated user can only access their own rows.
- Owner-scoped CRUD on notes: authenticated users can only access notes on books they own.
- user_id columns default to auth.uid() so client inserts omitting user_id still satisfy RLS.
*/

CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text NOT NULL,
  cover_url text,
  rating numeric(2,1) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'reading',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);

ALTER TABLE books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_books" ON books;
CREATE POLICY "select_own_books" ON books FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_books" ON books;
CREATE POLICY "insert_own_books" ON books FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_books" ON books;
CREATE POLICY "update_own_books" ON books FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_books" ON books;
CREATE POLICY "delete_own_books" ON books FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_book_id ON notes(book_id);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notes" ON notes;
CREATE POLICY "select_own_notes" ON notes FOR SELECT
TO authenticated USING (
  EXISTS (SELECT 1 FROM books WHERE books.id = notes.book_id AND books.user_id = auth.uid())
);

DROP POLICY IF EXISTS "insert_own_notes" ON notes;
CREATE POLICY "insert_own_notes" ON notes FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM books WHERE books.id = notes.book_id AND books.user_id = auth.uid())
);

DROP POLICY IF EXISTS "update_own_notes" ON notes;
CREATE POLICY "update_own_notes" ON notes FOR UPDATE
TO authenticated USING (
  EXISTS (SELECT 1 FROM books WHERE books.id = notes.book_id AND books.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM books WHERE books.id = notes.book_id AND books.user_id = auth.uid())
);

DROP POLICY IF EXISTS "delete_own_notes" ON notes;
CREATE POLICY "delete_own_notes" ON notes FOR DELETE
TO authenticated USING (
  EXISTS (SELECT 1 FROM books WHERE books.id = notes.book_id AND books.user_id = auth.uid())
);