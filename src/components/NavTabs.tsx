import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function NavTabs() {
  const base =
    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors";
  return (
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
    </nav>
  );
}