import { useEffect, useState } from "react";

export type ListView = "kort" | "lista";

const VIEW_KEY = "brostcancer:visning";

/**
 * Kort eller lista. Valet sparas i webbläsaren, inte i adressen: det är en
 * personlig inställning och inte en del av en delad filtrering. Läses först
 * efter första renderingen så att servern och webbläsaren ritar samma sak.
 */
export function useListView(): [ListView, (v: ListView) => void] {
  const [view, setView] = useState<ListView>("kort");
  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_KEY) === "lista") setView("lista");
    } catch {
      // Lagring blockerad: kortvyn gäller
    }
  }, []);
  const change = (v: ListView) => {
    setView(v);
    try {
      if (v === "kort") window.localStorage.removeItem(VIEW_KEY);
      else window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Lagring blockerad: valet gäller bara den här sidvisningen
    }
  };
  return [view, change];
}
