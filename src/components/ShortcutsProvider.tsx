import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SEARCH_INPUT_ID = "article-search";

/** Skickas av länken "Kortkommandon" i sidfoten. */
export const OPEN_SHORTCUTS_EVENT = "brostcancer:kortkommandon";

export function clearReactInputValue(input: HTMLInputElement) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** true när en tangenttryckning hör till ett textfält och inte ska tolkas som genväg. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return (
    tag === "input" || tag === "textarea" || tag === "select" || Boolean(el?.isContentEditable)
  );
}

function Key({ children }: { children: string }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</kbd>;
}

export function ShortcutsProvider() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SHORTCUTS_EVENT, onOpen);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (open) {
          setOpen(false);
          return;
        }
        const active = document.activeElement as HTMLElement | null;
        if (active && active.id === SEARCH_INPUT_ID) {
          const input = active as HTMLInputElement;
          if (input.value) clearReactInputValue(input);
          else input.blur();
        }
        return;
      }

      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/") {
        const input = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
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
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kortkommandon</DialogTitle>
          <DialogDescription className="sr-only">Tangenter som fungerar på sidan</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          <dt>
            <Key>/</Key>
          </dt>
          <dd>Gå till sökfältet</dd>
          <dt>
            <Key>Esc</Key>
          </dt>
          <dd>Töm sökfältet, eller stäng en ruta</dd>
          <dt className="flex gap-1">
            <Key>←</Key>
            <Key>→</Key>
          </dt>
          <dd>Föregående och nästa artikel (på artikelsidan)</dd>
          <dt>
            <Key>?</Key>
          </dt>
          <dd>Visa den här listan</dd>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
