import { Fragment } from "react";
import { Link } from "@tanstack/react-router";
import type { ArticleSearch } from "@/lib/article-search";
import { cn } from "@/lib/utils";

/**
 * MeSH-termer från NLM. Rutintermer (Humans, Female, åldersgrupper med
 * flera) gäller nästan alla artiklar och visas sist, utan länk. På korten
 * visas bara huvudämnena (de som NLM stjärnmärkt).
 */
const CHECK_TAGS = new Set([
  "Humans",
  "Female",
  "Male",
  "Animals",
  "Mice",
  "Rats",
  "Adult",
  "Aged",
  "Aged, 80 and over",
  "Middle Aged",
  "Young Adult",
  "Adolescent",
  "Child",
  "Child, Preschool",
  "Infant",
  "Infant, Newborn",
  "Pregnancy",
]);

/** Huvudämnen som gäller nästan hela listan och därför inte hjälper på korten. */
const TOO_COMMON_ON_CARDS = new Set(["Breast Neoplasms"]);

type MeshTerm = { term: string; major: boolean; check: boolean };

export function parseMesh(terms: string[] | undefined): MeshTerm[] {
  return (terms ?? [])
    .map((raw) => {
      const t = raw.trim();
      const major = t.endsWith("*");
      const term = major ? t.slice(0, -1).trim() : t;
      return { term, major, check: CHECK_TAGS.has(term) };
    })
    .filter((m) => m.term);
}

/** Huvudämnen att visa på ett kort. */
export function cardMesh(terms: string[] | undefined): MeshTerm[] {
  return parseMesh(terms).filter((m) => m.major && !m.check && !TOO_COMMON_ON_CARDS.has(m.term));
}

function MeshLink({
  m,
  merge,
  plain,
}: {
  m: MeshTerm;
  /** Lägg till filtret i listans nuvarande filter i stället för att ersätta dem */
  merge?: boolean;
  /** Som textlänk i löptext (på korten), i stället för som chip */
  plain?: boolean;
}) {
  return (
    <Link
      to="/"
      search={
        merge
          ? (prev: ArticleSearch) => ({ ...prev, mesh: m.term, n: undefined })
          : { mesh: m.term }
      }
      className={cn(
        "hit-area transition-colors",
        plain
          ? "rounded-sm text-foreground/80 underline decoration-border decoration-1 underline-offset-[3px] hover:text-foreground hover:decoration-foreground/60"
          : cn(
              "inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs",
              m.major
                ? "border-primary/40 bg-primary/10 font-semibold text-primary hover:bg-primary/20"
                : "border-input bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            ),
      )}
      title={`${m.major ? "Huvudämne enligt NLM. " : ""}Visa artiklar med MeSH-termen ${m.term}`}
    >
      {m.term}
    </Link>
  );
}

export function MeshTags({
  terms,
  variant = "full",
  merge,
  className,
}: {
  terms: string[] | undefined;
  variant?: "full" | "card";
  merge?: boolean;
  className?: string;
}) {
  if (variant === "card") {
    const majors = cardMesh(terms);
    if (majors.length === 0) return null;
    const shown = majors.slice(0, 3);
    const rest = majors.slice(3);
    return (
      <p className={cn("text-meta text-muted-foreground", className)}>
        <span>MeSH: </span>
        {shown.map((m, i) => (
          <Fragment key={m.term}>
            {i > 0 && <span aria-hidden> · </span>}
            <MeshLink m={m} merge={merge} plain />
          </Fragment>
        ))}
        {rest.length > 0 && <span title={rest.map((m) => m.term).join(", ")}> +{rest.length}</span>}
      </p>
    );
  }

  const all = parseMesh(terms);
  if (all.length === 0) return null;
  const linked = [
    ...all.filter((m) => m.major && !m.check),
    ...all.filter((m) => !m.major && !m.check),
  ];
  const routine = all.filter((m) => m.check);
  return (
    <div className={cn("space-y-2", className)}>
      {linked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {linked.map((m, i) => (
            <MeshLink key={`${m.term}-${i}`} m={m} merge={merge} />
          ))}
        </div>
      )}
      {routine.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Rutintermer: {routine.map((m) => m.term).join(", ")}
        </p>
      )}
    </div>
  );
}
