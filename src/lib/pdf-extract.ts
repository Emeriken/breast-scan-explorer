/**
 * Mönstersökning i en artikels PDF, helt utan AI. PDF:en läses i webbläsaren
 * (src/lib/pdf-read.ts) och lämnar aldrig datorn. Här finns bara rena
 * funktioner över textlagret, så att de går att testa utan webbläsare.
 *
 * Det som hittas är förslag: presentatören väljer och bekräftar, och varje
 * träff visas med sida och den mening den kommer ifrån.
 */

/** En textbit ur PDF:ens textlager, i PDF-koordinater (y uppåt, punkter). */
export type PdfTextItem = { str: string; x: number; y: number; w: number; h: number; eol: boolean };
export type PdfPage = { page: number; width: number; height: number; items: PdfTextItem[] };
/** Rektangel i PDF-koordinater: x, y nedre vänstra hörnet. */
export type Box = { x: number; y: number; w: number; h: number };

export type Effect = {
  id: string;
  page: number;
  /** "HR", "OR", "RR" … som det står, normaliserat */
  measure: string;
  est: string;
  lo: string;
  hi: string;
  /** p-värde om det står direkt efter intervallet, t.ex. "<0.001" */
  p?: string;
  /** Meningen runt träffen, ordagrant ur PDF:en (normaliserad) */
  quote: string;
};

export type Caption = {
  id: string;
  kind: "figure" | "table";
  num: string;
  page: number;
  /** Bildtextens början */
  text: string;
  /** Bildtextens första textbit, för att föreslå var figuren eller tabellen ligger */
  anchor: Box;
};

export type NctHit = {
  nct: string;
  page: number;
  /** står nära "registered", "ClinicalTrials.gov" … */ registration: boolean;
};
export type SectionHit = { kind: "funding" | "coi"; page: number; heading: string; text: string };

export type PdfFindings = {
  pages: number;
  effects: Effect[];
  captions: Caption[];
  ncts: NctHit[];
  funding?: SectionHit;
  coi?: SectionHit;
  /** true om PDF:en saknar textlager (inskannad) */
  noText: boolean;
};

// --- Text --------------------------------------------------------------------

/** Rätta vanliga tecken i PDF:ers textlager så att mönstren känner igen dem. */
export function normalize(s: string): string {
  return s
    .replace(/(\d)\s*[·•]\s*(\d)/g, "$1.$2") // Lancet skriver 0·60
    .replace(/([Pp]\s*)¼(\s*[.\d])/g, "$1=$2") // AACR:s typsnitt: "P ¼ 0.035"
    .replace(/[\u2212\u2013\u2014\u2010\u2011]/g, "-")
    .replace(/[\u00a0\u2009\u202f]/g, " ")
    .replace(/(\w)-\n(\w)/g, "$1$2") // avstavning vid radbrytning
    .replace(/[ \t]+/g, " ");
}

/** En textrad, byggd av textbitarnas position (y uppåt, PDF-koordinater). */
export type Line = {
  text: string;
  x0: number;
  x1: number;
  y: number;
  h: number;
  first: PdfTextItem;
};

const LINES = new WeakMap<PdfPage, Line[]>();

/**
 * Sidans rader. Vissa förlag lägger varje ord som en egen textbit utan
 * radbrytningar, så raderna byggs av positionerna: en ny rad börjar när
 * höjden ändras, eller när texten hoppar tillbaka åt vänster.
 */
export function lines(p: PdfPage): Line[] {
  const cached = LINES.get(p);
  if (cached) return cached;
  const out: Line[] = [];
  let cur: Line | null = null;
  let lastEnd = 0;
  for (const it of p.items) {
    if (!it.str) continue;
    const h = Math.max(it.h, 1);
    const newLine =
      !cur ||
      Math.abs(it.y - cur.y) > Math.max(2, Math.min(h, cur.h) * 0.45) ||
      it.x < lastEnd - Math.max(h, cur.h) * 2 ||
      // Stor lucka åt höger: spaltmellanrum eller ny tabellcell
      (it.str.trim() !== "" && it.x - lastEnd > Math.max(h, cur.h) * 1.5);
    if (newLine) {
      if (cur && cur.text.trim()) out.push(cur);
      cur = { text: "", x0: it.x, x1: it.x + it.w, y: it.y, h, first: it };
    } else if (cur && it.x - lastEnd > h * 0.2 && !/\s$/.test(cur.text) && !/^\s/.test(it.str)) {
      cur.text += " ";
    }
    cur!.text += it.str;
    if (it.str.trim()) {
      cur!.x0 = Math.min(cur!.x0, it.x);
      cur!.x1 = Math.max(cur!.x1, it.x + it.w);
      cur!.h = Math.max(cur!.h, h);
      if (!cur!.first.str.trim()) cur!.first = it;
    }
    lastEnd = it.x + it.w;
    if (it.eol) {
      if (cur && cur.text.trim()) out.push(cur);
      cur = null;
    }
  }
  if (cur && cur.text.trim()) out.push(cur);
  LINES.set(p, out);
  return out;
}

/** Sidans text, en rad per rad. */
export function pageText(p: PdfPage): string {
  return lines(p)
    .map((l) => l.text.replace(/\s+/g, " ").trim())
    .join("\n");
}

function sentenceAround(text: string, start: number, end: number): string {
  const before = text.slice(Math.max(0, start - 260), start);
  const after = text.slice(end, end + 260);
  const s = before.search(/[.!?]\s+[A-Z(][^.!?]*$/);
  const head = s >= 0 ? before.slice(s + 1) : before;
  const e = after.search(/\.\s+[A-Z]|\.\s*$|\n\n/);
  const tail = e >= 0 ? after.slice(0, e + 1) : after;
  return (head + text.slice(start, end) + tail).replace(/\s+/g, " ").trim();
}

// --- Effektmått ----------------------------------------------------------------

// Förkortningarna bara med versaler, så att "or" i "progression or death" inte räknas
const MEASURE =
  "(?:[Aa]djusted |[Ss]tratified |[Uu]nstratified )?(?:[Hh]azard [Rr]atio|[Oo]dds [Rr]atio|[Rr]isk [Rr]atio|[Rr]elative [Rr]isk|[Rr]ate [Rr]atio|[Ss]ubdistribution [Hh]azard [Rr]atio|aHR|sHR|HR|OR|RR|IRR)";
const NUM = "(\\d+(?:\\.\\d+)?)";
const EFFECT_RE = new RegExp(
  `\\b(${MEASURE})\\b[^\\d\\n]{0,50}?${NUM}\\s*[;,(\\[]?\\s*(?:\\d{2}\\s*%\\s*)?(?:CI|[Cc]onfidence [Ii]nterval)[^\\d]{0,10}${NUM}\\s*(?:-|to|,)\\s*${NUM}` +
    `(?:[^Pp\\d]{0,8}[Pp]\\s*(?:value)?\\s*([<>=≤≥])\\s*(0?\\.\\d+))?`,
  "g",
);

function measureLabel(m: string): string {
  const s = m.toLowerCase();
  if (s.includes("subdistribution")) return "sHR";
  if (s.includes("hazard") || /hr$/.test(s)) return "HR";
  if (s.includes("odds") || /\bor$/.test(s)) return "OR";
  if (s.includes("rate ratio") || s === "irr") return "IRR";
  if (s.includes("risk") || /rr$/.test(s)) return "RR";
  return m;
}

export function findEffects(pages: PdfPage[]): Effect[] {
  const out: Effect[] = [];
  const seen = new Set<string>();
  for (const p of pages) {
    const text = normalize(pageText(p));
    for (const m of text.matchAll(EFFECT_RE)) {
      const [est, lo, hi] = [m[2], m[3], m[4]];
      // Rimlighetskontroll: skattningen ska ligga i intervallet
      if (!(Number(lo) <= Number(est) && Number(est) <= Number(hi))) continue;
      const measure = measureLabel(m[1]);
      // Samma värden med olika antal decimaler (0.8 och 0.80) är samma träff
      const key = `${measure}|${Number(est)}|${Number(lo)}|${Number(hi)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `e${out.length}`,
        page: p.page,
        measure,
        est,
        lo,
        hi,
        p: m[5] ? `${m[5] === "=" ? "=" : m[5]}${m[6]}` : undefined,
        quote: sentenceAround(text, m.index!, m.index! + m[0].length),
      });
    }
  }
  return out;
}

/** "0.38" → "0,38" (svenskt decimaltecken i presentationen) */
const sv = (n: string) => n.replace(".", ",");

/** "HR 0,38 (95 % KI 0,27–0,54); p<0,001" */
export function effectLabel(e: Effect): string {
  const p = e.p
    ? `; p${e.p.startsWith("=") ? " = " + sv(e.p.slice(1)) : e.p[0] + sv(e.p.slice(1))}`
    : "";
  return `${e.measure} ${sv(e.est)} (95 % KI ${sv(e.lo)}–${sv(e.hi)})${p}`;
}

// --- Studienummer ------------------------------------------------------------

const NCT_RE = /\bNCT\s?(\d{8})\b/g;
const REGISTRATION_RE = /regist|ClinicalTrials\.gov|identifier|trial number/i;

export function findNcts(pages: PdfPage[]): NctHit[] {
  const hits = new Map<string, NctHit>();
  for (const p of pages) {
    const text = normalize(pageText(p));
    for (const m of text.matchAll(NCT_RE)) {
      const nct = `NCT${m[1]}`;
      const near = text.slice(Math.max(0, m.index! - 90), m.index! + 20);
      const registration = REGISTRATION_RE.test(near);
      const prev = hits.get(nct);
      if (!prev) hits.set(nct, { nct, page: p.page, registration });
      else if (registration && !prev.registration) prev.registration = true;
    }
  }
  // Nummer som står vid "registered" o.d. först, sedan i den ordning de förekommer
  return [...hits.values()].sort((a, b) => Number(b.registration) - Number(a.registration));
}

// --- Finansiering och jäv ------------------------------------------------------

const SECTION_RE =
  /(?:^|\n)\s*(Funding(?: source| statement| information)?|Financial support|Role of the funding source|Declaration of interests?|Competing interests?|Conflicts? of interest(?: disclosures?| statement)?|Disclosures?(?: of potential conflicts of interest)?|Authors?['’]? [Dd]isclosures?|Acknowledge?ments?)\s*[:.]?\s*/g;

function sectionKind(heading: string): "funding" | "coi" | "ack" {
  if (/acknowledg/i.test(heading)) return "ack";
  return /fund|financial support/i.test(heading) ? "funding" : "coi";
}

export function findSections(pages: PdfPage[]): { funding?: SectionHit; coi?: SectionHit } {
  const found: { funding?: SectionHit; coi?: SectionHit; ack?: SectionHit } = {};
  for (const p of pages) {
    const text = normalize(pageText(p));
    for (const m of text.matchAll(SECTION_RE)) {
      const kind = sectionKind(m[1]);
      if (found[kind]) continue;
      const start = m.index! + m[0].length;
      let body = text
        .slice(start, start + 700)
        .replace(/\s+/g, " ")
        .trim();
      // Bara ett riktigt avsnitt: börjar med versal och är mer än några ord
      if (!/^[A-Z]/.test(body) || body.length < 40) continue;
      const cut = body.lastIndexOf(". ", 600);
      if (body.length > 600 && cut > 200) body = body.slice(0, cut + 1);
      found[kind] = {
        kind: kind === "ack" ? "funding" : kind,
        page: p.page,
        heading: m[1],
        text: body,
      };
    }
  }
  // Utan eget avsnitt står finansieringen ofta i tacksägelsen, om den nämner stöd
  const ack = found.ack && /support|fund|grant/i.test(found.ack.text) ? found.ack : undefined;
  return { funding: found.funding ?? ack, coi: found.coi };
}

// --- Figurer och tabeller -------------------------------------------------------

const CAPTION_START = /^(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE)\s*(\d{1,2})\b\s*([.:|]?)\s*(.*)$/;

export function findCaptions(pages: PdfPage[]): Caption[] {
  const out: Caption[] = [];
  const seen = new Set<string>();
  for (const p of pages) {
    const ls = lines(p);
    ls.forEach((line, i) => {
      // En bildtext börjar en egen rad; hänvisningar i löptext gör det sällan
      const m = CAPTION_START.exec(normalize(line.text).trim());
      if (!m) return;
      let rest = m[4];
      for (let j = i + 1; j < ls.length && rest.length < 200; j++) rest += " " + ls[j].text;
      rest = normalize(rest).replace(/\s+/g, " ").trim();
      // En bildtext börjar med versal efter numret (eller "|", ".", ":")
      if (!m[3] && !/^[A-Z]/.test(rest)) return;
      if (/^(shows?|summari[sz]es|lists|presents|and|or|in|of)\b/i.test(rest)) return;
      const kind = /^t/i.test(m[1]) ? "table" : "figure";
      const key = `${kind}${m[2]}`;
      if (seen.has(key)) return;
      seen.add(key);
      const dot = rest.search(/\.\s/);
      out.push({
        id: key,
        kind,
        num: m[2],
        page: p.page,
        text: (dot > 15 && dot < 180 ? rest.slice(0, dot + 1) : rest.slice(0, 160)).trim(),
        anchor: { x: line.x0, y: line.y, w: Math.max(line.x1 - line.x0, 1), h: line.h },
      });
    });
  }
  // Numren ska följa på varandra från 1; ett udda nummer är oftast en hänvisning
  const keep = out.filter((c) => {
    for (let n = 1; n < Number(c.num); n++) if (!seen.has(`${c.kind}${n}`)) return false;
    return true;
  });
  return keep.sort((a, b) =>
    a.kind === b.kind ? Number(a.num) - Number(b.num) : a.kind === "figure" ? -1 : 1,
  );
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/**
 * Föreslagen ruta för en figur eller tabell. Figurens bildtext står oftast
 * under figuren, tabellens rubrik över tabellen. Rutan går från bildtexten
 * till närmaste rad med vanlig löptext. Presentatören kan rita om den.
 */
export function suggestBox(page: PdfPage, cap: Caption): Box {
  const ls = lines(page);
  const body = median(ls.filter((l) => l.text.trim().length > 40).map((l) => l.h)) || 9;
  const minX = Math.min(...ls.map((l) => l.x0));
  const maxX = Math.max(...ls.map((l) => l.x1));
  const minY = Math.min(...ls.map((l) => l.y));
  // Sidhuvudet (tidskriftens namn, DOI) räknas inte till figuren
  const maxY = Math.min(Math.max(...ls.map((l) => l.y + l.h)), page.height * 0.94);
  const mid = (minX + maxX) / 2;
  const left: [number, number] = [minX, mid - 4];
  const right: [number, number] = [mid + 4, maxX];

  // Vanlig löptext: lång rad i normal storlek. Sådana rader finns inte i
  // figurer (axeltexter är korta eller mindre) och avgränsar figuren.
  const isBody = (l: Line, [c0, c1]: [number, number], minLen = 40) =>
    l.text.trim().length > minLen &&
    l.h >= body * 0.9 &&
    l.x1 - l.x0 > (maxX - minX) * 0.25 &&
    l.x1 > c0 + 2 &&
    l.x0 < c1 - 2;

  const a = cap.anchor;
  const spansBoth = a.w > (maxX - minX) * 0.55 || (a.x < mid - 20 && a.x + a.w > mid + 20);
  const own = a.x < mid ? left : right;
  const other = a.x < mid ? right : left;

  if (cap.kind === "figure") {
    // Figuren står ovanför bildtexten, upp till närmaste löptext i spalten
    const top = a.y + a.h;
    const firstBodyAbove = (col: [number, number]) => {
      const ys = ls.filter((l) => l.y > top + 1 && isBody(l, col)).map((l) => l.y);
      return ys.length ? Math.min(...ys) - 2 : maxY + 2;
    };
    let cols: [number, number] = spansBoth ? [minX, maxX] : own;
    let y1 = spansBoth
      ? Math.min(firstBodyAbove(left), firstBodyAbove(right))
      : firstBodyAbove(own);
    // Ingen löptext i den andra spalten i samma höjd: figuren går över hela bredden
    if (!spansBoth && !ls.some((l) => l.y > top + 1 && l.y < y1 && isBody(l, other))) {
      cols = [minX, maxX];
      y1 = Math.min(y1, firstBodyAbove(other));
    }
    // Orimligt låg ruta. Står bildtexten högst upp på sidan ligger figuren
    // troligen under den. Annars står löptext direkt ovanför bildtexten, och
    // figuren finns någon annanstans: föreslå hela sidan, så att
    // presentatören ser att rutan behöver ritas.
    if (y1 - top < page.height * 0.12) {
      if (maxY - top < page.height * 0.15) {
        const next = ls.filter(
          (l) => l.y < a.y - body && /^(Fig|FIG|Table|TABLE)/.test(l.text.trim()),
        );
        const yEnd = next.length ? Math.max(...next.map((l) => l.y + l.h)) + 2 : minY - 2;
        return {
          x: cols[0] - 2,
          y: yEnd,
          w: cols[1] - cols[0] + 4,
          h: Math.max(20, a.y - 2 - yEnd),
        };
      }
      return { x: minX - 2, y: minY - 2, w: maxX - minX + 4, h: maxY - minY + 4 };
    }
    return { x: cols[0] - 2, y: top + 1, w: cols[1] - cols[0] + 4, h: Math.max(20, y1 - top - 1) };
  }
  // Tabell: från rubriken nedåt till nästa stycke löptext
  const cols: [number, number] = spansBoth ? [minX, maxX] : own;
  const below = ls.filter((l) => l.y < a.y - body * 2 && isBody(l, cols, 70));
  const yEnd = below.length ? Math.max(...below.map((l) => l.y + l.h)) + 2 : minY - 2;
  return {
    x: cols[0] - 2,
    y: yEnd,
    w: cols[1] - cols[0] + 4,
    h: Math.max(20, a.y + a.h + 2 - yEnd),
  };
}

// --- Allt ----------------------------------------------------------------------

export function analyzePdf(pages: PdfPage[]): PdfFindings {
  const chars = pages.reduce((n, p) => n + p.items.reduce((m, it) => m + it.str.length, 0), 0);
  return {
    pages: pages.length,
    effects: findEffects(pages),
    captions: findCaptions(pages),
    ncts: findNcts(pages),
    ...findSections(pages),
    noText: chars < pages.length * 200,
  };
}
