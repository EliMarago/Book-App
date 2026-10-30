import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  StickyNote,
  Plus,
  Search,
  Trash2,
  Edit3,
  Check,
  Copy,
  X,
  Loader2,
  Calendar,
  Quote,
  MessageSquare,
  FileText,
  Lightbulb,
  BookOpen,
  BookMarked,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { supabase, type Book, type Note } from '@/lib/supabase';
import { useToast } from './Toast';

export type NoteTag = 'Citazione' | 'Riflessione' | 'Riassunto' | 'Spunto';

export const NOTE_TAGS: Array<{
  id: NoteTag;
  label: string;
  icon: typeof Quote;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}> = [
  {
    id: 'Citazione',
    label: 'Citazione',
    icon: Quote,
    badgeBg: 'bg-emerald-500/15 light:bg-emerald-100',
    badgeText: 'text-emerald-400 light:text-emerald-800',
    badgeBorder: 'border-emerald-500/30 light:border-emerald-300',
  },
  {
    id: 'Riflessione',
    label: 'Riflessione',
    icon: MessageSquare,
    badgeBg: 'bg-amber-500/15 light:bg-amber-100',
    badgeText: 'text-amber-400 light:text-amber-800',
    badgeBorder: 'border-amber-500/30 light:border-amber-300',
  },
  {
    id: 'Riassunto',
    label: 'Riassunto',
    icon: FileText,
    badgeBg: 'bg-sky-500/15 light:bg-sky-100',
    badgeText: 'text-sky-400 light:text-sky-800',
    badgeBorder: 'border-sky-500/30 light:border-sky-300',
  },
  {
    id: 'Spunto',
    label: 'Spunto',
    icon: Lightbulb,
    badgeBg: 'bg-purple-500/15 light:bg-purple-100',
    badgeText: 'text-purple-400 light:text-purple-800',
    badgeBorder: 'border-purple-500/30 light:border-purple-300',
  },
];

export interface ParsedNote {
  tag: NoteTag | null;
  page: number | null;
  text: string;
}

export function parseNoteContent(raw: string): ParsedNote {
  const match = raw.match(/^\[([^\]]+)\]\s*\n?([\s\S]*)$/);
  if (!match) {
    return { tag: null, page: null, text: raw };
  }

  const meta = match[1];
  const text = match[2].trim();

  let tag: NoteTag | null = null;
  let page: number | null = null;

  const parts = meta.split('·').map((s) => s.trim());
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.startsWith('pag.')) {
      const num = parseInt(lower.replace('pag.', '').trim(), 10);
      if (!isNaN(num) && num > 0) page = num;
    } else if (lower.startsWith('pagina')) {
      const num = parseInt(lower.replace('pagina', '').trim(), 10);
      if (!isNaN(num) && num > 0) page = num;
    } else if (lower === 'citazione') {
      tag = 'Citazione';
    } else if (lower === 'riflessione') {
      tag = 'Riflessione';
    } else if (lower === 'riassunto') {
      tag = 'Riassunto';
    } else if (lower === 'spunto' || lower === 'idea') {
      tag = 'Spunto';
    }
  }

  return { tag, page, text: text || raw };
}

export function formatNoteContent(text: string, tag: NoteTag | null, page: number | null): string {
  const trimmed = text.trim();
  const parts: string[] = [];
  if (tag) parts.push(tag);
  if (page && page > 0) parts.push(`Pag. ${page}`);

  if (parts.length > 0) {
    return `[${parts.join(' · ')}]\n${trimmed}`;
  }
  return trimmed;
}

interface BookNotesModalProps {
  book: Book;
  onClose: () => void;
  onUpdateBook: (updatedBook: Book) => void;
  initialNotes?: Note[] | null;
}

export function BookNotesModal({
  book,
  onClose,
  onUpdateBook,
  initialNotes,
}: BookNotesModalProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[] | null>(initialNotes ?? null);
  const [loading, setLoading] = useState(initialNotes === undefined || initialNotes === null);
  const [savingNote, setSavingNote] = useState(false);

  // Stato per la creazione di una nuova nota
  const [newText, setNewText] = useState('');
  const [selectedTag, setSelectedTag] = useState<NoteTag | null>(null);
  const [pageInput, setPageInput] = useState<string>(() => {
    return book.read_pages && book.read_pages > 0 ? String(book.read_pages) : '';
  });

  // Ricerca nelle note
  const [searchQuery, setSearchQuery] = useState('');

  // Modifica di una nota esistente
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editTag, setEditTag] = useState<NoteTag | null>(null);
  const [editPage, setEditPage] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Copia feedback temporaneo per nota
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Conferma eliminazione
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Caricamento note se non fornite
  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('book_id', book.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const userNotes = (data ?? []).filter((n) => !n.content.startsWith('__'));
      setNotes(userNotes);
    } catch (e) {
      console.error('Errore nel caricamento delle note:', e);
      toast({ message: 'Impossibile caricare le note', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [book.id, toast]);

  useEffect(() => {
    if (initialNotes === undefined || initialNotes === null) {
      loadNotes();
    }
  }, [initialNotes, loadNotes]);

  // Blocca lo scroll del body quando la modale è aperta per una navigazione mobile fluida
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Gestione tasto Escape per chiudere la modale
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingNoteId) {
          setEditingNoteId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, editingNoteId]);

  // Gestione aggiunta nuova nota
  const handleAddNote = async () => {
    if (!newText.trim() || savingNote) return;

    // Chiudi fluidamente la tastiera mobile ed evita lo zoom residuo della vista su iOS
    textareaRef.current?.blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setSavingNote(true);
    try {
      const pageNum = pageInput ? parseInt(pageInput, 10) : null;
      const formattedContent = formatNoteContent(
        newText,
        selectedTag,
        !isNaN(pageNum as number) && (pageNum as number) > 0 ? pageNum : null
      );

      const { data, error } = await supabase
        .from('notes')
        .insert({ book_id: book.id, content: formattedContent })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const updated = [data, ...(notes ?? [])];
        setNotes(updated);
        setNewText('');
        // Non resettiamo pageInput se l'utente sta leggendo a quella pagina
        onUpdateBook({ ...book, notes_count: updated.length });
        toast({ message: 'Nota salvata con successo!', type: 'success' });
      }
    } catch (e) {
      console.error('Errore nel salvataggio della nota:', e);
      toast({ message: 'Errore durante il salvataggio della nota', type: 'error' });
    } finally {
      setSavingNote(false);
    }
  };

  // Avvia modifica nota
  const startEditing = (note: Note) => {
    const parsed = parseNoteContent(note.content);
    setEditingNoteId(note.id);
    setEditText(parsed.text);
    setEditTag(parsed.tag);
    setEditPage(parsed.page ? String(parsed.page) : '');
  };

  // Salva modifica nota
  const handleSaveEdit = async (id: string) => {
    if (!editText.trim() || savingEdit) return;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setSavingEdit(true);
    try {
      const pageNum = editPage ? parseInt(editPage, 10) : null;
      const formattedContent = formatNoteContent(
        editText,
        editTag,
        !isNaN(pageNum as number) && (pageNum as number) > 0 ? pageNum : null
      );

      const { data, error } = await supabase
        .from('notes')
        .update({ content: formattedContent, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setNotes((prev) => (prev ?? []).map((n) => (n.id === id ? data : n)));
        setEditingNoteId(null);
        setEditText('');
        toast({ message: 'Nota modificata con successo', type: 'success' });
      }
    } catch (e) {
      console.error('Errore nella modifica della nota:', e);
      toast({ message: 'Errore nella modifica della nota', type: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };

  // Elimina nota
  const handleDeleteNote = async (id: string) => {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;

      const updated = (notes ?? []).filter((n) => n.id !== id);
      setNotes(updated);
      setDeletingNoteId(null);
      onUpdateBook({ ...book, notes_count: updated.length });
      toast({ message: 'Nota eliminata', type: 'info' });
    } catch (e) {
      console.error('Errore nell\'eliminazione della nota:', e);
      toast({ message: 'Errore nell\'eliminazione', type: 'error' });
    }
  };

  // Copia nota negli appunti
  const handleCopyNote = async (note: Note) => {
    try {
      const parsed = parseNoteContent(note.content);
      const textToCopy = parsed.tag || parsed.page
        ? `${parsed.tag ? `[${parsed.tag}] ` : ''}${parsed.page ? `(Pag. ${parsed.page}) ` : ''}\n${parsed.text}\n— da "${book.title}", ${book.author}`
        : `${parsed.text}\n— da "${book.title}", ${book.author}`;

      await navigator.clipboard.writeText(textToCopy);
      setCopiedNoteId(note.id);
      toast({ message: 'Copiato negli appunti!', type: 'success', duration: 2500 });
      setTimeout(() => setCopiedNoteId(null), 2000);
    } catch {
      toast({ message: 'Impossibile copiare negli appunti', type: 'error' });
    }
  };

  // Filtra note in base alla ricerca
  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return notes;

    return notes.filter((n) => {
      const parsed = parseNoteContent(n.content);
      return (
        parsed.text.toLowerCase().includes(q) ||
        (parsed.tag && parsed.tag.toLowerCase().includes(q)) ||
        (parsed.page && String(parsed.page).includes(q))
      );
    });
  }, [notes, searchQuery]);

  // Conteggio parole e caratteri nuova nota
  const wordCount = newText.trim() ? newText.trim().split(/\s+/).length : 0;
  const charCount = newText.length;

  return createPortal(
    <div
      className="fixed inset-0 bg-stone-950/80 light:bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2.5 sm:p-5 animate-fade-up"
      onClick={onClose}
    >
      <div
        className="bg-stone-900 light:bg-white rounded-3xl border border-stone-800 light:border-stone-200 max-w-2xl w-full max-h-[88dvh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER MODALE */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-800 light:border-stone-200 shrink-0 bg-stone-900 light:bg-white">
          <div className="flex items-center gap-3 min-w-0">
            {/* Miniatura copertina */}
            <div className="w-10 h-14 rounded-lg bg-stone-800 light:bg-stone-100 border border-stone-700/80 light:border-stone-300 overflow-hidden shrink-0 shadow-sm relative book-spine-effect">
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-500 light:text-stone-400">
                  <BookMarked size={16} />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-serif font-bold text-base sm:text-lg text-stone-100 light:text-stone-900 leading-tight truncate">
                  {book.title}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 light:bg-amber-100 text-amber-300 light:text-amber-800 border border-amber-500/30 whitespace-nowrap shrink-0">
                  {notes ? notes.length : 0} {notes && notes.length === 1 ? 'nota' : 'note'}
                </span>
              </div>
              <p className="text-xs text-stone-400 light:text-stone-600 mt-0.5 truncate">
                {book.author}
                {book.pages && book.pages > 0 && ` · ${book.pages} pagine`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 light:text-stone-500 hover:text-stone-100 light:hover:text-stone-900 hover:bg-stone-800 light:hover:bg-stone-100 transition-colors cursor-pointer shrink-0"
            aria-label="Chiudi finestra note"
          >
            <X size={20} />
          </button>
        </div>

        {/* CORPO MODALE (SCROLLABILE) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* SEZIONE 1: AREA DI SCRITTURA SPAZIOSA E CONFORTEVOLE */}
          <div className="bg-stone-850/80 light:bg-stone-50/90 border border-stone-800 light:border-stone-200/90 rounded-2xl p-4 sm:p-5 shadow-xs transition-all focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700">
                  <StickyNote size={15} />
                </div>
                <span className="font-serif font-bold text-sm text-stone-200 light:text-stone-900">
                  Aggiungi una nuova nota
                </span>
              </div>

              {/* Tag / Tipologia rapida */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {NOTE_TAGS.map((t) => {
                  const Icon = t.icon;
                  const isSelected = selectedTag === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTag(isSelected ? null : t.id)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                        isSelected
                          ? `${t.badgeBg} ${t.badgeText} ${t.badgeBorder} ring-1 ring-amber-500/30 shadow-xs font-bold`
                          : 'bg-stone-800/60 light:bg-white text-stone-400 light:text-stone-600 border-stone-700 light:border-stone-200 hover:text-stone-200 light:hover:text-stone-800'
                      }`}
                    >
                      <Icon size={11} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Riferimento Pagina opzionale */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-xs text-stone-400 light:text-stone-500 font-medium flex items-center gap-1">
                <BookOpen size={13} className="text-amber-400 light:text-amber-600" />
                Pagina del libro:
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max={book.pages ? book.pages : undefined}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  placeholder={book.pages ? `es. ${Math.min(book.pages, 1)}` : 'es. 42'}
                  className="w-20 px-2.5 py-1 text-base sm:text-xs bg-stone-900 light:bg-white border border-stone-700 light:border-stone-300 rounded-lg text-stone-100 light:text-stone-900 focus:outline-none focus:border-amber-500/50"
                />
                {book.pages && book.pages > 0 && (
                  <span className="text-xs text-stone-500">/ {book.pages}</span>
                )}
              </div>
            </div>

            {/* Area di testo grande con comoda interlinea e font */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
                rows={4}
                placeholder={
                  selectedTag === 'Citazione'
                    ? 'Incolla o scrivi la citazione che ti ha colpito...'
                    : selectedTag === 'Riassunto'
                      ? 'Riassumi i punti salienti del capitolo o del libro...'
                      : 'Scrivi le tue riflessioni, pensieri o appunti su questo libro...'
                }
                className="w-full bg-stone-900/90 light:bg-white border border-stone-700 light:border-stone-300 rounded-xl p-3.5 text-base sm:text-sm text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition-all leading-relaxed shadow-inner"
              />
            </div>

            {/* Barra azioni inferiore dell'editor */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-3 pt-2 border-t border-stone-800/80 light:border-stone-200/80 text-xs">
              <div className="flex items-center gap-3 text-stone-500 light:text-stone-400">
                <span>
                  {wordCount} {wordCount === 1 ? 'parola' : 'parole'}
                </span>
                <span>·</span>
                <span>{charCount} caratteri</span>
                <span className="hidden sm:inline-block">·</span>
                <span className="hidden sm:inline-block text-[11px] text-stone-500 light:text-stone-400">
                  Premi <kbd className="px-1.5 py-0.5 rounded bg-stone-800 light:bg-stone-200 text-stone-300 light:text-stone-700 font-mono text-[10px]">⌘</kbd>+<kbd className="px-1.5 py-0.5 rounded bg-stone-800 light:bg-stone-200 text-stone-300 light:text-stone-700 font-mono text-[10px]">Invio</kbd> per salvare
                </span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {newText.trim() && (
                  <button
                    type="button"
                    onClick={() => setNewText('')}
                    className="text-xs px-2.5 py-1.5 text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900 transition-colors"
                  >
                    Cancella
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={savingNote || !newText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-semibold rounded-xl transition-all shadow-md shadow-amber-500/10 disabled:opacity-40 cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  {savingNote ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Salvataggio...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} strokeWidth={2.5} />
                      <span>Salva nota</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* SEZIONE 2: NOTE SALVATE */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-sm text-stone-200 light:text-stone-900">
                  Tutte le note
                </span>
                <span className="text-xs text-stone-500 light:text-stone-500">
                  ({filteredNotes.length}{notes && filteredNotes.length !== notes.length ? ` di ${notes.length}` : ''})
                </span>
              </div>

              {/* Barra di ricerca se ci sono 2 o più note */}
              {notes && notes.length >= 2 && (
                <div className="relative sm:w-60">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca nelle note..."
                    className="w-full pl-8 pr-3 py-1 bg-stone-850 light:bg-stone-100 border border-stone-700 light:border-stone-300 rounded-lg text-xs text-stone-100 light:text-stone-900 placeholder-stone-500 focus:outline-none focus:border-amber-500/50"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 hover:text-stone-200"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* STATI: CARICAMENTO / VUOTO / LISTA */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-stone-500 light:text-stone-400">
                <Loader2 size={24} className="animate-spin text-amber-400 mb-2" />
                <p className="text-xs">Caricamento note in corso...</p>
              </div>
            ) : (!notes || notes.length === 0) ? (
              <div className="bg-stone-850/40 light:bg-stone-50/60 border border-stone-800 light:border-stone-200 rounded-2xl p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 light:bg-amber-100 border border-amber-500/20 light:border-amber-200 flex items-center justify-center mx-auto mb-3 text-amber-400 light:text-amber-700">
                  <Sparkles size={22} />
                </div>
                <h4 className="font-serif font-bold text-base text-stone-200 light:text-stone-800 mb-1">
                  Nessuna nota ancora
                </h4>
                <p className="text-xs text-stone-400 light:text-stone-600 max-w-sm mx-auto leading-relaxed">
                  Usa lo spazio in alto per salvare citazioni memorabili, riassunti o riflessioni personali durante la lettura.
                </p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="text-center py-8 text-stone-500 light:text-stone-400 text-xs">
                Nessuna nota corrisponde a "{searchQuery}"
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotes.map((note) => {
                  const parsed = parseNoteContent(note.content);
                  const isEditing = editingNoteId === note.id;
                  const isCopied = copiedNoteId === note.id;
                  const isDeleting = deletingNoteId === note.id;
                  const tagMeta = NOTE_TAGS.find((t) => t.id === parsed.tag);

                  return (
                    <div
                      key={note.id}
                      className="bg-stone-850/70 light:bg-white border border-stone-800/90 light:border-stone-200/90 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:border-stone-700 light:hover:border-stone-300 group"
                    >
                      {isEditing ? (
                        /* MODALITÀ MODIFICA NOTA */
                        <div className="space-y-3 animate-fade-up">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-amber-400 light:text-amber-700 flex items-center gap-1.5">
                              <Edit3 size={13} />
                              Modifica nota
                            </span>

                            {/* Tag selector durante la modifica */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {NOTE_TAGS.map((t) => {
                                const Icon = t.icon;
                                const isSel = editTag === t.id;
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setEditTag(isSel ? null : t.id)}
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${
                                      isSel
                                        ? `${t.badgeBg} ${t.badgeText} ${t.badgeBorder}`
                                        : 'bg-stone-800 light:bg-stone-100 text-stone-400 light:text-stone-600 border-stone-700 light:border-stone-300'
                                    }`}
                                  >
                                    <Icon size={10} />
                                    <span>{t.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-stone-400 light:text-stone-500 font-medium">
                              Pagina:
                            </span>
                            <input
                              type="number"
                              min="1"
                              value={editPage}
                              onChange={(e) => setEditPage(e.target.value)}
                              placeholder="es. 42"
                              className="w-20 px-2 py-0.5 text-base sm:text-xs bg-stone-900 light:bg-white border border-stone-700 light:border-stone-300 rounded text-stone-100 light:text-stone-900 outline-none"
                            />
                          </div>

                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={4}
                            className="w-full bg-stone-900 light:bg-white border border-stone-700 light:border-stone-300 rounded-xl p-3 text-base sm:text-sm text-stone-100 light:text-stone-900 focus:outline-none focus:border-amber-500/60 leading-relaxed"
                          />

                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(null);
                                setEditText('');
                              }}
                              className="text-xs px-3 py-1.5 text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900 cursor-pointer"
                            >
                              Annulla
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(note.id)}
                              disabled={savingEdit || !editText.trim()}
                              className="flex items-center gap-1 text-xs px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-40"
                            >
                              {savingEdit ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Check size={13} />
                              )}
                              <span>Salva modifiche</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* VISTA NORMALE DELLA NOTA */
                        <div className="space-y-2.5">
                          {/* Intestazione della singola nota: Badges e Azioni */}
                          <div className="flex items-center justify-between gap-2 border-b border-stone-800/60 light:border-stone-200/60 pb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {tagMeta && (
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tagMeta.badgeBg} ${tagMeta.badgeText} ${tagMeta.badgeBorder} flex items-center gap-1 shrink-0`}
                                >
                                  <tagMeta.icon size={10} />
                                  <span>{tagMeta.label}</span>
                                </span>
                              )}

                              {parsed.page && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-800 light:bg-stone-100 text-stone-300 light:text-stone-700 border border-stone-700 light:border-stone-300 flex items-center gap-1 shrink-0">
                                  <BookOpen size={10} />
                                  <span>Pag. {parsed.page}</span>
                                </span>
                              )}

                              <span className="text-[11px] text-stone-500 light:text-stone-400 flex items-center gap-1">
                                <Calendar size={11} />
                                <span>
                                  {new Date(note.created_at).toLocaleDateString('it-IT', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                              </span>
                            </div>

                            {/* Azioni sulla nota (Copia, Modifica, Elimina) */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCopyNote(note)}
                                className="p-1.5 text-stone-400 light:text-stone-500 hover:text-stone-100 light:hover:text-stone-900 rounded-lg hover:bg-stone-800 light:hover:bg-stone-100 transition-colors cursor-pointer"
                                title="Copia negli appunti"
                                aria-label="Copia nota"
                              >
                                {isCopied ? (
                                  <Check size={14} className="text-emerald-400" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => startEditing(note)}
                                className="p-1.5 text-stone-400 light:text-stone-500 hover:text-amber-400 light:hover:text-amber-700 rounded-lg hover:bg-stone-800 light:hover:bg-stone-100 transition-colors cursor-pointer"
                                title="Modifica nota"
                                aria-label="Modifica nota"
                              >
                                <Edit3 size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingNoteId(note.id)}
                                className="p-1.5 text-stone-400 light:text-stone-500 hover:text-red-400 light:hover:text-red-600 rounded-lg hover:bg-stone-800 light:hover:bg-stone-100 transition-colors cursor-pointer"
                                title="Elimina nota"
                                aria-label="Elimina nota"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Conferma eliminazione rapida */}
                          {isDeleting && (
                            <div className="p-2.5 rounded-xl bg-red-500/10 light:bg-red-50 border border-red-500/30 flex items-center justify-between gap-2 text-xs text-red-300 light:text-red-800 animate-fade-up">
                              <span className="flex items-center gap-1.5">
                                <AlertCircle size={14} className="shrink-0" />
                                Vuoi davvero eliminare questa nota?
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="px-2.5 py-1 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-md transition-colors"
                                >
                                  Elimina
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingNoteId(null)}
                                  className="px-2 py-1 text-stone-400 hover:text-stone-200"
                                >
                                  Annulla
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Contenuto testuale della nota */}
                          <div
                            className={
                              parsed.tag === 'Citazione'
                                ? 'pl-3.5 border-l-2 border-emerald-500/50 italic font-serif text-sm sm:text-base text-stone-100 light:text-stone-900 leading-relaxed whitespace-pre-wrap break-words'
                                : 'text-sm sm:text-base text-stone-200 light:text-stone-800 leading-relaxed whitespace-pre-wrap break-words'
                            }
                          >
                            {parsed.text}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER DELLA MODALE */}
        <div className="p-3 sm:p-4 border-t border-stone-800 light:border-stone-200 flex items-center justify-between text-xs text-stone-500 light:text-stone-400 bg-stone-900 light:bg-white shrink-0">
          <span>
            {notes ? notes.length : 0} {notes && notes.length === 1 ? 'nota salvata' : 'note salvate'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-800 light:bg-stone-100 hover:bg-stone-700 light:hover:bg-stone-200 text-stone-300 light:text-stone-700 font-medium transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
