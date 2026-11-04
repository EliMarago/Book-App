/**
 * Restituisce una versione ridimensionata della copertina quando il server lo permette,
 * così per le miniature (schede, scaffale) non si scaricano e decodificano immagini da 600-1800px.
 * Per URL non riconosciuti restituisce l'URL originale invariato.
 */
export function optimizeCoverUrl(url: string, width = 300): string {
  if (!url) return url;
  const height = Math.round(width * 1.5);

  // Apple Books / iTunes: .../600x600bb.jpg -> .../300x450bb.jpg
  if (url.includes('mzstatic.com')) {
    return url.replace(/\/\d+x\d+bb(\.\w+)$/, `/${width}x${height}bb$1`);
  }

  // Amazon / Goodreads: .../12345.jpg oppure .../12345._SY475_.jpg -> .../12345._SX300_.jpg
  if (url.includes('media-amazon.com') || url.includes('ssl-images-amazon.com')) {
    return url.replace(/(\/[^/.]+)(\._[A-Z0-9_,]+_)?\.(jpe?g|png|webp)$/i, `$1._SX${width}_.$3`);
  }

  return url;
}

