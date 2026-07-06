const DATA_URL =
  "https://raw.githubusercontent.com/Emeriken/brostcancer-publik/main/public-index.json";

export type Article = {
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

export type Feed = { articles: Article[]; updated?: string };

export async function fetchFeed(): Promise<Feed> {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);
  const data = (await res.json()) as Feed;
  return { articles: data.articles ?? [], updated: data.updated };
}

export function pmidFromUrl(url: string): string | null {
  const m = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
  return m ? m[1] : null;
}