import { Check, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { externalLinkProps } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { emaBreastState, fdaBreastState } from "@/lib/regulatory";
import type {
  ArticleRegulatory,
  BreastMention,
  BreastState,
  EmaProduct,
  FdaStatus,
  RegulatorySubstance,
} from "@/lib/regulatory";

/**
 * FDA- och EMA-status för substanser som nämns i artikelns titel. Uppgifterna
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
  const base =
    s.fda && s.ema
      ? "godkänd av FDA och centralt i EU (EMA)"
      : s.fda
        ? "godkänd av FDA"
        : "centralt godkänd i EU (EMA)";
  const parts: string[] = [];
  for (const [label, has, state] of [
    ["FDA", Boolean(s.fda), fdaBreastState(s)],
    ["EMA", Boolean(s.ema), emaBreastState(s)],
  ] as const) {
    if (!has) continue;
    if (state === "breast") parts.push(`indikationstexten hos ${label} nämner bröstcancer`);
    if (state === "absent") parts.push(`indikationstexten hos ${label} nämner inte bröstcancer`);
  }
  return [base, ...parts].join(", ");
}

const TAG_STYLE: Record<BreastState, string> = {
  breast: "border-ok-line bg-ok-bg text-ok",
  absent: "border-dashed border-line-strong text-muted-foreground",
  unknown: "border-border text-ink-2",
};

function SourceTag({ label, state }: { label: "FDA" | "EMA"; state: BreastState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-sm border px-1 font-mono text-xs font-semibold leading-4 tracking-wider",
        TAG_STYLE[state],
      )}
    >
      <Check aria-hidden className="h-2.5 w-2.5" strokeWidth={3} />
      {label}
      {state === "breast" && <span className="font-sans font-medium tracking-normal"> bröst</span>}
      {state === "absent" && (
        <span className="font-sans font-normal tracking-normal"> ej bröst</span>
      )}
    </span>
  );
}

/** Rad i detaljerna när bröstcancer inte nämns eller inte kunde kontrolleras. */
function BreastNote({ state, source }: { state: BreastState; source: string }) {
  if (state === "breast") return null;
  return (
    <p
      className={cn(
        "mt-2 rounded-sm border px-2 py-1 text-xs leading-relaxed text-muted-foreground",
        state === "absent" ? "border-dashed border-line-strong" : "border-border",
      )}
    >
      {state === "absent"
        ? `Ej bröst: ${source} nämner inte bröstcancer.`
        : `Okänt: ingen indikationstext från ${source} kunde läsas.`}
    </p>
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

function BreastQuote({
  breast,
  source,
  linkText,
}: {
  breast: BreastMention;
  source: string;
  linkText: string;
}) {
  const from = [breast.product, breast.id].filter(Boolean).join(" · ");
  const date = breast.date ? `, ${formatDate(breast.date)}` : "";
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-foreground/80">
        Bröstcancer i {source}
        {from && (
          <span className="font-normal text-muted-foreground">
            {" "}
            ({from}
            {date})
          </span>
        )}
      </p>
      <p
        lang="en"
        className="mt-1 border-l-2 border-border pl-2 text-xs leading-relaxed text-foreground/80"
      >
        {breast.text}
      </p>
      {breast.url && (
        <p className="mt-1">
          <SourceLink href={breast.url}>{linkText}</SourceLink>
        </p>
      )}
    </div>
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
      {fda.breast && (
        <BreastQuote
          breast={fda.breast}
          source="etikettens indikationstext"
          linkText="Etiketten (DailyMed)"
        />
      )}
      <BreastNote
        state={fda.breast ? "breast" : fda.breastAbsent ? "absent" : "unknown"}
        source="FDA-etiketterna"
      />
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

function EmaSection({
  products,
  breast,
  breastState,
  print,
}: {
  products: EmaProduct[];
  breast?: BreastMention;
  breastState: BreastState;
  print?: boolean;
}) {
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
      {breast && <BreastQuote breast={breast} source="EMA:s indikationstext" linkText="EMA" />}
      <BreastNote state={breastState} source="EMA:s indikationstexter" />
    </section>
  );
}

function SubstanceDetails({
  s,
  print,
  wide,
}: {
  s: RegulatorySubstance;
  print?: boolean;
  /** FDA och EMA bredvid varandra när det får plats (artikelsidan) */
  wide?: boolean;
}) {
  return (
    <div className="space-y-3 text-sm">
      <p className={cn("font-semibold", wide && "text-reading")}>{s.name}</p>
      <div
        className={cn(
          "grid gap-3",
          wide && "grid-cols-[repeat(auto-fit,minmax(min(15rem,100%),1fr))] gap-x-7 gap-y-3.5",
        )}
      >
        {s.fda && <FdaSection fda={s.fda} print={print} />}
        {s.ema && (
          <EmaSection
            products={s.ema}
            breast={s.emaBreast}
            breastState={emaBreastState(s)}
            print={print}
          />
        )}
      </div>
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
        Grön ”bröst”: ordet breast står i den officiella indikationstexten. Meningen visas
        ordagrant. Den säger inte att godkännandet gäller studiens population. Streckad ”ej bröst”:
        indikationstexten finns men nämner inte bröstcancer. Utan markering: ingen indikationstext
        kunde läsas.
      </p>
      <p>
        Hämtat direkt från Drugs@FDA och EMA:s lista över centralt godkända läkemedel, utan AI
        {checked}. Substansnamnet eller varumärket i titeln har matchats direkt mot listorna.
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
          className="hit-area inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-xs transition-colors hover:border-input hover:bg-muted sm:min-h-7"
        >
          <span className="font-medium text-foreground">{s.name}</span>
          {s.fda && <SourceTag label="FDA" state={fdaBreastState(s)} />}
          {s.ema && <SourceTag label="EMA" state={emaBreastState(s)} />}
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
      <h2 className="text-xs font-semibold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
        Godkännande (FDA/EMA)
      </h2>
      <div className={cn("mt-3 grid gap-3", reg.substances.length > 1 && "sm:grid-cols-2")}>
        {reg.substances.map((s) => (
          <div
            key={s.key}
            className="rounded-md border border-border p-4 break-inside-avoid sm:px-4.5"
          >
            <SubstanceDetails s={s} print={printIndications} wide={reg.substances.length === 1} />
          </div>
        ))}
      </div>
      <Footnote reg={reg} className="mt-3" />
    </section>
  );
}

/** true om någon substans har en indikationstext att skriva ut. */
export function hasIndications(reg?: ArticleRegulatory): boolean {
  return Boolean(
    reg?.substances.some(
      (s) =>
        s.fda?.label?.indication ||
        s.fda?.breast ||
        s.emaBreast ||
        s.ema?.some((p) => p.indication),
    ),
  );
}
