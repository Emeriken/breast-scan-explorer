import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { articlesQueryOptions, formatDay, PRODUCT_NAME } from "@/lib/articles";
import { batchOf, latestBatchKey, scoreOf } from "@/lib/article-list";
import type { ArticleSearch } from "@/lib/article-search";
import { CATEGORY_DESCRIPTIONS, CHART_COLORS } from "@/lib/categories";
import { journalLevel } from "@/lib/journals";
import { RUBRIC } from "@/components/Score";
import { JournalBadge } from "@/components/JournalBadge";
import { KiJlInfoTooltip } from "@/components/KiJlInfoTooltip";
import { DisclaimerFooter } from "@/components/Footer";
import { ErrorState } from "@/components/ErrorState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/statistik")({
  head: () => ({
    meta: [
      { title: `Statistik · ${PRODUCT_NAME}` },
      {
        name: "description",
        content: "Översikt över alla AI-bedömda bröstcancerartiklar.",
      },
    ],
  }),
  component: StatistikPage,
});

/** En rad i ett liggande stapeldiagram. Hela raden är en länk till listan. */
type BarRow = {
  key: string;
  label: ReactNode;
  /** Text för skärmläsare och verktygstips när `label` inte är ren text */
  name: string;
  sub?: string;
  value: number;
  search: ArticleSearch;
  /** Dämpad stapel, t.ex. AI-relevans 1–3 */
  muted?: boolean;
  title?: string;
};

/**
 * Liggande staplar som vanliga HTML-rader: namn, stapel och antal. Varje rad
 * är en riktig länk, så den går att nå med tangentbordet, öppna i ny flik och
 * läses upp med namn och antal.
 */
function BarList({ rows, labelWidth }: { rows: BarRow[]; labelWidth: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="-mx-2 flex flex-col">
      {rows.map((r) => (
        <li key={r.key}>
          <Link
            to="/"
            search={r.search}
            title={r.title}
            className="group grid min-h-8 items-center gap-x-3 rounded-sm px-2 py-1 hover:bg-muted/70"
            style={{ gridTemplateColumns: `${labelWidth} minmax(0,1fr)` }}
          >
            <span className="min-w-0 text-right">
              <span className="block truncate text-meta text-ink-2 underline decoration-input decoration-dotted underline-offset-2 group-hover:text-foreground group-hover:decoration-current">
                {r.label}
              </span>
              {r.sub && (
                <span className="block truncate text-xs leading-4 text-muted-foreground">
                  {r.sub}
                </span>
              )}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="min-w-0 flex-1">
                <span
                  className="block h-3.5 rounded-r-[4px]"
                  style={{
                    width: `${(r.value / max) * 100}%`,
                    minWidth: r.value > 0 ? 2 : 0,
                    background: r.muted ? CHART_COLORS.soft : CHART_COLORS.bar,
                  }}
                />
              </span>
              <span
                className="w-9 shrink-0 text-xs tabular-nums"
                style={{ color: CHART_COLORS.label }}
              >
                {r.value}
                <span className="sr-only"> artiklar</span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "2026-05-27" → "27 maj 2026" */
const LONG_DATE = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
function longDate(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  return m ? LONG_DATE.format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))) : day;
}
const SHORT_MONTH = new Intl.DateTimeFormat("sv-SE", { month: "short" });
const LONG_MONTH = new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" });

/** Skalans text fram till parentesen: "Mycket viktig (välgjord fas II …)" → "Mycket viktig" */
const shortRubric = (t: string) => t.split(" (")[0];

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

type MonthBar = {
  month: string;
  date: Date;
  total: number;
  top: number;
  /** Månaden är inte hel: bevakningen startade mitt i den, eller den pågår */
  partial: "start" | "current" | null;
};

/**
 * Tillagda artiklar per månad, uppdelade i AI-relevans 4–5 (mörkt, mot
 * baslinjen) och 1–3 (dämpat ovanpå). Andelen 4–5 står under varje månad.
 * Varje månad är en länk till listan filtrerad på månaden.
 */
function MonthChart({ months }: { months: MonthBar[] }) {
  const max = Math.max(1, ...months.map((m) => m.total));
  const PLOT = 150; // px för den högsta stapeln
  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <ol className="flex min-w-max items-stretch sm:min-w-0">
        {months.map((m, i) => {
          const share = pct(m.top, m.total);
          const showYear = i === 0 || m.date.getMonth() === 0;
          const label = LONG_MONTH.format(m.date);
          const partialText =
            m.partial === "start"
              ? " Bevakningen startade under månaden."
              : m.partial === "current"
                ? " Månaden pågår."
                : "";
          return (
            <li key={m.month} className="flex min-w-[2.5rem] flex-1 justify-center">
              <Link
                to="/"
                search={{ added: m.month }}
                aria-label={`${label}: ${m.total} artiklar, ${m.top} med AI-relevans 4–5 (${share} %).${partialText} Visa artiklarna`}
                title={`${label}: ${m.total} artiklar, ${m.top} med AI-relevans 4–5 (${share} %)${partialText}`}
                className="group flex w-full max-w-[5.5rem] flex-col items-center rounded-sm px-1 pt-1 hover:bg-muted/70"
              >
                <span
                  className="flex flex-col justify-end"
                  style={{ height: PLOT + 18 }}
                  aria-hidden
                >
                  <span
                    className="mb-1 block text-center text-xs tabular-nums"
                    style={{ color: CHART_COLORS.label }}
                  >
                    {m.total}
                  </span>
                  <span
                    className={cn("mx-auto flex w-7 flex-col gap-[2px]", m.partial && "opacity-45")}
                    style={{ height: (m.total / max) * PLOT }}
                  >
                    {m.total - m.top > 0 && (
                      <span
                        className="rounded-t-[4px]"
                        style={{
                          flex: m.total - m.top,
                          background: CHART_COLORS.soft,
                          minHeight: 1,
                        }}
                      />
                    )}
                    {m.top > 0 && (
                      <span
                        className={cn(m.total === m.top && "rounded-t-[4px]")}
                        style={{ flex: m.top, background: CHART_COLORS.bar, minHeight: 1 }}
                      />
                    )}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="mt-0 w-full border-t"
                  style={{ borderColor: CHART_COLORS.grid }}
                />
                <span
                  aria-hidden
                  className="mt-1.5 text-xs leading-4 text-ink-2 underline decoration-input decoration-dotted underline-offset-2 group-hover:text-foreground"
                >
                  {SHORT_MONTH.format(m.date).replace(".", "")}
                </span>
                <span aria-hidden className="text-xs leading-4 text-muted-foreground">
                  {showYear ? m.date.getFullYear() : " "}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 text-xs font-semibold tabular-nums sm:text-meta",
                    m.partial && "font-normal text-muted-foreground",
                  )}
                >
                  {share}&nbsp;%
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Förklaring till stapelfärgerna: två serier, så alltid en förklaring. */
function Legend45() {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2.5 w-2.5 rounded-[2px]"
          style={{ background: CHART_COLORS.bar }}
        />
        AI-relevans 4–5
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2.5 w-2.5 rounded-[2px]"
          style={{ background: CHART_COLORS.soft }}
        />
        1–3
      </span>
    </span>
  );
}

function StatistikPage() {
  const { data, isLoading, error, refetch } = useQuery(articlesQueryOptions);
  const articles = useMemo(() => data?.articles ?? [], [data]);
  const [allJournals, setAllJournals] = useState(false);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) m.set(a.category, (m.get(a.category) ?? 0) + 1);
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [articles]);

  // Samma avrundning som listans filter, så att antalen stämmer med listan
  const byScore = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const a of articles) counts[scoreOf(a)] += 1;
    return [5, 4, 3, 2, 1].map((s) => ({ score: s, value: counts[s] }));
  }, [articles]);

  const journals = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) if (a.journal) m.set(a.journal, (m.get(a.journal) ?? 0) + 1);
    return Array.from(m, ([name, value]) => ({ name, value })).sort(
      (a, b) => b.value - a.value || a.name.localeCompare(b.name, "sv"),
    );
  }, [articles]);

  const byLevel = useMemo(() => {
    const counts: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
    for (const a of articles) {
      const lvl = journalLevel(a.journal);
      if (lvl === 1 || lvl === 2 || lvl === 3) counts[lvl] += 1;
    }
    return ([3, 2, 1] as const).map((l) => ({ level: l, value: counts[l] }));
  }, [articles]);

  // Nyckeltal, var och ett en länk till listan
  const kpi = useMemo(() => {
    const latest = latestBatchKey(articles);
    const latestItems = latest ? articles.filter((a) => batchOf(a) === latest) : [];
    const firstDay = articles.reduce<string | null>((min, a) => {
      const b = batchOf(a);
      return b && (min === null || b < min) ? b : min;
    }, null);
    return {
      latest,
      latestCount: latestItems.length,
      latestTop: latestItems.filter((a) => scoreOf(a) >= 4).length,
      top: articles.filter((a) => scoreOf(a) >= 4).length,
      firstDay,
    };
  }, [articles]);

  // Tillagda per månad, med antal 4–5. Ofullständiga månader markeras.
  const months = useMemo<MonthBar[]>(() => {
    const m = new Map<string, { total: number; top: number }>();
    for (const a of articles) {
      const key = batchOf(a).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(key)) continue;
      const c = m.get(key) ?? { total: 0, top: 0 };
      c.total += 1;
      if (scoreOf(a) >= 4) c.top += 1;
      m.set(key, c);
    }
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const startKey =
      kpi.firstDay && !kpi.firstDay.endsWith("-01") ? kpi.firstDay.slice(0, 7) : null;
    return Array.from(m, ([month, c]) => {
      const [y, mo] = month.split("-").map(Number);
      return {
        month,
        date: new Date(y, mo - 1, 1),
        ...c,
        partial: month === currentKey ? "current" : month === startKey ? "start" : null,
      } satisfies MonthBar;
    }).sort((a, b) => a.month.localeCompare(b.month));
  }, [articles, kpi.firstDay]);

  const journalsTracked = Array.isArray(data?.journals_tracked)
    ? data!.journals_tracked.length
    : typeof data?.journals_tracked === "number"
      ? data.journals_tracked
      : journals.length;
  const topShare = pct(kpi.top, articles.length);

  const partialNote = (() => {
    const start = months.find((m) => m.partial === "start");
    const current = months.find((m) => m.partial === "current");
    const parts = [
      start && kpi.firstDay ? `bevakningen startade ${longDate(kpi.firstDay)}` : null,
      current ? `${LONG_MONTH.format(current.date).split(" ")[0]} pågår` : null,
    ].filter(Boolean);
    return parts.length ? ` Ljusare månader är inte hela: ${parts.join(" och ")}.` : "";
  })();

  const shownJournals = allJournals ? journals : journals.slice(0, 10);
  const ovrigt = CATEGORY_DESCRIPTIONS["Övrigt"];

  const loaded = !isLoading && !error && data;
  const empty = loaded && articles.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <main id="content" tabIndex={-1} className="mx-auto max-w-5xl px-4 pb-8 outline-none">
        <div className="flex flex-col gap-1 pb-5 pt-6 sm:pt-7">
          <h1 className="text-2xl font-semibold leading-7.5 tracking-[-0.02em]">Statistik</h1>
          <p className="text-sm leading-5.5 text-pretty text-muted-foreground">
            {data && articles.length > 0 ? (
              <>
                {articles.length} AI-bedömda artiklar från {journalsTracked} tidskrifter
                {kpi.firstDay && ` sedan ${longDate(kpi.firstDay)}`}. Varje siffra och rad öppnar
                artiklarna i listan.
              </>
            ) : (
              "Översikt över all AI-bedömd data."
            )}
          </p>
        </div>

        {isLoading && (
          <div aria-busy="true" className="flex flex-col gap-4">
            <p className="sr-only" role="status">
              Laddar statistiken
            </p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-md border bg-card" />
              ))}
            </div>
            <div className="h-80 animate-pulse rounded-md border bg-card" />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-64 animate-pulse rounded-md border bg-card" />
              <div className="h-64 animate-pulse rounded-md border bg-card" />
            </div>
          </div>
        )}

        {error && (
          <ErrorState
            title="Kunde inte ladda statistiken"
            error={error}
            onRetry={() => refetch()}
          />
        )}

        {empty && (
          <div className="rounded-md border border-dashed border-input p-8 text-center">
            <p className="font-medium">Inga artiklar i datakällan ännu.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Statistiken visas när bevakningen har lagt till sina första artiklar.
            </p>
          </div>
        )}

        {loaded && !empty && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiLink
                label="Senaste veckolistan"
                value={kpi.latestCount}
                sub={kpi.latest ? `artiklar, tillagda ${formatDay(kpi.latest)}` : "artiklar"}
                search={{ nya: 1 }}
              />
              <KpiLink
                label="Därav AI-relevans 4–5"
                value={kpi.latestTop}
                sub={`${pct(kpi.latestTop, kpi.latestCount)}\u00a0% av veckolistan`}
                search={{ nya: 1, min: 4 }}
              />
              <KpiLink
                label="AI-relevans 4–5 totalt"
                value={kpi.top}
                sub={`${topShare}\u00a0% av alla artiklar`}
                search={{ min: 4 }}
              />
              <KpiLink
                label="Alla artiklar"
                value={articles.length}
                sub={kpi.firstDay ? `sedan ${longDate(kpi.firstDay)}` : ""}
                search={{}}
              />
            </div>

            <ChartCard
              className="mt-4"
              title="Tillagda artiklar per månad"
              note={<Legend45 />}
              description={`Procenten är andelen med AI-relevans 4–5.${partialNote}`}
            >
              <MonthChart months={months} />
            </ChartCard>

            <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                <ChartCard title="Fördelning av AI-relevans" note="4–5 framhävda">
                  <BarList
                    labelWidth="minmax(0,13rem)"
                    rows={byScore.map((d) => {
                      const r = RUBRIC.find((x) => x.score === d.score)?.text ?? "";
                      return {
                        key: String(d.score),
                        label: `AI-relevans ${d.score}`,
                        name: `AI-relevans ${d.score}`,
                        sub: shortRubric(r),
                        title: r,
                        value: d.value,
                        search: { score: d.score },
                        muted: d.score < 4,
                      };
                    })}
                  />
                </ChartCard>

                <ChartCard
                  title={
                    <span className="flex items-center gap-2">
                      Tidskriftsnivå (KI-JL)
                      <KiJlInfoTooltip />
                    </span>
                  }
                >
                  <BarList
                    labelWidth="3rem"
                    rows={byLevel.map((d) => ({
                      key: `L${d.level}`,
                      label: `L${d.level}`,
                      name: `KI-JL-nivå L${d.level}`,
                      value: d.value,
                      search: { lvl: d.level },
                    }))}
                  />
                </ChartCard>
              </div>

              <div className="flex flex-col gap-4">
                <ChartCard title="Artiklar per kategori">
                  <BarList
                    labelWidth="minmax(0,14.5rem)"
                    rows={byCategory.map((d) => ({
                      key: d.name,
                      label: d.name,
                      name: d.name,
                      value: d.value,
                      search: { cat: [d.name] },
                      title: CATEGORY_DESCRIPTIONS[d.name],
                    }))}
                  />
                  {ovrigt && byCategory.some((d) => d.name === "Övrigt") && (
                    <p className="mt-3 text-xs leading-4.5 text-pretty text-muted-foreground">
                      <span className="font-medium text-ink-2">Övrigt</span> är{" "}
                      {ovrigt.charAt(0).toLowerCase() + ovrigt.slice(1)}
                    </p>
                  )}
                </ChartCard>

                <ChartCard
                  title={allJournals ? "Alla tidskrifter" : "Topp 10 tidskrifter"}
                  note={`${journalsTracked} bevakade`}
                >
                  <BarList
                    labelWidth="minmax(0,13rem)"
                    rows={shownJournals.map((d) => ({
                      key: d.name,
                      label: (
                        <>
                          {d.name}
                          <JournalBadge journal={d.name} />
                        </>
                      ),
                      name: d.name,
                      value: d.value,
                      search: { journal: [d.name] },
                    }))}
                  />
                  {journals.length > 10 && (
                    <button
                      type="button"
                      aria-expanded={allJournals}
                      onClick={() => setAllJournals((v) => !v)}
                      className="hit-area mt-3 text-meta font-medium text-ink-2 underline underline-offset-2 hover:text-foreground"
                    >
                      {allJournals ? "Visa topp 10" : `Visa alla ${journals.length}`}
                    </button>
                  )}
                </ChartCard>
              </div>
            </div>
          </>
        )}
      </main>
      <DisclaimerFooter />
    </div>
  );
}

/** Nyckeltal som går till listan, filtrerad på det som räknats. */
function KpiLink({
  label,
  value,
  sub,
  search,
}: {
  label: string;
  value: number;
  sub: string;
  search: ArticleSearch;
}) {
  return (
    <Link
      to="/"
      search={search}
      className="group relative flex flex-col gap-0.5 rounded-md border border-border bg-card px-4 pb-4 pt-3.5 transition-colors hover:border-input hover:bg-muted/50"
    >
      <span className="pr-5 text-meta text-muted-foreground">{label}</span>
      <span className="text-kpi font-semibold tracking-[-0.02em] tabular-nums">{value}</span>
      {sub && <span className="text-xs leading-4.5 text-muted-foreground">{sub}</span>}
      <ArrowUpRight
        aria-hidden
        className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground"
      />
    </Link>
  );
}

function ChartCard({
  title,
  description,
  note,
  className,
  children,
}: {
  title: ReactNode;
  description?: string;
  /** Kort förklaring till höger om rubriken, t.ex. stapelfärgerna */
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-md border border-border bg-card px-5 pb-5 pt-4.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-reading font-semibold leading-5.5">{title}</h2>
        {note && <span className="text-xs leading-4.5 text-muted-foreground">{note}</span>}
      </div>
      {description && (
        <p className="mt-0.5 text-xs leading-4.5 text-pretty text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-3.5">{children}</div>
    </section>
  );
}
