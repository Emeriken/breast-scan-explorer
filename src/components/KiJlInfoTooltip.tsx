import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function KiJlInfoTooltip() {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Om KI-JL-graderingen"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-xs bg-popover p-3 text-left text-popover-foreground shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-wide">
            KI-JL-nivåer
          </p>
          <p className="mt-2 text-xs leading-relaxed">
            Karolinska Institutets tidskriftslista 2026 graderar
            vetenskapliga tidskrifter i fyra nivåer (0–3) baserat på
            publikationskvalitet och vetenskapligt genomslag.
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed">
            <li>
              <strong>L3</strong> — Högsta nivån, internationella
              topptidskrifter (t.ex. NEJM, The Lancet, Nature)
            </li>
            <li>
              <strong>L2</strong> — Hög nivå, väletablerade
              specialisttidskrifter
            </li>
            <li>
              <strong>L1</strong> — Etablerade tidskrifter med vetenskaplig
              granskning
            </li>
          </ul>
          <p className="mt-2 text-xs italic leading-relaxed">
            Vi bevakar enbart tidskrifter på nivå 1, 2 och 3.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}