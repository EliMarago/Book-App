import { useState, useId } from 'react';
import {
  Download,
  Plus,
  Check,
  Trash2,
  BookPlus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import type { DownloadTodoItem } from '@/lib/downloadTodo';

interface DownloadTodoSectionProps {
  todos: DownloadTodoItem[];
  onAddTodo: (item: Omit<DownloadTodoItem, 'id' | 'createdAt'>) => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onClearCompleted: () => void;
  onAddToBookshelf: (item: { title: string; author?: string }) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

type FilterType = 'all' | 'pending' | 'completed';

export function DownloadTodoSection({
  todos,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onClearCompleted,
  onAddToBookshelf,
  isExpanded,
  onToggleExpand,
}: DownloadTodoSectionProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const titleInputId = useId();

  const pendingTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddTodo({
      title: title.trim(),
      author: author.trim() || undefined,
      note: note.trim() || undefined,
      completed: false,
    });

    setTitle('');
    setAuthor('');
    setNote('');
  };

  const filteredTodos = todos.filter((item) => {
    if (filter === 'pending' && item.completed) return false;
    if (filter === 'completed' && !item.completed) return false;

    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchAuthor = item.author?.toLowerCase().includes(q);
      const matchNote = item.note?.toLowerCase().includes(q);
      return matchTitle || matchAuthor || matchNote;
    }
    return true;
  });

  return (
    <div className="bg-stone-850/80 border border-stone-700/70 rounded-2xl overflow-hidden transition-all duration-300 shadow-xl shadow-black/20 mb-8 backdrop-blur-sm">
      {/* Header bar / Banner cliccabile per aprire/chiudere la sezione */}
      <div
        onClick={onToggleExpand}
        className="w-full px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-stone-800/40 transition-colors select-none"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Download size={18} />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2.5">
              <h2 className="font-serif text-lg font-bold text-stone-100 flex items-center gap-2">
                Libri da scaricare
              </h2>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 border border-stone-700">
                To-Do
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              {pendingTodos.length === 0
                ? 'Nessun libro in attesa di download'
                : `${pendingTodos.length} ${
                    pendingTodos.length === 1 ? 'libro' : 'libri'
                  } da scaricare o cercare`}
              {completedTodos.length > 0 && ` • ${completedTodos.length} già scaricati`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {pendingTodos.length > 0 && (
            <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {pendingTodos.length}
            </span>
          )}
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-stone-200 bg-stone-800/80 px-2.5 py-1.5 rounded-lg border border-stone-700/80 transition-colors"
          >
            <span>{isExpanded ? 'Nascondi' : 'Mostra'}</span>
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Contenuto espanso */}
      {isExpanded && (
        <div className="border-t border-stone-800 p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Form di aggiunta rapida */}
          <form
            onSubmit={handleSubmit}
            className="bg-stone-900/70 border border-stone-800 rounded-xl p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between text-xs text-stone-400 font-medium">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Sparkles size={14} />
                Aggiungi nuovo promemoria di download
              </span>
              <span className="text-stone-500 text-[11px]">Invio rapido con Invio</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5">
                <label htmlFor={titleInputId} className="sr-only">
                  Titolo del libro
                </label>
                <input
                  id={titleInputId}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titolo del libro *"
                  className="w-full px-3.5 py-2 text-sm bg-stone-800/80 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                  required
                />
              </div>

              <div className="sm:col-span-4">
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Autore (opzionale)"
                  className="w-full px-3.5 py-2 text-sm bg-stone-800/80 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                />
              </div>

              <div className="sm:col-span-3 flex gap-2">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Formato / Nota (es. epub)"
                  className="w-full px-3.5 py-2 text-sm bg-stone-800/80 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {/* Quick tags facoltativi per compilare la nota */}
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <span className="text-[11px] text-stone-500 mr-1">Tag rapidi:</span>
                {['epub', 'pdf', 'kindle', 'audiolibro'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setNote(tag)}
                    className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                      note === tag
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-stone-800/90 text-stone-400 border-stone-700 hover:text-stone-200'
                    }`}
                  >
                    +{tag}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={!title.trim()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-stone-900 font-semibold text-xs rounded-lg transition-all shadow cursor-pointer ml-auto"
              >
                <Plus size={16} />
                <span>Aggiungi alla lista</span>
              </button>
            </div>
          </form>

          {/* Barra di gestione filtri e ricerca */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Filtri stato */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-stone-700 text-stone-100 font-semibold'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/70'
                }`}
              >
                Tutti ({todos.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('pending')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filter === 'pending'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/70'
                }`}
              >
                Da scaricare ({pendingTodos.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('completed')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filter === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/70'
                }`}
              >
                Scaricati ({completedTodos.length})
              </button>
            </div>

            {/* Ricerca veloce nella lista to-do */}
            <div className="flex items-center gap-2">
              {todos.length > 4 && (
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500"
                  />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Cerca nella lista..."
                    className="pl-8 pr-3 py-1 text-xs bg-stone-900 border border-stone-800 rounded-lg text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500/40 w-36 sm:w-44"
                  />
                </div>
              )}

              {completedTodos.length > 0 && (
                <button
                  type="button"
                  onClick={onClearCompleted}
                  className="text-[11px] text-stone-500 hover:text-rose-400 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-rose-500/20 transition-all whitespace-nowrap cursor-pointer"
                  title="Elimina tutti gli elementi già scaricati"
                >
                  Pulisci scaricati
                </button>
              )}
            </div>
          </div>

          {/* Elenco To-do */}
          <div className="space-y-2">
            {filteredTodos.length === 0 ? (
              <div className="text-center py-8 px-4 bg-stone-900/40 border border-dashed border-stone-800 rounded-xl">
                <FileText size={28} className="mx-auto text-stone-600 mb-2" />
                <p className="text-xs font-medium text-stone-400">
                  {todos.length === 0
                    ? 'Nessun libro nella lista da scaricare'
                    : 'Nessun risultato con i filtri correnti'}
                </p>
                <p className="text-[11px] text-stone-500 mt-1">
                  {todos.length === 0
                    ? 'Usa il modulo sopra per aggiungere libri o ebook che desideri procurarti.'
                    : 'Prova a modificare la ricerca o il filtro selezionato.'}
                </p>
              </div>
            ) : (
              filteredTodos.map((item) => {
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
                  `${item.title} ${item.author || ''} libro download ${item.note || 'epub'}`
                )}`;

                return (
                  <div
                    key={item.id}
                    className={`group flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                      item.completed
                        ? 'bg-stone-900/40 border-stone-800/60 opacity-65'
                        : 'bg-stone-850/60 border-stone-750 hover:border-stone-650 hover:bg-stone-800/50'
                    }`}
                  >
                    {/* Checkbox + Testo */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onToggleTodo(item.id)}
                        className={`mt-0.5 sm:mt-0 w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                          item.completed
                            ? 'bg-emerald-500 text-stone-950 shadow-sm shadow-emerald-500/20'
                            : 'border-2 border-stone-600 hover:border-amber-400 bg-stone-900/80 text-transparent'
                        }`}
                        title={item.completed ? 'Segna come da scaricare' : 'Segna come scaricato'}
                      >
                        <Check size={13} strokeWidth={3} />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm font-semibold leading-tight break-words ${
                              item.completed
                                ? 'line-through text-stone-500'
                                : 'text-stone-100 group-hover:text-amber-200 transition-colors'
                            }`}
                          >
                            {item.title}
                          </span>

                          {item.completed && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 size={10} />
                              Scaricato
                            </span>
                          )}

                          {item.note && (
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 border border-stone-700">
                              {item.note}
                            </span>
                          )}
                        </div>

                        {item.author && (
                          <p
                            className={`text-xs mt-0.5 truncate ${
                              item.completed ? 'text-stone-600' : 'text-stone-400'
                            }`}
                          >
                            di {item.author}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Azioni rapide */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Cerca download su Google */}
                      <a
                        href={searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-stone-500 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
                        title="Cerca su Google per scaricare"
                      >
                        <ExternalLink size={15} />
                      </a>

                      {/* Aggiungi a Bookshelf */}
                      <button
                        type="button"
                        onClick={() =>
                          onAddToBookshelf({
                            title: item.title,
                            author: item.author,
                          })
                        }
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg text-amber-400/90 hover:text-amber-300 hover:bg-amber-500/15 border border-amber-500/20 transition-all cursor-pointer"
                        title="Aggiungi ufficialmente alla libreria"
                      >
                        <BookPlus size={14} />
                        <span className="hidden sm:inline">Aggiungi a Bookshelf</span>
                      </button>

                      {/* Elimina elemento */}
                      <button
                        type="button"
                        onClick={() => onDeleteTodo(item.id)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Rimuovi dalla lista"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
