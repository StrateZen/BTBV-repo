# AI Recommendation Prompt

The MVP uses a deterministic recommendation draft service in `src/domain/recommendations.mjs`. The file also exports the production prompt template.

## Prompt Template

```text
You are assisting an organizing and energy-work business.

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
```

## Saved Output Fields

- `observations`
- `emotional_themes`
- `energy_blockers`
- `before_photo_narrative`
- `organizing_recommendations`
- `recommendation_reasons`
- `recommended_layout_changes`
- `energy_recommendations`
- `suggested_next_steps`
- `priority_order`
- `upsell_opportunity`
- `client_message_draft`
- `follow_up_recommendation`

## Production Upgrade Path

Replace `generateRoomRecommendation` with a model call that accepts before photo URLs, emotional intake, room scores, membership permissions, and desired energy outcome. Keep the saved output shape stable so Emily's review workflow and the dashboard do not need to change.
