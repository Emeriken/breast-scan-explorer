import { z } from "zod";

/**
 * FDA- och EMA-status per substans, som pipelinen (pubmed-bevaknng) lägger
 * i public-index.json:
 *
 * - `regulatory_status` på toppnivå: kontrolldatum, källor och uppgifter per
 *   substans.
 * - `regulatory_substances` på artiklar med 4–5 poäng: nycklar till
 *   substanserna ovan.
 *
 * Allt valideras här. En post som inte följer formatet hoppas över, så att
 * fel i datat aldrig kan påverka resten av sidan. Saknas fälten (äldre data)
 * visas helt enkelt inga badges.
 */

/** Badges visas bara för artiklar med minst så här många poäng. */
export const REGULATORY_MIN_SCORE = 4;

const ALLOWED_HOSTS = new Set([
  "www.accessdata.fda.gov",
  "dailymed.nlm.nih.gov",
  "www.ema.europa.eu",
]);

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = z.string().trim().min(1);

const LabelSchema = z.object({
  application: z.string().optional(),
  brands: z.array(z.string()).optional(),
  indication: text.optional(),
  indication_truncated: z.boolean().optional(),
  url: z.unknown().optional(),
  date: isoDate.optional(),
});

const FdaSchema = z.object({
  application: z.string().regex(/^(NDA|BLA)\d+$/),
  brands: z.array(z.string()).default([]),
  approved: isoDate,
  url: z.unknown().optional(),
  marketed: z.boolean().optional(),
  label: z.unknown().optional(),
});

const EmaProductSchema = z.object({
  name: text,
  authorised: isoDate,
  number: z.string().optional(),
  url: z.unknown().optional(),
  conditional: z.boolean().optional(),
  exceptional: z.boolean().optional(),
  indication: text.optional(),
  indication_truncated: z.boolean().optional(),
});

const SourceSchema = z.object({ name: text, data_date: isoDate.optional() });

export type FdaLabel = {
  application?: string;
  brands: string[];
  indication?: string;
  truncated: boolean;
  url?: string;
  date?: string;
};

export type FdaStatus = {
  application: string;
  brands: string[];
  approved: string;
  url?: string;
  /** false när ingen produkt med substansen marknadsförs enligt Drugs@FDA */
  marketed?: boolean;
  label?: FdaLabel;
};

export type EmaProduct = {
  name: string;
  authorised: string;
  number?: string;
  url?: string;
  conditional: boolean;
  exceptional: boolean;
  indication?: string;
  truncated: boolean;
};

export type RegulatorySubstance = {
  key: string;
  name: string;
  fda?: FdaStatus;
  ema?: EmaProduct[];
};

export type RegulatorySources = {
  fda?: { name: string; dataDate?: string };
  ema?: { name: string; dataDate?: string };
};

export type ArticleRegulatory = {
  substances: RegulatorySubstance[];
  checkedAt?: string;
  sources: RegulatorySources;
};

function parseFda(raw: unknown): FdaStatus | undefined {
  const r = FdaSchema.safeParse(raw);
  if (!r.success) return undefined;
  const out: FdaStatus = {
    application: r.data.application,
    brands: r.data.brands.filter((b) => b.trim()),
    approved: r.data.approved,
    url: safeUrl(r.data.url),
  };
  if (r.data.marketed === false) out.marketed = false;
  const l = LabelSchema.safeParse(r.data.label);
  if (r.data.label !== undefined && l.success && l.data.indication) {
    out.label = {
      application: l.data.application,
      brands: (l.data.brands ?? []).filter((b) => b.trim()),
      indication: l.data.indication,
      truncated: l.data.indication_truncated === true,
      url: safeUrl(l.data.url),
      date: l.data.date,
    };
  }
  return out;
}

function parseEma(raw: unknown): EmaProduct[] | undefined {
  const products = (raw as { products?: unknown } | null)?.products;
  if (!Array.isArray(products)) return undefined;
  const out: EmaProduct[] = [];
  for (const p of products) {
    const r = EmaProductSchema.safeParse(p);
    if (!r.success) continue;
    out.push({
      name: r.data.name,
      authorised: r.data.authorised,
      number: r.data.number?.trim() || undefined,
      url: safeUrl(r.data.url),
      conditional: r.data.conditional === true,
      exceptional: r.data.exceptional === true,
      indication: r.data.indication,
      truncated: r.data.indication_truncated === true,
    });
  }
  return out.length ? out : undefined;
}

/** "trastuzumab deruxtecan" → "Trastuzumab deruxtecan". Övriga tecken som i PubMed. */
function displayName(name: string): string {
  const n = name.trim();
  return n ? n[0].toLocaleUpperCase("sv-SE") + n.slice(1) : n;
}

type Parsed = {
  substances: Map<string, RegulatorySubstance>;
  checkedAt?: string;
  sources: RegulatorySources;
};

/** Validera `regulatory_status`. Returnerar null om inget användbart finns. */
export function parseRegulatoryStatus(raw: unknown): Parsed | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const subsRaw = obj.substances;
  if (!subsRaw || typeof subsRaw !== "object") return null;

  const sources: RegulatorySources = {};
  const srcRaw = (obj.sources ?? {}) as Record<string, unknown>;
  for (const k of ["fda", "ema"] as const) {
    const s = SourceSchema.safeParse(srcRaw?.[k]);
    if (s.success) sources[k] = { name: s.data.name, dataDate: s.data.data_date };
  }

  const substances = new Map<string, RegulatorySubstance>();
  for (const [key, value] of Object.entries(subsRaw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    const fda = sources.fda ? parseFda(v.fda) : undefined;
    const ema = sources.ema ? parseEma(v.ema) : undefined;
    if (!fda && !ema) continue;
    const name = typeof v.name === "string" && v.name.trim() ? v.name : key;
    substances.set(key, { key, name: displayName(name), fda, ema });
  }
  if (substances.size === 0) return null;

  const checked = typeof obj.checked_at === "string" ? obj.checked_at.slice(0, 10) : undefined;
  return {
    substances,
    checkedAt: checked && /^\d{4}-\d{2}-\d{2}$/.test(checked) ? checked : undefined,
    sources,
  };
}

type ArticleLike = {
  relevance_score: number;
  regulatory_substances?: unknown;
  regulatory?: ArticleRegulatory;
};

/**
 * Koppla substanserna till artiklarna (fältet `regulatory`). Ändrar
 * artiklarna på plats och kastar aldrig: går något fel blir det bara inga
 * badges.
 */
export function attachRegulatory<T extends ArticleLike>(
  articles: T[],
  rawStatus: unknown,
): void {
  try {
    const parsed = parseRegulatoryStatus(rawStatus);
    if (!parsed) return;
    for (const a of articles) {
      if (!(Math.round(a.relevance_score) >= REGULATORY_MIN_SCORE)) continue;
      const keys = a.regulatory_substances;
      if (!Array.isArray(keys)) continue;
      const seen = new Set<string>();
      const subs: RegulatorySubstance[] = [];
      for (const k of keys) {
        if (typeof k !== "string" || seen.has(k)) continue;
        seen.add(k);
        const s = parsed.substances.get(k);
        if (s) subs.push(s);
      }
      if (subs.length) {
        a.regulatory = { substances: subs, checkedAt: parsed.checkedAt, sources: parsed.sources };
      }
    }
  } catch {
    // Ingen badge hellre än en trasig sida.
  }
}

/** Författarrad med "m.fl." när listan är kapad (pipelinen sparar max sex). */
export function authorLine(authors: unknown, authorCount: unknown): string {
  const list = Array.isArray(authors)
    ? authors.filter((a): a is string => typeof a === "string" && a.trim() !== "")
    : typeof authors === "string"
      ? [authors]
      : [];
  if (!list.length) return "";
  const joined = list.join(", ");
  return typeof authorCount === "number" && authorCount > list.length ? `${joined} m.fl.` : joined;
}
