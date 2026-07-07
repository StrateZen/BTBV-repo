# Nurture Playbook

Rooms that are not complete should stay visible and actionable.

## Timing Rules

| Timing | Action |
| --- | --- |
| 2 days after recommendation | Remind client of the next step. |
| 5 days after no activity | Ask if support is needed. |
| 10 days after no activity | Suggest booking Emily if the tier allows it. |
| 21 days after no activity | Ask whether the room should continue or pause. |
| Monthly | Send room energy maintenance reminder. |

## Tone

- Supportive.
- Encouraging.
- Nonjudgmental.
- Not pushy.

## Membership Cadence

Higher tiers should receive:

- More frequent follow-up.
- More personalized messages.
- More Emily involvement.
- More booking opportunities.

## Current MVP Behavior

The app supports a `Nurture` room status, GHL `nurture-active` tag, `room.nurture_started` event, and dashboard next best action. A production scheduler can later process `FollowUp` rows and trigger SMS/email workflows.
