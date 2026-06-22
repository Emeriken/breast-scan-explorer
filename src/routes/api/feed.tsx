import { createFileRoute } from "@tanstack/react-router";

const DATA_URL =
  "https://raw.githubusercontent.com/Emeriken/brostcancer-publik/main/public-index.json";

type Article = {
  title: string;
  journal: string;
  pub_date: string;
  url: string;
  doi?: string;
  relevance_score: number;
  category: string;
  why_relevant: string;
  scored_at: string;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(iso: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

function pmidFromUrl(url: string): string | null {
  const m = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
  return m ? m[1] : null;
}

function buildFeed(
  articles: Article[],
  updated: string | undefined,
  baseUrl: string,
): string {
  const items = articles
    .slice()
    .sort((a, b) => (b.scored_at ?? "").localeCompare(a.scored_at ?? ""))
    .slice(0, 50)
    .map((a) => {
      const pmid = pmidFromUrl(a.url);
      const guid = pmid ?? a.url;
      const description = `Kategori: ${a.category}. Relevans: ${Math.round(
        a.relevance_score,
      )}/5. ${a.why_relevant ?? ""}`.trim();
      return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(a.url)}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <pubDate>${toRfc822(a.scored_at)}</pubDate>
      <category>${escapeXml(a.category)}</category>
      <description>${escapeXml(description)}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bröstcancer-bevakning</title>
    <link>${escapeXml(baseUrl)}/</link>
    <description>AI-bedömda bröstcancerartiklar från ledande tidskrifter.</description>
    <language>sv</language>
    <lastBuildDate>${toRfc822(updated ?? new Date().toISOString())}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

export const Route = createFileRoute("/api/feed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const baseUrl = new URL(request.url).origin;
        try {
          const res = await fetch(DATA_URL, { cache: "no-store" });
          if (!res.ok) {
            return new Response(`Upstream HTTP ${res.status}`, { status: 502 });
          }
          const data = (await res.json()) as {
            articles?: Article[];
            updated?: string;
          };
          const xml = buildFeed(data.articles ?? [], data.updated, baseUrl);
          return new Response(xml, {
            status: 200,
            headers: {
              "Content-Type": "application/rss+xml; charset=utf-8",
              "Cache-Control": "public, max-age=300",
            },
          });
        } catch (err) {
          return new Response(
            `Kunde inte generera RSS: ${(err as Error).message}`,
            { status: 500 },
          );
        }
      },
    },
  },
});