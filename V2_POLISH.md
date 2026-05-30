# BookMyTurf v2 Polish List

This file is the **single source of truth** for all known polish items deferred
from the v1 build.  Items are organised by area.  When production usage surfaces
new items, append them here.

---

## Photos & Media

### File upload UX
Backend endpoints for turf photos accept URL strings; an owner must currently
host the image elsewhere and paste the URL.  v2 should add:
- A file picker in `OwnerTurfDetail` and `OwnerTurfNew`.
- Client-side upload to cloud storage (Cloudinary direct-upload or AWS S3
  presigned URL).
- The backend photo endpoint then stores the returned CDN URL.

### Sub-court photos
Not implemented at any layer in v1.  v2 scope:
- **Backend:** `sub_court_photos` table + entity + repository; owner photo
  upload endpoints mirroring the turf-photo endpoints.
- **Frontend:** photo gallery section on `TurfDetail` per sub-court;
  photo management in `OwnerTurfDetail`.

---

## Booking UX

### 90-day booking horizon UI hint
The backend rejects booking dates beyond 90 days with a 400 error.  The date
picker in `TurfDetail` currently has no `max` attribute, so customers can select
a date 6 months away and receive a confusing error.  v2 fix: add
`max={(new Date(Date.now() + 90*24*3600*1000)).toISOString().split('T')[0]}`
to the date input, and display an inline hint "Bookable up to 90 days ahead."

### Razorpay real-browser smoke test
See `RAZORPAY_MANUAL.md`.  A real-browser run is required before any production
deployment touching the payment flow.  The Playwright smoke (`tests/e2e-smoke.spec.js`)
covers the happy path via test-mode API; the manual test closes the modal-interaction gap.

---

## Operational UX

### OPEN → IN_PROGRESS gating on Resolve
Currently both **Reassign** and **Resolve** buttons appear on `OPEN` complaints in
`AdminComplaints`.  Clicking **Resolve** on an OPEN complaint returns 400 because
the backend requires `IN_PROGRESS` status before resolution.  v2 fix: hide the
**Resolve** button when `status === 'OPEN'` (show only **Reassign** / **Assign**).

### Hint after approving a turf with no approved sub-courts
When an admin approves a turf that has no APPROVED sub-courts, the turf is not
publicly visible (the discovery query requires ≥1 approved sub-court).  There is
no UX hint alerting the admin to this.  v2 fix: after approving a turf, check
if any sub-courts are approved; if not, show an inline banner:
"Turf approved, but no sub-courts are approved yet — approve at least one
sub-court to make it discoverable."

---

## Backend Hygiene

### `payouts.paid_at` nullable
`payouts.paid_at` is nullable, which is correct for PENDING payouts.  However,
existing PAID rows written before `paid_at` was added may have `NULL` in this
column.  v2: write a one-time migration to backfill `paid_at = updated_at` for
all `status = 'PAID'` rows where `paid_at IS NULL`.

### `complaints.booking_id` nullable
`booking_id` on complaints is intentionally nullable (general complaints exist
without a booking reference).  The FK constraint and nullability are correct.
v2: add a comment to the entity and the API doc clarifying this is intentional.

### `AddNoteResponse.complaintId` field name
`AddNoteResponse` contains a field `complaintId`.  When the same DTO is reused
for query notes, `complaintId` is misleading.  No functional impact in v1.  v2:
introduce `entityId` + `entityType` fields, or separate DTOs for complaint and
query notes.

### `BOOKING_HORIZON_DAYS=90` not surfaced in UI
The constant `BOOKING_HORIZON_DAYS = 90` is defined in the backend but not
exposed via any API.  The frontend hardcodes nothing; it simply shows the 400
error.  v2: expose it via `GET /api/config/booking-horizon` (or include it in
the public turf detail response) so the frontend can set the picker max
dynamically.

---

## Account UX

### Password reset flow
Currently there is no self-serve password reset for any role.  Admins can change
staff passwords directly via `AdminStaff`.  v2 should add an email-link reset
flow for all roles (customer, owner, staff, admin).

### Owner "complete your bank details" nudge
When an owner has no bank details on file, payouts cannot be released even when
the hold window expires.  v2: surface a dismissible banner on `OwnerDashboard`
if `bank_details` is empty, and send a one-time email nudge after the first
booking is confirmed.

---

## List Rendering

### Complaint list: booking + turf context
`ComplaintListResponse` items do not include `turf_name` or a booking summary.
The customer-side complaint list shows only `subject` and `status`, requiring a
detail click to see which turf the complaint is about.  v2: add `turf_name` and
`booking_date` to the list response shape so the list can display
"Re: Booking #X at Turf Y on YYYY-MM-DD."

---

## Future Feature Surfaces

These are out of v2 scope but worth noting for the product roadmap:

- **Admin per-turf drill-down on the platform dashboard** — the admin dashboard
  shows platform-wide aggregates.  Owner-level drill-down (which turf earns what)
  is only available on the owner dashboard.
- **Owner booking detail view** — owners see bookings as counts on their
  dashboard but have no booking detail page.  Customers have a full receipt;
  owners do not.
- **Customer query history search** — the query list has no search or filter.
  For users with many queries, a subject-search or date-range filter would help.
- **Review moderation** — admins have no UI to remove inappropriate reviews.
  Flagging and moderation would be a v2 feature.
