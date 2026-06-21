import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SEARCH_INPUT_ID = "article-search";

export function clearReactInputValue(input: HTMLInputElement) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export function ShortcutsProvider() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const inEditable =
        tag === "input" || tag === "textarea" || target?.isContentEditable;

      if (e.key === "Escape") {
        if (open) {
          setOpen(false);
          return;
        }
        const active = document.activeElement as HTMLElement | null;
        if (active && active.id === SEARCH_INPUT_ID) {
          const input = active as HTMLInputElement;
          if (input.value) {
            clearReactInputValue(input);
          } else {
            input.blur();
          }
        }
        return;
      }

      if (inEditable) return;

      if (e.key === "/") {
        const input = document.getElementById(
          SEARCH_INPUT_ID,
        ) as HTMLInputElement | null;
        if (input) {
          e.preventDefault();
          input.focus();
          input.select();
        }
        return;
      }

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen(true);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tangentbordsgenvägar</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
              /
            </kbd>
          </dt>
          <dd>Fokusera sökfältet</dd>
          <dt>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
              Esc
            </kbd>
          </dt>
          <dd>Rensa söket / stäng denna ruta</dd>
          <dt>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
              ?
            </kbd>
          </dt>
          <dd>Visa denna lista</dd>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
