import { isoDay, type Article } from "@/lib/articles";
import { DEFAULT_SORT, type ArticleSearch, type SortKey } from "@/lib/article-search";
import { journalLevel, parsePubDate } from "@/lib/journals";
import { haystack, matchesQuery, parseQuery, type Haystack, type ParsedQuery } from "@/lib/search";

/**
 * Filtrering, sortering och veckogruppering för artikellistan. Används både
 * av listan och av artikelsidans Föregående/Nästa, så att ordningen är
 * densamma.
 */

/** Veckans körning som artikeln kom med, "ÅÅÅÅ-MM-DD". */
export const batchOf = (a: Article) => (a.scored_at ?? "").slice(0, 10);

/** Avrundad AI-relevans 0–5, som visas och filtreras på. */
export const scoreOf = (a: Article) => Math.max(0, Math.min(5, Math.round(a.relevance_score)));

export function latestBatchKey(articles: Article[]): string | null {
  let best: string | null = null;
  for (const a of articles) {
    const b = batchOf(a);
    if (b && (best === null || b > best)) best = b;
  }
  return best;
}

const HAYSTACKS = new WeakMap<Article, Haystack>();

function articleHaystack(a: Article): Haystack {
  let h = HAYSTACKS.get(a);
  if (!h) {
    const authors = Array.isArray(a.authors) ? a.authors.join(", ") : a.authors;
    const mesh = (a.mesh_terms ?? []).map((t) => t.replace(/\*$/, "").trim());
    const drugs: string[] = [];
    for (const s of a.regulatory?.substances ?? []) {
      drugs.push(s.name, ...(s.fda?.brands ?? []), ...(s.fda?.label?.brands ?? []));
      for (const p of s.ema ?? []) drugs.push(p.name);
    }
    h = haystack([
      a.title,
      authors,
      a.journal,
      a.why_relevant,
      a.category,
      ...mesh,
      a.pmid,
      a.doi,
      ...drugs,
    ]);
    HAYSTACKS.set(a, h);
  }
  return h;
}

export function filterArticles(
  articles: Article[],
  search: ArticleSearch,
  opts: { now?: Date; latest?: string | null; query?: ParsedQuery | null } = {},
): Article[] {
  const now = opts.now ?? new Date();
  const query = opts.query === undefined ? parseQuery(search.q) : opts.query;
  const latest = opts.latest === undefined ? latestBatchKey(articles) : opts.latest;
  const cats = new Set(search.cat ?? []);
  const journals = new Set(search.journal ?? []);
  const monthStart = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const last30Start = isoDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  const mesh = (search.mesh ?? "").trim().toLowerCase();

  return articles.filter((a) => {
    if (cats.size > 0 && !cats.has(a.category)) return false;
    if (journals.size > 0 && !journals.has(a.journal)) return false;
    const s = scoreOf(a);
    if (search.min && s < search.min) return false;
    if (search.score && s !== search.score) return false;
    if (search.level || search.lvl) {
      const lvl = journalLevel(a.journal);
      if (search.level && (lvl === null || lvl < search.level)) return false;
      if (search.lvl && lvl !== search.lvl) return false;
    }
    if (search.period) {
      const added = batchOf(a);
      if (!added) return false;
      if (search.period === "month" && added < monthStart) return false;
      if (search.period === "30d" && added < last30Start) return false;
    }
    if (search.nya && (!latest || batchOf(a) !== latest)) return false;
    if (mesh) {
      const terms = (a.mesh_terms ?? []).map((t) => t.replace(/\*$/, "").trim().toLowerCase());
      if (!terms.includes(mesh)) return false;
    }
    if (query && !matchesQuery(articleHaystack(a), query)) return false;
    return true;
  });
}

const byNewestPub = (a: Article, b: Article) => parsePubDate(b.pub_date) - parsePubDate(a.pub_date);
const byScore = (a: Article, b: Article) => b.relevance_score - a.relevance_score;
const byBatch = (a: Article, b: Article) => batchOf(b).localeCompare(batchOf(a));

export function sortArticles(list: Article[], sort: SortKey = DEFAULT_SORT): Article[] {
  const out = [...list];
  switch (sort) {
    case "score":
      return out.sort((a, b) => byScore(a, b) || byBatch(a, b) || byNewestPub(a, b));
    case "pub_date":
      return out.sort((a, b) => byNewestPub(a, b) || byScore(a, b));
    case "journal":
      return out.sort((a, b) => a.journal.localeCompare(b.journal, "sv") || byScore(a, b));
    case "scored_at":
    default:
      // Veckovis, nyaste veckan först, och högst AI-relevans först inom veckan
      return out.sort((a, b) => byBatch(a, b) || byScore(a, b) || byNewestPub(a, b));
  }
}

/** Filtrerad och sorterad lista, precis som den visas. */
export function listArticles(
  articles: Article[],
  search: ArticleSearch,
  opts: { now?: Date; latest?: string | null; query?: ParsedQuery | null } = {},
): Article[] {
  return sortArticles(filterArticles(articles, search, opts), search.sort ?? DEFAULT_SORT);
}

export type Batch = { key: string; items: Article[] };

/** Delar en lista sorterad på "Senast tillagd" i veckor, i samma ordning. */
export function groupByBatch(list: Article[]): Batch[] {
  const out: Batch[] = [];
  for (const a of list) {
    const key = batchOf(a);
    const last = out[out.length - 1];
    if (last && last.key === key) last.items.push(a);
    else out.push({ key, items: [a] });
  }
  return out;
}
