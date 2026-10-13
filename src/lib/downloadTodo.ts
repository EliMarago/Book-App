export interface DownloadTodoItem {
  id: string;
  title: string;
  author?: string;
  note?: string;
  completed: boolean;
  createdAt: string;
}

const STORAGE_PREFIX = 'books_download_todo';

function getStorageKey(userId?: string): string {
  return userId ? `${STORAGE_PREFIX}_${userId}` : STORAGE_PREFIX;
}

export function getDownloadTodos(userId?: string): DownloadTodoItem[] {
  try {
    const key = getStorageKey(userId);
    let raw = localStorage.getItem(key);

    // Fallback retrocompatibile se non trovato per-utente
    if (!raw && userId) {
      raw = localStorage.getItem(STORAGE_PREFIX);
    }

    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    console.error('Errore nel recupero della lista download todo:', error);
    return [];
  }
}

export function saveDownloadTodos(todos: DownloadTodoItem[], userId?: string): void {
  try {
    const key = getStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(todos));
  } catch (error) {
    console.error('Errore nel salvataggio della lista download todo:', error);
  }
}
