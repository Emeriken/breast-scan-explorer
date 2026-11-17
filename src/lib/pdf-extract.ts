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
    .replace(/(\w)-\n(\w+)/g, (_, a: string, b: string) => a + (COMPOUND.test(b) ? "-" : "") + b) // avstavning vid radbrytning
    .replace(/[ \t]+/g, " ");
}

/**
 * Efterled som skrivs med bindestreck ("progression-free", "investigator-
 * assessed"). Bryts raden vid ett sådant bindestreck ska det stå kvar.
 */
const COMPOUND =
  /^(free|assessed|based|related|associated|positive|negative|specific|treated|naive|naïve|line|year|month|week|day|dense|term|grade|level|type|risk|dose|time|matched|adjusted|reported|blind|controlled|label|arm|group|period|up|like|induced|mediated|dependent|independent|targeted|expressing|amplified|mutated|mutant|low|high|ultralow|intensity|weighted|stratified|sensitive|resistant|wide|scale)$/i;

/** Avstavning när rader redan satts ihop med mellanslag: "ri- bociclib" → "ribociclib" */
export function joinHyphens(s: string): string {
  return s
    .replace(/(\p{L})- (\p{Ll}[\p{L}]*)/gu, (_, a: string, b: string) =>
      COMPOUND.test(b) ? `${a}-${b}` : `${a}${b}`,
    )
    .replace(/(\p{L})- (\p{Lu})/gu, "$1-$2"); // "Intention-to- Treat"
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

// Punkt efter dessa är ingen meningsgräns ("(Fig. 2)", "et al.", "vs.")
const ABBREV = /\b(?:Fig|Figs|Table|Tab|al|vs|No|Ref|Suppl|e\.g|i\.e|approx|ca|cf|Dr|St)\.$/i;

/** Index där meningen slutar i `s` (efter punkten), eller -1. */
function sentenceEnd(s: string): number {
  for (const m of s.matchAll(/[.!?](?=\s+[A-Z(]|\s*$)|\n\n/g)) {
    if (m[0] === "." && ABBREV.test(s.slice(0, m.index! + 1))) continue;
    return m.index! + 1;
  }
  return -1;
}

function sentenceAround(text: string, start: number, end: number): string {
  const from = Math.max(0, start - 600);
  const before = text.slice(from, start);
  const after = text.slice(end, end + 400);
  // Sista meningsgränsen före träffen
  let head = before;
  let cut = -1;
  for (const m of before.matchAll(/[.!?]\s+(?=[A-Z(])/g)) {
    if (m[0][0] === "." && ABBREV.test(before.slice(0, m.index! + 1))) continue;
    cut = m.index! + m[0].length;
  }
  if (cut >= 0) head = before.slice(cut);
  else if (from > 0) {
    // Ingen gräns i fönstret: börja vid ett helt ord och markera utelämnandet
    const w = before.search(/\s\S/);
    head = "… " + before.slice(w + 1);
  }
  const e = sentenceEnd(after);
  const tail = e >= 0 ? after.slice(0, e) : after;
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
  /(?:^|\n)\s*(Supported by|Funded by|Funding(?: source| statement| information)?|Financial support|Role of the funding source|Declaration of interests?|Competing interests?|Conflicts? of interest(?: disclosures?| statement)?|Disclosures?(?: of potential conflicts of interest)?|Authors?['’]? [Dd]isclosures?|Acknowledge?ments?)\s*[:.]?\s*/g;

function sectionKind(heading: string): "funding" | "coi" | "ack" {
  if (/acknowledg/i.test(heading)) return "ack";
  return /fund|financial support|supported by/i.test(heading) ? "funding" : "coi";
}

// NEJM: jävsdeklarationen finns bara som formulär på webben
const DISCLOSURE_FORMS_RE =
  /Disclosure forms provided by the authors are available[^.]*\.(?:\s*org\.)?/i;
// NEJM m.fl.: finansiären inom parentes sist i abstractet
const FUNDED_INLINE_RE = /\((Funded by [^;)]+)[;)]/;

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
      // "Supported by X" är en mening; rubriken hör till texten
      if (/^(supported|funded) by$/i.test(m[1])) {
        const end = body.search(/\.\s+[A-Z]/);
        body = `${m[1]} ${end > 0 ? body.slice(0, end + 1) : body}`;
      }
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
  if (!found.funding || !found.coi) {
    for (const p of pages) {
      const text = normalize(pageText(p)).replace(/\s+/g, " ");
      const f = FUNDED_INLINE_RE.exec(text);
      if (!found.funding && f)
        found.funding = { kind: "funding", page: p.page, heading: "Funded by", text: f[1] + "." };
      const d = DISCLOSURE_FORMS_RE.exec(text);
      if (!found.coi && d)
        found.coi = { kind: "coi", page: p.page, heading: "Disclosure", text: d[0] };
    }
  }
  // Utan eget avsnitt står finansieringen ofta i tacksägelsen, om den nämner stöd
  const ack = found.ack && /support|fund|grant/i.test(found.ack.text) ? found.ack : undefined;
  return { funding: found.funding ?? ack, coi: found.coi };
}

// --- Figurer och tabeller -------------------------------------------------------

const CAPTION_START =
  /^(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE)\s*(\d{1,2})\b\s*(\((?:facing|previous|next|following|preceding|opposite) page\))?\s*([.:|]?)\s*(.*)$/;

export function findCaptions(pages: PdfPage[]): Caption[] {
  const out: Caption[] = [];
  const seen = new Set<string>();
  for (const p of pages) {
    const ls = lines(p);
    ls.forEach((line, i) => {
      // En bildtext börjar en egen rad; hänvisningar i löptext gör det sällan
      const m = CAPTION_START.exec(normalize(line.text).trim());
      if (!m) return;
      const elsewhere = m[3];
      let rest = m[5];
      // Fortsättningsrader har samma textstorlek och följer tätt; tabellhuvudet
      // under bildtexten har oftast mindre text och hör inte dit
      let prev = line;
      for (let j = i + 1; j < ls.length && rest.length < 200; j++) {
        const l = ls[j];
        if (Math.abs(l.h - line.h) > line.h * 0.12 || prev.y - l.y > line.h * 2.2) break;
        // Flera celler på samma höjd under bildtexten: tabellhuvudet har börjat
        const span = line.x1 - line.x0 + 4;
        const cells = ls.filter(
          (o) => Math.abs(o.y - l.y) < 1 && o.x0 >= line.x0 - 2 && o.x0 < line.x0 + span,
        );
        if (cells.length > 1) break;
        rest += " " + l.text;
        prev = l;
      }
      rest = joinHyphens(normalize(rest).replace(/\s+/g, " ")).trim();
      // En bildtext börjar med versal efter numret (eller "|", ".", ":")
      if (!m[4] && !/^[A-Z]/.test(rest)) return;
      if (/^(shows?|summari[sz]es|lists|presents|and|or|in|of)\b/i.test(rest)) return;
      const kind = /^t/i.test(m[1]) ? "table" : "figure";
      const key = `${kind}${m[2]}`;
      if (seen.has(key)) return;
      seen.add(key);
      // Bildtexten slutar vid första meningen; "Baseline.*" räknas med fotnotstecknet
      const dot = /\.[*†‡§¶]*(?=\s)/.exec(rest);
      const end = dot ? dot.index + dot[0].length : -1;
      const text = (end > 15 && end < 180 ? rest.slice(0, end) : rest.slice(0, 160)).trim();
      if (elsewhere) {
        // Figuren står på en annan sida än bildtexten (NEJM: "facing page")
        const page = otherPage(pages, p.page, elsewhere);
        if (page) {
          out.push({ id: key, kind, num: m[2], page: page.page, text, anchor: bottomAnchor(page) });
          return;
        }
      }
      out.push({
        id: key,
        kind,
        num: m[2],
        page: p.page,
        text,
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

/** Sidan som "(facing page)", "(previous page)" o.d. syftar på. */
function otherPage(pages: PdfPage[], n: number, phrase: string): PdfPage | undefined {
  const at = (k: number) => pages.find((p) => p.page === k);
  if (/previous|preceding/i.test(phrase)) return at(n - 1);
  if (/next|following/i.test(phrase)) return at(n + 1);
  // Uppslag: jämna sidor står till vänster, udda till höger. Den andra sidan
  // i uppslaget, annars grannen med minst löptext.
  const pair = at(n % 2 ? n - 1 : n + 1);
  if (pair) return pair;
  return [at(n - 1), at(n + 1)].find(Boolean);
}

/**
 * Ankare för en figur vars bildtext står på en annan sida: en rad längst ned
 * på figursidan, så att figuren föreslås ovanför den, över hela bredden.
 */
function bottomAnchor(page: PdfPage): Caption["anchor"] {
  const ls = lines(page);
  const minX = Math.min(...ls.map((l) => l.x0));
  const maxX = Math.max(...ls.map((l) => l.x1));
  // Sidfoten (sidnummer, tidskriftens namn) står längst ned och hör inte till figuren
  const foot = ls.filter((l) => l.y < page.height * 0.08).map((l) => l.y + l.h);
  const y = foot.length ? Math.max(...foot) + 2 : page.height * 0.06;
  return { x: minX, y, w: maxX - minX, h: 0 };
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
  // Bildtexten står på en annan sida (bottomAnchor): figuren fyller sidan
  if (a.h === 0) {
    const bottom = Math.max(a.y, minY - 2);
    return { x: minX - 2, y: bottom, w: maxX - minX + 4, h: maxY + 2 - bottom };
  }
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
    // Ingen löptext i den andra spalten i samma höjd: figuren går över hela
    // bredden. Utom när den spalten har en egen bildtext i ungefär samma höjd:
    // då står två figurer bredvid varandra (t.ex. Fig. 2 och Fig. 3).
    const captionBeside = ls.some(
      (l) =>
        l !== ls.find((x) => x.y === a.y && x.x0 === a.x) &&
        l.x0 >= other[0] - 2 &&
        l.x0 < other[1] &&
        l.y > a.y - body * 6 &&
        l.y < y1 &&
        CAPTION_START.test(normalize(l.text).trim()),
    );
    if (
      !spansBoth &&
      !captionBeside &&
      !ls.some((l) => l.y > top + 1 && l.y < y1 && isBody(l, other))
    ) {
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
  // Tabell: från rubriken nedåt till första stycket löptext. Löptext känns
  // igen som minst tre långa rader i följd i normal storlek, nästan lika
  // breda som en spalt; tabellrader bryts av cellernas mellanrum och
  // fotnoterna har mindre text.
  const colW = (maxX - minX) / 2 - 8;
  const looksBody = (l: Line) =>
    l.y < a.y - body &&
    l.text.trim().length > 30 &&
    l.h >= body * 0.9 &&
    l.x1 - l.x0 >= colW * 0.85;
  // Bara löptext i bildtextens egen spalt (eller båda, om den går över båda)
  const cols: [number, number] = spansBoth ? [minX, maxX] : own;
  const cand = ls
    .filter((l) => looksBody(l) && l.x1 > cols[0] + 2 && l.x0 < cols[1] - 2)
    .sort((p, q) => q.y - p.y);
  const step = body * 1.6;
  // Början på ett stycke: minst två rader till strax under, i samma spalt
  const starts = cand.filter(
    (l) =>
      cand.filter((o) => Math.abs(o.x0 - l.x0) < 6 && o.y < l.y - 1 && o.y > l.y - 2.5 * step)
        .length >= 2,
  );
  const yEnd = starts.length ? Math.max(...starts.map((l) => l.y + l.h)) + 2 : minY - 2;
  // Bredden efter tabellens eget innehåll. Står det löptext i den andra
  // spalten bredvid tabellen hör tabellen bara till den egna spalten.
  const beside =
    !spansBoth &&
    ls.some(
      (l) => l.y > yEnd && l.y < a.y && looksBody(l) && l.x0 >= other[0] - 2 && l.x0 < other[1],
    );
  const inside = ls.filter(
    (l) =>
      l.y > yEnd &&
      l.y < a.y + a.h &&
      !looksBody(l) &&
      (!beside || (l.x1 > own[0] + 2 && l.x0 < own[1] - 2)),
  );
  const x0 = Math.min(a.x, ...inside.map((l) => l.x0));
  const x1 = Math.max(a.x + a.w, ...inside.map((l) => l.x1));
  return {
    x: Math.max(minX, x0) - 2,
    y: yEnd,
    w: Math.min(maxX, x1) - Math.max(minX, x0) + 4,
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
