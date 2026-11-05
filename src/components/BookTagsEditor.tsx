import { useState } from 'react';
import { Tag, Plus, X } from 'lucide-react';

const SUGGESTED_TAGS = [
  // Generi
  'Romance',
  'Dark romance',
  'Romantasy',
  'Fantasy',
  'Thriller',
  'Giallo',
  'Storico',
  'Young adult',
  'Fantascienza',
  'Contemporary romance',
  'Billionaire romance',
  'Sports romance',
  'Romcom',
  // Trope
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
  'Brother\'s best friend',
  'Found family',
  'Small town',
  'Mafia romance',
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
  const t = raw.trim().replace(/\s+/g, ' ').slice(0, 30);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

export function BookTagsEditor({ tags, onChange }: BookTagsEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const hasTag = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());

  const addTag = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t || hasTag(t)) return;
    onChange([...tags, t]);
    setDraft('');
  };

  const removeTag = (t: string) => onChange(tags.filter((x) => x !== t));

  const suggestions = SUGGESTED_TAGS.filter((s) => !hasTag(s));

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
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 light:bg-amber-50 text-amber-300 light:text-amber-800 border border-amber-500/25 light:border-amber-200"
            >
              {t}
              {editing && (
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="text-amber-300/70 hover:text-red-400 cursor-pointer"
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
          <p className="text-xs text-stone-500 light:text-stone-500">
            Nessun tag. Aggiungi il genere o i trope (es. Romance, Enemies to lovers).
          </p>
        )
      )}

      {editing && (
        <div className="space-y-2.5">
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
              maxLength={30}
              placeholder="Scrivi un tag personalizzato..."
              className="flex-1 min-w-0 px-3 py-1.5 bg-stone-950/50 light:bg-white border border-stone-800 light:border-stone-300/80 rounded-lg text-stone-100 light:text-stone-900 placeholder-stone-500 focus:outline-none focus:border-amber-500 text-base sm:text-xs"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-stone-950 text-xs font-bold disabled:opacity-40 cursor-pointer"
            >
              Aggiungi
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addTag(s)}
                className="text-[11px] px-2 py-0.5 rounded-full bg-stone-800/80 light:bg-stone-100 text-stone-300 light:text-stone-700 border border-stone-700/80 light:border-stone-300 hover:border-amber-500/50 hover:text-amber-300 light:hover:text-amber-700 cursor-pointer transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

