import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Rss } from "lucide-react";
import { externalLinkProps } from "@/lib/categories";

export function NavTabs() {
  const base =
    "relative px-1 py-2 text-sm font-medium transition-colors after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-transparent";
  const activeCls =
    "text-foreground after:bg-primary";
  const inactiveCls =
    "text-muted-foreground hover:text-foreground";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70">
      <nav className="flex flex-wrap gap-6">
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
        className="mb-1.5 inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-border hover:text-foreground"
      >
        <Rss className="h-3.5 w-3.5" />
        RSS
      </a>
    </div>
  );
}