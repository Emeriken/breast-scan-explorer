---
target: journal club page
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/breast-scan-explorer/src/routes/manadens-artikel.tsx"
target_fingerprint: "sha256:c7b1a7aab26247e94cd29aa957ce6c664808379e6cd0fe3b85ce282872bbc93f"
target_path: /home/user/breast-scan-explorer/src/routes/manadens-artikel.tsx
timestamp: 2026-11-06T20-11-36Z
slug: src-routes-manadens-artikel-tsx
closed: true
---
Method: dual-agent (A: design review · B: detector + browser)

Design Health Score: 27/40 (Acceptable, top of band). 1:3 2:3 3:3 4:2 5:2 6:3 7:2 8:3 9:3 10:3

Specificity: workflow and copy are SÖS-specific (three treatment areas, 15 min, PICO/HR-CI-p checklist, SÖS template, honest provenance line); composition is generic stacked cards. Inconsistent with the polished front page (heavy cards, repeated rubric line under the 4–5 heading).

Detector: source scan clean (0). Rendered: overused-font (Inter, global, kept by choice), straggler at manadens-artikel.tsx:523 and :413, unbalanced-heading on mobile h2 at :481. No console errors or failed requests.

Priority issues:
- [P1] Default month and area switch mislead the choice: latestCandidateKey (:306-318) opens Cytotoxisk on Nov 2026 with 1 pre-print candidate while October has 9; switching area (:428) silently moves the month.
- [P1] Prep view buries the task: article + AI text fill the first screen, Skapa PowerPoint mid-page, checklist below the fold (y≈1240), three filled primary buttons compete (Skriv ut :635), no task header.
- [P2] Candidate list inconsistent and long: full cards with rubric line (:392-406), "andra områden" adds 20 more full cards (:502-520).
- [P2] Checklist generic and disconnected: 9 flat items (:547-557), no grouping/slide mapping, "Börja om" (:667) without undo, no done state at 9/9, mixed English ("knowledge gap", "endpoints").
- [P2] Edge states: ?prepare deep link shows list skeleton while loading; unknown PMID fails silently; loading stepper shows a guessed month; raw "Failed to fetch"; presentation date defaults to today (JcPowerPoint.tsx:28) and goes into title slide + filename.

Personas: presenter with 20 min (picks from 1 instead of 9, scrolls for PowerPoint, wrong date ships); Alex (no shortcuts, 20 Tabs to first Förbered, area switch loses month); Sam (PowerPoint area group announced as "Journal club", silent month change).

Questions: open on the month you're presenting about? two-column prep workspace? checklist as the slide outline?
