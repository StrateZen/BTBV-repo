# Room Energy Organizer Development Skill

## Purpose

Use this file to guide AI coding agents when building the Room Energy Organizer app.

The app supports a business that combines home organizing, emotional awareness, and energy work. The system helps clients transform rooms by uploading before photos, describing emotions, receiving AI and Emily-reviewed recommendations, uploading after photos, and tracking progress through measurable KPIs.

## Product Priorities

1. The client dashboard is essential and must visibly show value.
2. Each room must have before photos, emotional intake, AI recommendations, Emily review, after photos, updated emotions, and progress scoring.
3. Emily must have an admin dashboard and review queue.
4. GoHighLevel must sync contacts, membership levels, tags, workflows, and pipeline stages.
5. Membership level must control service depth, Emily access, follow-up frequency, and available features.
6. Open rooms must remain in a nurture cycle.
7. The app should feel calm, supportive, premium, visual, and emotionally encouraging.

## Source of Truth

The app is the source of truth for:

- Rooms.
- Photos.
- Emotional entries.
- AI recommendations.
- Emily reviews.
- Room scores.
- Dashboard KPIs.

GoHighLevel is the source of truth for:

- CRM contact records.
- Membership status.
- Automations.
- SMS/email workflows.
- Booking links.
- Pipeline communication.

## Core Workflow

1. Client creates room.
2. Client uploads before photos.
3. Client submits emotional intake.
4. AI generates organizing and energy recommendations.
5. Emily reviews and approves recommendations.
6. Client receives recommendation.
7. Client completes work and uploads after photos.
8. Client submits updated emotional scores.
9. Dashboard updates KPIs.
10. Room is closed or placed into nurture.

## Dashboard Requirements

Client dashboard must show:

- Home Transformation Score.
- Room cards.
- Room status.
- Progress percentage.
- Before/after photos.
- Emotional shift.
- Energy shift.
- KPI tiles.
- Value summary.
- Next best action.

## Membership Rules

Membership level controls:

- Active room limits.
- AI reviews.
- Emily reviews.
- Direct Emily access.
- Booking access.
- Follow-up frequency.
- Priority queue placement.
- Advanced dashboard access.
- Energy-work depth.
- Upsell prompts.

## GoHighLevel Integration

Create GHL services for:

- Contact sync.
- Membership sync.
- Tag sync.
- Workflow triggers.
- Pipeline updates.
- Sync logs.
- Webhook handling.

Required internal events:

- `client.created`
- `membership.updated`
- `room.created`
- `room.intake_submitted`
- `ai.review_completed`
- `emily.review_needed`
- `recommendation.sent`
- `room.after_photos_requested`
- `room.completed`
- `room.nurture_started`
- `upsell.identified`

## AI Recommendation Format

AI recommendations must include:

1. Room Summary
2. Emotional Themes
3. Visual / Organizing Observations
4. Energy Blockers
5. Recommended Organizing Actions
6. Reason Behind Each Recommendation
7. Suggested Energy Work
8. Priority Order
9. Client-Friendly Message Draft
10. Suggested Upsell Opportunity
11. Follow-Up Recommendation

## Design Tone

The app should feel:

- Calm.
- Clean.
- Supportive.
- Premium.
- Visual.
- Progress-oriented.
- Emotionally encouraging.

Avoid:

- Judgmental language.
- Clinical tone.
- Overly technical interfaces.
- Cluttered dashboards.
