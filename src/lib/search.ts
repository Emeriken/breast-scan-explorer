/**
 * Sökningen i artikellistan. Frågan delas i ord som alla måste finnas, i
 * valfri ordning. Versaler, accenter och bindestreck spelar ingen roll
 * (García = Garcia, HER2-low = HER2 low). En kort, synlig lista med
 * förkortningar och varumärken söks som synonymer, alltid på samma sätt.
 * Listan är ordboksuppslag, inte tolkning: den lägger bara till sökord.
 */

/** Synonymgrupper. Ord i samma grupp söks som likvärdiga. Visas i sökhjälpen. */
export const SYNONYM_GROUPS: string[][] = [
  ["T-DXd", "trastuzumab deruxtecan", "Enhertu", "DS-8201"],
  ["T-DM1", "trastuzumab emtansine", "Kadcyla"],
  ["SG", "sacituzumab govitecan", "Trodelvy"],
  ["Dato-DXd", "datopotamab deruxtecan", "Datroway"],
  ["TNBC", "triple-negative", "trippelnegativ"],
  ["pCR", "pathologic complete response", "pathological complete response"],
  ["ADC", "antibody-drug conjugate"],
  ["ICI", "immune checkpoint inhibitor", "checkpoint inhibitor"],
  ["CDK4/6i", "CDK4/6"],
  ["pembrolizumab", "Keytruda"],
  ["durvalumab", "Imfinzi"],
  ["atezolizumab", "Tecentriq"],
  ["olaparib", "Lynparza"],
  ["talazoparib", "Talzenna"],
  ["palbociclib", "Ibrance"],
  ["ribociclib", "Kisqali"],
  ["abemaciclib", "Verzenios", "Verzenio"],
  ["alpelisib", "Piqray"],
  ["capivasertib", "Truqap"],
  ["inavolisib", "Itovebi"],
  ["elacestrant", "Orserdu"],
  ["everolimus", "Afinitor"],
  ["fulvestrant", "Faslodex"],
  ["pertuzumab", "Perjeta"],
  ["tucatinib", "Tukysa"],
  ["neratinib", "Nerlynx"],
  ["eribulin", "Halaven"],
  ["capecitabine", "Xeloda"],
  ["nab-paclitaxel", "Abraxane"],
  ["trastuzumab", "Herceptin"],
];

/** Fälten som söks, i den ordning de nämns för användaren. */
export const SEARCHED_FIELDS =
  "titel, författare, tidskrift, motivering, MeSH-termer, PMID, DOI och läkemedelsnamn";

type Mode = "substring" | "prefix" | "word";

export type Variant = { text: string; mode: Mode; re?: RegExp; reJoined?: RegExp };

export type Term = {
  /** Ordet eller frasen som användaren skrev */
  label: string;
  variants: Variant[];
};

export type ParsedQuery = {
  terms: Term[];
  /** Synonymer som lades till, för raden "Söker även: …" */
  expansions: { form: string; also: string[] }[];
};

const DASHES = /[‐-―−-]/g;
const NOT_WORD = "[^\\p{L}\\p{N}]";

/** Gemener utan accenter: "García" → "garcia". */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function spaced(s: string): string {
  return s.replace(DASHES, " ").replace(/\s+/g, " ").trim();
}

function joined(s: string): string {
  return s.replace(DASHES, "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compile(v: Variant): Variant {
  if (v.mode === "prefix") {
    v.re = new RegExp(`(?:^|${NOT_WORD})${escapeRegExp(spaced(v.text))}`, "u");
  } else if (v.mode === "word") {
    v.re = new RegExp(`(?:^|${NOT_WORD})${escapeRegExp(spaced(v.text))}s?(?![\\p{L}\\p{N}])`, "u");
    v.reJoined = new RegExp(
      `(?:^|${NOT_WORD})${escapeRegExp(joined(v.text))}s?(?![\\p{L}\\p{N}])`,
      "u",
    );
  }
  return v;
}

/** Förkortningar (t.ex. SG, TNBC, T-DXd) måste stå som egna ord. */
function isAbbreviation(form: string) {
  return !/\s/.test(form) && form.replace(DASHES, "").length <= 6 && /[a-z]/i.test(form);
}

function variantFor(form: string): Variant {
  const f = fold(form);
  return compile({ text: f, mode: isAbbreviation(form) ? "word" : "substring" });
}

type SynonymEntry = { group: number; form: string };
const SYNONYM_INDEX = new Map<string, SynonymEntry>();
SYNONYM_GROUPS.forEach((group, i) => {
  for (const form of group) {
    const f = fold(form);
    SYNONYM_INDEX.set(spaced(f), { group: i, form });
    SYNONYM_INDEX.set(joined(f), { group: i, form });
  }
});
const MAX_FORM_WORDS = Math.max(...SYNONYM_GROUPS.flat().map((f) => spaced(f).split(" ").length));

function lookupSynonym(text: string): SynonymEntry | undefined {
  const f = fold(text);
  return SYNONYM_INDEX.get(spaced(f)) ?? SYNONYM_INDEX.get(joined(f));
}

function groupTerm(entry: SynonymEntry, label: string): Term {
  return { label, variants: SYNONYM_GROUPS[entry.group].map(variantFor) };
}

function cleanToken(t: string): string {
  return t.replace(/^[\s.,;:!?()[\]{}'"«»]+|[\s.,;:!?()[\]{}'"«»]+$/g, "");
}

function plainTerm(token: string): Term {
  const f = fold(token);
  const bare = spaced(f);
  const short = bare.length < 4 && !/\s/.test(bare);
  return { label: token, variants: [compile({ text: f, mode: short ? "prefix" : "substring" })] };
}

export function parseQuery(raw: string | undefined | null): ParsedQuery | null {
  const input = (raw ?? "").trim();
  if (!input) return null;
  const terms: Term[] = [];
  const expansions: ParsedQuery["expansions"] = [];
  const seenGroups = new Set<number>();

  const addGroup = (entry: SynonymEntry, label: string) => {
    terms.push(groupTerm(entry, label));
    if (!seenGroups.has(entry.group)) {
      seenGroups.add(entry.group);
      const also = SYNONYM_GROUPS[entry.group].filter((f) => fold(f) !== fold(label));
      if (also.length) expansions.push({ form: label, also });
    }
  };

  // "Citerade fraser" söks som de står
  const rest = input.replace(/"([^"]+)"/g, (_, phrase: string) => {
    const p = phrase.trim();
    if (p) {
      const entry = lookupSynonym(p);
      if (entry) addGroup(entry, p);
      else terms.push({ label: p, variants: [compile({ text: fold(p), mode: "substring" })] });
    }
    return " ";
  });

  const words = rest.split(/\s+/).map(cleanToken).filter(Boolean);
  for (let i = 0; i < words.length;) {
    let matched = false;
    for (let len = Math.min(MAX_FORM_WORDS, words.length - i); len >= 1; len--) {
      const phrase = words.slice(i, i + len).join(" ");
      const entry = lookupSynonym(phrase);
      if (entry) {
        addGroup(entry, phrase);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      terms.push(plainTerm(words[i]));
      i += 1;
    }
  }
  return terms.length ? { terms, expansions } : null;
}

export type Haystack = { spaced: string; joined: string };

export function haystack(parts: (string | undefined | null)[]): Haystack {
  const f = fold(parts.filter(Boolean).join(" • "));
  return { spaced: spaced(f), joined: joined(f) };
}

function variantMatches(h: Haystack, v: Variant): boolean {
  if (v.mode === "substring") {
    return h.spaced.includes(spaced(v.text)) || h.joined.includes(joined(v.text));
  }
  if (v.re?.test(h.spaced)) return true;
  return v.reJoined ? v.reJoined.test(h.joined) : false;
}

export function matchesQuery(h: Haystack, q: ParsedQuery): boolean {
  return q.terms.every((t) => t.variants.some((v) => variantMatches(h, v)));
}

/**
 * Teckenvis vikning som behåller positionerna, så att träffar kan markeras i
 * originaltexten.
 */
function foldKeepingPositions(text: string): string {
  let out = "";
  for (const ch of text) {
    let f = ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    if (f.length !== ch.length) {
      const lower = ch.toLowerCase();
      f = lower.length === ch.length ? lower : ch;
    }
    out += f;
  }
  return out.replace(DASHES, " ");
}

/** Intervall [start, slut) att markera i `text` för frågan. */
export function highlightRanges(text: string, q: ParsedQuery | null): [number, number][] {
  if (!q || !text) return [];
  const folded = foldKeepingPositions(text);
  const ranges: [number, number][] = [];
  for (const term of q.terms) {
    for (const v of term.variants) {
      const needle = spaced(v.text);
      if (needle.length < 2) continue;
      if (v.mode === "substring") {
        let at = folded.indexOf(needle);
        while (at !== -1) {
          ranges.push([at, at + needle.length]);
          at = folded.indexOf(needle, at + needle.length);
        }
      } else {
        const tail = v.mode === "word" ? "s?(?![\\p{L}\\p{N}])" : "";
        const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}${tail}`, "gu");
        for (const m of folded.matchAll(re)) {
          if (m.index !== undefined) ranges.push([m.index, m.index + m[0].length]);
        }
      }
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    // Slå ihop överlappande träffar och träffar som bara skiljs av ett
    // bindestreck, så att "HER2-low" markeras som en helhet.
    const touching =
      last &&
      (r[0] <= last[1] ||
        (r[0] === last[1] + 1 && folded[last[1]] === " " && /[-‐-―−]/.test(text[last[1]])));
    if (last && touching) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

/** Frågan utan ett visst ord, för förslagen när inget hittas. */
export function withoutTerm(raw: string, label: string): string {
  const words = raw.trim().split(/\s+/);
  const target = fold(label);
  const idx = words.findIndex((w) => fold(cleanToken(w)) === target);
  if (idx === -1) {
    return raw.replace(label, " ").replace(/\s+/g, " ").trim();
  }
  words.splice(idx, 1);
  return words.join(" ");
}
