import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge känner inte till våra egna textstorlekar (`text-meta`,
 * `text-reading` med flera i styles.css) och tolkar dem annars som
 * textfärger, så att storleken försvinner när en färg som `text-foreground`
 * står i samma `cn()`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["meta", "reading", "heading", "title", "title-lg", "kpi"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
