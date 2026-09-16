# KundiCalc → Kundivent Handover, Contract v1

Receiver-side contract. Kundivent only *receives*; there is no reverse
synchronisation and Kundivent never recalculates profitability.

## Endpoints

Base: `https://<kundivent-host>/api/public/integrations/kundicalc/v1`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/master-data` | active categories + planning areas |
| GET | `/events?q=&from=&to=&status=&limit=&offset=` | bounded, paginated search over **all** dates |
| GET | `/events/{eventId}` | single event preview for the review step |
| POST | `/handover` | create a confirmed event **or** link a calculation |
| GET | `/receipts/{sourceEventId}` | recover the receipt of an earlier handover |

All responses are JSON and carry `contract_version: "v1"`.

## Authentication

Every request must send both headers:

```
x-kundicalc-key: <value of the KUNDICALC_INTEGRATION_KEY secret>
x-kundicalc-actor: <stable KundiCalc user id, derived server-side>
```

- The key authenticates the *calling application* only.
- The actor id is resolved through an explicit admin-maintained mapping
  (Kundivent → Einstellungen → „KundiCalc-Übergabe“). No auto-creation,
  no e-mail matching, no caller-supplied Kundivent user id.
- Per operation: authenticate → resolve mapped user → active check →
  Kundivent permissions. Create/link require an **active editor or admin**.
- Missing configuration fails closed with `503 integration_not_configured`.

### Required secrets (names only, values are never stored in the repo)

| Secret | Required | Purpose |
| --- | --- | --- |
| `KUNDICALC_INTEGRATION_KEY` | yes (min. 24 chars) | shared server-to-server credential |
| `KUNDICALC_SOURCE_SYSTEM` | no (default `kundicalc`) | logical source system name |
| `KUNDICALC_BASE_URL` | no | trusted base for „Kalkulation öffnen“ links |
| `KUNDIVENT_BASE_URL` | no | overrides the deep-link base in receipts |

The Supabase service-role key is **not** shared with KundiCalc.

## Request schema (POST /handover)

Common fields:

```jsonc
{
  "contract_version": "v1",
  "source_system": "kundicalc",
  "source_event_id": "<stable KundiCalc event id, ≤128>",
  "source_calculation_id": "<optional, ≤128>",
  "source_actor_id": "<must equal the x-kundicalc-actor header>",
  "execution_approval_ref": "<proof of the execution decision, ≤200>",
  "execution_approved_at": "2026-03-04T09:12:00+01:00",
  "idempotency_key": "<stable, 8–128 chars>",
  "operation": "create" | "link"
}
```

### operation = "create"

```jsonc
{
  "...": "common fields",
  "operation": "create",
  "event": {
    "title": "Hochzeit Muster",
    "category_id": "<uuid of an ACTIVE category>",
    "planning_area_ids": ["<uuid of an ACTIVE planning area>"],
    "start_date": "2026-07-18",
    "end_date": "2026-07-18",
    "all_day": false,
    "start_time": "16:00",
    "end_time": "23:30",
    "pax": 80,
    "notes": "optional",
    "responsible_user_id": "<optional uuid of an ACTIVE profile>"
  }
}
```

Status is derived server-side as `confirmed`; arbitrary status or database
fields cannot be set. At least one active planning area is mandatory. Inbound
e-mail token generation, deposits, attachments and conflict rules stay
unchanged.

### operation = "link"

```jsonc
{
  "...": "common fields",
  "operation": "link",
  "target_event_id": "<uuid from /events>",
  "expected_updated_at": "<updated_at from the reviewed event>",
  "confirm_status_change": true
}
```

- `idea` / `provisional` → `confirmed` only with `confirm_status_change: true`.
- `confirmed` stays confirmed; `cancelled` is rejected (`cancelled_target`).
- All other fields stay untouched: title, notes, dates/times, category,
  planning areas, pax, responsible, deposit, inbound token, e-mails,
  attachments.
- If `expected_updated_at` no longer matches, the request is rejected with
  `target_changed` — KundiCalc must re-read the event and re-confirm.

## Acknowledgement

Returned only after the database transaction has committed:

```jsonc
{
  "contract_version": "v1",
  "handover_id": "…",
  "source_event_id": "…",
  "source_calculation_id": "…",
  "target_event_id": "…",
  "target_url": "https://<kundivent-host>/?event=<uuid>",
  "calculation_url": "…",
  "operation": "create",
  "outcome": "created" | "linked" | "already_processed",
  "completed_at": "2026-03-04T08:15:04.120Z",
  "target_event_deleted": false
}
```

`target_url` opens the entry in Kundivent after sign-in.

## Idempotency, concurrency, recovery

- One source event → exactly one Kundivent event; one Kundivent event → at
  most one KundiCalc association (unique database constraints).
- Repeated identical request → the original receipt with
  `outcome: "already_processed"`; nothing is updated or reconfirmed.
- Same idempotency key with different content → `idempotency_conflict`.
- Concurrent requests → no duplicates (transaction + `FOR UPDATE`).
- A failed transaction writes nothing partial.
- Lost response → `GET /receipts/{sourceEventId}`.
- If the target event is later deleted, the receipt is kept with
  `target_event_deleted: true`; nothing is silently recreated.

## Error codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `integration_not_configured` | 503 | credential/config missing (fail closed) |
| `invalid_credentials` | 401 | key missing or wrong |
| `unmapped_source_user` | 403 | no active mapping for the actor |
| `inactive_user` | 403 | mapped Kundivent user deactivated |
| `insufficient_permissions` | 403 | mapped user is not editor/admin |
| `invalid_payload` | 400 | schema, size or field validation failed |
| `invalid_category` | 422 | category missing or inactive |
| `invalid_planning_area` | 422 | planning area missing or inactive |
| `invalid_responsible_user` | 422 | responsible user invalid/inactive |
| `target_not_found` | 404 | target event does not exist |
| `target_changed` | 409 | target changed since review |
| `cancelled_target` | 409 | cancelled events are not reactivated |
| `association_conflict` | 409 | source or target already associated |
| `idempotency_conflict` | 409 | key reused with different content |
| `transaction_failed` | 500 | write failed, nothing persisted |
| `not_found` | 404 | no receipt for this source reference |

Error bodies contain `{ error: { code, message, detail? } }` with a concise
German message — never stack traces, credentials or database internals.

## Handover for KundiCalc — Step 3 (sender responsibilities)

1. Derive `source_actor_id` **server-side from the authenticated session**.
   Never accept it from the browser payload.
2. Store `KUNDICALC_INTEGRATION_KEY` in backend secrets only; never expose it
   in browser code, `VITE_*` variables, URLs, logs or repository files.
3. Only send a handover after an explicit *execution approval* — a positive
   calculation alone is not enough. Pass the approval reference and timestamp.
4. Use a stable `idempotency_key` per logical handover attempt and retry the
   *identical* payload on network failure; on a lost response call
   `GET /receipts/{sourceEventId}` instead of re-posting new content.
5. For `link`: read `/events` (search) and `/events/{id}` (review), show the
   user the current state, and send `expected_updated_at` plus
   `confirm_status_change: true` after explicit confirmation. On
   `target_changed`, re-read and ask again.
6. Persist the returned `handover_id`, `target_event_id` and `target_url`;
   show the Kundivent link in KundiCalc.
7. Surface the German error messages of the contract to the user unchanged.
