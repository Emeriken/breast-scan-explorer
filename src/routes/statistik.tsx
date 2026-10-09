import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { articlesQueryOptions, formatDate } from "@/components/ArticleBrowser";
import { categoryColor, CHART_COLORS } from "@/lib/categories";
import { journalLevel } from "@/lib/journals";
import { KiJlInfoTooltip } from "@/components/KiJlInfoTooltip";
import { DisclaimerFooter } from "@/components/Footer";

export const Route = createFileRoute("/statistik")({
  head: () => ({
    meta: [
      { title: "Statistik — Bröstcancerartiklar" },
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
const TICK = { fontSize: 12, fill: CHART_COLORS.tick };
const VALUE_LABEL = { fontSize: 12, fill: CHART_COLORS.label };
const TOOLTIP_CURSOR = { fill: "rgba(0, 0, 0, 0.04)" };
const articlesFormatter = (v: number | string) => [v, "Artiklar"] as [number | string, string];

const MONTH_FORMAT = new Intl.DateTimeFormat("sv-SE", { month: "short", year: "numeric" });

function StatistikPage() {
  const { data, isLoading, error } = useQuery(articlesQueryOptions);

  const articles = useMemo(() => data?.articles ?? [], [data]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) m.set(a.category, (m.get(a.category) ?? 0) + 1);
    return Array.from(m, ([name, value]) => ({
      name,
      value,
      color: categoryColor(name).solid,
    })).sort((a, b) => b.value - a.value);
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
    for (const a of articles)
      if (a.journal) m.set(a.journal, (m.get(a.journal) ?? 0) + 1);
    return Array.from(m, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [articles]);

  // Bedömda artiklar per månad. Innevarande månad är inte avslutad och visas ljusare.
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-background">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Statistik
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Översikt över all AI-bedömd data.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border bg-card"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
            Kunde inte ladda data: {(error as Error).message}
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Totalt antal artiklar" value={articles.length} />
              <StatCard
                label="Senast uppdaterad"
                value={data?.updated ? formatDate(data.updated) : "–"}
              />
              <StatCard label="Tidskrifter bevakade" value={journalsTracked} />
            </div>

            <ChartCard title="Artiklar per kategori">
              <ResponsiveContainer width="100%" height={byCategory.length * 40 + 16}>
                <BarChart
                  data={byCategory}
                  layout="vertical"
                  margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
                  accessibilityLayer
                >
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip cursor={TOOLTIP_CURSOR} formatter={articlesFormatter} />
                  <Bar
                    dataKey="value"
                    name="Artiklar"
                    isAnimationActive={false}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={BAR_SIZE}
                    label={{ position: "right", ...VALUE_LABEL }}
                  >
                    {byCategory.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="Fördelning av relevanspoäng">
                <ResponsiveContainer width="100%" height={316}>
                  <BarChart data={byScore} margin={{ top: 24, right: 8, left: 8, bottom: 4 }} accessibilityLayer>
                    <XAxis
                      dataKey="score"
                      tick={TICK}
                      axisLine={{ stroke: "#E5E7EB" }}
                      tickLine={false}
                    />
                    <YAxis hide allowDecimals={false} domain={[0, "dataMax"]} />
                    <Tooltip
                      cursor={TOOLTIP_CURSOR}
                      formatter={articlesFormatter}
                      labelFormatter={(l) => `Relevans ${l}`}
                    />
                    <Bar
                      dataKey="value"
                      name="Artiklar"
                      isAnimationActive={false}
                      fill={CHART_COLORS.bar}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={BAR_SIZE}
                      label={{ position: "top", ...VALUE_LABEL }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Topp 10 tidskrifter">
                <ResponsiveContainer width="100%" height={topJournals.length * 30 + 16}>
                  <BarChart
                    data={topJournals}
                    layout="vertical"
                    margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
                    accessibilityLayer
                  >
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={150}
                      tick={TICK}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip cursor={TOOLTIP_CURSOR} formatter={articlesFormatter} />
                    <Bar
                      dataKey="value"
                      name="Artiklar"
                      isAnimationActive={false}
                      fill={CHART_COLORS.bar}
                      radius={[0, 4, 4, 0]}
                      maxBarSize={18}
                      label={{ position: "right", ...VALUE_LABEL }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <ChartCard
              title={
                <span className="flex items-center gap-2">
                  Artiklar per KI-JL-nivå
                  <KiJlInfoTooltip />
                </span>
              }
            >
              <ResponsiveContainer width="100%" height={3 * 40 + 16}>
                <BarChart
                  data={byLevel}
                  layout="vertical"
                  margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
                  accessibilityLayer
                >
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={40}
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip cursor={TOOLTIP_CURSOR} formatter={articlesFormatter} />
                  <Bar
                    dataKey="value"
                    name="Artiklar"
                    isAnimationActive={false}
                    fill={CHART_COLORS.bar}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={BAR_SIZE}
                    label={{ position: "right", ...VALUE_LABEL }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Bedömda artiklar per månad"
              description={
                hasPartialMonth
                  ? "Den ljusare stapeln är innevarande månad, som ännu inte är avslutad."
                  : undefined
              }
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={overTime} margin={{ top: 24, right: 8, left: 8, bottom: 4 }} accessibilityLayer>
                  <XAxis
                    dataKey="label"
                    tick={TICK}
                    axisLine={{ stroke: "#E5E7EB" }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide allowDecimals={false} domain={[0, "dataMax"]} />
                  <Tooltip cursor={TOOLTIP_CURSOR} formatter={articlesFormatter} />
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
                        fill={d.partial ? CHART_COLORS.partial : CHART_COLORS.bar}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}
      </main>
      <DisclaimerFooter />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}
