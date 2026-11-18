import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/Segmented";
import { KIND_LABEL } from "@/components/ChecklistPrep";
import type { Article } from "@/lib/articles";
import {
  CONCERN_LABEL,
  DOMAINS,
  DOMAIN_INFO,
  gradeLevel,
  type Concern,
  type Grade,
  type GradeDomain,
} from "@/lib/grade";
import { designOf } from "@/lib/jc-pptx";
import type { Passage, PassageKind } from "@/lib/pdf-extract";
import { cn } from "@/lib/utils";

/** Underlag ur PDF:en per domän, ordagrant. Inget underlag för samstämmighet och publikationsbias. */
const FACTS: Record<GradeDomain, PassageKind[]> = {
  bias: ["masking", "analysis", "design"],
  inconsistency: [],
  indirectness: ["population", "primaryEndpoint"],
  imprecision: [],
  publication: [],
};

const CONCERNS: { value: Concern; label: string; title: string }[] = [
  { value: "none", label: "Inga", title: CONCERN_LABEL.none },
  { value: "serious", label: "−1", title: CONCERN_LABEL.serious },
  { value: "very", label: "−2", title: CONCERN_LABEL.very },
  { value: "na", label: "Ej bedömbar", title: CONCERN_LABEL.na },
];

function initial(article: Article): Grade {
  // Randomiserad studie börjar högt; övriga (även icke-randomiserade prövningar) lågt
  return { outcome: "", start: designOf(article) === "rct" ? "high" : "low", domains: {} };
}

/** Bedömningen för en artikel, sparad i webbläsaren. */
export function useGrade(article: Article) {
  const key = `presentation-grade:${article.url}`;
  const [grade, setGrade] = useState<Grade>(() => initial(article));
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    let next = initial(article);
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Partial<Grade>) : null;
      if (parsed && typeof parsed === "object")
        next = {
          ...next,
          ...parsed,
          domains: parsed.domains && typeof parsed.domains === "object" ? parsed.domains : {},
        };
    } catch {
      // Lagring blockerad eller trasig: börja om
    }
    setGrade(next);
    setLoadedKey(key);
    // Artikeln byts bara tillsammans med nyckeln
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (loadedKey !== key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(grade));
    } catch {
      // Lagring blockerad: gäller bara den här sidvisningen
    }
  }, [key, grade, loadedKey]);

  const setDomain = useCallback(
    (d: GradeDomain, patch: { concern?: Concern; note?: string }) =>
      setGrade((g) => ({ ...g, domains: { ...g.domains, [d]: { ...g.domains[d], ...patch } } })),
    [],
  );
  return { grade, setGrade, setDomain };
}

/**
 * Förenklad GRADE-bedömning av ett utfall. Presentatören väljer och
 * motiverar; appen visar underlag ur PDF:en ordagrant och räknar ut nivån.
 */
export function GradeCard({
  article,
  passages,
  primary,
  grade,
  setGrade,
  setDomain,
}: {
  article: Article;
  passages: Passage[] | null;
  /** Det primära effektmått som valts ur PDF:en */
  primary: string | null;
  grade: Grade;
  setGrade: (fn: (g: Grade) => Grade) => void;
  setDomain: (d: GradeDomain, patch: { concern?: Concern; note?: string }) => void;
}) {
  const r = gradeLevel(grade);
  const registry = (article.trials?.studies ?? [])
    .flatMap((t) => (t.primary_outcomes ?? []).map((o) => ({ nct: t.nct, ...o })))
    .filter((o) => o.measure);
  const missing = DOMAINS.filter((d) => !grade.domains[d]?.concern).length;

  return (
    <section className="rounded-md border border-border bg-card px-5 py-5 sm:px-6 print:rounded-none print:border-0 print:p-0">
      <h2 className="text-heading font-semibold tracking-[-0.01em]">Förenklad GRADE</h2>
      <p className="mt-1 text-meta text-pretty text-muted-foreground">
        Tillförlitligheten för ett utfall i den här studien. Du väljer och motiverar; appen visar
        underlag ur PDF:en ordagrant och räknar ut nivån. Kommer med på bild 7 när alla fem domäner
        är bedömda.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="grade-utfall" className="text-xs text-muted-foreground">
            Utfall
          </Label>
          <Input
            id="grade-utfall"
            value={grade.outcome}
            onChange={(e) => setGrade((g) => ({ ...g, outcome: e.target.value }))}
            placeholder="t.ex. PFS enligt BICR"
          />
          {primary && <p className="text-xs text-muted-foreground">Valt primärt mått: {primary}</p>}
        </div>
        <Segmented
          label="Startnivå"
          value={grade.start}
          options={[
            { value: "high", label: "Hög, randomiserad" },
            { value: "low", label: "Låg, observationell" },
          ]}
          onChange={(start) => setGrade((g) => ({ ...g, start }))}
          fill
        />
      </div>

      <ol className="mt-5 flex flex-col gap-5">
        {DOMAINS.map((d) => {
          const facts = (passages ?? []).filter((p) => FACTS[d].includes(p.kind));
          const v = grade.domains[d];
          return (
            <li key={d} className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">{DOMAIN_INFO[d].label}</p>
              <p className="text-xs text-pretty text-muted-foreground">{DOMAIN_INFO[d].help}</p>
              {facts.length > 0 && (
                <ul className="flex flex-col gap-1 border-l-2 border-border pl-3">
                  {facts.map((p) => (
                    <li key={p.id} className="text-xs">
                      <span className="font-medium">{KIND_LABEL[p.kind]}</span>
                      <span className="text-muted-foreground"> · sidan {p.page}</span>
                      <span className="mt-0.5 line-clamp-3 block italic text-ink-2" title={p.text}>
                        ”{p.text}”
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {d === "indirectness" && registry.length > 0 && (
                <ul className="flex flex-col gap-1 border-l-2 border-border pl-3">
                  {registry.map((o, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-medium">Primärt effektmått i registret</span>
                      <span className="text-muted-foreground"> · {o.nct}</span>
                      <span className="mt-0.5 block italic text-ink-2">”{o.measure}”</span>
                    </li>
                  ))}
                </ul>
              )}
              {d === "imprecision" && primary && (
                <p className="border-l-2 border-border pl-3 text-xs">
                  <span className="font-medium">Valt primärt mått</span>
                  <span className="mt-0.5 block text-ink-2">{primary}</span>
                </p>
              )}
              <Segmented
                label="Bedömning"
                ariaLabel={`Bedömning: ${DOMAIN_INFO[d].label}`}
                value={v?.concern ?? "__none__"}
                options={CONCERNS}
                onChange={(concern) => setDomain(d, { concern })}
                fill
              />
              <Input
                value={v?.note ?? ""}
                onChange={(e) => setDomain(d, { note: e.target.value })}
                placeholder="Motivering"
                aria-label={`Motivering: ${DOMAIN_INFO[d].label}`}
                className="text-sm"
              />
            </li>
          );
        })}
        {grade.start === "low" && (
          <li className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Uppgradering</p>
            <p className="text-xs text-muted-foreground">
              Bara för observationsstudier: stor effekt, dos–respons, kvarvarande confounding som
              talar emot effekten.
            </p>
            <Segmented
              label="Uppgradering"
              value={grade.upgrade ?? 0}
              options={[
                { value: 0, label: "Ingen" },
                { value: 1, label: "+1" },
                { value: 2, label: "+2" },
              ]}
              onChange={(upgrade) => setGrade((g) => ({ ...g, upgrade: upgrade as 0 | 1 | 2 }))}
              fill
            />
            <Input
              value={grade.upgradeNote ?? ""}
              onChange={(e) => setGrade((g) => ({ ...g, upgradeNote: e.target.value }))}
              placeholder="Motivering"
              aria-label="Motivering: uppgradering"
              className="text-sm"
            />
          </li>
        )}
      </ol>

      <div
        className={cn(
          "mt-5 rounded-md border border-border px-4 py-3",
          !r.complete && "border-dashed",
        )}
        aria-live="polite"
      >
        <p className="text-xs text-muted-foreground">Tillförlitlighet</p>
        <p className="text-lg font-semibold">
          {r.label} <span aria-hidden>{r.symbols}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {r.complete
            ? "Kommer med på bild 7, med skälen för varje nedgradering."
            : `${missing} av 5 domäner kvar att bedöma.`}
        </p>
      </div>
    </section>
  );
}
