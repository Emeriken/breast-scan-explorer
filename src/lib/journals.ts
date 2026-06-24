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

/**
 * Tolka en PubMed-stil datumsträng (t.ex. "2026 May 20", "2026 Jun" eller
 * "2026") till en sorterbar timestamp. Returnerar 0 om strängen är tom eller
 * inte kan tolkas — då sorteras artikeln sist.
 */
export function parsePubDate(s: string | undefined | null): number {
  if (!s) return 0;
  const ms = Date.parse(s);
  return isNaN(ms) ? 0 : ms;
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
  if (!pubDate || typeof pubDate !== "string") return null;
  if (!/[A-Za-z]/.test(pubDate)) return null;
  const t = Date.parse(pubDate);
  if (isNaN(t)) return null;
  const d = new Date(t);
  const now = new Date();

  // Framtidsdatum (typiskt ahead-of-print): fallback till scored_at
  if (d.getTime() > now.getTime()) {
    if (!scoredAt) return null;
    const sd = new Date(scoredAt);
    if (isNaN(sd.getTime())) return null;
    return { y: sd.getFullYear(), m: sd.getMonth() + 1 };
  }

  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}
