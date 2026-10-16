import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge känner inte till vår egen textstorlek `text-meta` (se
 * styles.css) och tolkar den annars som en textfärg, så att den försvinner
 * när en färg som `text-foreground` står i samma `cn()`.
 */
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["meta"] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
