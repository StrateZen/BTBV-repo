# Dashboard KPIs

The client dashboard proves value by showing progress, before/after movement, emotional shift, energy shift, and next best action.

## Room Transformation Score

The MVP uses:

- 30% completion percentage.
- 25% clutter reduction.
- 25% stress reduction.
- 20% energy alignment improvement.

Formula implementation: `src/domain/scoring.mjs`.

## Whole-Home Transformation Score

The whole-home score is the average room transformation score across all rooms.

## KPI Tiles

The dashboard shows:

- Average energy improvement.
- Average stress reduction.
- Average clutter reduction.
- Average overall score.
- Average workbook priority score.
- Rooms completed.
- Rooms in progress.
- Rooms needing attention.
- Rooms open.

The first KPI row is percentage movement: energy improvement, stress reduction, clutter reduction, and overall score.

The second KPI row highlights workbook priority for Emily and BTBV planning.

The third KPI row is room count movement: rooms completed, rooms in progress, rooms needing attention, and rooms open.

## Overall Score

Overall Score combines the latest room condition scores:

- Low stress improves the score.
- Low clutter improves the score.
- High energy alignment improves the score.

Formula:

`((10 - stress_score) + (10 - clutter_score) + energy_alignment_score) / 30 * 100`

## Workbook Priority Score

Workbook Priority Score turns the BTBV consultation workbook into a 0-100 urgency signal for Emily.

It weighs:

- Functional friction.
- Storage gap.
- Sentimental load.
- Stress.
- Clutter.
- Energy gap.
- Second Circle intensity.
- Release readiness.
- Decision urgency.

The client room detail view surfaces the contributing workbook scores so the queue logic is explainable.

## Freedom Tool Summary

The client dashboard includes a Freedom Tool workspace with summary chips for:

- Total entries.
- Released entries.
- Evidence logs kept after release.
- Average emotional shift between before and after intensity.

Emily sees the same summary in the admin client explorer so workbook release work stays visible during review.

## Value Summary

The value summary turns KPI data into a client-facing statement:

`You have completed 3 of 4 rooms, reduced average stress by 42%, improved energy alignment by 61%, and built a 68% whole-home transformation score.`

## Next Best Action

The dashboard always surfaces one action, such as:

- Upload after photos.
- Start recommendation 1.
- Emily review in progress.
- Submit intake.
- Choose the next room.
