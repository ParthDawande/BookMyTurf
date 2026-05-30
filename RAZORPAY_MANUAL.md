# Razorpay Manual Smoke Test

## Why this exists

The cross-portal Playwright smoke (`tests/e2e-smoke.spec.js`) uses Razorpay's
undocumented test-mode API (`/v1/payments/create/ajax`) to produce a real HMAC
signature without opening the checkout modal.  In a headless Chromium session
Razorpay's nested-iframe checkout cannot be driven programmatically — the test
runner cannot click inside third-party iframes.

This runbook closes that gap.  One real-browser run of this procedure verifies
end-to-end that:

- The frontend loads and injects the Razorpay checkout.js SDK correctly.
- The Razorpay modal opens inside the browser (not just in script context).
- A real card-entry + OTP flow in the modal triggers the frontend success
  handler.
- The backend receives the real `razorpay_payment_id` and `razorpay_signature`
  and confirms the booking.

## When to run

**Required before any production deployment** that touches:

- `frontend/src/pages/TurfDetail.jsx` (booking / payment initiation)
- `frontend/src/pages/ReschedulePage.jsx` (PAYMENT case)
- `frontend/src/utils/razorpay.js` (SDK loading)
- `backend/.../BookingService.java` (bookings/initiate or bookings/confirm)
- Any change to `app.razorpay.key-id` or `app.razorpay.key-secret`
- Any Vite/build change that alters how external scripts are loaded

Also run after each major dependency upgrade (React, Vite, axios).

## Prerequisites

| Requirement | Value |
|---|---|
| Backend | Running on `http://localhost:8080` (or prod URL) |
| Frontend | Running on `http://localhost:5173` (dev) or prod URL |
| MySQL | Running and `bookmyturfdb` accessible |
| Test customer | A CUSTOMER-role account with known credentials |
| Razorpay mode | Test mode (`rzp_test_*` keys in `application-local.properties`) |
| Browser | Chrome or Chromium (real browser — **NOT** headless) |

### Starting the stack locally

```bash
# Terminal 1 — backend
cd backend && java -jar target/bookmyturf-backend-0.0.1-SNAPSHOT.jar

# Terminal 2 — frontend
cd frontend && npm run dev
```

Verify the backend is up:
```bash
curl http://localhost:8080/api/public/turfs
# Should return {"turfs":[...], "total":...}
```

## Steps

### 1. Open a real browser

Open Chrome.  Do **not** use Playwright, Puppeteer, or any headless runner.

Navigate to: `http://localhost:5173`

You should see the BookMyTurf landing page.

---

### 2. Log in as a test customer

Click **Sign in** (or navigate to `/login`).

Use an existing test customer account, e.g.:

| Field | Value |
|---|---|
| Email | `e2e_customer@bmt.test` (create via `/register` first if not present) |
| Password | `Test@1234` |

After successful login you should land on `/customer`.

---

### 3. Browse to the turfs list

Navigate to `/turfs`.

Verify that at least one **APPROVED** turf appears in the list.

---

### 4. Open a turf with available future slots

Click on any APPROVED turf (e.g. **Test Turf 7A**).

On the detail page:
- Select a future date using the date picker (at least 1 day ahead).
- Verify that slot buttons appear in the availability grid.

---

### 5. Select 2 contiguous slots

Click the **09:00–10:00** slot.  It should highlight as selected.

Click the **10:00–11:00** slot.  Both slots should now be selected and
the **Book now** button should become active.

---

### 6. Open the review modal and click Pay

Click **Book now**.

A review modal appears showing:
- Turf name
- Sub-court name
- Date
- Slots selected (2)
- Total amount

Click **Pay** (or **Confirm & Pay**).

---

### 7. Complete payment in the Razorpay modal

The Razorpay checkout modal opens inside the browser window.

Enter the test card details:

| Field | Value |
|---|---|
| Card number | `5267318187975449` |
| Expiry | `12 / 30` |
| CVV | `123` |
| Name on card | Any name (e.g. `Test User`) |

Click **Pay ₹X** (where X is the booking total).

An OTP prompt appears.  Enter: **`111111`**

Click **Submit** (or the OTP confirmation button).

---

### 8. Verify the success flow

The modal should close automatically after the OTP is accepted.

The frontend success handler fires and the browser navigates to:

```
/customer/bookings/{new_booking_id}
```

The receipt page should show:
- Booking status: **CONFIRMED**
- Booking date, turf, sub-court, slots
- Payment section: 1 payment entry, amount = total, status = SUCCESS
- A real `razorpay_payment_id` starting with `pay_` in the payment details

---

### 9. Verify DB state

```sql
-- Replace {booking_id} with the ID from the URL
SELECT b.id, b.status, b.booking_date
FROM   bookings b
WHERE  b.id = {booking_id};

SELECT p.razorpay_payment_id, p.amount, p.status
FROM   payments p
WHERE  p.booking_id = {booking_id};
```

Expected results:
- `bookings.status = 'CONFIRMED'`
- `payments.status = 'SUCCESS'`
- `payments.razorpay_payment_id` starts with `pay_` (a real Razorpay test-mode ID)

---

### 10. (Optional) Reschedule — PAYMENT case

To exercise the PAYMENT reschedule branch with the real modal:

1. On the receipt page, click **Reschedule**.
2. Select a new date/sub-court with a higher hourly price.
3. Click **Confirm reschedule** → pay the price difference in the Razorpay modal.
4. Verify the booking moves to the new slot and a second payment row exists with
   `amount = price_difference`.

---

## What to do if something fails

| Symptom | Likely cause | Action |
|---|---|---|
| Razorpay modal doesn't open | SDK not loaded or key invalid | Check browser console for `Razorpay is not defined` errors; verify `VITE_API_BASE_URL` and key config |
| Payment rejected | Expired test card or wrong CVV | Use exactly `5267318187975449 / 12/30 / 123` |
| OTP rejected | Wrong OTP | Use exactly `111111` (6 ones) |
| Modal closes but no redirect | Frontend success handler not firing | Check browser console for JS errors; look for `POST /api/customer/bookings/confirm` failure |
| Confirm returns 400 `HMAC mismatch` | Key-secret mismatch between Razorpay and backend | Verify `app.razorpay.key-secret` in `application-local.properties` matches the test key secret |
| Confirm returns 409 | Race condition — slot just became taken | Pick a different date and repeat from step 5 |

If the failure persists, capture:
1. Browser console output (F12 → Console)
2. Network tab — requests to `/api/customer/bookings/initiate` and `/api/customer/bookings/confirm`
3. Backend log (`backend/server.log`)
