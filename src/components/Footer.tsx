export function DisclaimerFooter() {
  return (
    <footer className="mt-12 border-t bg-background print:hidden">
      <div className="mx-auto max-w-5xl px-4 py-6 text-center text-xs leading-relaxed text-muted-foreground">
        AI-bedömningar är genererade av Claude (Anthropic) baserat på publicerade
        abstracts. De är inte kliniskt beslutsstöd och ska inte ersätta läsning
        av primärkällan. Verktyget är utvecklat för intern bevakning på SÖS
        Onkologen.
      </div>
    </footer>
  );
}
