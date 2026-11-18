/**
 * Förenklad GRADE-bedömning av tillförlitligheten för ett utfall i en enskild
 * studie. Alla val och motiveringar gör presentatören; appen räknar bara ut
 * nivån mekaniskt: startnivå minus nedgraderingar (plus uppgradering för
 * observationsstudier). Termerna följer SBU:s svenska GRADE-termer.
 */

export type GradeDomain = "bias" | "inconsistency" | "indirectness" | "imprecision" | "publication";

/** none: inga allvarliga brister; serious: ett steg ned; very: två steg ned; na: kan inte bedömas */
export type Concern = "none" | "serious" | "very" | "na";

export type Grade = {
  /** Utfallet som bedöms, t.ex. "PFS" */
  outcome: string;
  /** Startnivå: randomiserad studie börjar högt, observationsstudie lågt */
  start: "high" | "low";
  domains: Partial<Record<GradeDomain, { concern?: Concern; note?: string }>>;
  /** Uppgradering (bara observationsstudier): stor effekt, dos–respons */
  upgrade?: 0 | 1 | 2;
  upgradeNote?: string;
};

export const DOMAINS: GradeDomain[] = [
  "bias",
  "inconsistency",
  "indirectness",
  "imprecision",
  "publication",
];

export const DOMAIN_INFO: Record<GradeDomain, { label: string; help: string }> = {
  bias: {
    label: "Risk för systematiska fel (bias)",
    help: "Randomisering och dold allokering, blindning, bortfall, analys enligt intention-to-treat, selektiv rapportering.",
  },
  inconsistency: {
    label: "Bristande överensstämmelse",
    help: "Stämmer resultatet med andra studier av samma fråga? För en enskild studie oftast: kan inte bedömas.",
  },
  indirectness: {
    label: "Bristande överförbarhet (indirekthet)",
    help: "Liknar population, intervention och jämförelsearm det vi vill veta? Surrogatmått (t.ex. PFS i stället för OS) hör hit.",
  },
  imprecision: {
    label: "Bristande precision",
    help: "Brett konfidensintervall, intervall som korsar ingen effekt eller en kliniskt relevant gräns, få händelser.",
  },
  publication: {
    label: "Publikationsbias",
    help: "Saknas studier med negativa resultat? För en enskild studie oftast: kan inte bedömas.",
  },
};

export const CONCERN_LABEL: Record<Concern, string> = {
  none: "Inga allvarliga brister",
  serious: "Allvarliga brister (−1)",
  very: "Mycket allvarliga brister (−2)",
  na: "Kan inte bedömas",
};

const MINUS: Record<Concern, number> = { none: 0, serious: 1, very: 2, na: 0 };

export const LEVELS = ["Mycket låg", "Låg", "Måttlig", "Hög"] as const;

export type GradeResult = {
  /** 0 = mycket låg … 3 = hög */
  level: number;
  label: (typeof LEVELS)[number];
  /** "⊕⊕⊕◯" */
  symbols: string;
  /** Alla fem domänerna har ett val */
  complete: boolean;
};

/** Nivån enligt valen: startnivå minus nedgraderingar, uppgradering bara från låg start. */
export function gradeLevel(g: Grade): GradeResult {
  let level = g.start === "high" ? 3 : 1;
  for (const d of DOMAINS) level -= MINUS[g.domains[d]?.concern ?? "none"];
  if (g.start === "low") level += g.upgrade ?? 0;
  level = Math.max(0, Math.min(3, level));
  return {
    level,
    label: LEVELS[level],
    symbols: "⊕".repeat(level + 1) + "◯".repeat(3 - level),
    complete: DOMAINS.every((d) => g.domains[d]?.concern),
  };
}

/** Raderna till presentationen: nivån och skälen för varje nedgradering. */
export function gradeLines(g: Grade): { summary: string; reasons: string[]; all: string[] } {
  const r = gradeLevel(g);
  const outcome = g.outcome.trim() || "det primära utfallet";
  const reasons = DOMAINS.flatMap((d) => {
    const c = g.domains[d]?.concern;
    if (c !== "serious" && c !== "very") return [];
    const note = g.domains[d]?.note?.trim();
    return [
      `${c === "very" ? "Två steg" : "Ett steg"} ned, ${DOMAIN_INFO[d].label.toLowerCase()}${note ? `: ${note}` : ""}`,
    ];
  });
  if (g.start === "low" && g.upgrade)
    reasons.push(
      `${g.upgrade === 2 ? "Två steg" : "Ett steg"} upp${g.upgradeNote?.trim() ? `: ${g.upgradeNote.trim()}` : ""}`,
    );
  const all = [
    `Startnivå: ${g.start === "high" ? "hög (randomiserad studie)" : "låg (observationsstudie)"}`,
    ...DOMAINS.map((d) => {
      const c = g.domains[d]?.concern;
      const note = g.domains[d]?.note?.trim();
      return `${DOMAIN_INFO[d].label}: ${c ? CONCERN_LABEL[c] : "inte bedömd"}${note ? `. ${note}` : ""}`;
    }),
    ...(g.start === "low" && g.upgrade
      ? [
          `Uppgradering: ${g.upgrade} steg${g.upgradeNote?.trim() ? `. ${g.upgradeNote.trim()}` : ""}`,
        ]
      : []),
  ];
  return { summary: `${r.label} ${r.symbols} för ${outcome}`, reasons, all };
}
