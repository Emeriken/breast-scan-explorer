import type { Article } from "@/lib/articles";
import { gradeLevel, gradeLines, type Grade } from "@/lib/grade";
import { formatPubDate, pmidFromUrl } from "@/lib/journals";
import { authorLine } from "@/lib/regulatory";
import { trialNoteLines, type ArticleTrials } from "@/lib/trials";
import { Zip } from "@/lib/zip";

/**
 * PowerPoint för journal club på SÖS mall (src/assets/jc-mall.pptx, byggd med
 * scripts/jc-mall/bygg_mall.py).
 *
 * Bilderna innehåller bara uppgifter från PubMed-posten och tydligt markerade
 * rutor för presentatören att fylla i. AI-texterna (motivering och
 * djupanalys) och abstractet läggs i talarens anteckningar, märkta med var de
 * kommer ifrån. Inga resultat, effektmått eller slutsatser skrivs av appen.
 */

/** En rad. `hint` är grå kursiv text för presentatören att ersätta; `onDark` behåller färgen (kursiv) på mörk bakgrund. */
export type Line = {
  text: string;
  hint?: boolean;
  onDark?: boolean;
  bold?: boolean;
  size?: number;
  /** Citat ur artikeln: kursivt och mörkgrått */
  quote?: boolean;
};
type Value = string | Line[];

/** Fält i checklistan där presentatören skriver egen text. */
export type PrepField =
  | "bakgrund"
  | "fraga"
  | "population"
  | "primart"
  | "sekundart"
  | "sakerhet"
  | "styrkor"
  | "begransningar"
  | "betydelse"
  | "overforbarhet"
  | "diskussion";

/**
 * Det presentatören förberett i checklistan: egen text per fält och de
 * meningar ur artikelns PDF som ska med, ordagrant med sidnummer.
 */
export type DeckPrep = {
  texts: Partial<Record<PrepField, string>>;
  quotes: { kind: string; text: string; page: number }[];
};

export type AbstractPart = { label?: string; text: string };

export type DeckInput = {
  article: Article;
  /** Journal clubens område, t.ex. "Cytotoxisk behandling" */
  area: string;
  presenter: string;
  /** "ÅÅÅÅ-MM-DD" */
  date: string;
  /** Abstract från PubMed, ordagrant, om det gick att hämta */
  abstract?: AbstractPart[] | null;
  /** AI-relevansens skala, ordagrant */
  rubric?: string;
  /** Det presentatören valt ur artikelns PDF (läst lokalt i webbläsaren) */
  pdf?: DeckPdf;
  /** Checklistans text och valda meningar */
  prep?: DeckPrep;
  /** Presentatörens förenklade GRADE-bedömning; med bara när alla domäner är bedömda */
  grade?: Grade;
};

/** Val ur artikelns PDF. Allt är bekräftat av presentatören. */
export type DeckPdf = {
  /** Effektmått till resultattabellen: rad 1 = primärt, 2 = sekundärt */
  effects: { row: 1 | 2; label: string; quote: string; page: number }[];
  /** Figurer och tabeller som bilder, i vald ordning */
  figures: {
    /** Rubrik på bilden, t.ex. "Figur 2" */
    title: string;
    /** Bildtexten ur PDF:en, ordagrant (förkortad), under rubriken */
    caption?: string;
    /** Kort namn i källraden, t.ex. "figur 2" */
    label: string;
    png: Uint8Array;
    width: number;
    height: number;
  }[];
  funding?: { text: string; page: number };
  coi?: { text: string; page: number };
  /**
   * Studien som presentatören valt. undefined: artikelns egen studie (om den
   * finns). null: ingen studie i presentationen.
   */
  trials?: ArticleTrials | null;
};

export type Design =
  | "rct"
  | "studie"
  | "observationell"
  | "metaanalys"
  | "oversikt"
  | "translationell"
  | "ovrig";

/** Studietyp utifrån PubMeds publikationstyper (och kategorin för translationell). */
export function designOf(a: Pick<Article, "publication_types" | "category">): Design {
  const t = new Set(Array.isArray(a.publication_types) ? a.publication_types : []);
  if (t.has("Meta-Analysis") || t.has("Systematic Review")) return "metaanalys";
  if (t.has("Randomized Controlled Trial")) return "rct";
  if ([...t].some((x) => x.startsWith("Clinical Trial"))) return "studie";
  if (t.has("Observational Study")) return "observationell";
  if (t.has("Review") || t.has("Practice Guideline") || t.has("Guideline")) return "oversikt";
  if (/preklinisk|translationell/i.test(a.category ?? "")) return "translationell";
  return "ovrig";
}

const hint = (text: string): Line => ({ text, hint: true });
const bold = (text: string): Line => ({ text, bold: true });

/** Metodfrågor att tänka igenom, per studietyp. Allmän kritisk granskning, inga påståenden om studien. */
const APPRAISAL: Record<Design, string[]> = {
  rct: [
    "Hur randomiserades och blindades patienterna?",
    "Analyserades resultatet enligt intention-to-treat?",
    "Är det primära effektmåttet kliniskt relevant?",
    "Är kontrollarmen den behandling vi ger i dag?",
    "Hur lång är uppföljningen, och är data mogna?",
    "Vilka subgruppsanalyser var förspecificerade?",
  ],
  studie: [
    "Finns en kontrollgrupp, och är den jämförbar?",
    "Hur valdes patienterna ut?",
    "Är effektmåttet kliniskt relevant?",
    "Vad krävs för att bekräfta fyndet?",
  ],
  observationell: [
    "Vilka störfaktorer justerades för, och vilka saknas?",
    "Finns risk för selektionsbias eller immortal time bias?",
    "Hur komplett är uppföljningen?",
    "Kan sambandet ha andra förklaringar än orsak och verkan?",
  ],
  metaanalys: [
    "Hur gjordes sökningen, och vilka studier ingår?",
    "Hur bedömdes risken för bias i de ingående studierna?",
    "Hur stor är heterogeniteten, och hur hanterades den?",
    "Finns tecken på publikationsbias?",
    "Bygger analysen på individdata eller publicerade data?",
  ],
  oversikt: [
    "Är översikten systematisk eller narrativ?",
    "Vilka studier bygger huvudbudskapen på?",
    "Finns jävsförhållanden att nämna?",
  ],
  translationell: [
    "Vilken modell användes, och hur väl speglar den patienter?",
    "Är fynden replikerade eller validerade i ett oberoende material?",
    "Hur långt är det till klinisk tillämpning?",
  ],
  ovrig: [
    "Vilken typ av studie är det?",
    "Hur valdes deltagarna ut?",
    "Vad är det viktigaste resultatet, och hur säkert är det?",
  ],
};

const TABLE: Record<Design, { head: string[]; rows: string[] }> = {
  rct: {
    head: ["Effektmått", "Intervention", "Kontroll", "Effekt (95 % KI)"],
    rows: ["Primärt", "Sekundärt", "Biverkningar grad ≥3"],
  },
  studie: {
    head: ["Effektmått", "Resultat", "Jämförelse", "95 % KI"],
    rows: ["Primärt", "Sekundärt", "Biverkningar grad ≥3"],
  },
  observationell: {
    head: ["Utfall", "Exponerade", "Ej exponerade", "Justerad effekt (95 % KI)"],
    rows: ["Primärt", "Sekundärt", ""],
  },
  metaanalys: {
    head: ["Utfall", "Studier (patienter)", "Poolad effekt (95 % KI)", "Heterogenitet (I²)"],
    rows: ["Primärt", "Sekundärt", "Subgrupp"],
  },
  oversikt: { head: ["Område", "Huvudbudskap", "Underlag", "Evidensläge"], rows: ["", "", ""] },
  translationell: { head: ["Experiment", "Modell", "Fynd", "Mått"], rows: ["", "", ""] },
  ovrig: { head: ["Utfall", "Grupp A", "Grupp B", "Effekt (95 % KI)"], rows: ["", "", ""] },
};

/** Kortar ett citat vid ett helt ord och markerar utelämnandet. */
function shortQuote(t: string, max: number): string {
  if (t.length <= max) return t;
  const cut = t.lastIndexOf(" ", max);
  return `${t.slice(0, cut > max * 0.6 ? cut : max).trimEnd()} …`;
}

/** Titelns storlek efter längd, så att den får plats i mallens titelruta. */
function titleSize(title: string): number {
  const n = title.length;
  if (n <= 40) return 3600;
  if (n <= 70) return 2800;
  if (n <= 120) return 2200;
  if (n <= 180) return 1800;
  return 1600;
}

function swedishDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
}

/** Allt som ska in i mallen, som markör → text. Ren funktion, testbar utan webbläsare. */
export function deckContent(input: DeckInput): Record<string, Value> {
  const { article: a, area, presenter, date, abstract, rubric, pdf, prep } = input;
  const grade = input.grade && gradeLevel(input.grade).complete ? input.grade : undefined;
  const gl = grade ? gradeLines(grade) : undefined;
  // Presentatörens egen text: en rad per rad i fältet
  const own = (field: PrepField, size?: number): Line[] =>
    (prep?.texts[field] ?? "")
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text) => ({ text, ...(size ? { size } : {}) }));
  // Valda meningar ur PDF:en: kortade på bilden, hela i anteckningarna
  const quotes = (kind: string) => (prep?.quotes ?? []).filter((q) => q.kind === kind);
  const quote = (kind: string, size: number, max = 220, count = 1): Line[] =>
    quotes(kind)
      .slice(0, count)
      .map((q) => ({
        text: `”${shortQuote(q.text, max)}” (s. ${q.page})`,
        quote: true,
        size,
      }));
  const fullQuotes = (...kinds: string[]): Line[] => {
    const qs = kinds.flatMap(quotes);
    return qs.length
      ? [
          { text: "" },
          { text: "Ur artikelns PDF, ordagrant (valt i checklistan):" },
          ...qs.map((q) => ({ text: `Sidan ${q.page}: "${q.text}"` })),
        ]
      : [];
  };
  // Fältets text, annars platshållaren
  const orHint = (lines: Line[], text: string): Line[] => (lines.length ? lines : [hint(text)]);
  const trials =
    pdf && pdf.trials !== undefined
      ? (pdf.trials ?? undefined)
      : a.trials?.studies.length
        ? a.trials
        : undefined;
  const design = designOf(a);
  const pmid = a.pmid ?? pmidFromUrl(a.url);
  const authors = authorLine(a.authors, a.author_count);
  const types = (Array.isArray(a.publication_types) ? a.publication_types : []).filter(
    (t) => typeof t === "string" && t !== "",
  );
  const shownTypes = types.length > 1 ? types.filter((t) => t !== "Journal Article") : types;
  const da = a.deep_analysis ?? {};
  const pubDate = a.pub_date ? formatPubDate(a.pub_date) : "";
  const interventional = design === "rct" || design === "studie";
  const table = TABLE[design];

  const strengths = (): Line[] => [
    bold("Styrkor"),
    ...orHint([...own("styrkor", 1200), ...quote("strengths", 900, 170)], "[Fyll i]"),
  ];
  // Författarnas egna begränsningar och presentatörens tillägg, åtskilda
  const mine0 = own("begransningar").length > 0;
  const limitations = (): Line[] => {
    // Kort på bilden; hela stycket står i anteckningarna
    const authors = quote("limitations", 900, mine0 ? 150 : 220);
    const mine = own("begransningar", 1200);
    if (!authors.length && !mine.length) return [bold("Begränsningar"), hint("[Fyll i]")];
    return [
      bold("Begränsningar"),
      ...(authors.length ? [{ text: "Enligt författarna:", size: 1000 }, ...authors] : []),
      ...(mine.length
        ? [{ text: "Egna tillägg:", size: 1000 }, ...mine]
        : [hint("[Egna tillägg: vad nämner inte författarna?]")]),
    ];
  };

  const c: Record<string, Value> = {
    TITEL: [{ text: a.title, size: titleSize(a.title) }],
    KALLA: [{ text: [a.journal, pubDate].filter(Boolean).join(", "), size: 1800 }],
    FORFATTARE: authors ? [{ text: authors, size: 1200 }] : [],
    ID: [
      {
        text: [pmid ? `PMID ${pmid}` : "", a.doi ? `DOI ${a.doi}` : ""].filter(Boolean).join(" · "),
        size: 1200,
      },
    ],
    PRESENTATOR: [
      {
        text: `Journal club, ${area.toLowerCase()} · ${presenter.trim() || "[Presentatör]"}`,
        size: 1400,
        hint: !presenter.trim(),
        onDark: true,
      },
    ],
    DATUM: swedishDate(date),

    S2_RUBRIK: "Bakgrund och frågeställning",
    S2_TEXT:
      design === "oversikt"
        ? [
            hint("[Fyll i: varför behövs översikten nu?]"),
            hint("[Fyll i: vilken fråga besvarar den?]"),
          ]
        : [
            ...orHint(
              own("bakgrund", 1600),
              "[Fyll i: vad visste vi före studien, och vilken kunskapslucka fyller den?]",
            ),
            ...(own("fraga", 1600).length || quotes("aim").length
              ? [...own("fraga", 1600), ...quote("aim", 1300, 300)]
              : [
                  hint(
                    "[Fyll i: frågeställningen, gärna som PICO: population, intervention, jämförelse, utfall]",
                  ),
                ]),
          ],

    S3_RUBRIK: design === "translationell" ? "Modell och metod" : "Design och population",
    S3_K1: [
      bold("Publikationstyp enligt PubMed"),
      ...shownTypes.map((t) => ({ text: t })),
      ...quote("design", 1000, 200),
    ],
    S3_K2:
      design === "metaanalys"
        ? [bold("Ingående studier"), hint("[Antal studier och patienter, sökperiod]")]
        : design === "translationell"
          ? [bold("Modell"), hint("[Cellinjer, djurmodell eller patientmaterial]")]
          : design === "oversikt"
            ? [bold("Underlag"), hint("[Vilka studier eller riktlinjer bygger den på?]")]
            : [
                bold("Population"),
                ...orHint(
                  [
                    ...own("population", 1200),
                    ...quote("population", 900, 140),
                    ...quote("followUp", 900, 120),
                  ],
                  "[Antal, inklusionskriterier, uppföljningstid]",
                ),
              ],
    S3_K3:
      design === "translationell"
        ? [bold("Metod"), hint("[Analyser och viktigaste mått]")]
        : [
            bold("Effektmått"),
            ...orHint(
              [...quote("primaryEndpoint", 1000, 200), ...own("primart", 1200)],
              "[Primärt och viktiga sekundära effektmått]",
            ),
          ],

    S4_RUBRIK: "Resultat",

    S5_RUBRIK: "Huvudfigur",
    S5_TEXT: [
      hint(
        design === "metaanalys"
          ? "[Klistra in forest plot för det primära utfallet och ange källan]"
          : design === "rct" || design === "studie"
            ? "[Klistra in den viktigaste figuren, till exempel Kaplan–Meier-kurvan, och ange källan]"
            : "[Klistra in den viktigaste figuren eller tabellen och ange källan]",
      ),
    ],

    S6_RUBRIK: interventional
      ? "Säkerhet, styrkor och begränsningar"
      : "Styrkor, begränsningar och överförbarhet",
    S6_K1: interventional
      ? [
          bold("Säkerhet"),
          ...orHint(
            [...own("sakerhet", 1200), ...quote("safety", 900, 170)],
            "[Biverkningar, avbrott, livskvalitet]",
          ),
        ]
      : strengths(),
    S6_K2: interventional ? strengths() : limitations(),
    S6_K3: interventional
      ? limitations()
      : [
          bold("Överförbarhet"),
          ...orHint(own("overforbarhet", 1200), "[Gäller resultatet våra patienter?]"),
        ],

    S7_RUBRIK: "Betydelse för våra patienter",
    S7_TEXT: [
      ...(own("betydelse").length
        ? own("betydelse")
        : [
            hint("[Fyll i: vilka av våra patienter berörs?]"),
            hint("[Fyll i: ändrar det vår praxis nu, senare eller inte alls?]"),
            hint("[Fyll i: slutsatsen i en mening]"),
          ]),
      ...(interventional && own("overforbarhet").length
        ? [bold("Överförbarhet"), ...own("overforbarhet")]
        : []),
      ...(gl
        ? [
            bold("Tillförlitlighet, förenklad GRADE (presentatörens bedömning)"),
            { text: gl.summary },
            ...gl.reasons.map((text) => ({ text, size: 1100 })),
          ]
        : []),
      ...(quotes("conclusion").length
        ? [bold("Författarnas slutsats"), ...quote("conclusion", 1200, 260)]
        : []),
    ],

    S8_RUBRIK: "Diskussion",
    S8_TEXT: own("diskussion").length
      ? own("diskussion").map((l) => ({ ...l, onDark: true }))
      : [
          { text: "[Diskussionsfråga 1]", hint: true, onDark: true },
          { text: "[Diskussionsfråga 2]", hint: true, onDark: true },
        ],
  };

  table.head.forEach((h, i) => (c[`T_0_${i}`] = h));
  for (let r = 1; r <= 3; r++)
    for (let col = 0; col < 4; col++) c[`T_${r}_${col}`] = col === 0 ? table.rows[r - 1] : "";
  // Effektmått ur PDF:en i kolumnen för effekt med konfidensintervall
  const effCol = table.head.reduce((last, h, i) => (/KI/.test(h) ? i : last), -1);
  if (effCol > 0) for (const e of pdf?.effects ?? []) c[`T_${e.row}_${effCol}`] = e.label;
  if (pdf?.figures.length) {
    c.S5_RUBRIK = pdf.figures[0].title;
    c.S5_TEXT = [];
  }

  // Talarens anteckningar: källor och AI-texter, märkta med ursprung
  const ai = "AI-genererat av Claude utifrån PubMed-posten. Kontrollera mot artikeln.";
  const abstractLines = (abstract ?? []).map((p) => ({
    text: p.label ? `${p.label}: ${p.text}` : p.text,
  }));
  const results = (abstract ?? []).filter((p) => /result|finding/i.test(p.label ?? ""));

  c.NOTES_1 = [
    { text: `Källa: ${[a.journal, pubDate].filter(Boolean).join(", ")}` },
    ...(authors ? [{ text: `Författare: ${authors}` }] : []),
    ...(pmid ? [{ text: `PubMed: https://pubmed.ncbi.nlm.nih.gov/${pmid}/` }] : []),
    ...(a.doi ? [{ text: `DOI: https://doi.org/${a.doi}` }] : []),
    {
      text: `AI-relevans ${Math.round(a.relevance_score)} av 5${rubric ? `: ${rubric}` : ""}. ${ai}`,
    },
    ...(abstractLines.length
      ? [{ text: "" }, { text: "Abstract från PubMed, ordagrant:" }, ...abstractLines]
      : [{ text: "" }, { text: "Abstractet kunde inte hämtas. Läs det i PubMed." }]),
  ];
  c.NOTES_2 = [
    ...fullQuotes("aim").slice(1),
    ...(quotes("aim").length ? [{ text: "" }] : []),
    ...(a.why_relevant
      ? [{ text: `AI-motivering: ${a.why_relevant}` }, { text: ai }, { text: "" }]
      : []),
    { text: "Frågor att besvara inför presentationen:" },
    ...APPRAISAL[design].map((q) => ({ text: `· ${q}` })),
  ];
  c.NOTES_3 = [
    { text: `Publikationstyp enligt PubMed: ${types.join(", ") || "saknas"}.` },
    { text: "Kontrollera designen i artikeln; PubMeds typning är ibland ofullständig." },
    ...(trials?.studies.length
      ? [{ text: "" }, ...trialNoteLines(trials).map((text) => ({ text }))]
      : []),
    ...fullQuotes("design", "population", "followUp", "primaryEndpoint"),
  ];
  c.NOTES_4 = [
    {
      text: "Ange effektmått med konfidensintervall. Statistisk signifikans är inte samma sak som klinisk betydelse.",
    },
    ...(da.central_finding
      ? [
          { text: "" },
          { text: `Centralt fynd enligt AI-djupanalysen: ${da.central_finding}` },
          { text: ai },
        ]
      : []),
    ...(results.length
      ? [
          { text: "" },
          { text: "Resultat ur abstractet, ordagrant:" },
          ...results.map((p) => ({ text: p.text })),
        ]
      : []),
    ...(pdf?.effects.length
      ? [
          { text: "" },
          { text: "Effektmått ur artikelns PDF (valda av presentatören):" },
          ...pdf.effects.flatMap((e) => [
            { text: `${e.row === 1 ? "Primärt" : "Sekundärt"}: ${e.label}` },
            { text: `Sidan ${e.page}: "${e.quote}"` },
          ]),
        ]
      : []),
    ...(own("sekundart").length
      ? [
          { text: "" },
          { text: "Sekundära effektmått och subgrupper (presentatörens anteckning):" },
          ...own("sekundart"),
        ]
      : []),
  ];
  c.NOTES_5 = [{ text: "Visa hellre en figur än många siffror. Ange figurens källa på bilden." }];
  c.NOTES_6 = [
    ...(da.limitation
      ? [{ text: `Begränsning enligt AI-djupanalysen: ${da.limitation}` }, { text: ai }]
      : [
          {
            text: "Tänk på både studiens egna begränsningar och hur väl den speglar våra patienter.",
          },
        ]),
    ...(pdf?.funding
      ? [
          { text: "" },
          {
            text: `Finansiering, ur artikelns PDF (sidan ${pdf.funding.page}): ${pdf.funding.text}`,
          },
        ]
      : []),
    ...(pdf?.coi
      ? [{ text: "" }, { text: `Jäv, ur artikelns PDF (sidan ${pdf.coi.page}): ${pdf.coi.text}` }]
      : []),
    ...fullQuotes("safety", "strengths", "limitations"),
  ];
  c.NOTES_7 = [
    { text: "Skilj mellan vad studien visar och din egen bedömning." },
    ...(gl
      ? [
          { text: "" },
          {
            text: `Förenklad GRADE-bedömning av presentatören, ${gl.summary}. En enskild studie; samstämmighet och publikationsbias går oftast inte att bedöma.`,
          },
          ...gl.all.map((text) => ({ text: `· ${text}` })),
        ]
      : []),
    ...fullQuotes("conclusion"),
  ];
  c.NOTES_8 = [{ text: "En eller två frågor räcker. Ställ dem öppet." }];
  return c;
}

// --- Ifyllning av mallens XML ---

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const HINT_COLOR = '<a:solidFill><a:srgbClr val="7F7F7F"/></a:solidFill>';

/** Gör om ett rPr-element (eller inget) med tillagda egenskaper. */
function runProps(base: string | undefined, line: Line): string {
  const attrs = new Map<string, string>();
  let inner = "";
  if (base) {
    const m = /^<a:rPr([^>]*?)(\/>|>([\s\S]*)<\/a:rPr>)$/.exec(base);
    if (m) {
      for (const am of m[1].matchAll(/(\w+)="([^"]*)"/g)) attrs.set(am[1], am[2]);
      inner = m[3] ?? "";
    }
  }
  attrs.set("lang", "sv-SE");
  if (line.size) attrs.set("sz", String(line.size));
  if (line.bold) attrs.set("b", "1");
  if (line.quote) {
    attrs.set("i", "1");
    inner =
      '<a:solidFill><a:srgbClr val="595959"/></a:solidFill>' +
      inner.replace(/<a:solidFill>[\s\S]*?<\/a:solidFill>/, "");
  }
  if (line.hint) {
    attrs.set("i", "1");
    if (!line.onDark)
      inner = HINT_COLOR + inner.replace(/<a:solidFill>[\s\S]*?<\/a:solidFill>/, "");
  }
  const a = [...attrs].map(([k, v]) => ` ${k}="${v}"`).join("");
  return inner ? `<a:rPr${a}>${inner}</a:rPr>` : `<a:rPr${a}/>`;
}

/** Ersätt varje markör. Står den ensam i ett stycke blir det ett stycke per rad. */
export function fillXml(xml: string, content: Record<string, Value>): string {
  return xml.replace(
    /<a:p>((?:(?!<\/a:p>)[\s\S])*?)\{\{(\w+)\}\}([\s\S]*?)<\/a:p>/g,
    (whole, _pre, key) => {
      const value = content[key];
      if (value === undefined) throw new Error(`Okänd markör i mallen: ${key}`);
      const pPr = /<a:pPr[\s\S]*?(?:\/>|<\/a:pPr>)/.exec(whole)?.[0] ?? "";
      const rPr = /<a:rPr[^>]*?(?:\/>|>[\s\S]*?<\/a:rPr>)/.exec(whole)?.[0];
      const lines: Line[] = typeof value === "string" ? [{ text: value }] : value;
      if (lines.length === 0) return `<a:p>${pPr}<a:endParaRPr lang="sv-SE"/></a:p>`;
      return lines
        .map((l) =>
          l.text === ""
            ? `<a:p>${pPr}<a:endParaRPr lang="sv-SE"/></a:p>`
            : `<a:p>${pPr}<a:r>${runProps(rPr, l)}<a:t>${esc(l.text)}</a:t></a:r></a:p>`,
        )
        .join("");
    },
  );
}

/** Fyll i mallen och returnera den färdiga .pptx-filen. */
export async function buildDeck(
  template: ArrayBuffer,
  input: DeckInput,
): Promise<Uint8Array<ArrayBuffer>> {
  const zip = Zip.read(template);
  const content = deckContent(input);
  const figureSlide = "ppt/slides/slide5.xml";
  const figureTemplate = input.pdf?.figures.length ? await zip.text(figureSlide) : "";
  for (const name of zip.names()) {
    if (!/^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(name)) continue;
    const xml = await zip.text(name);
    if (xml.includes("{{")) zip.setText(name, fillXml(xml, content));
  }
  if (input.pdf?.figures.length) await addFigures(zip, figureTemplate, content, input);
  await renumberSlides(zip);
  const core = "docProps/core.xml";
  if (zip.names().includes(core)) {
    const xml = await zip.text(core);
    zip.setText(
      core,
      xml.replace(
        /<dc:title>[\s\S]*?<\/dc:title>/,
        `<dc:title>${esc(input.article.title)}</dc:title>`,
      ),
    );
  }
  return zip.toBytes();
}

// --- Figurer ur artikelns PDF ---

const SLIDE_CT = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
const REL_IMAGE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const REL_SLIDE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
// Mallens figurbild (EMU, bilden är 9144000 × 5148263). Figuren får nästan
// hela bilden: en kort rubrik överst, bildtexten på en rad under den, figuren
// i ytan under och källraden ovanför sidfoten (SÖS-loggan står nere till höger).
const EMU_PER_IN = 914400;
const LEFT = 457200;
const WIDTH = 9144000 - 2 * LEFT;
const TITLE = { y: 260000, h: 460000 };
const CAPTION = { y: 760000, h: 300000 };
const AREA = { x: LEFT, y: 1110000, w: WIDTH, h: 3450000 };
const SOURCE_Y = 4590000;

/**
 * Figurens yta på bilden i tum, med bildtext. Används för att räkna ut hur
 * stor texten i figuren blir och om den behöver delas på flera bilder.
 */
export const FIGURE_AREA_IN = { w: AREA.w / EMU_PER_IN, h: AREA.h / EMU_PER_IN };

/** En textruta utan ram, i grått. */
function textBox(id: number, name: string, y: number, h: number, size: number, text: string) {
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${LEFT}" y="${y}"/><a:ext cx="${Math.round(WIDTH * 0.86)}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"><a:normAutofit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="sv-SE" sz="${size}"><a:solidFill><a:srgbClr val="7F7F7F"/></a:solidFill></a:rPr><a:t>${esc(text)}</a:t></a:r></a:p></p:txBody></p:sp>`
  );
}

function figureXml(
  slide: string,
  fig: NonNullable<DeckInput["pdf"]>["figures"][number],
  rid: string,
  source: string,
): string {
  // Textytan tas bort: bilden står där i stället. Rubrikrutan flyttas upp och
  // blir en rad i mindre storlek, så att figuren får plats.
  const withoutBody = slide
    .replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<p:ph type="body" idx="1"\/>[\s\S]*?<\/p:sp>/, "")
    .replace(
      /(<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<p:ph type="body" idx="14"[^>]*\/>[\s\S]*?)<p:spPr\/>([\s\S]*?<\/p:sp>)/,
      (_, head: string, tail: string) =>
        `${head}<p:spPr><a:xfrm><a:off x="${LEFT}" y="${TITLE.y}"/><a:ext cx="${WIDTH}" cy="${TITLE.h}"/></a:xfrm></p:spPr>` +
        tail.replace(/<a:r>(<a:rPr[^>]*\/>)?/g, '<a:r><a:rPr lang="sv-SE" sz="2200"/>'),
    );
  // Utan bildtext får figuren även bildtextens plats
  const top = fig.caption ? AREA.y : CAPTION.y;
  const room = AREA.y + AREA.h - top;
  const ratio = fig.width / fig.height;
  let w = AREA.w;
  let h = Math.round(w / ratio);
  if (h > room) {
    h = room;
    w = Math.round(h * ratio);
  }
  const x = AREA.x + Math.round((AREA.w - w) / 2);
  const y = top + Math.round((room - h) / 2);
  const pic =
    `<p:pic><p:nvPicPr><p:cNvPr id="950" name="${esc(fig.label)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln w="6350"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></p:spPr></p:pic>`;
  const caption = fig.caption
    ? textBox(952, "Bildtext", CAPTION.y, CAPTION.h, 1000, fig.caption)
    : "";
  const src = textBox(951, "Källa", SOURCE_Y, 170000, 800, source);
  return withoutBody.replace("</p:spTree>", caption + pic + src + "</p:spTree>");
}

/**
 * Sidnumret i sidfoten är ett fält med ett sparat värde. PowerPoint räknar om
 * det, men många visare (t.ex. i mobilen) visar det sparade. Sätt det till
 * bildens plats i ordningen, eftersom figurbilderna flyttar de följande.
 */
async function renumberSlides(zip: Zip): Promise<void> {
  const pres = await zip.text("ppt/presentation.xml");
  const rels = await zip.text("ppt/_rels/presentation.xml.rels");
  const target = new Map(
    [
      ...rels.matchAll(/<Relationship [^>]*?Id="([^"]+)"[^>]*?Target="(slides\/slide\d+\.xml)"/g),
    ].map((m) => [m[1], `ppt/${m[2]}`]),
  );
  const order = [...pres.matchAll(/<p:sldId [^>]*?r:id="([^"]+)"/g)].map((m) => target.get(m[1]));
  for (const [i, name] of order.entries()) {
    if (!name || !zip.names().includes(name)) continue;
    const xml = await zip.text(name);
    const next = xml.replace(
      /(<a:fld [^>]*type="slidenum"[^>]*>(?:(?!<\/a:fld>)[\s\S])*?<a:t>)\d*(<\/a:t>)/g,
      `$1${i + 1}$2`,
    );
    if (next !== xml) zip.setText(name, next);
  }
}

/**
 * Lägger in figurerna: den första på mallens figurbild (bild 5), resten som
 * nya bilder direkt efter, med samma layout. Varje bild får en källrad.
 */
async function addFigures(
  zip: Zip,
  template: string,
  content: Record<string, Value>,
  input: DeckInput,
): Promise<void> {
  const figs = input.pdf!.figures;
  const a = input.article;
  const pmid = a.pmid ?? pmidFromUrl(a.url);
  const pubDate = a.pub_date ? formatPubDate(a.pub_date) : "";
  const sourceOf = (label: string) =>
    `Källa: ${[a.journal, pubDate].filter(Boolean).join(", ")}; ${label}${pmid ? `. PMID ${pmid}` : ""}`;

  const names = zip.names();
  let nextSlide =
    Math.max(...names.map((n) => Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(n)?.[1] ?? 0))) + 1;
  const presRelsName = "ppt/_rels/presentation.xml.rels";
  let presRels = await zip.text(presRelsName);
  let pres = await zip.text("ppt/presentation.xml");
  let types = await zip.text("[Content_Types].xml");
  const slide5Rels = await zip.text("ppt/slides/_rels/slide5.xml.rels");
  const layoutRel = /<Relationship [^>]*slideLayout[^>]*\/>/.exec(slide5Rels)?.[0] ?? "";

  const rid5 = /<Relationship Id="([^"]+)"[^>]*Target="slides\/slide5\.xml"/.exec(presRels)?.[1];
  const ids = [...pres.matchAll(/<p:sldId id="(\d+)"/g)].map((m) => Number(m[1]));
  let nextId = Math.max(...ids) + 1;
  const newIds: string[] = [];

  for (let i = 0; i < figs.length; i++) {
    const fig = figs[i];
    const media = `ppt/media/pdf-figur-${i + 1}.png`;
    zip.add(media, fig.png);
    const slideXml = figureXml(
      fillXml(template, { ...content, S5_RUBRIK: fig.title, S5_TEXT: [] }),
      fig,
      "rIdPdfImg",
      sourceOf(fig.label),
    );
    const imgRel = `<Relationship Id="rIdPdfImg" Type="${REL_IMAGE}" Target="../media/pdf-figur-${i + 1}.png"/>`;
    if (i === 0) {
      zip.setText("ppt/slides/slide5.xml", slideXml);
      zip.setText(
        "ppt/slides/_rels/slide5.xml.rels",
        slide5Rels.replace("</Relationships>", imgRel + "</Relationships>"),
      );
      continue;
    }
    const n = nextSlide++;
    zip.add(`ppt/slides/slide${n}.xml`, new TextEncoder().encode(slideXml));
    zip.add(
      `ppt/slides/_rels/slide${n}.xml.rels`,
      new TextEncoder().encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${layoutRel}${imgRel}</Relationships>`,
      ),
    );
    const rid = `rIdPdfSlide${n}`;
    presRels = presRels.replace(
      "</Relationships>",
      `<Relationship Id="${rid}" Type="${REL_SLIDE}" Target="slides/slide${n}.xml"/></Relationships>`,
    );
    types = types.replace(
      "</Types>",
      `<Override PartName="/ppt/slides/slide${n}.xml" ContentType="${SLIDE_CT}"/></Types>`,
    );
    newIds.push(`<p:sldId id="${nextId++}" r:id="${rid}"/>`);
  }
  if (newIds.length) {
    // Direkt efter figurbilden i bildordningen
    pres = rid5
      ? pres.replace(new RegExp(`(<p:sldId id="\\d+" r:id="${rid5}"/>)`), `$1${newIds.join("")}`)
      : pres.replace("</p:sldIdLst>", `${newIds.join("")}</p:sldIdLst>`);
    zip.setText("ppt/presentation.xml", pres);
    zip.setText(presRelsName, presRels);
    zip.setText("[Content_Types].xml", types);
  }
}

/** Abstractet från PubMed (E-utilities), ordagrant. null om det inte gick att hämta. */
export async function fetchAbstract(
  pmid: string,
  timeoutMs = 8000,
): Promise<AbstractPart[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=${encodeURIComponent(pmid)}`,
      { signal: ctrl.signal },
    );
    if (!res.ok) return null;
    const doc = new DOMParser().parseFromString(await res.text(), "application/xml");
    const parts = Array.from(doc.querySelectorAll("Abstract > AbstractText")).map((el) => ({
      label: el.getAttribute("Label") ?? undefined,
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
    }));
    return parts.filter((p) => p.text).length ? parts.filter((p) => p.text) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Filnamn som fungerar i Windows och macOS. */
export function deckFileName(a: Article, date: string): string {
  const pmid = a.pmid ?? pmidFromUrl(a.url);
  return `Journal club ${date}${pmid ? ` PMID ${pmid}` : ""}.pptx`;
}
