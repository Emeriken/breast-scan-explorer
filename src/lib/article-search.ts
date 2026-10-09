import { z } from "zod";

/**
 * Sök, filter, sortering och antal visade artiklar ligger i URL:en, så att
 * de finns kvar när man går till en artikel och tillbaka, och så att en
 * filtrerad vy kan delas som länk. Ogiltiga värden ignoreras i stället för
 * att ge felsida.
 */

export const SORT_KEYS = ["scored_at", "pub_date", "score", "journal"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const DEFAULT_SORT: SortKey = "scored_at";

export const SORT_LABELS: Record<SortKey, string> = {
  scored_at: "Senast bedömd",
  pub_date: "Publiceringsdatum",
  score: "Högst relevans",
  journal: "Tidskrift (A–Ö)",
};

/** Antal artiklar som visas per steg i listan. */
export const PAGE_SIZE = 30;

const stringList = z.array(z.string()).optional().catch(undefined);

export const articleSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  sort: z.enum(SORT_KEYS).optional().catch(undefined),
  cat: stringList,
  journal: stringList,
  /** Lägsta relevanspoäng: 4 = 4–5, 5 = bara 5 */
  min: z.coerce.number().pipe(z.union([z.literal(4), z.literal(5)])).optional().catch(undefined),
  /** Bedömningsdatum: innevarande månad eller senaste 30 dagarna */
  period: z.enum(["month", "30d"]).optional().catch(undefined),
  /** Lägsta KI-JL-nivå: 2 = L2–L3, 3 = bara L3 */
  level: z.coerce.number().pipe(z.union([z.literal(2), z.literal(3)])).optional().catch(undefined),
  mesh: z.string().optional().catch(undefined),
  /** Antal visade artiklar */
  n: z.coerce.number().int().positive().max(10000).optional().catch(undefined),
});

export type ArticleSearch = z.infer<typeof articleSearchSchema>;
