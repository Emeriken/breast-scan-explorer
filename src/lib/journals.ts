export const JOURNAL_LEVELS: Record<string, number> = {
  "N Engl J Med": 3, "Lancet": 3, "JAMA": 3, "BMJ": 3, "Ann Intern Med": 3,
  "J Clin Oncol": 3, "Lancet Oncol": 3, "JAMA Oncol": 3, "Nat Med": 3,
  "Nat Cancer": 3, "Cancer Cell": 3, "Ann Oncol": 3, "Cancer Discov": 3,
  "Cancer Res": 3, "Clin Cancer Res": 3, "Nature": 3, "Science": 3, "Cell": 3,
  "Breast Cancer Res": 2, "Eur J Cancer": 2, "J Natl Cancer Inst": 2,
  "Br J Cancer": 2, "Cancer": 2, "CA Cancer J Clin": 2, "Int J Cancer": 2,
  "Nat Rev Cancer": 2, "Nat Rev Clin Oncol": 2,
  "Acta Oncol": 1, "J Natl Compr Canc Netw": 1, "Int J Radiat Oncol Biol Phys": 1,
  "Radiother Oncol": 1, "Breast Cancer Res Treat": 1, "Breast": 1, "NPJ Breast Cancer": 1,
};

export function journalLevel(journal: string | undefined | null): number | null {
  if (!journal) return null;
  const trimmed = journal.trim();
  if (trimmed in JOURNAL_LEVELS) return JOURNAL_LEVELS[trimmed];
  // Try without trailing punctuation
  const stripped = trimmed.replace(/\.$/, "");
  if (stripped in JOURNAL_LEVELS) return JOURNAL_LEVELS[stripped];
  return null;
}

export function pmidFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
  return m ? m[1] : null;
}

const PUBMED_MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export type PubDateParts = {
  year: number;
  /** null när PubMed bara anger år */
  month: number | null;
  /** null när PubMed bara anger år eller månad */
  day: number | null;
  /** true för intervall som "2026 Jul-Aug" */
  isRange: boolean;
};

/**
 * Tolka PubMeds datumformat ("2026 May 20", "2026 May", "2026",
 * "2026 Jul-Aug") och ISO-datum ("2026-05-20") utan Date.parse, som tolkar
 * PubMed-strängar olika i olika webbläsare. Saknade delar blir null i stället
 * för att fyllas i.
 */
export function parsePubDateParts(s: string | undefined | null): PubDateParts | null {
  if (!s || typeof s !== "string") return null;
  const str = s.trim();

  const iso = str.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (iso) {
    const month = Number(iso[2]);
    if (month < 1 || month > 12) return null;
    const day = iso[3] ? Number(iso[3]) : null;
    return { year: Number(iso[1]), month, day: day && day <= 31 ? day : null, isRange: false };
  }

  const pm = str.match(/^(\d{4})(?:\s+([A-Za-z]{3})[A-Za-z]*(-[A-Za-z]+)?(?:\s+(\d{1,2}))?)?/);
  if (!pm) return null;
  const year = Number(pm[1]);
  const month = pm[2] ? (PUBMED_MONTHS[pm[2].toLowerCase()] ?? null) : null;
  const rawDay = month !== null && pm[4] ? Number(pm[4]) : null;
  const day = rawDay !== null && rawDay >= 1 && rawDay <= 31 ? rawDay : null;
  return { year, month, day, isRange: month !== null && Boolean(pm[3]) };
}

/**
 * Tolka en PubMed-stil datumsträng till en sorterbar timestamp (UTC).
 * Saknad dag eller månad räknas som den första. Returnerar 0 om strängen är
 * tom eller inte kan tolkas, så att artikeln sorteras sist.
 */
export function parsePubDate(s: string | undefined | null): number {
  const p = parsePubDateParts(s);
  if (!p) return 0;
  return Date.UTC(p.year, (p.month ?? 1) - 1, p.day ?? 1);
}

const DAY_FORMAT = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const MONTH_FORMAT = new Intl.DateTimeFormat("sv-SE", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Visa publiceringsdatum med exakt den precision PubMed anger:
 * "2026 Oct 01" → "1 okt. 2026", "2026 Oct" → "okt. 2026", "2026" → "2026".
 * Intervall och okända format visas som de står i källan.
 */
export function formatPubDate(s: string | undefined | null): string {
  const p = parsePubDateParts(s);
  if (!p || p.isRange) return s?.trim() ?? "";
  if (p.month === null) return String(p.year);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day ?? 1));
  return p.day === null ? MONTH_FORMAT.format(d) : DAY_FORMAT.format(d);
}

/**
 * Tolka PubMed-stil datumsträng till {år, månad} för månadsfiltrering.
 *
 * Hanterar:
 * - "2026 May 28" → { y: 2026, m: 5 }
 * - "2026 May"    → { y: 2026, m: 5 }
 * - "2026"        → null (ofullständig)
 * - "" / undefined → null
 *
 * För framtidsdaterade artiklar (t.ex. ESMO-guidelines med "December 2026"
 * som faktiskt publiceras online "ahead of print"): fallback till scoredAt
 * istället — det datumet representerar bättre när artikeln blev tillgänglig
 * och förhindrar att artikeln dyker upp varje månad fram till sin officiella
 * publiceringsdag.
 */
export function parsePubDateToMonth(
  pubDate: string | undefined | null,
  scoredAt?: string | undefined | null,
): { y: number; m: number } | null {
  const p = parsePubDateParts(pubDate);
  if (!p || p.month === null) return null;

  // Framtidsdatum (typiskt ahead-of-print): fallback till scored_at
  if (Date.UTC(p.year, p.month - 1, p.day ?? 1) > Date.now()) {
    if (!scoredAt) return null;
    const sd = new Date(scoredAt);
    if (isNaN(sd.getTime())) return null;
    return { y: sd.getFullYear(), m: sd.getMonth() + 1 };
  }

  return { y: p.year, m: p.month };
}
