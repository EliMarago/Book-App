import { useState } from 'react';
import { Tag, Plus, X } from 'lucide-react';

const GENRE_TAGS = [
  'Romance',
  'Dark romance',
  'Romantasy',
  'Contemporary romance',
  'Billionaire romance',
  'Sports romance',
  'Romcom',
  'Mafia romance',
  'Fantasy',
  'Thriller',
  'Giallo',
  'Storico',
  'Young adult',
  'Fantascienza',
];

const TROPE_TAGS = [
  'Enemies to lovers',
  'Friends to lovers',
  'Childhood friends to strangers to lovers',
  'Second chance romance',
  'Forced proximity',
  'Single mom',
  'Single dad',
  'He falls first',
  'Broken hero',
  'Slow burn',
  'Forbidden love',
  'Grumpy x sunshine',
  'Fake dating',
  'Marriage of convenience',
  'Only one bed',
  'Boss x employee',
  'Age gap',
  'Love triangle',
  'Secret baby',
  "Brother's best friend",
  'Found family',
  'Small town',
  'Morally grey',
  'Touch her and die',
  'Enemies with benefits',
  'Opposites attract',
  'Hurt/comfort',
];

interface BookTagsEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

function normalizeTag(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ').slice(0, 45);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

export function BookTagsEditor({ tags, onChange }: BookTagsEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [activeGroup, setActiveGroup] = useState<'trope' | 'genre'>('trope');

  const hasTag = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());

  const addTag = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t || hasTag(t)) return;
    onChange([...tags, t]);
    setDraft('');
  };

  const removeTag = (t: string) => onChange(tags.filter((x) => x !== t));

  const query = draft.trim().toLowerCase();
  const pool = query
    ? [...GENRE_TAGS, ...TROPE_TAGS].filter((s) => s.toLowerCase().includes(query))
    : activeGroup === 'genre'
      ? GENRE_TAGS
      : TROPE_TAGS;
  const suggestions = pool.filter((s) => !hasTag(s));

  return (
    <div className="bg-stone-850/90 light:bg-stone-50/90 border border-stone-800 light:border-stone-200/90 rounded-2xl p-3.5 sm:p-4 space-y-2.5 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700">
            <Tag size={13} />
          </div>
          <h4 className="font-serif font-bold text-sm sm:text-base text-stone-100 light:text-stone-900">
            Generi e trope
          </h4>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-stone-800/90 light:bg-stone-100 hover:bg-stone-750 light:hover:bg-stone-200 text-stone-300 light:text-stone-700 hover:text-amber-400 light:hover:text-amber-600 border border-stone-700/80 light:border-stone-300/80 transition-all cursor-pointer"
        >
          {editing ? (
            'Fatto'
          ) : (
            <>
              <Plus size={12} className="text-amber-400 light:text-amber-600" />
              <span>Aggiungi</span>
            </>
          )}
        </button>
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 light:bg-amber-50 text-amber-300 light:text-amber-800 border border-amber-500/25 light:border-amber-200"
            >
              {t}
              {editing && (
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="text-amber-300/70 light:text-amber-700/70 hover:text-red-400 light:hover:text-red-600 cursor-pointer ml-0.5"
                  aria-label={`Rimuovi ${t}`}
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        !editing && (
          <p className="text-xs text-stone-400 light:text-stone-500">
            Nessun tag. Aggiungi il genere o i trope (es. Romance, Enemies to lovers).
          </p>
        )
      )}

      {editing && (
        <div className="space-y-2.5 pt-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addTag(draft);
            }}
            className="flex gap-1.5"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={45}
              placeholder="Cerca o scrivi un tag personalizzato..."
              className="flex-1 min-w-0 px-3 py-1.5 bg-stone-950/50 light:bg-white border border-stone-800 light:border-stone-300/80 rounded-lg text-stone-100 light:text-stone-900 placeholder-stone-500 focus:outline-none focus:border-amber-500 text-base sm:text-xs"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-stone-950 text-xs font-bold disabled:opacity-40 cursor-pointer shrink-0"
            >
              Aggiungi
            </button>
          </form>

          {!query && (
            <div className="inline-flex p-0.5 rounded-lg bg-stone-900/90 light:bg-stone-200/70 border border-stone-800 light:border-stone-300/60">
              <button
                type="button"
                onClick={() => setActiveGroup('trope')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  activeGroup === 'trope'
                    ? 'bg-amber-500 text-stone-950'
                    : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
                }`}
              >
                Trope ({TROPE_TAGS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveGroup('genre')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  activeGroup === 'genre'
                    ? 'bg-amber-500 text-stone-950'
                    : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
                }`}
              >
                Generi ({GENRE_TAGS.length})
              </button>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addTag(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-stone-800/80 light:bg-white text-stone-300 light:text-stone-700 border border-stone-700/80 light:border-stone-300 hover:border-amber-500/50 hover:text-amber-300 light:hover:text-amber-700 active:scale-95 cursor-pointer transition-all"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
