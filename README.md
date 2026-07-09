# Room Energy Organizer

Client-facing MVP for a room organizing and energy-work business. The app connects room intake, before photos, emotional state, AI-assisted recommendations, Emily review, after photos, KPI movement, membership gating, nurture, upsell signals, and GoHighLevel sync logs.

## Run Locally

```bash
npm run dev
```

Open `http://127.0.0.1:3000`.

Seed accounts:

- Client: `ava@example.com` / `demo123`
- Emily: `emily@example.com` / `demo123`
- Staff admin: `staff@example.com` / `demo123`

No package install is required. The MVP uses Node's built-in HTTP server and a JSON datastore at `data/db.json`, which is created automatically on first run.

## What Is Included

- Client login and registration.
- Client dashboard with whole-home score, overall score, ordered KPI rows, room cards, value summary, and next best action.
- Room intake with before photo upload, emotional intake, BTBV workbook scoring, and desired energy outcome.
- Freedom Tool workspace for First Circle events, protected Second Circle release work, evidence logs, and support-path tracking.
- Deterministic AI recommendation draft service using the required recommendation structure, before-photo narrative, and layout-change guidance.
- Emily admin dashboard with review queue, priority sorting, AI recommendation preview, notes, approval, and send workflow.
- After photo and emotional recapture flow.
- Room transformation score and whole-home transformation score.
- FAQ definitions for score math, AI review, nurture, next best action, and membership behavior.
- Editable recommendation email drafts for Emily with dry-run email delivery logs.
- Client assistant for notes, routines, tasks, appointments, reminders, recipient-based reminder emails, and `.ics` calendar sync.
- Warranty tracker with upload, active/expiration dates, 9:00 AM client-timezone reminder emails, and search.
- Dockerfile for Hostinger-style container hosting.
- Membership-tier permissions for active rooms, AI reviews, Emily reviews, direct access, booking, cadence, advanced KPIs, and energy-work depth.
- GoHighLevel contact sync, tag sync, field map exposure, membership webhook, workflow trigger hooks, and sync logs.

## API Surface

Core endpoints match the playbook:

- `POST /api/rooms`
- `GET /api/rooms`
- `GET /api/rooms/:id`
- `POST /api/rooms/:id/photos`
- `POST /api/rooms/:id/emotions`
- `POST /api/rooms/:id/ai-review`
- `POST /api/rooms/:id/emily-review`
- `POST /api/rooms/:id/send-recommendation`
- `POST /api/rooms/:id/after`
- `GET /api/dashboard/client/:clientId`
- `GET /api/dashboard/admin`
- `GET /api/freedom/client/:clientId/entries`
- `POST /api/freedom/client/:clientId/entries`
- `PATCH /api/freedom/entries/:id`
- `DELETE /api/freedom/entries/:id`
- `GET /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/ghl/webhooks/membership-updated`
- `POST /api/ghl/sync/contact/:clientId`
- `POST /api/ghl/sync/all`
- `POST /api/ghl/sync/tags/:clientId`
- `POST /api/ghl/trigger-workflow`
- `GET /api/ghl/sync-logs`

## GoHighLevel Mode

By default GHL calls run in dry-run mode and write `GhlSyncLog` entries. To enable live contact sync, add a local `.env` file or export shell variables for `GHL_API_KEY` and `GHL_LOCATION_ID`. The server now loads `.env` automatically on startup and also supports optional workflow webhook URLs for internal events.

Contact sync resolves matches in this order:

1. Existing saved `ghl_contact_id`
2. GHL duplicate lookup by email
3. GHL duplicate lookup by phone
4. Upsert create when no contact is found

The admin dashboard also exposes a manual `Sync all contacts` control, and the server runs automatic hourly contact sync when live GHL credentials are configured.

## Reminder Emails

Assistant reminders are sent at the saved reminder date/time. Warranty reminders are sent at `09:00` in the client's saved timezone on the chosen reminder date. The app checks due reminders on an internal interval and posts to `EMAIL_DELIVERY_WEBHOOK_URL`.

## Tests

```bash
npm test
```

The tests cover membership permissions, KPI scoring, password verification, and AI recommendation output.

## Hostinger Docker

Build and run the container:

```bash
docker build -t room-energy-organizer .
docker run -p 3000:3000 -v reo-data:/app/data --env-file .env room-energy-organizer
```

Use `HOST=0.0.0.0`, `PORT=3000`, and `DATA_FILE=/app/data/db.json` in Docker. Mount `/app/data` so client records, sync logs, assistant items, warranties, and email logs persist across restarts.

For Hostinger VPS Docker Manager, this repo now includes [docker-compose.yml](/Users/dankonzen/Documents/BTBV-DEVOPS-/docker-compose.yml). The shortest deployment path is:

1. Push this repository to GitHub.
2. Create a Hostinger VPS with the Docker template installed.
3. In hPanel, open `VPS -> Manage -> Docker Manager`.
4. Deploy the project with `Compose from URL`, `Compose manually`, or the Hostinger GitHub Action.
5. Set production environment variables in Docker Manager or your CI pipeline, including:
   - `OPENAI_API_KEY`
   - `GHL_API_KEY`
   - `GHL_LOCATION_ID`
   - `EMAIL_DELIVERY_WEBHOOK_URL`
6. Keep `/app/data` on a persistent Docker volume so `data/db.json` survives restarts.

If you want a custom domain on Hostinger VPS, route the app through Traefik or another reverse proxy rather than exposing raw port `3000` directly.

To push the current `main` branch to GitHub from this repo, run:

```bash
npm run push:main
```
