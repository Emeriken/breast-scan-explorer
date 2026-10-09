import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Rss } from "lucide-react";
import { externalLinkProps } from "@/lib/categories";

const base =
  "relative whitespace-nowrap py-3 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-transparent";
const activeCls = "text-foreground after:bg-primary";
const inactiveCls = "text-muted-foreground hover:text-foreground";

export function NavTabs() {
  return (
    <div className="flex items-center justify-between gap-3">
      <nav aria-label="Huvudmeny" className="flex gap-4 sm:gap-6">
        <Link
          to="/"
          activeOptions={{ exact: true }}
          className={cn(base, inactiveCls)}
          activeProps={{ className: cn(base, activeCls) }}
        >
          Alla artiklar
        </Link>
        <Link
          to="/manadens-artikel"
          className={cn(base, inactiveCls)}
          activeProps={{ className: cn(base, activeCls) }}
        >
          Månadens artikel
        </Link>
        <Link
          to="/statistik"
          className={cn(base, inactiveCls)}
          activeProps={{ className: cn(base, activeCls) }}
        >
          Statistik
        </Link>
      </nav>
      <a
        href="/api/feed"
        {...externalLinkProps}
        title="Prenumerera på RSS-flödet"
        aria-label="RSS-flöde"
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-border hover:text-foreground"
      >
        <Rss className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">RSS</span>
      </a>
    </div>
  );
}

/** Gemensamt sidhuvud med samma bredd på alla sidor, så att menyn inte flyttar sig. */
export function SiteHeader() {
  return (
    <header className="border-b border-border/70 bg-background print:hidden">
      <div className="mx-auto max-w-5xl px-4">
        <NavTabs />
      </div>
    </header>
  );
}
