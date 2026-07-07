export function draftRecommendationEmail({ user, clientProfile, room, review, aiRecommendation }) {
  const subject = `${room.room_name} transformation plan from Emily`;
  const recommendationText = sanitizeEmilyEmailText(
    review?.final_recommendation || aiRecommendation?.client_message_draft || "Your recommendation is ready."
  );
  const body = [
    `Hi ${user.name.split(" ")[0]},`,
    "",
    `I reviewed your ${room.room_name} submission and wanted to send you the next best plan for this room.`,
    "",
    recommendationText,
    "",
    aiRecommendation?.before_photo_narrative ? `Before photo notes: ${aiRecommendation.before_photo_narrative}` : "",
    aiRecommendation?.recommended_layout_changes?.length
      ? `Recommended layout shifts:\n${aiRecommendation.recommended_layout_changes.map((item) => `- ${item}`).join("\n")}`
      : "",
    "",
    `Next best action: ${room.next_best_action}`,
    "",
    `Membership level: ${clientProfile.membership_level}`,
    "",
    "With care,",
    "Emily"
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, body };
}

function sanitizeEmilyEmailText(text) {
  return String(text || "")
    .replace(/\s*Your consultation notes add this important context:\s*Consultation source:[^.]+\.\s*/gi, " ")
    .replace(/\s*Consultation source:[^.]+\.\s*/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function sendClientEmail(store, { clientId, roomId, subject, body }) {
  const clientProfile = store.find("clientProfiles", clientId);
  const user = clientProfile ? store.find("users", clientProfile.user_id) : null;
  if (!clientProfile || !user) {
    return createEmailLog(store, {
      client_id: clientId,
      room_id: roomId,
      to_email: null,
      subject,
      body,
      status: "failed",
      error_message: "Missing client profile or user",
      sent_at: null,
      email_type: "client_recommendation"
    });
  }

  const [log] = await sendEmails(store, {
    clientId,
    roomId,
    toEmails: [user.email],
    subject,
    body,
    emailType: "client_recommendation"
  });
  return log;
}

export async function sendEmails(
  store,
  { clientId, roomId = null, toEmails = [], subject, body, emailType = "general", scheduledFor = null, metadata = {} }
) {
  const recipients = Array.from(new Set((toEmails || []).map((email) => String(email || "").trim()).filter(Boolean)));
  if (!recipients.length) {
    const log = await createEmailLog(store, {
      client_id: clientId,
      room_id: roomId,
      to_email: null,
      subject,
      body,
      status: "failed",
      error_message: "No recipient email addresses provided",
      sent_at: null,
      email_type: emailType,
      scheduled_for: scheduledFor,
      metadata
    });
    return [log];
  }

  const results = [];
  for (const toEmail of recipients) {
    results.push(
      await sendOneEmail(store, {
        clientId,
        roomId,
        toEmail,
        subject,
        body,
        emailType,
        scheduledFor,
        metadata
      })
    );
  }
  return results;
}

async function sendOneEmail(store, { clientId, roomId, toEmail, subject, body, emailType, scheduledFor, metadata }) {
  const webhookUrl = process.env.EMAIL_DELIVERY_WEBHOOK_URL;
  const payload = {
    to: toEmail,
    clientId,
    roomId,
    subject,
    body,
    emailType,
    scheduledFor,
    metadata
  };

  if (!webhookUrl) {
    return createEmailLog(store, {
      client_id: clientId,
      room_id: roomId,
      to_email: toEmail,
      subject,
      body,
      status: "dry-run",
      error_message: "No EMAIL_DELIVERY_WEBHOOK_URL configured",
      sent_at: new Date().toISOString(),
      email_type: emailType,
      scheduled_for: scheduledFor,
      metadata
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const responseText = await response.text();
    return createEmailLog(store, {
      client_id: clientId,
      room_id: roomId,
      to_email: toEmail,
      subject,
      body,
      status: response.ok ? "sent" : "failed",
      error_message: response.ok ? null : responseText.slice(0, 500),
      sent_at: response.ok ? new Date().toISOString() : null,
      email_type: emailType,
      scheduled_for: scheduledFor,
      metadata
    });
  } catch (error) {
    return createEmailLog(store, {
      client_id: clientId,
      room_id: roomId,
      to_email: toEmail,
      subject,
      body,
      status: "failed",
      error_message: error.message,
      sent_at: null,
      email_type: emailType,
      scheduled_for: scheduledFor,
      metadata
    });
  }
}

function createEmailLog(store, values) {
  return store.create("emailLogs", values, "email");
}
