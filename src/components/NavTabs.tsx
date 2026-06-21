import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Rss } from "lucide-react";
import { externalLinkProps } from "@/lib/categories";

export function NavTabs() {
  const base =
    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        <Link
          to="/"
          activeOptions={{ exact: true }}
          className={cn(base, "text-muted-foreground hover:text-foreground")}
          activeProps={{ className: cn(base, "bg-background text-foreground shadow-sm") }}
        >
          Alla artiklar
        </Link>
        <Link
          to="/manadens-artikel"
          className={cn(base, "text-muted-foreground hover:text-foreground")}
          activeProps={{ className: cn(base, "bg-background text-foreground shadow-sm") }}
        >
          Månadens artikel
        </Link>
        <Link
          to="/statistik"
          className={cn(base, "text-muted-foreground hover:text-foreground")}
          activeProps={{ className: cn(base, "bg-background text-foreground shadow-sm") }}
        >
          Statistik
        </Link>
      </nav>
      <a
        href="/api/feed"
        {...externalLinkProps}
        title="Prenumerera på RSS-flödet"
        className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Rss className="h-3.5 w-3.5" />
        RSS
      </a>
    </div>
  );
}