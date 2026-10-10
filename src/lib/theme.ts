/**
 * Ljust och mörkt tema. Standard är att följa systemet; ett eget val sparas i
 * webbläsaren. Skriptet nedan körs i <head> innan sidan ritas, så att den
 * inte blinkar ljust i mörkt läge.
 */

export type ThemePreference = "system" | "light" | "dark";

export const THEME_KEY = "brostcancer:tema";

export function readThemePreference(): ThemePreference {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function saveThemePreference(pref: ThemePreference) {
  try {
    if (pref === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Lagring blockerad: valet gäller bara den här sidvisningen
  }
}

export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;
