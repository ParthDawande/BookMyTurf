# BookMyTurf — Build Decisions (Authoritative Override)

**Status:** Authoritative. **Precedence:** This file wins.

When anything in this file conflicts with `API_DOC.md`, `README.md`, or any
example/code snippet in those files, **the rule in this file is correct** and
must be implemented. Treat the other documents as the detailed spec; treat this
file as the set of corrections applied on top of them. Do not "average" or
reconcile — follow this file exactly where it speaks.

If a topic is **not** covered here, follow `API_DOC.md` as written.

---

## 1. Platform commission rate

- **Commission rate is exactly 10%** of `bookings.total_amount`.
- Expose as a single configuration property; do not hardcode in business logic:
  - `app.platform.commission-rate=0.10`
- `bookings.commission_amount = round(total_amount * 0.10, 2)` (2-decimal,
  standard half-up rounding, INR).
- This applies everywhere commission is computed or recomputed: booking
  confirm, reschedule confirm, revenue/dashboard aggregates.
- **Ignore all conflicting example values in `API_DOC.md`.** Specifically, the
  admin bookings example showing `"commission_amount": 180.00` for booking
  `#1024` (total `1200.00`) is **wrong**. The correct value for that booking is
  `120.00`. Every example with `total_amount: 1200.00` must imply
  `commission_amount: 120.00` and `owner_payout: 1080.00`.

---

## 2. Time-window constants (all three = 24 hours)

There are **three independent** windows. All three default to **24 hours** for
v1. Each is its own configuration property (do not collapse into one constant):

- `app.booking.cancellation-window-hours=24`
  Cancellation allowed only if `now` is more than 24h before the **earliest**
  slot start. Otherwise reject (see `DELETE /api/customer/bookings/{id}`).
- `app.booking.reschedule-window-hours=24`
  Reschedule allowed only if `now` is more than 24h before the **earliest**
  slot start of the original booking.
- `app.payout.hold-hours=24`
  Owner payout `scheduled_at = booking_date + last_slot_end_time + 24h`. The
  simulated payout job flips `PENDING → PAID` only after this time.

The JWT/auth token expiry is a **separate** concern and remains as the spec's
`JWT_EXPIRATION` env var. Default it to 24h as well
(`JWT_EXPIRATION=86400000` ms) but keep it config-driven; it is unrelated to
the three booking windows above.

---

## 3. Booking `REFUNDED` status (resolves the dead-state contradiction)

`bookings.status` enum stays exactly as the schema defines it:
`ENUM('CONFIRMED','CANCELLED','COMPLETED','REFUNDED')`. `REFUNDED` is a **real,
reachable state**. Apply these rules:

- **Cancellation with a successful refund** (`DELETE /api/customer/bookings/{id}`
  when a refund is issued): set `bookings.status = 'REFUNDED'` (NOT
  `'CANCELLED'`). The `payouts.status` still becomes `'CANCELLED'` as the spec
  says (owner not paid).
- **Reschedule with a partial refund** (`PUT .../reschedule/confirm`, REFUND
  scenario): the booking remains `CONFIRMED` (it is still a live, played
  booking) — only a `refunds` row is added. Do **not** set `REFUNDED` here.
  `REFUNDED` means "the whole booking was refunded and will not be played."
- **Cancellation without any refund** (e.g., a zero-amount edge case, should be
  rare): set `'CANCELLED'`.
- All existing filter/aggregate logic that references
  `IN ('CANCELLED','REFUNDED')` or "exclude CANCELLED + REFUNDED" is now
  **correct as written** and must be implemented unchanged. The
  `filter=cancelled` customer view returns both `CANCELLED` and `REFUNDED`.
- Net-of-refunds revenue (dashboard, admin bookings summary, admin/owner
  revenue) counts only `CONFIRMED` + `COMPLETED`, excluding `CANCELLED` +
  `REFUNDED` — unchanged, now consistent.

Net effect: a fully refunded booking is `REFUNDED`; a rescheduled booking that
got a price-difference refund stays `CONFIRMED`.

---

## 4. Receipt endpoint (`GET /api/customer/bookings/{id}/receipt`)

Resolve the contradiction between the error table and the internal logic:

- **Allowed statuses for receipt generation:** `CONFIRMED`, `COMPLETED`,
  `CANCELLED`, `REFUNDED`.
- Any other status → reject with **`400`** (NOT `422`). Use the standard error
  body shape: `{ "error": "Receipt not available for this booking status" }`.
- **Remove `422` entirely** from this endpoint. The API uses `400` for all
  state-violation rejections; this endpoint must match that convention so the
  global exception handler and client error handling stay uniform.
- Internal logic step 4 stands (status whitelist above); the error table's
  `422` row is replaced by a `400` row with the same message.

---

## 5. Customer-facing notifications — OUT OF SCOPE for v1

- Build **only** the notification inserts that individual endpoints explicitly
  list in their **Side Effects** sections. As specified, that means
  owner-directed and staff-directed notifications only:
  - Owner: `NEW_BOOKING`, `BOOKING_CANCELLED`, `TURF_APPROVED`,
    `TURF_REJECTED`, `SUBCOURT_APPROVED`, `SUBCOURT_REJECTED`,
    `PAYOUT_RELEASED` (the last one from the simulated payout job).
  - Staff: `COMPLAINT_ASSIGNED`.
- **Do NOT** generate inserts for customer-facing notification types
  (`BOOKING_CONFIRMED` to the customer, `BOOKING_REMINDER`,
  `REFUND_PROCESSED`, `COMPLAINT_RESOLVED`, `QUERY_RESOLVED`, etc.). The
  "known notification types" list in the `GET /api/notifications` section is
  **documentation only** for v1 — the `type` column is `VARCHAR(50)` and the
  endpoint is role-agnostic, so no enum or code changes are needed. These
  customer types are simply never produced in v1.
- `GET /api/notifications` and `PUT /api/notifications/{id}/read` are still
  built exactly as specified — they just return only the
  owner/staff-targeted rows that actually get created.

---

## 6. Field naming: turf list thumbnail

For v1, **standardize on `cover_photo_url`** (snake_case in JSON) for the
turf-list image field across **all** list endpoints that currently differ:

- `GET /api/customer/turfs` → use `cover_photo_url` (spec shows `thumbnail_url`
  — override it).
- `GET /api/owner/turfs` → use `cover_photo_url` (spec shows `thumbnail_url` —
  override it).
- `GET /api/public/turfs` → already `cover_photo_url`; unchanged.

Semantics unchanged: it is the first row in `turf_photos` ordered by `id`,
`null` if the turf has no photos. This keeps the customer and public search
responses shape-compatible so the frontend can share one list component, as
the spec intends.

---

## 7. Stale cross-references — ignore

`API_DOC.md` "Appendix A — README & Schema Corrections" describes README
changes that have **already been applied** to the current `README.md` (the
Notifications section and `GET /api/staff/queries/{id}` already exist in the
README route table). Appendix A is **obsolete**. Do not act on it, do not
"re-apply" it, and do not treat the README as missing those entries. The
inline note at `GET /api/staff/queries/{id}` ("not in the original README's
Staff route table") is likewise obsolete — the endpoint is fully in scope and
must be built.

---

## 8. Schema accommodations (confirm v1 stance — no schema changes)

These are already documented as optional in `API_DOC.md` Appendix A; for v1,
**do not add the optional columns**. Implement the documented workarounds:

- `sub_courts` has no `created_at`: sort "pending sub-courts" by
  `sub_courts.id ASC` as the creation-order proxy.
- `queries` has no `picked_up_at`: derive `picked_up_at` server-side at the
  moment of the atomic claim for the response only; do not persist it.
- No `admin_actions` audit table: accept the optional `reason` field on
  suspend/ban/activate/reject and **do not persist it**, except where the spec
  relays the reason inside a notification message (turf/sub-court reject).
- Admin removal (`DELETE /api/admin/admins/{id}`) is a soft deactivation:
  set `users.status = 'BANNED'`, keep the row and `admin_profiles`.

---

## Quick reference — config properties to create

```
app.platform.commission-rate=0.10
app.booking.cancellation-window-hours=24
app.booking.reschedule-window-hours=24
app.payout.hold-hours=24
JWT_EXPIRATION=86400000
```

End of authoritative decisions.
