/** Externa länk-attribut för att alltid öppna i nytt tab. */
export const externalLinkProps = {
  target: "_blank" as const,
  rel: "noopener noreferrer" as const,
};

/**
 * Centrala diagramfärger för statistikvyn, som CSS-variabler så att de följer
 * ljust och mörkt tema (se styles.css). Alla diagram har en enda serie och
 * samma färg; kategorierna har ingen egen färg (de står alltid i text).
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
