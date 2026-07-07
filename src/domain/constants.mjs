export const ROOM_STATUSES = [
  "Not Started",
  "Intake Submitted",
  "AI Review Complete",
  "Emily Review Needed",
  "Recommendation Sent",
  "In Progress",
  "Waiting for After Photos",
  "Follow-Up Needed",
  "Complete",
  "Nurture"
];

export const ROOM_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export const ROOM_TYPES = [
  "Primary bedroom",
  "Bedroom",
  "Guest bedroom",
  "Kids bedroom",
  "Nursery",
  "Closet",
  "Walk-in closet",
  "Linen closet",
  "Kitchen",
  "Pantry",
  "Dining room",
  "Living room",
  "Family room",
  "Entryway",
  "Mudroom",
  "Laundry room",
  "Bathroom",
  "Primary bathroom",
  "Powder room",
  "Home office",
  "Craft room",
  "Playroom",
  "Homeschool room",
  "Gym",
  "Meditation room",
  "Garage",
  "Attic",
  "Basement",
  "Storage room",
  "Hallway",
  "Utility room",
  "Patio",
  "Balcony",
  "Shed",
  "Whole home",
  "Other"
];

export const DESIRED_ENERGY_OUTCOMES = [
  "Calm",
  "Focus",
  "Rest",
  "Creativity",
  "Abundance",
  "Clarity",
  "Peace",
  "Flow"
];

export const LEAD_SOURCES = [
  "Social media",
  "Internet search",
  "Referral",
  "Friend / word of mouth",
  "Existing client",
  "Event or workshop",
  "Other"
];

export const SERVICE_PATHS = [
  "Full Service",
  "Hybrid",
  "DIY",
  "Consultation Only",
  "Undecided"
];

export const BTBV_SUPPORT_TRACKS = [
  {
    id: "visible-reset",
    title: "Visible Reset",
    summary: "A quick-win room reset with a clear first finish line, layout cleanup, and simple follow-through.",
    bestFor: "One room with moderate clutter, clear next steps, and client-led momentum."
  },
  {
    id: "flow-reset-intensive",
    title: "Flow Reset Intensive",
    summary: "A deeper layout and systems reset focused on pathways, storage fit, and functional friction.",
    bestFor: "Rooms where clutter, overflow, or poor storage is interrupting daily use."
  },
  {
    id: "freedom-release-support",
    title: "Freedom Release Support",
    summary: "Physical organizing paired with Freedom Tool work so the emotional story does not keep recreating the mess.",
    bestFor: "Sentimental rooms, charged decisions, or strong Second Circle intensity."
  },
  {
    id: "whole-home-concierge",
    title: "Whole-Home Concierge",
    summary: "High-touch Emily and staff support across multiple rooms, with sequencing, accountability, and membership continuity.",
    bestFor: "Clients carrying several open rooms, high urgency, or premium support needs."
  },
  {
    id: "move-transition-support",
    title: "Move + Transition Support",
    summary: "Room planning designed around renovation, relocation, downsizing, deadlines, and downstream decisions.",
    bestFor: "Moves, transitions, quotes, deadlines, or connected-room dependencies."
  },
  {
    id: "maintenance-membership",
    title: "Maintenance Membership",
    summary: "Ongoing routines, reminders, assistant tracking, and periodic resets to keep the home from slipping backward.",
    bestFor: "Clients who have momentum and want continuity after the initial transformation."
  }
];

export const BTBV_DIFFERENTIATORS = [
  {
    title: "Measured transformation",
    summary: "Stress, clutter, energy, workbook priority, and overall room condition are tracked instead of relying on a one-time session."
  },
  {
    title: "Emotion plus function",
    summary: "The room plan combines visible organization with the emotional story and energy impact attached to the space."
  },
  {
    title: "Layout-specific guidance",
    summary: "Photo review and intake produce flow, pathway, storage, and focal-point changes rather than only a declutter checklist."
  },
  {
    title: "Ongoing continuity",
    summary: "Membership, assistant reminders, warranty tracking, community support, and nurture follow-up keep progress active."
  }
];

export const FREEDOM_TOOL_STATUSES = ["draft", "released", "evidence logged"];

export const FREEDOM_SUPPORT_PATHS = [
  "Self-guided Freedom Tool",
  "Intensive",
  "Installment",
  "Immersive Session",
  "Emily review needed"
];

export const FAQ_ITEMS = [
  {
    question: "How is Energy Improvement calculated?",
    answer:
      "Energy Improvement compares the room's before and after energy alignment scores. A higher after score means the room is moving closer to the client's desired energy outcome."
  },
  {
    question: "How is Stress Reduction calculated?",
    answer:
      "Stress Reduction compares the before stress score with the after stress score. Lower after stress creates a higher percentage improvement."
  },
  {
    question: "How is Clutter Reduction calculated?",
    answer:
      "Clutter Reduction compares the before clutter score with the after clutter score. Lower after clutter creates a higher percentage improvement."
  },
  {
    question: "What is the Overall Score?",
    answer:
      "Overall Score combines the latest stress, clutter, and energy scores into one 0-100 room condition score. Low stress, low clutter, and high energy alignment raise the score."
  },
  {
    question: "What is the Workbook Priority Score?",
    answer:
      "Workbook Priority Score translates the BTBV consultation workbook into a 0-100 priority signal. It weighs functional friction, storage fit, sentimental load, stress, clutter, energy gap, Second Circle intensity, release readiness, and decision urgency."
  },
  {
    question: "What is Functional Friction?",
    answer:
      "Functional Friction is a 1-10 score for how much the space interrupts daily life. A higher score means the room is creating more repeated effort, avoidance, overflow, or disrupted routines."
  },
  {
    question: "What is Storage Fit?",
    answer:
      "Storage Fit is a 1-10 score for whether belongings have practical, permanent homes. A higher score means storage is working; a lower score means the room likely needs layout, category, or container decisions."
  },
  {
    question: "What is Sentimental Load?",
    answer:
      "Sentimental Load is a 1-10 score for keepsakes, heirlooms, family items, memory pressure, or emotional-release work. A higher score means Emily may need to handle the plan with more care and service depth."
  },
  {
    question: "What is Readiness Score?",
    answer:
      "Readiness Score is a 1-10 score for how prepared the client is to make decisions, book support, approve a service path, or complete next steps."
  },
  {
    question: "What is Decision Urgency?",
    answer:
      "Decision Urgency is a 1-10 score for timing pressure such as pending renovation quotes, deposits, move dates, appointments, or other deadlines that affect the room plan."
  },
  {
    question: "What is Second Circle Intensity?",
    answer:
      "Second Circle Intensity is a 1-10 score for the negative story, meaning, or brain chatter attached to the room or subject. A higher score means the Freedom Tool may be important before the physical work will hold."
  },
  {
    question: "What is Release Readiness?",
    answer:
      "Release Readiness is a 1-10 score for how ready the client feels to voice, surrender, and let go of the Second Circle story. A higher score means the client may be ready for self-guided Freedom Tool work or deeper Emily support."
  },
  {
    question: "What is the Freedom Tool?",
    answer:
      "The Freedom Tool separates First Circle facts from Second Circle meaning. Clients name what is disrupting peace, write the unfiltered story around it, voice release, destroy the sheet, and only keep evidence of what shifted afterward."
  },
  {
    question: "What is the Home Transformation Score?",
    answer:
      "Home Transformation Score averages room transformation scores across all rooms, combining completion, clutter reduction, stress reduction, and energy improvement."
  },
  {
    question: "What does AI review on intake mean?",
    answer:
      "After before photos and emotional intake are submitted, the app drafts an AI-assisted narrative, visual observations, practical organizing steps, layout changes, and a recommended BTBV support track for Emily to review before the client receives guidance. If OpenAI vision is configured, the model analyzes the uploaded photos directly; otherwise the app falls back to the local intake-and-photo-context draft."
  },
  {
    question: "Why does Emily review the AI recommendation?",
    answer:
      "Emily's review keeps the client-facing guidance personal, supportive, and aligned with membership level before recommendations are sent."
  },
  {
    question: "What is a Next Best Action?",
    answer:
      "Next Best Action is the single clearest step the client should take next, such as uploading after photos, starting a recommendation, or submitting intake."
  },
  {
    question: "What does Nurture mean?",
    answer:
      "Nurture means a room is still open and receives follow-up reminders or support prompts instead of disappearing from the dashboard."
  },
  {
    question: "How does membership affect the app?",
    answer:
      "Membership controls active room limits, AI review volume, Emily review access, booking access, follow-up cadence, priority, and advanced dashboard visibility."
  },
  {
    question: "What makes BTBV different from a standard organizing company?",
    answer:
      "BTBV combines room organization, emotional release, energy alignment, measurable scoring, AI-plus-Emily planning, and ongoing membership support. The result is a tracked transformation system rather than a one-time decluttering visit."
  }
];

export const INTERNAL_EVENTS = [
  "client.created",
  "membership.updated",
  "room.created",
  "room.intake_submitted",
  "ai.review_completed",
  "emily.review_needed",
  "recommendation.sent",
  "room.after_photos_requested",
  "room.completed",
  "room.nurture_started",
  "room.updated",
  "assistant.updated",
  "warranty.updated",
  "freedom_tool.updated",
  "upsell.identified"
];

export const EVENT_TO_TAGS = {
  "client.created": ["app-client"],
  "membership.updated": [],
  "room.created": ["app-client"],
  "room.intake_submitted": ["room-intake-submitted"],
  "ai.review_completed": ["ai-review-complete"],
  "emily.review_needed": ["emily-review-needed"],
  "recommendation.sent": ["recommendation-sent"],
  "room.after_photos_requested": ["after-photos-needed"],
  "room.completed": ["room-complete"],
  "room.nurture_started": ["nurture-active"],
  "room.updated": ["app-client"],
  "assistant.updated": ["app-client"],
  "warranty.updated": ["app-client"],
  "freedom_tool.updated": ["app-client"],
  "upsell.identified": ["upsell-opportunity"]
};

export const EVENT_TO_PIPELINE_STAGE = {
  "client.created": "New Client",
  "room.created": "New Client",
  "room.intake_submitted": "Room Intake Submitted",
  "ai.review_completed": "AI Review Complete",
  "emily.review_needed": "Emily Review Needed",
  "recommendation.sent": "Recommendation Sent",
  "room.after_photos_requested": "After Photos Needed",
  "room.completed": "Transformation Complete",
  "room.nurture_started": "Nurture",
  "upsell.identified": "Upsell / Next Room"
};

export const GHL_FIELD_MAP = [
  { appField: "clientProfile.membership_level", ghlKey: "membership_level", label: "Membership Level", dataType: "TEXT" },
  { appField: "clientProfile.membership_status", ghlKey: "membership_status", label: "Membership Status", dataType: "TEXT" },
  {
    appField: "clientProfile.ghl_pipeline_stage",
    ghlKey: "room_energy_pipeline_stage",
    label: "Room Energy Pipeline Stage",
    dataType: "TEXT"
  },
  {
    appField: "summary.home_transformation_score",
    ghlKey: "home_transformation_score",
    label: "Home Transformation Score",
    dataType: "NUMERICAL"
  },
  { appField: "summary.average_overall_score", ghlKey: "overall_room_score", label: "Overall Room Score", dataType: "NUMERICAL" },
  {
    appField: "summary.average_energy_alignment_improvement",
    ghlKey: "energy_alignment_improvement",
    label: "Energy Alignment Improvement",
    dataType: "NUMERICAL"
  },
  {
    appField: "summary.average_stress_reduction",
    ghlKey: "average_stress_reduction",
    label: "Average Stress Reduction",
    dataType: "NUMERICAL"
  },
  {
    appField: "summary.average_clutter_reduction",
    ghlKey: "average_clutter_reduction",
    label: "Average Clutter Reduction",
    dataType: "NUMERICAL"
  },
  {
    appField: "summary.average_workbook_priority_score",
    ghlKey: "average_workbook_priority_score",
    label: "Average Workbook Priority Score",
    dataType: "NUMERICAL"
  },
  { appField: "summary.rooms_completed", ghlKey: "rooms_completed", label: "Rooms Completed", dataType: "NUMERICAL" },
  { appField: "summary.rooms_in_progress", ghlKey: "rooms_in_progress", label: "Rooms In Progress", dataType: "NUMERICAL" },
  { appField: "summary.rooms_open", ghlKey: "rooms_open", label: "Rooms Open", dataType: "NUMERICAL" },
  {
    appField: "summary.rooms_needing_attention",
    ghlKey: "rooms_needing_attention",
    label: "Rooms Needing Attention",
    dataType: "NUMERICAL"
  },
  {
    appField: "summary.total_recommendations_completed",
    ghlKey: "recommendations_completed",
    label: "Recommendations Completed",
    dataType: "NUMERICAL"
  },
  { appField: "summary.next_best_action", ghlKey: "next_best_action", label: "Next Best Action", dataType: "LARGE_TEXT" },
  { appField: "latestRoom.room_name", ghlKey: "latest_room_name", label: "Latest Room Name", dataType: "TEXT" },
  { appField: "latestRoom.status", ghlKey: "latest_room_status", label: "Latest Room Status", dataType: "TEXT" },
  { appField: "latestRoom.current_progress", ghlKey: "latest_room_progress", label: "Latest Room Progress", dataType: "NUMERICAL" },
  {
    appField: "latestRoom.overall_score",
    ghlKey: "latest_room_overall_score",
    label: "Latest Room Overall Score",
    dataType: "NUMERICAL"
  },
  {
    appField: "latestRoom.workbook_priority_score",
    ghlKey: "latest_room_workbook_priority_score",
    label: "Latest Room Workbook Priority Score",
    dataType: "NUMERICAL"
  },
  { appField: "latestRoom.service_path", ghlKey: "latest_room_service_path", label: "Latest Room Service Path", dataType: "TEXT" },
  { appField: "latestRoom.support_track", ghlKey: "latest_room_support_track", label: "Latest Room Support Track", dataType: "TEXT" },
  { appField: "latestRoom.ai_review_method", ghlKey: "latest_room_ai_review_method", label: "Latest Room AI Review Method", dataType: "TEXT" },
  {
    appField: "latestRoom.priority_spaces",
    ghlKey: "latest_room_priority_spaces",
    label: "Latest Room Priority Spaces",
    dataType: "LARGE_TEXT"
  },
  {
    appField: "latestRoom.storage_needs",
    ghlKey: "latest_room_storage_needs",
    label: "Latest Room Storage Needs",
    dataType: "LARGE_TEXT"
  },
  {
    appField: "latestRoom.keepsake_notes",
    ghlKey: "latest_room_keepsake_notes",
    label: "Latest Room Keepsake Notes",
    dataType: "LARGE_TEXT"
  },
  { appField: "latestRoom.upsell_flag", ghlKey: "upsell_opportunity", label: "Upsell Opportunity", dataType: "TEXT" },
  { appField: "assistant.open_task_count", ghlKey: "assistant_open_tasks", label: "Assistant Open Tasks", dataType: "NUMERICAL" },
  { appField: "assistant.next_reminder_at", ghlKey: "assistant_next_reminder", label: "Assistant Next Reminder", dataType: "TEXT" },
  { appField: "warranties.active_count", ghlKey: "active_warranty_count", label: "Active Warranty Count", dataType: "NUMERICAL" },
  {
    appField: "warranties.expiring_count",
    ghlKey: "expiring_warranty_count",
    label: "Expiring Warranty Count",
    dataType: "NUMERICAL"
  },
  { appField: "freedomTool.total_entries", ghlKey: "freedom_tool_entries", label: "Freedom Tool Entries", dataType: "NUMERICAL" },
  {
    appField: "freedomTool.evidence_count",
    ghlKey: "freedom_tool_evidence_count",
    label: "Freedom Tool Evidence Count",
    dataType: "NUMERICAL"
  },
  {
    appField: "freedomTool.average_shift_score",
    ghlKey: "freedom_tool_average_shift_score",
    label: "Freedom Tool Average Shift Score",
    dataType: "NUMERICAL"
  },
  { appField: "freedomTool.last_subject", ghlKey: "latest_freedom_tool_subject", label: "Latest Freedom Tool Subject", dataType: "LARGE_TEXT" }
];

export const ASSISTANT_ITEM_TYPES = ["note", "routine", "task", "appointment", "reminder"];

export const ASSISTANT_ITEM_LABELS = {
  note: "Note",
  routine: "Routine",
  task: "Task",
  appointment: "Appointment",
  reminder: "Reminder"
};

export const WARRANTY_CATEGORIES = [
  "Appliance - kitchen",
  "Appliance - laundry",
  "Appliance - small appliance",
  "HVAC",
  "Water heater",
  "Plumbing fixture",
  "Electrical system",
  "Lighting",
  "Roof",
  "Windows",
  "Doors",
  "Flooring",
  "Cabinetry",
  "Countertops",
  "Furniture",
  "Mattress",
  "Electronics",
  "Computer or tablet",
  "Phone",
  "Smart home device",
  "Security system",
  "Garage door",
  "Outdoor equipment",
  "Lawn and garden",
  "Pool or spa",
  "Vehicle",
  "Home organization product",
  "Storage system",
  "Tools",
  "Fitness equipment",
  "Baby or kids item",
  "Pet equipment",
  "Jewelry or valuables",
  "Home service plan",
  "Extended protection plan",
  "Manufacturer warranty",
  "Installation warranty",
  "Other"
];

export const COMPETITOR_SERVICE_OPPORTUNITIES = [
  "Full-service home organization",
  "Decluttering session",
  "Kitchen and pantry organization",
  "Closet organization",
  "Garage organization",
  "Move planning and coordination",
  "Packing and unpacking support",
  "Downsizing support",
  "Senior move management",
  "Estate cleanout planning",
  "Estate liquidation support",
  "Hoarding-sensitive cleanup",
  "Home inventory and donation coordination",
  "Virtual organizing session",
  "Maintenance subscription",
  "Energy reset or clearing session",
  "Whole-home transformation plan"
];

export const MEMBERSHIP_TIERS = {
  "Free / Intro": {
    level: "Free / Intro",
    activeRoomLimit: 1,
    aiReviewLimit: 1,
    emilyReviewLimit: 0,
    directEmilyAccess: false,
    bookingAccess: false,
    followUpCadence: "light nurture",
    reviewQueuePriority: 1,
    advancedDashboard: false,
    energyWorkDepth: "basic",
    beforeAfterReports: false,
    upsellPersonalization: false,
    supportLabel: "AI-only preview"
  },
  Bronze: {
    level: "Bronze",
    activeRoomLimit: 1,
    aiReviewLimit: 3,
    emilyReviewLimit: 1,
    directEmilyAccess: false,
    bookingAccess: false,
    followUpCadence: "monthly",
    reviewQueuePriority: 2,
    advancedDashboard: false,
    energyWorkDepth: "standard",
    beforeAfterReports: false,
    upsellPersonalization: true,
    supportLabel: "async Emily review"
  },
  Silver: {
    level: "Silver",
    activeRoomLimit: 3,
    aiReviewLimit: 8,
    emilyReviewLimit: 3,
    directEmilyAccess: false,
    bookingAccess: false,
    followUpCadence: "biweekly",
    reviewQueuePriority: 3,
    advancedDashboard: true,
    energyWorkDepth: "enhanced",
    beforeAfterReports: true,
    upsellPersonalization: true,
    supportLabel: "limited Emily notes"
  },
  Gold: {
    level: "Gold",
    activeRoomLimit: 5,
    aiReviewLimit: 15,
    emilyReviewLimit: 5,
    directEmilyAccess: true,
    bookingAccess: true,
    followUpCadence: "weekly",
    reviewQueuePriority: 4,
    advancedDashboard: true,
    energyWorkDepth: "enhanced",
    beforeAfterReports: true,
    upsellPersonalization: true,
    supportLabel: "direct Emily messaging"
  },
  Platinum: {
    level: "Platinum",
    activeRoomLimit: 99,
    aiReviewLimit: 99,
    emilyReviewLimit: 20,
    directEmilyAccess: true,
    bookingAccess: true,
    followUpCadence: "high-touch",
    reviewQueuePriority: 5,
    advancedDashboard: true,
    energyWorkDepth: "premium",
    beforeAfterReports: true,
    upsellPersonalization: true,
    supportLabel: "priority Emily access"
  },
  VIP: {
    level: "VIP",
    activeRoomLimit: 999,
    aiReviewLimit: 999,
    emilyReviewLimit: 999,
    directEmilyAccess: true,
    bookingAccess: true,
    followUpCadence: "custom",
    reviewQueuePriority: 6,
    advancedDashboard: true,
    energyWorkDepth: "premium",
    beforeAfterReports: true,
    upsellPersonalization: true,
    supportLabel: "concierge Emily sessions"
  }
};

export function getMembershipPermissions(level = "Free / Intro") {
  return MEMBERSHIP_TIERS[level] || MEMBERSHIP_TIERS["Free / Intro"];
}

export function membershipLevels() {
  return Object.keys(MEMBERSHIP_TIERS);
}
