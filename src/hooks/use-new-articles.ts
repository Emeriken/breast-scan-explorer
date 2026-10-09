import { useEffect, useState } from "react";

const SEEN_KEY = "brostcancer:sedda-artiklar";
const SESSION_KEY = "brostcancer:nya-artiklar";

/**
 * Markerar artiklar som tillkommit sedan förra besöket i den här
 * webbläsaren. Markeringen ligger kvar under hela besöket (även vid
 * omladdning) och nollställs vid nästa besök. Första besöket markerar
 * ingenting. Fungerar inte lagringen blir det helt enkelt ingen markering.
 */
export function useNewArticles(ids: string[]): Set<string> {
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (ids.length === 0) return;
    try {
      const cached = window.sessionStorage.getItem(SESSION_KEY);
      if (cached !== null) {
        setNewIds(new Set(JSON.parse(cached) as string[]));
        return;
      }
      const seenRaw = window.localStorage.getItem(SEEN_KEY);
      const seen: string[] = seenRaw ? (JSON.parse(seenRaw) as string[]) : [];
      const seenSet = new Set(seen);
      const fresh = seen.length > 0 ? ids.filter((id) => !seenSet.has(id)) : [];
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
      for (const id of ids) seenSet.add(id);
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seenSet)));
      setNewIds(new Set(fresh));
    } catch {
      // Lagring blockerad (t.ex. privat läge): ingen markering.
    }
  }, [ids]);

  return newIds;
}
