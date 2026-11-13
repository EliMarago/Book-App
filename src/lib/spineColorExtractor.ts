import { optimizeCoverUrl } from './coverUrl';

export interface ExtractedSpinePalette {
  baseColor: string;
  twoToneCap?: string;
  textColor: string;
  authorColor: string;
  diamond?: boolean;
  isLight: boolean;
  /** True quando il colore è stato estratto direttamente dai pixel dell'immagine di copertina */
  fromCoverImage?: boolean;
}

const STORAGE_KEY = 'bookapp_cover_spine_palettes_v2';
const FAILED_STORAGE_KEY = 'bookapp_cover_spine_failed_v1';
const memoryCache = new Map<string, ExtractedSpinePalette>();
const failedCache = new Set<string>();
const pendingPromises = new Map<string, Promise<ExtractedSpinePalette | null>>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

// Carica la cache persistente da localStorage all'avvio
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, ExtractedSpinePalette>;
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.baseColor === 'string') {
        memoryCache.set(k, v);
      }
    }
  }
  const rawFailed = localStorage.getItem(FAILED_STORAGE_KEY);
  if (rawFailed) {
    const parsedFailed = JSON.parse(rawFailed);
    if (Array.isArray(parsedFailed)) {
      for (const u of parsedFailed) {
        if (typeof u === 'string') failedCache.add(u);
      }
    }
  }
} catch {
  // Ignora errori localStorage
}

function schedulePersistCache() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      // Mantiene al massimo 400 copertine in cache per leggerezza
      const entries = Array.from(memoryCache.entries()).slice(-400);
      const obj: Record<string, ExtractedSpinePalette> = {};
      for (const [k, v] of entries) {
        obj[k] = v;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      const failedArr = Array.from(failedCache).slice(-400);
      localStorage.setItem(FAILED_STORAGE_KEY, JSON.stringify(failedArr));
    } catch {
      // Ignora errori quota localStorage
    }
  }, 300);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const val = Math.round(l * 255);
    return [val, val, val];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, hn + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, hn) * 255);
  const b = Math.round(hue2rgb(p, q, hn - 1 / 3) * 255);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  );
}

/** Luminanza relativa WCAG (0 = nero, 1 = bianco) */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(lum1: number, lum2: number): number {
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Raffina il colore estratto dalla copertina per renderlo perfetto su un dorso cilindrico 3D opaco:
 * mantiene la tinta (hue) e il carattere chiaro/scuro della copertina reale, evitando però
 * il nero piatto #000000 o il bianco bruciato #ffffff che perderebbero le nervature 3D.
 */
function refineSpineBaseColor(r: number, g: number, b: number): [number, number, number] {
  const [h, s, l] = rgbToHsl(r, g, b);
  // Mantiene la saturazione viva ma vellutata (non fluorescente)
  const refinedS = s < 0.08 ? s : Math.min(0.68, Math.max(0.16, s * 0.92));
  // Evita estremi assoluti 0% o 100% così le ombre cilindriche e le nervature si vedono sempre bene
  const refinedL = Math.min(0.86, Math.max(0.16, l));
  return hslToRgb(h, refinedS, refinedL);
}

/**
 * Analizza i pixel della copertina su un mini-canvas (24x36) dando priorità
 * al bordo sinistro (che nei libri reali prosegue direttamente sul dorso) e
 * al colore di fondo dominante della copertina.
 */
function analyzeCoverPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  deterministicSeed: number
): ExtractedSpinePalette {
  interface Bucket {
    count: number;
    weight: number;
    rSum: number;
    gSum: number;
    bSum: number;
  }

  const buckets = new Map<string, Bucket>();
  const topBottomBuckets = new Map<string, Bucket>();

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      if (a < 180) continue;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Ignora eventuali bordini bianchi artificiali di scansione/ritaglio lungo il margine
      if (x <= 2 && r > 246 && g > 246 && b > 246) continue;

      // Quantizzazione in bucket (step di 24 su 255) per raggruppare tonalità simili
      const qr = Math.floor(r / 24);
      const qg = Math.floor(g / 24);
      const qb = Math.floor(b / 24);
      const key = `${qr}-${qg}-${qb}`;

      // Il bordo sinistro (x <= 6) e i margini esterni hanno peso maggiore perché rappresentano il colore del dorso/fondo
      const isLeftSpineEdge = x >= 1 && x <= Math.max(4, Math.floor(width * 0.25));
      const isOuterFrame =
        y <= Math.floor(height * 0.18) ||
        y >= Math.floor(height * 0.82) ||
        x >= Math.floor(width * 0.82);

      const [, sat] = rgbToHsl(r, g, b);
      // Piccolo bonus ai colori cromatici rispetto al grigio puro dei testi
      const chromaBonus = sat > 0.18 ? 1.35 : 1.0;
      const pixelWeight = (isLeftSpineEdge ? 3.2 : isOuterFrame ? 1.8 : 0.9) * chromaBonus;

      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
        existing.weight += pixelWeight;
        existing.rSum += r * pixelWeight;
        existing.gSum += g * pixelWeight;
        existing.bSum += b * pixelWeight;
      } else {
        buckets.set(key, {
          count: 1,
          weight: pixelWeight,
          rSum: r * pixelWeight,
          gSum: g * pixelWeight,
          bSum: b * pixelWeight,
        });
      }

      // Raccoglie anche i colori di testa/piede per eventuale effetto bicolore o colore testo/accento
      if (y <= Math.floor(height * 0.2) || y >= Math.floor(height * 0.8)) {
        const tb = topBottomBuckets.get(key);
        if (tb) {
          tb.count += 1;
          tb.weight += 1;
          tb.rSum += r;
          tb.gSum += g;
          tb.bSum += b;
        } else {
          topBottomBuckets.set(key, { count: 1, weight: 1, rSum: r, gSum: g, bSum: b });
        }
      }
    }
  }

  const sorted = Array.from(buckets.values()).sort((a, b) => b.weight - a.weight);
  const primary = sorted[0] ?? { weight: 1, rSum: 85, gSum: 79, bSum: 75 };

  const rawR = primary.rSum / primary.weight;
  const rawG = primary.gSum / primary.weight;
  const rawB = primary.bSum / primary.weight;

  const [baseR, baseG, baseB] = refineSpineBaseColor(rawR, rawG, rawB);
  const baseColor = rgbToHex(baseR, baseG, baseB);
  const baseLum = getRelativeLuminance(baseR, baseG, baseB);
  const [baseH, baseS, baseL] = rgbToHsl(baseR, baseG, baseB);
  const isLight = baseLum >= 0.33;

  // Cerca nei bucket secondari un colore di accento della copertina (es. colore del titolo sulla copertina)
  let accentTextHex: string | null = null;
  let accentAuthorHex: string | null = null;

  for (let i = 1; i < Math.min(sorted.length, 8); i++) {
    const cand = sorted[i];
    const cr = cand.rSum / cand.weight;
    const cg = cand.gSum / cand.weight;
    const cb = cand.bSum / cand.weight;
    const candLum = getRelativeLuminance(cr, cg, cb);
    const contrast = getContrastRatio(baseLum, candLum);

    if (contrast >= 4.2) {
      const [ch, cs, cl] = rgbToHsl(cr, cg, cb);
      const adjustedL = isLight ? Math.min(0.26, cl) : Math.max(0.84, cl);
      const adjustedS = Math.min(0.65, Math.max(0.15, cs));
      const [tr, tg, tb] = hslToRgb(ch, adjustedS, adjustedL);
      const [ar, ag, ab] = hslToRgb(
        ch,
        adjustedS * 0.85,
        isLight ? Math.min(0.36, adjustedL + 0.08) : Math.max(0.72, adjustedL - 0.1)
      );
      accentTextHex = rgbToHex(tr, tg, tb);
      accentAuthorHex = rgbToHex(ar, ag, ab);
      break;
    }
  }

  // Fallback tipografico armonizzato con la tinta del dorso se l'accento non ha abbastanza contrasto
  if (!accentTextHex || !accentAuthorHex) {
    if (isLight) {
      const [tr, tg, tb] = hslToRgb(baseH, Math.min(0.48, baseS + 0.12), 0.16);
      const [ar, ag, ab] = hslToRgb(baseH, Math.min(0.42, baseS + 0.08), 0.28);
      accentTextHex = rgbToHex(tr, tg, tb);
      accentAuthorHex = rgbToHex(ar, ag, ab);
    } else {
      const [tr, tg, tb] = hslToRgb(baseH, Math.min(0.35, baseS * 0.6), 0.93);
      const [ar, ag, ab] = hslToRgb(baseH, Math.min(0.3, baseS * 0.5), 0.82);
      accentTextHex = rgbToHex(tr, tg, tb);
      accentAuthorHex = rgbToHex(ar, ag, ab);
    }
  }

  // Eventuale fascia bicolore (twoToneCap) se la copertina ha una banda superiore/inferiore ben distinta
  let twoToneCap: string | undefined;
  const tbSorted = Array.from(topBottomBuckets.values()).sort((a, b) => b.weight - a.weight);
  if (tbSorted.length > 0 && deterministicSeed % 5 === 0) {
    const topCand = tbSorted[0];
    const tr = topCand.rSum / topCand.weight;
    const tg = topCand.gSum / topCand.weight;
    const tb = topCand.bSum / topCand.weight;
    const colorDiff = Math.abs(tr - rawR) + Math.abs(tg - rawG) + Math.abs(tb - rawB);
    if (colorDiff > 65 && colorDiff < 260) {
      const [capR, capG, capB] = refineSpineBaseColor(tr, tg, tb);
      twoToneCap = rgbToHex(capR, capG, capB);
    }
  }

  // Mostra il piccolo rombo ornamentale ◇ sui dorsi chiari/pastello come nello screenshot
  const diamond = isLight && baseL > 0.52 && deterministicSeed % 3 === 0;

  return {
    baseColor,
    twoToneCap,
    textColor: accentTextHex,
    authorColor: accentAuthorHex,
    diamond,
    isLight,
    fromCoverImage: true,
  };
}

export function getCachedCoverSpinePalette(coverUrl?: string): ExtractedSpinePalette | null {
  if (!coverUrl) return null;
  return memoryCache.get(coverUrl) ?? null;
}

export function isCoverSpineExtractionSkipped(coverUrl?: string): boolean {
  if (!coverUrl) return true;
  return memoryCache.has(coverUrl) || failedCache.has(coverUrl);
}

/**
 * Estrae in modo asincrono il colore reale dominante della copertina tramite <canvas>.
 * Se l'immagine non supporta CORS, memorizza l'URL tra quelli non estraibili per non
 * riprovare ad ogni apertura dell'app.
 */
export function extractSpinePaletteFromCoverUrl(
  coverUrl: string,
  bookSeed = 0
): Promise<ExtractedSpinePalette | null> {
  if (!coverUrl) return Promise.resolve(null);

  const cached = memoryCache.get(coverUrl);
  if (cached) return Promise.resolve(cached);
  if (failedCache.has(coverUrl)) return Promise.resolve(null);

  const existingPromise = pendingPromises.get(coverUrl);
  if (existingPromise) return existingPromise;

  const promise = new Promise<ExtractedSpinePalette | null>((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    const thumbUrl = optimizeCoverUrl(coverUrl, 120);

    const cleanup = () => {
      pendingPromises.delete(coverUrl);
    };

    img.onload = () => {
      try {
        const w = 24;
        const h = 36;
        if (!sharedCanvas) {
          sharedCanvas = document.createElement('canvas');
          sharedCanvas.width = w;
          sharedCanvas.height = h;
          sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
        }
        if (!sharedCtx) {
          cleanup();
          resolve(null);
          return;
        }
        sharedCtx.clearRect(0, 0, w, h);
        sharedCtx.drawImage(img, 0, 0, w, h);
        const imageData = sharedCtx.getImageData(0, 0, w, h);
        const palette = analyzeCoverPixels(imageData.data, w, h, bookSeed);
        memoryCache.set(coverUrl, palette);
        schedulePersistCache();
        cleanup();
        resolve(palette);
      } catch {
        // Blocco CORS sul canvas: memorizza il fallimento per non riprovare mai più questo URL
        failedCache.add(coverUrl);
        schedulePersistCache();
        cleanup();
        resolve(null);
      }
    };

    img.onerror = () => {
      failedCache.add(coverUrl);
      schedulePersistCache();
      cleanup();
      resolve(null);
    };

    img.src = thumbUrl;
  });

  pendingPromises.set(coverUrl, promise);
  return promise;
}

