# BookMyTurf Production Deployment Checklist

This file is the production runbook.  Update it as production usage surfaces
operational learnings.

---

## Build Steps

```bash
# 1. Rebuild the backend JAR (always rebuild — never deploy a stale JAR).
cd backend
mvn clean package -DskipTests
# Output: target/bookmyturf-backend-0.0.1-SNAPSHOT.jar

# 2. Build the frontend bundle.
cd ../frontend
npm install
npm run build
# Output: dist/   (Vite production bundle)
```

---

## Environment Configuration

### Backend — `application.properties` overrides

Set these via environment variables or a production `application.properties`
that is **not** committed to the repository (mirror `application-local.properties`
for dev).

| Property | Description | Required |
|---|---|---|
| `spring.datasource.url` | Production MySQL JDBC URL | Yes |
| `spring.datasource.username` | DB username | Yes |
| `spring.datasource.password` | DB password | Yes |
| `app.jwt.secret` | JWT signing secret — **cryptographically random, ≥32 chars** | Yes |
| `app.razorpay.key-id` | Razorpay **live** key ID (`rzp_live_*`) | Yes |
| `app.razorpay.key-secret` | Razorpay **live** key secret | Yes |
| `app.payout.scheduler.enabled` | Set to `true` to enable automated payout release | Yes |
| `app.test.force-refund-failure` | **Must be `false`** — see warning below | Yes |
| `app.booking.cancellation-window-hours` | Hours before booking start within which cancellation is allowed (default 24) | Optional |
| `app.reschedule.token-expiry-seconds` | Reschedule token lifetime in seconds (default 900 = 15 min) | Optional |

> **CRITICAL:** `app.test.force-refund-failure=false` must be verified before
> every deployment.  If this flag is `true` in production, **all refund calls
> will return 502 to real customers** and FAILED recovery records will
> accumulate.  It is a fault-injection flag for development only.

> **IMPORTANT:** Do not use the default JWT secret from `application-local.properties`
> (`bmt-dev-secret-key-replace-before-production-32chars+`).  Generate a fresh
> random secret:
> ```bash
> openssl rand -base64 48
> ```

### Frontend — `.env.production`

```
VITE_API_BASE_URL=https://your-backend-domain.com
```

Create this file at `frontend/.env.production` before running `npm run build`.
It is excluded from git (`.gitignore` pattern `*.env`).

---

## Database Steps

1. **Back up the production database** before every deployment.
   ```bash
   mysqldump -u <user> -p bookmyturfdb > backup_$(date +%Y%m%d).sql
   ```

2. The backend uses `spring.jpa.hibernate.ddl-auto=update`.  This applies
   schema changes automatically on startup.  It is safe for incremental
   column/table additions but risky for renaming or dropping.
   **Recommendation for v2:** switch to `validate` and manage schema migrations
   with Flyway or Liquibase.

3. Verify the database is accessible from the production host before starting
   the JAR.

---

## Razorpay Configuration

1. **Switch from test mode to live mode.**
   - Replace `rzp_test_*` keys with `rzp_live_*` keys in the backend
     environment configuration.
   - Replace `VITE_RAZORPAY_KEY_ID` (if you expose it to the frontend) with
     the live key ID.

2. **Verify the bank account** that receives owner payouts is configured in
   Razorpay's dashboard under **Settlements**.

3. **Webhooks:** v1 uses synchronous order + confirm only (no Razorpay
   webhooks).  If you add webhook-based payment verification in v2, update the
   endpoint in the Razorpay dashboard.

---

## Pre-Launch Verification

Complete these three checks in order before opening to real customers.

### 1. Manual Razorpay smoke (REQUIRED)

Follow **`RAZORPAY_MANUAL.md`** end-to-end in a real browser against the
deployed environment using **Razorpay test keys** (`rzp_test_*`).  Do not take
real customer money until this passes.

### 2. Cross-portal Playwright smoke

From the deployed frontend URL, run:
```bash
cd frontend
PLAYWRIGHT_BASE_URL=https://your-frontend-domain.com npx playwright test ../tests/e2e-smoke.spec.js
```
All 8 steps must pass.

### 3. Anonymous registration smoke

Without creating any booking:
1. Open a browser to the deployed frontend URL.
2. Register a new customer account.
3. Browse `/turfs` — verify the list loads.
4. Open a turf detail — verify sub-courts and availability load.
5. Do **not** attempt a payment against the live Razorpay key in a smoke test.

---

## Operational Notes

### Fault-injection flag
`app.test.force-refund-failure` is for development testing only.  It must be
`false` in production at all times.  If it is ever accidentally set to `true`
in production, **every refund attempt will fail** (502), and FAILED recovery
records will accumulate in the `refunds` table.  Remediation: set the flag back
to `false` and redeploy immediately; then manually process any stuck refunds
via the Razorpay dashboard.

### Booking horizon
The booking horizon is 90 days (`BOOKING_HORIZON_DAYS = 90` in
`BookingService`).  Customers attempting to book further than 90 days in
advance will receive a 400 error.  The date picker in the frontend currently
has no max attribute (see V2_POLISH.md — "90-day booking horizon UI hint").

### Photo upload
Turf photo upload is URL-string only in v1.  Production owners must host images
externally and paste the URL.  See V2_POLISH.md — "File upload UX" for the v2
cloud-storage work.

### Sub-court photos
Not a feature in v1.  Any owner request for sub-court photo upload is a v2
item (see V2_POLISH.md — "Sub-court photos").

### Customer notifications
Customer-facing notifications are intentionally zero (§5 invariant — all
notification types are directed at owners, admins, or staff, never at
customers).  If any notification with a CUSTOMER-role `user_id` appears in
production, that is a regression.  Query to detect:
```sql
SELECT n.id, n.type, n.user_id, n.created_at
FROM   notifications n
JOIN   users u ON u.id = n.user_id
WHERE  u.role = 'CUSTOMER'
ORDER  BY n.created_at DESC
LIMIT  20;
```
Expected result: 0 rows.

### Payout scheduler
`app.payout.scheduler.enabled` defaults to `false`.  In production, set it to
`true` to enable automated nightly release of PENDING payouts that have passed
the hold window.  Without this, payouts must be released manually.

### Hibernate DDL
`ddl-auto=update` is convenient for development but carries risk in production
(e.g. if an entity field is renamed, the old column persists orphaned).  For
v2, switch to `validate` + Flyway migrations (see V2_POLISH.md — "Backend
hygiene").

---

## Logging

Configure `application.properties` for production logging:

```properties
logging.level.root=WARN
logging.level.com.bookmyturf=INFO
logging.file.name=/var/log/bookmyturf/app.log
logging.logback.rollingpolicy.max-file-size=50MB
logging.logback.rollingpolicy.max-history=30
```

Razorpay test transactions (using `rzp_test_*` keys) are not visible in the
live Razorpay dashboard.  Keep dev and prod accounts separate.
