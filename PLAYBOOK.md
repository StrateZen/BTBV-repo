# Room Energy Organizer Build Playbook

## Product Vision

The app is a room transformation system:

`space -> emotion -> energy -> action -> progress -> measurable value`

Clients add rooms, upload before photos, describe how the room feels, receive AI-assisted organizing and energy recommendations, wait for Emily's review, complete the work, upload after photos, and see measurable value through dashboards.

## MVP Scope

1. Client authentication.
2. Client dashboard.
3. Admin dashboard for Emily.
4. Room creation.
5. Before photo upload.
6. Emotional intake.
7. AI recommendation generation.
8. Emily review queue.
9. Client-facing recommendation delivery.
10. Room status tracking.
11. After photo upload.
12. After emotional intake.
13. Room KPI scoring.
14. Whole-home progress.
15. Nurture state for open rooms.
16. GHL contact, membership, tag, workflow, and log integration.
17. Membership feature gating.
18. Upsell flagging.

## Primary Workflow

1. Client adds a room.
2. Client uploads before photos.
3. Client submits emotional intake.
4. AI drafts practical organizing and energy-work recommendations.
5. Emily reviews, edits, approves, and sends recommendations.
6. Client receives a room plan.
7. Client takes action and uploads after photos.
8. Client submits updated emotional scores.
9. Dashboard updates KPIs.
10. Room is closed or moved to nurture.
11. App flags next room or upsell opportunity.

## Room Statuses

- Not Started
- Intake Submitted
- AI Review Complete
- Emily Review Needed
- Recommendation Sent
- In Progress
- Waiting for After Photos
- Follow-Up Needed
- Complete
- Nurture

## Internal Events

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

## Build Sequence

1. Project foundation, schema, auth, roles, profiles, room and photo model.
2. Room intake with photos, emotions, room detail, and statuses.
3. AI recommendation service, prompt template, saved output, Emily task creation.
4. Emily review queue, editor, approve/send, upsell flagging.
5. Dashboard KPIs, room cards, value summary, next best action.
6. After photos, emotional recapture, before/after view, room completion.
7. GHL contact, membership, webhook, tags, workflows, sync logs.
8. Membership permissions and queue priority.
9. Nurture and upsell.
10. Design polish and mobile responsiveness.
