import { Fragment, type ReactNode } from "react";
import { highlightRanges, type ParsedQuery } from "@/lib/search";

/** Markerar sökträffar i texten, oberoende av accenter och bindestreck. */
export function Highlight({ text, query }: { text: string; query: ParsedQuery | null }) {
  if (!query || !text) return <>{text}</>;
  const ranges = highlightRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([s, e], i) => {
    if (s > pos) parts.push(<Fragment key={`t${i}`}>{text.slice(pos, s)}</Fragment>);
    parts.push(
      <mark
        key={`m${i}`}
        className="rounded-sm bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/40"
      >
        {text.slice(s, e)}
      </mark>,
    );
    pos = e;
  });
  if (pos < text.length) parts.push(<Fragment key="end">{text.slice(pos)}</Fragment>);
  return <>{parts}</>;
}
