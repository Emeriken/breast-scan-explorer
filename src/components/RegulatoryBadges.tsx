import { Check, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { externalLinkProps } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type {
  ArticleRegulatory,
  EmaProduct,
  FdaStatus,
  RegulatorySubstance,
} from "@/lib/regulatory";

/**
 * FDA- och EMA-status för substanser i artiklar med 4–5 poäng. Uppgifterna
 * hämtas av pipelinen direkt från Drugs@FDA och EMA (utan AI) och visas bara
 * när en träff finns. Se src/lib/regulatory.ts.
 */

const DATE = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return DATE.format(new Date(Date.UTC(y, m - 1, d)));
}

function statusText(s: RegulatorySubstance): string {
  if (s.fda && s.ema) return "godkänd av FDA och centralt i EU (EMA)";
  if (s.fda) return "godkänd av FDA";
  return "centralt godkänd i EU (EMA)";
}

function SourceTag({ label }: { label: "FDA" | "EMA" }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-sm border border-border/80 bg-background px-1 font-mono text-xs font-semibold leading-4 tracking-wider text-foreground/80">
      <Check aria-hidden className="h-3 w-3" />
      {label}
    </span>
  );
}

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      {...externalLinkProps}
      className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-2 hover:underline"
    >
      {children}
      <ExternalLink aria-hidden className="h-3 w-3 opacity-60" />
    </a>
  );
}

function Indication({
  heading,
  text,
  truncated,
  href,
  linkText,
  print,
}: {
  heading: string;
  text: string;
  truncated: boolean;
  href?: string;
  linkText: string;
  /** Skriv ut hela texten (på skärmen är den alltid ihopfälld) */
  print?: boolean;
}) {
  const body = (
    <>
      <p
        lang="en"
        className="mt-1.5 whitespace-pre-line border-l-2 border-border pl-2 text-xs leading-relaxed text-foreground/80"
      >
        {text}
      </p>
      {truncated && (
        <p className="mt-1 text-xs text-muted-foreground">
          Texten är kapad. {href && <SourceLink href={href}>{linkText}</SourceLink>}
        </p>
      )}
    </>
  );
  return (
    <>
      <details className="group mt-2 print:hidden">
        <summary className="hit-area cursor-pointer select-none text-xs font-medium text-foreground/80 hover:text-foreground">
          {heading}
        </summary>
        {body}
      </details>
      {print && (
        <div className="mt-2 hidden print:block">
          <p className="text-xs font-medium">{heading}</p>
          {body}
        </div>
      )}
    </>
  );
}

function FdaSection({ fda, print }: { fda: FdaStatus; print?: boolean }) {
  const label = fda.label;
  const labelBrands = label?.brands.length ? ` för ${label.brands.join(", ")}` : "";
  const labelDate = label?.date ? `, ${formatDate(label.date)}` : "";
  return (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">FDA</h4>
      <p className="mt-1">
        {fda.brands.length ? fda.brands.join(", ") : "Varumärke saknas"}
        <span className="text-muted-foreground"> · {fda.application}</span>
      </p>
      <p className="text-xs text-muted-foreground">Första godkännande {formatDate(fda.approved)}</p>
      {fda.marketed === false && (
        <p className="mt-1 text-xs text-muted-foreground">
          Ingen produkt med substansen marknadsförs i USA enligt Drugs@FDA.
        </p>
      )}
      {fda.url && (
        <p className="mt-1">
          <SourceLink href={fda.url}>Drugs@FDA</SourceLink>
        </p>
      )}
      {label?.indication && (
        <Indication
          heading={`Indikation enligt etiketten${labelBrands}${labelDate}`}
          text={label.indication}
          truncated={label.truncated}
          href={label.url}
          linkText="Hela etiketten (DailyMed)"
          print={print}
        />
      )}
    </section>
  );
}

function EmaSection({ products, print }: { products: EmaProduct[]; print?: boolean }) {
  return (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">EMA</h4>
      {products.map((p) => (
        <div key={p.number ?? p.name} className="mt-1">
          <p>
            {p.name}
            {p.number && <span className="text-muted-foreground"> · {p.number}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            Centralt godkänd i EU {formatDate(p.authorised)}
            {p.conditional && " · villkorat godkännande"}
            {p.exceptional && " · godkänd under exceptionella omständigheter"}
          </p>
          {p.url && (
            <p className="mt-1">
              <SourceLink href={p.url}>EMA</SourceLink>
            </p>
          )}
          {p.indication && (
            <Indication
              heading="Godkänd indikation"
              text={p.indication}
              truncated={p.truncated}
              href={p.url}
              linkText="Hela texten hos EMA"
              print={print}
            />
          )}
        </div>
      ))}
    </section>
  );
}

function SubstanceDetails({ s, print }: { s: RegulatorySubstance; print?: boolean }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="font-semibold">{s.name}</p>
      {s.fda && <FdaSection fda={s.fda} print={print} />}
      {s.ema && <EmaSection products={s.ema} print={print} />}
    </div>
  );
}

function Footnote({ reg, className }: { reg: ArticleRegulatory; className?: string }) {
  const checked = reg.checkedAt ? `, kontrollerat ${formatDate(reg.checkedAt)}` : "";
  return (
    <div className={cn("space-y-1 text-xs leading-relaxed text-muted-foreground", className)}>
      <p>
        Gäller substansen, inte nödvändigtvis studiens indikation, kombination eller beredningsform.
        Saknas en uppgift betyder det inte att läkemedlet är ogodkänt.
      </p>
      <p>
        Hämtat direkt från Drugs@FDA och EMA:s lista över centralt godkända läkemedel, utan AI
        {checked}. Substansen är indexerad i PubMed och nämns i titeln.
        {!reg.sources.fda && " FDA kunde inte läsas vid senaste kontrollen."}
        {!reg.sources.ema && " EMA kunde inte läsas vid senaste kontrollen."}
      </p>
    </div>
  );
}

function SubstanceChip({ s, reg }: { s: RegulatorySubstance; reg: ArticleRegulatory }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${s.name}: ${statusText(s)}. Visa detaljer`}
          className="hit-area inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2 py-0.5 text-xs transition-colors hover:border-border hover:bg-muted/60 sm:min-h-7"
        >
          <span className="font-medium text-foreground/90">{s.name}</span>
          {s.fda && <SourceTag label="FDA" />}
          {s.ema && <SourceTag label="EMA" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="max-h-[min(70vh,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto p-4"
      >
        <SubstanceDetails s={s} />
        <Footnote reg={reg} className="mt-4 border-t pt-3" />
      </PopoverContent>
    </Popover>
  );
}

/** Rad med en knapp per substans. Används i listor och kort. */
export function RegulatoryBadges({
  reg,
  className,
}: {
  reg?: ArticleRegulatory;
  className?: string;
}) {
  if (!reg || reg.substances.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-xs text-muted-foreground">Godkännande:</span>
      {reg.substances.map((s) => (
        <SubstanceChip key={s.key} s={s} reg={reg} />
      ))}
    </div>
  );
}

/**
 * Alla uppgifter, med indikationstexterna ihopfällda. Används på
 * artikelsidan och i förberedelsevyn.
 */
export function RegulatorySection({
  reg,
  printIndications,
  className,
}: {
  reg?: ArticleRegulatory;
  /** Ta med indikationstexterna när sidan skrivs ut */
  printIndications?: boolean;
  className?: string;
}) {
  if (!reg || reg.substances.length === 0) return null;
  return (
    <section className={className}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Godkännande (FDA/EMA)
      </h2>
      <div className={cn("mt-2 grid gap-3", reg.substances.length > 1 && "sm:grid-cols-2")}>
        {reg.substances.map((s) => (
          <div key={s.key} className="rounded-lg border border-border/70 p-3 break-inside-avoid">
            <SubstanceDetails s={s} print={printIndications} />
          </div>
        ))}
      </div>
      <Footnote reg={reg} className="mt-2" />
    </section>
  );
}

/** true om någon substans har en indikationstext att skriva ut. */
export function hasIndications(reg?: ArticleRegulatory): boolean {
  return Boolean(
    reg?.substances.some((s) => s.fda?.label?.indication || s.ema?.some((p) => p.indication)),
  );
}
