---
target: statistik
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/user/breast-scan-explorer/src/routes/statistik.tsx"
target_fingerprint: "sha256:66a6d1da34dc4b33c3ddf347ab8cbab0eb2bff2e00a2dd084fccbe932e872024"
target_path: /home/user/breast-scan-explorer/src/routes/statistik.tsx
timestamp: 2026-11-06T20-27-58Z
slug: src-routes-statistik-tsx
closed: true
---
Method: dual-agent (A: design review · B: detector + browser)

Design Health Score: 26/40 (Acceptable). 1:3 2:3 3:3 4:2 5:3 6:2 7:2 8:3 9:3 10:2

Specificity: generic KPI-row + bar-chart grid; product touches (monochrome ink, 4–5 KPI, KI-JL, muted partial month, every number links). Misses the clinical question: is the watch catching what matters, and is that changing.

Detector: source clean (0). Rendered: overused-font only. Contrast ≥6:1 everywhere. 31 bars have no accessible name/keyboard; 5 SVGs role=application tabindex=0 unlabelled (accessibilityLayer). 24 axis links are proper anchors. No console errors.

Priority issues:
- [P1] Share of AI-relevans 4–5 over time not shown (9% jun → 31% nov); month chart volume only, not clickable despite intro promise; first month (maj, 3 articles) not muted.
- [P1] Relevance chart uses bare 1–5, not the rubric language used on front page/journal club.
- [P1] Charts lack text alternatives; 5 unlabelled "application" tab stops; Enter does nothing.
- [P2] Journal coverage uncheckable: top 10 hides 24 of 34 journals (NEJM, Lancet, JAMA, JCO).
- [P2] Ragged grid (lg:items-start), skeleton only for KPIs, empty data renders blank charts.

Minor: tooltip "Artiklar : 65"; two competing dates (fre 6 nov / mån 2 nov); Övrigt (40%) unexplained though CATEGORY_DESCRIPTIONS exists; month axis drops sep.; byScore clamps to 1 vs scoreOf 0.
