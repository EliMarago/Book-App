import { useState, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileText,
  Target,
  BookOpen,
} from 'lucide-react';
import { supabase, type Book } from '@/lib/supabase';
import type { ReadingGoals } from '@/hooks/useReadingGoals';
import {
  saveBookDate,
  saveBookPages,
  saveBookReadPages,
  syncBookDateToSupabase,
  syncBookPagesToSupabase,
  syncBookReadPagesToSupabase,
} from '@/lib/bookDates';

interface BackupManagerProps {
  books: Book[];
  goals: ReadingGoals;
  onRestoreCompleted: () => void;
}

interface BackupFilePayload {
  app?: string;
  version?: number;
  exported_at?: string;
  reading_goals?: ReadingGoals;
  books: Array<{
    id?: string;
    title: string;
    author: string;
    cover_url?: string | null;
    rating?: number;
    status?: 'reading' | 'completed' | 'want';
    read_at?: string | null;
    pages?: number | null;
    read_pages?: number | null;
    created_at?: string;
    notes?: Array<{
      content: string;
      created_at?: string;
    }>;
  }>;
}

export function BackupManager({ books, goals, onRestoreCompleted }: BackupManagerProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<string | null>(null);
  const [previewBackup, setPreviewBackup] = useState<{
    fileName: string;
    fileSize: string;
    payload: BackupFilePayload;
    totalNotes: number;
  } | null>(null);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. ESPORTA BACKUP IN FORMATO JSON
  const handleExportBackup = async () => {
    setIsExporting(true);
    setNotification(null);

    try {
      // Recupera tutte le note reali dell'utente dal database Supabase
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('id, book_id, content, created_at');

      if (notesError) {
        console.warn('Avviso recupero note per backup:', notesError);
      }

      // Raggruppa le note utente (escludendo i metadati di sistema tipo __READ_AT__)
      const notesByBook: Record<string, Array<{ content: string; created_at: string }>> = {};
      (notesData || []).forEach((note) => {
        if (
          !note.content.startsWith('__READ_AT__:') &&
          !note.content.startsWith('__PAGES__:') &&
          !note.content.startsWith('__READ_PAGES__:')
        ) {
          if (!notesByBook[note.book_id]) {
            notesByBook[note.book_id] = [];
          }
          notesByBook[note.book_id].push({
            content: note.content,
            created_at: note.created_at,
          });
        }
      });

      // Costruisci il payload completo del backup
      const backupData: BackupFilePayload = {
        app: 'Bookshelf',
        version: 1,
        exported_at: new Date().toISOString(),
        reading_goals: goals,
        books: books.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          cover_url: b.cover_url || null,
          rating: b.rating,
          status: b.status,
          read_at: b.read_at || null,
          pages: b.pages || null,
          read_pages: b.read_pages !== undefined ? b.read_pages : null,
          created_at: b.created_at,
          notes: notesByBook[b.id] || [],
        })),
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Nome file con data odierna YYYY-MM-DD
      const datePart = new Date().toISOString().split('T')[0];
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookshelf-backup-${datePart}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setNotification({
        type: 'success',
        message: `Backup esportato con successo! (${books.length} libri inclusi)`,
      });
    } catch (err) {
      console.error('Errore durante esportazione backup:', err);
      setNotification({
        type: 'error',
        message: "Si è verificato un errore durante l'esportazione del backup.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // 2. SELEZIONE FILE JSON PER ANTEPRIMA
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input per permettere di riselezionare lo stesso file
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Riconosci il formato (oggetto con .books oppure array di libri)
        let payload: BackupFilePayload;
        if (Array.isArray(parsed)) {
          payload = { books: parsed };
        } else if (parsed && Array.isArray(parsed.books)) {
          payload = parsed;
        } else {
          throw new Error('Il file JSON non contiene una lista valida di libri.');
        }

        if (payload.books.length === 0) {
          throw new Error('Il file JSON selezionato non contiene alcun libro.');
        }

        // Conteggio totale note presenti nel file
        let totalNotes = 0;
        payload.books.forEach((b) => {
          if (Array.isArray(b.notes)) totalNotes += b.notes.length;
        });

        const sizeKb = (file.size / 1024).toFixed(1) + ' KB';

        setPreviewBackup({
          fileName: file.name,
          fileSize: sizeKb,
          payload,
          totalNotes,
        });
      } catch (err: any) {
        console.error('Errore lettura JSON:', err);
        setNotification({
          type: 'error',
          message: err.message || 'File JSON non valido o corrotto.',
        });
      }
    };

    reader.readAsText(file);
  };

  // 3. ESECUZIONE DEL RIPRISTINO
  const handleConfirmRestore = async () => {
    if (!previewBackup) return;

    setIsRestoring(true);
    setRestoreProgress('Inizializzazione ripristino...');
    setNotification(null);

    const { payload } = previewBackup;
    let booksCount = 0;
    let notesCount = 0;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Sessione utente non trovata. Effettua nuovamente il login.');
      }

      // Recupera i libri attuali dell'utente per evitare duplicati
      const { data: currentBooks } = await supabase.from('books').select('id, title, author');
      const existingBooks = currentBooks || [];

      // Mappa per associare titolo+autore (normalizzato) all'ID esistente
      const existingMap = new Map<string, string>();
      existingBooks.forEach((b) => {
        const key = `${b.title.trim().toLowerCase()}:::${b.author.trim().toLowerCase()}`;
        existingMap.set(key, b.id);
      });

      // Ripristino libri uno a uno con aggiornamento stato di progresso
      for (let i = 0; i < payload.books.length; i++) {
        const b = payload.books[i];
        setRestoreProgress(`Ripristino libro ${i + 1} di ${payload.books.length}: "${b.title}"...`);

        const key = `${b.title.trim().toLowerCase()}:::${b.author.trim().toLowerCase()}`;
        let targetBookId = existingMap.get(key) || (b.id && b.id.length > 20 ? b.id : undefined);

        const bookPayload = {
          user_id: user.id,
          title: b.title || 'Senza titolo',
          author: b.author || 'Sconosciuto',
          cover_url: b.cover_url || null,
          rating: typeof b.rating === 'number' ? b.rating : 0,
          status: b.status && ['reading', 'completed', 'want'].includes(b.status) ? b.status : 'want',
          read_at: b.read_at || null,
          pages: b.pages !== undefined && b.pages !== null ? Number(b.pages) : null,
          read_pages: b.read_pages !== undefined && b.read_pages !== null ? Number(b.read_pages) : 0,
          updated_at: new Date().toISOString(),
        };

        if (targetBookId && existingBooks.some((eb) => eb.id === targetBookId)) {
          // Aggiorna libro esistente
          await supabase.from('books').update(bookPayload).eq('id', targetBookId);
        } else {
          // Inserisci nuovo libro
          const { data: inserted, error: insertErr } = await supabase
            .from('books')
            .insert({ ...bookPayload, ...(b.id ? { id: b.id } : {}) })
            .select('id')
            .single();

          if (insertErr || !inserted) {
            // Se fallisce l'ID personalizzato, ritenta lasciando generare l'ID a Supabase
            const { data: retryInserted } = await supabase
              .from('books')
              .insert(bookPayload)
              .select('id')
              .single();

            targetBookId = retryInserted?.id;
          } else {
            targetBookId = inserted.id;
          }
        }

        if (targetBookId) {
          booksCount++;
          // Sincronizza cache locale e note di sistema
          saveBookDate(targetBookId, b.read_at || null);
          saveBookPages(targetBookId, b.pages || null);
          saveBookReadPages(targetBookId, b.read_pages || null);
          syncBookDateToSupabase(targetBookId, b.read_at || null).catch(() => { });
          syncBookPagesToSupabase(targetBookId, b.pages || null).catch(() => { });
          syncBookReadPagesToSupabase(targetBookId, b.read_pages || null).catch(() => { });

          // Ripristina eventuali note associate a questo libro
          if (Array.isArray(b.notes) && b.notes.length > 0) {
            for (const note of b.notes) {
              if (note.content && note.content.trim()) {
                await supabase.from('notes').insert({
                  book_id: targetBookId,
                  user_id: user.id,
                  content: note.content,
                  ...(note.created_at ? { created_at: note.created_at } : {}),
                });
                notesCount++;
              }
            }
          }
        }
      }

      // Ripristina gli obiettivi di lettura se presenti nel backup
      if (payload.reading_goals && typeof payload.reading_goals === 'object') {
        setRestoreProgress('Ripristino obiettivi di lettura annuali...');
        const mergedGoals = { ...goals, ...payload.reading_goals };
        await supabase.auth.updateUser({
          data: { reading_goals: mergedGoals },
        });
        localStorage.setItem('reading_goals', JSON.stringify(mergedGoals));
      }

      setNotification({
        type: 'success',
        message: `Backup ripristinato con successo! ${booksCount} libri e ${notesCount} note importati.`,
      });

      setPreviewBackup(null);
      onRestoreCompleted();
    } catch (err: any) {
      console.error('Errore durante il ripristino del backup:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Si è verificato un errore durante il ripristino del backup.',
      });
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  };

  return (
    <div className="bg-stone-850/60 light:bg-white border border-stone-800 light:border-stone-200/90 rounded-2xl p-5 sm:p-6 shadow-sm transition-all">
      {/* Header contenitore */}
      <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row pb-4 border-b border-stone-800/80 light:border-stone-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 light:bg-amber-50 border border-amber-500/20 light:border-amber-200 flex items-center justify-center text-amber-400 light:text-amber-700 shrink-0 shadow-inner">
            <Database size={20} />
          </div>
          <div>
            <h3 className="font-serif text-base sm:text-lg font-bold text-stone-100 light:text-stone-900 leading-tight">
              Backup e Ripristino Dati
            </h3>
            <p className="text-xs text-stone-400 light:text-stone-600 mt-0.5">
              Esporta una copia sicura dei tuoi libri e note in formato JSON o ripristinala su qualsiasi dispositivo
            </p>
          </div>
        </div>

        {/* Pulsanti Azione Esporta / Ripristina */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Pulsante Esporta */}
          <button
            onClick={handleExportBackup}
            disabled={isExporting || isRestoring || books.length === 0}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-stone-800/90 light:bg-stone-100 hover:bg-stone-750 light:hover:bg-stone-200/80 text-stone-200 light:text-stone-800 border border-stone-700/80 light:border-stone-300 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-xs"
            title="Scarica il file JSON con tutti i tuoi dati"
          >
            {isExporting ? (
              <Loader2 size={14} className="animate-spin text-amber-400" />
            ) : (
              <Download size={14} className="text-amber-400 light:text-amber-600" />
            )}
            <span>{isExporting ? 'Esportazione...' : 'Esporta JSON'}</span>
          </button>

          {/* Pulsante Ripristina con input file nascosto */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
            id="backup-file-input"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isExporting || isRestoring}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-sm shadow-amber-500/10"
            title="Carica un file JSON di backup precedente"
          >
            {isRestoring ? (
              <Loader2 size={14} className="animate-spin text-stone-950" />
            ) : (
              <Upload size={14} />
            )}
            <span>{isRestoring ? 'Ripristino...' : 'Ripristina JSON'}</span>
          </button>
        </div>
      </div>

      {/* Notifica di Esito (Successo o Errore) */}
      {notification && (
        <div
          className={`mt-4 p-3 rounded-xl flex items-start gap-2.5 text-xs transition-all ${notification.type === 'success'
              ? 'bg-emerald-500/10 light:bg-emerald-50 border border-emerald-500/30 light:border-emerald-200 text-emerald-300 light:text-emerald-800'
              : 'bg-red-500/10 light:bg-red-50 border border-red-500/30 light:border-red-200 text-red-300 light:text-red-800'
            }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-400 light:text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={16} className="text-red-400 light:text-red-600 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 font-medium">{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-stone-400 hover:text-stone-200 light:hover:text-stone-800 cursor-pointer p-0.5"
            aria-label="Chiudi notifica"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Info riassuntive del backup */}
      <div className="mt-3.5 flex items-center gap-4 text-[11px] sm:text-xs text-stone-400 light:text-stone-500 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <BookOpen size={12} className="text-amber-400/80 light:text-amber-600" />
          {books.length} {books.length === 1 ? 'libro pronto per il backup' : 'libri pronti per il backup'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FileJson size={12} className="text-emerald-400/80 light:text-emerald-600" />
          Formato JSON compatibile e portabile
        </span>
        {Object.keys(goals).length > 0 && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Target size={12} className="text-amber-400/80 light:text-amber-600" />
              Obiettivi annuali inclusi
            </span>
          </>
        )}
      </div>

      {/* Modale di Anteprima e Conferma Ripristino */}
      {previewBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-stone-900 light:bg-white border border-stone-800 light:border-stone-200 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-stone-100 light:text-stone-900 font-serif font-bold text-lg">
                <FileJson size={20} className="text-amber-400 light:text-amber-600" />
                <span>Conferma Ripristino Backup</span>
              </div>
              <button
                onClick={() => !isRestoring && setPreviewBackup(null)}
                disabled={isRestoring}
                className="text-stone-400 hover:text-stone-200 light:hover:text-stone-800 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-stone-400 light:text-stone-600 leading-relaxed">
              Hai selezionato il file di backup <strong className="text-stone-200 light:text-stone-800 font-semibold">{previewBackup.fileName}</strong> ({previewBackup.fileSize}).
            </p>

            {/* Riepilogo contenuti rilevati nel JSON */}
            <div className="bg-stone-850/80 light:bg-stone-50 border border-stone-800 light:border-stone-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-stone-300 light:text-stone-700">
                <span className="flex items-center gap-1.5">
                  <BookOpen size={13} className="text-amber-400 light:text-amber-600" />
                  Libri da importare:
                </span>
                <span className="font-bold text-stone-100 light:text-stone-900">
                  {previewBackup.payload.books.length}
                </span>
              </div>

              {previewBackup.totalNotes > 0 && (
                <div className="flex items-center justify-between text-stone-300 light:text-stone-700">
                  <span className="flex items-center gap-1.5">
                    <FileText size={13} className="text-emerald-400 light:text-emerald-600" />
                    Note da importare:
                  </span>
                  <span className="font-bold text-stone-100 light:text-stone-900">
                    {previewBackup.totalNotes}
                  </span>
                </div>
              )}

              {previewBackup.payload.reading_goals &&
                Object.keys(previewBackup.payload.reading_goals).length > 0 && (
                  <div className="flex items-center justify-between text-stone-300 light:text-stone-700">
                    <span className="flex items-center gap-1.5">
                      <Target size={13} className="text-amber-400 light:text-amber-600" />
                      Obiettivi di lettura:
                    </span>
                    <span className="font-bold text-stone-100 light:text-stone-900">
                      {Object.keys(previewBackup.payload.reading_goals).length} anni
                    </span>
                  </div>
                )}

              {previewBackup.payload.exported_at && (
                <div className="pt-2 border-t border-stone-750 light:border-stone-200/80 text-[11px] text-stone-500 light:text-stone-400">
                  Data creazione backup:{' '}
                  {new Date(previewBackup.payload.exported_at).toLocaleString('it-IT')}
                </div>
              )}
            </div>

            <div className="text-[11px] text-stone-400 light:text-stone-500 bg-amber-500/10 light:bg-amber-50 p-2.5 rounded-lg border border-amber-500/20 light:border-amber-200">
              💡 <strong>Nota:</strong> I libri con lo stesso titolo e autore verranno aggiornati mantenendo intatte le tue informazioni. I nuovi libri verranno aggiunti alla tua libreria.
            </div>

            {/* Progresso in tempo reale */}
            {isRestoring && restoreProgress && (
              <div className="flex items-center gap-2 text-xs text-amber-300 light:text-amber-700 py-1">
                <Loader2 size={14} className="animate-spin text-amber-400 light:text-amber-600 shrink-0" />
                <span className="truncate">{restoreProgress}</span>
              </div>
            )}

            {/* Azioni Modale */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewBackup(null)}
                disabled={isRestoring}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-stone-400 hover:text-stone-200 light:hover:text-stone-800 hover:bg-stone-800 light:hover:bg-stone-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shadow-md shadow-amber-500/20"
              >
                {isRestoring ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Ripristino in corso...</span>
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    <span>Conferma e Ripristina</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
