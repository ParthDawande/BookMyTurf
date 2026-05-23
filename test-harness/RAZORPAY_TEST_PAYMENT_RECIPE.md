# Razorpay Test Payment Creation — CLI Recipe

> **TEST MODE ONLY. Throwaway procedure. Never use with live (`rzp_live_*`) keys.**
>
> `/payments/create/ajax` is Razorpay's internal checkout endpoint — it works for
> automated testing but is undocumented and unsupported. The production frontend
> must use the official Razorpay checkout.js, which Phase 9 will integrate.

---

Use this recipe when you need a fresh captured Razorpay payment that supports
refunds, and the existing test-mode payments in the account return
`BAD_REQUEST_ERROR: invalid request sent` on refund attempts (a known test-account
limitation for certain older payments).

---

## Step 1 — Create a Razorpay order via the booking initiate endpoint

```
POST /api/customer/bookings/initiate
Authorization: Bearer <customer JWT>
Content-Type: application/json
```

Normal authenticated call with a CONFIRMED customer token and the desired
sub-court, date, and slots. Returns `razorpay_order_id`.

---

## Step 2 — Submit payment via Razorpay's internal checkout endpoint

```
POST https://api.razorpay.com/v1/payments/create/ajax
Authorization: Basic <base64("rzp_test_key_id:")>
Content-Type: application/json
```

**Auth note:** encode `<key_id>:` (key ID, colon, empty secret) in base64.
```
echo -n "rzp_test_xxx:" | base64
```

Body:
```json
{
  "amount": <amount in paise>,
  "currency": "INR",
  "order_id": "<order_id from step 1>",
  "email": "<customer email>",
  "contact": "<customer phone>",
  "method": "card",
  "card": {
    "number": "5267318187975449",
    "expiry_month": "12",
    "expiry_year": "2030",
    "cvv": "123",
    "name": "Test User"
  }
}
```

`5267318187975449` is a Razorpay test-mode domestic MasterCard credit card that
reliably triggers the OTP flow and supports subsequent refunds.

**Response:** JSON with `"type": "otp"`, `payment_id`, and `submit_url`:
```
https://api.razorpay.com/v1/payments/<pay_xxx>/otp_submit/<token>?key_id=<key_id>
```

---

## Step 3 — Submit the test OTP to authorize the payment

```
POST <submit_url from step 2 response>
Content-Type: application/json

{"otp": "111111"}
```

`111111` is Razorpay's fixed success OTP for 3D Secure in test mode.

**Response:**
```json
{
  "razorpay_payment_id": "pay_xxx",
  "razorpay_order_id":   "order_xxx",
  "razorpay_signature":  "<hex HMAC-SHA256 signature>"
}
```

---

## Step 4 — Confirm the booking via the backend

```
POST /api/customer/bookings/confirm
Authorization: Bearer <customer JWT>
Content-Type: application/json

{
  "razorpay_order_id":   "<from step 3>",
  "razorpay_payment_id": "<from step 3>",
  "razorpay_signature":  "<from step 3>"
}
```

The backend verifies the HMAC signature, creates the payment row with
`status = SUCCESS`, creates booking slots, and returns the `booking_id`.
The resulting payment supports partial and full refunds via the Razorpay API.

---

## Caveats

- **Auth encoding:** `base64("key_id:")` — the colon is required; the secret is
  intentionally omitted. This mimics how the Razorpay frontend checkout
  authenticates without exposing the server secret to the browser.

- **Test mode only:** This flow works exclusively with `rzp_test_*` keys. Using it
  against live keys is impossible (the endpoint rejects live credentials) and must
  never be attempted.

- **Payment methods:** Some payment methods (netbanking, UPI) may be disabled on a
  given test account. Card with number `5267318187975449` reliably worked in the
  BookMyTurf test account. If a bank or method returns `bank_not_enabled` or
  similar, fall back to this card.

- **OTP token is single-use:** The `submit_url` token in step 3 is tied to the
  payment session and expires. If it expires before you call step 3, restart from
  step 2 (the order from step 1 is still valid and reusable).

- **Pre-existing payment refund failures:** Some captured test-mode payments
  return `BAD_REQUEST_ERROR: invalid request sent` on refund regardless of their
  state (captured, zero refunded). The cause is account-specific and unknown. Use
  a payment created by this recipe when you need a refundable one.

- **Signature is real:** The `razorpay_signature` returned in step 3 is a genuine
  HMAC-SHA256 over `order_id|payment_id` using the key secret. The backend's
  `Utils.verifyPaymentSignature()` call will pass. No mock or bypass is involved.
