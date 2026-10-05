import { useEffect, useState } from 'react';
import { Trash2, Plus, Loader2, StickyNote, X, BookMarked, Link2, ImageOff, Calendar } from 'lucide-react';
import type { Book, Note } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { StarRating } from './StarRating';

const STATUS_COLORS: Record<Book['status'], string> = {
  reading: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  want: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
};

export function BookCard({
  book,
  onUpdate,
  onDelete,
  onEdit,
}: {
  book: Book;
  onUpdate: (book: Book) => void;
  onDelete: (id: string) => void;
  onEdit: (book: Book) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverInput, setCoverInput] = useState('');
  const [savingCover, setSavingCover] = useState(false);

  const loadNotes = async () => {
    setLoadingNotes(true);
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('book_id', book.id)
      .order('created_at', { ascending: false });
    const userNotes = (data ?? []).filter((n) => !n.content.startsWith('__READ_AT__:'));
    setNotes(userNotes);
    setLoadingNotes(false);
  };

  useEffect(() => {
    if (expanded && notes.length === 0 && !loadingNotes) {
      loadNotes();
    }
  }, [expanded]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const { data } = await supabase
      .from('notes')
      .insert({ book_id: book.id, content: newNote.trim() })
      .select()
      .single();
    if (data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote('');
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
      setNotes((prev) => prev.map((n) => (n.id === id ? data : n)));
    }
    setEditingNoteId(null);
    setEditContent('');
  };

  const handleDeleteNote = async (id: string) => {
    await supabase.from('notes').delete().eq('id', id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleStatusChange = async (status: Book['status']) => {
    const { data } = await supabase
      .from('books')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', book.id)
      .select()
      .single();
    if (data) onUpdate(data);
  };

  const handleRatingChange = async (rating: number) => {
    const { data } = await supabase
      .from('books')
      .update({ rating, updated_at: new Date().toISOString() })
      .eq('id', book.id)
      .select()
      .single();
    if (data) onUpdate(data);
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
    if (updated) onUpdate(updated);
    setSavingCover(false);
    setShowCoverModal(false);
    setCoverInput('');
  };

  const openCoverModal = () => {
    setCoverInput(book.cover_url ?? '');
    setShowCoverModal(true);
  };

  const handleDeleteBook = async () => {
    await supabase.from('books').delete().eq('id', book.id);
    onDelete(book.id);
  };

  return (
    <div className="group bg-stone-800/60 backdrop-blur-sm rounded-xl border border-stone-700 overflow-hidden transition-all hover:border-stone-600">
      <div className="flex gap-4 p-4">
        <div className="relative flex-shrink-0 w-24 h-36 rounded-lg overflow-hidden bg-stone-900 flex items-center justify-center shadow-lg group/cover">
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
            <BookMarked size={32} className="text-stone-600" />
          )}
          <ImageOff size={28} className="text-stone-600 hidden" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-serif text-lg font-semibold text-stone-100 truncate">
                {book.title}
              </h3>
              <p className="text-stone-400 text-sm mt-0.5">{book.author}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onEdit(book)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-500 hover:text-amber-400 p-1"
                title="Modifica libro"
                aria-label="Modifica libro"
              >
                <BookMarked size={18} />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-500 hover:text-red-400 p-1"
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
              <option value="reading">In lettura</option>
              <option value="completed">Completato</option>
              <option value="want">Da leggere</option>
            </select>
            {book.read_at ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2.5 py-1">
                <Calendar size={11} />
                {new Date(book.read_at).toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-stone-500 bg-stone-800/60 border border-stone-700 rounded-full px-2.5 py-1">
                <Calendar size={11} />
                Nessuna data
              </span>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-stone-600 text-stone-300 hover:bg-stone-700/50 transition-colors"
            >
              <StickyNote size={14} />
              {notes.length > 0 ? `${notes.length} note` : 'Note'}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-stone-700 px-4 py-3 bg-stone-900/40">
          <div className="flex items-center gap-2 mb-3">
            <StickyNote size={16} className="text-amber-400" />
            <span className="text-sm font-medium text-stone-200">Le mie note</span>
          </div>

          <div className="space-y-2 mb-3">
            {loadingNotes ? (
              <div className="flex items-center gap-2 text-stone-500 text-sm">
                <Loader2 size={16} className="animate-spin" />
                Caricamento...
              </div>
            ) : notes.length === 0 ? (
              <p className="text-stone-500 text-sm italic">Nessuna nota. Aggiungi la prima!</p>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="group/note bg-stone-800/60 rounded-lg p-3 border border-stone-700"
                >
                  {editingNoteId === note.id ? (
                    <div>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full bg-stone-900 border border-stone-600 rounded-md p-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500/50 resize-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleUpdateNote(note.id)}
                          className="text-xs px-3 py-1 bg-amber-500 text-stone-900 font-medium rounded-md hover:bg-amber-400"
                        >
                          Salva
                        </button>
                        <button
                          onClick={() => {
                            setEditingNoteId(null);
                            setEditContent('');
                          }}
                          className="text-xs px-3 py-1 text-stone-400 hover:text-stone-200"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-stone-200 whitespace-pre-wrap break-words">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-stone-500">
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
                            className="text-xs text-stone-400 hover:text-stone-200"
                          >
                            Modifica
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-xs text-stone-400 hover:text-red-400"
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
              className="flex-1 bg-stone-900/60 border border-stone-700 rounded-lg p-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 resize-none"
            />
            <button
              onClick={handleAddNote}
              disabled={savingNote || !newNote.trim()}
              className="self-end p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 disabled:opacity-30 transition-colors"
            >
              {savingNote ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-stone-800 rounded-xl border border-stone-700 p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-serif text-lg font-semibold text-stone-100">Elimina libro</h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-stone-500 hover:text-stone-300"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-stone-400 text-sm mb-6">
              Vuoi davvero eliminare "{book.title}"? Verranno cancellate anche tutte le note
              associate. Questa azione non può essere annullata.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 px-4 border border-stone-600 text-stone-300 rounded-lg hover:bg-stone-700/50 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleDeleteBook}
                className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-400 text-white font-medium rounded-lg transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {showCoverModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowCoverModal(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-stone-700 bg-stone-800 shadow-2xl"
            style={{ display: 'flex', maxHeight: '90vh', width: '100%', maxWidth: 440, flexDirection: 'column', overflow: 'hidden', borderRadius: 18, border: '1px solid rgba(68,64,60,1)', background: '#1c1917', boxShadow: '0 25px 80px rgba(0,0,0,0.45)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-stone-700 p-4">
              <h3 className="font-serif text-lg font-semibold text-stone-100">Copertina</h3>
              <button
                onClick={() => setShowCoverModal(false)}
                className="text-stone-400 transition hover:text-stone-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex h-36 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-700 bg-stone-900 shadow-inner">
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
                    <BookMarked size={42} className="text-stone-600" />
                  )}
                  <ImageOff size={28} className="hidden text-stone-600" />
                </div>

                <div className="flex-1">
                  <label className="mb-2 block text-sm font-medium text-stone-300">
                    URL immagine
                  </label>
                  <div className="relative">
                    <Link2
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"
                    />
                    <input
                      type="url"
                      value={coverInput}
                      onChange={(e) => setCoverInput(e.target.value)}
                      className="w-full rounded-lg border border-stone-700 bg-stone-900/60 py-2.5 pl-10 pr-3 text-sm text-stone-100 placeholder-stone-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      placeholder="https://..."
                    />
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    Incolla l'URL diretto di un'immagine. Lascia vuoto per rimuovere la copertina.
                  </p>
                </div>
              </div>
            </div>

            <div
              className="flex flex-shrink-0 gap-3 border-t border-stone-700 bg-stone-800 p-4"
              style={{ display: 'flex', gap: 12, borderTop: '1px solid rgba(68,64,60,1)', background: '#1c1917', padding: '1rem', flexShrink: 0 }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowCoverModal(false);
                  setCoverInput('');
                }}
                className="flex-1 cursor-pointer rounded-lg border border-stone-600 px-4 py-2.5 text-stone-300 transition hover:bg-stone-700/60"
                style={{ flex: 1, borderRadius: 10, border: '1px solid rgba(87,83,78,1)', background: 'transparent', color: '#d6d3d1', padding: '0.8rem 1rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSaveCover}
                disabled={savingCover}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 font-medium text-stone-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-amber-500"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, border: 'none', background: '#f59e0b', color: '#1c1917', padding: '0.8rem 1rem', fontWeight: 700, cursor: 'pointer', opacity: savingCover ? 0.6 : 1 }}
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
