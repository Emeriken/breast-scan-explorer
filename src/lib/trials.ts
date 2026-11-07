/**
 * Registrerade studier från ClinicalTrials.gov. Pipelinen (pubmed-bevaknng,
 * scripts/trials.py) hämtar dem utan AI för artiklar som anger ett
 * NCT-nummer och sparar dem ordagrant från registret i datafilen:
 * `trial_ids` per artikel och `trials.studies` överst.
 *
 * Uppgifterna är studiens registrering, inte vad artikeln rapporterar.
 */

export type TrialArm = { label?: string; type?: string; interventions?: string[] };
export type TrialOutcome = { measure?: string; time_frame?: string };

export type Trial = {
  nct: string;
  title?: string;
  acronym?: string;
  status?: string;
  start?: string;
  primary_completion?: string;
  sponsor?: string;
  study_type?: string;
  phases?: string[];
  allocation?: string;
  masking?: string;
  enrollment?: number;
  enrollment_type?: string;
  arms?: TrialArm[];
  primary_outcomes?: TrialOutcome[];
  has_results?: boolean;
};

/** Var NCT-numret hittades: PubMed-posten, förlaget (Crossref) eller artikelns metoddel (Europe PMC). */
export type TrialSource = "pubmed" | "crossref" | "europepmc" | "pdf";

/** Studierna som hör till en artikel, när registret lästes och var numret hittades. */
export type ArticleTrials = { studies: Trial[]; checkedAt?: string; source?: TrialSource };

type ArticleLike = { trial_ids?: unknown; trial_source?: unknown; trials?: ArticleTrials };

const SOURCES: TrialSource[] = ["pubmed", "crossref", "europepmc"];

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Kopplar studierna till artiklarna. Trasig eller saknad data ger inga studier. */
export function attachTrials<T extends ArticleLike>(articles: T[], raw: unknown): void {
  try {
    if (!isObj(raw) || !isObj(raw.studies)) return;
    const studies = raw.studies as Record<string, unknown>;
    const checkedAt = typeof raw.checked_at === "string" ? raw.checked_at : undefined;
    for (const a of articles) {
      if (!Array.isArray(a.trial_ids)) continue;
      const list: Trial[] = [];
      for (const id of new Set(a.trial_ids)) {
        const s = typeof id === "string" ? studies[id] : undefined;
        if (isObj(s) && typeof s.nct === "string") list.push(s as Trial);
      }
      const source = SOURCES.find((s) => s === a.trial_source);
      if (list.length) a.trials = { studies: list, checkedAt, source };
    }
  } catch {
    // Inga studier hellre än en trasig sida.
  }
}

export const trialUrl = (nct: string) => `https://clinicaltrials.gov/study/${nct}`;
export const isrctnUrl = (id: string) => `https://www.isrctn.com/${id}`;

/** Varifrån numret kom, som en mening. */
export const SOURCE_TEXT: Record<TrialSource, string> = {
  pubmed: "Numret står i PubMed-posten.",
  crossref: "Numret är anmält av förlaget (Crossref).",
  europepmc: "Numret står i artikelns metoddel (Europe PMC).",
  pdf: "Numret står i artikelns PDF och valdes av presentatören.",
};

type Json = Record<string, unknown>;
const get = (o: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>((v, k) => (isObj(v) ? v[k] : undefined), o);
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

/** Samma korta form som pipelinen sparar (scripts/trials.py, summarize). */
export function summarizeStudy(study: unknown): Trial | null {
  const ps = get(study, "protocolSection");
  const nct = str(get(ps, "identificationModule", "nctId"));
  if (!nct) return null;
  const phases = get(ps, "designModule", "phases");
  const arms = get(ps, "armsInterventionsModule", "armGroups");
  const outcomes = get(ps, "outcomesModule", "primaryOutcomes");
  const count = get(ps, "designModule", "enrollmentInfo", "count");
  return {
    nct,
    title: str(get(ps, "identificationModule", "briefTitle")),
    acronym: str(get(ps, "identificationModule", "acronym")),
    status: str(get(ps, "statusModule", "overallStatus")),
    start: str(get(ps, "statusModule", "startDateStruct", "date")),
    primary_completion: str(get(ps, "statusModule", "primaryCompletionDateStruct", "date")),
    sponsor: str(get(ps, "sponsorCollaboratorsModule", "leadSponsor", "name")),
    study_type: str(get(ps, "designModule", "studyType")),
    phases: Array.isArray(phases) ? phases.filter((x) => x !== "NA") : undefined,
    allocation: str(get(ps, "designModule", "designInfo", "allocation")),
    masking: str(get(ps, "designModule", "designInfo", "maskingInfo", "masking")),
    enrollment: typeof count === "number" ? count : undefined,
    enrollment_type: str(get(ps, "designModule", "enrollmentInfo", "type")),
    arms: Array.isArray(arms)
      ? (arms as Json[]).slice(0, 6).map((a) => ({
          label: str(a.label),
          type: str(a.type),
          interventions: Array.isArray(a.interventionNames)
            ? (a.interventionNames as unknown[]).filter((x): x is string => typeof x === "string")
            : undefined,
        }))
      : undefined,
    primary_outcomes: Array.isArray(outcomes)
      ? (outcomes as Json[])
          .slice(0, 3)
          .map((o) => ({ measure: str(o.measure), time_frame: str(o.timeFrame) }))
      : undefined,
    has_results: Boolean(get(study, "hasResults")),
  };
}

/** Hämta en studie direkt från ClinicalTrials.gov (API:t tillåter anrop från webbläsaren). */
export async function fetchTrial(nct: string, timeoutMs = 8000): Promise<Trial | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://clinicaltrials.gov/api/v2/studies/${encodeURIComponent(nct)}`,
      {
        signal: ctrl.signal,
      },
    );
    if (!res.ok) return null;
    return summarizeStudy(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** ISRCTN-nummer från pipelinen, bara giltiga. */
export function isrctnIds(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string" && /^ISRCTN\d{8}$/.test(x))
    : [];
}

type TrialLikeArticle = {
  title: string;
  publication_types?: string[];
  regulatory?: { substances: { name: string }[] };
};

/**
 * true för artiklar som ser ut att rapportera en egen studie (publikationstyp
 * eller titel), men inte översikter, riktlinjer, brev och kommentarer.
 */
export function looksLikeTrial(a: TrialLikeArticle): boolean {
  const types = (a.publication_types ?? []).join(" ");
  if (/Review|Guideline|Letter|Comment|Editorial|Erratum|Correction/i.test(types)) return false;
  return (
    /Trial/i.test(types) ||
    /\b(phase\s*(I{1,3}|[1-3])(\/(I{1,3}|[1-3]))?|randomi[sz]ed|trial)\b/i.test(a.title)
  );
}

/**
 * Sökord för ClinicalTrials.gov när artikeln saknar studienummer: början av
 * titeln fram till "versus", "plus" och liknande, utan inledande fraser som
 * "Efficacy and safety of". Användaren kontrollerar själv träffarna.
 */
export function trialSearchTerm(a: TrialLikeArticle): string | undefined {
  let t = a.title.replace(/\s+/g, " ").trim();
  t = t.replace(
    /^(a |an |the )?((randomi[sz]ed|open-label|multicenter|multicentre|double-blind|phase\s*\S+)\s+)*(trial|study) of /i,
    "",
  );
  t = t.replace(
    /^(efficacy|safety|efficacy and safety|final (results|analysis)|results|outcomes?) of /i,
    "",
  );
  const head = t.split(/\s(?:versus|vs\.?|plus|compared|with|in|for|as|after|among|:)\s/i)[0];
  const words = head
    .replace(/[():,]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  const term = words.join(" ");
  if (term.length >= 4) return term;
  return a.regulatory?.substances[0]?.name;
}

/** Sökning i ClinicalTrials.gov på bröstcancer och sökordet. */
export const trialSearchUrl = (term: string) =>
  `https://clinicaltrials.gov/search?cond=${encodeURIComponent("Breast Cancer")}&term=${encodeURIComponent(term)}`;

const STATUS: Record<string, string> = {
  NOT_YET_RECRUITING: "Har inte börjat rekrytera",
  RECRUITING: "Rekryterar",
  ENROLLING_BY_INVITATION: "Rekryterar på inbjudan",
  ACTIVE_NOT_RECRUITING: "Pågår, rekryterar inte",
  COMPLETED: "Avslutad",
  SUSPENDED: "Tillfälligt stoppad",
  TERMINATED: "Avbruten",
  WITHDRAWN: "Återkallad",
  UNKNOWN: "Okänd status",
};

const ALLOCATION: Record<string, string> = {
  RANDOMIZED: "randomiserad",
  NON_RANDOMIZED: "icke-randomiserad",
};

const MASKING: Record<string, string> = {
  NONE: "öppen",
  SINGLE: "enkelblind",
  DOUBLE: "dubbelblind",
  TRIPLE: "trippelblind",
  QUADRUPLE: "fyrfaldigt blind",
};

const ARM_TYPE: Record<string, string> = {
  EXPERIMENTAL: "Experimentell",
  ACTIVE_COMPARATOR: "Aktiv jämförelse",
  PLACEBO_COMPARATOR: "Placebo",
  SHAM_COMPARATOR: "Skenbehandling",
  NO_INTERVENTION: "Ingen intervention",
  OTHER: "Annan",
};

/** Registrets kod om den saknas i översättningen, t.ex. ny status. */
const label = (map: Record<string, string>, code?: string) =>
  code ? (map[code] ?? code.toLowerCase().replace(/_/g, " ")) : undefined;

export const statusLabel = (t: Trial) => label(STATUS, t.status);
export const armTypeLabel = (type?: string) => label(ARM_TYPE, type);

/** ["PHASE2", "PHASE3"] → "Fas 2/3", ["EARLY_PHASE1"] → "Tidig fas 1" */
export function phaseLabel(phases?: string[]): string | undefined {
  if (!phases?.length) return undefined;
  if (phases.length === 1 && phases[0] === "EARLY_PHASE1") return "Tidig fas 1";
  const nums = phases.map((p) => /PHASE(\d)/.exec(p)?.[1]).filter(Boolean);
  return nums.length ? `Fas ${nums.join("/")}` : undefined;
}

/** "Fas 3, randomiserad, öppen" (eller "Observationsstudie") */
export function designLabel(t: Trial): string | undefined {
  const parts = [
    t.study_type === "OBSERVATIONAL" ? "Observationsstudie" : phaseLabel(t.phases),
    label(ALLOCATION, t.allocation),
    label(MASKING, t.masking),
  ].filter(Boolean) as string[];
  if (!parts.length) return undefined;
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "543 deltagare (faktiskt antal)" */
export function enrollmentLabel(t: Trial): string | undefined {
  if (typeof t.enrollment !== "number") return undefined;
  const kind =
    t.enrollment_type === "ACTUAL"
      ? " (faktiskt antal)"
      : t.enrollment_type === "ESTIMATED"
        ? " (planerat)"
        : "";
  return `${t.enrollment.toLocaleString("sv-SE")} deltagare${kind}`;
}

/** "Drug: Eribulin" → "Eribulin" */
export const interventionName = (s: string) => s.replace(/^[A-Za-z ]+:\s*/, "");

const MONTH = new Intl.DateTimeFormat("sv-SE", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const DAY = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "2023-10-20" → "20 okt. 2023", "2023-10" → "okt. 2023" */
export function registryDate(d?: string): string | undefined {
  if (!d) return undefined;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(d);
  if (!m) return d;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1));
  return (m[3] ? DAY : MONTH).format(date);
}

/** Kort namn för ett chip: förkortningen om den finns, annars NCT-numret. */
export const trialShortName = (t: Trial) => t.acronym || t.nct;

/** Rader till talarens anteckningar i PowerPoint, märkta med källan. */
export function trialNoteLines(trials: ArticleTrials): string[] {
  const lines: string[] = [];
  const checked = trials.checkedAt ? registryDate(trials.checkedAt.slice(0, 10)) : undefined;
  for (const t of trials.studies) {
    lines.push(
      `Registrerad studie: ${t.nct}${t.acronym ? ` (${t.acronym})` : ""}, ${trialUrl(t.nct)}. ` +
        `Från ClinicalTrials.gov${checked ? `, hämtat ${checked}` : ""}. Registreringen, inte artikelns resultat.`,
    );
    const facts = [designLabel(t), enrollmentLabel(t), statusLabel(t)].filter(Boolean);
    if (facts.length) lines.push(`Design: ${facts.join(". ")}.`);
    for (const arm of t.arms ?? []) {
      const names = (arm.interventions ?? []).map(interventionName).join(", ");
      lines.push(
        `Arm${arm.type ? ` (${armTypeLabel(arm.type)?.toLowerCase()})` : ""}: ${arm.label ?? ""}${
          names && names !== arm.label ? ` – ${names}` : ""
        }`,
      );
    }
    for (const o of t.primary_outcomes ?? []) {
      if (o.measure)
        lines.push(`Primärt effektmått: ${o.measure}${o.time_frame ? ` (${o.time_frame})` : ""}`);
    }
  }
  return lines;
}
