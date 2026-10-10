import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  applyTheme,
  readThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const NEXT: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};
const LABEL: Record<ThemePreference, string> = {
  system: "Tema: som systemet",
  light: "Tema: ljust",
  dark: "Tema: mörkt",
};

/** Växlar mellan systemets tema, ljust och mörkt. */
export function ThemeToggle() {
  // null tills valet lästs in, så att temat inte ändras innan dess
  const [stored, setStored] = useState<ThemePreference | null>(null);
  const pref = stored ?? "system";

  useEffect(() => {
    setStored(readThemePreference());
  }, []);

  useEffect(() => {
    if (stored === null) return;
    applyTheme(stored);
    if (stored !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [stored]);

  const Icon = pref === "dark" ? Moon : pref === "light" ? Sun : Monitor;
  return (
    <button
      type="button"
      onClick={() => {
        const next = NEXT[pref];
        saveThemePreference(next);
        setStored(next);
      }}
      aria-label={`${LABEL[pref]}. Byt tema`}
      title={`${LABEL[pref]}. Klicka för att byta.`}
      className="hit-area inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
