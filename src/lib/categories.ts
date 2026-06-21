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
  return s
    .toLowerCase()
    .replace(/å|ä/g, "a")
    .replace(/ö/g, "o");
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

export function isExternalHref(href: string | undefined | null): boolean {
  if (!href) return false;
  return /^https?:\/\//i.test(href);
}