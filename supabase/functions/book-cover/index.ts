import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { title, author } = await req.json();

    if (!title || typeof title !== "string") {
      return new Response(
        JSON.stringify({ error: "Title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build a robust Google Books query. Quoting multi-word terms improves match accuracy.
    const titleTerm = title.trim().replace(/"/g, "");
    const queryParts = [`intitle:"${titleTerm}"`];
    if (author && author.trim()) {
      const authorTerm = author.trim().replace(/"/g, "");
      queryParts.push(`inauthor:"${authorTerm}"`);
    }
    const query = encodeURIComponent(queryParts.join(" "));
    const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5`;

    const res = await fetch(url);
    if (!res.ok) {
      return new Response(
        JSON.stringify({ cover_url: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();

    if (!data.items || data.items.length === 0) {
      // Fallback: try a broader search without the intitle/inauthor prefixes
      const broadQuery = encodeURIComponent(`${title} ${author ?? ""}`.trim());
      const broadUrl = `https://www.googleapis.com/books/v1/volumes?q=${broadQuery}&maxResults=5`;
      const broadRes = await fetch(broadUrl);
      if (!broadRes.ok) {
        return new Response(
          JSON.stringify({ cover_url: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const broadData = await broadRes.json();
      if (!broadData.items || broadData.items.length === 0) {
        return new Response(
          JSON.stringify({ cover_url: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      data.items = broadData.items;
    }

    // Search through results for the first one that has a cover image
    for (const item of data.items) {
      const imageLinks = item?.volumeInfo?.imageLinks;
      if (!imageLinks) continue;

      const coverUrl =
        imageLinks.extraLarge ||
        imageLinks.large ||
        imageLinks.medium ||
        imageLinks.thumbnail ||
        imageLinks.smallThumbnail;

      if (coverUrl) {
        // Google Books returns http by default; upgrade to https and request a larger size
        const httpsUrl = coverUrl.replace("http://", "https://");
        // Try to get a higher-resolution image by bumping the zoom parameter
        const enhancedUrl = httpsUrl.replace("zoom=1", "zoom=0").replace("&edge=curl", "");
        return new Response(
          JSON.stringify({ cover_url: enhancedUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(
      JSON.stringify({ cover_url: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, cover_url: null }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
