const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function sanitizeQuery(str: string): string {
  return str.replace(/[\[\]\(\)\{\}"]/g, " ").replace(/\s+/g, " ").trim();
}

async function searchAppleBooks(title: string, author?: string): Promise<string | null> {
  try {
    const cleanTitle = sanitizeQuery(title);
    const cleanAuthor = author ? sanitizeQuery(author) : "";
    const query = encodeURIComponent(`${cleanTitle} ${cleanAuthor}`.trim());
    const url = `https://itunes.apple.com/search?term=${query}&entity=ebook&limit=3`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.results && data.results.length > 0) {
      for (const item of data.results) {
        if (item.artworkUrl100) {
          return item.artworkUrl100.replace("100x100bb", "600x600bb").replace("http://", "https://");
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function searchOpenLibrary(title: string, author?: string): Promise<string | null> {
  try {
    const cleanTitle = sanitizeQuery(title);
    const cleanAuthor = author ? sanitizeQuery(author) : "";
    const query = encodeURIComponent(`${cleanTitle} ${cleanAuthor}`.trim());
    const url = `https://openlibrary.org/search.json?q=${query}&limit=5`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.docs || data.docs.length === 0) return null;

    for (const doc of data.docs) {
      if (doc.cover_i) {
        return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
      }
      if (doc.cover_edition_key) {
        return `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`;
      }
      if (Array.isArray(doc.isbn) && doc.isbn.length > 0) {
        return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function searchGoogleBooks(title: string, author?: string): Promise<string | null> {
  try {
    const cleanTitle = sanitizeQuery(title);
    const cleanAuthor = author ? sanitizeQuery(author) : "";
    const query = encodeURIComponent(
      cleanAuthor ? `intitle:${cleanTitle} inauthor:${cleanAuthor}` : cleanTitle
    );
    const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=3`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.items || data.items.length === 0) return null;

    for (const item of data.items) {
      const imageLinks = item?.volumeInfo?.imageLinks;
      if (imageLinks) {
        const cover =
          imageLinks.extraLarge ||
          imageLinks.large ||
          imageLinks.medium ||
          imageLinks.thumbnail ||
          imageLinks.smallThumbnail;
        if (cover) {
          return cover.replace("http://", "https://").replace("&edge=curl", "");
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { title, author } = await req.json();

    if (!title || typeof title !== "string") {
      return new Response(
        JSON.stringify({ error: "Title is required", cover_url: null }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Prova in ordine: Apple Books -> Open Library -> Google Books
    const coverUrl =
      (await searchAppleBooks(title, author)) ||
      (await searchOpenLibrary(title, author)) ||
      (await searchGoogleBooks(title, author));

    return new Response(
      JSON.stringify({ cover_url: coverUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message, cover_url: null }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
