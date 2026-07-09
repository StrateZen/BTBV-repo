import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadDefaultEnvFiles } from "./config/env.mjs";
import { publicUser, hashPassword, verifyPassword } from "./domain/auth.mjs";
import {
  ASSISTANT_ITEM_LABELS,
  ASSISTANT_ITEM_TYPES,
  BTBV_DIFFERENTIATORS,
  BTBV_SUPPORT_TRACKS,
  COMPETITOR_SERVICE_OPPORTUNITIES,
  DESIRED_ENERGY_OUTCOMES,
  FAQ_ITEMS,
  FREEDOM_SUPPORT_PATHS,
  FREEDOM_TOOL_STATUSES,
  GHL_FIELD_MAP,
  LEAD_SOURCES,
  ROOM_PRIORITIES,
  ROOM_STATUSES,
  ROOM_TYPES,
  SERVICE_PATHS,
  WARRANTY_CATEGORIES,
  getMembershipPermissions,
  membershipLevels
} from "./domain/constants.mjs";
import { generateRoomRecommendation } from "./domain/recommendations.mjs";
import {
  calculatePriorityScore,
  calculateRoomTransformation,
  buildClientDashboard,
  latestEntry
} from "./domain/scoring.mjs";
import {
  isAssistantReminderDue,
  isWarrantyReminderDue,
  normalizeReminderEmails,
  warrantyReminderScheduleKey
} from "./domain/reminders.mjs";
import { demoLoginEnabled, resolveSeedMode } from "./data/seed.mjs";
import { createStore } from "./data/store.mjs";
import { handleAppEvent, isGhlConfigured, syncAllContacts, syncContact, syncTags, triggerWorkflow } from "./integrations/ghl.mjs";
import { draftRecommendationEmail, sendClientEmail, sendEmails } from "./integrations/email.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
loadDefaultEnvFiles();
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
let reminderSchedulerRunning = false;
let ghlHourlySyncRunning = false;

const store = await createStore();
startReminderScheduler();
startGhlHourlySync();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error", detail: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`Room Energy Organizer running at http://${host}:${port}`);
});

function startReminderScheduler() {
  const intervalMs = Math.max(15000, Number(process.env.REMINDER_INTERVAL_MS || 60000));
  processScheduledReminders().catch((error) => console.error("Reminder scheduler failed", error));
  const handle = setInterval(() => {
    processScheduledReminders().catch((error) => console.error("Reminder scheduler failed", error));
  }, intervalMs);
  handle.unref?.();
}

function startGhlHourlySync() {
  const intervalMs = Math.max(300000, Number(process.env.GHL_AUTO_SYNC_INTERVAL_MS || 60 * 60 * 1000));
  processGhlHourlySync().catch((error) => console.error("Hourly GHL sync failed", error));
  const handle = setInterval(() => {
    processGhlHourlySync().catch((error) => console.error("Hourly GHL sync failed", error));
  }, intervalMs);
  handle.unref?.();
}

async function processScheduledReminders() {
  if (reminderSchedulerRunning) return;
  reminderSchedulerRunning = true;
  try {
    const now = new Date();
    await processAssistantReminderEmails(now);
    await processWarrantyReminderEmails(now);
  } finally {
    reminderSchedulerRunning = false;
  }
}

async function processGhlHourlySync() {
  if (ghlHourlySyncRunning) return;
  ghlHourlySyncRunning = true;
  try {
    await syncAllContacts(store, { eventType: "scheduled.hourly_contact_sync" });
  } finally {
    ghlHourlySyncRunning = false;
  }
}

async function processAssistantReminderEmails(now) {
  for (const item of store.all("assistantItems")) {
    if (!isAssistantReminderDue(item, now)) continue;
    if (!Array.isArray(item.reminder_emails) || !item.reminder_emails.length) continue;

    const clientProfile = store.find("clientProfiles", item.client_id);
    const user = clientProfile ? store.find("users", clientProfile.user_id) : null;
    const room = item.room_id ? store.find("rooms", item.room_id) : null;
    const subject = `${item.title} reminder`;
    const body = [
      `Hi ${(user?.name || "there").split(" ")[0]},`,
      "",
      `This is a reminder for: ${item.title}.`,
      item.notes ? `Notes: ${item.notes}` : "",
      item.due_date ? `Due date: ${formatEmailDateTime(item.due_date)}` : "",
      item.reminder_at ? `Reminder scheduled for: ${formatEmailDateTime(item.reminder_at)}` : "",
      room?.room_name ? `Linked room: ${room.room_name}` : "",
      "",
      "Room Energy Organizer"
    ]
      .filter(Boolean)
      .join("\n");

    await sendEmails(store, {
      clientId: item.client_id,
      roomId: room?.id || null,
      toEmails: item.reminder_emails,
      subject,
      body,
      emailType: "assistant_reminder",
      scheduledFor: item.reminder_at,
      metadata: { itemId: item.id, itemType: item.type }
    });

    await store.update("assistantItems", item.id, {
      reminder_sent_for: item.reminder_at,
      last_reminder_email_sent_at: now.toISOString()
    });
  }
}

async function processWarrantyReminderEmails(now) {
  for (const warranty of store.all("warranties")) {
    const clientProfile = store.find("clientProfiles", warranty.client_id);
    const timezone = clientProfile?.timezone || warranty.reminder_timezone || "America/Phoenix";
    if (!isWarrantyReminderDue(warranty, timezone, now)) continue;
    if (!Array.isArray(warranty.reminder_emails) || !warranty.reminder_emails.length) continue;

    const user = clientProfile ? store.find("users", clientProfile.user_id) : null;
    const scheduleKey = warrantyReminderScheduleKey(warranty, timezone);
    const subject = `${warranty.item_name} warranty reminder`;
    const body = [
      `Hi ${(user?.name || "there").split(" ")[0]},`,
      "",
      `This is your warranty reminder for ${warranty.item_name}.`,
      warranty.provider ? `Provider: ${warranty.provider}` : "",
      warranty.policy_number ? `Policy number: ${warranty.policy_number}` : "",
      warranty.expires_at ? `Warranty expiration: ${formatEmailDate(warranty.expires_at)}` : "",
      warranty.notes ? `Notes: ${warranty.notes}` : "",
      `Reminder schedule: ${reminderDateLabel(warranty.reminder_at)} at 9:00 AM (${timezone})`,
      "",
      "Room Energy Organizer"
    ]
      .filter(Boolean)
      .join("\n");

    await sendEmails(store, {
      clientId: warranty.client_id,
      toEmails: warranty.reminder_emails,
      subject,
      body,
      emailType: "warranty_reminder",
      scheduledFor: scheduleKey,
      metadata: { warrantyId: warranty.id, timezone }
    });

    await store.update("warranties", warranty.id, {
      reminder_sent_for: scheduleKey,
      last_reminder_email_sent_at: now.toISOString()
    });
  }
}

async function handleApi(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;

  if (method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true, app: "room-energy-organizer" });
    return;
  }

  if (method === "GET" && pathname === "/api/bootstrap") {
    sendJson(res, 200, {
      roomStatuses: ROOM_STATUSES,
      roomPriorities: ROOM_PRIORITIES,
      roomTypes: ROOM_TYPES,
      desiredEnergyOutcomes: DESIRED_ENERGY_OUTCOMES,
      leadSources: LEAD_SOURCES,
      servicePaths: SERVICE_PATHS,
      faqItems: FAQ_ITEMS,
      freedomToolStatuses: FREEDOM_TOOL_STATUSES,
      freedomSupportPaths: FREEDOM_SUPPORT_PATHS,
      ghlFieldMap: GHL_FIELD_MAP,
      assistantItemTypes: ASSISTANT_ITEM_TYPES,
      assistantItemLabels: ASSISTANT_ITEM_LABELS,
      warrantyCategories: WARRANTY_CATEGORIES,
      btbvSupportTracks: BTBV_SUPPORT_TRACKS,
      btbvDifferentiators: BTBV_DIFFERENTIATORS,
      competitorServiceOpportunities: COMPETITOR_SERVICE_OPPORTUNITIES,
      membershipLevels: membershipLevels(),
      appConfig: {
        seedMode: resolveSeedMode(),
        demoLoginEnabled: demoLoginEnabled()
      }
    });
    return;
  }

  if (method === "POST" && pathname === "/api/auth/register") {
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!body.name || !email || password.length < 6) {
      sendJson(res, 400, { error: "Name, valid email, and a password of at least 6 characters are required." });
      return;
    }

    if (store.findBy("users", (user) => user.email.toLowerCase() === email)) {
      sendJson(res, 409, { error: "An account already exists for that email." });
      return;
    }

    const user = await store.create("users", {
      name: String(body.name).trim(),
      email,
      role: "client",
      password_hash: hashPassword(password)
    }, "user");

    const clientProfile = await store.create("clientProfiles", {
      user_id: user.id,
      phone: body.phone || "",
      address: body.address || "",
      notes: "",
      internal_notes: "",
      ghl_contact_id: null,
      membership_level: body.membership_level || "Free / Intro",
      membership_status: "active",
      ghl_pipeline_stage: "New Client",
      timezone: body.timezone || "America/Phoenix",
      last_synced_at: null,
      sync_status: "pending"
    }, "client");

    await syncClientAfterChange(clientProfile.id, "client.created");
    sendJson(res, 201, sessionPayload(user, clientProfile));
    return;
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    const user = store.findBy("users", (candidate) => candidate.email.toLowerCase() === email);
    if (!user || !verifyPassword(String(body.password || ""), user.password_hash)) {
      sendJson(res, 401, { error: "Invalid email or password." });
      return;
    }

    const clientProfile = store.findBy("clientProfiles", (profile) => profile.user_id === user.id);
    sendJson(res, 200, sessionPayload(user, clientProfile));
    return;
  }

  const clientProfileMatch = pathname.match(/^\/api\/client-profiles\/([^/]+)$/);
  if (method === "PATCH" && clientProfileMatch) {
    const profile = store.find("clientProfiles", clientProfileMatch[1]);
    if (!profile) {
      sendJson(res, 404, { error: "Client profile not found." });
      return;
    }

    const body = await readJson(req);
    const user = store.find("users", profile.user_id);
    if (!user) {
      sendJson(res, 404, { error: "User not found for client profile." });
      return;
    }

    const nextEmail = String(body.email ?? user.email).trim().toLowerCase();
    if (
      nextEmail &&
      nextEmail !== user.email.toLowerCase() &&
      store.findBy("users", (candidate) => candidate.id !== user.id && candidate.email.toLowerCase() === nextEmail)
    ) {
      sendJson(res, 409, { error: "Another account already uses that email." });
      return;
    }

    const updatedUser = await store.update("users", user.id, {
      name: String(body.name ?? user.name).trim(),
      email: nextEmail || user.email
    });
    const updatedProfile = await store.update("clientProfiles", profile.id, {
      phone: body.phone ?? profile.phone,
      address: body.address ?? profile.address,
      notes: body.notes ?? profile.notes,
      internal_notes: body.internal_notes ?? profile.internal_notes ?? "",
      membership_level: body.membership_level ?? profile.membership_level,
      membership_status: body.membership_status ?? profile.membership_status,
      ghl_pipeline_stage: body.ghl_pipeline_stage ?? profile.ghl_pipeline_stage,
      timezone: normalizeTimezone(body.timezone, profile.timezone)
    });

    await syncClientAfterChange(updatedProfile.id, "membership.updated");
    sendJson(res, 200, {
      clientProfile: updatedProfile,
      user: publicUser(updatedUser),
      permissions: getMembershipPermissions(updatedProfile.membership_level)
    });
    return;
  }

  const clientDashboardMatch = pathname.match(/^\/api\/dashboard\/client\/([^/]+)$/);
  if (method === "GET" && clientDashboardMatch) {
    const clientProfile = store.find("clientProfiles", clientDashboardMatch[1]);
    if (!clientProfile) {
      sendJson(res, 404, { error: "Client profile not found." });
      return;
    }
    sendJson(res, 200, buildDashboardForClient(clientProfile.id));
    return;
  }

  if (method === "GET" && pathname === "/api/dashboard/admin") {
    sendJson(res, 200, buildAdminDashboard());
    return;
  }

  if (method === "GET" && pathname === "/api/rooms") {
    const clientId = url.searchParams.get("clientId");
    const rooms = clientId ? store.filter("rooms", (room) => room.client_id === clientId) : store.all("rooms");
    sendJson(res, 200, { rooms: rooms.map((room) => buildRoomDetails(room.id)) });
    return;
  }

  if (method === "POST" && pathname === "/api/rooms") {
    const body = await readJson(req);
    const clientProfile = store.find("clientProfiles", body.client_id);
    if (!clientProfile) {
      sendJson(res, 404, { error: "Client profile not found." });
      return;
    }

    const permissions = getMembershipPermissions(clientProfile.membership_level);
    const activeRooms = store.filter("rooms", (room) => room.client_id === clientProfile.id && room.status !== "Complete").length;
    if (activeRooms >= permissions.activeRoomLimit) {
      sendJson(res, 403, {
        error: "Membership active room limit reached.",
        permissions,
        activeRooms
      });
      return;
    }

    const room = await store.create("rooms", {
      client_id: clientProfile.id,
      room_name: body.room_name || "Untitled room",
      room_type: body.room_type || "Room",
      desired_energy_outcome: body.desired_energy_outcome || "Calm",
      ...normalizeRoomWorkbookFields(body),
      status: "Not Started",
      priority: body.priority || "Medium",
      current_progress: 0,
      next_best_action: "Upload before photos",
      upsell_flag: false,
      ghl_opportunity_id: null
    }, "room");

    await syncClientAfterChange(clientProfile.id, "room.created", room.id);
    sendJson(res, 201, { room: buildRoomDetails(room.id) });
    return;
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (method === "GET" && roomMatch) {
    const room = store.find("rooms", roomMatch[1]);
    if (!room) {
      sendJson(res, 404, { error: "Room not found." });
      return;
    }
    sendJson(res, 200, { room: buildRoomDetails(room.id) });
    return;
  }

  if (method === "PATCH" && roomMatch) {
    const room = store.find("rooms", roomMatch[1]);
    if (!room) {
      sendJson(res, 404, { error: "Room not found." });
      return;
    }
    const body = await readJson(req);
    const updatedRoom = await store.update("rooms", room.id, {
      status: body.status || room.status,
      room_name: body.room_name ?? room.room_name,
      room_type: body.room_type ?? room.room_type,
      desired_energy_outcome: body.desired_energy_outcome ?? room.desired_energy_outcome,
      priority: body.priority ?? room.priority,
      ...normalizeRoomWorkbookFields(body, room),
      current_progress: body.current_progress ?? room.current_progress,
      next_best_action: body.next_best_action ?? room.next_best_action,
      upsell_flag: body.upsell_flag ?? room.upsell_flag
    });
    await recalculateRoomScore(room.id);

    if (body.status === "Nurture") {
      await moveRoomToNurture(room.id);
      await syncClientAfterChange(room.client_id, "room.nurture_started", room.id);
    } else if (body.status === "Complete") {
      await syncClientAfterChange(room.client_id, "room.completed", room.id);
    } else {
      await syncClientAfterChange(room.client_id, "room.updated", room.id);
    }

    sendJson(res, 200, { room: buildRoomDetails(updatedRoom.id) });
    return;
  }

  const roomPhotosMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/photos$/);
  if (method === "POST" && roomPhotosMatch) {
    const room = store.find("rooms", roomPhotosMatch[1]);
    if (!room) {
      sendJson(res, 404, { error: "Room not found." });
      return;
    }
    const body = await readJson(req);
    const photoType = body.photo_type || "before";
    const photoUrls = Array.isArray(body.photos) ? body.photos : [body.photo_url].filter(Boolean);
    const photos = [];
    for (const photoUrl of photoUrls) {
      photos.push(
        await store.create("roomPhotos", {
          room_id: room.id,
          photo_url: photoUrl,
          photo_type: photoType,
          uploaded_at: new Date().toISOString()
        }, "photo")
      );
    }

    if (photoType === "before" && room.status === "Not Started") {
      await store.update("rooms", room.id, {
        status: "Not Started",
        next_best_action: "Submit emotional intake"
      });
    }
    await syncClientAfterChange(room.client_id, photoType === "after" ? "room.after_photos_requested" : "room.updated", room.id);

    sendJson(res, 201, { photos, room: buildRoomDetails(room.id) });
    return;
  }

  const roomEmotionMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/emotions$/);
  if (method === "POST" && roomEmotionMatch) {
    const room = store.find("rooms", roomEmotionMatch[1]);
    if (!room) {
      sendJson(res, 404, { error: "Room not found." });
      return;
    }
    const body = await readJson(req);
    const entry = await createEmotionEntry(room.id, body.entry_type || "before", body);

    if (entry.entry_type === "before") {
      await store.update("rooms", room.id, {
        status: "Intake Submitted",
        current_progress: Math.max(Number(room.current_progress || 0), 15),
        next_best_action: "Generate AI review"
      });
      await recalculateRoomScore(room.id);
      await syncClientAfterChange(room.client_id, "room.intake_submitted", room.id);
    } else {
      await store.update("rooms", room.id, {
        status: "Complete",
        current_progress: 100,
        next_best_action: "Choose the next room"
      });
      await recalculateRoomScore(room.id);
      await syncClientAfterChange(room.client_id, "room.completed", room.id);
    }

    sendJson(res, 201, { emotionEntry: entry, room: buildRoomDetails(room.id) });
    return;
  }

  const emotionMatch = pathname.match(/^\/api\/emotions\/([^/]+)$/);
  if (method === "PATCH" && emotionMatch) {
    const entry = store.find("emotionEntries", emotionMatch[1]);
    if (!entry) {
      sendJson(res, 404, { error: "Emotion entry not found." });
      return;
    }

    const room = store.find("rooms", entry.room_id);
    if (!room) {
      sendJson(res, 404, { error: "Room not found for emotion entry." });
      return;
    }

    const body = await readJson(req);
    const updatedEntry = await store.update("emotionEntries", entry.id, {
      emotions: normalizeSubmittedEmotions(body.emotions ?? entry.emotions),
      client_comments: body.client_comments ?? body.comments ?? entry.client_comments,
      stress_score: Number(body.stress_score ?? entry.stress_score),
      clutter_score: Number(body.clutter_score ?? entry.clutter_score),
      energy_alignment_score: Number(body.energy_alignment_score ?? entry.energy_alignment_score),
      functional_friction_score: scoreValue(body.functional_friction_score, entry.functional_friction_score ?? entry.stress_score ?? 5),
      storage_fit_score: scoreValue(body.storage_fit_score, entry.storage_fit_score ?? (10 - Number(entry.clutter_score ?? 5))),
      sentimental_load_score: scoreValue(body.sentimental_load_score, entry.sentimental_load_score ?? 5),
      readiness_score: scoreValue(body.readiness_score, entry.readiness_score ?? 5),
      second_circle_intensity_score: scoreValue(
        body.second_circle_intensity_score,
        entry.second_circle_intensity_score ?? entry.sentimental_load_score ?? 5
      ),
      release_readiness_score: scoreValue(
        body.release_readiness_score,
        entry.release_readiness_score ?? entry.readiness_score ?? 5
      ),
      decision_urgency_score: scoreValue(body.decision_urgency_score, entry.decision_urgency_score ?? 5)
    });
    await recalculateRoomScore(room.id);
    await syncClientAfterChange(room.client_id, "room.updated", room.id);
    sendJson(res, 200, { emotionEntry: updatedEntry, room: buildRoomDetails(room.id) });
    return;
  }

  const roomAiMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/ai-review$/);
  if (method === "POST" && roomAiMatch) {
    const room = store.find("rooms", roomAiMatch[1]);
    if (!room) {
      sendJson(res, 404, { error: "Room not found." });
      return;
    }
    const clientProfile = store.find("clientProfiles", room.client_id);
    const permissions = getMembershipPermissions(clientProfile.membership_level);
    const reviewsUsed = store.filter("aiRecommendations", (recommendation) => {
      const recommendationRoom = store.find("rooms", recommendation.room_id);
      return recommendationRoom?.client_id === clientProfile.id;
    }).length;

    if (reviewsUsed >= permissions.aiReviewLimit) {
      sendJson(res, 403, {
        error: "Membership AI review limit reached.",
        permissions,
        reviewsUsed
      });
      return;
    }

    const beforeEntry = latestEntry(store.all("emotionEntries"), room.id, "before");
    const beforePhotos = store.filter("roomPhotos", (photo) => photo.room_id === room.id && photo.photo_type === "before");
    if (!beforeEntry) {
      sendJson(res, 400, { error: "Before emotional intake is required before AI review." });
      return;
    }

    const recommendation = await generateRoomRecommendation({ room, beforeEntry, beforePhotos, permissions });
    const aiRecommendation = await store.create("aiRecommendations", {
      room_id: room.id,
      ...recommendation,
      created_at: new Date().toISOString()
    }, "ai");

    const highNeed =
      Number(beforeEntry.stress_score) >= 8 ||
      Number(beforeEntry.clutter_score) >= 8 ||
      Number(beforeEntry.energy_alignment_score) <= 3 ||
      Number(beforeEntry.functional_friction_score) >= 8 ||
      Number(beforeEntry.sentimental_load_score) >= 8 ||
      Number(beforeEntry.second_circle_intensity_score) >= 8 ||
      Number(beforeEntry.decision_urgency_score) >= 8;
    const updatedRoom = await store.update("rooms", room.id, {
      status: "Emily Review Needed",
      current_progress: Math.max(Number(room.current_progress || 0), 25),
      next_best_action: "Emily review in progress",
      upsell_flag: room.upsell_flag || highNeed
    });

    const openRoomCount = store.filter("rooms", (candidate) => candidate.client_id === clientProfile.id && candidate.status !== "Complete").length;
    const priorityScore = calculatePriorityScore({ room: updatedRoom, beforeEntry, clientProfile, openRoomCount });

    await store.create("tasks", {
      assigned_to: "user_emily",
      client_id: clientProfile.id,
      room_id: room.id,
      task_type: "emily_review",
      status: "open",
      due_date: addDays(permissions.reviewQueuePriority >= 5 ? 1 : 3),
      notes: "Review AI recommendation and personalize the client message.",
      priority_score: priorityScore,
      membership_priority: permissions.reviewQueuePriority
    }, "task");

    await syncClientAfterChange(clientProfile.id, "ai.review_completed", room.id);
    await syncClientAfterChange(clientProfile.id, "emily.review_needed", room.id);
    if (updatedRoom.upsell_flag) await syncClientAfterChange(clientProfile.id, "upsell.identified", room.id);

    sendJson(res, 201, { aiRecommendation, room: buildRoomDetails(room.id) });
    return;
  }

  const roomEmilyMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/emily-review$/);
  if (method === "POST" && roomEmilyMatch) {
    const room = store.find("rooms", roomEmilyMatch[1]);
    if (!room) {
      sendJson(res, 404, { error: "Room not found." });
      return;
    }
    const body = await readJson(req);
    const existing = store.findBy("emilyReviews", (review) => review.room_id === room.id);
    const ai = latestAi(room.id);
    const clientProfile = store.find("clientProfiles", room.client_id);
    const user = clientProfile ? store.find("users", clientProfile.user_id) : null;
    const draft = draftRecommendationEmail({
      user,
      clientProfile,
      room,
      review: { final_recommendation: body.final_recommendation || "" },
      aiRecommendation: ai
    });
    const values = {
      room_id: room.id,
      ai_recommendation_id: body.ai_recommendation_id || body.aiRecommendationId || ai?.id || null,
      emily_notes: body.emily_notes || "",
      final_recommendation: body.final_recommendation || "",
      email_subject: body.email_subject || draft.subject,
      email_body: body.email_body || draft.body,
      approved: Boolean(body.approved),
      sent_to_client: Boolean(body.sent_to_client),
      updated_at: new Date().toISOString()
    };

    const review = existing
      ? await store.update("emilyReviews", existing.id, values)
      : await store.create("emilyReviews", values, "review");

    const openTask = store.findBy("tasks", (task) => task.room_id === room.id && task.status === "open");
    if (openTask) await store.update("tasks", openTask.id, { status: "reviewed" });

    if (body.sent_to_client) {
      await sendRecommendation(room.id);
    } else {
      await syncClientAfterChange(room.client_id, "room.updated", room.id);
    }

    sendJson(res, 200, { emilyReview: review, room: buildRoomDetails(room.id) });
    return;
  }

  const sendRecommendationMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/send-recommendation$/);
  if (method === "POST" && sendRecommendationMatch) {
    const result = await sendRecommendation(sendRecommendationMatch[1]);
    if (!result) {
      sendJson(res, 404, { error: "Room or review not found." });
      return;
    }
    sendJson(res, 200, result);
    return;
  }

  const roomAfterMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/after$/);
  if (method === "POST" && roomAfterMatch) {
    const room = store.find("rooms", roomAfterMatch[1]);
    if (!room) {
      sendJson(res, 404, { error: "Room not found." });
      return;
    }
    const body = await readJson(req);
    const photoUrls = Array.isArray(body.photos) ? body.photos : [body.photo_url].filter(Boolean);
    for (const photoUrl of photoUrls) {
      await store.create("roomPhotos", {
        room_id: room.id,
        photo_url: photoUrl,
        photo_type: "after",
        uploaded_at: new Date().toISOString()
      }, "photo");
    }

    const emotionEntry = await createEmotionEntry(room.id, "after", body.emotion || body);
    await store.update("rooms", room.id, {
      status: "Complete",
      current_progress: 100,
      next_best_action: "Choose the next room"
    });
    await recalculateRoomScore(room.id);
    await syncClientAfterChange(room.client_id, "room.completed", room.id);

    sendJson(res, 201, { emotionEntry, room: buildRoomDetails(room.id) });
    return;
  }

  if (method === "GET" && pathname === "/api/tasks") {
    const status = url.searchParams.get("status");
    const tasks = status ? store.filter("tasks", (task) => task.status === status) : store.all("tasks");
    sendJson(res, 200, { tasks: tasks.map(enrichTask).sort((a, b) => b.priority_score - a.priority_score) });
    return;
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (method === "PATCH" && taskMatch) {
    const task = store.find("tasks", taskMatch[1]);
    if (!task) {
      sendJson(res, 404, { error: "Task not found." });
      return;
    }
    const body = await readJson(req);
    const updated = await store.update("tasks", task.id, {
      status: body.status ?? task.status,
      notes: body.notes ?? task.notes,
      due_date: body.due_date ?? task.due_date,
      priority_score: body.priority_score ?? task.priority_score
    });
    sendJson(res, 200, { task: enrichTask(updated) });
    return;
  }

  if (method === "POST" && pathname === "/api/ghl/webhooks/membership-updated") {
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    const profile =
      store.findBy("clientProfiles", (candidate) => candidate.ghl_contact_id && candidate.ghl_contact_id === body.ghl_contact_id) ||
      store.findBy("clientProfiles", (candidate) => store.find("users", candidate.user_id)?.email.toLowerCase() === email);

    if (!profile) {
      sendJson(res, 404, { error: "Client profile not found for membership update." });
      return;
    }

    const updated = await store.update("clientProfiles", profile.id, {
      ghl_contact_id: body.ghl_contact_id ?? profile.ghl_contact_id,
      membership_level: body.membership_level ?? profile.membership_level,
      membership_status: body.membership_status ?? profile.membership_status,
      ghl_pipeline_stage: body.ghl_pipeline_stage ?? profile.ghl_pipeline_stage,
      last_synced_at: new Date().toISOString(),
      sync_status: "synced"
    });
    await syncClientAfterChange(updated.id, "membership.updated");
    sendJson(res, 200, { clientProfile: updated, permissions: getMembershipPermissions(updated.membership_level) });
    return;
  }

  const ghlContactMatch = pathname.match(/^\/api\/ghl\/sync\/contact\/([^/]+)$/);
  if (method === "POST" && ghlContactMatch) {
    const log = await syncContact(store, ghlContactMatch[1], { eventType: "manual.contact_sync" });
    sendJson(res, 200, { log });
    return;
  }

  if (method === "POST" && pathname === "/api/ghl/sync/all") {
    const result = await syncAllContacts(store, { eventType: "manual.contact_sync_all" });
    sendJson(res, 200, result);
    return;
  }

  const ghlTagsMatch = pathname.match(/^\/api\/ghl\/sync\/tags\/([^/]+)$/);
  if (method === "POST" && ghlTagsMatch) {
    const body = await readJson(req);
    const log = await syncTags(store, ghlTagsMatch[1], body.tags || [], { eventType: "manual.tag_sync" });
    sendJson(res, 200, { log });
    return;
  }

  if (method === "POST" && pathname === "/api/ghl/trigger-workflow") {
    const body = await readJson(req);
    const log = await triggerWorkflow(store, body.event_type || "manual.workflow", body.client_id, body.payload || {});
    sendJson(res, 200, { log });
    return;
  }

  if (method === "GET" && pathname === "/api/ghl/sync-logs") {
    sendJson(res, 200, { logs: store.all("ghlSyncLogs").slice().reverse().slice(0, 100) });
    return;
  }

  if (method === "GET" && pathname === "/api/ghl/field-map") {
    sendJson(res, 200, { fields: GHL_FIELD_MAP });
    return;
  }

  const assistantMatch = pathname.match(/^\/api\/assistant\/client\/([^/]+)\/items$/);
  if (method === "GET" && assistantMatch) {
    const clientId = assistantMatch[1];
    sendJson(res, 200, {
      items: store
        .filter("assistantItems", (item) => item.client_id === clientId)
        .sort(sortByReminderDate)
    });
    return;
  }

  if (method === "POST" && assistantMatch) {
    const clientId = assistantMatch[1];
    const clientProfile = store.find("clientProfiles", clientId);
    if (!clientProfile) {
      sendJson(res, 404, { error: "Client profile not found." });
      return;
    }
    const body = await readJson(req);
    const item = await store.create("assistantItems", normalizeAssistantItem(clientId, body), "assistant");
    await syncClientAfterChange(clientId, "assistant.updated");
    sendJson(res, 201, { item });
    return;
  }

  const assistantItemMatch = pathname.match(/^\/api\/assistant\/items\/([^/]+)$/);
  if (method === "PATCH" && assistantItemMatch) {
    const item = store.find("assistantItems", assistantItemMatch[1]);
    if (!item) {
      sendJson(res, 404, { error: "Assistant item not found." });
      return;
    }
    const body = await readJson(req);
    const updated = await store.update("assistantItems", item.id, normalizeAssistantItem(item.client_id, { ...item, ...body }));
    await syncClientAfterChange(updated.client_id, "assistant.updated");
    sendJson(res, 200, { item: updated });
    return;
  }

  if (method === "DELETE" && assistantItemMatch) {
    const item = store.find("assistantItems", assistantItemMatch[1]);
    if (!item) {
      sendJson(res, 404, { error: "Assistant item not found." });
      return;
    }
    const deleted = await store.delete("assistantItems", item.id);
    await syncClientAfterChange(item.client_id, "assistant.updated");
    sendJson(res, 200, { deleted: Boolean(deleted), item });
    return;
  }

  const assistantCalendarMatch = pathname.match(/^\/api\/assistant\/items\/([^/]+)\/calendar\.ics$/);
  if (method === "GET" && assistantCalendarMatch) {
    const item = store.find("assistantItems", assistantCalendarMatch[1]);
    if (!item) {
      sendJson(res, 404, { error: "Assistant item not found." });
      return;
    }
    sendText(res, 200, buildIcsForItem(item), "text/calendar; charset=utf-8");
    return;
  }

  const assistantClientCalendarMatch = pathname.match(/^\/api\/assistant\/client\/([^/]+)\/calendar\.ics$/);
  if (method === "GET" && assistantClientCalendarMatch) {
    const items = store.filter("assistantItems", (item) => item.client_id === assistantClientCalendarMatch[1]);
    sendText(res, 200, buildIcsCalendar(items), "text/calendar; charset=utf-8");
    return;
  }

  const warrantyMatch = pathname.match(/^\/api\/warranties\/client\/([^/]+)$/);
  if (method === "GET" && warrantyMatch) {
    const clientId = warrantyMatch[1];
    const search = String(url.searchParams.get("q") || "").toLowerCase();
    const warranties = store
      .filter("warranties", (warranty) => warranty.client_id === clientId)
      .filter((warranty) => !search || warrantySearchText(warranty).includes(search))
      .sort((a, b) => String(a.expires_at || "").localeCompare(String(b.expires_at || "")));
    sendJson(res, 200, { warranties });
    return;
  }

  if (method === "POST" && warrantyMatch) {
    const clientId = warrantyMatch[1];
    const clientProfile = store.find("clientProfiles", clientId);
    if (!clientProfile) {
      sendJson(res, 404, { error: "Client profile not found." });
      return;
    }
    const body = await readJson(req);
    const warranty = await store.create("warranties", normalizeWarranty(clientId, body), "warranty");
    await syncClientAfterChange(clientId, "warranty.updated");
    sendJson(res, 201, { warranty });
    return;
  }

  const warrantyItemMatch = pathname.match(/^\/api\/warranties\/([^/]+)$/);
  if (method === "PATCH" && warrantyItemMatch) {
    const warranty = store.find("warranties", warrantyItemMatch[1]);
    if (!warranty) {
      sendJson(res, 404, { error: "Warranty not found." });
      return;
    }
    const body = await readJson(req);
    const updated = await store.update("warranties", warranty.id, normalizeWarranty(warranty.client_id, { ...warranty, ...body }));
    await syncClientAfterChange(updated.client_id, "warranty.updated");
    sendJson(res, 200, { warranty: updated });
    return;
  }

  if (method === "DELETE" && warrantyItemMatch) {
    const warranty = store.find("warranties", warrantyItemMatch[1]);
    if (!warranty) {
      sendJson(res, 404, { error: "Warranty not found." });
      return;
    }
    const deleted = await store.delete("warranties", warranty.id);
    await syncClientAfterChange(warranty.client_id, "warranty.updated");
    sendJson(res, 200, { deleted: Boolean(deleted), warranty });
    return;
  }

  const freedomMatch = pathname.match(/^\/api\/freedom\/client\/([^/]+)\/entries$/);
  if (method === "GET" && freedomMatch) {
    const clientId = freedomMatch[1];
    const entries = store
      .filter("freedomEntries", (entry) => entry.client_id === clientId)
      .sort(sortFreedomEntries);
    sendJson(res, 200, { entries });
    return;
  }

  if (method === "POST" && freedomMatch) {
    const clientId = freedomMatch[1];
    const clientProfile = store.find("clientProfiles", clientId);
    if (!clientProfile) {
      sendJson(res, 404, { error: "Client profile not found." });
      return;
    }
    const body = await readJson(req);
    const entry = await store.create("freedomEntries", normalizeFreedomEntry(clientId, body), "freedom");
    await syncClientAfterChange(clientId, "freedom_tool.updated");
    sendJson(res, 201, { entry });
    return;
  }

  const freedomItemMatch = pathname.match(/^\/api\/freedom\/entries\/([^/]+)$/);
  if (method === "PATCH" && freedomItemMatch) {
    const entry = store.find("freedomEntries", freedomItemMatch[1]);
    if (!entry) {
      sendJson(res, 404, { error: "Freedom Tool entry not found." });
      return;
    }
    const body = await readJson(req);
    const updated = await store.update("freedomEntries", entry.id, normalizeFreedomEntry(entry.client_id, { ...entry, ...body }));
    await syncClientAfterChange(updated.client_id, "freedom_tool.updated");
    sendJson(res, 200, { entry: updated });
    return;
  }

  if (method === "DELETE" && freedomItemMatch) {
    const entry = store.find("freedomEntries", freedomItemMatch[1]);
    if (!entry) {
      sendJson(res, 404, { error: "Freedom Tool entry not found." });
      return;
    }
    const deleted = await store.delete("freedomEntries", entry.id);
    await syncClientAfterChange(entry.client_id, "freedom_tool.updated");
    sendJson(res, 200, { deleted: Boolean(deleted), entry });
    return;
  }

  if (method === "GET" && pathname === "/api/community/posts") {
    sendJson(res, 200, { posts: buildCommunityPosts() });
    return;
  }

  if (method === "POST" && pathname === "/api/community/posts") {
    const body = await readJson(req);
    const clientProfile = store.find("clientProfiles", body.client_id);
    if (!clientProfile) {
      sendJson(res, 404, { error: "Client profile not found." });
      return;
    }
    const post = await store.create(
      "communityPosts",
      {
        client_id: clientProfile.id,
        title: String(body.title || "Community question").trim(),
        body: String(body.body || "").trim(),
        photo_url: body.photo_url || "",
        ratings: []
      },
      "community_post"
    );
    sendJson(res, 201, { post: enrichCommunityPost(post) });
    return;
  }

  const communityCommentMatch = pathname.match(/^\/api\/community\/posts\/([^/]+)\/comments$/);
  if (method === "POST" && communityCommentMatch) {
    const post = store.find("communityPosts", communityCommentMatch[1]);
    if (!post) {
      sendJson(res, 404, { error: "Community post not found." });
      return;
    }
    const body = await readJson(req);
    const clientProfile = store.find("clientProfiles", body.client_id);
    if (!clientProfile) {
      sendJson(res, 404, { error: "Client profile not found." });
      return;
    }
    const comment = await store.create(
      "communityComments",
      {
        post_id: post.id,
        client_id: clientProfile.id,
        body: String(body.body || "").trim()
      },
      "community_comment"
    );
    sendJson(res, 201, { comment: enrichCommunityComment(comment), post: enrichCommunityPost(post) });
    return;
  }

  const communityRatingMatch = pathname.match(/^\/api\/community\/posts\/([^/]+)\/rating$/);
  if (method === "PATCH" && communityRatingMatch) {
    const post = store.find("communityPosts", communityRatingMatch[1]);
    if (!post) {
      sendJson(res, 404, { error: "Community post not found." });
      return;
    }
    const body = await readJson(req);
    const clientId = body.client_id;
    if (!store.find("clientProfiles", clientId)) {
      sendJson(res, 404, { error: "Client profile not found." });
      return;
    }
    const rating = Math.max(1, Math.min(5, Number(body.rating || 5)));
    const ratings = Array.isArray(post.ratings) ? post.ratings.filter((item) => item.client_id !== clientId) : [];
    ratings.push({ client_id: clientId, rating });
    const updated = await store.update("communityPosts", post.id, { ratings });
    sendJson(res, 200, { post: enrichCommunityPost(updated) });
    return;
  }

  sendJson(res, 404, { error: "API route not found." });
}

function sessionPayload(user, clientProfile) {
  return {
    user: publicUser(user),
    clientProfile: clientProfile || null,
    permissions: clientProfile ? getMembershipPermissions(clientProfile.membership_level) : null
  };
}

function buildDashboardForClient(clientId) {
  const clientProfile = store.find("clientProfiles", clientId);
  const user = store.find("users", clientProfile.user_id);
  const rooms = store.filter("rooms", (room) => room.client_id === clientId);
  const roomIds = new Set(rooms.map((room) => room.id));
  return buildClientDashboard({
    clientProfile,
    user: publicUser(user),
    rooms,
    photos: store.filter("roomPhotos", (photo) => roomIds.has(photo.room_id)),
    emotionEntries: store.filter("emotionEntries", (entry) => roomIds.has(entry.room_id)),
    roomScores: store.filter("roomScores", (score) => roomIds.has(score.room_id)),
    aiRecommendations: store.filter("aiRecommendations", (recommendation) => roomIds.has(recommendation.room_id)),
    emilyReviews: store.filter("emilyReviews", (review) => roomIds.has(review.room_id)),
    freedomEntries: store.filter("freedomEntries", (entry) => entry.client_id === clientId)
  });
}

function buildAdminDashboard() {
  const clients = store.all("clientProfiles").map((profile) => {
    const user = store.find("users", profile.user_id);
    const dashboard = buildDashboardForClient(profile.id);
    return {
      id: profile.id,
      user: publicUser(user),
      phone: profile.phone,
      address: profile.address,
      timezone: profile.timezone || "America/Phoenix",
      notes: profile.notes || "",
      internal_notes: profile.internal_notes || "",
      membership_level: profile.membership_level,
      membership_status: profile.membership_status,
      ghl_pipeline_stage: profile.ghl_pipeline_stage,
      sync_status: profile.sync_status,
      valueSummary: dashboard.valueSummary,
      summary: dashboard.summary,
      roomCards: dashboard.roomCards,
      freedomTool: dashboard.freedomTool,
      permissions: dashboard.permissions
    };
  });

  const reviewQueue = store
    .filter("tasks", (task) => task.status === "open")
    .map(enrichTask)
    .sort((a, b) => {
      if (b.membership_priority !== a.membership_priority) return b.membership_priority - a.membership_priority;
      return b.priority_score - a.priority_score;
    });

  return {
    overview: buildAdminOverview(clients),
    reviewQueue,
    clients,
    ghlStatus: buildGhlStatus(),
    syncLogs: store.all("ghlSyncLogs").slice().reverse().slice(0, 20),
    emailLogs: store.all("emailLogs").slice().reverse().slice(0, 20),
    ghlFieldMap: GHL_FIELD_MAP,
    competitorServiceOpportunities: COMPETITOR_SERVICE_OPPORTUNITIES
  };
}

function buildGhlStatus() {
  const logs = store
    .all("ghlSyncLogs")
    .filter((log) => ["scheduled.hourly_contact_sync", "manual.contact_sync_all"].includes(log.event_type))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const lastHourly = logs.find((log) => log.event_type === "scheduled.hourly_contact_sync") || null;
  const lastBulk = logs.find((log) => log.event_type === "manual.contact_sync_all") || null;

  return {
    configured: isGhlConfigured(),
    autoSyncIntervalMs: Math.max(300000, Number(process.env.GHL_AUTO_SYNC_INTERVAL_MS || 60 * 60 * 1000)),
    lastHourlySyncAt: lastHourly?.created_at || null,
    lastBulkSyncAt: lastBulk?.created_at || null
  };
}

function buildAdminOverview(clients) {
  const totalClients = clients.length;
  const totals = clients.reduce(
    (memo, client) => {
      memo.homeScore += Number(client.summary.home_transformation_score || 0);
      memo.overallScore += Number(client.summary.average_overall_score || 0);
      memo.workbookPriority += Number(client.summary.average_workbook_priority_score || 0);
      memo.roomsCompleted += Number(client.summary.rooms_completed || 0);
      memo.roomsOpen += Number(client.summary.rooms_open || 0);
      memo.roomsNeedingAttention += Number(client.summary.rooms_needing_attention || 0);
      memo.recommendationsCompleted += Number(client.summary.total_recommendations_completed || 0);
      memo.roomsWithSupportTracks += Number(client.summary.rooms_with_support_tracks || 0);
      memo.roomsWithVisionReview += Number(client.summary.rooms_with_vision_review || 0);
      memo.freedomEntries += Number(client.freedomTool?.total_entries || 0);
      memo.freedomReleased += Number(client.freedomTool?.released_count || 0);
      memo.freedomEvidence += Number(client.freedomTool?.evidence_count || 0);
      if (Number(client.freedomTool?.total_entries || 0) > 0) {
        memo.freedomShift += Number(client.freedomTool?.average_shift_score || 0);
        memo.freedomClients += 1;
      }
      return memo;
    },
    {
      homeScore: 0,
      overallScore: 0,
      workbookPriority: 0,
      roomsCompleted: 0,
      roomsOpen: 0,
      roomsNeedingAttention: 0,
      recommendationsCompleted: 0,
      roomsWithSupportTracks: 0,
      roomsWithVisionReview: 0,
      freedomEntries: 0,
      freedomReleased: 0,
      freedomEvidence: 0,
      freedomShift: 0,
      freedomClients: 0
    }
  );

  return {
    total_clients: totalClients,
    active_clients: clients.filter((client) => client.membership_status === "active").length,
    average_home_transformation_score: totalClients ? Math.round(totals.homeScore / totalClients) : 0,
    average_overall_score: totalClients ? Math.round(totals.overallScore / totalClients) : 0,
    average_workbook_priority_score: totalClients ? Math.round(totals.workbookPriority / totalClients) : 0,
    rooms_completed: totals.roomsCompleted,
    rooms_open: totals.roomsOpen,
    rooms_needing_attention: totals.roomsNeedingAttention,
    recommendations_completed: totals.recommendationsCompleted,
    rooms_with_support_tracks: totals.roomsWithSupportTracks,
    rooms_with_vision_review: totals.roomsWithVisionReview,
    freedom_entries: totals.freedomEntries,
    freedom_released: totals.freedomReleased,
    freedom_evidence_logs: totals.freedomEvidence,
    average_freedom_shift_score: totals.freedomClients
      ? Math.round((totals.freedomShift / totals.freedomClients) * 10) / 10
      : 0,
    review_queue_count: store.filter("tasks", (task) => task.status === "open").length,
    nurture_rooms: store.filter("rooms", (room) => room.status === "Nurture").length
  };
}

function buildRoomDetails(roomId) {
  const room = store.find("rooms", roomId);
  if (!room) return null;
  return {
    ...room,
    photos: store.filter("roomPhotos", (photo) => photo.room_id === room.id),
    emotions: store.filter("emotionEntries", (entry) => entry.room_id === room.id),
    aiRecommendations: store.filter("aiRecommendations", (recommendation) => recommendation.room_id === room.id),
    emilyReviews: store.filter("emilyReviews", (review) => review.room_id === room.id),
    score: store.findBy("roomScores", (score) => score.room_id === room.id) || null
  };
}

function buildCommunityPosts() {
  return store
    .all("communityPosts")
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(enrichCommunityPost);
}

function enrichCommunityPost(post) {
  const profile = store.find("clientProfiles", post.client_id);
  const user = profile ? store.find("users", profile.user_id) : null;
  const comments = store
    .filter("communityComments", (comment) => comment.post_id === post.id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(enrichCommunityComment);
  const ratings = Array.isArray(post.ratings) ? post.ratings : [];
  const ratingAverage = ratings.length ? ratings.reduce((sum, item) => sum + Number(item.rating || 0), 0) / ratings.length : 0;

  return {
    ...post,
    author: user ? publicUser(user) : { name: "Client" },
    author_rating: communityRatingSummaryForClient(post.client_id),
    comments,
    rating_average: Math.round(ratingAverage * 10) / 10,
    rating_count: ratings.length
  };
}

function enrichCommunityComment(comment) {
  const profile = store.find("clientProfiles", comment.client_id);
  const user = profile ? store.find("users", profile.user_id) : null;
  return {
    ...comment,
    author: user ? publicUser(user) : { name: "Client" },
    author_rating: communityRatingSummaryForClient(comment.client_id)
  };
}

function communityRatingSummaryForClient(clientId) {
  const ratings = store
    .filter("communityPosts", (post) => post.client_id === clientId)
    .flatMap((post) => (Array.isArray(post.ratings) ? post.ratings : []))
    .map((item) => Number(item.rating || 0))
    .filter((rating) => rating > 0);

  return {
    average: ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : 0,
    count: ratings.length
  };
}

function enrichTask(task) {
  const roomRecord = store.find("rooms", task.room_id);
  const room = roomRecord ? buildRoomDetails(roomRecord.id) : null;
  const clientProfile = store.find("clientProfiles", task.client_id);
  const user = clientProfile ? store.find("users", clientProfile.user_id) : null;
  const beforeEntry = latestEntry(store.all("emotionEntries"), task.room_id, "before");
  return {
    ...task,
    room,
    clientProfile,
    clientUser: publicUser(user),
    beforeEntry,
    aiRecommendation: latestAi(task.room_id),
    emailDraft: room && clientProfile && user
      ? draftRecommendationEmail({
          user,
          clientProfile,
          room,
          review: store.findBy("emilyReviews", (review) => review.room_id === task.room_id),
          aiRecommendation: latestAi(task.room_id)
        })
      : null
  };
}

async function createEmotionEntry(roomId, entryType, values) {
  const entry = await store.create("emotionEntries", {
    room_id: roomId,
    entry_type: entryType,
    emotions: normalizeSubmittedEmotions(values.emotions),
    client_comments: values.client_comments || values.comments || "",
    stress_score: Number(values.stress_score ?? 5),
    clutter_score: Number(values.clutter_score ?? 5),
    energy_alignment_score: Number(values.energy_alignment_score ?? 5),
    functional_friction_score: scoreValue(values.functional_friction_score, values.stress_score ?? 5),
    storage_fit_score: scoreValue(values.storage_fit_score, 10 - Number(values.clutter_score ?? 5)),
    sentimental_load_score: scoreValue(values.sentimental_load_score, 5),
    readiness_score: scoreValue(values.readiness_score, 5),
    second_circle_intensity_score: scoreValue(values.second_circle_intensity_score, values.sentimental_load_score ?? 5),
    release_readiness_score: scoreValue(values.release_readiness_score, values.readiness_score ?? 5),
    decision_urgency_score: scoreValue(values.decision_urgency_score, 5),
    created_at: new Date().toISOString()
  }, "emotion");
  return entry;
}

function normalizeRoomWorkbookFields(values = {}, existing = {}) {
  const leadSource = LEAD_SOURCES.includes(values.lead_source) ? values.lead_source : existing.lead_source || "";
  const servicePath = SERVICE_PATHS.includes(values.service_path) ? values.service_path : existing.service_path || "Undecided";

  return {
    lead_source: leadSource,
    priority_spaces: stringValue(values.priority_spaces, existing.priority_spaces),
    priority_space_story: stringValue(values.priority_space_story, existing.priority_space_story),
    consultation_notes: stringValue(values.consultation_notes, existing.consultation_notes),
    constraints: stringValue(values.constraints, existing.constraints),
    room_dependencies: stringValue(values.room_dependencies, existing.room_dependencies),
    storage_needs: stringValue(values.storage_needs, existing.storage_needs),
    keepsake_notes: stringValue(values.keepsake_notes, existing.keepsake_notes),
    visibility_goals: stringValue(values.visibility_goals, existing.visibility_goals),
    service_path: servicePath,
    quote_amount: optionalNumber(values.quote_amount, existing.quote_amount),
    discount_percent: optionalNumber(values.discount_percent, existing.discount_percent),
    target_date: stringValue(values.target_date, existing.target_date) || null,
    deposit_required: booleanValue(values.deposit_required, existing.deposit_required),
    decision_notes: stringValue(values.decision_notes, existing.decision_notes)
  };
}

function stringValue(value, fallback = "") {
  return value == null ? fallback || "" : String(value).trim();
}

function optionalNumber(value, fallback = null) {
  if (value === "" || value == null) return fallback ?? null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback ?? null;
}

function scoreValue(value, fallback = 5) {
  const numeric = Number(value ?? fallback);
  if (!Number.isFinite(numeric)) return Number(fallback) || 5;
  return Math.max(1, Math.min(10, numeric));
}

function booleanValue(value, fallback = false) {
  if (value === undefined) return Boolean(fallback);
  return value === true || value === "true" || value === "on" || value === "1";
}

async function recalculateRoomScore(roomId) {
  const room = store.find("rooms", roomId);
  if (!room) return null;
  const beforeEntry = latestEntry(store.all("emotionEntries"), roomId, "before");
  if (!beforeEntry) return null;
  const afterEntry = latestEntry(store.all("emotionEntries"), roomId, "after");
  const scoreValues = {
    room_id: roomId,
    ...calculateRoomTransformation(room, beforeEntry, afterEntry),
    calculated_at: new Date().toISOString()
  };

  const existing = store.findBy("roomScores", (score) => score.room_id === roomId);
  return existing ? store.update("roomScores", existing.id, scoreValues) : store.create("roomScores", scoreValues, "score");
}

async function sendRecommendation(roomId) {
  const room = store.find("rooms", roomId);
  if (!room) return null;
  const ai = latestAi(roomId);
  let review = store.findBy("emilyReviews", (candidate) => candidate.room_id === roomId);
  const clientProfile = store.find("clientProfiles", room.client_id);
  const user = clientProfile ? store.find("users", clientProfile.user_id) : null;
  const draft = clientProfile && user
    ? draftRecommendationEmail({ user, clientProfile, room, review, aiRecommendation: ai })
    : { subject: `${room.room_name} transformation plan`, body: review?.final_recommendation || ai?.client_message_draft || "" };

  if (!review && ai) {
    review = await store.create("emilyReviews", {
      room_id: roomId,
      ai_recommendation_id: ai.id,
      emily_notes: "",
      final_recommendation: ai.client_message_draft,
      email_subject: draft.subject,
      email_body: draft.body,
      approved: true,
      sent_to_client: false
    }, "review");
  }

  if (!review) return null;

  const updatedReview = await store.update("emilyReviews", review.id, {
    approved: true,
    sent_to_client: true,
    email_subject: review.email_subject || draft.subject,
    email_body: review.email_body || draft.body
  });
  const emailLog = await sendClientEmail(store, {
    clientId: room.client_id,
    roomId,
    subject: updatedReview.email_subject,
    body: updatedReview.email_body
  });
  await store.update("rooms", roomId, {
    status: "Recommendation Sent",
    current_progress: Math.max(Number(room.current_progress || 0), 40),
    next_best_action: "Start recommendation 1"
  });

  const task = store.findBy("tasks", (candidate) => candidate.room_id === roomId && candidate.status !== "closed");
  if (task) await store.update("tasks", task.id, { status: "closed" });

  await recalculateRoomScore(roomId);
  await syncClientAfterChange(room.client_id, "recommendation.sent", roomId);
  return { emilyReview: updatedReview, emailLog, room: buildRoomDetails(roomId) };
}

async function syncClientAfterChange(clientId, eventType, roomId = null) {
  return handleAppEvent(store, eventType, { clientId, roomId });
}

async function moveRoomToNurture(roomId) {
  const room = store.find("rooms", roomId);
  if (!room) return null;
  const openTask = store.findBy("tasks", (task) => task.room_id === roomId && task.status === "open");
  if (openTask) {
    await store.update("tasks", openTask.id, {
      status: "nurture",
      notes: `${openTask.notes || ""}\nMoved to nurture for follow-up.`
    });
  }

  const existingFollowUp = store.findBy(
    "followUps",
    (followUp) => followUp.room_id === roomId && followUp.follow_up_type === "nurture_check_in" && !followUp.sent
  );
  if (!existingFollowUp) {
    await store.create(
      "followUps",
      {
        room_id: roomId,
        follow_up_type: "nurture_check_in",
        scheduled_date: addDays(5),
        sent: false,
        response_received: false
      },
      "follow"
    );
  }

  return buildRoomDetails(roomId);
}

function normalizeAssistantItem(clientId, values) {
  const type = ASSISTANT_ITEM_TYPES.includes(values.type) ? values.type : "note";
  const dueDate = values.due_date || (type === "appointment" ? values.appointment_at : null) || null;
  const reminderAt = stringValue(values.reminder_at, values.reminder_at) || null;
  const reminderEmails = normalizeReminderEmails(values.reminder_emails);
  return {
    client_id: clientId,
    type,
    title: String(values.title || "Untitled item").trim(),
    notes: values.notes || "",
    status: values.status || (type === "appointment" ? "scheduled" : "open"),
    due_date: dueDate,
    reminder_at: reminderAt,
    reminder_emails: reminderEmails,
    reminder_sent_for: values.reminder_sent_for === reminderAt ? values.reminder_sent_for : null,
    last_reminder_email_sent_at:
      values.reminder_sent_for === reminderAt ? values.last_reminder_email_sent_at || null : null,
    appointment_at: null,
    recurrence: values.recurrence || "",
    calendar_sync_enabled: Boolean(values.calendar_sync_enabled)
  };
}

function normalizeWarranty(clientId, values) {
  const reminderAt = stringValue(values.reminder_at, values.reminder_at) || null;
  const reminderEmails = normalizeReminderEmails(values.reminder_emails);
  const timezone = normalizeTimezone(values.timezone);
  const scheduleKey = reminderAt ? warrantyReminderScheduleKey({ reminder_at: reminderAt }, timezone) : null;
  return {
    client_id: clientId,
    item_name: String(values.item_name || "Untitled warranty").trim(),
    category: values.category || "",
    provider: values.provider || "",
    policy_number: values.policy_number || "",
    purchase_date: values.purchase_date || null,
    active_from: values.active_from || null,
    expires_at: values.expires_at || null,
    reminder_at: reminderAt,
    reminder_emails: reminderEmails,
    reminder_timezone: timezone,
    reminder_sent_for: values.reminder_sent_for === scheduleKey ? values.reminder_sent_for : null,
    last_reminder_email_sent_at:
      values.reminder_sent_for === scheduleKey ? values.last_reminder_email_sent_at || null : null,
    notes: values.notes || "",
    document_name: values.document_name || "",
    document_data_url: values.document_data_url || "",
    status: values.status || deriveWarrantyStatus(values)
  };
}

function normalizeFreedomEntry(clientId, values) {
  const status = FREEDOM_TOOL_STATUSES.includes(values.status) ? values.status : "draft";
  const shouldDestroyNotes = status !== "draft" || booleanValue(values.destroy_second_circle, false);
  const releasedAt = status !== "draft" ? values.released_at || new Date().toISOString() : null;

  return {
    client_id: clientId,
    room_id: values.room_id || "",
    subject: String(values.subject || "Untitled subject").trim(),
    first_circle_event: String(values.first_circle_event || "").trim(),
    second_circle_items: shouldDestroyNotes ? "" : String(values.second_circle_items || "").trim(),
    second_circle_item_count: shouldDestroyNotes ? 0 : countLines(values.second_circle_items),
    intensity_before: scoreValue(values.intensity_before, 5),
    intensity_after: values.intensity_after ? scoreValue(values.intensity_after, values.intensity_before ?? 5) : null,
    status,
    what_shifted: String(values.what_shifted || "").trim(),
    support_path: FREEDOM_SUPPORT_PATHS.includes(values.support_path) ? values.support_path : "Self-guided Freedom Tool",
    next_action: String(values.next_action || "").trim(),
    released_at: releasedAt
  };
}

function countLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function deriveWarrantyStatus(values) {
  const now = Date.now();
  const activeFrom = values.active_from ? new Date(values.active_from).getTime() : null;
  const expires = values.expires_at ? new Date(values.expires_at).getTime() : null;
  if (expires && expires < now) return "expired";
  if (activeFrom && activeFrom > now) return "upcoming";
  return "active";
}

function normalizeTimezone(value, fallback = "America/Phoenix") {
  const timezone = String(value || fallback || "").trim();
  return timezone || "America/Phoenix";
}

function formatEmailDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatEmailDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function reminderDateLabel(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? formatEmailDate(match[1]) : String(value || "");
}

function sortByReminderDate(a, b) {
  return String(assistantDisplayDate(a)).localeCompare(String(assistantDisplayDate(b)));
}

function sortFreedomEntries(a, b) {
  const aDraft = a.status === "draft" ? 0 : 1;
  const bDraft = b.status === "draft" ? 0 : 1;
  if (aDraft !== bDraft) return aDraft - bDraft;
  return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
}

function assistantDisplayDate(item) {
  if (item.type === "appointment") return item.due_date || item.appointment_at || item.reminder_at || item.created_at;
  return item.due_date || item.reminder_at || item.created_at;
}

function warrantySearchText(warranty) {
  return [
    warranty.item_name,
    warranty.category,
    warranty.provider,
    warranty.policy_number,
    warranty.notes,
    warranty.document_name,
    warranty.status
  ]
    .join(" ")
    .toLowerCase();
}

function buildIcsForItem(item) {
  return buildIcsCalendar([item]);
}

function buildIcsCalendar(items) {
  const events = items
    .filter((item) => item.calendar_sync_enabled && (item.appointment_at || item.reminder_at || item.due_date))
    .map((item) => {
      const start = new Date(assistantDisplayDate(item));
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return [
        "BEGIN:VEVENT",
        `UID:${escapeIcs(item.id)}@room-energy-organizer`,
        `DTSTAMP:${icsDate(new Date())}`,
        `DTSTART:${icsDate(start)}`,
        `DTEND:${icsDate(end)}`,
        `SUMMARY:${escapeIcs(item.title)}`,
        `DESCRIPTION:${escapeIcs(item.notes || item.type)}`,
        "END:VEVENT"
      ].join("\r\n");
    });

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Room Energy Organizer//Client Assistant//EN", ...events, "END:VCALENDAR"].join("\r\n");
}

function icsDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function latestAi(roomId) {
  return store
    .filter("aiRecommendations", (recommendation) => recommendation.room_id === roomId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
}

function normalizeSubmittedEmotions(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 15_000_000) throw new Error("Request body too large.");
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

async function serveStatic(req, res, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const requestedPath = path.normalize(cleanPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, requestedPath);
  const relative = path.relative(publicDir, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": "no-store"
    });
    res.end(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      const file = await readFile(path.join(publicDir, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(file);
      return;
    }
    throw error;
  }
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
