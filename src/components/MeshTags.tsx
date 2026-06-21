import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function MeshTags({ terms }: { terms: string[] | undefined }) {
  if (!terms || terms.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {terms.map((raw, i) => {
        const major = raw.trim().endsWith("*");
        const term = major ? raw.trim().slice(0, -1) : raw.trim();
        return (
          <Link
            key={`${term}-${i}`}
            to="/"
            search={{ mesh: term }}
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs transition-colors",
              major
                ? "border-primary/40 bg-primary/10 font-semibold text-primary hover:bg-primary/20"
                : "border-input bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            title={major ? "Major topic" : "MeSH-term"}
          >
            {term}
          </Link>
        );
      })}
    </div>
  );
}
