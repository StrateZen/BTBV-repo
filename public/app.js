const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

const state = {
  session: readSession(),
  bootstrap: null,
  dashboard: null,
  admin: null,
  assistantItems: [],
  warranties: [],
  freedomEntries: [],
  communityPosts: [],
  warrantySearch: "",
  adminClientSearch: "",
  selectedAdminClientId: null,
  selectedClientTool: "intake",
  assistantCalendarView: "month",
  assistantCalendarDate: new Date().toISOString().slice(0, 10),
  editingAssistantItemId: null,
  editingWarrantyId: null,
  activeModal: null,
  draggingCalendarEvent: null,
  roomDetails: {},
  selectedRoomId: null,
  authMode: "login",
  busy: false
};

init();

async function init() {
  state.bootstrap = await api("/api/bootstrap");
  if (state.session) await refreshData();
  render();
}

document.addEventListener("click", async (event) => {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  try {
    if (action === "auth-mode") {
      state.authMode = actionEl.dataset.mode;
      render();
    }

    if (action === "demo-login") {
      await login(actionEl.dataset.email, "demo123");
    }

    if (action === "logout") {
      localStorage.removeItem("reo-session");
      state.session = null;
      state.dashboard = null;
      state.admin = null;
      state.assistantItems = [];
      state.warranties = [];
      state.freedomEntries = [];
      state.communityPosts = [];
      state.activeModal = null;
      render();
    }

    if (action === "select-room") {
      state.selectedRoomId = actionEl.dataset.roomId;
      await loadRoomDetails(state.selectedRoomId);
      render();
    }

    if (action === "start-room") {
      await api(`/api/rooms/${actionEl.dataset.roomId}`, {
        method: "PATCH",
        body: {
          status: "In Progress",
          current_progress: 60,
          next_best_action: "Upload after photos"
        }
      });
      await refreshData();
      showToast("Room progress updated.");
    }

    if (action === "generate-ai") {
      await api(`/api/rooms/${actionEl.dataset.roomId}/ai-review`, { method: "POST", body: {} });
      await refreshData();
      showToast("AI recommendation drafted for Emily.");
    }

    if (action === "move-nurture") {
      await api(`/api/rooms/${actionEl.dataset.roomId}`, {
        method: "PATCH",
        body: {
          status: "Nurture",
          next_best_action: "Confirm whether to continue or pause"
        }
      });
      await refreshData();
      showToast("Room moved to nurture.");
    }

    if (action === "sync-contact") {
      const result = await api(`/api/ghl/sync/contact/${actionEl.dataset.clientId}`, { method: "POST", body: {} });
      await refreshData();
      showToast(
        result.log.status === "synced"
          ? "GHL contact synced."
          : result.log.status === "dry-run"
            ? `GHL sync dry-run: ${result.log.error_message || "add GHL credentials to .env or shell env."}`
            : `GHL sync failed: ${result.log.error_message || "see sync logs."}`
      );
    }

    if (action === "sync-all-contacts") {
      const result = await api("/api/ghl/sync/all", { method: "POST", body: {} });
      await refreshData();
      showToast(
        result.summary.dry_run
          ? `GHL sync all ran in dry-run. Add GHL_API_KEY and GHL_LOCATION_ID to enable live sync.`
          : `GHL sync all complete. ${result.summary.synced} synced, ${result.summary.failed} failed.`
      );
    }

    if (action === "client-tool") {
      state.selectedClientTool = actionEl.dataset.tool;
      state.editingAssistantItemId = null;
      state.editingWarrantyId = null;
      state.activeModal = null;
      render();
    }

    if (action === "open-modal") {
      state.activeModal = {
        type: actionEl.dataset.modal,
        id: actionEl.dataset.id || null
      };
      render();
    }

    if (action === "close-modal") {
      state.activeModal = null;
      state.editingAssistantItemId = null;
      state.editingWarrantyId = null;
      render();
    }

    if (action === "assistant-calendar-view") {
      state.assistantCalendarView = actionEl.dataset.view;
      render();
    }

    if (action === "assistant-calendar-prev" || action === "assistant-calendar-next") {
      shiftAssistantCalendar(action === "assistant-calendar-next" ? 1 : -1);
      render();
    }

    if (action === "assistant-calendar-today") {
      state.assistantCalendarDate = new Date().toISOString().slice(0, 10);
      render();
    }

    if (action === "assistant-edit") {
      state.activeModal = { type: "assistant-edit", id: actionEl.dataset.itemId };
      render();
    }

    if (action === "assistant-cancel-edit") {
      state.activeModal = null;
      render();
    }

    if (action === "assistant-delete") {
      if (confirm("Delete this assistant item?")) {
        await api(`/api/assistant/items/${actionEl.dataset.itemId}`, { method: "DELETE" });
        state.activeModal = null;
        await refreshData();
        showToast("Assistant item deleted.");
      }
    }

    if (action === "warranty-edit") {
      state.activeModal = { type: "warranty-edit", id: actionEl.dataset.warrantyId };
      render();
    }

    if (action === "warranty-cancel-edit") {
      state.activeModal = null;
      render();
    }

    if (action === "warranty-delete") {
      if (confirm("Delete this warranty record?")) {
        await api(`/api/warranties/${actionEl.dataset.warrantyId}`, { method: "DELETE" });
        state.activeModal = null;
        await refreshData();
        showToast("Warranty deleted.");
      }
    }

    if (action === "freedom-edit") {
      state.activeModal = { type: "freedom-edit", id: actionEl.dataset.freedomId };
      render();
    }

    if (action === "freedom-delete") {
      if (confirm("Delete this Freedom Tool entry?")) {
        await api(`/api/freedom/entries/${actionEl.dataset.freedomId}`, { method: "DELETE" });
        state.activeModal = null;
        await refreshData();
        showToast("Freedom Tool entry deleted.");
      }
    }

    if (action === "calendar-event-edit") {
      if (actionEl.dataset.source === "assistant") {
        state.selectedClientTool = "assistant";
        state.activeModal = { type: "assistant-edit", id: actionEl.dataset.id };
      }
      if (actionEl.dataset.source === "warranty") {
        state.selectedClientTool = "warranty";
        state.activeModal = { type: "warranty-edit", id: actionEl.dataset.id };
      }
      render();
    }

    if (action === "admin-select-client") {
      state.selectedAdminClientId = actionEl.dataset.clientId;
      await loadUtilityDataForClient(state.selectedAdminClientId);
      render();
    }

    if (action === "admin-edit-client") {
      state.activeModal = { type: "admin-client-profile", id: actionEl.dataset.clientId || state.selectedAdminClientId };
      render();
    }

    if (action === "admin-room-edit") {
      state.selectedRoomId = actionEl.dataset.roomId;
      await loadRoomDetails(state.selectedRoomId);
      state.activeModal = { type: "admin-room-edit", id: state.selectedRoomId };
      render();
    }

    if (action === "community-rate") {
      await api(`/api/community/posts/${actionEl.dataset.postId}/rating`, {
        method: "PATCH",
        body: {
          client_id: state.session.clientProfile.id,
          rating: Number(actionEl.dataset.rating)
        }
      });
      await loadUtilityDataForClient(getActiveClientId());
      render();
      showToast("Rating saved.");
    }
  } catch (error) {
    showToast(error.message);
  }
});

document.addEventListener("dragstart", (event) => {
  const eventEl = event.target.closest("[data-calendar-event]");
  if (!eventEl) return;
  const payload = {
    source: eventEl.dataset.source,
    id: eventEl.dataset.id,
    kind: eventEl.dataset.kind
  };
  state.draggingCalendarEvent = payload;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/json", JSON.stringify(payload));
});

document.addEventListener("dragover", (event) => {
  if (event.target.closest("[data-calendar-date]")) event.preventDefault();
});

document.addEventListener("drop", async (event) => {
  const target = event.target.closest("[data-calendar-date]");
  if (!target) return;
  event.preventDefault();
  try {
    const payload = JSON.parse(event.dataTransfer.getData("application/json") || "null") || state.draggingCalendarEvent;
    if (!payload) return;
    await moveCalendarEvent(payload, target.dataset.calendarDate);
    state.draggingCalendarEvent = null;
    await refreshData();
    showToast("Calendar item moved.");
  } catch (error) {
    showToast(error.message);
  }
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const formName = form.dataset.form;
  if (!formName) return;

  try {
    setBusy(true);
    if (formName === "login") {
      const data = formToObject(form);
      await login(data.email, data.password);
    }

    if (formName === "register") {
      const data = formToObject(form);
      const session = await api("/api/auth/register", { method: "POST", body: data });
      setSession(session);
      await refreshData();
      showToast("Account created.");
    }

    if (formName === "room-intake") {
      await submitRoomIntake(form);
      form.reset();
      state.activeModal = null;
      showToast("Room intake submitted.");
    }

    if (formName === "admin-room-add") {
      await submitRoomIntake(form, { adminMode: true });
      form.reset();
      state.activeModal = null;
      showToast("Room added for client.");
    }

    if (formName === "admin-room-edit") {
      await submitAdminRoomEdit(form);
      state.activeModal = null;
      showToast("Room intake updated.");
    }

    if (formName === "after-update") {
      await submitAfterUpdate(form);
      form.reset();
      showToast("After photos and emotional update saved.");
    }

    if (formName === "admin-review") {
      await submitAdminReview(form);
      showToast("Emily review sent to client.");
    }

    if (formName === "admin-client-profile") {
      await submitAdminClientProfile(form);
      state.activeModal = null;
      showToast("Client profile updated.");
    }

    if (formName === "admin-client-notes") {
      await submitAdminClientNotes(form);
      showToast("Internal notes saved.");
    }

    if (formName === "assistant-item") {
      await submitAssistantItem(form);
      form.reset();
      state.activeModal = null;
      showToast("Assistant item saved.");
    }

    if (formName === "assistant-edit") {
      await submitAssistantEdit(form);
      state.editingAssistantItemId = null;
      state.activeModal = null;
      showToast("Assistant item updated.");
    }

    if (formName === "warranty") {
      await submitWarranty(form);
      form.reset();
      state.activeModal = null;
      showToast("Warranty saved.");
    }

    if (formName === "warranty-edit") {
      await submitWarrantyEdit(form);
      state.editingWarrantyId = null;
      state.activeModal = null;
      showToast("Warranty updated.");
    }

    if (formName === "freedom-entry") {
      await submitFreedomEntry(form);
      form.reset();
      state.activeModal = null;
      showToast("Freedom Tool entry saved.");
    }

    if (formName === "freedom-edit") {
      await submitFreedomEdit(form);
      state.activeModal = null;
      showToast("Freedom Tool entry updated.");
    }

    if (formName === "community-post") {
      await submitCommunityPost(form);
      form.reset();
      showToast("Community post shared.");
    }

    if (formName === "community-comment") {
      await submitCommunityComment(form);
      form.reset();
      showToast("Comment posted.");
    }
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches('[data-action="warranty-search"]')) {
    state.warrantySearch = event.target.value;
    render();
  }

  if (event.target.matches('[data-action="admin-client-search"]')) {
    state.adminClientSearch = event.target.value;
    render();
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.matches('[data-action="admin-client-select"]')) {
    state.selectedAdminClientId = event.target.value;
    await loadUtilityDataForClient(state.selectedAdminClientId);
    render();
  }
});

async function login(email, password) {
  const session = await api("/api/auth/login", {
    method: "POST",
    body: { email, password }
  });
  setSession(session);
  await refreshData();
  showToast("Signed in.");
}

function setSession(session) {
  state.session = session;
  localStorage.setItem("reo-session", JSON.stringify(session));
}

function getSelectedAdminClient() {
  return state.admin?.clients?.find((client) => client.id === state.selectedAdminClientId) || state.admin?.clients?.[0] || null;
}

function getActiveClientContext() {
  if (state.session?.user.role === "client") return state.dashboard;
  return getSelectedAdminClient();
}

function getActiveClientId() {
  return state.session?.user.role === "client" ? state.session.clientProfile.id : state.selectedAdminClientId || getSelectedAdminClient()?.id;
}

function getActiveClientEmail() {
  return getActiveClientContext()?.user?.email || state.session?.user?.email || "";
}

function getActiveClientTimezone() {
  return getActiveClientContext()?.timezone || state.session?.clientProfile?.timezone || browserTimeZone();
}

async function refreshData() {
  if (!state.session) return;
  if (state.session.user.role === "client") {
    state.dashboard = await api(`/api/dashboard/client/${state.session.clientProfile.id}`);
    await loadUtilityDataForClient(state.session.clientProfile.id);
    if (!state.selectedRoomId && state.dashboard.roomCards.length) {
      state.selectedRoomId = state.dashboard.roomCards[0].id;
      await loadRoomDetails(state.selectedRoomId);
    }
  } else {
    state.admin = await api("/api/dashboard/admin");
    if (!state.selectedAdminClientId && state.admin.clients.length) {
      state.selectedAdminClientId = state.admin.clients[0].id;
    }
    if (state.selectedAdminClientId) {
      await loadUtilityDataForClient(state.selectedAdminClientId);
    }
  }
  render();
}

async function loadUtilityDataForClient(clientId) {
  if (!clientId) return;
  const [assistantPayload, warrantyPayload, freedomPayload, communityPayload] = await Promise.all([
    api(`/api/assistant/client/${clientId}/items`),
    api(`/api/warranties/client/${clientId}`),
    api(`/api/freedom/client/${clientId}/entries`),
    api("/api/community/posts")
  ]);
  state.assistantItems = assistantPayload.items || [];
  state.warranties = warrantyPayload.warranties || [];
  state.freedomEntries = freedomPayload.entries || [];
  state.communityPosts = communityPayload.posts || [];
}

async function loadRoomDetails(roomId) {
  if (!roomId) return;
  const payload = await api(`/api/rooms/${roomId}`);
  state.roomDetails[roomId] = payload.room;
}

async function submitRoomIntake(form, { adminMode = false } = {}) {
  const data = formToObject(form);
  const photos = await filesToDataUrls(form.querySelector('[name="before_photos"]').files);
  const roomPayload = await api("/api/rooms", {
    method: "POST",
    body: roomPayloadFromForm(form, { clientId: getActiveClientId(), adminMode })
  });

  const roomId = roomPayload.room.id;
  if (photos.length) {
    await api(`/api/rooms/${roomId}/photos`, {
      method: "POST",
      body: { photo_type: "before", photos }
    });
  }

  await api(`/api/rooms/${roomId}/emotions`, {
    method: "POST",
    body: emotionPayloadFromForm(form, { entryType: "before" })
  });

  if (!adminMode && (data.first_circle_event || data.second_circle_items || Number(data.second_circle_intensity_score || 0) >= 6)) {
    await api(`/api/freedom/client/${getActiveClientId()}/entries`, {
      method: "POST",
      body: {
        room_id: roomId,
        subject: `${data.room_name} release work`,
        first_circle_event: data.first_circle_event || data.priority_space_story || "",
        second_circle_items: data.second_circle_items || data.keepsake_notes || "",
        intensity_before: Number(data.second_circle_intensity_score || 5),
        intensity_after: null,
        status: "draft",
        what_shifted: "",
        support_path: "Self-guided Freedom Tool",
        next_action: "Complete the release work, then log what shifted."
      }
    });
  }

  await api(`/api/rooms/${roomId}/ai-review`, { method: "POST", body: {} });
  state.selectedRoomId = roomId;
  await loadRoomDetails(roomId);
  await refreshData();
}

async function submitAdminRoomEdit(form) {
  const data = formToObject(form);
  const roomId = data.room_id;
  await api(`/api/rooms/${roomId}`, {
    method: "PATCH",
    body: roomPayloadFromForm(form, { clientId: getActiveClientId(), adminMode: true })
  });

  const emotionBody = emotionPayloadFromForm(form, { entryType: "before" });
  if (data.before_entry_id) {
    await api(`/api/emotions/${data.before_entry_id}`, {
      method: "PATCH",
      body: emotionBody
    });
  } else {
    await api(`/api/rooms/${roomId}/emotions`, {
      method: "POST",
      body: emotionBody
    });
  }

  await loadRoomDetails(roomId);
  await refreshData();
}

async function submitAfterUpdate(form) {
  const data = formToObject(form);
  const roomId = data.room_id;
  const photos = await filesToDataUrls(form.querySelector('[name="after_photos"]').files);
  await api(`/api/rooms/${roomId}/after`, {
    method: "POST",
    body: {
      photos,
      emotion: {
        emotions: data.emotions,
        client_comments: data.client_comments,
        stress_score: Number(data.stress_score),
        clutter_score: Number(data.clutter_score),
        energy_alignment_score: Number(data.energy_alignment_score)
      }
    }
  });
  await loadRoomDetails(roomId);
  await refreshData();
}

async function submitAdminReview(form) {
  const data = formToObject(form);
  await api(`/api/rooms/${data.room_id}/emily-review`, {
    method: "POST",
    body: {
      ai_recommendation_id: data.ai_recommendation_id,
      emily_notes: data.emily_notes,
      final_recommendation: data.final_recommendation,
      email_subject: data.email_subject,
      email_body: data.email_body,
      approved: true
    }
  });
  await api(`/api/rooms/${data.room_id}/send-recommendation`, {
    method: "POST",
    body: {}
  });
  await refreshData();
}

async function submitAdminClientProfile(form) {
  const data = formToObject(form);
  const payload = await api(`/api/client-profiles/${data.client_id}`, {
    method: "PATCH",
    body: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      timezone: data.timezone,
      membership_level: data.membership_level,
      membership_status: data.membership_status,
      ghl_pipeline_stage: data.ghl_pipeline_stage,
      notes: data.notes,
      internal_notes: data.internal_notes
    }
  });
  if (state.session?.clientProfile?.id === data.client_id) {
    state.session = {
      ...state.session,
      user: payload.user,
      clientProfile: payload.clientProfile,
      permissions: payload.permissions
    };
    setSession(state.session);
  }
  await refreshData();
}

async function submitAdminClientNotes(form) {
  const data = formToObject(form);
  const payload = await api(`/api/client-profiles/${data.client_id}`, {
    method: "PATCH",
    body: {
      internal_notes: data.internal_notes
    }
  });
  const updated = state.admin?.clients?.find((client) => client.id === data.client_id);
  if (updated) updated.internal_notes = payload.clientProfile.internal_notes;
  await refreshData();
}

async function submitAssistantItem(form) {
  await api(`/api/assistant/client/${getActiveClientId()}/items`, {
    method: "POST",
    body: assistantPayloadFromForm(form)
  });
  await refreshData();
}

async function submitAssistantEdit(form) {
  const data = formToObject(form);
  await api(`/api/assistant/items/${data.id}`, {
    method: "PATCH",
    body: assistantPayloadFromForm(form)
  });
  await refreshData();
}

function assistantPayloadFromForm(form) {
  const data = formToObject(form);
  const reminderAt = data.reminder_at ? toIsoFromLocalDateTime(data.reminder_at) : null;
  if (reminderAt && !normalizeReminderEmails(data.reminder_emails).length) {
    throw new Error("Add at least one email address for the reminder.");
  }
  return {
    type: data.type,
    title: data.title,
    notes: data.notes,
    status: data.status,
    due_date: data.due_date || null,
    reminder_at: reminderAt,
    reminder_emails: normalizeReminderEmails(data.reminder_emails),
    appointment_at: null,
    recurrence: data.recurrence,
    calendar_sync_enabled: Boolean(form.querySelector('[name="calendar_sync_enabled"]')?.checked)
  };
}

async function moveCalendarEvent(eventPayload, dateValue) {
  if (eventPayload.source === "assistant") {
    const item = state.assistantItems.find((candidate) => candidate.id === eventPayload.id);
    if (!item) throw new Error("Assistant item not found.");
    const reminderTime = item.reminder_at ? inputDateTime(item.reminder_at).split("T")[1] || "09:00" : "09:00";
    const body =
      eventPayload.kind === "reminder"
        ? { ...item, reminder_at: toIsoFromLocalDateTime(`${dateValue}T${reminderTime}`), reminder_emails: reminderEmailsValue(item.reminder_emails) }
        : { ...item, due_date: dateValue, appointment_at: null };
    await api(`/api/assistant/items/${item.id}`, { method: "PATCH", body });
    return;
  }

  if (eventPayload.source === "warranty") {
    const warranty = state.warranties.find((candidate) => candidate.id === eventPayload.id);
    if (!warranty) throw new Error("Warranty not found.");
    const body =
      eventPayload.kind === "warranty-expires"
        ? { ...warranty, expires_at: dateValue }
        : { ...warranty, reminder_at: dateValue, reminder_emails: reminderEmailsValue(warranty.reminder_emails), timezone: getActiveClientTimezone() };
    await api(`/api/warranties/${warranty.id}`, { method: "PATCH", body });
  }
}

async function submitCommunityPost(form) {
  const data = formToObject(form);
  const file = form.querySelector('[name="photo"]')?.files[0];
  const photoUrl = file ? (await filesToDataUrls([file]))[0] : "";
  await api("/api/community/posts", {
    method: "POST",
    body: {
      client_id: state.session.clientProfile.id,
      title: data.title,
      body: data.body,
      photo_url: photoUrl
    }
  });
  await loadUtilityDataForClient(getActiveClientId());
}

async function submitCommunityComment(form) {
  const data = formToObject(form);
  await api(`/api/community/posts/${data.post_id}/comments`, {
    method: "POST",
    body: {
      client_id: state.session.clientProfile.id,
      body: data.body
    }
  });
  await loadUtilityDataForClient(getActiveClientId());
}

async function submitWarranty(form) {
  await api(`/api/warranties/client/${getActiveClientId()}`, {
    method: "POST",
    body: await warrantyPayloadFromForm(form, true)
  });
  await refreshData();
}

async function submitWarrantyEdit(form) {
  const data = formToObject(form);
  await api(`/api/warranties/${data.id}`, {
    method: "PATCH",
    body: await warrantyPayloadFromForm(form, false)
  });
  await refreshData();
}

async function submitFreedomEntry(form) {
  await api(`/api/freedom/client/${getActiveClientId()}/entries`, {
    method: "POST",
    body: freedomPayloadFromForm(form)
  });
  await refreshData();
}

async function submitFreedomEdit(form) {
  const data = formToObject(form);
  await api(`/api/freedom/entries/${data.id}`, {
    method: "PATCH",
    body: freedomPayloadFromForm(form)
  });
  await refreshData();
}

function freedomPayloadFromForm(form) {
  const data = formToObject(form);
  return {
    room_id: data.room_id || "",
    subject: data.subject,
    first_circle_event: data.first_circle_event,
    second_circle_items: data.second_circle_items,
    intensity_before: Number(data.intensity_before || 5),
    intensity_after: data.intensity_after ? Number(data.intensity_after) : null,
    status: data.status,
    what_shifted: data.what_shifted,
    support_path: data.support_path,
    next_action: data.next_action,
    destroy_second_circle: Boolean(form.querySelector('[name="destroy_second_circle"]')?.checked)
  };
}

async function warrantyPayloadFromForm(form, includeEmptyDocument) {
  const data = formToObject(form);
  const file = form.querySelector('[name="document"]')?.files[0];
  if (data.reminder_at && !normalizeReminderEmails(data.reminder_emails).length) {
    throw new Error("Add at least one email address for the warranty reminder.");
  }
  const payload = {
    item_name: data.item_name,
    category: data.category,
    provider: data.provider,
    policy_number: data.policy_number,
    purchase_date: data.purchase_date || null,
    active_from: data.active_from || null,
    expires_at: data.expires_at || null,
    reminder_at: data.reminder_at || null,
    reminder_emails: normalizeReminderEmails(data.reminder_emails),
    timezone: getActiveClientTimezone(),
    notes: data.notes,
    status: data.status || "active"
  };

  if (file) {
    payload.document_name = file.name;
    payload.document_data_url = (await filesToDataUrls([file]))[0];
  } else if (includeEmptyDocument) {
    payload.document_name = "";
    payload.document_data_url = "";
  }

  return payload;
}

function roomPayloadFromForm(form, { clientId, adminMode = false } = {}) {
  const data = formToObject(form);
  const secondCircleNotes = data.second_circle_items || data.keepsake_notes || "";
  const prioritySpace = data.priority_spaces || data.room_type || data.room_name;
  const story = data.priority_space_story || data.first_circle_event || "";
  return {
    client_id: clientId,
    room_name: data.room_name,
    room_type: data.room_type,
    priority: data.priority,
    desired_energy_outcome: data.desired_energy_outcome,
    lead_source: adminMode ? data.lead_source : "",
    priority_spaces: prioritySpace,
    priority_space_story: story,
    consultation_notes: data.consultation_notes || data.client_comments || "",
    constraints: data.constraints || "",
    room_dependencies: adminMode ? data.room_dependencies || "" : "",
    storage_needs: data.storage_needs || "",
    keepsake_notes: secondCircleNotes,
    visibility_goals: adminMode ? data.visibility_goals || "" : "",
    service_path: adminMode ? data.service_path || "Undecided" : "Undecided",
    quote_amount: adminMode ? data.quote_amount : null,
    discount_percent: adminMode ? data.discount_percent : null,
    target_date: adminMode ? data.target_date || null : null,
    deposit_required: adminMode ? Boolean(form.querySelector('[name="deposit_required"]')?.checked) : false,
    decision_notes: adminMode ? data.decision_notes || "" : ""
  };
}

function emotionPayloadFromForm(form, { entryType = "before" } = {}) {
  const data = formToObject(form);
  const stress = Number(data.stress_score || 5);
  const clutter = Number(data.clutter_score || 5);
  const energy = Number(data.energy_alignment_score || 5);
  const secondCircle = Number(data.second_circle_intensity_score || data.sentimental_load_score || 5);
  const releaseReadiness = Number(data.release_readiness_score || data.readiness_score || 5);
  return {
    entry_type: entryType,
    emotions: data.emotions,
    client_comments: data.client_comments,
    stress_score: stress,
    clutter_score: clutter,
    energy_alignment_score: energy,
    functional_friction_score: Number(data.functional_friction_score || stress),
    storage_fit_score: Number(data.storage_fit_score || Math.max(1, 10 - clutter)),
    sentimental_load_score: Number(data.sentimental_load_score || secondCircle),
    readiness_score: Number(data.readiness_score || releaseReadiness),
    second_circle_intensity_score: secondCircle,
    release_readiness_score: releaseReadiness,
    decision_urgency_score: Number(data.decision_urgency_score || priorityUrgencyValue(data.priority))
  };
}

function render() {
  if (!state.session) {
    app.innerHTML = renderAuth();
    return;
  }

  if (state.session.user.role === "client") {
    app.innerHTML = renderClientApp();
    return;
  }

  app.innerHTML = renderAdminApp();
}

function renderAuth() {
  const isLogin = state.authMode === "login";
  return `
    <main class="auth-wrap">
      <section class="auth-visual">
        <div>
          <h1>Built to Be Visible</h1>
          <p>Space, emotion, energy, action, progress, measurable value.</p>
        </div>
      </section>
      <section class="auth-panel">
        <div class="auth-box">
          <div class="section-title">
            <div>
              <h2>${isLogin ? "Welcome back" : "Create account"}</h2>
              <p>${isLogin ? "Continue your room transformation." : "Start a client profile."}</p>
            </div>
          </div>
          <div class="tabs">
            <button class="tab ${isLogin ? "active" : ""}" data-action="auth-mode" data-mode="login" type="button">Login</button>
            <button class="tab ${!isLogin ? "active" : ""}" data-action="auth-mode" data-mode="register" type="button">Register</button>
          </div>
          ${
            isLogin
              ? `<form class="stack" data-form="login">
                  <label>Email <input name="email" type="email" value="ava@example.com" required /></label>
                  <label>Password <input name="password" type="password" value="demo123" required /></label>
                  <button class="btn sage" type="submit" ${state.busy ? "disabled" : ""}>Sign in</button>
                  <div class="button-row">
                    <button class="btn small ghost" data-action="demo-login" data-email="ava@example.com" type="button">Client demo</button>
                    <button class="btn small ghost" data-action="demo-login" data-email="emily@example.com" type="button">Emily demo</button>
                    <button class="btn small ghost" data-action="demo-login" data-email="staff@example.com" type="button">Staff demo</button>
                  </div>
                </form>`
              : `<form class="stack" data-form="register">
                  <label>Name <input name="name" required /></label>
                  <label>Email <input name="email" type="email" required /></label>
                  <label>Password <input name="password" type="password" minlength="6" required /></label>
                  <div class="form-grid">
                    <label>Phone <input name="phone" /></label>
                    <label>Membership
                      <select name="membership_level">${state.bootstrap.membershipLevels
                        .map((level) => `<option>${escapeHtml(level)}</option>`)
                        .join("")}</select>
                    </label>
                  </div>
                  <button class="btn sage" type="submit" ${state.busy ? "disabled" : ""}>Create account</button>
                </form>`
          }
        </div>
      </section>
    </main>
  `;
}

function renderClientApp() {
  const dashboard = state.dashboard;
  if (!dashboard) return renderShell("Loading", "<div class='page'><div class='empty-state'>Loading dashboard</div></div>");

  const selectedCard = dashboard.roomCards.find((room) => room.id === state.selectedRoomId) || dashboard.roomCards[0];
  const selectedDetails = selectedCard ? state.roomDetails[selectedCard.id] : null;

  return renderShell(
    `${escapeHtml(dashboard.user.name)} - ${escapeHtml(dashboard.clientProfile.membership_level)}`,
    `
      <main class="page">
        <section class="dashboard-hero">
          <div class="score-panel">
            <div class="score-ring" style="--score:${dashboard.summary.home_transformation_score}">
              <strong>${dashboard.summary.home_transformation_score}%</strong>
            </div>
            <div>
              <span class="pill sage">${escapeHtml(dashboard.clientProfile.membership_level)}</span>
              <h2>Home Transformation Score</h2>
              <p>${escapeHtml(dashboard.valueSummary)}</p>
            </div>
          </div>
          <div class="summary-panel">
            <div class="section-title">
              <div>
                <h2>Whole-home progress</h2>
                <p>${dashboard.summary.rooms_completed} complete, ${dashboard.summary.rooms_in_progress} in progress, ${dashboard.summary.rooms_open} open</p>
              </div>
            </div>
            <div class="next-action">
              <div>
                <span class="muted">Next best action</span>
                <strong>${escapeHtml(dashboard.summary.next_best_action)}</strong>
              </div>
              <span class="pill gold">${escapeHtml(dashboard.permissions.followUpCadence)}</span>
            </div>
          </div>
        </section>

        ${renderDifferentiationPanel(dashboard, selectedDetails || selectedCard)}
        ${renderKpis(dashboard.summary)}

        <section class="content-grid">
          <div class="work-panel">
            <div class="section-title">
              <div>
                <h2>Rooms</h2>
                <p>Progress, emotional shift, energy shift, and after-photo readiness.</p>
              </div>
            </div>
            <div class="room-grid">
              ${dashboard.roomCards.map((room) => renderRoomCard(room, room.id === selectedCard?.id)).join("")}
            </div>
          </div>

          <aside class="stack">
            ${renderRoomDetail(selectedDetails || selectedCard)}
          </aside>
        </section>
        ${renderClientToolSection(dashboard)}
        <section class="client-bottom stack">
          ${renderMembershipAccess(dashboard.permissions)}
          ${renderFaqs()}
        </section>
        ${renderActiveModal(dashboard)}
      </main>
    `
  );
}

function renderShell(subtitle, content) {
  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">BV</div>
          <div>
            <h1>Built to Be Visible</h1>
            <p>${escapeHtml(subtitle)}</p>
          </div>
        </div>
        <div class="top-actions">
          <span class="pill">${escapeHtml(state.session.user.role)}</span>
          <button class="btn small ghost" data-action="logout" type="button">Sign out</button>
        </div>
      </header>
      ${content}
    </div>
  `;
}

function renderKpis(summary) {
  const overall = ["Overall score", `${summary.average_overall_score}%`, summary.average_overall_score];
  const percentKpis = [
    ["Energy improvement", `${summary.average_energy_alignment_improvement}%`, summary.average_energy_alignment_improvement],
    ["Stress reduction", `${summary.average_stress_reduction}%`, summary.average_stress_reduction],
    ["Clutter reduction", `${summary.average_clutter_reduction}%`, summary.average_clutter_reduction]
  ];
  const roomKpis = [
    ["Rooms completed", summary.rooms_completed],
    ["Rooms in progress", summary.rooms_in_progress],
    ["Rooms needing attention", summary.rooms_needing_attention],
    ["Rooms open", summary.rooms_open]
  ];
  const workbook = [
    "Workbook priority",
    `${summary.average_workbook_priority_score || 0}%`,
    summary.average_workbook_priority_score || 0
  ];

  return `
    <section class="kpi-stack">
      <div class="overall-kpi">${renderKpiTile(overall, true)}</div>
      <div class="kpi-grid percent-kpi-row">${renderKpiTiles(percentKpis, true)}</div>
      <div class="kpi-grid workbook-kpi-row">${renderKpiTile(workbook, false, true)}</div>
      <div class="kpi-grid room-kpi-row">${renderKpiTiles(roomKpis)}</div>
    </section>
  `;
}

function renderDifferentiationPanel(dashboard, room) {
  const differentiators = state.bootstrap.btbvDifferentiators || [];
  const supportTracks = state.bootstrap.btbvSupportTracks || [];
  const activeTrack =
    supportTracks.find((item) => item.title === room?.support_track) ||
    supportTracks.find((item) => item.id === "visible-reset") ||
    supportTracks[0];

  return `
    <section class="difference-panel">
      <div class="support-track-panel">
        <div class="section-title">
          <div>
            <h3>BTBV support track</h3>
            <p>${room?.room_name ? `Current recommendation for ${escapeHtml(room.room_name)}.` : "Current best-fit support path."}</p>
          </div>
          ${room?.support_track ? `<span class="pill sage">${escapeHtml(room.support_track)}</span>` : `<span class="pill gold">Set after AI review</span>`}
        </div>
        <div class="definition-grid">
          <div class="definition-item">
            <span>Current track</span>
            <strong>${escapeHtml(room?.support_track || activeTrack?.title || "Visible Reset")}</strong>
          </div>
          <div class="definition-item">
            <span>AI review mode</span>
            <strong>${escapeHtml(room?.ai_review_method || "Drafted after intake")}</strong>
          </div>
        </div>
        <p>${escapeHtml(room?.support_track_reason || activeTrack?.summary || "AI review will recommend the best-fit support path after intake.")}</p>
        <p class="muted">${escapeHtml(room?.ai_review_summary || activeTrack?.bestFor || "")}</p>
      </div>
      <div class="difference-grid">
        ${differentiators
          .map(
            (item) => `
              <article class="difference-card">
                <span>${escapeHtml(item.title)}</span>
                <p>${escapeHtml(item.summary)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderSupportTrackSummaryCards() {
  return (state.bootstrap.btbvSupportTracks || []).map(
    (track) => `
      <article class="support-track-card">
        <strong>${escapeHtml(track.title)}</strong>
        <p>${escapeHtml(track.summary)}</p>
        <span>${escapeHtml(track.bestFor)}</span>
      </article>
    `
  );
}

function renderKpiTiles(items, withChart = false) {
  return items.map((item) => renderKpiTile(item, false, withChart)).join("");
}

function renderKpiTile([label, value, chartValue], featured = false, withChart = true) {
  const numeric = Number.parseFloat(String(chartValue ?? value).replace("%", ""));
  return `
    <div class="kpi ${featured ? "featured-kpi" : ""}">
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
      ${withChart && Number.isFinite(numeric) ? renderMiniChart(numeric, label) : ""}
    </div>
  `;
}

function renderMiniChart(value, label) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  const dash = `${safeValue} ${100 - safeValue}`;
  return `
    <svg class="mini-chart" viewBox="0 0 42 42" role="img" aria-label="${escapeHtml(label)} ${safeValue}%">
      <circle class="mini-chart-bg" cx="21" cy="21" r="15.9"></circle>
      <circle class="mini-chart-fill" cx="21" cy="21" r="15.9" pathLength="100" stroke-dasharray="${dash}"></circle>
      <text x="21" y="24">${safeValue}</text>
    </svg>
  `;
}

function renderRoomCard(room, selected) {
  return `
    <article class="room-card ${selected ? "selected" : ""}">
      <div class="room-card-head">
        <div>
          <h3>${escapeHtml(room.room_name)}</h3>
          <p class="muted">${escapeHtml(room.status)}</p>
          ${room.support_track ? `<p class="muted room-track-line">${escapeHtml(room.support_track)}</p>` : ""}
        </div>
        <span class="pill ${room.upsell_flag ? "clay" : "sage"}">${room.transformation_score}%</span>
      </div>
      <div class="photo-pair">
        ${renderPhotoSlot(room.before_photo, "Before")}
        ${renderPhotoSlot(room.after_photo, "After")}
      </div>
      <div class="progress-track"><div class="progress-fill" style="--progress:${room.progress}%"></div></div>
      <div class="room-metrics">
        <div class="mini-metric"><span>Progress</span><strong>${room.progress}%</strong></div>
        <div class="mini-metric"><span>Overall</span><strong>${room.overall_score}%</strong></div>
        <div class="mini-metric"><span>Workbook</span><strong>${room.workbook_priority_score || 0}%</strong></div>
        <div class="mini-metric"><span>Energy</span><strong>${formatShift(room.energy_shift)}</strong></div>
      </div>
      <p><strong>Next:</strong> ${escapeHtml(room.next_best_action)}</p>
      <div class="button-row">
        <button class="btn small secondary" data-action="select-room" data-room-id="${room.id}" type="button">View</button>
        ${
          room.status === "Recommendation Sent"
            ? `<button class="btn small sage" data-action="start-room" data-room-id="${room.id}" type="button">Start</button>`
            : ""
        }
        ${
          ["Intake Submitted", "AI Review Complete"].includes(room.status)
            ? `<button class="btn small blue" data-action="generate-ai" data-room-id="${room.id}" type="button">Photo AI review</button>`
            : ""
        }
      </div>
    </article>
  `;
}

function renderRoomDetail(room) {
  if (!room) {
    return `<section class="client-panel"><div class="empty-state">Add a room to begin</div></section>`;
  }

  const beforePhoto = room.before_photo || room.photos?.find((photo) => photo.photo_type === "before")?.photo_url;
  const afterPhoto = room.after_photo || room.photos?.find((photo) => photo.photo_type === "after")?.photo_url;
  const ai = room.aiRecommendations?.[room.aiRecommendations.length - 1];
  const review = room.emilyReviews?.find((item) => item.sent_to_client) || room.emilyReviews?.[room.emilyReviews.length - 1];
  const finalRecommendation = room.final_recommendation || review?.final_recommendation || ai?.client_message_draft;
  const layoutChanges = ai?.recommended_layout_changes || [];
  const photoReviewReport = ai?.photo_review_report;
  const consultationItems = [
    ["Priority space", room.priority_spaces],
    ["Client story", room.priority_space_story],
    ["Constraints", room.constraints],
    ["Connected rooms / overflow", room.room_dependencies],
    ["Storage needs", room.storage_needs],
    ["Keepsakes / emotional release", room.keepsake_notes],
    ["Visibility goals", room.visibility_goals],
    ["Target date", room.target_date ? formatDate(room.target_date) : ""],
    ["Workbook priority", room.score?.workbook_priority_score != null ? `${room.score.workbook_priority_score}%` : ""],
    ["Second Circle intensity", room.score?.second_circle_intensity_score != null ? `${room.score.second_circle_intensity_score}/10` : ""],
    ["Release readiness", room.score?.release_readiness_score != null ? `${room.score.release_readiness_score}/10` : ""]
  ].filter(([, value]) => value !== "" && value != null);

  return `
    <section class="client-panel">
      <div class="section-title">
        <div>
          <h3>${escapeHtml(room.room_name)}</h3>
          <p>${escapeHtml(room.status || "")}</p>
        </div>
        <span class="pill blue">${escapeHtml(room.priority || "Priority")}</span>
      </div>
      <div class="detail-media">
        ${beforePhoto ? `<img src="${beforePhoto}" alt="${escapeHtml(room.room_name)} before photo" />` : `<div class="empty-large">Before photo</div>`}
        ${afterPhoto ? `<img src="${afterPhoto}" alt="${escapeHtml(room.room_name)} after photo" />` : `<div class="empty-large">After photo</div>`}
      </div>
      ${
        consultationItems.length
          ? `<div class="recommendation-box consultation-box">
              <h4>BTBV workbook context</h4>
              <div class="definition-grid">
                ${consultationItems
                  .map(
                    ([label, value]) => `
                      <div class="definition-item">
                        <span>${escapeHtml(label)}</span>
                        <strong>${escapeHtml(value)}</strong>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </div>`
          : ""
      }
      ${
        room.support_track || room.ai_review_method
          ? `<div class="recommendation-box support-track-box">
              <h4>BTBV support path</h4>
              <div class="definition-grid">
                ${
                  room.support_track
                    ? `<div class="definition-item">
                        <span>Support track</span>
                        <strong>${escapeHtml(room.support_track)}</strong>
                      </div>`
                    : ""
                }
                ${
                  room.ai_review_method
                    ? `<div class="definition-item">
                        <span>AI review mode</span>
                        <strong>${escapeHtml(room.ai_review_method)}</strong>
                      </div>`
                    : ""
                }
              </div>
              ${room.support_track_reason ? `<p>${escapeHtml(room.support_track_reason)}</p>` : ""}
              ${room.ai_review_summary ? `<p class="muted">${escapeHtml(room.ai_review_summary)}</p>` : ""}
            </div>`
          : ""
      }
      ${renderPhotoReviewReport(photoReviewReport)}
      <div class="recommendation-box">
        <h4>Recommendation</h4>
        <p>${escapeHtml(finalRecommendation || "Emily review has not been sent yet.")}</p>
        ${
          ai?.before_photo_narrative
            ? `<h4>Before photo narrative</h4><p>${escapeHtml(ai.before_photo_narrative)}</p>`
            : ""
        }
        ${
          layoutChanges.length
            ? `<h4>Recommended layout changes</h4><ul>${layoutChanges.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
            : ""
        }
        ${
          ai?.organizing_recommendations
            ? `<h4>Organizing actions</h4><ul>${ai.organizing_recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
            : ""
        }
        <div class="button-row">
          <button class="btn small ghost" data-action="move-nurture" data-room-id="${room.id}" type="button">Nurture</button>
          ${
            room.status !== "Complete"
              ? `<button class="btn small sage" data-action="start-room" data-room-id="${room.id}" type="button">Progress</button>`
              : ""
          }
        </div>
      </div>
      ${room.status !== "Complete" ? renderAfterForm(room.id) : ""}
    </section>
  `;
}

function renderAfterForm(roomId) {
  return `
    <form class="stack" data-form="after-update">
      <input type="hidden" name="room_id" value="${roomId}" />
      <div class="divider"></div>
      <div class="section-title">
        <h3>After update</h3>
      </div>
      <label>After photos <input name="after_photos" type="file" accept="image/*" multiple /></label>
      <label>After emotions <input name="emotions" placeholder="Calm, clear, peaceful" required /></label>
      <div class="form-grid">
        <label>Stress score <input name="stress_score" type="number" min="1" max="10" value="3" required /></label>
        <label>Clutter score <input name="clutter_score" type="number" min="1" max="10" value="3" required /></label>
        <label class="full">Energy alignment score <input name="energy_alignment_score" type="number" min="1" max="10" value="8" required /></label>
      </div>
      <label>Notes <textarea name="client_comments"></textarea></label>
      <button class="btn sage" type="submit" ${state.busy ? "disabled" : ""}>Save after update</button>
    </form>
  `;
}

function renderMembershipAccess(permissions) {
  const items = [
    [`${permissions.activeRoomLimit >= 99 ? "Whole-home" : permissions.activeRoomLimit} active rooms`, true],
    [`${permissions.aiReviewLimit >= 99 ? "Unlimited" : permissions.aiReviewLimit} AI reviews`, true],
    [`${permissions.emilyReviewLimit >= 99 ? "Unlimited" : permissions.emilyReviewLimit} Emily reviews`, permissions.emilyReviewLimit > 0],
    ["Direct Emily access", permissions.directEmilyAccess],
    ["Booking access", permissions.bookingAccess],
    ["Advanced KPIs", permissions.advancedDashboard]
  ];

  return `
    <section class="client-panel">
      <div class="section-title"><h3>Membership access</h3></div>
      <div class="access-grid">
        ${items
          .map(
            ([label, enabled]) => `
              <div class="access-item ${enabled ? "" : "locked"}">
                <strong>${enabled ? "Available" : "Locked"}</strong>
                <p>${escapeHtml(label)}</p>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderRoomIntakeForm(dashboard) {
  const roomLimitReached = dashboard.summary.rooms_open >= dashboard.permissions.activeRoomLimit;
  return `
    <section class="client-panel">
      <div class="section-title">
        <div>
          <h3>Room intake</h3>
          <p>${dashboard.summary.rooms_open}/${dashboard.permissions.activeRoomLimit >= 99 ? "whole-home" : dashboard.permissions.activeRoomLimit} active rooms</p>
        </div>
        <button class="btn clay" data-action="open-modal" data-modal="intake" type="button" ${roomLimitReached ? "disabled" : ""}>Add intake</button>
      </div>
      <div class="compact-card-list">
        ${dashboard.roomCards
          .map(
            (room) => `
              <article class="compact-card">
                <div>
                  <strong>${escapeHtml(room.room_name)}</strong>
                  <p class="muted">${escapeHtml(room.status)} / ${escapeHtml(room.next_best_action)}</p>
                </div>
                <div class="button-row">
                  <span class="pill blue">${room.progress}%</span>
                  <button class="btn small secondary" data-action="select-room" data-room-id="${room.id}" type="button">View</button>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderRoomIntakeModalForm(dashboard, options = {}) {
  const adminMode = Boolean(options.adminMode);
  const room = options.room || {};
  const beforeEntry =
    options.beforeEntry ||
    room.emotions?.find((entry) => entry.entry_type === "before") ||
    {};
  const roomLimitReached = !adminMode && dashboard.summary.rooms_open >= dashboard.permissions.activeRoomLimit;
  const roomOptions = (state.bootstrap.roomTypes || []).map((item) => `<option>${escapeHtml(item)}</option>`).join("");
  const formName = options.formName || (adminMode ? "admin-room-add" : "room-intake");
  return `
    <form class="stack" data-form="${escapeHtml(formName)}">
      ${room.id ? `<input type="hidden" name="room_id" value="${escapeHtml(room.id)}" />` : ""}
      ${beforeEntry.id ? `<input type="hidden" name="before_entry_id" value="${escapeHtml(beforeEntry.id)}" />` : ""}
      <div class="form-section-label">
        <strong>${adminMode ? "Room planning" : "Room basics"}</strong>
        <span>${adminMode ? "Staff can update both the client-facing intake and the internal planning fields." : "Keep this light. The app will reuse these answers in the Freedom Tool and AI review."}</span>
      </div>
      <div class="form-grid">
        <label>Room name <input name="room_name" placeholder="Bedroom" value="${escapeHtml(room.room_name || "")}" required /></label>
        <label>Room type
          <select name="room_type" required>${(state.bootstrap.roomTypes || [])
            .map((item) => `<option ${room.room_type === item ? "selected" : ""}>${escapeHtml(item)}</option>`)
            .join("")}</select>
        </label>
        <label>Priority
          <select name="priority">${state.bootstrap.roomPriorities
            .map((item) => `<option ${String(room.priority || "Medium") === item ? "selected" : ""}>${escapeHtml(item)}</option>`)
            .join("")}</select>
        </label>
        <label>Energy outcome
          <select name="desired_energy_outcome">${state.bootstrap.desiredEnergyOutcomes
            .map(
              (item) => `<option ${String(room.desired_energy_outcome || "Calm") === item ? "selected" : ""}>${escapeHtml(item)}</option>`
            )
            .join("")}</select>
        </label>
      </div>
      ${adminMode
        ? `
          <div class="form-grid">
            <label>Priority space
              <select name="priority_spaces">${(state.bootstrap.roomTypes || [])
                .map((item) => `<option ${String(room.priority_spaces || room.room_type || "") === item ? "selected" : ""}>${escapeHtml(item)}</option>`)
                .join("")}</select>
            </label>
            <label>Lead source
              <select name="lead_source">${(state.bootstrap.leadSources || [])
                .map((item) => `<option ${String(room.lead_source || "") === item ? "selected" : ""}>${escapeHtml(item)}</option>`)
                .join("")}</select>
            </label>
          </div>
        `
        : ""}
      <label>What is happening in this room right now?
        <textarea name="first_circle_event" placeholder="Describe the visible or practical issue in plain language.">${escapeHtml(room.priority_space_story || "")}</textarea>
      </label>
      ${adminMode ? renderRoomPhotoPanel("Uploaded photos", room.photos || [], { className: "modal-photo-grid", emptyMessage: "No room photos uploaded yet." }) : ""}
      <label>Before photos <input name="before_photos" type="file" accept="image/*" multiple /></label>
      <label>Current emotions <input name="emotions" placeholder="Overwhelmed, anxious, stuck" value="${escapeHtml((beforeEntry.emotions || []).join(", "))}" required /></label>
      <label>What story, emotional weight, or repeated thought comes with it?
        <textarea name="second_circle_items" placeholder="This will be reused in the Freedom Tool so the client does not need to re-enter it.">${escapeHtml(room.keepsake_notes || "")}</textarea>
      </label>
      <div class="form-section-label">
        <strong>Core scores</strong>
        <span>These produce the overall room condition score.</span>
      </div>
      <div class="form-grid">
        ${renderScoreInput("Stress score", "stress_score", beforeEntry.stress_score ?? 7, "1 = calm and easy in the body. 10 = highly stressful or overwhelming.")}
        ${renderScoreInput("Clutter score", "clutter_score", beforeEntry.clutter_score ?? 7, "1 = clear and contained. 10 = visually heavy or difficult to manage.")}
        ${renderScoreInput("Energy alignment score", "energy_alignment_score", beforeEntry.energy_alignment_score ?? 4, "1 = draining or disconnected. 10 = aligned, supportive, and energizing.", true)}
      </div>
      <div class="form-section-label">
        <strong>${adminMode ? "Workbook and release scoring" : "Freedom Tool alignment"}</strong>
        <span>${adminMode ? "These fields drive the workbook priority score and internal staff review." : "These answers feed both the workbook score and a draft Freedom Tool entry."}</span>
      </div>
      <div class="form-grid">
        ${adminMode ? renderScoreInput("Functional friction", "functional_friction_score", beforeEntry.functional_friction_score ?? beforeEntry.stress_score ?? 7, "1 = the room works easily. 10 = it constantly interrupts daily life.") : ""}
        ${adminMode ? renderScoreInput("Storage fit", "storage_fit_score", beforeEntry.storage_fit_score ?? Math.max(1, 10 - Number(beforeEntry.clutter_score ?? 7)), "1 = nothing has a real home. 10 = storage already supports the room.") : ""}
        ${adminMode ? renderScoreInput("Sentimental load", "sentimental_load_score", beforeEntry.sentimental_load_score ?? beforeEntry.second_circle_intensity_score ?? 5, "1 = very little emotional weight. 10 = strong memory or identity load.") : ""}
        ${adminMode ? renderScoreInput("Client readiness", "readiness_score", beforeEntry.readiness_score ?? beforeEntry.release_readiness_score ?? 6, "1 = not ready to decide. 10 = ready to act and follow through.") : ""}
        ${renderScoreInput("Second Circle intensity", "second_circle_intensity_score", beforeEntry.second_circle_intensity_score ?? 6, "1 = low emotional charge. 10 = very charged or sticky in the mind.")}
        ${renderScoreInput("Release readiness", "release_readiness_score", beforeEntry.release_readiness_score ?? 5, "1 = not ready to release yet. 10 = ready to voice, surrender, and move.")}
        ${adminMode ? renderScoreInput("Decision urgency", "decision_urgency_score", beforeEntry.decision_urgency_score ?? priorityUrgencyValue(room.priority || "Medium"), "1 = can wait. 10 = deadlines, quotes, moves, or timing pressure are active.", true) : ""}
      </div>
      <label>What still needs a permanent home?
        <textarea name="storage_needs" placeholder="Optional: categories or surfaces that still do not have a clear place.">${escapeHtml(room.storage_needs || "")}</textarea>
      </label>
      <label>What is getting in the way?
        <textarea name="constraints" placeholder="Optional: timing, budget, other rooms, repairs, household routines.">${escapeHtml(room.constraints || "")}</textarea>
      </label>
      ${adminMode
        ? `
          <div class="form-section-label">
            <strong>Staff-only planning fields</strong>
            <span>Keep these internal. They do not appear in the client dashboard.</span>
          </div>
          <label>Consultation notes <textarea name="consultation_notes" placeholder="Handwritten workbook details, observations, planning context.">${escapeHtml(room.consultation_notes || beforeEntry.client_comments || "")}</textarea></label>
          <label>Connected rooms / overflow <textarea name="room_dependencies" placeholder="Example: bedroom depends on office overflow.">${escapeHtml(room.room_dependencies || "")}</textarea></label>
          <label>Visibility goals <textarea name="visibility_goals" placeholder="What should stay visible, highlighted, or displayed?">${escapeHtml(room.visibility_goals || "")}</textarea></label>
          <div class="form-grid">
            <label>Recommended service path
              <select name="service_path">${(state.bootstrap.servicePaths || [])
                .map((item) => `<option ${String(room.service_path || "Undecided") === item ? "selected" : ""}>${escapeHtml(item)}</option>`)
                .join("")}</select>
            </label>
            <label>Quote amount <input name="quote_amount" type="number" min="0" step="0.01" placeholder="3400" value="${escapeHtml(room.quote_amount || "")}" /></label>
            <label>Discount % <input name="discount_percent" type="number" min="0" max="100" step="0.1" placeholder="10" value="${escapeHtml(room.discount_percent || "")}" /></label>
            <label>Target date <input name="target_date" type="date" value="${escapeHtml(inputDate(room.target_date))}" /></label>
          </div>
          <label class="checkbox-label"><input name="deposit_required" type="checkbox" ${room.deposit_required ? "checked" : ""} /> Deposit required</label>
          <label>Decision notes <textarea name="decision_notes" placeholder="Internal quote options, next decision date, or follow-up context.">${escapeHtml(room.decision_notes || "")}</textarea></label>
        `
        : ""}
      <label>Comments <textarea name="client_comments" placeholder="How does this room feel right now?">${escapeHtml(beforeEntry.client_comments || "")}</textarea></label>
      <button class="btn clay" type="submit" ${state.busy || roomLimitReached ? "disabled" : ""}>${adminMode ? (room.id ? "Update room" : "Add room") : "Submit intake"}</button>
    </form>
  `;
}

function renderScoreInput(label, name, value, hint, full = false) {
  return `
    <label class="${full ? "full" : ""}">
      ${escapeHtml(label)}
      <input name="${escapeHtml(name)}" type="number" min="1" max="10" value="${escapeHtml(value)}" required />
      <span class="field-hint">${escapeHtml(hint)}</span>
    </label>
  `;
}

function buildCardPhotoList(room) {
  return [
    room.before_photo ? { photo_url: room.before_photo, photo_type: "before" } : null,
    room.after_photo ? { photo_url: room.after_photo, photo_type: "after" } : null
  ].filter(Boolean);
}

function renderRoomPhotoPanel(title, photos, options = {}) {
  const photoList = Array.isArray(photos) ? photos.filter((photo) => photo?.photo_url) : [];
  const className = options.className || "room-photo-gallery";
  const emptyMessage = options.emptyMessage || "No uploaded photos yet.";

  if (!photoList.length) {
    return options.empty === false
      ? ""
      : `
          <div class="recommendation-box photo-panel">
            <h4>${escapeHtml(title)}</h4>
            <p class="muted">${escapeHtml(emptyMessage)}</p>
          </div>
        `;
  }

  return `
    <div class="recommendation-box photo-panel">
      <h4>${escapeHtml(title)}</h4>
      ${renderRoomPhotoGallery(photoList, { className })}
    </div>
  `;
}

function renderRoomPhotoGallery(photos, options = {}) {
  const photoList = Array.isArray(photos) ? photos.filter((photo) => photo?.photo_url) : [];
  if (!photoList.length) return "";

  const className = options.className || "room-photo-gallery";
  const counters = { before: 0, after: 0 };
  const sortedPhotos = [...photoList].sort((a, b) => {
    if (a.photo_type === b.photo_type) return 0;
    return a.photo_type === "before" ? -1 : 1;
  });

  return `
    <div class="${escapeHtml(className)}">
      ${sortedPhotos
        .map((photo) => {
          const type = String(photo.photo_type || "before").toLowerCase() === "after" ? "after" : "before";
          counters[type] += 1;
          return renderPhotoSlot(photo.photo_url, `${capitalize(type)} ${counters[type]}`);
        })
        .join("")}
    </div>
  `;
}

function renderPhotoReviewReport(report, options = {}) {
  if (!report) return "";

  const title = options.title || "Photo AI review";
  const badgeClass = report.status === "vision-reviewed" ? "sage" : "gold";
  const details = [
    ["Status", report.badge_label || report.review_mode_label || "Draft"],
    ["Mode", report.review_mode_label || "Local draft"],
    ["Photos", String(report.photo_count || 0)],
    report.model ? ["Model", report.model] : null,
    report.detail ? ["Detail", report.detail] : null
  ].filter(Boolean);

  return `
    <div class="recommendation-box photo-review-box">
      <div class="section-title">
        <div>
          <h4>${escapeHtml(title)}</h4>
          <p>${escapeHtml(report.summary || "Room photos are reviewed here before Emily sends guidance.")}</p>
        </div>
        <span class="pill ${badgeClass}">${escapeHtml(report.badge_label || report.review_mode_label || "Draft")}</span>
      </div>
      <div class="definition-grid">
        ${details
          .map(
            ([label, value]) => `
              <div class="definition-item">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      ${report.fallback_reason ? `<p class="muted">${escapeHtml(report.fallback_reason)}</p>` : ""}
      ${report.room_summary ? `<h4>Room read</h4><p>${escapeHtml(report.room_summary)}</p>` : ""}
      ${report.flow_summary ? `<h4>Flow and layout read</h4><p>${escapeHtml(report.flow_summary)}</p>` : ""}
      ${renderPhotoReviewList("Visual observations", report.visual_observations)}
      ${renderPhotoReviewList("Quick wins", report.quick_wins)}
      ${renderPhotoReviewList("Layout changes", report.layout_changes)}
      ${
        Array.isArray(report.photo_reviews) && report.photo_reviews.length
          ? `<div class="photo-review-grid">
              ${report.photo_reviews.map((item) => renderPhotoReviewCard(item)).join("")}
            </div>`
          : ""
      }
    </div>
  `;
}

function renderPhotoReviewList(title, items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return "";

  return `
    <div class="photo-review-section">
      <h4>${escapeHtml(title)}</h4>
      <ul class="compact-list">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  `;
}

function renderPhotoReviewCard(item) {
  return `
    <article class="photo-review-card">
      <div class="photo-review-media">
        ${
          item.photo_url
            ? `<img src="${item.photo_url}" alt="${escapeHtml(`Before photo ${item.photo_index}`)}" />`
            : `<div class="empty-large">Before photo ${escapeHtml(item.photo_index)}</div>`
        }
        <span>Before ${escapeHtml(item.photo_index)}</span>
      </div>
      <div class="photo-review-copy">
        <strong>Before photo ${escapeHtml(item.photo_index)}</strong>
        ${renderPhotoReviewCardSection("Observed", item.observations)}
        ${renderPhotoReviewCardSection("Flow issues", item.flow_issues)}
        ${renderPhotoReviewCardSection("Layout opportunities", item.layout_opportunities)}
      </div>
    </article>
  `;
}

function renderPhotoReviewCardSection(title, items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return "";

  return `
    <div class="photo-review-card-section">
      <span>${escapeHtml(title)}</span>
      <ul class="compact-list">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  `;
}

function renderFaqs() {
  const items = state.bootstrap.faqItems || [];
  if (!items.length) return "";

  return `
    <section class="client-panel faq-panel">
      <div class="section-title">
        <div>
          <h3>FAQs and definitions</h3>
          <p>How scores and core terms are calculated.</p>
        </div>
      </div>
      <div class="faq-list">
        ${items
          .map(
            (item) => `
              <details class="faq-item">
                <summary>${escapeHtml(item.question)}</summary>
                <p>${escapeHtml(item.answer)}</p>
              </details>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderClientToolSection(dashboard) {
  const selected = state.selectedClientTool || "intake";
  const tools = [
    ["intake", "Intake"],
    ["freedom", "Freedom Tool"],
    ["assistant", "Assistant"],
    ["warranty", "Warranty"],
    ["community", "Community"]
  ];
  const content =
    selected === "freedom"
      ? renderFreedomTool(dashboard)
      : selected === "assistant"
      ? renderClientAssistant(dashboard)
      : selected === "warranty"
        ? renderWarrantyTracker(dashboard)
        : selected === "community"
          ? renderCommunityForum()
          : renderRoomIntakeForm(dashboard);

  return `
    <section class="client-tool-section">
      <div class="client-tool-tabs" role="tablist" aria-label="Client tools">
        ${tools
          .map(
            ([id, label]) => `
              <button class="tab ${selected === id ? "active" : ""}" data-action="client-tool" data-tool="${id}" type="button">${label}</button>
            `
          )
          .join("")}
      </div>
      ${content}
    </section>
  `;
}

function renderFreedomTool(dashboard) {
  const entries = state.freedomEntries || [];
  const freedomSummary = summarizeFreedomEntries(entries);

  return `
    <section class="work-panel">
      <div class="section-title">
        <div>
          <h2>Freedom Tool</h2>
          <p>Work the First Circle event, release the Second Circle story, and keep only the evidence of what shifted.</p>
        </div>
        <button class="btn sage" data-action="open-modal" data-modal="freedom-add" type="button">Add entry</button>
      </div>
      ${renderFreedomSummaryStrip(freedomSummary)}
      <div class="compact-card-list freedom-guide">
        <article class="compact-card">
          <div>
            <strong>First Circle</strong>
            <p class="muted">The event itself. Just what happened.</p>
          </div>
        </article>
        <article class="compact-card">
          <div>
            <strong>Second Circle</strong>
            <p class="muted">The story, meaning, or brain chatter attached to what happened.</p>
          </div>
        </article>
        <article class="compact-card">
          <div>
            <strong>Evidence log</strong>
            <p class="muted">After release, keep only what shifted. Do not keep the negative sheet.</p>
          </div>
        </article>
      </div>
      <div class="freedom-list">
        ${entries.length ? entries.map((entry) => renderFreedomEntry(entry, dashboard)).join("") : `<div class="empty-state">No Freedom Tool entries yet</div>`}
      </div>
    </section>
  `;
}

function summarizeFreedomEntries(entries = []) {
  const list = Array.isArray(entries) ? entries : [];
  const shiftScores = list.map((entry) => freedomShiftScore(entry)).filter((value) => value != null);

  return {
    total_entries: list.length,
    released_count: list.filter((entry) => entry.status !== "draft").length,
    evidence_count: list.filter((entry) => entry.what_shifted).length,
    average_shift_score: shiftScores.length
      ? Math.round((shiftScores.reduce((sum, value) => sum + value, 0) / shiftScores.length) * 10) / 10
      : 0
  };
}

function renderFreedomSummaryStrip(summary = {}, className = "") {
  const values = [
    ["Entries", summary.total_entries || 0],
    ["Released", summary.released_count || 0],
    ["Evidence logs", summary.evidence_count || 0],
    ["Avg shift", summary.average_shift_score || 0]
  ];

  return `
    <div class="${`summary-strip ${className}`.trim()}">
      ${values
        .map(
          ([label, value]) => `
            <div class="summary-chip">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderFreedomEntry(entry, dashboard) {
  const room = dashboard.roomCards.find((candidate) => candidate.id === entry.room_id);
  const shiftScore = freedomShiftScore(entry);
  return `
    <article class="freedom-entry">
      <div>
        <strong>${escapeHtml(entry.subject)}</strong>
        <p class="muted">${escapeHtml(room?.room_name || "No room linked")} / ${escapeHtml(capitalize(entry.status))} / ${escapeHtml(entry.support_path || "Self-guided Freedom Tool")}</p>
        ${entry.first_circle_event ? `<p><strong>First Circle:</strong> ${escapeHtml(entry.first_circle_event)}</p>` : ""}
        ${entry.status === "draft" && entry.second_circle_item_count ? `<p class="muted protected-note">${entry.second_circle_item_count} Second Circle note${entry.second_circle_item_count === 1 ? "" : "s"} currently held in draft.</p>` : ""}
        ${entry.what_shifted ? `<p><strong>What shifted:</strong> ${escapeHtml(entry.what_shifted)}</p>` : ""}
        ${entry.next_action ? `<p><strong>Next:</strong> ${escapeHtml(entry.next_action)}</p>` : ""}
      </div>
      <div class="assistant-meta">
        <span class="pill blue">Before ${escapeHtml(entry.intensity_before || "-")}/10</span>
        ${entry.intensity_after ? `<span class="pill sage">After ${escapeHtml(entry.intensity_after)}/10</span>` : ""}
        ${shiftScore != null ? `<span class="pill gold">Shift ${escapeHtml(shiftScore)}</span>` : ""}
        ${entry.released_at ? `<span class="pill">${escapeHtml(formatDate(entry.released_at))}</span>` : ""}
        <button class="btn small secondary" data-action="freedom-edit" data-freedom-id="${entry.id}" type="button">Edit</button>
        <button class="btn small danger" data-action="freedom-delete" data-freedom-id="${entry.id}" type="button">Delete</button>
      </div>
    </article>
  `;
}

function freedomShiftScore(entry) {
  const before = Number(entry?.intensity_before);
  const afterValue = entry?.intensity_after;
  if (afterValue === "" || afterValue == null) return null;
  const after = Number(afterValue);
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  return Math.max(0, before - after);
}

function renderClientAssistant(dashboard) {
  const items = state.assistantItems || [];
  const clientId = dashboard.clientProfile?.id || dashboard.id;
  return `
    <section class="work-panel">
      <div class="section-title">
        <div>
          <h2>Client assistant</h2>
          <p>Notes, routines, tasks, appointments, reminders, and calendar sync.</p>
        </div>
        <div class="button-row">
          <button class="btn sage" data-action="open-modal" data-modal="assistant-add" type="button">Add item</button>
          <a class="btn small ghost" href="/api/assistant/client/${clientId}/calendar.ics" download="room-energy-calendar.ics">Calendar feed</a>
        </div>
      </div>
      ${renderAssistantCalendar(items, state.warranties || [])}
      <div class="assistant-list">
        ${items.length ? items.map(renderAssistantItem).join("") : `<div class="empty-state">No assistant items yet</div>`}
      </div>
    </section>
  `;
}

function renderAssistantItem(item) {
  const isAppointment = item.type === "appointment";
  const displayDate = isAppointment ? item.due_date || item.appointment_at : item.due_date;
  const reminderRecipients = Array.isArray(item.reminder_emails) ? item.reminder_emails.length : 0;
  return `
    <article class="assistant-item">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p class="muted">${escapeHtml(state.bootstrap.assistantItemLabels?.[item.type] || item.type)} / ${escapeHtml(item.status)}</p>
        ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}
      </div>
      <div class="assistant-meta">
        ${item.reminder_at ? `<span class="pill gold">Reminder ${formatDateTime(item.reminder_at)}</span>` : ""}
        ${reminderRecipients ? `<span class="pill">${reminderRecipients} email${reminderRecipients === 1 ? "" : "s"}</span>` : ""}
        ${displayDate ? `<span class="pill ${isAppointment ? "blue" : ""}">${isAppointment ? "Appointment" : "Due"} ${formatDate(displayDate)}</span>` : ""}
        ${item.calendar_sync_enabled ? `<a class="btn small ghost" href="/api/assistant/items/${item.id}/calendar.ics" download="${escapeHtml(item.title)}.ics">Calendar</a>` : ""}
        <button class="btn small secondary" data-action="assistant-edit" data-item-id="${item.id}" type="button">Edit</button>
        <button class="btn small danger" data-action="assistant-delete" data-item-id="${item.id}" type="button">Delete</button>
      </div>
    </article>
  `;
}

function renderAssistantEditForm(item) {
  return `
    <form class="assistant-form modal-form" data-form="assistant-edit">
      <input type="hidden" name="id" value="${escapeHtml(item.id)}" />
      ${renderAssistantFormFields(item)}
      <div class="button-row full">
        <button class="btn sage" type="submit" ${state.busy ? "disabled" : ""}>Update item</button>
        <button class="btn ghost" data-action="close-modal" type="button">Cancel</button>
      </div>
    </form>
  `;
}

function renderAssistantCreateForm() {
  return `
    <form class="assistant-form modal-form" data-form="assistant-item">
      ${renderAssistantFormFields()}
      <div class="button-row full">
        <button class="btn sage" type="submit" ${state.busy ? "disabled" : ""}>Save assistant item</button>
        <button class="btn ghost" data-action="close-modal" type="button">Cancel</button>
      </div>
    </form>
  `;
}

function renderAssistantFormFields(item = {}) {
  return `
    <label>Type
      <select name="type">${(state.bootstrap.assistantItemTypes || [])
        .map(
          (type) =>
            `<option value="${escapeHtml(type)}" ${item.type === type ? "selected" : ""}>${escapeHtml(state.bootstrap.assistantItemLabels?.[type] || type)}</option>`
        )
        .join("")}</select>
    </label>
    <label>Title <input name="title" value="${escapeHtml(item.title || "")}" placeholder="Weekly pantry reset" required /></label>
    <label>Status
      <select name="status">
        ${["open", "scheduled", "complete"]
          .map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${capitalize(status)}</option>`)
          .join("")}
      </select>
    </label>
    <label>Due date <input name="due_date" type="date" value="${escapeHtml(inputDate(item.due_date || item.appointment_at))}" /></label>
    <label>Reminder <input name="reminder_at" type="datetime-local" value="${escapeHtml(inputDateTime(item.reminder_at))}" /></label>
    <label class="full">Reminder emails
      <input name="reminder_emails" value="${escapeHtml(reminderEmailsValue(item.reminder_emails, getActiveClientEmail()))}" placeholder="client@example.com, partner@example.com" />
      <span class="field-hint">Add one or more email addresses if this item should send a reminder at the scheduled date and time.</span>
    </label>
    <label>Recurrence <input name="recurrence" value="${escapeHtml(item.recurrence || "")}" placeholder="daily, weekly, monthly" /></label>
    <label class="checkbox-label"><input name="calendar_sync_enabled" type="checkbox" ${item.calendar_sync_enabled !== false ? "checked" : ""} /> Calendar sync</label>
    <label class="full">Notes <textarea name="notes" placeholder="Track routines, prep notes, appointment details, or reminders.">${escapeHtml(item.notes || "")}</textarea></label>
  `;
}

function renderAssistantCalendar(items, warranties) {
  const view = state.assistantCalendarView || "month";
  const anchor = parseCalendarDate(state.assistantCalendarDate) || new Date();
  const events = buildCalendarEvents(items, warranties);
  const views = ["day", "week", "month", "year"];

  return `
    <div class="calendar-panel">
      <div class="calendar-toolbar">
        <div>
          <h3>${escapeHtml(calendarPeriodLabel(anchor, view))}</h3>
          <p class="muted">Assistant items and warranty reminders by date.</p>
        </div>
        <div class="calendar-actions">
          <div class="segmented-control" role="tablist" aria-label="Calendar view">
            ${views
              .map(
                (item) => `
                  <button class="tab ${view === item ? "active" : ""}" data-action="assistant-calendar-view" data-view="${item}" type="button">${capitalize(item)}</button>
                `
              )
              .join("")}
          </div>
          <div class="button-row">
            <button class="btn small ghost" data-action="assistant-calendar-prev" type="button">Prev</button>
            <button class="btn small secondary" data-action="assistant-calendar-today" type="button">Today</button>
            <button class="btn small ghost" data-action="assistant-calendar-next" type="button">Next</button>
          </div>
        </div>
      </div>
      ${renderCalendarBody(anchor, view, events)}
    </div>
  `;
}

function renderCalendarBody(anchor, view, events) {
  if (view === "day") return renderCalendarDay(anchor, events);
  if (view === "week") return renderCalendarWeek(anchor, events);
  if (view === "year") return renderCalendarYear(anchor, events);
  return renderCalendarMonth(anchor, events);
}

function renderCalendarDay(anchor, events) {
  const dayEvents = eventsForDate(events, anchor);
  return `
    <div class="calendar-day-list" data-calendar-date="${formatIsoDate(anchor)}">
      ${dayEvents.length ? dayEvents.map(renderCalendarListEvent).join("") : `<div class="empty-state small-empty">No items for this day</div>`}
    </div>
  `;
}

function renderCalendarWeek(anchor, events) {
  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, index) => addDaysToDate(start, index));
  return `
    <div class="calendar-grid week-grid">
      ${days.map((day) => renderCalendarCell(day, eventsForDate(events, day), true)).join("")}
    </div>
  `;
}

function renderCalendarMonth(anchor, events) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const end = endOfWeek(last);
  const days = [];
  for (let day = start; day <= end; day = addDaysToDate(day, 1)) {
    days.push(new Date(day));
  }

  return `
    <div class="calendar-weekdays">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<span>${day}</span>`).join("")}</div>
    <div class="calendar-grid month-grid">
      ${days
        .map((day) => renderCalendarCell(day, eventsForDate(events, day), day.getMonth() === anchor.getMonth()))
        .join("")}
    </div>
  `;
}

function renderCalendarYear(anchor, events) {
  return `
    <div class="year-grid">
      ${Array.from({ length: 12 }, (_, month) => {
        const monthDate = new Date(anchor.getFullYear(), month, 1);
        const monthEvents = events.filter((event) => event.date.getFullYear() === anchor.getFullYear() && event.date.getMonth() === month);
        return `
          <div class="month-card" data-calendar-date="${formatIsoDate(monthDate)}">
            <strong>${monthDate.toLocaleDateString(undefined, { month: "long" })}</strong>
            <span class="muted">${monthEvents.length} item${monthEvents.length === 1 ? "" : "s"}</span>
            <div>${monthEvents.slice(0, 4).map((event) => renderCalendarEventPill(event)).join("")}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderCalendarCell(day, events, inPeriod) {
  const isToday = sameDay(day, new Date());
  return `
    <div class="calendar-cell ${inPeriod ? "" : "outside"} ${isToday ? "today" : ""}" data-calendar-date="${formatIsoDate(day)}">
      <div class="calendar-date">${day.getDate()}</div>
      <div class="calendar-events">${events.slice(0, 4).map((event) => renderCalendarEventPill(event)).join("")}</div>
      ${events.length > 4 ? `<span class="muted calendar-more">+${events.length - 4} more</span>` : ""}
    </div>
  `;
}

function renderCalendarEventPill(event) {
  return `
    <button
      class="calendar-event ${event.source}"
      data-action="calendar-event-edit"
      data-calendar-event="true"
      data-source="${escapeHtml(event.source)}"
      data-id="${escapeHtml(event.recordId)}"
      data-kind="${escapeHtml(event.kind)}"
      draggable="true"
      type="button"
    >${escapeHtml(event.label)}: ${escapeHtml(event.title)}</button>
  `;
}

function renderCalendarListEvent(event) {
  return `
    <article
      class="calendar-list-event"
      data-action="calendar-event-edit"
      data-calendar-event="true"
      data-source="${escapeHtml(event.source)}"
      data-id="${escapeHtml(event.recordId)}"
      data-kind="${escapeHtml(event.kind)}"
      draggable="true"
    >
      <span class="pill ${event.source === "warranty" ? "gold" : "blue"}">${escapeHtml(event.label)}</span>
      <div>
        <strong>${escapeHtml(event.title)}</strong>
        <p class="muted">${escapeHtml(formatDateTime(event.date))}</p>
      </div>
      <span class="btn small secondary">Edit</span>
    </article>
  `;
}

function buildCalendarEvents(items, warranties) {
  const assistantEvents = (items || [])
    .map((item) => {
      const isAppointment = item.type === "appointment";
      const value = isAppointment ? item.due_date || item.appointment_at || item.reminder_at : item.due_date || item.reminder_at;
      const date = value ? parseCalendarDate(value) : null;
      if (!date) return null;
      return {
        id: item.id,
        recordId: item.id,
        source: "assistant",
        title: item.title,
        label: isAppointment ? "Appointment" : item.due_date ? "Due" : "Reminder",
        kind: item.due_date || isAppointment ? "due" : "reminder",
        date
      };
    })
    .filter(Boolean);

  const warrantyEvents = (warranties || []).flatMap((warranty) => {
    const events = [];
    if (warranty.reminder_at) {
      events.push({
        id: `${warranty.id}-reminder`,
        recordId: warranty.id,
        source: "warranty",
        title: warranty.item_name,
        label: "Warranty reminder",
        kind: "warranty-reminder",
        date: parseCalendarDate(warranty.reminder_at)
      });
    }
    if (warranty.expires_at) {
      events.push({
        id: `${warranty.id}-expires`,
        recordId: warranty.id,
        source: "warranty",
        title: warranty.item_name,
        label: "Warranty expires",
        kind: "warranty-expires",
        date: parseCalendarDate(warranty.expires_at)
      });
    }
    return events.filter((event) => event.date);
  });

  return [...assistantEvents, ...warrantyEvents].sort((a, b) => a.date - b.date);
}

function renderWarrantyTracker(dashboard) {
  const query = state.warrantySearch.toLowerCase();
  const warranties = (state.warranties || []).filter((warranty) => warrantySearchText(warranty).includes(query));
  return `
    <section class="work-panel">
      <div class="section-title">
        <div>
          <h2>Warranty tracker</h2>
          <p>Upload warranty records, track coverage dates, and find documents quickly.</p>
        </div>
        <button class="btn clay" data-action="open-modal" data-modal="warranty-add" type="button">Add warranty</button>
      </div>
      <label>Search warranties <input data-action="warranty-search" value="${escapeHtml(state.warrantySearch)}" placeholder="Appliance, provider, policy, category" /></label>
      <div class="warranty-list">
        ${warranties.length ? warranties.map(renderWarrantyItem).join("") : `<div class="empty-state">No matching warranties</div>`}
      </div>
    </section>
  `;
}

function renderWarrantyItem(warranty) {
  const reminderRecipients = Array.isArray(warranty.reminder_emails) ? warranty.reminder_emails.length : 0;
  const timezone = warranty.reminder_timezone || getActiveClientTimezone();
  return `
    <article class="warranty-item">
      <div>
        <strong>${escapeHtml(warranty.item_name)}</strong>
        <p class="muted">${escapeHtml(warranty.category || "Uncategorized")} / ${escapeHtml(warranty.provider || "No provider")}</p>
        <p>${escapeHtml(warranty.notes || "")}</p>
      </div>
      <div class="assistant-meta">
        <span class="pill ${warranty.status === "expired" ? "clay" : "sage"}">${escapeHtml(warranty.status)}</span>
        ${warranty.expires_at ? `<span class="pill">Expires ${formatDate(warranty.expires_at)}</span>` : ""}
        ${warranty.reminder_at ? `<span class="pill gold">Reminder ${formatDate(warranty.reminder_at)} / 9:00 AM ${escapeHtml(timezone)}</span>` : ""}
        ${reminderRecipients ? `<span class="pill">${reminderRecipients} email${reminderRecipients === 1 ? "" : "s"}</span>` : ""}
        ${warranty.document_data_url ? `<a class="btn small ghost" href="${warranty.document_data_url}" download="${escapeHtml(warranty.document_name || warranty.item_name)}">Open file</a>` : ""}
        <button class="btn small secondary" data-action="warranty-edit" data-warranty-id="${warranty.id}" type="button">Edit</button>
        <button class="btn small danger" data-action="warranty-delete" data-warranty-id="${warranty.id}" type="button">Delete</button>
      </div>
    </article>
  `;
}

function renderWarrantyEditForm(warranty) {
  return `
    <form class="warranty-form modal-form" data-form="warranty-edit">
      <input type="hidden" name="id" value="${escapeHtml(warranty.id)}" />
      ${renderWarrantyFormFields(warranty)}
      <div class="button-row full">
        <button class="btn clay" type="submit" ${state.busy ? "disabled" : ""}>Update warranty</button>
        <button class="btn ghost" data-action="close-modal" type="button">Cancel</button>
      </div>
    </form>
  `;
}

function renderWarrantyCreateForm() {
  return `
    <form class="warranty-form modal-form" data-form="warranty">
      ${renderWarrantyFormFields()}
      <div class="button-row full">
        <button class="btn clay" type="submit" ${state.busy ? "disabled" : ""}>Save warranty</button>
        <button class="btn ghost" data-action="close-modal" type="button">Cancel</button>
      </div>
    </form>
  `;
}

function renderWarrantyFormFields(warranty = {}) {
  return `
    <label>Item <input name="item_name" value="${escapeHtml(warranty.item_name || "")}" placeholder="Dishwasher" required /></label>
    <label>Category
      <select name="category">
        <option value="">Select category</option>
        ${(state.bootstrap.warrantyCategories || [])
          .map((category) => `<option value="${escapeHtml(category)}" ${warranty.category === category ? "selected" : ""}>${escapeHtml(category)}</option>`)
          .join("")}
      </select>
    </label>
    <label>Provider <input name="provider" value="${escapeHtml(warranty.provider || "")}" placeholder="Warranty provider" /></label>
    <label>Policy # <input name="policy_number" value="${escapeHtml(warranty.policy_number || "")}" /></label>
    <label>Purchase date <input name="purchase_date" type="date" value="${escapeHtml(inputDate(warranty.purchase_date))}" /></label>
    <label>Active from <input name="active_from" type="date" value="${escapeHtml(inputDate(warranty.active_from))}" /></label>
    <label>Expires <input name="expires_at" type="date" value="${escapeHtml(inputDate(warranty.expires_at))}" /></label>
    <label>Reminder <input name="reminder_at" type="date" value="${escapeHtml(inputDate(warranty.reminder_at))}" /></label>
    <label class="full">Reminder emails
      <input name="reminder_emails" value="${escapeHtml(reminderEmailsValue(warranty.reminder_emails, getActiveClientEmail()))}" placeholder="client@example.com, family@example.com" />
      <span class="field-hint">Warranty reminders send at 9:00 AM in the client's timezone.</span>
    </label>
    <label>Status
      <select name="status">
        ${["active", "upcoming", "expired"]
          .map((status) => `<option value="${status}" ${(warranty.status || "active") === status ? "selected" : ""}>${capitalize(status)}</option>`)
          .join("")}
      </select>
    </label>
    <label class="full">Warranty document <input name="document" type="file" accept=".pdf,image/*" /></label>
    <label class="full">Notes <textarea name="notes" placeholder="Renewal notes, coverage details, claim numbers.">${escapeHtml(warranty.notes || "")}</textarea></label>
  `;
}

function renderFreedomCreateForm(dashboard) {
  return `
    <form class="freedom-form modal-form" data-form="freedom-entry">
      ${renderFreedomFormFields({}, dashboard)}
      <div class="button-row full">
        <button class="btn sage" type="submit" ${state.busy ? "disabled" : ""}>Save Freedom Tool entry</button>
        <button class="btn ghost" data-action="close-modal" type="button">Cancel</button>
      </div>
    </form>
  `;
}

function renderFreedomEditForm(entry, dashboard) {
  return `
    <form class="freedom-form modal-form" data-form="freedom-edit">
      <input type="hidden" name="id" value="${escapeHtml(entry.id)}" />
      ${renderFreedomFormFields(entry, dashboard)}
      <div class="button-row full">
        <button class="btn sage" type="submit" ${state.busy ? "disabled" : ""}>Update entry</button>
        <button class="btn ghost" data-action="close-modal" type="button">Cancel</button>
      </div>
    </form>
  `;
}

function renderFreedomFormFields(entry = {}, dashboard) {
  return `
    <label>Linked room
      <select name="room_id">
        <option value="">No room selected</option>
        ${(dashboard?.roomCards || [])
          .map(
            (room) =>
              `<option value="${escapeHtml(room.id)}" ${entry.room_id === room.id ? "selected" : ""}>${escapeHtml(room.room_name)}</option>`
          )
          .join("")}
      </select>
    </label>
    <label>Subject <input name="subject" value="${escapeHtml(entry.subject || "")}" placeholder="Bedroom laundry pile" required /></label>
    <label>Status
      <select name="status">
        ${(state.bootstrap.freedomToolStatuses || [])
          .map(
            (status) =>
              `<option value="${escapeHtml(status)}" ${(entry.status || "draft") === status ? "selected" : ""}>${escapeHtml(capitalize(status))}</option>`
          )
          .join("")}
      </select>
    </label>
    <label>Support path
      <select name="support_path">
        ${(state.bootstrap.freedomSupportPaths || [])
          .map(
            (path) =>
              `<option value="${escapeHtml(path)}" ${(entry.support_path || "Self-guided Freedom Tool") === path ? "selected" : ""}>${escapeHtml(path)}</option>`
          )
          .join("")}
      </select>
    </label>
    <label>First Circle event <input name="first_circle_event" value="${escapeHtml(entry.first_circle_event || "")}" placeholder="The laundry keeps landing in the bedroom." /></label>
    <label>Intensity before <input name="intensity_before" type="number" min="1" max="10" value="${escapeHtml(entry.intensity_before || 6)}" required /></label>
    <label>Intensity after <input name="intensity_after" type="number" min="1" max="10" value="${escapeHtml(entry.intensity_after || "")}" placeholder="Optional until release is complete" /></label>
    <label>Next action <input name="next_action" value="${escapeHtml(entry.next_action || "")}" placeholder="Log evidence after release" /></label>
    <label class="full">Second Circle notes
      <textarea name="second_circle_items" placeholder="Write every complaint, judgment, or story attached to the subject. These notes should be destroyed on release.">${escapeHtml(entry.second_circle_items || "")}</textarea>
    </label>
    <label class="full">What shifted
      <textarea name="what_shifted" placeholder="After release, note only what changed in the room, your body, your decisions, or the relationship.">${escapeHtml(entry.what_shifted || "")}</textarea>
    </label>
    <label class="checkbox-label full"><input name="destroy_second_circle" type="checkbox" /> Clear Second Circle notes on save</label>
    <p class="muted full">Released and evidence-logged entries automatically discard the Second Circle notes and keep only the evidence log.</p>
  `;
}

function renderCommunityForum() {
  const posts = state.communityPosts || [];
  return `
    <section class="work-panel">
      <div class="section-title">
        <div>
          <h2>Community forum</h2>
          <p>Share room photos, ask questions, comment, and rate ideas from other clients.</p>
        </div>
      </div>
      <form class="community-post-form" data-form="community-post">
        <label>Question or topic <input name="title" placeholder="How are you handling pantry overflow?" required /></label>
        <label class="full">Post <textarea name="body" placeholder="Share a win, ask a question, or describe what you tried." required></textarea></label>
        <label>Photo <input name="photo" type="file" accept="image/*" /></label>
        <button class="btn sage" type="submit" ${state.busy ? "disabled" : ""}>Share post</button>
      </form>
      <div class="community-list">
        ${posts.length ? posts.map(renderCommunityPost).join("") : `<div class="empty-state">No community posts yet</div>`}
      </div>
    </section>
  `;
}

function renderCommunityPost(post) {
  return `
    <article class="community-post">
      <div class="community-post-head">
        <div>
          <h3>${escapeHtml(post.title)}</h3>
          <p class="muted">
            ${escapeHtml(post.author?.name || "Client")}
            ${renderAuthorRating(post.author_rating)}
            / ${formatDate(post.created_at)}
          </p>
        </div>
        <span class="pill gold">${post.rating_average || 0} avg / ${post.rating_count || 0}</span>
      </div>
      ${post.photo_url ? `<img class="community-photo" src="${post.photo_url}" alt="${escapeHtml(post.title)}" />` : ""}
      <p>${escapeHtml(post.body)}</p>
      <div class="rating-row" aria-label="Rate post">
        <span class="rating-label">Rate post</span>
        ${[1, 2, 3, 4, 5]
          .map(
            (rating) =>
              `<button class="rating-button" data-action="community-rate" data-post-id="${post.id}" data-rating="${rating}" type="button">${rating}</button>`
          )
          .join("")}
      </div>
      <div class="comment-list">
        ${(post.comments || []).map(renderCommunityComment).join("")}
      </div>
      <form class="comment-form" data-form="community-comment">
        <input type="hidden" name="post_id" value="${escapeHtml(post.id)}" />
        <label>Comment <input name="body" placeholder="Add a comment or answer" required /></label>
        <button class="btn small secondary" type="submit" ${state.busy ? "disabled" : ""}>Comment</button>
      </form>
    </article>
  `;
}

function renderCommunityComment(comment) {
  return `
    <div class="community-comment">
      <strong>${escapeHtml(comment.author?.name || "Client")} ${renderAuthorRating(comment.author_rating)}</strong>
      <span>${escapeHtml(comment.body)}</span>
    </div>
  `;
}

function renderAuthorRating(summary) {
  if (!summary?.count) return `<span class="author-rating">No ratings yet</span>`;
  return `<span class="author-rating">${summary.average} client avg</span>`;
}

function renderActiveModal(dashboard) {
  if (!state.activeModal) return "";
  const modal = state.activeModal;
  let title = "";
  let content = "";

  if (modal.type === "intake") {
    title = "Add room intake";
    content = renderRoomIntakeModalForm(dashboard);
  }

  if (modal.type === "assistant-add") {
    title = "Add assistant item";
    content = renderAssistantCreateForm();
  }

  if (modal.type === "assistant-edit") {
    const item = state.assistantItems.find((candidate) => candidate.id === modal.id);
    title = "Edit assistant item";
    content = item ? renderAssistantEditForm(item) : `<div class="empty-state">Assistant item not found</div>`;
  }

  if (modal.type === "warranty-add") {
    title = "Add warranty";
    content = renderWarrantyCreateForm();
  }

  if (modal.type === "warranty-edit") {
    const warranty = state.warranties.find((candidate) => candidate.id === modal.id);
    title = "Edit warranty";
    content = warranty ? renderWarrantyEditForm(warranty) : `<div class="empty-state">Warranty not found</div>`;
  }

  if (modal.type === "freedom-add") {
    title = "Add Freedom Tool entry";
    content = renderFreedomCreateForm(dashboard);
  }

  if (modal.type === "freedom-edit") {
    const entry = state.freedomEntries.find((candidate) => candidate.id === modal.id);
    title = "Edit Freedom Tool entry";
    content = entry ? renderFreedomEditForm(entry, dashboard) : `<div class="empty-state">Freedom Tool entry not found</div>`;
  }

  if (modal.type === "admin-client-profile") {
    const client = state.admin?.clients?.find((candidate) => candidate.id === modal.id) || getSelectedAdminClient();
    title = "Edit client profile";
    content = client ? renderAdminClientProfileForm(client) : `<div class="empty-state">Client not found</div>`;
  }

  if (modal.type === "admin-room-add") {
    title = "Add room for client";
    content = renderRoomIntakeModalForm(dashboard, { adminMode: true, formName: "admin-room-add" });
  }

  if (modal.type === "admin-room-edit") {
    const room = state.roomDetails[modal.id];
    title = "Edit room intake";
    content = room
      ? renderRoomIntakeModalForm(dashboard, {
          adminMode: true,
          formName: "admin-room-edit",
          room,
          beforeEntry: room.emotions?.find((entry) => entry.entry_type === "before") || null
        })
      : `<div class="empty-state">Room details not loaded</div>`;
  }

  if (modal.type === "ghl-sync" && state.session?.user.role !== "client") {
    title = "GHL sync";
    content = renderGhlSyncModal(getCurrentGhlSyncContext());
  }

  return `
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal-panel">
        <div class="section-title">
          <h3>${escapeHtml(title)}</h3>
          <button class="btn small ghost" data-action="close-modal" type="button">Close</button>
        </div>
        ${content}
      </div>
    </div>
  `;
}

function renderAdminApp() {
  const admin = state.admin;
  if (!admin) return renderShell("Emily dashboard", "<div class='page'><div class='empty-state'>Loading admin dashboard</div></div>");
  const selectedClient = getSelectedAdminClient();

  return renderShell(
    "Emily dashboard",
    `
      <main class="page">
        ${renderAdminOverview(admin.overview)}
        ${renderAdminClientExplorer(admin)}
        ${selectedClient ? renderAdminClientWorkspace(selectedClient) : ""}
        <section class="admin-grid">
          <div class="admin-panel">
            <div class="section-title">
              <div>
                <h2>Review queue</h2>
                <p>${admin.reviewQueue.length} open review${admin.reviewQueue.length === 1 ? "" : "s"}</p>
              </div>
            </div>
            <div class="queue-list">
              ${admin.reviewQueue.length ? admin.reviewQueue.map(renderQueueItem).join("") : `<div class="empty-state">No open reviews</div>`}
            </div>
          </div>
          <aside class="stack">
            <section class="admin-panel">
              <div class="section-title"><h3>Clients</h3></div>
              <div class="client-list">${admin.clients.map(renderClientRow).join("")}</div>
            </section>
            <section class="admin-panel">
              <div class="section-title"><h3>Email delivery logs</h3></div>
              ${admin.emailLogs?.length ? admin.emailLogs.map(renderEmailLogRow).join("") : `<div class="empty-state">No recommendation emails sent yet</div>`}
            </section>
            <section class="admin-panel">
              <div class="section-title"><h3>BTBV service tracks</h3></div>
              <div class="support-track-list">${renderSupportTrackSummaryCards().join("")}</div>
            </section>
            <section class="admin-panel">
              <div class="section-title"><h3>Coverage and add-ons</h3></div>
              <div class="service-chip-list">${(admin.competitorServiceOpportunities || [])
                .map((item) => `<span class="pill">${escapeHtml(item)}</span>`)
                .join("")}</div>
            </section>
          </aside>
        </section>
        ${renderGhlSyncFooter(getCurrentGhlSyncContext(), { panelClass: "admin-panel admin-bottom-panel" })}
        ${renderActiveModal(selectedClient || { summary: { rooms_open: 0 }, permissions: { activeRoomLimit: 999 }, roomCards: [] })}
      </main>
    `
  );
}

function renderAdminOverview(overview = {}) {
  const items = [
    ["Active clients", overview.active_clients || 0],
    ["Avg home score", `${overview.average_home_transformation_score || 0}%`],
    ["Avg overall score", `${overview.average_overall_score || 0}%`],
    ["Avg workbook priority", `${overview.average_workbook_priority_score || 0}%`],
    ["Rooms with support tracks", overview.rooms_with_support_tracks || 0],
    ["Vision-reviewed rooms", overview.rooms_with_vision_review || 0],
    ["Freedom entries", overview.freedom_entries || 0],
    ["Freedom released", overview.freedom_released || 0],
    ["Evidence logs", overview.freedom_evidence_logs || 0],
    ["Avg freedom shift", overview.average_freedom_shift_score || 0],
    ["Rooms completed", overview.rooms_completed || 0],
    ["Rooms open", overview.rooms_open || 0],
    ["Needs attention", overview.rooms_needing_attention || 0],
    ["Open reviews", overview.review_queue_count || 0],
    ["Nurture rooms", overview.nurture_rooms || 0]
  ];

  return `
    <section class="admin-overview">
      <div class="section-title">
        <div>
          <h2>Client overview</h2>
          <p>${overview.total_clients || 0} total client${overview.total_clients === 1 ? "" : "s"} across current transformation work.</p>
        </div>
      </div>
      <div class="overview-grid">
        ${items
          .map(
            ([label, value]) => `
              <div class="overview-tile">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderAdminClientExplorer(admin) {
  const query = state.adminClientSearch.toLowerCase();
  const activeClients = (admin.clients || []).filter((client) => client.membership_status === "active");
  const filtered = activeClients.filter((client) =>
    [client.user?.name, client.user?.email, client.membership_level, client.ghl_pipeline_stage]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
  const selected =
    filtered.find((client) => client.id === state.selectedAdminClientId) ||
    filtered[0];
  if (selected && selected.id !== state.selectedAdminClientId) state.selectedAdminClientId = selected.id;

  return `
    <section class="admin-panel admin-client-explorer">
      <div class="section-title">
        <div>
          <h2>Active client status</h2>
          <p>Search and select a client to review current progress, next action, rooms, and membership access.</p>
        </div>
      </div>
      <div class="admin-client-controls">
        <label>Search clients <input data-action="admin-client-search" value="${escapeHtml(state.adminClientSearch)}" placeholder="Name, email, tier, pipeline" /></label>
        <label>Select client
          <select data-action="admin-client-select">
            ${filtered
              .map(
                (client) =>
                  `<option value="${escapeHtml(client.id)}" ${selected?.id === client.id ? "selected" : ""}>${escapeHtml(client.user.name)} - ${escapeHtml(client.membership_level)}</option>`
              )
              .join("")}
          </select>
        </label>
      </div>
      ${selected ? renderAdminSelectedClient(selected) : `<div class="empty-state">No active clients match that search</div>`}
    </section>
  `;
}

function renderAdminSelectedClient(client) {
  return `
    <div class="selected-client-grid">
      <div class="client-status-panel">
        <div class="section-title">
          <div>
            <h3>${escapeHtml(client.user.name)}</h3>
        <p>${escapeHtml(client.user.email)} / ${escapeHtml(client.membership_level)} / ${escapeHtml(client.ghl_pipeline_stage || "No pipeline stage")}</p>
          </div>
          <span class="pill blue">${client.summary.home_transformation_score}% home score</span>
        </div>
        <p>${escapeHtml(client.valueSummary || "")}</p>
        <div class="room-metrics admin-room-metrics">
          <div class="mini-metric"><span>Open rooms</span><strong>${client.summary.rooms_open}</strong></div>
          <div class="mini-metric"><span>Needs attention</span><strong>${client.summary.rooms_needing_attention}</strong></div>
          <div class="mini-metric"><span>Workbook priority</span><strong>${client.summary.average_workbook_priority_score || 0}%</strong></div>
          <div class="mini-metric"><span>Support tracks</span><strong>${client.summary.rooms_with_support_tracks || 0}</strong></div>
          <div class="mini-metric"><span>Next action</span><strong>${escapeHtml(client.summary.next_best_action)}</strong></div>
        </div>
        <form class="stack" data-form="admin-client-notes">
          <input type="hidden" name="client_id" value="${escapeHtml(client.id)}" />
          <label>Internal notes
            <textarea name="internal_notes" placeholder="Admin-only client notes, staffing context, service updates, or risks.">${escapeHtml(client.internal_notes || "")}</textarea>
          </label>
          <div class="button-row">
            <button class="btn small secondary" type="submit" ${state.busy ? "disabled" : ""}>Save notes</button>
            <button class="btn small ghost" data-action="admin-edit-client" data-client-id="${client.id}" type="button">Edit client profile</button>
          </div>
        </form>
        <div class="freedom-summary-panel">
          <div class="section-title">
            <div>
              <h4>Freedom Tool progress</h4>
              <p>Release work, evidence logging, and latest emotional subject.</p>
            </div>
          </div>
          ${client.freedomTool?.last_subject ? `<p class="muted"><strong>Latest subject:</strong> ${escapeHtml(client.freedomTool.last_subject)}</p>` : `<p class="muted">No Freedom Tool entries logged yet.</p>`}
          ${renderFreedomSummaryStrip(client.freedomTool || {}, "admin-summary-strip")}
        </div>
      </div>
      <div class="client-room-status-list">
        ${(client.roomCards || []).map(renderAdminClientRoomStatus).join("")}
      </div>
    </div>
  `;
}

function renderAdminClientWorkspace(client) {
  const selected = state.selectedClientTool || "intake";
  const tools = [
    ["intake", "Intake"],
    ["freedom", "Freedom Tool"],
    ["assistant", "Assistant"],
    ["warranty", "Warranty"]
  ];
  const content =
    selected === "freedom"
      ? renderFreedomTool(client)
      : selected === "assistant"
      ? renderClientAssistant(client)
      : selected === "warranty"
      ? renderWarrantyTracker(client)
      : renderAdminRoomManager(client);

  return `
    <section class="admin-panel admin-client-workspace">
      <div class="section-title">
        <div>
          <h2>Client workspace</h2>
          <p>Emily and staff can add or update room intake, assistant items, warranty records, and Freedom Tool entries for the selected client.</p>
        </div>
      </div>
      <div class="client-tool-tabs admin-tool-tabs" role="tablist" aria-label="Admin client tools">
        ${tools
          .map(
            ([id, label]) => `
              <button class="tab ${selected === id ? "active" : ""}" data-action="client-tool" data-tool="${id}" type="button">${label}</button>
            `
          )
          .join("")}
      </div>
      ${content}
    </section>
  `;
}

function renderAdminRoomManager(client) {
  return `
    <section class="work-panel">
      <div class="section-title">
        <div>
          <h2>Room intake and planning</h2>
          <p>Client-facing intake plus staff-only planning fields.</p>
        </div>
        <button class="btn clay" data-action="open-modal" data-modal="admin-room-add" type="button">Add room</button>
      </div>
      <div class="compact-card-list">
        ${(client.roomCards || [])
          .map(
            (room) => `
              <article class="compact-card">
                <div>
                  <strong>${escapeHtml(room.room_name)}</strong>
                  <p class="muted">${escapeHtml(room.status)} / ${escapeHtml(room.next_best_action)}</p>
                  ${room.support_track ? `<p class="muted room-track-line">${escapeHtml(room.support_track)}</p>` : ""}
                  ${renderRoomPhotoGallery(buildCardPhotoList(room), { className: "compact-photo-grid", empty: false })}
                </div>
                <div class="button-row">
                  <span class="pill blue">${room.workbook_priority_score || 0}% workbook</span>
                  <button class="btn small secondary" data-action="admin-room-edit" data-room-id="${room.id}" type="button">Edit</button>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderAdminClientProfileForm(client) {
  return `
    <form class="stack" data-form="admin-client-profile">
      <input type="hidden" name="client_id" value="${escapeHtml(client.id)}" />
      <div class="form-grid">
        <label>Name <input name="name" value="${escapeHtml(client.user?.name || "")}" required /></label>
        <label>Email <input name="email" type="email" value="${escapeHtml(client.user?.email || "")}" required /></label>
        <label>Phone <input name="phone" value="${escapeHtml(client.phone || "")}" /></label>
        <label>Timezone <input name="timezone" value="${escapeHtml(client.timezone || "")}" placeholder="America/Phoenix" /></label>
        <label>Membership
          <select name="membership_level">${(state.bootstrap.membershipLevels || [])
            .map((level) => `<option ${client.membership_level === level ? "selected" : ""}>${escapeHtml(level)}</option>`)
            .join("")}</select>
        </label>
        <label>Status
          <select name="membership_status">
            ${["active", "paused", "inactive"]
              .map((status) => `<option value="${status}" ${String(client.membership_status || "active") === status ? "selected" : ""}>${capitalize(status)}</option>`)
              .join("")}
          </select>
        </label>
      </div>
      <label>Address <input name="address" value="${escapeHtml(client.address || "")}" /></label>
      <label>Pipeline stage <input name="ghl_pipeline_stage" value="${escapeHtml(client.ghl_pipeline_stage || "")}" /></label>
      <label>General notes <textarea name="notes" placeholder="Client-facing or CRM notes.">${escapeHtml(client.notes || "")}</textarea></label>
      <label>Internal notes <textarea name="internal_notes" placeholder="Admin-only notes.">${escapeHtml(client.internal_notes || "")}</textarea></label>
      <div class="button-row">
        <button class="btn sage" type="submit" ${state.busy ? "disabled" : ""}>Save client profile</button>
        <button class="btn ghost" data-action="close-modal" type="button">Cancel</button>
      </div>
    </form>
  `;
}

function renderAdminClientRoomStatus(room) {
  return `
    <article class="compact-card">
      <div>
        <strong>${escapeHtml(room.room_name)}</strong>
        <p class="muted">${escapeHtml(room.status)} / ${escapeHtml(room.next_best_action)}</p>
        ${room.support_track ? `<p class="muted room-track-line">${escapeHtml(room.support_track)}</p>` : ""}
        ${renderRoomPhotoGallery(buildCardPhotoList(room), { className: "compact-photo-grid", empty: false })}
      </div>
      <span class="pill ${room.upsell_flag ? "clay" : "sage"}">${room.workbook_priority_score || room.transformation_score}% workbook</span>
    </article>
  `;
}

function renderQueueItem(task) {
  const ai = task.aiRecommendation;
  const draft = ai?.client_message_draft || "";
  const emailDraft = task.emailDraft || { subject: "", body: "" };
  const roomPhotos = task.room?.photos || [];
  const photoReviewReport = ai?.photo_review_report;
  return `
    <article class="queue-item">
      <div class="queue-head">
        <div>
          <h3>${escapeHtml(task.clientUser?.name || "Client")} - ${escapeHtml(task.room?.room_name || "Room")}</h3>
          <p>${escapeHtml(task.clientProfile?.membership_level || "")} / priority ${task.priority_score}</p>
        </div>
        <span class="pill ${task.room?.upsell_flag ? "clay" : "sage"}">${escapeHtml(task.room?.status || "")}</span>
      </div>
      <div class="form-grid">
        <div>
          <strong>Emotional intake</strong>
          <p class="muted">${escapeHtml((task.beforeEntry?.emotions || []).join(", "))}</p>
          <p class="muted">Stress ${task.beforeEntry?.stress_score || "-"} / Clutter ${task.beforeEntry?.clutter_score || "-"} / Energy ${task.beforeEntry?.energy_alignment_score || "-"}</p>
          <p class="muted">Second Circle ${task.beforeEntry?.second_circle_intensity_score || "-"} / Release readiness ${task.beforeEntry?.release_readiness_score || "-"}</p>
        </div>
        <div>
          <strong>AI upsell</strong>
          <p class="muted">${escapeHtml(ai?.upsell_opportunity || "None")}</p>
          ${ai?.support_track ? `<p class="muted"><strong>Support track:</strong> ${escapeHtml(ai.support_track)}</p>` : ""}
          ${ai?.ai_review_method ? `<p class="muted"><strong>Review mode:</strong> ${escapeHtml(ai.ai_review_method)}</p>` : ""}
        </div>
      </div>
      ${renderRoomPhotoPanel("Uploaded photos", roomPhotos, { className: "review-photo-grid" })}
      ${renderPhotoReviewReport(photoReviewReport, { title: "Photo AI review" })}
      <div class="recommendation-box">
        <h4>AI draft</h4>
        <p>${escapeHtml(draft || "No AI draft available.")}</p>
        ${ai?.support_track_reason ? `<h4>Support track fit</h4><p>${escapeHtml(ai.support_track_reason)}</p>` : ""}
        ${ai?.ai_review_summary ? `<h4>AI review summary</h4><p>${escapeHtml(ai.ai_review_summary)}</p>` : ""}
        ${
          ai?.before_photo_narrative
            ? `<h4>Before photo narrative</h4><p>${escapeHtml(ai.before_photo_narrative)}</p>`
            : ""
        }
        ${
          ai?.recommended_layout_changes?.length
            ? `<h4>Recommended layout changes</h4><ul>${ai.recommended_layout_changes
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join("")}</ul>`
            : ""
        }
        ${
          ai?.organizing_recommendations
            ? `<h4>Organizing actions</h4><ul>${ai.organizing_recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
            : ""
        }
      </div>
      <form class="stack" data-form="admin-review">
        <input type="hidden" name="room_id" value="${task.room_id}" />
        <input type="hidden" name="ai_recommendation_id" value="${ai?.id || ""}" />
        <label>Emily notes <textarea name="emily_notes">Start with one visible reset and keep the first session small enough to finish.</textarea></label>
        <label>Final recommendation <textarea name="final_recommendation">${escapeHtml(draft)}</textarea></label>
        <div class="email-draft-box">
          <div class="section-title">
            <div>
              <h3>Email draft</h3>
              <p>This editable narrative is sent when Emily approves.</p>
            </div>
          </div>
          <label>Subject <input name="email_subject" value="${escapeHtml(emailDraft.subject)}" /></label>
          <label>Email body <textarea name="email_body">${escapeHtml(emailDraft.body)}</textarea></label>
        </div>
        <div class="button-row">
          <button class="btn sage" type="submit" ${state.busy ? "disabled" : ""}>Approve and send</button>
          <button class="btn ghost" data-action="move-nurture" data-room-id="${task.room_id}" type="button">Move to nurture</button>
        </div>
      </form>
    </article>
  `;
}

function renderClientRow(client) {
  return `
    <article class="client-row">
      <div>
        <h3>${escapeHtml(client.user.name)}</h3>
        <p class="muted">${escapeHtml(client.membership_level)} / ${escapeHtml(client.ghl_pipeline_stage || "No stage")}</p>
      </div>
      <div class="button-row">
        <span class="pill blue">${client.summary.home_transformation_score}%</span>
        <button class="btn small secondary" data-action="admin-select-client" data-client-id="${client.id}" type="button">View</button>
        <button class="btn small ghost" data-action="sync-contact" data-client-id="${client.id}" type="button">Sync</button>
      </div>
    </article>
  `;
}

function renderLogRow(log) {
  return `
    <div class="log-row">
      <strong>${escapeHtml(log.event_type)} / ${escapeHtml(log.status)}</strong>
      <span class="muted">${escapeHtml(log.created_at)}${log.error_message ? ` / ${escapeHtml(log.error_message)}` : ""}</span>
    </div>
  `;
}

function renderGhlLogsModal(logs) {
  if (!logs.length) return `<div class="empty-state">No sync logs yet</div>`;
  return `<div class="stack">${logs.map(renderLogRow).join("")}</div>`;
}

function getCurrentGhlSyncContext() {
  return {
    adminMode: true,
    status: state.admin?.ghlStatus || null,
    logs: state.admin?.syncLogs || [],
    clientProfile: null,
    fieldMap: state.admin?.ghlFieldMap || state.bootstrap?.ghlFieldMap || []
  };
}

function renderGhlSyncFooter(context, { panelClass = "client-panel ghl-footer-panel" } = {}) {
  const status = context?.status || {};
  const logs = context?.logs || [];
  const label = context?.adminMode ? "Open GHL sync" : "View sync details";
  const description = context?.adminMode
    ? `${logs.length} recent sync log${logs.length === 1 ? "" : "s"} are hidden until opened.`
    : "View this account's sync status, last sync timestamps, and recent sync activity.";

  return `
    <section class="${panelClass}">
      <div class="section-title">
        <div>
          <h3>GHL sync</h3>
          <p>${escapeHtml(description)}</p>
        </div>
        <button class="btn small ghost" data-action="open-modal" data-modal="ghl-sync" type="button">${escapeHtml(label)}</button>
      </div>
      <p class="muted">
        ${status.configured ? "Live GHL credentials loaded." : "GHL is in dry-run mode."}
        ${context?.clientProfile ? ` Last account sync: ${context.clientProfile.last_synced_at ? formatDateTime(context.clientProfile.last_synced_at) : "Not yet run"}.` : ""}
        ${!context?.clientProfile ? ` Last hourly sync: ${status.lastHourlySyncAt ? formatDateTime(status.lastHourlySyncAt) : "Not yet run"}.` : ""}
      </p>
    </section>
  `;
}

function renderGhlSyncModal(context) {
  const status = context?.status || {};
  const logs = context?.logs || [];
  const clientProfile = context?.clientProfile || null;
  const fieldMap = context?.fieldMap || [];

  return `
    <div class="stack">
      <div class="summary-strip">
        <div class="summary-chip">
          <span>Mode</span>
          <strong>${status.configured ? "Live" : "Dry-run"}</strong>
        </div>
        <div class="summary-chip">
          <span>Auto-sync</span>
          <strong>${formatDuration(status.autoSyncIntervalMs || 60 * 60 * 1000)}</strong>
        </div>
        <div class="summary-chip">
          <span>Last hourly</span>
          <strong>${status.lastHourlySyncAt ? formatDateTime(status.lastHourlySyncAt) : "Not yet run"}</strong>
        </div>
        <div class="summary-chip">
          <span>Last manual</span>
          <strong>${status.lastBulkSyncAt ? formatDateTime(status.lastBulkSyncAt) : "Not yet run"}</strong>
        </div>
      </div>
      ${
        clientProfile
          ? `
            <div class="recommendation-box">
              <h4>This account</h4>
              <div class="definition-grid">
                <div class="definition-item">
                  <span>Sync status</span>
                  <strong>${escapeHtml(clientProfile.sync_status || "Unknown")}</strong>
                </div>
                <div class="definition-item">
                  <span>Last synced</span>
                  <strong>${clientProfile.last_synced_at ? formatDateTime(clientProfile.last_synced_at) : "Not yet run"}</strong>
                </div>
                <div class="definition-item">
                  <span>Contact ID</span>
                  <strong>${escapeHtml(clientProfile.ghl_contact_id || "Not linked")}</strong>
                </div>
                <div class="definition-item">
                  <span>Pipeline stage</span>
                  <strong>${escapeHtml(clientProfile.ghl_pipeline_stage || "Not set")}</strong>
                </div>
              </div>
            </div>
          `
          : `
            <div class="recommendation-box">
              <h4>Controls</h4>
              <p class="muted">
                ${status.configured
                  ? "The app provisions missing mapped contact fields automatically and syncs each client on save, submit, update, and the hourly background pass."
                  : "GHL is running in dry-run mode until valid credentials are loaded."}
              </p>
              <div class="button-row">
                <button class="btn sage" data-action="sync-all-contacts" type="button" ${state.busy ? "disabled" : ""}>Sync all contacts</button>
              </div>
            </div>
          `
      }
      <div class="recommendation-box">
        <h4>Recent sync activity</h4>
        ${renderGhlLogsModal(logs)}
      </div>
      ${
        !clientProfile && fieldMap.length
          ? `
            <div class="recommendation-box">
              <h4>Mapped GHL fields</h4>
              <div class="field-map-list">${fieldMap.map(renderFieldMapRow).join("")}</div>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderEmailLogRow(log) {
  return `
    <div class="log-row">
      <strong>${escapeHtml(log.subject || "Email")} / ${escapeHtml(log.status)}</strong>
      <span class="muted">${escapeHtml(log.to_email || "No recipient")} ${log.sent_at ? `/ ${escapeHtml(log.sent_at)}` : ""}${log.error_message ? ` / ${escapeHtml(log.error_message)}` : ""}</span>
    </div>
  `;
}

function renderFieldMapRow(field) {
  return `
    <div class="field-map-row">
      <strong>${escapeHtml(field.label)}</strong>
      <span class="muted">${escapeHtml(field.appField)} -> ${escapeHtml(field.ghlKey)}</span>
    </div>
  `;
}

function renderPhotoSlot(src, label) {
  if (!src) return `<div class="photo-slot empty">${escapeHtml(label)}</div>`;
  return `<div class="photo-slot"><img src="${src}" alt="${escapeHtml(label)} photo" /><span>${escapeHtml(label)}</span></div>`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function formToObject(form) {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Phoenix";
  } catch {
    return "America/Phoenix";
  }
}

function normalizeReminderEmails(value) {
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

function reminderEmailsValue(value, fallback = "") {
  const emails = normalizeReminderEmails(value);
  if (emails.length) return emails.join(", ");
  return fallback || "";
}

function toIsoFromLocalDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid reminder date and time.");
  return date.toISOString();
}

function filesToDataUrls(fileList) {
  return Promise.all(
    Array.from(fileList || []).map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        })
    )
  );
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("reo-session"));
  } catch {
    return null;
  }
}

function setBusy(value) {
  state.busy = value;
  render();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 3200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatShift(value) {
  if (!Number.isFinite(Number(value))) return "-";
  return Number(value) > 0 ? `+${Number(value)}` : String(Number(value));
}

function priorityUrgencyValue(priority) {
  const scores = {
    Low: 3,
    Medium: 5,
    High: 7,
    Urgent: 9
  };
  return scores[String(priority || "Medium")] || 5;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function inputDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : formatIsoDate(date);
}

function inputDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatIsoDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseCalendarDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value);
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shiftAssistantCalendar(direction) {
  const view = state.assistantCalendarView || "month";
  const date = parseCalendarDate(state.assistantCalendarDate) || new Date();
  if (view === "day") date.setDate(date.getDate() + direction);
  if (view === "week") date.setDate(date.getDate() + 7 * direction);
  if (view === "month") {
    date.setDate(1);
    date.setMonth(date.getMonth() + direction);
  }
  if (view === "year") date.setFullYear(date.getFullYear() + direction);
  state.assistantCalendarDate = formatIsoDate(date);
}

function calendarPeriodLabel(anchor, view) {
  if (view === "day") return anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (view === "week") {
    const start = startOfWeek(anchor);
    const end = endOfWeek(anchor);
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    })}`;
  }
  if (view === "year") return String(anchor.getFullYear());
  return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function eventsForDate(events, date) {
  return events.filter((event) => sameDay(event.date, date));
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function endOfWeek(date) {
  return addDaysToDate(startOfWeek(date), 6);
}

function addDaysToDate(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDuration(value) {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms <= 0) return "0 minutes";
  const minutes = Math.round(ms / 60000);
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function capitalize(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
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
