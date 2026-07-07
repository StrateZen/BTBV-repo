import { publicUser } from "../domain/auth.mjs";
import { EVENT_TO_PIPELINE_STAGE, EVENT_TO_TAGS, GHL_FIELD_MAP } from "../domain/constants.mjs";
import { buildClientDashboard, summarizeFreedomEntries } from "../domain/scoring.mjs";

const GHL_CUSTOM_FIELD_CACHE_MS = 10 * 60 * 1000;
const ghlCustomFieldCache = {
  expiresAt: 0,
  fields: []
};

export async function handleAppEvent(store, eventType, { clientId, roomId, metadata = {} } = {}) {
  const clientProfile = clientId ? store.find("clientProfiles", clientId) : null;
  if (!clientProfile) {
    return logSync(store, {
      client_id: clientId || null,
      room_id: roomId || null,
      event_type: eventType,
      sync_direction: "app_to_ghl",
      payload: metadata,
      status: "skipped",
      error_message: "Client profile not found"
    });
  }

  const tags = EVENT_TO_TAGS[eventType] || [];
  const pipelineStage = EVENT_TO_PIPELINE_STAGE[eventType] || clientProfile.ghl_pipeline_stage;
  const results = [];

  results.push(await syncContact(store, clientProfile.id, { eventType, pipelineStage, metadata }));

  if (tags.length) {
    results.push(await syncTags(store, clientProfile.id, tags, { eventType, roomId }));
  }

  if (pipelineStage && pipelineStage !== clientProfile.ghl_pipeline_stage) {
    await store.update("clientProfiles", clientProfile.id, {
      ghl_pipeline_stage: pipelineStage,
      last_synced_at: new Date().toISOString(),
      sync_status: "pending"
    });
  }

  results.push(await triggerWorkflow(store, eventType, clientProfile.id, { roomId, tags, pipelineStage, metadata }));

  return results;
}

export async function syncContact(store, clientId, { eventType = "manual.contact_sync", pipelineStage, metadata = {} } = {}) {
  const clientProfile = store.find("clientProfiles", clientId);
  const user = clientProfile ? store.find("users", clientProfile.user_id) : null;
  if (!clientProfile || !user) {
    return logSync(store, {
      client_id: clientId,
      event_type: eventType,
      sync_direction: "app_to_ghl",
      payload: metadata,
      status: "failed",
      error_message: "Missing client profile or user"
    });
  }

  const syncMetadata = {
    ...buildGhlMetadata(store, clientProfile),
    ...metadata
  };
  const customFieldProvisioning = await ensureMappedGhlCustomFields();
  const customFields = buildGhlCustomFields({
    clientProfile,
    pipelineStage: pipelineStage || clientProfile.ghl_pipeline_stage,
    metadata: syncMetadata
  });
  const duplicateMatch = await resolveGhlContactMatch(clientProfile, user);
  const resolvedContactId = isGhlConfigured() ? duplicateMatch?.id || undefined : clientProfile.ghl_contact_id || undefined;
  const basePayload = {
    firstName: user.name.split(" ")[0],
    lastName: user.name.split(" ").slice(1).join(" "),
    name: user.name,
    email: user.email,
    phone: clientProfile.phone,
    customFields
  };
  const request = resolvedContactId
    ? {
        method: "PUT",
        path: `/contacts/${encodeURIComponent(resolvedContactId)}`,
        payload: basePayload
      }
    : {
        method: "POST",
        path: "/contacts/upsert",
        payload: {
          locationId: process.env.GHL_LOCATION_ID || "dry-run-location",
          ...basePayload
        }
      };

  const result = await callGhl(request);

  const syncedContactId = extractGhlContactId(result.data) || resolvedContactId || null;
  if (result.ok && syncedContactId) {
    await store.update("clientProfiles", clientId, {
      ghl_contact_id: syncedContactId,
      last_synced_at: new Date().toISOString(),
      sync_status: result.status
    });
  } else {
    await store.update("clientProfiles", clientId, {
      last_synced_at: new Date().toISOString(),
      sync_status: result.status
    });
  }

  return logSync(store, {
    client_id: clientId,
    event_type: eventType,
    sync_direction: "app_to_ghl",
    payload: {
      method: request.method,
      path: request.path,
      ...request.payload,
      field_provisioning: customFieldProvisioning,
      resolved_match: duplicateMatch
        ? {
            id: duplicateMatch.id,
            matched_by: duplicateMatch.matchedBy
          }
        : null
    },
    status: result.status,
    error_message: result.error || null
  });
}

export async function syncAllContacts(store, { eventType = "manual.contact_sync_all", metadata = {} } = {}) {
  const profiles = store.all("clientProfiles");
  const logs = [];

  for (const profile of profiles) {
    logs.push(await syncContact(store, profile.id, { eventType, metadata }));
  }

  const summary = {
    total: logs.length,
    synced: logs.filter((log) => log.status === "synced").length,
    dry_run: logs.filter((log) => log.status === "dry-run").length,
    failed: logs.filter((log) => log.status === "failed").length,
    skipped: logs.filter((log) => log.status === "skipped").length
  };

  return { logs, summary };
}

export function isGhlConfigured() {
  return Boolean(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);
}

export async function ensureMappedGhlCustomFields({ force = false } = {}) {
  if (!isGhlConfigured()) {
    return {
      status: "dry-run",
      configured: false,
      created: [],
      existing: []
    };
  }

  const now = Date.now();
  if (!force && ghlCustomFieldCache.expiresAt > now && ghlCustomFieldCache.fields.length) {
    return summarizeMappedFieldCoverage(ghlCustomFieldCache.fields);
  }

  const existingResult = await callGhl({
    method: "GET",
    path: `/locations/${encodeURIComponent(process.env.GHL_LOCATION_ID)}/customFields`
  });
  if (!existingResult.ok) {
    return {
      status: existingResult.status,
      configured: true,
      created: [],
      existing: [],
      error: existingResult.error || "Unable to fetch GHL custom fields"
    };
  }

  const existingFields = extractLocationCustomFields(existingResult.data);
  const knownKeys = new Set(existingFields.map((field) => stripContactPrefix(field.fieldKey)).filter(Boolean));
  const created = [];
  const errors = [];

  for (const definition of GHL_FIELD_MAP) {
    if (knownKeys.has(definition.ghlKey)) continue;

    const createResult = await callGhl({
      method: "POST",
      path: `/locations/${encodeURIComponent(process.env.GHL_LOCATION_ID)}/customFields`,
      payload: buildGhlCustomFieldDefinition(definition)
    });
    if (!createResult.ok) {
      errors.push({
        key: definition.ghlKey,
        label: definition.label,
        error: createResult.error || "Unable to create custom field"
      });
      continue;
    }

    const createdField = createResult.data?.customField;
    if (createdField) {
      existingFields.push(createdField);
      knownKeys.add(stripContactPrefix(createdField.fieldKey));
      created.push({
        key: stripContactPrefix(createdField.fieldKey),
        label: createdField.name
      });
    }
  }

  ghlCustomFieldCache.fields = existingFields;
  ghlCustomFieldCache.expiresAt = Date.now() + GHL_CUSTOM_FIELD_CACHE_MS;

  return {
    ...summarizeMappedFieldCoverage(existingFields),
    created,
    errors
  };
}

export function buildGhlCustomFields({ clientProfile, pipelineStage, metadata = {} }) {
  const context = {
    clientProfile: {
      ...clientProfile,
      ghl_pipeline_stage: pipelineStage || clientProfile?.ghl_pipeline_stage
    },
    ...metadata
  };

  return GHL_FIELD_MAP
    .map((field) => {
      const value = valueAtPath(context, field.appField);
      if (value === undefined || value === null || value === "") return null;
      return {
        key: field.ghlKey,
        fieldValue: normalizeGhlCustomFieldValue(value)
      };
    })
    .filter(Boolean);
}

export function buildGhlMetadata(store, clientProfile) {
  if (!clientProfile) return {};
  const user = store.find("users", clientProfile.user_id);
  const rooms = store.filter("rooms", (room) => room.client_id === clientProfile.id);
  const roomIds = new Set(rooms.map((room) => room.id));
  const dashboard = buildClientDashboard({
    clientProfile,
    user: publicUser(user),
    rooms,
    photos: store.filter("roomPhotos", (photo) => roomIds.has(photo.room_id)),
    emotionEntries: store.filter("emotionEntries", (entry) => roomIds.has(entry.room_id)),
    roomScores: store.filter("roomScores", (score) => roomIds.has(score.room_id)),
    aiRecommendations: store.filter("aiRecommendations", (recommendation) => roomIds.has(recommendation.room_id)),
    emilyReviews: store.filter("emilyReviews", (review) => roomIds.has(review.room_id)),
    freedomEntries: store.filter("freedomEntries", (entry) => entry.client_id === clientProfile.id)
  });
  const latestRoomRecord = [...rooms].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0] || null;
  const latestRoomCard = latestRoomRecord
    ? dashboard.roomCards.find((room) => room.id === latestRoomRecord.id) || latestRoomRecord
    : null;
  const assistantItems = store.filter("assistantItems", (item) => item.client_id === clientProfile.id);
  const warranties = store.filter("warranties", (warranty) => warranty.client_id === clientProfile.id);
  const freedomEntries = store.filter("freedomEntries", (entry) => entry.client_id === clientProfile.id);
  const now = Date.now();
  const inThirtyDays = now + 30 * 24 * 60 * 60 * 1000;
  const freedomTool = summarizeFreedomEntries(freedomEntries);

  return {
    summary: dashboard.summary,
    latestRoom: latestRoomCard
      ? {
          ...latestRoomRecord,
          ...latestRoomCard,
          current_progress: latestRoomRecord.current_progress
        }
      : {},
    assistant: {
      open_task_count: assistantItems.filter((item) => item.type === "task" && item.status !== "complete").length,
      next_reminder_at: assistantItems
        .map((item) => item.reminder_at || item.due_date || item.appointment_at)
        .filter(Boolean)
        .sort()[0]
    },
    warranties: {
      active_count: warranties.filter((item) => item.status === "active").length,
      expiring_count: warranties.filter((item) => {
        const expires = item.expires_at ? new Date(item.expires_at).getTime() : null;
        return expires && expires >= now && expires <= inThirtyDays;
      }).length
    },
    freedomTool
  };
}

function valueAtPath(source, path) {
  return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function extractLocationCustomFields(data) {
  return (data?.customFields || data?.fields || data?.locationCustomFields || []).filter((field) => field?.model === "contact");
}

function buildGhlCustomFieldDefinition(definition) {
  return {
    name: definition.label,
    dataType: definition.dataType || "TEXT",
    model: "contact"
  };
}

function summarizeMappedFieldCoverage(fields) {
  const existing = fields.map((field) => stripContactPrefix(field.fieldKey)).filter(Boolean);
  const present = GHL_FIELD_MAP.filter((definition) => existing.includes(definition.ghlKey)).map((definition) => definition.ghlKey);
  const missing = GHL_FIELD_MAP.filter((definition) => !existing.includes(definition.ghlKey)).map((definition) => definition.ghlKey);
  return {
    status: missing.length ? "partial" : "synced",
    configured: true,
    existing: present,
    missing
  };
}

function stripContactPrefix(fieldKey = "") {
  return String(fieldKey).replace(/^contact\./, "");
}

export async function syncTags(store, clientId, tags, { eventType = "manual.tag_sync", roomId = null } = {}) {
  const clientProfile = store.find("clientProfiles", clientId);
  const payload = {
    contactId: clientProfile?.ghl_contact_id,
    tags
  };

  const result = clientProfile?.ghl_contact_id
    ? await callGhl({
        method: "POST",
        path: `/contacts/${clientProfile.ghl_contact_id}/tags`,
        payload: { tags }
      })
    : { ok: true, status: "dry-run", data: { reason: "No GHL contact id yet" } };

  return logSync(store, {
    client_id: clientId,
    room_id: roomId,
    event_type: eventType,
    sync_direction: "app_to_ghl",
    payload,
    status: result.status,
    error_message: result.error || null
  });
}

export async function triggerWorkflow(store, eventType, clientId, payload = {}) {
  const envKey = `GHL_WORKFLOW_${eventType.toUpperCase().replaceAll(".", "_")}_URL`;
  const webhookUrl = process.env[envKey];
  const body = { eventType, clientId, ...payload };

  if (!webhookUrl) {
    return logSync(store, {
      client_id: clientId,
      room_id: payload.roomId || null,
      event_type: eventType,
      sync_direction: "app_to_ghl",
      payload: body,
      status: "dry-run",
      error_message: `No ${envKey} configured`
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    return logSync(store, {
      client_id: clientId,
      room_id: payload.roomId || null,
      event_type: eventType,
      sync_direction: "app_to_ghl",
      payload: body,
      status: response.ok ? "synced" : "failed",
      error_message: response.ok ? null : text.slice(0, 500)
    });
  } catch (error) {
    return logSync(store, {
      client_id: clientId,
      room_id: payload.roomId || null,
      event_type: eventType,
      sync_direction: "app_to_ghl",
      payload: body,
      status: "failed",
      error_message: error.message
    });
  }
}

export async function logSync(store, values) {
  return store.create(
    "ghlSyncLogs",
    {
      client_id: values.client_id || null,
      room_id: values.room_id || null,
      event_type: values.event_type,
      sync_direction: values.sync_direction || "app_to_ghl",
      payload: values.payload || {},
      status: values.status,
      error_message: values.error_message || null,
      created_at: new Date().toISOString()
    },
    "ghl_log"
  );
}

async function callGhl({ method, path, payload }) {
  const apiKey = process.env.GHL_API_KEY;
  const baseUrl = process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com";
  const version = process.env.GHL_API_VERSION || "2021-07-28";
  const missingConfigMessage = "GHL_API_KEY or GHL_LOCATION_ID not configured";

  if (!apiKey || !process.env.GHL_LOCATION_ID) {
    return {
      ok: true,
      status: "dry-run",
      data: { path, payload, reason: missingConfigMessage },
      error: missingConfigMessage
    };
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: version,
        "Content-Type": "application/json"
      },
      body: payload == null || method === "GET" ? undefined : JSON.stringify(payload)
    });
    const text = await response.text();
    const data = parseGhlResponse(text);
    return {
      ok: response.ok,
      status: response.ok ? "synced" : "failed",
      data,
      error: response.ok ? null : JSON.stringify(data).slice(0, 500)
    };
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      data: null,
      error: error.message
    };
  }
}

function normalizeGhlCustomFieldValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return value;
}

async function resolveGhlContactMatch(clientProfile, user) {
  if (!isGhlConfigured() || !clientProfile || !user) return null;

  if (clientProfile.ghl_contact_id) {
    const existing = await callGhl({
      method: "GET",
      path: `/contacts/${encodeURIComponent(clientProfile.ghl_contact_id)}`
    });
    if (existing.ok) {
      const id = extractGhlContactId(existing.data) || clientProfile.ghl_contact_id;
      return { id, matchedBy: "stored_contact_id" };
    }
  }

  const locationId = process.env.GHL_LOCATION_ID;
  const email = String(user.email || "").trim();
  const phone = String(clientProfile.phone || "").trim();

  if (email) {
    const emailMatch = await callGhl({
      method: "GET",
      path: `/contacts/search/duplicate?locationId=${encodeURIComponent(locationId)}&email=${encodeURIComponent(email)}`
    });
    const emailMatchId = emailMatch.ok ? extractGhlContactId(emailMatch.data) : null;
    if (emailMatchId) return { id: emailMatchId, matchedBy: "email" };
  }

  if (phone) {
    const phoneMatch = await callGhl({
      method: "GET",
      path: `/contacts/search/duplicate?locationId=${encodeURIComponent(locationId)}&phone=${encodeURIComponent(phone)}`
    });
    const phoneMatchId = phoneMatch.ok ? extractGhlContactId(phoneMatch.data) : null;
    if (phoneMatchId) return { id: phoneMatchId, matchedBy: "phone" };
  }

  return null;
}

export function extractGhlContactId(data) {
  return (
    data?.contact?.id ||
    data?.contact?.contactId ||
    data?.data?.contact?.id ||
    data?.data?.id ||
    data?.id ||
    null
  );
}

function parseGhlResponse(text) {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
