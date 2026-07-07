import { getMembershipPermissions } from "./constants.mjs";

export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

export function percentReduction(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0) return 0;
  return clamp(((before - after) / before) * 100);
}

export function percentIncreaseWithinScale(before, after, scaleMax = 10) {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return 0;
  const roomToImprove = Math.max(1, scaleMax - before);
  return clamp(((after - before) / roomToImprove) * 100);
}

export function calculateOverallScore(entry) {
  if (!entry) return null;
  const stressHealth = 10 - Number(entry.stress_score ?? 0);
  const clutterHealth = 10 - Number(entry.clutter_score ?? 0);
  const energyHealth = Number(entry.energy_alignment_score ?? 0);
  return Math.round(clamp(((stressHealth + clutterHealth + energyHealth) / 30) * 100));
}

export function calculateWorkbookPriorityScore(room, entry) {
  if (!entry) return 0;
  const stress = scoreOutOfTen(entry.stress_score, 5);
  const clutter = scoreOutOfTen(entry.clutter_score, 5);
  const energyGap = 10 - scoreOutOfTen(entry.energy_alignment_score, 5);
  const functionalFriction = scoreOutOfTen(entry.functional_friction_score, stress);
  const storageFit = scoreOutOfTen(entry.storage_fit_score, 10 - clutter);
  const storageGap = 10 - storageFit;
  const sentimentalLoad = scoreOutOfTen(entry.sentimental_load_score, 5);
  const secondCircleIntensity = scoreOutOfTen(entry.second_circle_intensity_score, sentimentalLoad);
  const readiness = scoreOutOfTen(entry.release_readiness_score, entry.readiness_score ?? 5);
  const urgency = scoreOutOfTen(entry.decision_urgency_score, priorityToUrgency(room?.priority));

  return Math.round(
    clamp(
      functionalFriction * 10 * 0.15 +
        storageGap * 10 * 0.14 +
        sentimentalLoad * 10 * 0.12 +
        stress * 10 * 0.12 +
        clutter * 10 * 0.12 +
        energyGap * 10 * 0.09 +
        secondCircleIntensity * 10 * 0.12 +
        readiness * 10 * 0.07 +
        urgency * 10 * 0.07
    )
  );
}

export function calculateRoomTransformation(room, beforeEntry, afterEntry) {
  const completion = clamp(Number(room?.current_progress ?? 0));
  const clutterReduction = afterEntry
    ? percentReduction(Number(beforeEntry?.clutter_score), Number(afterEntry?.clutter_score))
    : 0;
  const stressReduction = afterEntry
    ? percentReduction(Number(beforeEntry?.stress_score), Number(afterEntry?.stress_score))
    : 0;
  const energyImprovement = afterEntry
    ? percentIncreaseWithinScale(
        Number(beforeEntry?.energy_alignment_score),
        Number(afterEntry?.energy_alignment_score)
      )
    : clamp((Number(beforeEntry?.energy_alignment_score ?? 0) / 10) * 20);

  const transformationScore = clamp(
    completion * 0.3 + clutterReduction * 0.25 + stressReduction * 0.25 + energyImprovement * 0.2
  );
  const beforeOverallScore = calculateOverallScore(beforeEntry);
  const afterOverallScore = calculateOverallScore(afterEntry);
  const overallScore = afterOverallScore ?? beforeOverallScore ?? 0;
  const workbookPriorityScore = calculateWorkbookPriorityScore(room, beforeEntry);

  return {
    before_score: beforeEntry
      ? Math.round(
          (Number(beforeEntry.clutter_score) +
            Number(beforeEntry.stress_score) +
            (10 - Number(beforeEntry.energy_alignment_score))) /
            3
        )
      : null,
    after_score: afterEntry
      ? Math.round(
          (Number(afterEntry.clutter_score) +
            Number(afterEntry.stress_score) +
            (10 - Number(afterEntry.energy_alignment_score))) /
            3
        )
      : null,
    before_overall_score: beforeOverallScore,
    after_overall_score: afterOverallScore,
    overall_score: overallScore,
    workbook_priority_score: workbookPriorityScore,
    functional_friction_score: beforeEntry ? scoreOutOfTen(beforeEntry.functional_friction_score, Number(beforeEntry.stress_score ?? 5)) : null,
    storage_fit_score: beforeEntry ? scoreOutOfTen(beforeEntry.storage_fit_score, 10 - Number(beforeEntry.clutter_score ?? 5)) : null,
    sentimental_load_score: beforeEntry ? scoreOutOfTen(beforeEntry.sentimental_load_score, 5) : null,
    readiness_score: beforeEntry ? scoreOutOfTen(beforeEntry.readiness_score, 5) : null,
    second_circle_intensity_score: beforeEntry ? scoreOutOfTen(beforeEntry.second_circle_intensity_score, beforeEntry.sentimental_load_score ?? 5) : null,
    release_readiness_score: beforeEntry ? scoreOutOfTen(beforeEntry.release_readiness_score, beforeEntry.readiness_score ?? 5) : null,
    decision_urgency_score: beforeEntry ? scoreOutOfTen(beforeEntry.decision_urgency_score, priorityToUrgency(room?.priority)) : null,
    clutter_reduction: Math.round(clutterReduction),
    stress_reduction: Math.round(stressReduction),
    energy_shift: afterEntry
      ? Number(afterEntry.energy_alignment_score) - Number(beforeEntry?.energy_alignment_score ?? 0)
      : 0,
    energy_alignment_improvement: Math.round(energyImprovement),
    emotional_shift: describeEmotionalShift(beforeEntry, afterEntry),
    transformation_score: Math.round(transformationScore)
  };
}

export function describeEmotionalShift(beforeEntry, afterEntry) {
  const before = normalizeEmotionList(beforeEntry?.emotions);
  const after = normalizeEmotionList(afterEntry?.emotions);
  if (!before.length && !after.length) return "Not captured yet";
  if (!after.length) return `Started with ${before.join(", ")}`;
  return `${before.join(", ") || "unclear"} to ${after.join(", ")}`;
}

export function normalizeEmotionList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function calculatePriorityScore({ room, beforeEntry, clientProfile, openRoomCount = 0 }) {
  const membership = getMembershipPermissions(clientProfile?.membership_level);
  const stress = Number(beforeEntry?.stress_score ?? 0);
  const clutter = Number(beforeEntry?.clutter_score ?? 0);
  const lowEnergy = 10 - Number(beforeEntry?.energy_alignment_score ?? 5);
  const workbookPriority = calculateWorkbookPriorityScore(room, beforeEntry);
  const urgency = room?.priority === "Urgent" ? 18 : room?.priority === "High" ? 12 : room?.priority === "Medium" ? 6 : 0;
  const upsell = room?.upsell_flag ? 8 : 0;

  return Math.round(
    membership.reviewQueuePriority * 12 +
      stress * 2.5 +
      clutter * 2 +
      lowEnergy * 1.5 +
      workbookPriority * 0.25 +
      openRoomCount * 2 +
      urgency +
      upsell
  );
}

export function summarizeFreedomEntries(entries = []) {
  const freedomEntries = Array.isArray(entries) ? entries : [];
  const releasedEntries = freedomEntries.filter((entry) => entry.status !== "draft").length;
  const evidenceCount = freedomEntries.filter((entry) => entry.what_shifted).length;
  const shiftScores = freedomEntries
    .map(freedomShiftScore)
    .filter((score) => score != null);
  const latestEntry = [...freedomEntries].sort(
    (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
  )[0];

  return {
    total_entries: freedomEntries.length,
    released_count: releasedEntries,
    evidence_count: evidenceCount,
    average_shift_score: shiftScores.length
      ? Math.round((shiftScores.reduce((sum, score) => sum + score, 0) / shiftScores.length) * 10) / 10
      : 0,
    last_subject: latestEntry?.subject || ""
  };
}

export function buildClientDashboard({
  clientProfile,
  user,
  rooms,
  photos,
  emotionEntries,
  roomScores,
  aiRecommendations = [],
  emilyReviews,
  freedomEntries = []
}) {
  const permissions = getMembershipPermissions(clientProfile?.membership_level);
  const roomCards = rooms.map((room) => {
    const beforeEntry = latestEntry(emotionEntries, room.id, "before");
    const afterEntry = latestEntry(emotionEntries, room.id, "after");
    const ai = aiRecommendations
      .filter((item) => item.room_id === room.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    const score = {
      ...calculateRoomTransformation(room, beforeEntry, afterEntry),
      ...(roomScores.find((item) => item.room_id === room.id) || {})
    };
    const beforePhoto = photos.find((photo) => photo.room_id === room.id && photo.photo_type === "before");
    const afterPhoto = photos.find((photo) => photo.room_id === room.id && photo.photo_type === "after");
    const review = emilyReviews.find((item) => item.room_id === room.id && item.sent_to_client);

    return {
      id: room.id,
      room_name: room.room_name,
      room_type: room.room_type,
      status: room.status,
      priority: room.priority,
      progress: room.current_progress,
      next_best_action: room.next_best_action,
      upsell_flag: room.upsell_flag,
      before_photo: beforePhoto?.photo_url || null,
      after_photo: afterPhoto?.photo_url || null,
      emotional_shift: score.emotional_shift,
      energy_shift: score.energy_shift,
      overall_score: score.overall_score,
      workbook_priority_score: score.workbook_priority_score,
      functional_friction_score: score.functional_friction_score,
      storage_fit_score: score.storage_fit_score,
      sentimental_load_score: score.sentimental_load_score,
      readiness_score: score.readiness_score,
      second_circle_intensity_score: score.second_circle_intensity_score,
      release_readiness_score: score.release_readiness_score,
      decision_urgency_score: score.decision_urgency_score,
      before_overall_score: score.before_overall_score,
      after_overall_score: score.after_overall_score,
      transformation_score: score.transformation_score,
      stress_reduction: score.stress_reduction,
      clutter_reduction: score.clutter_reduction,
      energy_alignment_improvement: score.energy_alignment_improvement,
      service_path: room.service_path || "Undecided",
      support_track: ai?.support_track || "",
      support_track_reason: ai?.support_track_reason || "",
      ai_review_method: ai?.ai_review_method || "",
      ai_review_summary: ai?.ai_review_summary || "",
      priority_spaces: room.priority_spaces || "",
      storage_needs: room.storage_needs || "",
      keepsake_notes: room.keepsake_notes || "",
      emily_review_available: Boolean(review),
      final_recommendation: review?.final_recommendation || null,
      emily_notes: review?.emily_notes || null
    };
  });

  const completedRooms = roomCards.filter((room) => room.status === "Complete").length;
  const inProgressRooms = roomCards.filter((room) => ["In Progress", "Recommendation Sent", "Waiting for After Photos"].includes(room.status)).length;
  const openRooms = roomCards.filter((room) => room.status !== "Complete").length;
  const needingAttention = roomCards.filter((room) => ["Emily Review Needed", "Follow-Up Needed", "Nurture", "Waiting for After Photos"].includes(room.status)).length;
  const wholeHomeScore = average(roomCards.map((room) => room.transformation_score));
  const averageStressReduction = average(roomCards.map((room) => room.stress_reduction));
  const averageClutterReduction = average(roomCards.map((room) => room.clutter_reduction));
  const averageEnergyImprovement = average(roomCards.map((room) => room.energy_alignment_improvement));
  const averageOverallScore = average(roomCards.map((room) => room.overall_score));
  const averageWorkbookPriorityScore = average(roomCards.map((room) => room.workbook_priority_score));
  const roomsWithSupportTracks = roomCards.filter((room) => room.support_track).length;
  const roomsWithVisionReview = roomCards.filter((room) => room.ai_review_method === "OpenAI vision review").length;

  const nextRoom = chooseNextRoom(roomCards);

  return {
    user,
    clientProfile,
    permissions,
    freedomTool: summarizeFreedomEntries(freedomEntries),
    summary: {
      home_transformation_score: wholeHomeScore,
      rooms_completed: completedRooms,
      rooms_in_progress: inProgressRooms,
      rooms_open: openRooms,
      rooms_needing_attention: needingAttention,
      average_stress_reduction: averageStressReduction,
      average_clutter_reduction: averageClutterReduction,
      average_energy_alignment_improvement: averageEnergyImprovement,
      average_overall_score: averageOverallScore,
      average_workbook_priority_score: averageWorkbookPriorityScore,
      rooms_with_support_tracks: roomsWithSupportTracks,
      rooms_with_vision_review: roomsWithVisionReview,
      total_recommendations_completed: roomCards.reduce((total, room) => total + (room.progress >= 75 ? 1 : 0), 0),
      next_best_action: nextRoom?.next_best_action || "Add your first room intake"
    },
    valueSummary: buildValueSummary({
      completedRooms,
      roomCount: roomCards.length,
      averageStressReduction,
      averageEnergyImprovement,
      averageWorkbookPriorityScore,
      wholeHomeScore
    }),
    roomCards
  };
}

export function latestEntry(entries, roomId, type) {
  return entries
    .filter((entry) => entry.room_id === roomId && entry.entry_type === type)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
}

export function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function chooseNextRoom(roomCards) {
  const rankedStatuses = [
    "Waiting for After Photos",
    "Recommendation Sent",
    "In Progress",
    "Emily Review Needed",
    "Follow-Up Needed",
    "Nurture",
    "Intake Submitted",
    "Not Started"
  ];

  return [...roomCards].sort((a, b) => {
    const aRank = rankedStatuses.indexOf(a.status);
    const bRank = rankedStatuses.indexOf(b.status);
    return (aRank === -1 ? 99 : aRank) - (bRank === -1 ? 99 : bRank);
  })[0];
}

function buildValueSummary({ completedRooms, roomCount, averageStressReduction, averageEnergyImprovement, averageWorkbookPriorityScore, wholeHomeScore }) {
  if (!roomCount) {
    return "Start with one room to see progress, emotional shift, and energy alignment in one place.";
  }

  return `You have completed ${completedRooms} of ${roomCount} rooms, reduced average stress by ${averageStressReduction}%, improved energy alignment by ${averageEnergyImprovement}%, and built a ${wholeHomeScore}% whole-home transformation score. Current workbook priority averages ${averageWorkbookPriorityScore}%, helping Emily focus on function, storage, sentimental load, Second Circle intensity, release readiness, and urgency.`;
}

function scoreOutOfTen(value, fallback = 5) {
  const numeric = Number(value);
  return clamp(Number.isFinite(numeric) ? numeric : Number(fallback), 1, 10);
}

function freedomShiftScore(entry) {
  const before = Number(entry?.intensity_before);
  const afterValue = entry?.intensity_after;
  if (afterValue === "" || afterValue == null) return null;
  const after = Number(afterValue);
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  return Math.max(0, before - after);
}

function priorityToUrgency(priority) {
  if (priority === "Urgent") return 9;
  if (priority === "High") return 7;
  if (priority === "Medium") return 5;
  return 3;
}
