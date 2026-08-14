# GoHighLevel Integration

The app is the source of truth for rooms, photos, emotional entries, recommendations, Emily reviews, scores, and dashboard KPIs.

GoHighLevel is the source of truth for CRM communication, contact records, membership status, SMS/email nurture, booking links, workflows, and pipeline communication.

## Supported Services

- Contact sync: `POST /api/ghl/sync/contact/:clientId`
- Sync all contacts: `POST /api/ghl/sync/all`
- Tag sync: `POST /api/ghl/sync/tags/:clientId`
- Membership webhook: `POST /api/ghl/webhooks/membership-updated`
- Workflow trigger: `POST /api/ghl/trigger-workflow`
- Sync logs: `GET /api/ghl/sync-logs`
- Field map: `GET /api/ghl/field-map`

## Internal Events

| Event | Tags | Pipeline Stage |
| --- | --- | --- |
| `client.created` | `app-client` | New Client |
| `room.created` | `app-client` | New Client |
| `room.intake_submitted` | `room-intake-submitted` | Room Intake Submitted |
| `ai.review_completed` | `ai-review-complete` | AI Review Complete |
| `emily.review_needed` | `emily-review-needed` | Emily Review Needed |
| `recommendation.sent` | `recommendation-sent` | Recommendation Sent |
| `room.after_photos_requested` | `after-photos-needed` | After Photos Needed |
| `room.completed` | `room-complete` | Transformation Complete |
| `room.nurture_started` | `nurture-active` | Nurture |
| `upsell.identified` | `upsell-opportunity` | Upsell / Next Room |
| `room.updated` | `app-client` | Current stage |
| `freedom_tool.updated` | `app-client` | Current stage |
| `assistant.updated` | `app-client` | Current stage |
| `warranty.updated` | `app-client` | Current stage |

## Field Map

The app exposes a GHL field map that keeps CRM custom fields aligned to app data. Key examples:

- `membership_level`
- `membership_status`
- `room_energy_pipeline_stage`
- `home_transformation_score`
- `overall_room_score`
- `energy_alignment_improvement`
- `average_stress_reduction`
- `average_clutter_reduction`
- `rooms_completed`
- `rooms_in_progress`
- `rooms_open`
- `rooms_needing_attention`
- `recommendations_completed`
- `average_workbook_priority_score`
- `next_best_action`
- `latest_room_name`
- `latest_room_status`
- `latest_room_progress`
- `latest_room_overall_score`
- `latest_room_workbook_priority_score`
- `latest_room_service_path`
- `latest_room_priority_spaces`
- `latest_room_storage_needs`
- `latest_room_keepsake_notes`
- `latest_room_upsell_flag`
- `assistant_open_tasks`
- `assistant_next_reminder_at`
- `active_warranty_count`
- `expiring_warranty_count`
- `freedom_tool_entries`
- `freedom_tool_evidence_count`
- `freedom_tool_average_shift_score`
- `freedom_tool_last_subject`

Sync now runs automatically from save, submit, update, approve/send, intake changes, Freedom Tool changes, assistant changes, warranty changes, and nurture transitions.

When live GHL credentials are configured, the server also runs automatic hourly contact sync for all client profiles.

## Dry-Run Behavior

If `GHL_API_KEY` or `GHL_LOCATION_ID` is missing, the integration writes dry-run sync log rows. This keeps the app fully testable without external credentials.

## Live Mode

Set these values:

- `GHL_API_KEY`
- `GHL_LOCATION_ID`
- `GHL_API_BASE_URL`
- `GHL_API_VERSION`
- `GHL_AUTO_SYNC_INTERVAL_MS` (optional, defaults to 1 hour)

Optional workflow webhook env vars can be set per event. For example:

`GHL_WORKFLOW_ROOM_COMPLETED_URL=https://...`

The app sends event payloads to configured webhook URLs and records success or failure in `GhlSyncLog`.

Contact resolution order is:

1. Saved `ghl_contact_id`
2. GHL duplicate lookup by email
3. GHL duplicate lookup by phone
4. Upsert create if no contact is found

## HighLevel Client Portal

The app can be added to HighLevel as an embedded Custom Menu Link. Use the public HTTPS `/portal` URL and configure the link to open as an embedded page. See [highlevel-client-portal.md](highlevel-client-portal.md) for the iframe headers, session handoff, environment values, and one-time portal link procedure.
