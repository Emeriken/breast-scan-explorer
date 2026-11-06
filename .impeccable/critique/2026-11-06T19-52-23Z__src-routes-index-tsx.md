---
target: front page
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/breast-scan-explorer/src/routes/index.tsx"
target_fingerprint: "sha256:3633356fef0174af1eb3fd7d0eb3e85777dc9f62fc4402c8e1dc293bfb96aec4"
target_path: /home/user/breast-scan-explorer/src/routes/index.tsx
timestamp: 2026-11-06T19-52-23Z
slug: src-routes-index-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

Design Health Score: 29/40 (Good, low end). 1:3 2:3 3:3 4:3 5:3 6:3 7:3 8:2 9:3 10:3

Specificity: authored product details (week batches, 5-dot score with rubric, AI tag + dashed rule, KI-JL level, FDA/EMA chips, folded 1–2 scores, synonym search, Swedish clinical voice) inside a generic card-list scaffold. The 5/4/3 tiers, the product's core idea, are not part of the page structure.

Detector: source scan clean (0). Rendered 1280: line-length x28 (ArticleCard.tsx:172 max-w-[82ch] -> ~95–111 chars), unbalanced-heading x7 (ArticleCard.tsx:123), overused-font (Inter). 390: body-text-viewport-edge (ArticleBrowser.tsx:93 batch meta line touches right edge), straggler, flat-type-hierarchy (borderline). No console errors.

Priority issues:
- [P1] Default card view too sparse for the Monday scan (~1.5 cards per desktop screen; one week ≈ 8,200px desktop / 13,700px mobile). Lista drops the AI "Motivering". Fix: add clamped why_relevant to ArticleRow; trim card header (authors/DOI); consider Lista default.
- [P1] Relevance tiers flattened: every 4/5 card repeats the rubric sentence; 5/4/3 look the same. Fix: score sub-headings within each week carrying the rubric once; remove per-card rubric line.
- [P2] No triage memory/progress: no seen marker, no position, no j/k. Fix: :visited styling, localStorage "sett" set + "12 av 29 genomgångna", j/k shortcuts.
- [P2] Toolbar labels misdescribe the main path: sort "Senast tillagd" vs "veckovis, högst AI-relevans först"; "Bara veckans nya" outside toolbar; truncated search placeholder.
- [P3] Polish/a11y: AI-text line length >80ch; mobile batch line hits edge; score read twice by screen readers; focus ring crowds (i) button.

Personas: SÖS oncologist between clinics (long scroll, loses place, Lista hides Motivering, "Före tryck · 31 dec. 2026" looks wrong); Alex power user (~60 Tabs to article 10, no j/k); Sam a11y (double score announcement, tier by fill only); Casey mobile (13,700px page, icon-only legend/view toggle).

Questions: open on this week's 5s/4s as a countable briefing? Cards for journal club, list for Monday watch? What does "done with this week" look like?
