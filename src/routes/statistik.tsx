import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { articlesQueryOptions, dataAge, formatDay, PRODUCT_NAME } from "@/lib/articles";
import { batchOf, latestBatchKey, scoreOf } from "@/lib/article-list";
import type { ArticleSearch } from "@/lib/article-search";
import { CHART_COLORS } from "@/lib/categories";
import { journalLevel } from "@/lib/journals";
import { KiJlInfoTooltip } from "@/components/KiJlInfoTooltip";
import { DisclaimerFooter } from "@/components/Footer";
import { ErrorState } from "@/components/ErrorState";

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

/** Gemensamma inställningar så att alla diagram ser likadana ut. */
const BAR_SIZE = 24;
/** Liggande staplar: höjd per rad och stapelns tjocklek */
const ROW = 30;
const ROW_BAR = 16;
const TICK = { fontSize: 12, fill: CHART_COLORS.tick };
const VALUE_LABEL = { fontSize: 12, fill: CHART_COLORS.label };
const TOOLTIP_CURSOR = { fill: "var(--color-muted)", fillOpacity: 0.6 };
const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 6,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  },
  itemStyle: { color: "var(--color-popover-foreground)" },
  labelStyle: { color: "var(--color-popover-foreground)", fontWeight: 600 },
};

type TickProps = {
  x?: number;
  y?: number;
  payload?: { value: string | number };
  textAnchor?: "start" | "middle" | "end";
};

/**
 * Axeletikett som länkar till listan filtrerad på värdet. En riktig länk, så
 * att den går att nå med tangentbordet och öppna i ny flik.
 */
function LinkTick({
  x = 0,
  y = 0,
  payload,
  textAnchor = "end",
  dy = 4,
  toSearch,
  label,
}: TickProps & {
  dy?: number;
  toSearch: (value: string) => ArticleSearch | null;
  label?: (value: string) => string;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const value = String(payload?.value ?? "");
  const search = toSearch(value);
  const text = label ? label(value) : value;
  if (!search) {
    return (
      <text x={x} y={y} dy={dy} textAnchor={textAnchor} fill={CHART_COLORS.tick} fontSize={12}>
        {text}
      </text>
    );
  }
  const href = router.buildLocation({ to: "/", search }).href;
  return (
    <a
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        navigate({ to: "/", search });
      }}
      aria-label={`Visa artiklarna: ${text}`}
      className="chart-link"
    >
      <text
        x={x}
        y={y}
        dy={dy}
        textAnchor={textAnchor}
        fill={CHART_COLORS.tick}
        fontSize={12}
        className="underline decoration-dotted underline-offset-2 hover:fill-[var(--color-foreground)]"
      >
        {text}
      </text>
    </a>
  );
}

const toCategory = (v: string): ArticleSearch => ({ cat: [v] });
const toJournal = (v: string): ArticleSearch => ({ journal: [v] });
const toScore = (v: string): ArticleSearch | null =>
  /^[1-5]$/.test(v) ? { score: Number(v) } : null;
const toLevel = (v: string): ArticleSearch | null => {
  const m = /^L([1-3])$/.exec(v);
  return m ? { lvl: Number(m[1]) } : null;
};
const articlesFormatter = (v: number | string) => [v, "Artiklar"] as [number | string, string];

const MONTH_FORMAT = new Intl.DateTimeFormat("sv-SE", { month: "short", year: "numeric" });
const LONG_DATE = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Avsluta med punkt, utan att dubbla punkten efter en förkortning som "okt." */
const sentence = (t: string) => (t.endsWith(".") ? t : `${t}.`);

/** "2026-05-27" → "27 maj 2026" */
function longDate(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  return m ? LONG_DATE.format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))) : day;
}

function StatistikPage() {
  const { data, isLoading, error, refetch } = useQuery(articlesQueryOptions);
  const navigate = useNavigate();
  /** Klick på en stapel öppnar listan filtrerad på den. */
  const openList = (search: ArticleSearch | null) => {
    if (search) navigate({ to: "/", search });
  };
  const barName = (d: unknown): string => {
    const o = d as { payload?: { name?: string; score?: string }; name?: string; score?: string };
    return String(o?.payload?.name ?? o?.payload?.score ?? o?.name ?? o?.score ?? "");
  };

  const articles = useMemo(() => data?.articles ?? [], [data]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) m.set(a.category, (m.get(a.category) ?? 0) + 1);
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [articles]);

  const byScore = useMemo(() => {
    const buckets = [1, 2, 3, 4, 5].map((s) => ({ score: `${s}`, value: 0 }));
    for (const a of articles) {
      const s = Math.max(1, Math.min(5, Math.round(a.relevance_score)));
      buckets[s - 1].value += 1;
    }
    return buckets;
  }, [articles]);

  const topJournals = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) if (a.journal) m.set(a.journal, (m.get(a.journal) ?? 0) + 1);
    return Array.from(m, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [articles]);

  // Bedömda artiklar per månad. Innevarande månad är inte avslutad och visas dämpad.
  const overTime = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) {
      const key = (a.scored_at ?? "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(key)) continue;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return Array.from(m, ([month, value]) => {
      const [y, mo] = month.split("-").map(Number);
      return {
        month,
        label: MONTH_FORMAT.format(new Date(y, mo - 1, 1)),
        value,
        partial: month === currentKey,
      };
    }).sort((a, b) => a.month.localeCompare(b.month));
  }, [articles]);
  const hasPartialMonth = overTime.some((d) => d.partial);

  const byLevel = useMemo(() => {
    const counts: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
    for (const a of articles) {
      const lvl = journalLevel(a.journal);
      if (lvl === 1 || lvl === 2 || lvl === 3) counts[lvl] += 1;
    }
    return [
      { name: "L3", value: counts[3] },
      { name: "L2", value: counts[2] },
      { name: "L1", value: counts[1] },
    ];
  }, [articles]);

  const journalsTracked = Array.isArray(data?.journals_tracked)
    ? data!.journals_tracked.length
    : typeof data?.journals_tracked === "number"
      ? data.journals_tracked
      : new Set(articles.map((a) => a.journal).filter(Boolean)).size;

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
  const updatedDay = dataAge(data?.updated, kpi.latest).day;
  const topShare = articles.length ? Math.round((kpi.top / articles.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <main id="content" tabIndex={-1} className="mx-auto max-w-5xl px-4 pb-8 outline-none">
        <div className="flex flex-col gap-1 pb-5 pt-6 sm:pt-7">
          <h1 className="text-2xl font-semibold leading-[30px] tracking-[-0.02em]">Statistik</h1>
          <p className="text-sm leading-[22px] text-muted-foreground">
            {data && articles.length > 0 ? (
              <>
                {articles.length} AI-bedömda artiklar från {journalsTracked} tidskrifter
                {kpi.firstDay && ` sedan ${longDate(kpi.firstDay)}`}.
                {updatedDay && ` Senast uppdaterad ${sentence(formatDay(updatedDay))}`}{" "}
              </>
            ) : (
              "Översikt över all AI-bedömd data. "
            )}
            Klicka på en stapel eller etikett för att se artiklarna.
          </p>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-md border bg-card" />
            ))}
          </div>
        )}

        {error && (
          <ErrorState
            title="Kunde inte ladda statistiken"
            error={error}
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !error && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiLink
                label="Senaste uppdateringen"
                value={kpi.latestCount}
                sub={kpi.latest ? `artiklar, tillagda ${formatDay(kpi.latest)}` : "artiklar"}
                search={{ nya: 1 }}
              />
              <KpiLink
                label="Därav AI-relevans 4–5"
                value={kpi.latestTop}
                sub="i senaste uppdateringen"
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

            <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
              <ChartCard title="Artiklar per kategori">
                <ResponsiveContainer width="100%" height={byCategory.length * ROW + 8}>
                  <BarChart
                    data={byCategory}
                    layout="vertical"
                    margin={{ left: 0, right: 40, top: 4, bottom: 4 }}
                    accessibilityLayer
                  >
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={160}
                      tick={(p: TickProps) => <LinkTick {...p} toSearch={toCategory} />}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={TOOLTIP_CURSOR}
                      formatter={articlesFormatter}
                      {...TOOLTIP_STYLE}
                    />
                    <Bar
                      dataKey="value"
                      name="Artiklar"
                      isAnimationActive={false}
                      fill={CHART_COLORS.bar}
                      radius={[0, 4, 4, 0]}
                      maxBarSize={ROW_BAR}
                      label={{ position: "right", ...VALUE_LABEL }}
                      cursor="pointer"
                      onClick={(d: unknown) => openList(toCategory(barName(d)))}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Fördelning av AI-relevans" note="1–3 dämpade">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={byScore}
                    margin={{ top: 24, right: 8, left: 8, bottom: 4 }}
                    accessibilityLayer
                  >
                    <XAxis
                      dataKey="score"
                      tick={(p: TickProps) => (
                        <LinkTick {...p} textAnchor="middle" dy={14} toSearch={toScore} />
                      )}
                      axisLine={{ stroke: CHART_COLORS.grid }}
                      tickLine={false}
                    />
                    <YAxis hide allowDecimals={false} domain={[0, "dataMax"]} />
                    <Tooltip
                      cursor={TOOLTIP_CURSOR}
                      formatter={articlesFormatter}
                      labelFormatter={(l) => `AI-relevans ${l}`}
                      {...TOOLTIP_STYLE}
                    />
                    <Bar
                      dataKey="value"
                      name="Artiklar"
                      isAnimationActive={false}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={BAR_SIZE}
                      label={{ position: "top", ...VALUE_LABEL }}
                      cursor="pointer"
                      onClick={(d: unknown) => openList(toScore(barName(d)))}
                    >
                      {byScore.map((d) => (
                        <Cell
                          key={d.score}
                          fill={Number(d.score) >= 4 ? CHART_COLORS.bar : CHART_COLORS.soft}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Topp 10 tidskrifter">
                <ResponsiveContainer width="100%" height={topJournals.length * ROW + 8}>
                  <BarChart
                    data={topJournals}
                    layout="vertical"
                    margin={{ left: 0, right: 40, top: 4, bottom: 4 }}
                    accessibilityLayer
                  >
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={170}
                      tick={(p: TickProps) => <LinkTick {...p} toSearch={toJournal} />}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={TOOLTIP_CURSOR}
                      formatter={articlesFormatter}
                      {...TOOLTIP_STYLE}
                    />
                    <Bar
                      dataKey="value"
                      name="Artiklar"
                      isAnimationActive={false}
                      fill={CHART_COLORS.bar}
                      radius={[0, 4, 4, 0]}
                      maxBarSize={ROW_BAR}
                      label={{ position: "right", ...VALUE_LABEL }}
                      cursor="pointer"
                      onClick={(d: unknown) => openList(toJournal(barName(d)))}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="flex flex-col gap-4">
                <ChartCard
                  title={
                    <span className="flex items-center gap-2">
                      Tidskriftsnivå (KI-JL)
                      <KiJlInfoTooltip />
                    </span>
                  }
                >
                  <ResponsiveContainer width="100%" height={3 * ROW + 8}>
                    <BarChart
                      data={byLevel}
                      layout="vertical"
                      margin={{ left: 0, right: 40, top: 4, bottom: 4 }}
                      accessibilityLayer
                    >
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={36}
                        tick={(p: TickProps) => <LinkTick {...p} toSearch={toLevel} />}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={TOOLTIP_CURSOR}
                        formatter={articlesFormatter}
                        {...TOOLTIP_STYLE}
                      />
                      <Bar
                        dataKey="value"
                        name="Artiklar"
                        isAnimationActive={false}
                        fill={CHART_COLORS.bar}
                        radius={[0, 4, 4, 0]}
                        maxBarSize={ROW_BAR}
                        label={{ position: "right", ...VALUE_LABEL }}
                        cursor="pointer"
                        onClick={(d: unknown) => openList(toLevel(barName(d)))}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Tillagda artiklar per månad"
                  description={
                    hasPartialMonth
                      ? "Den dämpade stapeln är innevarande månad, som ännu inte är avslutad."
                      : undefined
                  }
                >
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={overTime}
                      margin={{ top: 24, right: 8, left: 8, bottom: 4 }}
                      accessibilityLayer
                    >
                      <XAxis
                        dataKey="label"
                        tick={TICK}
                        axisLine={{ stroke: CHART_COLORS.grid }}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis hide allowDecimals={false} domain={[0, "dataMax"]} />
                      <Tooltip
                        cursor={TOOLTIP_CURSOR}
                        formatter={articlesFormatter}
                        {...TOOLTIP_STYLE}
                      />
                      <Bar
                        dataKey="value"
                        name="Artiklar"
                        isAnimationActive={false}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={BAR_SIZE}
                        label={{ position: "top", ...VALUE_LABEL }}
                      >
                        {overTime.map((d) => (
                          <Cell
                            key={d.month}
                            fill={d.partial ? CHART_COLORS.soft : CHART_COLORS.bar}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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
      <span className="text-[28px] font-semibold leading-9 tracking-[-0.02em] tabular-nums">
        {value}
      </span>
      {sub && <span className="text-xs leading-[18px] text-muted-foreground">{sub}</span>}
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
  children,
}: {
  title: ReactNode;
  description?: string;
  /** Kort förklaring till höger om rubriken */
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card px-5 pb-5 pt-[18px]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold leading-[22px]">{title}</h2>
        {note && <span className="text-xs leading-[18px] text-muted-foreground">{note}</span>}
      </div>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-3.5">{children}</div>
    </section>
  );
}
