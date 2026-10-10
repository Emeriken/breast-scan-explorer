import { queryOptions } from "@tanstack/react-query";
import { attachRegulatory, type ArticleRegulatory } from "@/lib/regulatory";

/** Datakällan som pipelinen (pubmed-bevaknng) publicerar varje måndag. */
export const DATA_URL =
  "https://raw.githubusercontent.com/Emeriken/brostcancer-publik/main/public-index.json";

/** Produktens namn, samma i sidhuvud, sidtitlar och RSS. */
export const PRODUCT_NAME = "Bröstcancer-bevakning";

export type DeepAnalysis = {
  central_finding?: string;
  limitation?: string;
  vs_standard?: string;
  applicability?: string;
} | null;

export type Article = {
  pmid?: string;
  title: string;
  journal: string;
  pub_date: string;
  authors?: string | string[];
  url: string;
  doi?: string;
  mesh_terms?: string[];
  relevance_score: number;
  category: string;
  why_relevant: string;
  deep_analysis: DeepAnalysis;
  /** Datum då pipelinen lade till artikeln (en körning per måndag), "ÅÅÅÅ-MM-DD" */
  scored_at: string;
  /** Totalt antal författare (listan `authors` har max sex) */
  author_count?: number;
  /** Publikationstyper enligt PubMed, t.ex. "Retracted Publication" */
  publication_types?: string[];
  /** Nycklar till `regulatory_status.substances` (bara 4–5 poäng) */
  regulatory_substances?: string[];
  /** Validerad FDA/EMA-status, kopplas på i fetchArticles */
  regulatory?: ArticleRegulatory;
};

export type ApiResponse = {
  updated?: string;
  article_count?: number;
  journals_tracked?: string[] | number;
  categories?: string[];
  articles: Article[];
  regulatory_status?: unknown;
};

export async function fetchArticles(): Promise<ApiResponse> {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Kunde inte hämta data (HTTP ${res.status})`);
  const data = (await res.json()) as ApiResponse;
  if (Array.isArray(data?.articles)) attachRegulatory(data.articles, data.regulatory_status);
  return data;
}

/**
 * Gemensam fråga för alla vyer. Datafilen ändras en gång i veckan, så den
 * hämtas inte om vid varje flikbyte eller fokusbyte. Knappen Uppdatera
 * hämtar alltid färskt.
 */
export const articlesQueryOptions = queryOptions({
  queryKey: ["articles"],
  queryFn: fetchArticles,
  staleTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
});

export function articleId(a: Pick<Article, "pmid" | "url">): string {
  return a.pmid ?? a.url;
}

export function pubmedUrl(a: Pick<Article, "pmid" | "url">): string {
  return a.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/` : a.url;
}

export function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const WEEKDAY_DATE = new Intl.DateTimeFormat("sv-SE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const WEEKDAY_DATE_YEAR = new Intl.DateTimeFormat("sv-SE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-10-05" → "mån 5 okt." (med år om det inte är innevarande år). */
export function formatDay(day: string, now: Date = new Date()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return day;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number(m[1]) === now.getFullYear() ? WEEKDAY_DATE.format(d) : WEEKDAY_DATE_YEAR.format(d);
}

/** Dagens datum som "ÅÅÅÅ-MM-DD" i lokal tid. */
export function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Klipp en titel för fliken, utan att dela ord. */
export function shortTitle(title: string, max = 60): string {
  const t = title.trim().replace(/\.$/, "");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,:;]+$/, "")}…`;
}
