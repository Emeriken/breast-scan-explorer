import { useEffect, useState } from "react";

export type ListView = "kort" | "lista";

const VIEW_KEY = "brostcancer:visning";

/**
 * Lista (standard) eller kort. Valet sparas i webbläsaren, inte i adressen: det är en
 * personlig inställning och inte en del av en delad filtrering. Läses först
 * efter första renderingen så att servern och webbläsaren ritar samma sak.
 */
export function useListView(): [ListView, (v: ListView) => void] {
  const [view, setView] = useState<ListView>("lista");
  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_KEY) === "kort") setView("kort");
    } catch {
      // Lagring blockerad: listvyn gäller
    }
  }, []);
  const change = (v: ListView) => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Lagring blockerad: valet gäller bara den här sidvisningen
    }
  };
  return [view, change];
}
