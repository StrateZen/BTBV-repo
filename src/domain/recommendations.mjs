import { BTBV_DIFFERENTIATORS, BTBV_SUPPORT_TRACKS } from "./constants.mjs";
import { normalizeEmotionList } from "./scoring.mjs";
import { analyzeRoomPhotosWithOpenAI, isOpenAiVisionConfigured } from "../integrations/openai.mjs";

export const AI_RECOMMENDATION_PROMPT = `You are assisting an organizing and energy-work business.

Review the room photos and the client's emotional intake. Provide practical organizing recommendations and explain the emotional or energetic reason behind each recommendation.

The recommendations should be practical, supportive, nonjudgmental, and client-friendly.

Return the response in this format:

1. Room Summary
2. Emotional Themes
3. Visual / Organizing Observations
4. Energy Blockers
5. Recommended Organizing Actions
6. Reason Behind Each Recommendation
7. Suggested Energy Work
8. Priority Order
9. Client-Friendly Message Draft
10. Suggested Upsell Opportunity
11. Follow-Up Recommendation
12. Before Photo Narrative
13. Recommended Layout Changes
14. BTBV Support Track
15. AI Review Method`;

export async function generateRoomRecommendation({ room, beforeEntry, beforePhotos = [], permissions }) {
  const emotions = normalizeEmotionList(beforeEntry?.emotions);
  const stress = Number(beforeEntry?.stress_score ?? 0);
  const clutter = Number(beforeEntry?.clutter_score ?? 0);
  const energy = Number(beforeEntry?.energy_alignment_score ?? 0);
  const desiredOutcome = room.desired_energy_outcome || "Calm";
  const intensity = stress >= 8 || clutter >= 8 ? "high" : stress >= 5 || clutter >= 5 ? "moderate" : "light";
  const openAiConfigured = isOpenAiVisionConfigured();
  const visionAttempt = await safeVisionReview({ room, beforeEntry, beforePhotos });
  const visionReview = visionAttempt.review;
  const photoNarrative = buildPhotoNarrative({
    room,
    beforePhotos,
    intensity,
    stress,
    clutter,
    energy,
    desiredOutcome,
    visionReview
  });
  const layoutRecommendations = buildLayoutRecommendations({ room, clutter, energy, desiredOutcome, visionReview });
  const workbookContext = buildWorkbookContext({ room, beforeEntry });
  const secondCircleIntensity = Number(beforeEntry?.second_circle_intensity_score ?? 0);
  const releaseReadiness = Number(beforeEntry?.release_readiness_score ?? 0);
  const supportTrack = recommendSupportTrack({ room, beforeEntry, permissions, visionReview });
  const photoReviewReport = buildPhotoReviewReport({
    room,
    beforeEntry,
    beforePhotos,
    desiredOutcome,
    intensity,
    stress,
    clutter,
    energy,
    visionReview,
    visionFallbackReason: visionAttempt.error,
    openAiConfigured
  });

  const actions = [
    {
      title: "Create a visible reset zone",
      reason: "A small clear surface gives the eye a place to rest and makes progress visible quickly."
    },
    {
      title: `Sort the ${room.room_type || "room"} into keep, relocate, release, and decide-later groups`,
      reason: "Separating decisions lowers overwhelm and keeps the client from trying to solve the entire room at once."
    },
    {
      title: "Make daily-use items easiest to reach",
      reason: "Flow improves when the room supports repeated habits without extra friction."
    }
  ];

  if (clutter >= 7) {
    actions.push({
      title: "Limit the first work session to one category or one wall",
      reason: "A contained scope protects energy and makes completion more likely."
    });
  }

  if (energy <= 4 || permissions?.energyWorkDepth !== "basic") {
    actions.push({
      title: `Add a ${desiredOutcome.toLowerCase()} anchor after organizing`,
      reason: "A simple scent, sound, light, or grounding ritual helps the room feel intentionally reset."
    });
  }

  if (Number(beforeEntry?.storage_fit_score ?? 5) <= 4 || room.storage_needs) {
    actions.push({
      title: "Assign permanent homes before adding new storage",
      reason: "The workbook notes point to storage fit as a source of overflow, so the plan should solve where items live before buying products."
    });
  }

  if (Number(beforeEntry?.sentimental_load_score ?? 0) >= 7 || room.keepsake_notes) {
    actions.push({
      title: "Create a keepsake decision zone",
      reason: "Sentimental items need slower decisions and visible respect so emotional release work does not block practical progress."
    });
  }

  if (secondCircleIntensity >= 7) {
    actions.push({
      title: "Complete a Freedom Tool clustering sheet before the next organizing block",
      reason: "The room appears to carry a strong Second Circle story, so releasing the story first can help the physical changes hold."
    });
  }

  const upsell = identifyUpsell({ room, stress, clutter, energy, permissions, beforeEntry });
  const followUp =
    secondCircleIntensity >= 7
      ? "Check in after the client completes a Freedom Tool clustering sheet and logs what shifted."
      : intensity === "high"
        ? "Check in within 5 days and offer Emily support."
        : "Check in after the first organizing step is complete.";

  return {
    observations: [
      `${room.room_name} is currently carrying ${intensity} transformation intensity based on the submitted scores.`,
      `${beforePhotos.length} before photo${beforePhotos.length === 1 ? "" : "s"} submitted for review.`,
      `Desired energy outcome: ${desiredOutcome}.`,
      secondCircleIntensity ? `Second Circle intensity: ${secondCircleIntensity}/10.` : "",
      releaseReadiness ? `Release readiness: ${releaseReadiness}/10.` : "",
      ...workbookContext.observations,
      ...photoNarrative.visualObservations,
      ...(visionReview?.quick_wins?.length ? [`Vision quick wins: ${visionReview.quick_wins.join("; ")}.`] : [])
    ].filter(Boolean),
    before_photo_narrative: photoNarrative.narrative,
    recommended_layout_changes: uniqueStrings([...layoutRecommendations, ...workbookContext.layoutChanges]),
    emotional_themes: emotions.length ? emotions : ["Overwhelm", "Stuck energy", "Desire for ease"],
    energy_blockers: uniqueStrings([
      ...buildEnergyBlockers({ stress, clutter, energy, secondCircleIntensity }),
      ...(visionReview?.energy_blockers || []),
      ...workbookContext.energyBlockers
    ]),
    organizing_recommendations: actions.map((action) => action.title),
    recommendation_reasons: actions.map((action) => action.reason),
    energy_recommendations: buildEnergyRecommendations(desiredOutcome, permissions),
    suggested_next_steps: actions.slice(0, 3).map((action, index) => `${index + 1}. ${action.title}`),
    priority_order: workbookContext.priorityOrder.length
      ? ["Reset zone", ...workbookContext.priorityOrder, "Sort decisions", "Freedom Tool release", "Improve flow", "Energy reset", "After photos"]
      : ["Reset zone", "Sort decisions", "Improve flow", "Energy reset", "After photos"],
    support_track: supportTrack.title,
    support_track_reason: supportTrack.reason,
    support_track_id: supportTrack.id,
    ai_review_method: photoReviewReport.review_mode_label,
    ai_review_model: photoReviewReport.model || "",
    ai_review_summary: photoReviewReport.summary,
    photo_review_report: photoReviewReport,
    btbv_advantages: BTBV_DIFFERENTIATORS.map((item) => `${item.title}: ${item.summary}`),
    upsell_opportunity: upsell,
    client_message_draft: buildClientMessage({
      room,
      emotions,
      desiredOutcome,
      actions,
      photoNarrative,
      layoutRecommendations,
      workbookContext,
      supportTrack
    }),
    follow_up_recommendation: followUp
  };
}

function buildWorkbookContext({ room, beforeEntry }) {
  const observations = [];
  const layoutChanges = [];
  const energyBlockers = [];
  const priorityOrder = [];
  const functionalFriction = Number(beforeEntry?.functional_friction_score ?? 0);
  const storageFit = Number(beforeEntry?.storage_fit_score ?? 0);
  const sentimentalLoad = Number(beforeEntry?.sentimental_load_score ?? 0);
  const readiness = Number(beforeEntry?.readiness_score ?? 0);
  const urgency = Number(beforeEntry?.decision_urgency_score ?? 0);

  if (room.lead_source) observations.push(`Consultation source: ${room.lead_source}.`);
  if (room.priority_spaces) observations.push(`Priority space context from workbook: ${room.priority_spaces}.`);
  if (room.priority_space_story) observations.push(`Client story: ${room.priority_space_story}`);
  if (room.service_path && room.service_path !== "Undecided") observations.push(`Recommended service path: ${room.service_path}.`);
  if (room.quote_amount) observations.push(`Quote context captured: $${Number(room.quote_amount).toLocaleString()}.`);

  if (room.constraints) {
    observations.push(`Known constraints: ${room.constraints}`);
    layoutChanges.push("Account for renovation, budget, timing, or access constraints before committing to storage purchases.");
  }

  if (room.room_dependencies) {
    observations.push(`Room dependency noted: ${room.room_dependencies}`);
    layoutChanges.push("Resolve the overflow relationship between connected spaces before judging this room as complete.");
    priorityOrder.push("Connected-room overflow");
  }

  if (room.storage_needs || storageFit <= 4) {
    layoutChanges.push("Identify the permanent home for each high-volume category before deciding on bins, shelves, or labels.");
    priorityOrder.push("Permanent storage homes");
  }

  if (room.keepsake_notes || sentimentalLoad >= 7) {
    energyBlockers.push("Sentimental items or family keepsakes may be carrying emotional weight that slows practical decisions.");
    layoutChanges.push("Create a protected keepsake review area separate from everyday clutter decisions.");
    priorityOrder.push("Keepsake decisions");
  }

  if (room.visibility_goals) {
    observations.push(`Visibility or display goal: ${room.visibility_goals}`);
    layoutChanges.push("Use one display zone for meaningful items so visibility supports the client instead of adding visual noise.");
  }

  if (functionalFriction >= 7) energyBlockers.push("High functional friction suggests the current layout is interrupting everyday routines.");
  if (readiness <= 4) observations.push("Readiness is low, so the first action should be small, visible, and low-risk.");
  if (urgency >= 7) observations.push("Decision urgency is high, so Emily should confirm timing, deposits, and next-step ownership.");

  return { observations, layoutChanges, energyBlockers, priorityOrder };
}

function buildPhotoNarrative({ room, beforePhotos, intensity, stress, clutter, energy, desiredOutcome, visionReview }) {
  const photoCount = beforePhotos.length;
  const roomLabel = room.room_type || room.room_name || "room";
  const visualObservations = [...(visionReview?.visual_observations || [])];

  if (photoCount === 0) {
    visualObservations.push("No before photos were available, so the visual review is based on room type and emotional intake.");
  } else {
    visualObservations.push(
      `${photoCount} before photo${photoCount === 1 ? "" : "s"} available for AI-assisted review of surfaces, pathways, storage pressure, and visual weight.`
    );
  }
  if (clutter >= 7) visualObservations.push("Visual clutter should be treated as the first flow issue to resolve.");
  if (stress >= 7) visualObservations.push("The room likely needs one fast visible win before deeper sorting begins.");
  if (energy <= 4) visualObservations.push(`The current setup does not appear to be supporting ${desiredOutcome.toLowerCase()} yet.`);

  return {
    narrative:
      visionReview?.room_summary
        ? `${visionReview.room_summary} The goal is to reduce decision pressure first, then adjust the layout so the room naturally supports ${desiredOutcome.toLowerCase()}.`
        : photoCount > 0
        ? `The submitted before photo${photoCount === 1 ? "" : "s"} suggest this ${roomLabel.toLowerCase()} needs a ${intensity} reset focused on clear pathways, lighter surfaces, and a stronger visual focal point. The goal is to reduce decision pressure first, then adjust the layout so the room naturally supports ${desiredOutcome.toLowerCase()}.`
        : `Because no before photo was submitted, the first recommendation is to capture the main doorway view, the highest-clutter surface, and the primary storage zone so Emily can confirm flow and layout patterns.`,
    visualObservations
  };
}

function buildLayoutRecommendations({ room, clutter, energy, desiredOutcome, visionReview }) {
  const roomType = String(room.room_type || "").toLowerCase();
  const recommendations = [
    ...(visionReview?.layout_changes || []),
    "Keep the main walking path open from the doorway to the room's primary destination.",
    "Choose one visual focal point and reduce competing items around it.",
    "Move daily-use items into the easiest reach zone and relocate occasional-use items higher, lower, or farther away."
  ];

  if (roomType.includes("bedroom")) {
    recommendations.push("Clear both sides of the bed and keep sleep-related items closest to the nightstand.");
  } else if (roomType.includes("office")) {
    recommendations.push("Face the desk toward the strongest light or least distracting wall, then keep only active work on the desktop.");
  } else if (roomType.includes("kitchen") || roomType.includes("pantry")) {
    recommendations.push("Create a clean prep zone, a landing zone, and grouped storage zones for cooking, food, and daily reset items.");
  } else if (roomType.includes("garage") || roomType.includes("storage")) {
    recommendations.push("Group items by category along the perimeter and keep the center floor as clear as possible.");
  } else if (roomType.includes("living") || roomType.includes("family")) {
    recommendations.push("Arrange seating so conversation and movement both feel easy, then remove loose items from central surfaces.");
  }

  if (clutter >= 7) {
    recommendations.push("Start layout changes only after one surface or one pathway is completely cleared.");
  }

  if (energy <= 4) {
    recommendations.push(`After the layout reset, add one ${desiredOutcome.toLowerCase()} cue where it is visible from the doorway.`);
  }

  return uniqueStrings(recommendations);
}

function buildEnergyBlockers({ stress, clutter, energy, secondCircleIntensity = 0 }) {
  const blockers = [];
  if (clutter >= 7) blockers.push("High visual density may be creating decision fatigue.");
  if (stress >= 7) blockers.push("Stress score suggests the room may feel emotionally activating.");
  if (energy <= 4) blockers.push("Low alignment score suggests the current layout may not support the desired mood.");
  if (secondCircleIntensity >= 7) blockers.push("Second Circle story appears strong enough that emotional release work should happen alongside organizing.");
  if (!blockers.length) blockers.push("Minor friction points may be interrupting flow.");
  return blockers;
}

function buildEnergyRecommendations(desiredOutcome, permissions) {
  const recommendations = [
    `Open the room, breathe slowly, and name the intended feeling: ${desiredOutcome}.`,
    "Clear one surface completely before adding anything decorative.",
    "Place one supportive object where it will be seen daily."
  ];

  if (permissions?.energyWorkDepth === "premium") {
    recommendations.push("Complete a guided energy clearing after the physical reset and record how the room feels afterward.");
  }

  return recommendations;
}

async function safeVisionReview({ room, beforeEntry, beforePhotos }) {
  try {
    return {
      review: await analyzeRoomPhotosWithOpenAI({ room, beforeEntry, beforePhotos }),
      error: ""
    };
  } catch (error) {
    return {
      review: null,
      error: error?.message || "OpenAI vision review failed."
    };
  }
}

function buildPhotoReviewReport({
  room,
  beforeEntry,
  beforePhotos,
  desiredOutcome,
  intensity,
  stress,
  clutter,
  energy,
  visionReview,
  visionFallbackReason,
  openAiConfigured
}) {
  const submittedPhotos = beforePhotos.filter((photo) => photo?.photo_url).slice(0, 3);
  const photoCount = submittedPhotos.length;
  const localPhotoReviews = buildLocalPhotoReviews({ room, beforePhotos: submittedPhotos, desiredOutcome, stress, clutter, energy });

  if (visionReview?.method === "vision") {
    return {
      status: "vision-reviewed",
      badge_label: "OpenAI vision",
      review_mode_label: "OpenAI vision review",
      provider: visionReview.provider || "openai",
      model: visionReview.model || "",
      detail: visionReview.detail || "",
      photo_count: photoCount,
      summary: `OpenAI vision directly analyzed ${photoCount} uploaded before photo${photoCount === 1 ? "" : "s"} and merged the image findings with the intake scores.`,
      fallback_reason: "",
      room_summary: visionReview.room_summary || "",
      flow_summary: visionReview.flow_summary || "The uploaded photos were reviewed for flow, friction, and layout opportunities.",
      visual_observations: uniqueStrings(visionReview.visual_observations || []),
      layout_changes: uniqueStrings(visionReview.layout_changes || []),
      energy_blockers: uniqueStrings(visionReview.energy_blockers || []),
      quick_wins: uniqueStrings(visionReview.quick_wins || []),
      photo_reviews: visionReview.photo_reviews?.length ? visionReview.photo_reviews : localPhotoReviews
    };
  }

  const fallbackReason =
    photoCount === 0
      ? "No before photos with usable image URLs were available for direct image review yet."
      : openAiConfigured
        ? visionFallbackReason || "The image response could not be used, so this room fell back to the local draft."
        : "OpenAI vision is not configured in this environment, so this room is using the local intake-and-photo-context draft.";

  return {
    status: "draft",
    badge_label: photoCount ? "Local draft only" : "Awaiting vision-ready photos",
    review_mode_label: "Local intake-and-photo-context draft",
    provider: openAiConfigured ? "openai" : "local",
    model: "",
    detail: "",
    photo_count: photoCount,
    summary:
      photoCount > 0
        ? `This room is currently using a local draft built from the intake scores, room context, and ${photoCount} uploaded before photo${photoCount === 1 ? "" : "s"}. Direct photo vision analysis did not run for this review.`
        : "This room is currently using a local draft built from the intake scores and workbook context until vision-reviewable photos are uploaded.",
    fallback_reason: fallbackReason,
    room_summary: `${room.room_name || room.room_type || "This room"} is carrying ${intensity} transformation intensity with a target of ${desiredOutcome.toLowerCase()}.`,
    flow_summary: buildDraftFlowSummary({ room, stress, clutter, energy, desiredOutcome }),
    visual_observations: buildDraftVisualObservations({ photoCount, stress, clutter, energy, desiredOutcome }),
    layout_changes: buildDraftLayoutChanges({ room, clutter, energy, desiredOutcome }),
    energy_blockers: buildEnergyBlockers({ stress, clutter, energy }),
    quick_wins: buildDraftQuickWins({ room, desiredOutcome }),
    photo_reviews: localPhotoReviews
  };
}

function buildLocalPhotoReviews({ room, beforePhotos, desiredOutcome, stress, clutter, energy }) {
  return beforePhotos.map((photo, index) => ({
    photo_id: photo.id || "",
    photo_url: photo.photo_url,
    photo_index: index + 1,
    observations: uniqueStrings([
      `Before photo ${index + 1} was included with the room intake for ${room.room_name || room.room_type || "this room"}.`,
      clutter >= 7 ? "High clutter suggests the first visible win should be a fully cleared surface or pathway." : "",
      stress >= 7 ? "The room likely needs a smaller first session so progress feels safe and finishable." : "",
      energy <= 4 ? `The current setup does not yet appear aligned with ${desiredOutcome.toLowerCase()}.` : ""
    ]).slice(0, 4),
    flow_issues: uniqueStrings([
      clutter >= 7 ? "Start with the most blocked surface or path before changing the whole layout." : "Keep the main walking path readable from the doorway.",
      stress >= 7 ? "Decision fatigue is likely, so reduce categories and visible choices in the first reset." : ""
    ]).slice(0, 3),
    layout_opportunities: uniqueStrings([
      "Move daily-use items into the easiest reach zone first.",
      `Make the first visible focal point reinforce ${desiredOutcome.toLowerCase()}.`,
      room.room_dependencies ? "Resolve overflow from connected rooms before calling this space finished." : ""
    ]).slice(0, 3)
  }));
}

function buildDraftFlowSummary({ room, stress, clutter, energy, desiredOutcome }) {
  const roomLabel = room.room_type || room.room_name || "room";
  const intensity = clutter >= 7 || stress >= 7 ? "high" : clutter >= 5 || stress >= 5 ? "moderate" : "light";
  const alignment = energy <= 4 ? `The current setup is not yet supporting ${desiredOutcome.toLowerCase()}.` : `The room is close to supporting ${desiredOutcome.toLowerCase()}, but the layout still needs reinforcement.`;
  return `The current ${roomLabel.toLowerCase()} appears to need a ${intensity} layout reset focused on clear pathways, lower surface pressure, and faster access to daily-use items. ${alignment}`;
}

function buildDraftVisualObservations({ photoCount, stress, clutter, energy, desiredOutcome }) {
  return uniqueStrings([
    photoCount > 0
      ? `${photoCount} uploaded before photo${photoCount === 1 ? "" : "s"} are attached to this room and will support the final review once vision analysis is available.`
      : "No reviewable before photos have been uploaded yet.",
    clutter >= 7 ? "Visual clutter should be treated as the first flow issue to resolve." : "",
    stress >= 7 ? "The room likely needs one fast visible win before deeper sorting begins." : "",
    energy <= 4 ? `The current setup does not appear to be supporting ${desiredOutcome.toLowerCase()} yet.` : ""
  ]);
}

function buildDraftLayoutChanges({ room, clutter, energy, desiredOutcome }) {
  const roomType = String(room.room_type || "").toLowerCase();
  const changes = [
    "Keep the main walking path open from the doorway to the room's primary destination.",
    "Reduce surface load before buying or adding storage.",
    "Move daily-use items into the easiest reach zone first."
  ];

  if (roomType.includes("kitchen") || roomType.includes("pantry")) {
    changes.push("Create one prep zone, one landing zone, and grouped storage for the categories used together.");
  } else if (roomType.includes("bedroom")) {
    changes.push("Clear both sides of the bed and limit visible surfaces near sleep zones.");
  } else if (roomType.includes("office")) {
    changes.push("Keep only active work on the desk and group archived materials outside the primary work zone.");
  }

  if (clutter >= 7) changes.push("Clear one full surface or one pathway before making broader layout changes.");
  if (energy <= 4) changes.push(`Add one visible ${desiredOutcome.toLowerCase()} cue from the doorway after the reset.`);

  return uniqueStrings(changes);
}

function buildDraftQuickWins({ room, desiredOutcome }) {
  return uniqueStrings([
    "Clear one visible surface completely.",
    "Relocate daily-use items so they can be reached without moving other categories.",
    `Place one ${desiredOutcome.toLowerCase()} anchor where it is visible from the doorway.`,
    room.storage_needs ? "Name permanent homes for the highest-volume categories before buying storage." : ""
  ]);
}

function recommendSupportTrack({ room, beforeEntry, permissions, visionReview }) {
  const stress = Number(beforeEntry?.stress_score ?? 0);
  const clutter = Number(beforeEntry?.clutter_score ?? 0);
  const functionalFriction = Number(beforeEntry?.functional_friction_score ?? stress);
  const storageFit = Number(beforeEntry?.storage_fit_score ?? Math.max(1, 10 - clutter));
  const sentimentalLoad = Number(beforeEntry?.sentimental_load_score ?? 0);
  const secondCircleIntensity = Number(beforeEntry?.second_circle_intensity_score ?? sentimentalLoad);
  const urgency = Number(beforeEntry?.decision_urgency_score ?? 0);
  const hasDependencies = Boolean(String(room.room_dependencies || "").trim());
  const hasConstraints = Boolean(String(room.constraints || "").trim());
  const highTouchMembership = permissions?.directEmilyAccess || permissions?.reviewQueuePriority >= 4;
  const roomType = String(room.room_type || "").toLowerCase();

  if (roomType.includes("whole home") || urgency >= 8 || hasDependencies || hasConstraints) {
    return supportTrack("move-transition-support", "Deadlines, constraints, or connected-room dependencies mean the room should be sequenced like a transition project instead of a single declutter visit.");
  }
  if (secondCircleIntensity >= 7 || sentimentalLoad >= 7) {
    return supportTrack("freedom-release-support", "The emotional charge attached to the room is high enough that release work should happen alongside the organizing steps.");
  }
  if (highTouchMembership && (stress >= 8 || clutter >= 8) && (visionReview?.layout_changes?.length || 0) >= 2) {
    return supportTrack("whole-home-concierge", "The room signals high complexity and premium support need, so Emily and staff can guide the sequence across more than one zone.");
  }
  if (functionalFriction >= 7 || storageFit <= 4 || clutter >= 7) {
    return supportTrack("flow-reset-intensive", "The room mainly needs stronger flow, better storage fit, and less everyday friction.");
  }
  if (permissions?.followUpCadence && permissions.followUpCadence !== "light nurture" && Number(room.current_progress || 0) >= 40) {
    return supportTrack("maintenance-membership", "The room already has momentum, so routines, reminders, and continuity support will help the reset hold.");
  }
  return supportTrack("visible-reset", "The room is ready for a contained visible win, a cleaner focal point, and a simple next-step sequence.");
}

function supportTrack(id, reason) {
  const track = BTBV_SUPPORT_TRACKS.find((item) => item.id === id) || BTBV_SUPPORT_TRACKS[0];
  return {
    ...track,
    reason
  };
}

function uniqueStrings(values) {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function identifyUpsell({ room, stress, clutter, energy, permissions, beforeEntry }) {
  if (room.service_path === "Full Service") return "Intensive";
  if (room.service_path === "Hybrid") return Number(beforeEntry?.sentimental_load_score ?? 0) >= 7 ? "Installment" : "Emily review needed";
  if (room.service_path === "DIY") return "Self-guided Freedom Tool";
  if (Number(beforeEntry?.second_circle_intensity_score ?? 0) >= 8 && Number(beforeEntry?.release_readiness_score ?? 0) >= 7) {
    return "Immersive Session";
  }
  if (Number(beforeEntry?.sentimental_load_score ?? 0) >= 8) return "Installment";
  if (Number(beforeEntry?.functional_friction_score ?? 0) >= 8) return "Intensive";
  if (permissions?.bookingAccess && (stress >= 8 || clutter >= 8)) return "Intensive";
  if (room.priority === "Urgent") return "Emily review needed";
  if (energy <= 3) return "Energy clearing session";
  if (clutter >= 8) return "Whole-home transformation plan";
  return "Maintenance subscription";
}

function buildClientMessage({ room, emotions, desiredOutcome, actions, photoNarrative, layoutRecommendations, workbookContext, supportTrack }) {
  const emotionText = emotions.length ? emotions.join(", ") : "heavy or unclear";
  const clientSafeObservation = workbookContext?.observations?.find((item) => !String(item).startsWith("Consultation source:"));
  const workbookLine = clientSafeObservation
    ? ` Your consultation notes add this important context: ${clientSafeObservation}`
    : "";
  const trackLine = supportTrack?.title ? ` The best-fit BTBV support track right now is ${supportTrack.title}. ${supportTrack.reason}` : "";
  return `When you described ${room.room_name} as feeling ${emotionText}, the clearest next move was to create one visible win and reduce decision pressure.${workbookLine}${trackLine} ${photoNarrative.narrative} Start with "${actions[0].title}", then use this layout shift: ${layoutRecommendations[0]} Use ${desiredOutcome.toLowerCase()} as the emotional target for the room.`;
}
