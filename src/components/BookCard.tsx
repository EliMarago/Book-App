import { useEffect, useState } from 'react';
import {
  Trash2,
  Plus,
  Loader2,
  StickyNote,
  X,
  BookMarked,
  Link2,
  ImageOff,
  Calendar,
  Flame,
  Sparkles,
} from 'lucide-react';
import type { Book, Note } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { syncBookDateToSupabase } from '@/lib/bookDates';
import { fetchBookCover } from '@/lib/bookCoverApi';
import { StarRating } from './StarRating';

const STATUS_COLORS: Record<Book['status'], string> = {
  reading: 'bg-amber-500/15 light:bg-amber-50 text-amber-400 light:text-amber-800 border-amber-500/30 light:border-amber-300',
  completed: 'bg-emerald-500/15 light:bg-emerald-50 text-emerald-400 light:text-emerald-800 border-emerald-500/30 light:border-emerald-300',
  want: 'bg-sky-500/15 light:bg-sky-50 text-sky-400 light:text-sky-800 border-sky-500/30 light:border-sky-300',
};

export function BookCard({
  book,
  onUpdate,
  onDelete,
  onEdit,
  highlight = false,
}: {
  book: Book;
  onUpdate: (book: Book) => void;
  onDelete: (id: string) => void;
  onEdit: (book: Book) => void;
  highlight?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesCount, setNotesCount] = useState<number>(book.notes_count ?? 0);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverInput, setCoverInput] = useState('');
  const [savingCover, setSavingCover] = useState(false);
  const [autoFetchingCover, setAutoFetchingCover] = useState(false);

  // Sincronizza il conteggio con il libro passato come prop (es. da Dashboard o aggiornamenti genitore)
  useEffect(() => {
    if (book.notes_count !== undefined) {
      setNotesCount(book.notes_count);
    }
  }, [book.notes_count]);

  // Se notes_count non è definito e le note non sono ancora state caricate, carica il conteggio in background
  useEffect(() => {
    if (book.notes_count === undefined && notes === null) {
      supabase
        .from('notes')
        .select('id, content')
        .eq('book_id', book.id)
        .then(({ data }) => {
          if (data) {
            const count = data.filter((n) => !n.content.startsWith('__READ_AT__:')).length;
            setNotesCount(count);
          }
        });
    }
  }, [book.id, book.notes_count, notes]);

  const loadNotes = async () => {
    setLoadingNotes(true);
    try {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('book_id', book.id)
        .order('created_at', { ascending: false });
      const userNotes = (data ?? []).filter((n) => !n.content.startsWith('__READ_AT__:'));
      setNotes(userNotes);
      setNotesCount(userNotes.length);
    } catch (e) {
      console.error('Errore nel caricamento delle note:', e);
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    if (expanded && notes === null && !loadingNotes) {
      loadNotes();
    }
  }, [expanded, notes, loadingNotes]);

  const displayCount = notes !== null ? notes.length : notesCount;

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const { data } = await supabase
      .from('notes')
      .insert({ book_id: book.id, content: newNote.trim() })
      .select()
      .single();
    if (data) {
      const updatedNotes = [data, ...(notes ?? [])];
      setNotes(updatedNotes);
      setNotesCount(updatedNotes.length);
      setNewNote('');
      onUpdate({ ...book, notes_count: updatedNotes.length });
    }
    setSavingNote(false);
  };

  const handleUpdateNote = async (id: string) => {
    if (!editContent.trim()) return;
    const { data } = await supabase
      .from('notes')
      .update({ content: editContent.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (data) {
      setNotes((prev) => (prev ?? []).map((n) => (n.id === id ? data : n)));
    }
    setEditingNoteId(null);
    setEditContent('');
  };

  const handleDeleteNote = async (id: string) => {
    await supabase.from('notes').delete().eq('id', id);
    const updatedNotes = (notes ?? []).filter((n) => n.id !== id);
    setNotes(updatedNotes);
    setNotesCount(updatedNotes.length);
    onUpdate({ ...book, notes_count: updatedNotes.length });
  };

  const handleStatusChange = async (status: Book['status']) => {
    let newReadAt = book.read_at;
    if (status === 'completed' && !newReadAt) {
      newReadAt = new Date().toISOString();
      await syncBookDateToSupabase(book.id, newReadAt);
    }
    const { data } = await supabase
      .from('books')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', book.id)
      .select()
      .single();
    if (data) onUpdate({ ...data, read_at: newReadAt, notes_count: displayCount });
  };

  const handleRatingChange = async (rating: number) => {
    const { data } = await supabase
      .from('books')
      .update({ rating, updated_at: new Date().toISOString() })
      .eq('id', book.id)
      .select()
      .single();
    if (data) onUpdate({ ...data, read_at: book.read_at, notes_count: displayCount });
  };

  const handleSaveCover = async () => {
    setSavingCover(true);
    const url = coverInput.trim() || null;
    const { data: updated } = await supabase
      .from('books')
      .update({ cover_url: url, updated_at: new Date().toISOString() })
      .eq('id', book.id)
      .select()
      .single();
    if (updated) onUpdate({ ...updated, read_at: book.read_at, notes_count: displayCount });
    setSavingCover(false);
    setShowCoverModal(false);
    setCoverInput('');
  };

  const openCoverModal = () => {
    setCoverInput(book.cover_url ?? '');
    setShowCoverModal(true);
  };

  const handleAutoFetchCover = async () => {
    setAutoFetchingCover(true);
    try {
      const cover = await fetchBookCover(book.title, book.author);
      if (cover) {
        const { data: updated } = await supabase
          .from('books')
          .update({ cover_url: cover, updated_at: new Date().toISOString() })
          .eq('id', book.id)
          .select()
          .single();
        if (updated) onUpdate({ ...updated, read_at: book.read_at, notes_count: displayCount });
      }
    } catch (e) {
      console.error('Errore recupero copertina:', e);
    } finally {
      setAutoFetchingCover(false);
    }
  };

  const handleDeleteBook = async () => {
    await supabase.from('books').delete().eq('id', book.id);
    onDelete(book.id);
  };

  return (
    <div
      className={`group backdrop-blur-sm rounded-xl border transition-all ${
        highlight
          ? 'bg-gradient-to-br from-amber-950/30 via-stone-850 to-stone-900 light:from-amber-50/70 light:via-white light:to-amber-50/30 border-amber-500/40 light:border-amber-300 shadow-lg shadow-amber-500/5 hover:border-amber-400/60 light:hover:border-amber-400 ring-1 ring-amber-500/20 light:ring-amber-300/40'
          : 'bg-stone-800/60 light:bg-white border-stone-700 light:border-stone-200/90 hover:border-stone-600 light:hover:border-stone-300 shadow-xs'
      } overflow-hidden`}
    >
      <div className="flex gap-4 p-4">
        <div className="relative flex-shrink-0 w-24 h-36 rounded-lg overflow-hidden bg-stone-900 light:bg-stone-100 flex items-center justify-center shadow-md border border-transparent light:border-stone-200 group/cover">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={`Copertina di ${book.title}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-2 text-center">
              <BookMarked size={32} className="text-stone-600 light:text-stone-400 mb-1" />
              <span className="text-[10px] text-stone-500 light:text-stone-400">Nessuna copertina</span>
            </div>
          )}
          <ImageOff size={28} className="text-stone-600 light:text-stone-400 hidden" />

          {!book.cover_url && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAutoFetchCover();
              }}
              disabled={autoFetchingCover}
              className="absolute inset-0 bg-stone-950/85 light:bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center opacity-0 group-hover/cover:opacity-100 transition-opacity cursor-pointer border border-amber-500/30"
              title="Cerca copertina in automatico con titolo e autore"
            >
              {autoFetchingCover ? (
                <Loader2 size={18} className="animate-spin text-amber-400 light:text-amber-600 mb-1" />
              ) : (
                <Sparkles size={18} className="text-amber-400 light:text-amber-600 mb-1" />
              )}
              <span className="text-[10px] text-amber-300 light:text-amber-800 font-medium">
                {autoFetchingCover ? 'Cerco...' : 'Cerca copertina'}
              </span>
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          {highlight && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300 light:text-amber-700 tracking-wider uppercase mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 light:bg-amber-500 animate-pulse inline-block" />
              <span>In lettura</span>
            </div>
          )}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-serif text-lg font-semibold text-stone-100 light:text-stone-900 truncate">
                {book.title}
              </h3>
              <p className="text-stone-400 light:text-stone-600 text-sm mt-0.5">{book.author}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onEdit(book)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-500 light:text-stone-400 hover:text-amber-400 light:hover:text-amber-600 p-1"
                title="Modifica libro"
                aria-label="Modifica libro"
              >
                <BookMarked size={18} />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-500 light:text-stone-400 hover:text-red-400 light:hover:text-red-600 p-1"
                title="Elimina libro"
                aria-label="Elimina libro"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          <div className="mt-2">
            <StarRating value={book.rating} onChange={handleRatingChange} size={20} />
          </div>

          <div className="mt-auto flex items-center gap-2 pt-3 flex-wrap">
            <select
              value={book.status}
              onChange={(e) => handleStatusChange(e.target.value as Book['status'])}
              className={`text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer outline-none ${STATUS_COLORS[book.status]}`}
            >
              <option value="reading" className="bg-stone-900 light:bg-white text-stone-100 light:text-stone-900">In lettura</option>
              <option value="completed" className="bg-stone-900 light:bg-white text-stone-100 light:text-stone-900">Completato</option>
              <option value="want" className="bg-stone-900 light:bg-white text-stone-100 light:text-stone-900">Da leggere</option>
            </select>
            {book.read_at ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 light:text-emerald-700 bg-emerald-500/10 light:bg-emerald-50 border border-emerald-500/30 light:border-emerald-300/60 rounded-full px-2.5 py-1">
                <Calendar size={11} />
                {new Date(book.read_at).toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-stone-500 light:text-stone-500 bg-stone-800/60 light:bg-stone-100 border border-stone-700 light:border-stone-200 rounded-full px-2.5 py-1">
                <Calendar size={11} />
                Nessuna data
              </span>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                displayCount > 0
                  ? 'border-amber-500/40 light:border-amber-300 text-amber-300 light:text-amber-800 bg-amber-500/10 light:bg-amber-50 hover:bg-amber-500/20 light:hover:bg-amber-100'
                  : 'border-stone-600 light:border-stone-300 text-stone-300 light:text-stone-700 hover:bg-stone-700/50 light:hover:bg-stone-100'
              } ${expanded ? 'ring-1 ring-amber-500/40 light:ring-amber-400' : ''}`}
              title={
                displayCount > 0
                  ? `${displayCount} ${displayCount === 1 ? 'nota' : 'note'} (clicca per ${expanded ? 'chiudere' : 'aprire'})`
                  : 'Note (clicca per aggiungere note)'
              }
            >
              <StickyNote size={14} className={displayCount > 0 ? 'text-amber-400 light:text-amber-600' : 'text-stone-400 light:text-stone-500'} />
              <span>
                {displayCount === 0
                  ? 'Note'
                  : displayCount === 1
                  ? '1 nota'
                  : `${displayCount} note`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-stone-700 light:border-stone-200 px-4 py-3 bg-stone-900/40 light:bg-stone-50/70">
          <div className="flex items-center gap-2 mb-3">
            <StickyNote size={16} className="text-amber-400 light:text-amber-600" />
            <span className="text-sm font-medium text-stone-200 light:text-stone-800">Le mie note</span>
          </div>

          <div className="space-y-2 mb-3">
            {loadingNotes ? (
              <div className="flex items-center gap-2 text-stone-500 light:text-stone-500 text-sm py-2">
                <Loader2 size={16} className="animate-spin text-amber-400 light:text-amber-600" />
                Caricamento note...
              </div>
            ) : (!notes || notes.length === 0) ? (
              <p className="text-stone-500 light:text-stone-500 text-sm italic">Nessuna nota. Aggiungi la prima!</p>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="group/note bg-stone-800/60 light:bg-white rounded-lg p-3 border border-stone-700 light:border-stone-200 shadow-xs"
                >
                  {editingNoteId === note.id ? (
                    <div>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full bg-stone-900 light:bg-white border border-stone-600 light:border-stone-300 rounded-md p-2 text-sm text-stone-100 light:text-stone-900 focus:outline-none focus:border-amber-500/50 resize-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleUpdateNote(note.id)}
                          className="text-xs px-3 py-1 bg-amber-500 text-stone-900 font-medium rounded-md hover:bg-amber-400 cursor-pointer"
                        >
                          Salva
                        </button>
                        <button
                          onClick={() => {
                            setEditingNoteId(null);
                            setEditContent('');
                          }}
                          className="text-xs px-3 py-1 text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900 cursor-pointer"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-stone-200 light:text-stone-800 whitespace-pre-wrap break-words">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-stone-500 light:text-stone-400">
                          {new Date(note.created_at).toLocaleDateString('it-IT', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <div className="flex gap-2 opacity-0 group-hover/note:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingNoteId(note.id);
                              setEditContent(note.content);
                            }}
                            className="text-xs text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900 cursor-pointer"
                          >
                            Modifica
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-xs text-stone-400 light:text-stone-600 hover:text-red-400 cursor-pointer"
                          >
                            Elimina
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
              placeholder="Aggiungi una nota per ricordare cosa hai letto..."
              className="flex-1 bg-stone-900/60 light:bg-white border border-stone-700 light:border-stone-300 rounded-lg p-2.5 text-sm text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500/50 resize-none shadow-xs"
            />
            <button
              onClick={handleAddNote}
              disabled={savingNote || !newNote.trim()}
              className="self-end p-2.5 bg-amber-500/10 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 text-amber-400 light:text-amber-800 rounded-lg hover:bg-amber-500/20 light:hover:bg-amber-200/80 disabled:opacity-30 transition-colors cursor-pointer"
            >
              {savingNote ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-stone-800 light:bg-white rounded-xl border border-stone-700 light:border-stone-200 p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-serif text-lg font-semibold text-stone-100 light:text-stone-900">Elimina libro</h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-stone-500 light:text-stone-400 hover:text-stone-300 light:hover:text-stone-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-stone-400 light:text-stone-600 text-sm mb-6 leading-relaxed">
              Vuoi davvero eliminare "{book.title}"? Verranno cancellate anche tutte le note
              associate. Questa azione non può essere annullata.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 px-4 border border-stone-600 light:border-stone-300 text-stone-300 light:text-stone-700 rounded-lg hover:bg-stone-700/50 light:hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={handleDeleteBook}
                className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-400 text-white font-medium rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {showCoverModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setShowCoverModal(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-stone-700 light:border-stone-200 bg-stone-800 light:bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-stone-700 light:border-stone-200 p-4">
              <h3 className="font-serif text-lg font-semibold text-stone-100 light:text-stone-900">Copertina</h3>
              <button
                onClick={() => setShowCoverModal(false)}
                className="text-stone-400 light:text-stone-500 transition hover:text-stone-200 light:hover:text-stone-800 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex h-36 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-700 light:border-stone-200 bg-stone-900 light:bg-stone-100 shadow-inner">
                  {coverInput.trim() ? (
                    <img
                      src={coverInput.trim()}
                      alt="Anteprima"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : (
                    <BookMarked size={42} className="text-stone-600 light:text-stone-400" />
                  )}
                  <ImageOff size={28} className="hidden text-stone-600 light:text-stone-400" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-stone-300 light:text-stone-700">
                      URL immagine
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        setAutoFetchingCover(true);
                        const found = await fetchBookCover(book.title, book.author);
                        if (found) setCoverInput(found);
                        setAutoFetchingCover(false);
                      }}
                      disabled={autoFetchingCover}
                      className="flex items-center gap-1 text-xs text-amber-400 light:text-amber-700 hover:text-amber-300 light:hover:text-amber-800 disabled:opacity-40 font-medium px-2 py-0.5 rounded bg-amber-500/10 light:bg-amber-50 hover:bg-amber-500/20 light:hover:bg-amber-100 border border-amber-500/30 light:border-amber-300 transition-colors cursor-pointer"
                      title="Cerca automaticamente la copertina di questo libro"
                    >
                      {autoFetchingCover ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      <span>
                        {autoFetchingCover ? 'Ricerca...' : 'Cerca in automatico'}
                      </span>
                    </button>
                  </div>
                  <div className="relative">
                    <Link2
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 light:text-stone-400"
                    />
                    <input
                      type="url"
                      value={coverInput}
                      onChange={(e) => setCoverInput(e.target.value)}
                      className="w-full rounded-lg border border-stone-700 light:border-stone-300 bg-stone-900/60 light:bg-stone-50 py-2.5 pl-10 pr-3 text-sm text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      placeholder="https://..."
                    />
                  </div>
                  <p className="mt-2 text-xs text-stone-500 light:text-stone-500">
                    Incolla l'URL diretto di un'immagine. Lascia vuoto per rimuovere la copertina.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-shrink-0 gap-3 border-t border-stone-700 light:border-stone-200 bg-stone-800 light:bg-stone-50 p-4">
              <button
                type="button"
                onClick={() => {
                  setShowCoverModal(false);
                  setCoverInput('');
                }}
                className="flex-1 cursor-pointer rounded-lg border border-stone-600 light:border-stone-300 px-4 py-2.5 text-stone-300 light:text-stone-700 transition hover:bg-stone-700/60 light:hover:bg-stone-200/70 font-semibold"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSaveCover}
                disabled={savingCover}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 font-medium text-stone-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingCover && <Loader2 size={18} className="animate-spin" />}
                {savingCover ? 'Salvataggio...' : 'Modifica'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
