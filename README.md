# aurora-app

The Nuxt 4 web app for Aurora. Owns the Twilio WhatsApp webhook and sends
replies — the actual "thinking" happens in a separate Trigger.dev project.
Deployed on AWS Amplify, where SSR runs on Lambda: the execution environment
freezes as soon as a response is returned, so nothing in this app can defer
work past a request (no timers, no background promises, no polling). All
long-running work happens in Trigger.dev instead.

## What this app does

`capture-agent` (in [aurora-agents](https://github.com/sahildavid-dev/aurora-agents))
identifies a real-world place from a name/description, a Google Maps link,
and/or a photo, and returns structured place data for Aurora's map — it's a
"save this place" pipeline, not a general Q&A bot, and it doesn't (yet)
support follow-up conversation about something already captured. A run
takes 30-90 seconds (multiple web searches at high effort) — far past
Twilio's 15-second webhook timeout — so the webhook only ever hands off and
returns; the reply comes back out-of-band once the agent is done.

1. Receives an inbound WhatsApp message via a Twilio webhook, downloads any
   attached photo, and triggers `capture-agent` with the raw message.
2. `capture-agent` does its own interpretation of the text/image, resolves
   the place, calls back into this app to save it, and sends the WhatsApp
   reply.

```
WhatsApp user → Twilio → aurora-app (this repo) → Trigger.dev capture-agent → Claude
                              ↑                              │
                              ├── POST /api/internal/places/upsert (save)
                              └── POST /api/internal/notify (reply, via Twilio REST API)
```

## Integration contract

Trigger `capture-agent` with the raw inbound message, untouched — no URL
extraction, no splitting text into name vs. notes; the agent's model does
that interpretation itself:

```ts
{
  from: string          // body.From
  messageSid: string     // body.MessageSid
  receivedAt: string     // ISO timestamp
  text: string           // body.Body, trimmed; may be empty for a bare photo
  image?: { data: string; mediaType: string }   // base64
}
```

Triggered with `MessageSid` as the idempotency key, so a Twilio retry of the
same message returns the existing run instead of starting a second paid
one. This app never reads the run's result — `capture-agent` sends its own
reply (see below). The payload shape is mirrored from the actual schema in
[`aurora-agents/src/trigger/capture-agent.ts`](../aurora-agents/src/trigger/capture-agent.ts)
(both repos live under the same `AURORA/` parent directory on this
machine) — treat that file as the source of truth. This app doesn't need an
Anthropic key — only `aurora-agents` talks to Claude.

- `image: { data, mediaType }` — `data` is base64, `mediaType` is one of
  `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Twilio reports
  attachments as separate `MediaUrl{n}`/`MediaContentType{n}` fields, each
  only fetchable with Twilio-authenticated requests. Since `aurora-agents`
  deliberately has no Twilio credentials, this app downloads the first
  supported attachment and inlines it as base64 instead of passing the
  Twilio URL through. Only the first supported image is fetched, capped at
  5MB raw (base64 inflates ~33%, and Trigger.dev's payload limit is 10MB);
  anything over the cap, or any non-image attachment, is dropped.

### Reply path

`capture-agent` can't call Twilio directly (it holds no Twilio credentials),
and the webhook can't wait for it (15s timeout vs. a 30-90s run), so it
sends its reply by calling back into this app:

```
POST /api/internal/notify
Authorization: Bearer <INTERNAL_API_SECRET>
{ "to": "whatsapp:+1...", "body": "..." }
```

- `to` must start with `whatsapp:` (rejected otherwise, so a leaked secret
  can't be used to send arbitrary SMS through this account).
- `body` is truncated to Twilio's 1600-character message limit rather than
  rejected if longer.
- Authenticated with a shared bearer secret (`INTERNAL_API_SECRET`),
  compared in constant time. This is a general-purpose internal auth guard
  ([`server/utils/internalAuth.ts`](./server/utils/internalAuth.ts)) shared
  with the upsert endpoint below, not something specific to notify.

## Database

Postgres via Prisma ([`prisma/schema/`](./prisma/schema) (one file per model)). Two
models:

- **Place** — one real-world place. Split into fields Google-sourced data
  fills (`name`, `category`, `address`, `hours`, ...) and an owner's-layer
  Google doesn't have (`notes`, `tags`, `rating`, `visited`). `status`
  (`NEEDS_REVIEW` / `CONFIRMED` / `ARCHIVED`) and `confidence` track how much
  to trust the current data; `lockedFields` lists field names a human has
  hand-edited, which the agent's merge logic (below) must never overwrite.
- **Capture** — one inbound WhatsApp message, kept verbatim (`text`,
  `agentOutput` as raw JSON) whether or not it produced a place, linked to
  the `Place` it resolved to (or `null` if none). `messageSid` is unique —
  a database-level idempotency guarantee in addition to Trigger.dev's own
  idempotency key.

### Matching and merging ([`server/utils/places.ts`](./server/utils/places.ts))

A capture rarely stands alone — the same place gets mentioned across
multiple WhatsApp messages over time, each with partial, sometimes
conflicting information. `findMatch` looks for an existing `Place`
(exact `googlePlaceId`, then a ~150m bounding box + matching normalised
name, then normalised name alone if unambiguous) and `mergePlace` decides,
field by field, what a match should absorb from a new capture:

- A locked field (see above) is never touched.
- An empty incoming value never overwrites a non-empty existing one.
- An empty existing field is filled regardless of confidence; a non-empty
  one is only overwritten by equal-or-higher confidence.
- `notes` is append-only — never overwritten, never dropped, just added to
  on a new line if not already present.
- The place keeps the higher of its own and the incoming confidence, and
  `status` is promoted to `CONFIRMED` at `HIGH` confidence — but a place
  already `CONFIRMED` is never downgraded.

### Agent write path

[`server/api/internal/places/upsert.post.ts`](./server/api/internal/places/upsert.post.ts) —
the *only* place matching/merging/creating happens, so a future bulk
import or web-app paste behaves identically to a WhatsApp capture.
Guarded by the same `assertInternalRequest` as notify. Body is the
`capture-agent` output shape plus the originating message's metadata
(`messageSid`, `from`, `receivedAt`, `text`, `hasImage`); a repeat
`messageSid` returns the original result with `action: 'skipped'` instead
of writing again. Match, merge-or-create, and the `Capture` row all happen
inside one `prisma.$transaction`.

### Web app CRUD ([`server/api/places/`](./server/api/places/))

Unauthenticated for now (see the `TODO` comment at the top of each file —
acceptable only because the app isn't public yet):

- `GET /api/places` — list, filterable by `q` (name/address), `status`,
  `category`, `tag`, `bbox`, cursor-paginated (`limit`, default 50/max 200;
  `cursor`), newest first.
- `GET /api/places/:id` — single place with its captures.
- `POST /api/places` — manual create; defaults to `HIGH`/`CONFIRMED` since a
  human typing it in is already-reviewed data.
- `PATCH /api/places/:id` — manual edit. Every field the request touches —
  including setting it to `null`, a deliberate clear — is added to that
  place's `lockedFields`, so a later agent capture's `mergePlace` skips it.
  Changing `name` recomputes `nameKey`.
- `DELETE /api/places/:id` — soft delete (`status: ARCHIVED`, row kept);
  `?hard=true` for a real delete (its captures survive with `placeId` set
  to `null`, per the model's `onDelete: SetNull`).

## Stack

Nuxt 4. All server-only secrets are declared once in `nuxt.config.ts`'s
`runtimeConfig` and read via `useRuntimeConfig(event)` — never `process.env`
directly inside a route handler. This matters on Amplify: `runtimeConfig`
defaults are evaluated (and baked into the server bundle) at `nuxt build`
time, whereas `process.env` reads inside a handler run per-request, in the
Lambda's own environment — which doesn't reliably have Amplify's
console-configured vars available. See the comment above `runtimeConfig` in
`nuxt.config.ts`. The one exception is the Trigger.dev SDK's own implicit
`process.env.TRIGGER_SECRET_KEY` read, which
[`server/plugins/trigger.ts`](./server/plugins/trigger.ts) overrides once at
startup via `configure({ accessToken })`, sourced from the same
`runtimeConfig`.

`server/utils/prisma.ts` follows the same build-time-baked approach for
`DATABASE_URL`: the connection string is handed to the `PrismaPg` driver
adapter explicitly, via `useRuntimeConfig().databaseUrl`, rather than read
from `process.env` in the running Lambda at cold start — the same
unreliable read as everything else above. It's cached on
`globalThis` (surviving warm Lambda invocations and dev-mode HMR alike), so
a request never instantiates a fresh client — and a fresh connection pool
— of its own.

Nitro server routes:

[`server/api/webhooks/twilio.post.ts`](./server/api/webhooks/twilio.post.ts) —
the inbound Twilio webhook. Thin and stateless by necessity (see the Lambda
note above — no in-process dedupe/debounce/queueing survives between
invocations):

- Verifies the Twilio request signature. Amplify sits behind CloudFront, so
  the request URL the handler sees isn't the public one Twilio signed
  against — the signed URL is rebuilt from `PUBLIC_URL` instead, preserving
  the actual request's path and query string. Fails closed (500, not a
  silent skip) if `TWILIO_AUTH_TOKEN` isn't configured.
- Downloads the first supported image attachment, if any.
- Triggers `capture-agent` and acks Twilio immediately with an empty 200
  (no TwiML, so Twilio doesn't auto-reply) — it never waits on the run.
- A message missing `From`/`MessageSid`/(text and media) is logged and
  acked with a plain 200 rather than a 4xx, since a 4xx would just earn
  pointless Twilio retries for a message that can never succeed. A media
  download or trigger failure is left to throw a 5xx — Twilio retries, and
  the `MessageSid` idempotency key prevents a duplicate paid run.

[`server/api/internal/notify.post.ts`](./server/api/internal/notify.post.ts) and
[`server/api/internal/places/upsert.post.ts`](./server/api/internal/places/upsert.post.ts) —
the two paths `capture-agent` calls back into; see
[Reply path](#reply-path) and [Database](#database) above.

`server/api/places/` — the unauthenticated web app CRUD; see
[Database](#database) above.

## Setup

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL + Twilio + Trigger.dev + internal secret
pnpm exec prisma migrate deploy   # apply migrations to that database
pnpm dev
```

Point a Twilio WhatsApp sender's webhook at `POST /api/webhooks/twilio` on a
publicly reachable URL (e.g. `ngrok http 3000` while developing) — that same
URL is also what `PUBLIC_URL` must be set to.

Required env vars (see `.env.example`). On Amplify, these must be set as
Console env vars *before* the build that deploys them — they're baked into
the server bundle at build time via `runtimeConfig`, not read fresh from
each Lambda invocation's environment (see [Stack](#stack) above), so a var
added after the last build won't take effect until the next one:

- `DATABASE_URL` — pooled Postgres connection string, used at runtime
  through the `PrismaPg` adapter.
- `DIRECT_URL` — direct (non-pooled) connection string, read by the Prisma
  CLI via `prisma.config.ts` (not `runtimeConfig`) for `migrate deploy`.
- `PUBLIC_URL` — this app's public origin, e.g. `https://app.example.com`.
  Used to rebuild the URL Twilio signed against; must match the webhook URL
  configured in the Twilio console exactly.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` — verify inbound webhook
  signatures, fetch media attachments, and send replies.
- `TWILIO_WHATSAPP_FROM` — the Twilio WhatsApp sender, e.g.
  `whatsapp:+14155238886`.
- `TRIGGER_SECRET_KEY` — auth for triggering `capture-agent` in
  `aurora-agents`.
- `INTERNAL_API_SECRET` — shared bearer secret `capture-agent` presents when
  calling this app's internal endpoints (`/api/internal/notify` and
  `/api/internal/places/upsert`). Generate with `openssl rand -hex 32`.

### Database migrations on Amplify

[`amplify.yml`](./amplify.yml)'s build phase runs `prisma generate` (in
`preBuild`, needs only the schema) and `prisma migrate deploy` (in `build`,
after `DIRECT_URL` is written to `.env` — needs a real connection to the
database, so the build container must be able to reach it over the
network). There's no separate migration step outside the build — a deploy
*is* the migration.
