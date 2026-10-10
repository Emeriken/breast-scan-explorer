import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PRODUCT_NAME } from "@/lib/articles";
import { externalLinkProps } from "@/lib/categories";
import { cn } from "@/lib/utils";

const tabBase =
  "relative whitespace-nowrap py-3 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-transparent";
const tabActive = "text-foreground after:bg-primary";
const tabInactive = "text-muted-foreground hover:text-foreground";

const TABS = [
  { to: "/", label: "Alla artiklar", match: (p: string) => p === "/" || p.startsWith("/article/") },
  {
    to: "/manadens-artikel",
    label: "Journal club",
    match: (p: string) => p.startsWith("/manadens-artikel"),
  },
  { to: "/statistik", label: "Statistik", match: (p: string) => p.startsWith("/statistik") },
] as const;

function Tabs({ pathname, className }: { pathname: string; className?: string }) {
  return (
    <nav aria-label="Huvudmeny" className={cn("flex gap-5 sm:gap-6", className)}>
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.to}
            to={t.to}
            aria-current={active ? "page" : undefined}
            className={cn(tabBase, active ? tabActive : tabInactive)}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** RSS förklaras och adressen kan kopieras, i stället för att öppna rå XML. */
function RssButton() {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("/api/feed");
  useEffect(() => setUrl(`${window.location.origin}/api/feed`), []);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="RSS-flöde"
          className="hit-area inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border/70 bg-background px-2 text-xs font-medium text-muted-foreground hover:border-border hover:text-foreground"
        >
          <Rss aria-hidden className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">RSS</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="w-[min(22rem,calc(100vw-2rem))] p-4"
      >
        <p className="text-sm font-semibold">Prenumerera med RSS</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Lägg in adressen i en RSS-läsare (t.ex. Feedly, NetNewsWire eller Inoreader) så kommer de
          50 senast tillagda artiklarna dit automatiskt, med kategori, AI-relevans och
          AI-motivering.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={url}
            aria-label="Flödets adress"
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-muted/40 px-2 font-mono text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-9 shrink-0"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Kopierad" : "Kopiera"}
          </Button>
        </div>
        <p aria-live="polite" className="sr-only">
          {copied ? "Adressen är kopierad" : ""}
        </p>
        <a
          href="/api/feed"
          {...externalLinkProps}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
        >
          Öppna flödet (XML)
          <ExternalLink aria-hidden className="h-3 w-3 opacity-60" />
        </a>
      </PopoverContent>
    </Popover>
  );
}

/** Gemensamt sidhuvud: produktnamn, flikar, RSS och tema. */
export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="border-b border-border/70 bg-background print:hidden">
      <a
        href="#content"
        className="sr-only z-50 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Hoppa till innehållet
      </a>
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-6">
            <Link
              to="/"
              className="truncate py-3 text-sm font-semibold tracking-[-0.01em] text-foreground"
            >
              {PRODUCT_NAME}
            </Link>
            <Tabs pathname={pathname} className="hidden sm:flex" />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <RssButton />
            <ThemeToggle />
          </div>
        </div>
        <Tabs pathname={pathname} className="-mt-1 sm:hidden" />
      </div>
    </header>
  );
}
