const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_PHOTOS = 3;

const VISION_REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    room_summary: { type: "string" },
    flow_summary: { type: "string" },
    visual_observations: {
      type: "array",
      items: { type: "string" }
    },
    layout_changes: {
      type: "array",
      items: { type: "string" }
    },
    energy_blockers: {
      type: "array",
      items: { type: "string" }
    },
    quick_wins: {
      type: "array",
      items: { type: "string" }
    },
    photo_reviews: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          photo_index: { type: "integer" },
          observations: {
            type: "array",
            items: { type: "string" }
          },
          flow_issues: {
            type: "array",
            items: { type: "string" }
          },
          layout_opportunities: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["photo_index", "observations", "flow_issues", "layout_opportunities"]
      }
    }
  },
  required: [
    "room_summary",
    "flow_summary",
    "visual_observations",
    "layout_changes",
    "energy_blockers",
    "quick_wins",
    "photo_reviews"
  ]
};

export function isOpenAiVisionConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function analyzeRoomPhotosWithOpenAI({ room, beforeEntry, beforePhotos = [] }) {
  const photos = beforePhotos
    .filter((photo) => typeof photo?.photo_url === "string" && photo.photo_url.length > 0)
    .filter((photo) => isSupportedVisionImageUrl(photo.photo_url))
    .slice(0, MAX_PHOTOS);
  if (!isOpenAiVisionConfigured() || !photos.length) return null;

  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";
  const detail = process.env.OPENAI_VISION_DETAIL || "high";
  const parsed = await requestStructuredVisionReview({ room, beforeEntry, photos, model, detail }).catch(async (structuredError) => {
    try {
      return await requestLegacyVisionReview({ room, beforeEntry, photos, model, detail });
    } catch (legacyError) {
      const message = legacyError?.message || structuredError?.message || "OpenAI vision response could not be parsed.";
      throw new Error(message);
    }
  });

  return {
    method: "vision",
    provider: "openai",
    model,
    detail,
    room_summary: parsed.room_summary || "",
    flow_summary: parsed.flow_summary || "",
    visual_observations: normalizeStringList(parsed.visual_observations),
    layout_changes: normalizeStringList(parsed.layout_changes),
    energy_blockers: normalizeStringList(parsed.energy_blockers),
    quick_wins: normalizeStringList(parsed.quick_wins),
    photo_reviews: normalizePhotoReviews(parsed.photo_reviews, photos)
  };
}

function buildVisionPrompt({ room, beforeEntry }) {
  return [
    "You are reviewing room photos for Built to Be Visible, an organizing and energy-alignment business.",
    "Analyze the uploaded before photos in the order provided.",
    "Return short, client-safe statements only.",
    "Explain the room's current flow, visible friction, and best layout changes for calmer function.",
    "For photo_reviews, return one object per photo using a 1-based photo_index matching the upload order.",
    "Focus on pathways, surface load, storage pressure, focal points, accessibility, room flow, and visible friction.",
    "Do not mention uncertainty unless the photo is genuinely unclear.",
    `Room: ${room.room_name || room.room_type || "Room"}.`,
    `Room type: ${room.room_type || "Unknown"}.`,
    `Desired energy outcome: ${room.desired_energy_outcome || "Calm"}.`,
    `Client emotions: ${normalizeEmotionValue(beforeEntry?.emotions) || "Not provided"}.`,
    `Stress score: ${Number(beforeEntry?.stress_score ?? 0)}/10.`,
    `Clutter score: ${Number(beforeEntry?.clutter_score ?? 0)}/10.`,
    `Energy alignment score: ${Number(beforeEntry?.energy_alignment_score ?? 0)}/10.`,
    "Do not mention the schema or output format in the answer."
  ].join("\n");
}

async function requestStructuredVisionReview({ room, beforeEntry, photos, model, detail }) {
  const payload = await requestOpenAiVision({
    model,
    detail,
    photos,
    body: {
      model,
      temperature: 0.2,
      text: {
        format: {
          type: "json_schema",
          name: "btbv_room_photo_review",
          description: "Structured photo-by-photo review for a room transformation intake.",
          strict: true,
          schema: VISION_REVIEW_SCHEMA
        }
      },
      input: buildVisionInput({ room, beforeEntry, photos, detail })
    }
  });
  const parsed = parseVisionReview(extractOutputText(payload));
  if (!parsed) throw new Error("OpenAI structured vision response could not be parsed as JSON.");
  return parsed;
}

async function requestLegacyVisionReview({ room, beforeEntry, photos, model, detail }) {
  const payload = await requestOpenAiVision({
    model,
    detail,
    photos,
    body: {
      model,
      temperature: 0.2,
      input: buildVisionInput({ room, beforeEntry, photos, detail })
    }
  });
  const parsed = parseVisionReview(extractOutputText(payload));
  if (!parsed) throw new Error("OpenAI vision response could not be parsed as JSON.");
  return parsed;
}

async function requestOpenAiVision({ body }) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI vision request failed (${response.status}): ${extractOpenAiErrorMessage(errorText)}`);
  }

  return response.json();
}

function buildVisionInput({ room, beforeEntry, photos, detail }) {
  return [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: buildVisionPrompt({ room, beforeEntry })
        },
        ...photos.map((photo) => ({
          type: "input_image",
          image_url: photo.photo_url,
          detail
        }))
      ]
    }
  ];
}

function normalizeEmotionValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return String(value || "").trim();
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const messageText = (payload?.output || [])
    .flatMap((item) => item?.content || [])
    .map((item) => item?.text || item?.output_text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
  return messageText;
}

function parseVisionReview(outputText) {
  if (!outputText) return null;
  const trimmed = outputText.trim();
  const direct = safeJsonParse(trimmed);
  if (direct) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fenced?.[1]) return safeJsonParse(fenced[1].trim());

  const jsonSpan = trimmed.match(/\{[\s\S]+\}/);
  if (jsonSpan?.[0]) return safeJsonParse(jsonSpan[0]);

  return null;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

function normalizePhotoReviews(value, photos) {
  const list = Array.isArray(value) ? value : [];
  return photos.map((photo, index) => {
    const fallback = list[index] || null;
    const matched = list.find((item) => Number(item?.photo_index) === index + 1) || fallback || {};
    return {
      photo_id: photo.id || "",
      photo_url: photo.photo_url,
      photo_index: index + 1,
      observations: normalizeStringList(matched.observations).slice(0, 4),
      flow_issues: normalizeStringList(matched.flow_issues).slice(0, 3),
      layout_opportunities: normalizeStringList(matched.layout_opportunities).slice(0, 3)
    };
  });
}

function isSupportedVisionImageUrl(photoUrl) {
  const value = String(photoUrl || "").trim();
  if (!value) return false;
  if (!value.startsWith("data:")) return true;

  const match = value.match(/^data:([^;,]+)[;,]/i);
  const mime = match?.[1]?.toLowerCase() || "";
  return ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"].includes(mime);
}

function extractOpenAiErrorMessage(errorText) {
  const parsed = safeJsonParse(String(errorText || "").trim());
  const message = parsed?.error?.message;
  if (typeof message === "string" && message.trim()) return truncate(message.trim(), 280);
  return truncate(errorText, 280);
}

function truncate(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}
