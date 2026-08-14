import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { createOpaqueToken, hashOpaqueToken, hashPassword, verifyPassword } from "../domain/auth.mjs";
import { GHL_FIELD_MAP, getMembershipPermissions } from "../domain/constants.mjs";
import { generateRoomRecommendation } from "../domain/recommendations.mjs";
import {
  buildClientDashboard,
  calculateOverallScore,
  calculateRoomTransformation,
  calculatePriorityScore,
  calculateWorkbookPriorityScore,
  summarizeFreedomEntries
} from "../domain/scoring.mjs";
import { buildGhlCustomFields, extractGhlContactId, isGhlConfigured } from "../integrations/ghl.mjs";
import { draftRecommendationEmail } from "../integrations/email.mjs";
import {
  isAssistantReminderDue,
  isWarrantyReminderDue,
  normalizeReminderEmails,
  warrantyReminderScheduleKey
} from "../domain/reminders.mjs";
import {
  buildInitialData,
  buildSeedData,
  demoLoginEnabled,
  ensureBootstrapUsers,
  migrateSeedData,
  resolveSeedMode
} from "../data/seed.mjs";
import { loadDefaultEnvFiles, loadEnvFile } from "../config/env.mjs";

test("membership permissions gate core features by tier", () => {
  const free = getMembershipPermissions("Free / Intro");
  const gold = getMembershipPermissions("Gold");

  assert.equal(free.activeRoomLimit, 1);
  assert.equal(free.directEmilyAccess, false);
  assert.equal(gold.activeRoomLimit, 5);
  assert.equal(gold.directEmilyAccess, true);
  assert.equal(gold.bookingAccess, true);
});

test("password hashing verifies correct passwords only", () => {
  const stored = hashPassword("demo123");

  assert.equal(verifyPassword("demo123", stored), true);
  assert.equal(verifyPassword("wrong-password", stored), false);
});

test("portal tokens are opaque and hash consistently", () => {
  const token = createOpaqueToken();

  assert.equal(typeof token, "string");
  assert.equal(hashOpaqueToken(token), hashOpaqueToken(token));
  assert.notEqual(hashOpaqueToken(token), hashOpaqueToken(`${token}-different`));
});

test("room transformation score combines completion and score movement", () => {
  const room = { current_progress: 100 };
  const beforeEntry = {
    emotions: ["Overwhelmed"],
    stress_score: 8,
    clutter_score: 8,
    energy_alignment_score: 3
  };
  const afterEntry = {
    emotions: ["Calm"],
    stress_score: 3,
    clutter_score: 2,
    energy_alignment_score: 8
  };

  const score = calculateRoomTransformation(room, beforeEntry, afterEntry);

  assert.equal(score.stress_reduction, 63);
  assert.equal(score.clutter_reduction, 75);
  assert.equal(score.energy_shift, 5);
  assert.equal(score.before_overall_score, 23);
  assert.equal(score.after_overall_score, 77);
  assert.equal(score.overall_score, 77);
  assert.equal(score.transformation_score > 70, true);
  assert.match(score.emotional_shift, /Overwhelmed to Calm/);
});

test("overall score combines low stress, low clutter, and high energy", () => {
  const score = calculateOverallScore({
    stress_score: 2,
    clutter_score: 3,
    energy_alignment_score: 8
  });

  assert.equal(score, 77);
});

test("workbook priority score weighs BTBV consultation complexity", () => {
  const lowPriority = calculateWorkbookPriorityScore(
    { priority: "Low" },
    {
      stress_score: 3,
      clutter_score: 3,
      energy_alignment_score: 8,
      functional_friction_score: 3,
      storage_fit_score: 8,
      sentimental_load_score: 2,
      release_readiness_score: 4,
      second_circle_intensity_score: 2,
      decision_urgency_score: 2
    }
  );
  const highPriority = calculateWorkbookPriorityScore(
    { priority: "Urgent" },
    {
      stress_score: 8,
      clutter_score: 8,
      energy_alignment_score: 3,
      functional_friction_score: 9,
      storage_fit_score: 2,
      sentimental_load_score: 9,
      second_circle_intensity_score: 9,
      release_readiness_score: 8,
      decision_urgency_score: 9
    }
  );

  assert.equal(highPriority > lowPriority, true);
  assert.equal(highPriority >= 75, true);
});

test("priority score increases with membership priority and emotional urgency", () => {
  const beforeEntry = {
    stress_score: 9,
    clutter_score: 8,
    energy_alignment_score: 2
  };

  const freeScore = calculatePriorityScore({
    room: { priority: "Low", upsell_flag: false },
    beforeEntry,
    clientProfile: { membership_level: "Free / Intro" },
    openRoomCount: 1
  });
  const vipScore = calculatePriorityScore({
    room: { priority: "Urgent", upsell_flag: true },
    beforeEntry,
    clientProfile: { membership_level: "VIP" },
    openRoomCount: 4
  });

  assert.equal(vipScore > freeScore, true);
});

test("Freedom Tool summary stays aligned across dashboard and sync surfaces", () => {
  const freedomEntries = [
    {
      subject: "Bedroom pile",
      status: "draft",
      intensity_before: 8,
      intensity_after: null,
      what_shifted: "",
      created_at: "2026-07-05T10:00:00.000Z",
      updated_at: "2026-07-05T10:00:00.000Z"
    },
    {
      subject: "Kitchen overflow",
      status: "released",
      intensity_before: 9,
      intensity_after: 4,
      what_shifted: "Counter stayed clear after dinner.",
      created_at: "2026-07-06T10:00:00.000Z",
      updated_at: "2026-07-06T12:00:00.000Z"
    }
  ];

  const summary = summarizeFreedomEntries(freedomEntries);
  const dashboard = buildClientDashboard({
    clientProfile: { membership_level: "Gold" },
    user: { name: "Ava Martinez" },
    rooms: [],
    photos: [],
    emotionEntries: [],
    roomScores: [],
    aiRecommendations: [],
    emilyReviews: [],
    freedomEntries
  });

  assert.equal(summary.total_entries, 2);
  assert.equal(summary.released_count, 1);
  assert.equal(summary.evidence_count, 1);
  assert.equal(summary.average_shift_score, 5);
  assert.equal(summary.last_subject, "Kitchen overflow");
  assert.deepEqual(dashboard.freedomTool, summary);
});

test("AI recommendation output contains Emily-reviewable recommendation fields", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const recommendation = await generateRoomRecommendation({
      room: {
        room_name: "Kitchen",
        room_type: "Kitchen",
        desired_energy_outcome: "Flow",
        priority: "High",
        priority_spaces: "Kitchen",
        storage_needs: "Food storage needs a permanent home.",
        service_path: "Full Service"
      },
      beforeEntry: {
        emotions: ["Anxious", "Rushed"],
        stress_score: 8,
        clutter_score: 8,
        energy_alignment_score: 3,
        storage_fit_score: 2,
        sentimental_load_score: 4,
        second_circle_intensity_score: 8,
        release_readiness_score: 8
      },
      beforePhotos: [{ id: "photo_1", photo_url: "https://example.com/before-kitchen.jpg" }],
      permissions: getMembershipPermissions("Gold")
    });

    assert.equal(Array.isArray(recommendation.organizing_recommendations), true);
    assert.equal(Array.isArray(recommendation.recommended_layout_changes), true);
    assert.equal(recommendation.organizing_recommendations.length >= 3, true);
    assert.match(recommendation.before_photo_narrative, /before photo/);
    assert.match(recommendation.observations.join(" "), /Priority space context/);
    assert.match(recommendation.organizing_recommendations.join(" "), /Freedom Tool/);
    assert.match(recommendation.upsell_opportunity, /Intensive/);
    assert.match(recommendation.client_message_draft, /Kitchen/);
    assert.equal(typeof recommendation.support_track, "string");
    assert.equal(typeof recommendation.ai_review_method, "string");
    assert.equal(typeof recommendation.photo_review_report, "object");
    assert.equal(recommendation.photo_review_report.review_mode_label, recommendation.ai_review_method);
    assert.equal(recommendation.photo_review_report.photo_count, 1);
    assert.equal(Array.isArray(recommendation.photo_review_report.photo_reviews), true);
    assert.equal(recommendation.photo_review_report.photo_reviews[0].photo_index, 1);
    assert.ok(recommendation.upsell_opportunity);
    assert.ok(recommendation.follow_up_recommendation);
  } finally {
    if (originalKey == null) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("GHL field mapping exposes app dashboard metrics with matching keys", () => {
  const fields = buildGhlCustomFields({
    clientProfile: {
      membership_level: "Gold",
      membership_status: "active",
      ghl_pipeline_stage: "Recommendation Sent"
    },
    metadata: {
      summary: {
        home_transformation_score: 64,
        average_overall_score: 72,
        average_energy_alignment_improvement: 51,
        average_stress_reduction: 44,
        average_clutter_reduction: 36,
        average_workbook_priority_score: 68,
        rooms_completed: 2,
        rooms_in_progress: 1,
        rooms_open: 3,
        rooms_needing_attention: 1,
        total_recommendations_completed: 7,
        next_best_action: "Upload after photos"
      },
      latestRoom: {
        room_name: "Office",
        status: "In Progress",
        current_progress: 70,
        overall_score: 73,
        workbook_priority_score: 82,
        service_path: "Hybrid",
        support_track: "Flow Reset Intensive",
        ai_review_method: "OpenAI vision review",
        priority_spaces: "Office",
        storage_needs: "Project shelves",
        keepsake_notes: "Archive family records",
        upsell_flag: true
      },
      assistant: { open_task_count: 2, next_reminder_at: "2026-07-07T10:00:00.000Z" },
      warranties: { active_count: 4, expiring_count: 1 },
      freedomTool: { total_entries: 3, evidence_count: 2, average_shift_score: 3.5, last_subject: "Bedroom pile" }
    }
  });

  const fieldLookup = Object.fromEntries(fields.map((field) => [field.key, field.value]));
  const fieldValueLookup = Object.fromEntries(fields.map((field) => [field.key, field.fieldValue]));

  assert.equal(Array.isArray(fields), true);
  assert.equal(fieldLookup.membership_level, undefined);
  assert.equal(fieldValueLookup.membership_level, "Gold");
  assert.equal(fieldValueLookup.home_transformation_score, "64");
  assert.equal(fieldValueLookup.overall_room_score, "72");
  assert.equal(fieldValueLookup.average_workbook_priority_score, "68");
  assert.equal(fieldValueLookup.latest_room_name, "Office");
  assert.equal(fieldValueLookup.latest_room_workbook_priority_score, "82");
  assert.equal(fieldValueLookup.latest_room_service_path, "Hybrid");
  assert.equal(fieldValueLookup.latest_room_support_track, "Flow Reset Intensive");
  assert.equal(fieldValueLookup.latest_room_ai_review_method, "OpenAI vision review");
  assert.equal(fieldValueLookup.assistant_open_tasks, "2");
  assert.equal(fieldValueLookup.active_warranty_count, "4");
  assert.equal(fieldValueLookup.freedom_tool_entries, "3");
  assert.equal(fieldValueLookup.freedom_tool_average_shift_score, "3.5");
});

test("GHL field map includes field labels and data types for provisioning", () => {
  assert.equal(Array.isArray(GHL_FIELD_MAP), true);
  assert.ok(GHL_FIELD_MAP.length > 20);

  for (const field of GHL_FIELD_MAP) {
    assert.equal(typeof field.label, "string");
    assert.equal(typeof field.ghlKey, "string");
    assert.equal(typeof field.dataType, "string");
    assert.ok(field.dataType.length > 0);
  }
});

test("reminder email helpers normalize recipients and honor due windows", () => {
  assert.deepEqual(normalizeReminderEmails("Ava@example.com, partner@example.com\nava@example.com"), [
    "ava@example.com",
    "partner@example.com"
  ]);

  assert.equal(
    isAssistantReminderDue(
      {
        reminder_at: "2026-07-06T15:00:00.000Z",
        reminder_sent_for: null
      },
      new Date("2026-07-06T15:00:00.000Z")
    ),
    true
  );

  assert.equal(
    isAssistantReminderDue(
      {
        reminder_at: "2026-07-06T15:00:00.000Z",
        reminder_sent_for: "2026-07-06T15:00:00.000Z"
      },
      new Date("2026-07-06T16:00:00.000Z")
    ),
    false
  );
});

test("warranty reminders wait until 9 AM in the client timezone", () => {
  const warranty = { reminder_at: "2026-07-06", reminder_sent_for: null };
  const timezone = "America/Phoenix";

  assert.equal(warrantyReminderScheduleKey(warranty, timezone), "2026-07-06T09:00[America/Phoenix]");
  assert.equal(isWarrantyReminderDue(warranty, timezone, new Date("2026-07-06T15:59:00.000Z")), false);
  assert.equal(isWarrantyReminderDue(warranty, timezone, new Date("2026-07-06T16:00:00.000Z")), true);
});

test("seed migration backfills staff admin, timezones, internal notes, and reminder recipients", () => {
  const legacy = buildSeedData();
  legacy.meta.version = 7;
  legacy.clientProfiles[0].timezone = "";
  delete legacy.clientProfiles[0].internal_notes;
  delete legacy.assistantItems[0].reminder_emails;
  delete legacy.assistantItems[0].reminder_sent_for;
  delete legacy.warranties[0].reminder_emails;
  delete legacy.warranties[0].reminder_timezone;
  delete legacy.warranties[0].reminder_sent_for;

  const { data, changed } = migrateSeedData(legacy);

  assert.equal(changed, true);
  assert.equal(data.meta.version, 11);
  assert.ok(data.users.find((user) => user.email === "staff@example.com" && user.role === "admin"));
  assert.equal(data.clientProfiles[0].timezone, "America/Phoenix");
  assert.match(data.clientProfiles[0].internal_notes, /gentle follow-up/i);
  assert.match(data.roomPhotos[0].photo_url, /^data:image\/png;base64,/);
  assert.deepEqual(data.assistantItems[0].reminder_emails, ["ava@example.com"]);
  assert.equal(data.assistantItems[0].reminder_sent_for, null);
  assert.deepEqual(data.warranties[0].reminder_emails, ["ava@example.com"]);
  assert.equal(data.warranties[0].reminder_timezone, "America/Phoenix");
  assert.equal(data.warranties[0].reminder_sent_for, null);
});

test("production seed mode defaults to blank data with no demo logins", () => {
  assert.equal(resolveSeedMode({ nodeEnv: "production", seedMode: "" }), "blank");
  assert.equal(demoLoginEnabled({ enabled: "", seedMode: "blank" }), false);

  const data = buildInitialData({ nodeEnv: "production", seedMode: "" });
  assert.equal(data.meta.seed_mode, "blank");
  assert.deepEqual(data.users, []);
  assert.deepEqual(data.rooms, []);
});

test("bootstrap users can be created from environment without demo seed data", () => {
  const data = buildInitialData({ nodeEnv: "production", seedMode: "blank" });
  const changed = ensureBootstrapUsers(data, {
    INITIAL_ADMIN_EMAIL: "staff@builttobevisible.com",
    INITIAL_ADMIN_PASSWORD: "staffpass1",
    INITIAL_ADMIN_NAME: "Emily Staff",
    INITIAL_EMILY_EMAIL: "emily@builttobevisible.com",
    INITIAL_EMILY_PASSWORD: "emilypass1",
    INITIAL_EMILY_NAME: "Emily Ransom"
  });

  assert.equal(changed, true);
  assert.ok(data.users.find((user) => user.email === "staff@builttobevisible.com" && user.role === "admin"));
  assert.ok(data.users.find((user) => user.email === "emily@builttobevisible.com" && user.role === "emily"));
  assert.equal(data.users.some((user) => user.email === "ava@example.com"), false);
});

test("GHL helpers extract contact ids and config status safely", () => {
  assert.equal(extractGhlContactId({ contact: { id: "contact_123" } }), "contact_123");
  assert.equal(extractGhlContactId({ data: { contact: { id: "contact_456" } } }), "contact_456");
  assert.equal(extractGhlContactId({ id: "contact_789" }), "contact_789");
  assert.equal(extractGhlContactId({}), null);

  const previousKey = process.env.GHL_API_KEY;
  const previousLocation = process.env.GHL_LOCATION_ID;
  process.env.GHL_API_KEY = "";
  process.env.GHL_LOCATION_ID = "";
  assert.equal(isGhlConfigured(), false);
  process.env.GHL_API_KEY = "key";
  process.env.GHL_LOCATION_ID = "location";
  assert.equal(isGhlConfigured(), true);
  process.env.GHL_API_KEY = previousKey;
  process.env.GHL_LOCATION_ID = previousLocation;
});

test("env loader reads local .env values without overwriting exported values", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "reo-env-"));
  const envPath = path.join(tempDir, ".env");
  writeFileSync(envPath, "GHL_API_KEY=file-key\nGHL_LOCATION_ID=file-location\nREMINDER_INTERVAL_MS=90000\n");

  const previousKey = process.env.GHL_API_KEY;
  const previousLocation = process.env.GHL_LOCATION_ID;
  const previousReminder = process.env.REMINDER_INTERVAL_MS;

  delete process.env.GHL_API_KEY;
  delete process.env.GHL_LOCATION_ID;
  delete process.env.REMINDER_INTERVAL_MS;

  assert.equal(loadEnvFile(envPath), true);
  assert.equal(process.env.GHL_API_KEY, "file-key");
  assert.equal(process.env.GHL_LOCATION_ID, "file-location");
  assert.equal(process.env.REMINDER_INTERVAL_MS, "90000");

  process.env.GHL_API_KEY = "shell-key";
  assert.equal(loadEnvFile(envPath), true);
  assert.equal(process.env.GHL_API_KEY, "shell-key");

  if (previousKey == null) delete process.env.GHL_API_KEY;
  else process.env.GHL_API_KEY = previousKey;
  if (previousLocation == null) delete process.env.GHL_LOCATION_ID;
  else process.env.GHL_LOCATION_ID = previousLocation;
  if (previousReminder == null) delete process.env.REMINDER_INTERVAL_MS;
  else process.env.REMINDER_INTERVAL_MS = previousReminder;

  rmSync(tempDir, { recursive: true, force: true });
});

test("default env loader falls back to .env.btbvapp", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "reo-env-default-"));
  const altEnvPath = path.join(tempDir, ".env.btbvapp");
  writeFileSync(altEnvPath, "GHL_API_KEY=btbv-key\nGHL_LOCATION_ID=btbv-location\n");

  const previousKey = process.env.GHL_API_KEY;
  const previousLocation = process.env.GHL_LOCATION_ID;

  delete process.env.GHL_API_KEY;
  delete process.env.GHL_LOCATION_ID;

  assert.equal(
    loadDefaultEnvFiles([path.join(tempDir, ".env"), altEnvPath]),
    true
  );
  assert.equal(process.env.GHL_API_KEY, "btbv-key");
  assert.equal(process.env.GHL_LOCATION_ID, "btbv-location");

  if (previousKey == null) delete process.env.GHL_API_KEY;
  else process.env.GHL_API_KEY = previousKey;
  if (previousLocation == null) delete process.env.GHL_LOCATION_ID;
  else process.env.GHL_LOCATION_ID = previousLocation;

  rmSync(tempDir, { recursive: true, force: true });
});

test("recommendation email draft includes final recommendation and layout context", () => {
  const email = draftRecommendationEmail({
    user: { name: "Ava Martinez", email: "ava@example.com" },
    clientProfile: { membership_level: "Gold" },
    room: { room_name: "Kitchen", next_best_action: "Start recommendation 1" },
    review: { final_recommendation: "Clear the prep counter first." },
    aiRecommendation: {
      before_photo_narrative: "The counter is carrying the main visual weight.",
      recommended_layout_changes: ["Keep the path to the sink open."]
    }
  });

  assert.match(email.subject, /Kitchen/);
  assert.match(email.body, /Clear the prep counter first/);
  assert.match(email.body, /Keep the path to the sink open/);
});

test("recommendation email draft strips consultation referral commentary", () => {
  const email = draftRecommendationEmail({
    user: { name: "Ava Martinez", email: "ava@example.com" },
    clientProfile: { membership_level: "Gold" },
    room: { room_name: "Kitchen", next_best_action: "Start recommendation 1" },
    review: null,
    aiRecommendation: {
      client_message_draft:
        "When you described Kitchen as feeling overwhelmed, the clearest next move was to create one visible win. Your consultation notes add this important context: Consultation source: Friend / word of mouth. Start with the counter reset.",
      before_photo_narrative: "Clear the prep counter first.",
      recommended_layout_changes: ["Keep the path to the sink open."]
    }
  });

  assert.doesNotMatch(email.body, /Consultation source:/);
  assert.doesNotMatch(email.body, /Friend \/ word of mouth/);
});
