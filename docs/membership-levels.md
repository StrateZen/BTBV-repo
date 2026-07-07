# Membership Levels

Membership level controls service depth, access, follow-up cadence, and priority.

| Level | Active Rooms | AI Reviews | Emily Reviews | Emily Access | Follow-Up | Dashboard |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Free / Intro | 1 | 1 | 0 | AI-only preview | Light nurture | Basic |
| Bronze | 1 | 3 | 1 | Async review | Monthly | Basic |
| Silver | 3 | 8 | 3 | Limited Emily notes | Biweekly | Advanced |
| Gold | 5 | 15 | 5 | Direct messaging | Weekly | Advanced |
| Platinum | Whole-home | 99 | 20 | Priority access | High-touch | Advanced |
| VIP | Concierge | 999 | 999 | Direct sessions | Custom | Advanced |

## Permission Service

`src/domain/constants.mjs` exports `getMembershipPermissions(level)`.

The returned permissions include:

- `activeRoomLimit`
- `aiReviewLimit`
- `emilyReviewLimit`
- `directEmilyAccess`
- `bookingAccess`
- `followUpCadence`
- `reviewQueuePriority`
- `advancedDashboard`
- `energyWorkDepth`
- `beforeAfterReports`
- `upsellPersonalization`

## Enforcement Points

- `POST /api/rooms` enforces active room limits.
- `POST /api/rooms/:id/ai-review` enforces AI review limits.
- Admin task priority uses membership priority.
- Client dashboard shows locked and available membership features.
