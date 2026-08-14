# HighLevel Client Portal Integration

BTBV remains the source of truth for rooms, photos, AI recommendations, Emily reviews, scores, assistant items, warranties, and community activity. HighLevel remains the CRM and automation layer.

## What Is Implemented

- The BTBV app can be opened at `/portal` inside a HighLevel embedded page.
- Static responses include a configurable `Content-Security-Policy` `frame-ancestors` rule for HighLevel domains.
- Password login and portal handoff both create server-side bearer sessions.
- API requests use the bearer session instead of relying only on browser local storage.
- Portal handoff links are opaque, single-use, and expire after the configured TTL.
- Client access is scoped to the signed-in client. Staff access remains available for admin workflows.
- Existing GHL contact sync and hourly sync remain unchanged.

## Production Environment

Set these values in the VPS Docker environment:

```dotenv
PORTAL_BASE_URL=https://portal.example.com
PORTAL_SSO_SECRET=replace-with-a-long-random-secret
PORTAL_SSO_TOKEN_TTL_SECONDS=300
SESSION_TTL_MS=604800000
PORTAL_ALLOWED_FRAME_ANCESTORS=https://app.gohighlevel.com https://*.gohighlevel.com https://*.leadconnectorhq.com https://*.msgsndr.com
```

`PORTAL_BASE_URL` should be the public HTTPS address of this app. It must not be a local address or a raw Docker port in production.

## HighLevel Custom Menu Link

In HighLevel Agency View:

1. Open `Settings` and then `Custom Menu Links`.
2. Create a link titled `Built to Be Visible`.
3. Set the URL to `https://portal.example.com/portal`.
4. Choose `Embedded Page (iFrame)`.
5. Set visibility for the intended location and users.
6. Save and test on desktop and mobile Client Portal views.

The first version opens the normal BTBV login inside the portal. This is the safest fallback because HighLevel Custom Menu Links do not, by themselves, prove the identity of a contact.

## One-Time Portal Handoff

For a workflow or server-side integration that already knows the BTBV client email, request a one-time link:

```bash
curl -X POST https://portal.example.com/api/portal/sso-tokens \
  -H 'Content-Type: application/json' \
  -H 'X-BTBV-Portal-Secret: replace-with-your-secret' \
  --data '{"email":"client@example.com","source":"highlevel"}'
```

The response contains `portal_url`. Give that URL to the client through an approved HighLevel email, SMS, or portal action. The link can be used once and expires after five minutes by default.

The endpoint also accepts `client_id` or `phone`. Matching by email is preferred; phone is the fallback.

Do not build an authentication link that contains only `?email=client@example.com`. Email and phone are matching fields, not proof of identity.

## GHL Webhook Protection

If `GHL_WEBHOOK_SECRET` is set, send the same value in `X-BTBV-Portal-Secret` or `X-GHL-Webhook-Secret` for the membership webhook request:

```text
POST /api/ghl/webhooks/membership-updated
```

## Deployment Checklist

- Point the portal subdomain DNS `A` record to the VPS.
- Set `APP_DOMAIN` to the public domain used by Caddy.
- Set `PORTAL_BASE_URL` to the same HTTPS app address.
- Set a long random `PORTAL_SSO_SECRET` in the VPS environment only.
- Rebuild the Docker app after changing environment values.
- Verify `/api/health` returns `200`.
- Verify the Custom Menu Link opens `/portal` inside HighLevel.
- Test a client login, a room dashboard request, and a one-time portal link.
- Do not commit `.env`, `.env.btbvapp`, or any portal secret to GitHub.
