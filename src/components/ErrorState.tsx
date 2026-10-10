import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Samma felruta med "Försök igen" på alla sidor. */
export function ErrorState({
  title = "Kunde inte ladda artiklarna",
  error,
  onRetry,
  className,
}: {
  title?: string;
  error: unknown;
  onRetry: () => Promise<unknown> | unknown;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center",
        className,
      )}
    >
      <p className="font-semibold text-destructive">{title}</p>
      {message && <p className="mt-1 text-sm text-muted-foreground">{message}</p>}
      <p className="mt-1 text-sm text-muted-foreground">
        Datan hämtas från GitHub. Kontrollera nätverket och försök igen.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onRetry();
          } finally {
            setBusy(false);
          }
        }}
      >
        <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
        Försök igen
      </Button>
    </div>
  );
}
