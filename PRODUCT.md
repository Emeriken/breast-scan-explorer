# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Breast cancer clinicians at SÖS (Södersjukhuset, Stockholm). They use the tool in two situations:

- **Weekly watch:** skimming the week's new breast cancer research so they don't miss studies that could change practice.
- **Monthly journal club:** choosing an article for the department's journal club and preparing the presentation.

## Product Purpose

Bröstcancer-bevakning collects new breast cancer articles from leading journals, scores them with AI for clinical relevance, and lets clinicians browse, filter and dig into them in Swedish.

Success means both of these, equally:

- Practice-changing studies are spotted the week they appear.
- Picking and preparing the monthly journal club article takes minutes, not hours.

## Positioning

A watch built for one department: articles scored for relevance to breast cancer care at SÖS, written up in Swedish, and connected straight to the department's own journal club workflow and PowerPoint template.

## Operating Context

- **Data:** a separate pipeline (`Emeriken/pubmed-bevaknng`) runs every Monday, scores new PubMed articles and publishes `public-index.json` to `Emeriken/brostcancer-publik`. This app reads that file (`DATA_URL` in `src/lib/articles.ts`). There is no backend database.
- **Journals tracked:** 34 high-impact general, oncology and breast cancer journals (NEJM, Lancet, JAMA, BMJ, JCO, Lancet Oncol, JAMA Oncol, Nat Med, Ann Oncol and others; see `src/lib/journals.ts`).
- **Journal club ritual:** once a month a clinician presents an article. The checklist covers PICO, primary result (HR, CI, p-value), secondary endpoints and subgroups, and clinical implications for SÖS patients.
- **Other outlets:** an RSS feed (`/api/feed`) and an MCP endpoint (`/mcp`) expose the same data.

## Capabilities and Constraints

- **Pages:** article list with filters, search, list or card view and keyboard shortcuts (`/`); article detail (`/article/$pmid`); journal club preparation (`/manadens-artikel`); statistics (`/statistik`).
- **AI relevance score** from 1 to 5, a treatment category (systemic therapy, endocrine therapy, radiotherapy, hereditary, preclinical, other), a "why relevant" note, and for high scores a deeper analysis: central finding, limitation, comparison with standard care, and applicability.
- **FDA/EMA status** for substances in high-scoring articles, with notes on how titles were matched.
- **Journal club PowerPoint** generated in the browser on the SÖS template (`src/assets/jc-mall.pptx`). This template is fixed.
- **Retracted publications** are flagged from PubMed publication types.
- **Stack:** TanStack Start (React, Vite), Tailwind CSS v4, shadcn/Radix components, Bun. The project syncs with Lovable: the connected branch must always build, and pushed history must never be rewritten.

## Brand Commitments

- Product name: **Bröstcancer-bevakning** (`PRODUCT_NAME`), the same in the header, page titles and RSS.
- All interface text is in **Swedish**.
- Voice: clinical, factual and brief. It's a colleague's tool, not marketing.

## Evidence on Hand

- Real, weekly-updated article data from the pipeline. The UI shows this data, never sample or invented articles.
- No testimonials, usage figures or outcome claims exist. Don't make any up.

## Product Principles

1. **AI scores help triage; the source article decides.** The UI always makes clear that scores and analyses are AI-generated, and always links the original article.
2. **Respect the clinician's time.** The weekly scan and journal club prep should take minutes, so put the most relevant things first and keep the rest one step away.
3. **Precise over persuasive.** Show numbers, study designs and regulatory facts as they are, without hype or rounding away uncertainty.
4. **Built for SÖS.** Departmental workflows (journal club, the SÖS template, Swedish) come before general-purpose features.

## Accessibility & Inclusion

No product-specific standard has been set beyond the defaults for clinical web tools: readable at a glance, usable by keyboard, and working in both light and dark themes (the app already has a theme toggle).
