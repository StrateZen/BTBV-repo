import { hashPassword } from "../domain/auth.mjs";
import { calculateRoomTransformation } from "../domain/scoring.mjs";
import { deflateSync } from "node:zlib";

const now = new Date().toISOString();
export const SEED_VERSION = 11;
const DATA_COLLECTIONS = [
  "users",
  "clientProfiles",
  "rooms",
  "roomPhotos",
  "emotionEntries",
  "aiRecommendations",
  "emilyReviews",
  "tasks",
  "followUps",
  "roomScores",
  "ghlSyncLogs",
  "emailLogs",
  "assistantItems",
  "warranties",
  "freedomEntries",
  "communityPosts",
  "communityComments",
  "sessions",
  "portalTokens"
];

export function buildSeedData() {
  const users = [
    {
      id: "user_client_ava",
      name: "Ava Martinez",
      email: "ava@example.com",
      role: "client",
      password_hash: hashPassword("demo123"),
      created_at: now,
      updated_at: now
    },
    {
      id: "user_emily",
      name: "Emily",
      email: "emily@example.com",
      role: "emily",
      password_hash: hashPassword("demo123"),
      created_at: now,
      updated_at: now
    },
    {
      id: "user_staff",
      name: "Emily Staff",
      email: "staff@example.com",
      role: "admin",
      password_hash: hashPassword("demo123"),
      created_at: now,
      updated_at: now
    }
  ];

  const clientProfiles = [
    {
      id: "client_ava",
      user_id: "user_client_ava",
      phone: "555-0142",
      address: "Phoenix, AZ",
      notes: "Wants more calm in shared living spaces.",
      internal_notes: "Prefers gentle follow-up language and benefits from clear, single-step next actions.",
      ghl_contact_id: "dryrun_ava",
      membership_level: "Gold",
      membership_status: "active",
      ghl_pipeline_stage: "Recommendation Sent",
      timezone: "America/Phoenix",
      last_synced_at: now,
      sync_status: "dry-run",
      created_at: now,
      updated_at: now
    }
  ];

  const rooms = [
    {
      id: "room_bedroom",
      client_id: "client_ava",
      room_name: "Bedroom",
      room_type: "Bedroom",
      desired_energy_outcome: "Rest",
      lead_source: "Referral",
      priority_spaces: "Primary bedroom",
      priority_space_story: "Laundry overflow and keepsakes are making the bedroom feel less restful.",
      consultation_notes: "Bedroom cannot be organized effectively until office overflow and laundry flow are addressed.",
      constraints: "Needs decisions on nightstands, primary closet, and overflow storage before final styling.",
      room_dependencies: "Office is acting as overflow for bedroom categories.",
      storage_needs: "Permanent homes for laundry, nightstand items, family keepsakes, and closet categories.",
      keepsake_notes: "Family keepsakes in the bedroom carry emotional weight and need a slower review zone.",
      visibility_goals: "Display meaningful artwork in the hallway and primary bedroom.",
      service_path: "Hybrid",
      quote_amount: 1550,
      discount_percent: 10,
      target_date: null,
      deposit_required: false,
      decision_notes: "Hybrid path includes design, virtual support, keepsakes, and emotional release work.",
      status: "In Progress",
      priority: "High",
      current_progress: 70,
      next_best_action: "Upload after photos",
      upsell_flag: false,
      ghl_opportunity_id: null,
      created_at: now,
      updated_at: now
    },
    {
      id: "room_office",
      client_id: "client_ava",
      room_name: "Office",
      room_type: "Office",
      desired_energy_outcome: "Focus",
      lead_source: "Referral",
      priority_spaces: "Home office",
      priority_space_story: "The office is needed as a stable overflow and planning space before bedroom work can close.",
      consultation_notes: "Office supports bedroom organization because it can absorb and sort temporary overflow.",
      constraints: "Needs a clear desk and reachable active-project storage.",
      room_dependencies: "Bedroom progress depends on the office having sorted temporary holding zones.",
      storage_needs: "Active project shelves, paperwork zone, and temporary sort bins.",
      keepsake_notes: "",
      visibility_goals: "Keep active work visible without letting it spread across the desk.",
      service_path: "DIY",
      quote_amount: 695,
      discount_percent: 10,
      target_date: null,
      deposit_required: false,
      decision_notes: "DIY design and virtual support path.",
      status: "Waiting for After Photos",
      priority: "Medium",
      current_progress: 85,
      next_best_action: "Complete final review",
      upsell_flag: true,
      ghl_opportunity_id: "opp_office",
      created_at: now,
      updated_at: now
    },
    {
      id: "room_kitchen",
      client_id: "client_ava",
      room_name: "Kitchen",
      room_type: "Kitchen",
      desired_energy_outcome: "Flow",
      lead_source: "Social media",
      priority_spaces: "Kitchen",
      priority_space_story: "Counters collect everything and food storage needs a more suitable permanent home.",
      consultation_notes: "Client needs daily landing zone and food storage plan before deeper styling.",
      constraints: "Daily reset must work for busy evenings.",
      room_dependencies: "Food storage and pantry overflow affect counter clutter.",
      storage_needs: "Permanent home for food storage and daily landing items.",
      keepsake_notes: "",
      visibility_goals: "Make the reset zone visible from the entry.",
      service_path: "Full Service",
      quote_amount: 3400,
      discount_percent: 10,
      target_date: null,
      deposit_required: true,
      decision_notes: "Full-service option quoted with three organizers across three days.",
      status: "Emily Review Needed",
      priority: "High",
      current_progress: 25,
      next_best_action: "Emily review in progress",
      upsell_flag: false,
      ghl_opportunity_id: null,
      created_at: now,
      updated_at: now
    },
    {
      id: "room_garage",
      client_id: "client_ava",
      room_name: "Garage",
      room_type: "Garage",
      desired_energy_outcome: "Clarity",
      lead_source: "Internet search",
      priority_spaces: "Garage",
      priority_space_story: "Garage is a future priority after the active indoor spaces are stabilized.",
      consultation_notes: "",
      constraints: "",
      room_dependencies: "",
      storage_needs: "Seasonal and bulk storage categories need review.",
      keepsake_notes: "",
      visibility_goals: "",
      service_path: "Undecided",
      quote_amount: null,
      discount_percent: null,
      target_date: null,
      deposit_required: false,
      decision_notes: "",
      status: "Not Started",
      priority: "Low",
      current_progress: 0,
      next_best_action: "Submit intake",
      upsell_flag: false,
      ghl_opportunity_id: null,
      created_at: now,
      updated_at: now
    }
  ];

  const roomPhotos = [
    photo("photo_bedroom_before", "room_bedroom", "before", "Bedroom before", "#d8cbc2", "#7f5d50", "bedroom"),
    photo("photo_bedroom_before_2", "room_bedroom", "before", "Bedroom closet", "#d3c7bd", "#81677c", "closet"),
    photo("photo_office_before", "room_office", "before", "Office before", "#c8d7d2", "#405f60", "office"),
    photo("photo_office_before_2", "room_office", "before", "Office shelves", "#d8e0dc", "#416f87", "shelves"),
    photo("photo_office_after", "room_office", "after", "Office after", "#e6efe9", "#3a6b58", "after"),
    photo("photo_kitchen_before", "room_kitchen", "before", "Kitchen before", "#efe4cb", "#9f6b35", "kitchen"),
    photo("photo_kitchen_before_2", "room_kitchen", "before", "Kitchen counter", "#eadcc1", "#b86f54", "counter"),
    photo("photo_garage_before", "room_garage", "before", "Garage before", "#d9d9d5", "#6c7372", "garage")
  ];

  const emotionEntries = [
    before("emotion_bedroom_before", "room_bedroom", ["Overwhelmed", "Tired"], "Laundry and piles make it hard to rest.", 8, 7, 3, {
      functional_friction_score: 8,
      storage_fit_score: 3,
      sentimental_load_score: 8,
      readiness_score: 7,
      second_circle_intensity_score: 8,
      release_readiness_score: 6,
      decision_urgency_score: 6
    }),
    before("emotion_office_before", "room_office", ["Distracted", "Stuck"], "I avoid working in here.", 7, 8, 2, {
      functional_friction_score: 8,
      storage_fit_score: 4,
      sentimental_load_score: 3,
      readiness_score: 8,
      second_circle_intensity_score: 6,
      release_readiness_score: 7,
      decision_urgency_score: 7
    }),
    after("emotion_office_after", "room_office", ["Focused", "Clear"], "The desk finally feels usable.", 3, 3, 8),
    before("emotion_kitchen_before", "room_kitchen", ["Anxious", "Rushed"], "Counters collect everything.", 8, 8, 4, {
      functional_friction_score: 8,
      storage_fit_score: 3,
      sentimental_load_score: 2,
      readiness_score: 7,
      second_circle_intensity_score: 7,
      release_readiness_score: 6,
      decision_urgency_score: 8
    })
  ];

  const aiRecommendations = [
    {
      id: "ai_kitchen",
      room_id: "room_kitchen",
      observations: ["Counters appear to be the highest-friction zone.", "The kitchen has strong potential for daily flow improvement."],
      emotional_themes: ["Anxious", "Rushed"],
      energy_blockers: ["Visual density around prep areas", "No clear landing zone"],
      before_photo_narrative:
        "The submitted before photos suggest the kitchen needs a high reset focused on clearing prep surfaces, separating the landing zone from cooking zones, and making daily tools easier to reach. The goal is to create flow before adding any decorative or energy-reset elements.",
      organizing_recommendations: ["Clear one prep counter", "Create a daily landing tray", "Sort duplicate tools"],
      recommendation_reasons: ["A clear prep zone lowers daily friction.", "A tray keeps loose items from spreading.", "Duplicates add decision pressure."],
      recommended_layout_changes: [
        "Keep the path from the entry to the sink and stove open.",
        "Create one clean prep zone and move non-cooking items away from that counter.",
        "Group cooking tools, food storage, and daily reset items into separate zones."
      ],
      energy_recommendations: ["Reset the counter each evening", "Use Flow as the intention word"],
      suggested_next_steps: ["Clear one prep counter", "Add landing tray", "Upload progress photo"],
      priority_order: ["Counter reset", "Landing zone", "Tool sort"],
      upsell_opportunity: "Virtual organizing session",
      client_message_draft: "Start with one counter and let that be the visible reset for the kitchen.",
      follow_up_recommendation: "Check in after 5 days.",
      created_at: now
    }
  ];

  const emilyReviews = [
    {
      id: "review_office",
      room_id: "room_office",
      ai_recommendation_id: null,
      emily_notes: "The office looks much calmer. Keep only active projects on the desk this week.",
      final_recommendation: "Maintain the clear desk zone and upload final photos after one full workday.",
      email_subject: "Office transformation next step from Emily",
      email_body:
        "Hi Ava,\n\nYour office already looks calmer. Keep only active projects on the desk this week, then upload final photos after one full workday so we can close the loop on the transformation.\n\nWith care,\nEmily",
      approved: true,
      sent_to_client: true,
      created_at: now,
      updated_at: now
    }
  ];

  const tasks = [
    {
      id: "task_kitchen_review",
      assigned_to: "user_emily",
      client_id: "client_ava",
      room_id: "room_kitchen",
      task_type: "emily_review",
      status: "open",
      due_date: addDays(1),
      notes: "Kitchen needs recommendation review.",
      priority_score: 88,
      membership_priority: 4,
      created_at: now,
      updated_at: now
    }
  ];

  const followUps = [
    {
      id: "follow_bedroom_after",
      room_id: "room_bedroom",
      follow_up_type: "after_photos_needed",
      scheduled_date: addDays(2),
      sent: false,
      response_received: false,
      created_at: now,
      updated_at: now
    }
  ];

  const roomScores = rooms
    .map((room) => {
      const beforeEntry = emotionEntries.find((entry) => entry.room_id === room.id && entry.entry_type === "before");
      const afterEntry = emotionEntries.find((entry) => entry.room_id === room.id && entry.entry_type === "after");
      const score = calculateRoomTransformation(room, beforeEntry, afterEntry);
      return {
        id: `score_${room.id}`,
        room_id: room.id,
        ...score,
        calculated_at: now
      };
    })
    .filter((score) => score.before_score !== null);

  const assistantItems = [
    {
      id: "assistant_task_after_photos",
      client_id: "client_ava",
      type: "task",
      title: "Upload bedroom after photos",
      notes: "Take one doorway view and one closet view.",
      status: "open",
      due_date: addDays(2),
      reminder_at: addDays(1),
      reminder_emails: ["ava@example.com"],
      reminder_sent_for: null,
      last_reminder_email_sent_at: null,
      appointment_at: null,
      recurrence: "",
      calendar_sync_enabled: true,
      created_at: now,
      updated_at: now
    },
    {
      id: "assistant_routine_counter_reset",
      client_id: "client_ava",
      type: "routine",
      title: "Evening kitchen counter reset",
      notes: "Clear the prep counter, reset the landing tray, and name the next morning's first action.",
      status: "open",
      due_date: null,
      reminder_at: addDays(1),
      reminder_emails: ["ava@example.com"],
      reminder_sent_for: null,
      last_reminder_email_sent_at: null,
      appointment_at: null,
      recurrence: "daily",
      calendar_sync_enabled: true,
      created_at: now,
      updated_at: now
    },
    {
      id: "assistant_appointment_emily",
      client_id: "client_ava",
      type: "appointment",
      title: "Virtual review with Emily",
      notes: "Review kitchen flow and next-room priority.",
      status: "scheduled",
      due_date: addDays(4),
      reminder_at: addDays(3),
      reminder_emails: ["ava@example.com"],
      reminder_sent_for: null,
      last_reminder_email_sent_at: null,
      appointment_at: null,
      recurrence: "",
      calendar_sync_enabled: true,
      created_at: now,
      updated_at: now
    }
  ];

  const warranties = [
    {
      id: "warranty_dishwasher",
      client_id: "client_ava",
      item_name: "Dishwasher",
      category: "Kitchen appliance",
      provider: "HomeCare Warranty",
      policy_number: "DW-2044",
      purchase_date: addDays(-220),
      active_from: addDays(-220),
      expires_at: addDays(145),
      reminder_at: addDays(115),
      reminder_emails: ["ava@example.com"],
      reminder_timezone: "America/Phoenix",
      reminder_sent_for: null,
      last_reminder_email_sent_at: null,
      notes: "Check renewal options before expiration.",
      document_name: "dishwasher-warranty.pdf",
      document_data_url: "",
      status: "active",
      created_at: now,
      updated_at: now
    },
    {
      id: "warranty_storage_bins",
      client_id: "client_ava",
      item_name: "Garage storage system",
      category: "Home organization product",
      provider: "StorageCo",
      policy_number: "GAR-9912",
      purchase_date: addDays(-90),
      active_from: addDays(-90),
      expires_at: addDays(275),
      reminder_at: addDays(245),
      reminder_emails: ["ava@example.com"],
      reminder_timezone: "America/Phoenix",
      reminder_sent_for: null,
      last_reminder_email_sent_at: null,
      notes: "Keep receipt and installation guide attached.",
      document_name: "",
      document_data_url: "",
      status: "active",
      created_at: now,
      updated_at: now
    }
  ];

  const freedomEntries = [
    {
      id: "freedom_bedroom_draft",
      client_id: "client_ava",
      room_id: "room_bedroom",
      subject: "Bedroom laundry pile",
      first_circle_event: "Laundry keeps landing in the bedroom instead of the laundry room.",
      second_circle_items: "I am failing at keeping this room restful.\nThis will never stay organized.\nI am tired of seeing this every day.",
      second_circle_item_count: 3,
      intensity_before: 8,
      intensity_after: null,
      status: "draft",
      what_shifted: "",
      support_path: "Self-guided Freedom Tool",
      next_action: "Voice the release work, then destroy the sheet.",
      released_at: null,
      created_at: now,
      updated_at: now
    },
    {
      id: "freedom_kitchen_evidence",
      client_id: "client_ava",
      room_id: "room_kitchen",
      subject: "Kitchen counter clutter story",
      first_circle_event: "Mail, keys, and food storage keep spreading across the counter.",
      second_circle_items: "",
      second_circle_item_count: 0,
      intensity_before: 7,
      intensity_after: 3,
      status: "evidence logged",
      what_shifted: "The landing tray felt obvious, the counter looked calmer, and the next kitchen decision felt easier.",
      support_path: "Intensive",
      next_action: "Upload a progress photo after three days of resets.",
      released_at: now,
      created_at: now,
      updated_at: now
    }
  ];

  const communityPosts = [
    {
      id: "community_post_kitchen_flow",
      client_id: "client_ava",
      title: "Kitchen landing zone idea",
      body: "I tried keeping one tray for mail and keys instead of letting everything spread across the counter. It made the evening reset feel easier.",
      photo_url: makeSeedPhoto("#efe4cb", "#6e8f7c", "after"),
      ratings: [{ client_id: "client_ava", rating: 5 }],
      created_at: now,
      updated_at: now
    }
  ];

  const communityComments = [
    {
      id: "community_comment_kitchen_flow",
      post_id: "community_post_kitchen_flow",
      client_id: "client_ava",
      body: "This is the kind of simple change that made my kitchen feel calmer.",
      created_at: now,
      updated_at: now
    }
  ];

  return {
    meta: { version: SEED_VERSION, seeded_at: now, seed_mode: "demo" },
    users,
    clientProfiles,
    rooms,
    roomPhotos,
    emotionEntries,
    aiRecommendations,
    emilyReviews,
    tasks,
    followUps,
    roomScores,
    ghlSyncLogs: [],
    emailLogs: [],
    assistantItems,
    warranties,
    freedomEntries,
    communityPosts,
    communityComments
  };
}

export function buildBlankData() {
  return {
    meta: { version: SEED_VERSION, seeded_at: now, seed_mode: "blank" },
    ...Object.fromEntries(DATA_COLLECTIONS.map((collection) => [collection, []]))
  };
}

export function resolveSeedMode({ seedMode = process.env.APP_SEED_MODE, nodeEnv = process.env.NODE_ENV } = {}) {
  const normalized = String(seedMode || "").trim().toLowerCase();
  if (["demo", "sample", "seeded"].includes(normalized)) return "demo";
  if (["blank", "empty", "clean", "production"].includes(normalized)) return "blank";
  return nodeEnv === "production" ? "blank" : "demo";
}

export function buildInitialData(options = {}) {
  return resolveSeedMode(options) === "demo" ? buildSeedData() : buildBlankData();
}

export function demoLoginEnabled({ enabled = process.env.ENABLE_DEMO_LOGIN, seedMode = resolveSeedMode() } = {}) {
  if (enabled == null || String(enabled).trim() === "") return seedMode === "demo";
  return parseBooleanEnv(enabled);
}

export function migrateSeedData(data) {
  if (!data || Number(data.meta?.version || 0) >= SEED_VERSION) return { data, changed: false };

  const seed = buildSeedData();
  data.meta = {
    ...(data.meta || {}),
    version: SEED_VERSION,
    seed_mode: data.meta?.seed_mode || inferSeedModeFromData(data),
    migrated_at: now
  };

  for (const collection of DATA_COLLECTIONS) {
    data[collection] ||= [];
  }

  const kitchenAi = data.aiRecommendations?.find((recommendation) => recommendation.id === "ai_kitchen");
  const seedKitchenAi = seed.aiRecommendations.find((recommendation) => recommendation.id === "ai_kitchen");
  if (kitchenAi && seedKitchenAi) {
    kitchenAi.before_photo_narrative ||= seedKitchenAi.before_photo_narrative;
    kitchenAi.recommended_layout_changes ||= seedKitchenAi.recommended_layout_changes;
  }

  const officeReview = data.emilyReviews?.find((review) => review.id === "review_office");
  const seedOfficeReview = seed.emilyReviews.find((review) => review.id === "review_office");
  if (officeReview && seedOfficeReview) {
    officeReview.email_subject ||= seedOfficeReview.email_subject;
    officeReview.email_body ||= seedOfficeReview.email_body;
  }

  for (const profile of data.clientProfiles || []) {
    const seedProfile = seed.clientProfiles.find((item) => item.id === profile.id);
    profile.internal_notes ??= seedProfile?.internal_notes || "";
    profile.timezone ||= seedProfile?.timezone || "America/Phoenix";
  }

  for (const item of data.assistantItems || []) {
    item.reminder_emails = item.reminder_emails?.length ? item.reminder_emails : defaultReminderEmails(data, item.client_id);
    item.reminder_sent_for ??= null;
    item.last_reminder_email_sent_at ??= null;
  }

  for (const warranty of data.warranties || []) {
    warranty.reminder_emails = warranty.reminder_emails?.length ? warranty.reminder_emails : defaultReminderEmails(data, warranty.client_id);
    warranty.reminder_timezone ||= clientTimezone(data, warranty.client_id);
    warranty.reminder_sent_for ??= null;
    warranty.last_reminder_email_sent_at ??= null;
  }

  return { data, changed: true };
}

export function ensureBootstrapUsers(data, env = process.env) {
  const configs = [
    {
      role: "admin",
      name: env.INITIAL_ADMIN_NAME || "Emily Staff",
      email: env.INITIAL_ADMIN_EMAIL,
      password: env.INITIAL_ADMIN_PASSWORD
    },
    {
      role: "emily",
      name: env.INITIAL_EMILY_NAME || "Emily",
      email: env.INITIAL_EMILY_EMAIL,
      password: env.INITIAL_EMILY_PASSWORD
    }
  ];

  let changed = false;
  data.users ||= [];

  for (const config of configs) {
    const email = String(config.email || "").trim().toLowerCase();
    const password = String(config.password || "");
    if (!email || password.length < 6) continue;

    const existing = data.users.find((user) => String(user.email || "").trim().toLowerCase() === email);
    if (existing) continue;

    data.users.push({
      id: bootstrapUserId(config.role, email),
      name: config.name,
      email,
      role: config.role,
      password_hash: hashPassword(password),
      created_at: now,
      updated_at: now
    });
    changed = true;
  }

  return changed;
}

function defaultReminderEmails(data, clientId) {
  const profile = (data.clientProfiles || []).find((item) => item.id === clientId);
  const user = profile ? (data.users || []).find((item) => item.id === profile.user_id) : null;
  return user?.email ? [user.email] : [];
}

function clientTimezone(data, clientId) {
  const profile = (data.clientProfiles || []).find((item) => item.id === clientId);
  return profile?.timezone || "America/Phoenix";
}

function inferSeedModeFromData(data) {
  return (data.users || []).some((user) => ["ava@example.com", "emily@example.com", "staff@example.com"].includes(user.email))
    ? "demo"
    : "blank";
}

function bootstrapUserId(role, email) {
  return `bootstrap_${role}_${email.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase()}`;
}

function parseBooleanEnv(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function before(id, roomId, emotions, comments, stress, clutter, energy, workbookScores = {}) {
  return emotion(id, roomId, "before", emotions, comments, stress, clutter, energy, workbookScores);
}

function after(id, roomId, emotions, comments, stress, clutter, energy) {
  return emotion(id, roomId, "after", emotions, comments, stress, clutter, energy);
}

function emotion(id, roomId, entryType, emotions, comments, stress, clutter, energy, workbookScores = {}) {
  return {
    id,
    room_id: roomId,
    entry_type: entryType,
    emotions,
    client_comments: comments,
    stress_score: stress,
    clutter_score: clutter,
    energy_alignment_score: energy,
    functional_friction_score: workbookScores.functional_friction_score ?? stress,
    storage_fit_score: workbookScores.storage_fit_score ?? Math.max(1, 10 - clutter),
    sentimental_load_score: workbookScores.sentimental_load_score ?? 5,
    readiness_score: workbookScores.readiness_score ?? 5,
    second_circle_intensity_score: workbookScores.second_circle_intensity_score ?? (workbookScores.sentimental_load_score ?? 5),
    release_readiness_score: workbookScores.release_readiness_score ?? (workbookScores.readiness_score ?? 5),
    decision_urgency_score: workbookScores.decision_urgency_score ?? 5,
    created_at: now
  };
}

function photo(id, roomId, photoType, label, background, accent, variant = "default") {
  return {
    id,
    room_id: roomId,
    photo_url: makeSeedPhoto(background, accent, variant),
    photo_type: photoType,
    uploaded_at: now
  };
}

function makeSeedPhoto(background, accent, variant) {
  const width = 640;
  const height = 420;
  const pixels = createPixelBuffer(width, height, background);

  // soft room surface
  fillRect(pixels, width, height, 44, 52, 552, 292, "#fffaf2", 0.82);
  fillRect(pixels, width, height, 0, 340, width, 80, "#f8f3ea", 1);

  drawVariant(pixels, width, height, accent, variant);

  // baseline and caption strip
  fillRect(pixels, width, height, 48, 360, 220, 24, "#2d2a26", 0.1);
  fillRect(pixels, width, height, 44, 352, 146, 34, "#2d2a26", 0.12);
  fillRect(pixels, width, height, 44, 354, 96, 16, accent, 0.32);

  return encodePngDataUrl(width, height, pixels);
}

function drawVariant(pixels, width, height, accent, variant) {
  switch (variant) {
    case "bedroom":
      fillRect(pixels, width, height, 58, 112, 230, 150, "#fff6e8", 1);
      fillRect(pixels, width, height, 82, 136, 182, 86, accent, 0.55);
      fillRect(pixels, width, height, 326, 96, 210, 212, "#fffaf2", 0.92);
      fillRect(pixels, width, height, 350, 122, 60, 78, accent, 0.4);
      fillRect(pixels, width, height, 424, 122, 88, 34, accent, 0.28);
      fillRect(pixels, width, height, 422, 174, 102, 26, accent, 0.22);
      fillCircle(pixels, width, height, 126, 278, 30, "#b86f54", 0.45);
      fillCircle(pixels, width, height, 178, 286, 24, "#416f87", 0.35);
      break;
    case "closet":
      fillRect(pixels, width, height, 82, 70, 470, 270, "#fffaf2", 0.88);
      for (const x of [148, 246, 344, 442]) fillRect(pixels, width, height, x, 94, 8, 222, accent, 0.3);
      fillRect(pixels, width, height, 118, 120, 92, 38, accent, 0.5);
      fillRect(pixels, width, height, 118, 176, 128, 38, "#b99247", 0.45);
      fillRect(pixels, width, height, 300, 126, 168, 34, accent, 0.38);
      fillRect(pixels, width, height, 300, 190, 138, 34, "#416f87", 0.3);
      break;
    case "office":
      fillRect(pixels, width, height, 70, 108, 260, 148, "#fffaf2", 0.86);
      fillRect(pixels, width, height, 92, 132, 210, 34, accent, 0.42);
      fillRect(pixels, width, height, 118, 182, 166, 42, "#b86f54", 0.32);
      fillRect(pixels, width, height, 374, 82, 150, 250, "#fffaf2", 0.8);
      fillRect(pixels, width, height, 398, 110, 102, 28, accent, 0.42);
      fillRect(pixels, width, height, 398, 158, 78, 28, "#b99247", 0.42);
      fillRect(pixels, width, height, 398, 206, 112, 28, "#81677c", 0.36);
      break;
    case "shelves":
      fillRect(pixels, width, height, 78, 72, 486, 278, "#fffaf2", 0.84);
      for (const y of [132, 202, 272]) fillRect(pixels, width, height, 110, y, 408, 10, accent, 0.4);
      fillRect(pixels, width, height, 132, 94, 76, 28, accent, 0.5);
      fillRect(pixels, width, height, 232, 94, 128, 28, "#b86f54", 0.38);
      fillRect(pixels, width, height, 382, 164, 104, 28, "#416f87", 0.38);
      fillRect(pixels, width, height, 152, 234, 158, 28, "#b99247", 0.42);
      break;
    case "kitchen":
      fillRect(pixels, width, height, 62, 90, 516, 236, "#fffaf2", 0.86);
      fillRect(pixels, width, height, 90, 126, 430, 62, accent, 0.32);
      fillRect(pixels, width, height, 92, 210, 94, 72, accent, 0.52);
      fillRect(pixels, width, height, 214, 218, 164, 32, "#b86f54", 0.4);
      fillRect(pixels, width, height, 404, 214, 102, 54, "#416f87", 0.32);
      fillCircle(pixels, width, height, 246, 286, 18, "#b99247", 0.55);
      fillCircle(pixels, width, height, 294, 286, 14, "#81677c", 0.45);
      break;
    case "counter":
      fillRect(pixels, width, height, 54, 102, 532, 124, "#fffaf2", 0.9);
      fillRect(pixels, width, height, 74, 244, 492, 70, accent, 0.32);
      fillRect(pixels, width, height, 104, 132, 92, 46, "#b86f54", 0.48);
      fillRect(pixels, width, height, 226, 132, 128, 36, "#416f87", 0.35);
      fillRect(pixels, width, height, 384, 132, 116, 52, "#b99247", 0.42);
      fillRect(pixels, width, height, 116, 276, 386, 16, "#2d2a26", 0.12);
      break;
    case "garage":
      fillRect(pixels, width, height, 58, 78, 524, 274, "#f6f4ef", 0.84);
      fillRect(pixels, width, height, 92, 112, 116, 164, accent, 0.52);
      fillRect(pixels, width, height, 232, 104, 152, 54, "#b86f54", 0.45);
      fillRect(pixels, width, height, 232, 180, 118, 84, "#416f87", 0.36);
      fillRect(pixels, width, height, 408, 118, 112, 190, "#b99247", 0.42);
      fillRect(pixels, width, height, 94, 316, 420, 18, "#2d2a26", 0.14);
      break;
    case "after":
    default:
      fillRect(pixels, width, height, 70, 82, 500, 260, "#fffaf2", 0.9);
      fillRect(pixels, width, height, 108, 122, 160, 120, accent, 0.35);
      fillRect(pixels, width, height, 314, 128, 168, 34, accent, 0.26);
      fillRect(pixels, width, height, 314, 186, 128, 34, "#b99247", 0.24);
      fillRect(pixels, width, height, 120, 292, 390, 10, "#2d2a26", 0.08);
      break;
  }
}

function createPixelBuffer(width, height, background) {
  const pixels = new Uint8Array(width * height * 4);
  const [red, green, blue] = parseHexColor(background);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = red;
    pixels[index + 1] = green;
    pixels[index + 2] = blue;
    pixels[index + 3] = 255;
  }
  return pixels;
}

function fillRect(pixels, width, height, x, y, rectWidth, rectHeight, color, alpha = 1) {
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(width, Math.ceil(x + rectWidth));
  const endY = Math.min(height, Math.ceil(y + rectHeight));
  for (let row = startY; row < endY; row += 1) {
    for (let column = startX; column < endX; column += 1) {
      blendPixel(pixels, width, column, row, color, alpha);
    }
  }
}

function fillCircle(pixels, width, height, centerX, centerY, radius, color, alpha = 1) {
  const startX = Math.max(0, Math.floor(centerX - radius));
  const endX = Math.min(width, Math.ceil(centerX + radius));
  const startY = Math.max(0, Math.floor(centerY - radius));
  const endY = Math.min(height, Math.ceil(centerY + radius));
  const radiusSquared = radius * radius;
  for (let row = startY; row < endY; row += 1) {
    for (let column = startX; column < endX; column += 1) {
      const dx = column - centerX;
      const dy = row - centerY;
      if (dx * dx + dy * dy <= radiusSquared) blendPixel(pixels, width, column, row, color, alpha);
    }
  }
}

function blendPixel(pixels, width, x, y, color, alpha) {
  const offset = (y * width + x) * 4;
  const [red, green, blue] = parseHexColor(color);
  const mix = Math.max(0, Math.min(1, alpha));
  const inverse = 1 - mix;
  pixels[offset] = Math.round(red * mix + pixels[offset] * inverse);
  pixels[offset + 1] = Math.round(green * mix + pixels[offset + 1] * inverse);
  pixels[offset + 2] = Math.round(blue * mix + pixels[offset + 2] * inverse);
  pixels[offset + 3] = 255;
}

function parseHexColor(value) {
  const hex = String(value || "").replace("#", "").trim();
  if (hex.length !== 6) return [0, 0, 0];
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function encodePngDataUrl(width, height, pixels) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);

  for (let row = 0; row < height; row += 1) {
    const rowOffset = row * stride;
    raw[rowOffset] = 0;
    const sourceOffset = row * width * 4;
    Buffer.from(pixels.subarray(sourceOffset, sourceOffset + width * 4)).copy(raw, rowOffset + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);

  return `data:image/png;base64,${png.toString("base64")}`;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcSource = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcSource), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

const CRC32_TABLE = buildCrc32Table();

function buildCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
