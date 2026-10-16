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
 * Gemensam fråga för alla vyer. Datafilen ändras en gång i veckan. Den
 * hämtas om när fliken får fokus och datan är äldre än en halvtimme, så att
 * en sida som stått öppen sedan förra veckan får måndagens artiklar.
 */
export const articlesQueryOptions = queryOptions({
  queryKey: ["articles"],
  queryFn: fetchArticles,
  staleTime: 30 * 60 * 1000,
  refetchOnWindowFocus: true,
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

/** ISO-veckonummer för "ÅÅÅÅ-MM-DD", t.ex. "2026-10-12" → 42. */
export function isoWeek(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // Veckan räknas från torsdagen i samma vecka (måndag = 1, söndag = 7)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/** Dagens datum som "ÅÅÅÅ-MM-DD" i lokal tid. */
export function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Dagen då datan senast uppdaterades ("ÅÅÅÅ-MM-DD") och hur många dagar
 * sedan det var. Utan tidsstämpel används den senaste veckans datum.
 */
export function dataAge(
  updated: string | undefined,
  fallbackDay: string | null,
  now: number = Date.now(),
): { day: string | null; ageDays: number | null } {
  const d = updated ? new Date(updated) : null;
  if (!d || isNaN(d.getTime())) return { day: fallbackDay, ageDays: null };
  return { day: isoDay(d), ageDays: Math.floor((now - d.getTime()) / 86_400_000) };
}

/** Klipp en titel för fliken, utan att dela ord. */
export function shortTitle(title: string, max = 60): string {
  const t = title.trim().replace(/\.$/, "");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,:;]+$/, "")}…`;
}
