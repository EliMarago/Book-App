import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Book = {
  id: string;
  user_id: string;
  title: string;
  author: string;
  cover_url: string | null;
  rating: number;
  status: 'reading' | 'completed' | 'want';
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  book_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};
