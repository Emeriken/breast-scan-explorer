import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Förklaring av KI-JL-nivåerna. Popover i stället för tooltip, så att den går att öppna på mobil. */
export function KiJlInfoTooltip() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Om KI-JL-graderingen"
          className="hit-area inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" collisionPadding={16} className="w-72 p-3 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide">KI-JL-nivåer</p>
        <p className="mt-2 text-xs leading-relaxed">
          Karolinska Institutets tidskriftslista 2026 graderar vetenskapliga tidskrifter i fyra
          nivåer (0–3) baserat på publikationskvalitet och vetenskapligt genomslag.
        </p>
        <ul className="mt-2 space-y-1 text-xs leading-relaxed">
          <li>
            <strong>L3:</strong> Högsta nivån, internationella topptidskrifter (t.ex. NEJM, The
            Lancet, Nature)
          </li>
          <li>
            <strong>L2:</strong> Hög nivå, väletablerade specialisttidskrifter
          </li>
          <li>
            <strong>L1:</strong> Etablerade tidskrifter med vetenskaplig granskning
          </li>
        </ul>
        <p className="mt-2 text-xs italic leading-relaxed">
          Vi bevakar enbart tidskrifter på nivå 1, 2 och 3.
        </p>
      </PopoverContent>
    </Popover>
  );
}
