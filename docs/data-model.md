# Data Model

The MVP uses a JSON datastore at `data/db.json`. The collections map directly to the database entities expected for a future SQL or document database migration.

## Entities

### User

Fields: `id`, `name`, `email`, `role`, `password_hash`, `created_at`, `updated_at`.

Roles: `client`, `admin`, `emily`.

### ClientProfile

Fields: `id`, `user_id`, `phone`, `address`, `notes`, `internal_notes`, `timezone`, `ghl_contact_id`, `membership_level`, `membership_status`, `ghl_pipeline_stage`, `last_synced_at`, `sync_status`, `created_at`, `updated_at`.

### Room

Fields: `id`, `client_id`, `room_name`, `room_type`, `desired_energy_outcome`, `status`, `priority`, `current_progress`, `next_best_action`, `upsell_flag`, `ghl_opportunity_id`, `created_at`, `updated_at`.

### RoomPhoto

Fields: `id`, `room_id`, `photo_url`, `photo_type`, `uploaded_at`.

Photo types: `before`, `after`.

### EmotionEntry

Fields: `id`, `room_id`, `entry_type`, `emotions`, `client_comments`, `stress_score`, `clutter_score`, `energy_alignment_score`, `functional_friction_score`, `storage_fit_score`, `sentimental_load_score`, `readiness_score`, `second_circle_intensity_score`, `release_readiness_score`, `decision_urgency_score`, `created_at`.

Entry types: `before`, `after`.

### AIRecommendation

Fields: `id`, `room_id`, `observations`, `emotional_themes`, `energy_blockers`, `organizing_recommendations`, `recommendation_reasons`, `energy_recommendations`, `suggested_next_steps`, `priority_order`, `upsell_opportunity`, `client_message_draft`, `follow_up_recommendation`, `created_at`.

### EmilyReview

Fields: `id`, `room_id`, `ai_recommendation_id`, `emily_notes`, `final_recommendation`, `approved`, `sent_to_client`, `created_at`, `updated_at`.

### Task

Fields: `id`, `assigned_to`, `client_id`, `room_id`, `task_type`, `status`, `due_date`, `notes`, `priority_score`, `membership_priority`, `created_at`, `updated_at`.

### FollowUp

Fields: `id`, `room_id`, `follow_up_type`, `scheduled_date`, `sent`, `response_received`, `created_at`, `updated_at`.

### RoomScore

Fields: `id`, `room_id`, `before_score`, `after_score`, `before_overall_score`, `after_overall_score`, `overall_score`, `workbook_priority_score`, `functional_friction_score`, `storage_fit_score`, `sentimental_load_score`, `readiness_score`, `second_circle_intensity_score`, `release_readiness_score`, `decision_urgency_score`, `clutter_reduction`, `stress_reduction`, `energy_alignment_improvement`, `transformation_score`, `emotional_shift`, `energy_shift`, `calculated_at`.

### FreedomEntry

Fields: `id`, `client_id`, `room_id`, `subject`, `status`, `support_path`, `first_circle_event`, `second_circle_items`, `second_circle_item_count`, `what_shifted`, `intensity_before`, `intensity_after`, `next_action`, `released_at`, `created_at`, `updated_at`.

Status values: `draft`, `released`, `evidence logged`.

### GhlSyncLog

Fields: `id`, `client_id`, `room_id`, `event_type`, `sync_direction`, `payload`, `status`, `error_message`, `created_at`.

### EmailLog

Fields: `id`, `client_id`, `room_id`, `to_email`, `subject`, `body`, `status`, `error_message`, `sent_at`, `email_type`, `scheduled_for`, `metadata`, `created_at`, `updated_at`.

### AssistantItem

Fields: `id`, `client_id`, `type`, `title`, `notes`, `status`, `due_date`, `reminder_at`, `reminder_emails`, `reminder_sent_for`, `last_reminder_email_sent_at`, `appointment_at`, `recurrence`, `calendar_sync_enabled`, `created_at`, `updated_at`.

Types: `note`, `routine`, `task`, `appointment`, `reminder`.

### Warranty

Fields: `id`, `client_id`, `item_name`, `category`, `provider`, `policy_number`, `purchase_date`, `active_from`, `expires_at`, `reminder_at`, `reminder_emails`, `reminder_timezone`, `reminder_sent_for`, `last_reminder_email_sent_at`, `notes`, `document_name`, `document_data_url`, `status`, `created_at`, `updated_at`.

## Indexes To Add In A Production Database

- `users.email`
- `client_profiles.user_id`
- `client_profiles.ghl_contact_id`
- `rooms.client_id`
- `rooms.status`
- `room_photos.room_id`
- `emotion_entries.room_id`
- `emotion_entries.second_circle_intensity_score`
- `ai_recommendations.room_id`
- `emily_reviews.room_id`
- `freedom_entries.client_id`
- `freedom_entries.room_id`
- `freedom_entries.status`
- `tasks.assigned_to`
- `tasks.status`
- `tasks.priority_score`
- `follow_ups.scheduled_date`
- `room_scores.room_id`
- `ghl_sync_logs.client_id`
- `ghl_sync_logs.event_type`
- `email_logs.client_id`
- `assistant_items.client_id`
- `assistant_items.reminder_at`
- `warranties.client_id`
- `warranties.item_name`
- `warranties.expires_at`
