# Admin Workflow

Emily's dashboard prioritizes clients by membership level, emotional urgency, open room count, days since last action, upsell opportunity, and engagement.

## Review Queue Inputs

Each review task includes:

- Client name.
- Membership level.
- Room name.
- Room status.
- Before emotional intake.
- Stress, clutter, and energy scores.
- Second Circle intensity and release readiness.
- Freedom Tool progress summary and latest subject when present.
- AI recommendation draft.
- Suggested upsell.
- Priority score.
- GHL sync status.

## Review Actions

Emily can:

- Review room details.
- Review AI recommendations.
- Add personal notes.
- Edit the final recommendation.
- Approve and send the recommendation.
- Move a room to nurture.
- Trigger GHL sync.
- Edit the narrative email that will be sent to the client.
- Review email delivery logs.
- Review the app-to-GHL custom field map.
- Review the selected client explorer with current room metrics, workbook priority, and Freedom Tool progress.

## Priority Score

Priority score is calculated from:

- Membership priority.
- Stress score.
- Clutter score.
- Low energy alignment.
- Workbook complexity, including Second Circle intensity and release readiness.
- Number of open rooms.
- Room priority.
- Upsell flag.

Implementation: `calculatePriorityScore` in `src/domain/scoring.mjs`.

## Move To Nurture

When Emily or a client moves a room to nurture, the room status changes to `Nurture`, the next best action becomes a pause-or-continue check-in, any open Emily review task is marked `nurture`, a follow-up is scheduled, and GHL sync runs with the `room.nurture_started` event.

## Active Client Explorer

The top of Emily's dashboard includes a searchable active-client selector. Each selected client shows:

- Membership and current pipeline stage.
- Home transformation score.
- Current workbook priority.
- Next best action.
- Freedom Tool counts, evidence logs, and latest release subject.
