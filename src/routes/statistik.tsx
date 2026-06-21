import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { NavTabs } from "@/components/NavTabs";
import { fetchArticles, formatDate } from "@/components/ArticleBrowser";
import { categoryColor } from "@/lib/categories";
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

function StatistikPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["articles"],
    queryFn: fetchArticles,
    staleTime: 60_000,
  });

  const articles = data?.articles ?? [];

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

  const overTime = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) {
      if (!a.scored_at) continue;
      const d = new Date(a.scored_at);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return Array.from(m, ([month, value]) => ({ month, value })).sort((a, b) =>
      a.month.localeCompare(b.month),
    );
  }, [articles]);

  const journalsTracked =
    typeof data?.journals_tracked === "number"
      ? data.journals_tracked
      : new Set(articles.map((a) => a.journal).filter(Boolean)).size;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
          <div className="mb-4">
            <NavTabs />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Statistik
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Översikt över all AI-bedömd data.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
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
                value={data?.updated ? formatDate(data.updated) : "—"}
              />
              <StatCard
                label="Tidskrifter spårade"
                value={journalsTracked}
              />
            </div>

            <ChartCard title="Artiklar per kategori">
              <ResponsiveContainer width="100%" height={Math.max(200, byCategory.length * 36)}>
                <BarChart data={byCategory} layout="vertical" margin={{ left: 20, right: 24 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {byCategory.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="Fördelning av relevanspoäng">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byScore}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="score" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Top 10 tidskrifter">
                <ResponsiveContainer width="100%" height={Math.max(220, topJournals.length * 26)}>
                  <BarChart data={topJournals} layout="vertical" margin={{ left: 20, right: 24 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Bar dataKey="value" fill="#7C3AED" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <ChartCard title="Artiklar per månad (bedömda)">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={overTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#EA580C"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}