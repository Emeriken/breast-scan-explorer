// Central färgkodning av kategorier. Ändra här för att uppdatera överallt.

export type CategoryColor = {
  /** Tailwind-vänlig bakgrund (mjuk) */
  bg: string;
  /** Tailwind-vänlig textfärg (mörkare nyans) */
  text: string;
  /** Solid accentfärg (för punkter, kanter, diagram) */
  solid: string;
  /** Visningsnamn för legend */
  label: string;
};

export const CATEGORY_COLORS: Record<string, CategoryColor> = {
  cytotoxisk: {
    label: "Cytotoxisk behandling",
    bg: "#DBEAFE",
    text: "#1E3A8A",
    solid: "#2563EB",
  },
  endokrin: {
    label: "Endokrin behandling",
    bg: "#EDE9FE",
    text: "#4C1D95",
    solid: "#7C3AED",
  },
  stralbehandling: {
    label: "Strålbehandling",
    bg: "#FFEDD5",
    text: "#7C2D12",
    solid: "#EA580C",
  },
  arftlighet: {
    label: "Ärftlighet",
    bg: "#DCFCE7",
    text: "#14532D",
    solid: "#16A34A",
  },
  preklinisk: {
    label: "Preklinisk/translationell",
    bg: "#E2E8F0",
    text: "#1E293B",
    solid: "#475569",
  },
  ovrigt: {
    label: "Övrigt",
    bg: "#F3F4F6",
    text: "#374151",
    solid: "#6B7280",
  },
};

const FALLBACK: CategoryColor = CATEGORY_COLORS.ovrigt;

function normalize(s: string): string {
  return s.toLowerCase().replace(/å|ä/g, "a").replace(/ö/g, "o");
}

export function categoryColor(category: string | undefined | null): CategoryColor {
  if (!category) return FALLBACK;
  const n = normalize(category);
  if (/(cytotox|kemo|chemo)/.test(n)) return CATEGORY_COLORS.cytotoxisk;
  if (/(endokrin|endocrine|hormon)/.test(n)) return CATEGORY_COLORS.endokrin;
  if (/(stral|radiation|radioth|radiot)/.test(n)) return CATEGORY_COLORS.stralbehandling;
  if (/(arftlig|arftlighet|brca|genetik|hereditar|hereditary)/.test(n))
    return CATEGORY_COLORS.arftlighet;
  if (/(preklin|translation|in vitro|in vivo|grundforskning)/.test(n))
    return CATEGORY_COLORS.preklinisk;
  return FALLBACK;
}

/** Externa länk-attribut för att alltid öppna i nytt tab. */
export const externalLinkProps = {
  target: "_blank" as const,
  rel: "noopener noreferrer" as const,
};

/**
 * Centrala diagramfärger för statistikvyn, som CSS-variabler så att de följer
 * ljust och mörkt tema (se styles.css). Kategorifärgerna används bara i
 * diagrammet per kategori, där de betyder kategori. Övriga diagram har en
 * enda serie och använder en neutral färg.
 */
export const CHART_COLORS = {
  bar: "var(--chart-bar)", // En serie (relevanspoäng, tidskrifter, nivåer, månader)
  partial: "var(--chart-partial)", // Ofullständig period, t.ex. innevarande månad
  tick: "var(--chart-tick)", // Axeltext
  label: "var(--chart-label)", // Värden vid staplarna
  grid: "var(--chart-grid)", // Axellinjer
};

/**
 * Vad varje kategori omfattar, ordagrant från instruktionen som AI:n
 * kategoriserar efter (SCORING_SYSTEM_PROMPT i pubmed-bevaknng/scripts/screen.py).
 * Ändras kategorierna där ska texten ändras här.
 */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Cytotoxisk behandling":
    "Kemoterapi, ADC (T-DXd, sacituzumab), checkpoint-hämmare/immunterapi (pembrolizumab, atezolizumab), och kombinationer av dessa. Inkluderar både neoadjuvant, adjuvant och metastaserad behandling.",
  "Endokrin behandling":
    "Aromatashämmare, tamoxifen, fulvestrant, SERDs, CDK4/6-hämmare (palbociclib, ribociclib, abemaciclib), PI3K/AKT/mTOR-hämmare (alpelisib, capivasertib, everolimus), och kombinationer.",
  Strålbehandling:
    "All radioterapi, inklusive partiell bröstbestrålning, hypofraktionering, regional nodal irradiation, SBRT mot metastaser.",
  Ärftlighet:
    "BRCA1/2, PALB2, andra hereditära syndrom, genetisk testning, riskreducerande kirurgi, PARP-hämmare (olaparib, talazoparib) när fokus är ärftlighet.",
  "Preklinisk/translationell":
    "In vitro, djurmodeller, molekylära mekanismer, biomarkörsupptäckt, organoider, tumörbiologi utan direkt klinisk implementering ännu.",
  Övrigt:
    "Allt annat (epidemiologi, screening, kirurgi, diagnostik/avbildning, palliativ vård, livskvalitet, riktlinjer som spänner över flera områden).",
};
