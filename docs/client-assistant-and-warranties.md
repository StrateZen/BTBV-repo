# Client Assistant And Warranty Tracker

The client assistant is a lightweight household support layer inspired by household coordination tools such as Littlebird. It is available to every membership level.

## Assistant Items

Clients can track:

- Notes.
- Routines.
- Tasks.
- Appointments.
- Reminders.

Each item can include a due date, reminder date, one or more reminder email recipients, recurrence text, and calendar sync flag. Reminder emails are sent at the saved date/time.

## Calendar Sync

The MVP provides downloadable `.ics` calendar files:

- One file for all client assistant items: `/api/assistant/client/:clientId/calendar.ics`
- One file per item: `/api/assistant/items/:id/calendar.ics`

Production calendar integrations can later connect Google Calendar, Apple Calendar, or Microsoft 365 OAuth while preserving the same item model.

## Warranty Tracker

Clients can save warranty records with:

- Item name.
- Category.
- Provider.
- Policy number.
- Purchase date.
- Active date.
- Expiration date.
- Reminder date.
- Reminder recipients.
- Notes.
- Uploaded PDF/image as a local data URL.

Warranty reminders are sent at `09:00` in the client's saved timezone on the chosen reminder date.

Warranty records are searchable by item, category, provider, policy number, notes, document name, and status.

## Automatic GHL Sync

Assistant and warranty saves trigger GHL sync so CRM fields such as `assistant_open_tasks`, `assistant_next_reminder_at`, `active_warranty_count`, and `expiring_warranty_count` stay aligned.
