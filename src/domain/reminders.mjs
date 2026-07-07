export function normalizeReminderEmails(value) {
  const values = Array.isArray(value) ? value : [value];
  const seen = new Set();

  return values
    .flatMap((entry) => String(entry || "").split(/[\n,;]/))
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry))
    .filter((entry) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
}

export function isAssistantReminderDue(item, now = new Date()) {
  if (!item?.reminder_at) return false;
  if (item.reminder_sent_for === item.reminder_at) return false;
  const dueAt = new Date(item.reminder_at);
  if (Number.isNaN(dueAt.getTime())) return false;
  return now.getTime() >= dueAt.getTime();
}

export function warrantyReminderScheduleKey(warranty, timezone = "UTC") {
  const reminderDate = reminderDateOnly(warranty?.reminder_at);
  return reminderDate ? `${reminderDate}T09:00[${timezone}]` : "";
}

export function isWarrantyReminderDue(warranty, timezone = "UTC", now = new Date()) {
  const reminderDate = reminderDateOnly(warranty?.reminder_at);
  if (!reminderDate) return false;
  if (warranty?.reminder_sent_for === warrantyReminderScheduleKey(warranty, timezone)) return false;

  const nowParts = zonedDateTimeParts(timezone, now);
  const currentDate = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
  if (currentDate > reminderDate) return true;
  if (currentDate < reminderDate) return false;
  return Number(nowParts.hour) >= 9;
}

export function zonedDateTimeParts(timezone = "UTC", value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: parts.year || "0000",
    month: parts.month || "01",
    day: parts.day || "01",
    hour: parts.hour || "00",
    minute: parts.minute || "00"
  };
}

function reminderDateOnly(value) {
  if (!value) return "";
  const text = String(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}
