# BookMyTurf — API Documentation

This document describes every REST endpoint exposed by the BookMyTurf backend, including request/response schemas, status codes, error responses, internal logic, and side effects.

All endpoints are prefixed with `/api`.

---

## Conventions

**Base URL (local):** `http://localhost:8080/api`

**Authentication:**
- Most endpoints require a JWT in the `Authorization` header: `Authorization: Bearer <token>`
- The JWT carries the user's `id`, `role`, and `status`
- Role-based access is enforced server-side

**Common error responses (apply to most endpoints):**
| Status Code | When | Response Body |
|---|---|---|
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | User's role is not allowed for this endpoint, or user is suspended/banned | `{ "error": "Forbidden" }` |
| 500 | Unexpected server error | `{ "error": "Internal server error" }` |

These are not repeated on individual endpoints unless the behavior differs.

**Date/time format:** ISO 8601 (e.g., `2026-05-13T18:00:00Z`)

**Money format:** Decimal with 2 places (e.g., `1500.00`), in INR.

---

## Table of Contents

- [Auth](#auth)
- [Customer](#customer)
- [Owner](#owner)
- [Admin](#admin)
- [Staff](#staff)
- [Notifications](#notifications)
- [Public](#public)

---

## Auth

### `POST /api/auth/register/customer`

**Description:** Register a new customer account with email and password. Account is active immediately upon successful registration.

**Authentication:** Not required (public endpoint).

**Path Parameters:** None.

**Query Parameters:** None.

**Request Body:**
```json
{
  "name": "string, required, 2-100 characters",
  "email": "string, required, valid email format, unique",
  "phone": "string, required, 10-digit Indian phone number (e.g., '9876543210'), unique",
  "password": "string, required, min 8 characters, must include 1 uppercase, 1 number, 1 special character",
  "city": "string, required, 2-80 characters",
  "preferred_sports": "array of strings, optional, e.g., ['Cricket', 'Football']"
}
```

**Response — Success (201 Created):**
```json
{
  "user_id": 1,
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "phone": "9876543210",
  "city": "Pune",
  "role": "CUSTOMER",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_expires_at": "2026-05-14T18:00:00Z"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (missing field, invalid email, weak password, invalid phone) | `{ "error": "Validation failed", "details": { "field_name": "error message" } }` |
| 409 | Email already registered | `{ "error": "Email already registered" }` |
| 409 | Phone already registered | `{ "error": "Phone number already registered" }` |

**Internal Logic:**
1. Validate the request body (format, length, uniqueness rules).
2. Check if `email` already exists in `users` table → if yes, return 409.
3. Check if `phone` already exists in `users` table → if yes, return 409.
4. Hash the password using BCrypt (cost factor 10–12).
5. Insert a new row into `users`:
   - `email`, `phone`, `password_hash`, `role = 'CUSTOMER'`, `status = 'ACTIVE'`
6. Insert a new row into `customer_profiles`:
   - `user_id` (from step 5), `name`, `city`, `preferred_sports` (joined as comma-separated or stored as JSON)
7. Generate a JWT containing `{ user_id, role, status }` with expiry (e.g., 24 hours).
8. Return 201 with user data + JWT.

**Side Effects:**
- New rows in `users` and `customer_profiles`.
- No notifications sent (welcome email is a v2 enhancement).

---

### `POST /api/auth/register/owner`

**Description:** Register a new turf owner account with email and password. Account is active immediately. Owners can immediately log in and start creating turf listings, but their listings will be in `PENDING` status until an admin approves them.

**Authentication:** Not required (public endpoint).

**Path Parameters:** None.

**Query Parameters:** None.

**Request Body:**
```json
{
  "name": "string, required, 2-100 characters",
  "email": "string, required, valid email format, unique",
  "phone": "string, required, 10-digit Indian phone number, unique",
  "password": "string, required, min 8 characters, must include 1 uppercase, 1 number, 1 special character",
  "bank_account_number": "string, optional, 9-18 digits (can be added later via profile update)",
  "ifsc_code": "string, optional, 11 characters in format AAAA0XXXXXX (can be added later)"
}
```

**Response — Success (201 Created):**
```json
{
  "user_id": 12,
  "name": "Vikram Patel",
  "email": "vikram@example.com",
  "phone": "9876543211",
  "role": "OWNER",
  "bank_details_complete": false,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_expires_at": "2026-05-14T18:00:00Z",
  "note": "Bank details are required before payouts can be processed. Update them via PUT /api/owner/profile."
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed | `{ "error": "Validation failed", "details": { "field_name": "error message" } }` |
| 400 | IFSC format invalid (if provided) | `{ "error": "Invalid IFSC code format" }` |
| 409 | Email already registered | `{ "error": "Email already registered" }` |
| 409 | Phone already registered | `{ "error": "Phone number already registered" }` |

**Internal Logic:**
1. Validate request body (format, length, IFSC pattern if present).
2. Check `email` uniqueness in `users` → if exists, return 409.
3. Check `phone` uniqueness in `users` → if exists, return 409.
4. Hash password using BCrypt.
5. Insert into `users`:
   - `email`, `phone`, `password_hash`, `role = 'OWNER'`, `status = 'ACTIVE'`
6. Insert into `owner_profiles`:
   - `user_id`, `name`, `bank_account_number` (NULL if not provided), `ifsc_code` (NULL if not provided)
7. Generate JWT and return 201.
8. Set `bank_details_complete` flag in response based on whether both bank fields are filled.

**Side Effects:**
- New rows in `users` and `owner_profiles`.
- No turf listing is created at this point — owner must explicitly create one via `POST /api/owner/turfs`.
- No notification sent.

**Notes:**
- Bank details are optional at registration but required before the first payout can be processed. The system should remind the owner via UI prompts (frontend responsibility) until both fields are filled.
- IFSC and bank account are stored as plain strings; no validation against real bank infrastructure (payouts are simulated).

---

### `POST /api/auth/login`

**Description:** Authenticate any user (customer, owner, staff, or admin) with email and password. Returns a JWT containing the user's role and ID.

**Authentication:** Not required (public endpoint).

**Path Parameters:** None.

**Query Parameters:** None.

**Request Body:**
```json
{
  "email": "string, required, valid email format",
  "password": "string, required"
}
```

**Response — Success (200 OK):**
```json
{
  "user_id": 12,
  "name": "Vikram Patel",
  "email": "vikram@example.com",
  "role": "OWNER",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_expires_at": "2026-05-14T18:00:00Z"
}
```

> `role` will be one of `CUSTOMER`, `OWNER`, `STAFF`, or `ADMIN`. The frontend uses this to redirect to the correct dashboard.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (missing email or password) | `{ "error": "Validation failed", "details": { "field_name": "error message" } }` |
| 401 | Email not registered OR password incorrect | `{ "error": "Invalid email or password" }` |
| 403 | Account is suspended | `{ "error": "Account suspended. Contact support." }` |
| 403 | Account is banned | `{ "error": "Account banned." }` |

> **Note:** For 401, we deliberately return the same generic message whether the email is unknown or the password is wrong. This prevents attackers from probing which emails are registered.

**Internal Logic:**
1. Validate request body (email format, password not empty).
2. Look up user by `email` in `users` table.
3. If no user found → return 401 with generic message.
4. Compare submitted password against stored `password_hash` using BCrypt.
5. If mismatch → return 401 with generic message.
6. Check `users.status`:
   - If `SUSPENDED` → return 403 with "Account suspended" message.
   - If `BANNED` → return 403 with "Account banned" message.
   - If `ACTIVE` → continue.
7. Fetch corresponding profile (`customer_profiles`, `owner_profiles`, `staff_profiles`, or `admin_profiles`) based on role to get `name`.
8. Generate JWT containing `{ user_id, role, status }` with expiry (24 hours).
9. Return 200 with user data + JWT.

**Side Effects:**
- No DB writes. Login is stateless (JWT-based).
- No login history is recorded (audit logs are out of scope per the README).

**Notes:**
- The frontend should store the JWT (in `localStorage` or `httpOnly` cookie) and attach it to every subsequent request as `Authorization: Bearer <token>`.
- Token expiry is 24 hours. After that, the user must log in again. (Refresh tokens are a v2 enhancement.)

---

---

## Customer

### `GET /api/customer/profile`

**Description:** Retrieve the profile of the currently authenticated customer. Returns combined data from `users` and `customer_profiles` tables.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:** None.

**Query Parameters:** None.

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "user_id": 1,
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "phone": "9876543210",
  "city": "Pune",
  "preferred_sports": ["Cricket", "Football"],
  "created_at": "2026-05-01T10:30:00Z"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-customer role (owner, staff, admin) | `{ "error": "Forbidden" }` |
| 404 | User exists in JWT but no `customer_profiles` row found (data integrity issue) | `{ "error": "Profile not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from the JWT (handled by the JWT filter / Spring Security).
2. Validate `role == CUSTOMER`. If not → 403.
3. Query `users` table for `id = user_id` to get `email`, `phone`, `created_at`.
4. Query `customer_profiles` for `user_id` to get `name`, `city`, `preferred_sports`.
5. If profile not found → 404 (rare; indicates DB inconsistency).
6. Parse `preferred_sports` (stored as comma-separated or JSON) back into an array.
7. Combine and return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- The `user_id` always comes from the JWT, never from a URL param. This prevents an attacker from passing someone else's ID.
- `password_hash` is **never** returned in any response, even though it's in the `users` table.

---

### `PUT /api/customer/profile`

**Description:** Update the authenticated customer's profile. Customers can change their name, city, and preferred sports. Email, phone, and password cannot be changed via this endpoint (those would need dedicated flows with verification, which are v2 enhancements).

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:** None.

**Query Parameters:** None.

**Request Body:**
```json
{
  "name": "string, optional, 2-100 characters",
  "city": "string, optional, 2-80 characters",
  "preferred_sports": "array of strings, optional, e.g., ['Cricket', 'Badminton']"
}
```

> All fields are optional. Only the fields included in the request body get updated. Omitted fields stay unchanged.

**Response — Success (200 OK):**
```json
{
  "user_id": 1,
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "phone": "9876543210",
  "city": "Mumbai",
  "preferred_sports": ["Cricket", "Badminton"],
  "updated_at": "2026-05-14T11:45:00Z"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (name too long, city too long, etc.) | `{ "error": "Validation failed", "details": { "field_name": "error message" } }` |
| 400 | Request body is empty (no fields to update) | `{ "error": "At least one field must be provided" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-customer role | `{ "error": "Forbidden" }` |
| 404 | Profile not found (data integrity issue) | `{ "error": "Profile not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from the JWT.
2. Validate `role == CUSTOMER`. If not → 403.
3. Validate request body: at least one field must be present, each field must pass its own format rules.
4. Fetch the existing `customer_profiles` row for `user_id`. If not found → 404.
5. For each field present in the request body, update the corresponding column in `customer_profiles`.
6. Set `updated_at = now()` in the `users` table (so the timestamp reflects the change).
7. Return the full updated profile (200).

**Side Effects:**
- Updates row in `customer_profiles`.
- No notifications sent.

**Notes:**
- Email, phone, and password changes are intentionally not supported here. Changing those should require re-verification flows (out of scope for v1).
- Validation is per-field — if `name` is invalid but `city` is valid, the entire request fails with 400, no partial updates.

---

### `GET /api/customer/turfs`

**Description:** Search and list approved, active turfs based on filters. Only returns turfs with `status = APPROVED`. Supports pagination, filtering, and basic sorting.

**Authentication:** Required. Role: `CUSTOMER` only.

> Note: A separate public version (`GET /api/public/turfs`) exists for browsing without login.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `city` | string | No | Filter by city (case-insensitive exact match, e.g., `Pune`) |
| `sport` | string | No | Filter by sport (e.g., `Cricket`, `Football`) — turf must have at least one sub-court supporting this sport |
| `min_price` | decimal | No | Minimum hourly price across sub-courts (e.g., `300.00`) |
| `max_price` | decimal | No | Maximum hourly price across sub-courts (e.g., `1500.00`) |
| `min_rating` | decimal | No | Minimum average rating (e.g., `4.0`) |
| `sort_by` | string | No | One of: `price_asc`, `price_desc`, `rating_desc`, `newest` (default: `rating_desc`) |
| `page` | integer | No | Page number, 1-indexed (default: `1`) |
| `page_size` | integer | No | Results per page (default: `10`, max: `50`) |

> All filters are optional and combinable. If no filters are provided, returns all approved turfs sorted by rating.

**Request Body:** None (GET request).

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 10,
  "total_results": 47,
  "total_pages": 5,
  "turfs": [
    {
      "turf_id": 15,
      "name": "Greenfield Sports Arena",
      "city": "Pune",
      "address": "Plot 12, Baner Road, Pune",
      "thumbnail_url": "https://cdn.example.com/turf_15_main.jpg",
      "sports": ["Cricket", "Football"],
      "min_hourly_price": 600.00,
      "max_hourly_price": 1200.00,
      "avg_rating": 4.5,
      "review_count": 87
    },
    {
      "turf_id": 23,
      "name": "Champions Turf",
      "city": "Pune",
      "address": "MG Road, Pune",
      "thumbnail_url": "https://cdn.example.com/turf_23_main.jpg",
      "sports": ["Football"],
      "min_hourly_price": 800.00,
      "max_hourly_price": 800.00,
      "avg_rating": 4.2,
      "review_count": 32
    }
  ]
}
```

> Each turf in the list shows the **price range across all its sub-courts** (`min_hourly_price` and `max_hourly_price`), not the price of any single sub-court.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter (e.g., `min_price` is negative, `min_rating > 5`, `page < 1`) | `{ "error": "Invalid query parameter", "details": { "param": "reason" } }` |
| 400 | `min_price > max_price` | `{ "error": "min_price cannot be greater than max_price" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-customer role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Validate query parameters (numbers in range, valid sort_by, valid page values).
3. Build a JPA / native SQL query against the `turfs` table:
   - Always filter `turfs.status = 'APPROVED'`
   - Always join to `sub_courts` and require at least one with `sub_courts.status = 'APPROVED'`
   - If `city` provided → `WHERE LOWER(city) = LOWER(:city)`
   - If `sport` provided → `JOIN sub_courts sc ON sc.turf_id = turfs.id WHERE JSON_CONTAINS(LOWER(sc.sports), LOWER(:sport)) AND sc.status = 'APPROVED'` (match against the JSON array on any approved sub-court)
   - If `min_rating` → `WHERE avg_rating >= :min_rating`
   - For price filtering, the join is restricted to APPROVED sub-courts:
     - `min_price` → `WHERE EXISTS (approved sub_court with hourly_price >= :min_price)`
     - `max_price` → `WHERE EXISTS (approved sub_court with hourly_price <= :max_price)`
4. Apply sorting:
   - `price_asc` / `price_desc` → sort by `MIN(sub_courts.hourly_price)`
   - `rating_desc` → sort by `avg_rating DESC, review_count DESC`
   - `newest` → sort by `created_at DESC`
5. Apply pagination (`LIMIT page_size OFFSET (page-1) * page_size`).
6. For each turf returned, fetch:
   - `thumbnail_url` → first photo from `turf_photos` (or NULL if no photos)
   - `sports` → union of all approved sports across this turf's APPROVED sub-courts (read from each `sub_courts.sports` JSON array)
   - `min_hourly_price` and `max_hourly_price` → MIN/MAX of `sub_courts.hourly_price` for APPROVED sub-courts only
7. Compute `total_results` (a separate `COUNT(*)` query with the same filters minus pagination).
8. Compute `total_pages = ceil(total_results / page_size)`.
9. Return the response (200).

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- Performance: at scale, this query joins multiple tables and may need composite indexes on `(turfs.status, turfs.city)` and on `sub_courts.turf_id`. For the JSON sports filter, MySQL 8.x supports indexes on JSON arrays via generated columns if needed.
- Sub-courts without slots configured shouldn't filter the turf out of results — even an "empty" approved turf shows up. (Customer just won't be able to book it.)
- Turfs with `status != APPROVED` are NEVER returned, even if other filters match.

---

### `GET /api/customer/turfs/{id}`

**Description:** Retrieve the full details of a single turf, including all photos, supported sports, sub-courts with pricing, owner contact, and recent reviews. Only returns turfs with `status = APPROVED`.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The turf's unique ID |

**Query Parameters:** None.

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "turf_id": 15,
  "name": "Greenfield Sports Arena",
  "description": "Premium artificial turf with floodlights, changing rooms, and parking.",
  "address": "Plot 12, Baner Road, Pune",
  "city": "Pune",
  "owner_phone": "9876543211",
  "photos": [
    "https://cdn.example.com/turf_15_main.jpg",
    "https://cdn.example.com/turf_15_court.jpg",
    "https://cdn.example.com/turf_15_facility.jpg"
  ],
  "all_sports": ["Cricket", "Football"],
  "avg_rating": 4.5,
  "review_count": 87,
  "sub_courts": [
    {
      "sub_court_id": 41,
      "name": "Court A",
      "sports": ["Cricket", "Football"],
      "hourly_price": 600.00,
      "opening_hour": "06:00",
      "closing_hour": "23:00"
    },
    {
      "sub_court_id": 42,
      "name": "Court B",
      "sports": ["Football"],
      "hourly_price": 1200.00,
      "opening_hour": "06:00",
      "closing_hour": "23:00"
    }
  ],
  "recent_reviews": [
    {
      "review_id": 102,
      "customer_name": "Amit K.",
      "rating": 5,
      "review_text": "Excellent turf, well maintained.",
      "created_at": "2026-05-10T14:30:00Z",
      "owner_reply": {
        "reply_text": "Thanks Amit, see you soon!",
        "created_at": "2026-05-11T09:00:00Z"
      }
    },
    {
      "review_id": 98,
      "customer_name": "Priya S.",
      "rating": 4,
      "review_text": "Good lighting, parking could be better.",
      "created_at": "2026-05-08T19:15:00Z",
      "owner_reply": null
    }
  ]
}
```

> `customer_name` is masked for privacy — first name + last-name-initial only.
> `recent_reviews` returns the latest 5 reviews. For full review list, a separate endpoint can be added in v2.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-customer role | `{ "error": "Forbidden" }` |
| 404 | Turf does not exist | `{ "error": "Turf not found" }` |
| 404 | Turf exists but `turfs.status != APPROVED`, OR no APPROVED sub-courts exist (customer shouldn't see it) | `{ "error": "Turf not found" }` |

> All "not visible to customer" cases return 404 with the same message to avoid leaking whether a private/pending turf exists.

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Query `turfs` by `id`. If not found OR `turfs.status != APPROVED` → 404.
3. Fetch all sub-courts for this turf where `sub_courts.status = 'APPROVED'`. If none → 404 (turf exists but has nothing bookable).
4. Fetch `owner_phone` from the linked `users` row (or `owner_profiles` — same person).
5. Fetch all photos from `turf_photos` ordered by `id` (first one is treated as thumbnail).
6. Compute `all_sports` = union of all APPROVED sub-courts' sports (set union, deduplicated).
7. Fetch the 5 most recent reviews from `reviews` for this turf, ordered by `created_at DESC`:
   - For each review, fetch `customer_name` from `customer_profiles` and mask it (e.g., "Amit Kumar" → "Amit K.")
   - For each review, fetch the corresponding `review_replies` row if it exists
8. Combine everything into the response and return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- `owner_phone` is exposed so customers can call the owner directly (matches your earlier decision: contact owner via phone, no in-app chat).
- Customer name masking protects privacy of past reviewers.
- Performance: this endpoint does ~5 separate queries. They could be batched or use JOIN FETCH in JPA to reduce round trips.

---

### `GET /api/customer/turfs/{id}/availability`

**Description:** Retrieve the available and booked hourly slots for all sub-courts of a turf on a given date. Used by the booking UI to render the slot picker.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The turf's unique ID |

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `date` | string (YYYY-MM-DD) | Yes | The date to check availability for, e.g., `2026-05-20` |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "turf_id": 15,
  "date": "2026-05-20",
  "sub_courts": [
    {
      "sub_court_id": 41,
      "name": "Court A",
      "hourly_price": 600.00,
      "opening_hour": "06:00",
      "closing_hour": "23:00",
      "slots": [
        { "start_time": "06:00", "end_time": "07:00", "available": true },
        { "start_time": "07:00", "end_time": "08:00", "available": true },
        { "start_time": "08:00", "end_time": "09:00", "available": false },
        { "start_time": "09:00", "end_time": "10:00", "available": true },
        { "start_time": "18:00", "end_time": "19:00", "available": false },
        { "start_time": "19:00", "end_time": "20:00", "available": true }
      ]
    },
    {
      "sub_court_id": 42,
      "name": "Court B",
      "hourly_price": 1200.00,
      "opening_hour": "06:00",
      "closing_hour": "23:00",
      "slots": [
        { "start_time": "06:00", "end_time": "07:00", "available": true },
        { "start_time": "07:00", "end_time": "08:00", "available": false }
      ]
    }
  ]
}
```

> Slots are returned for the **entire operating window** (e.g., 06:00 → 23:00 = 17 slots per sub-court). Past slots on the current date are marked `available: false`.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | `date` parameter missing or invalid format | `{ "error": "Invalid date. Use YYYY-MM-DD format." }` |
| 400 | `date` is in the past (before today) | `{ "error": "Cannot check availability for past dates" }` |
| 400 | `date` is too far in the future (e.g., more than 90 days ahead — booking horizon limit) | `{ "error": "Bookings can only be made up to 90 days in advance" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-customer role | `{ "error": "Forbidden" }` |
| 404 | Turf not found or `status != APPROVED` | `{ "error": "Turf not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Validate `date` query parameter:
   - Must be a valid date in `YYYY-MM-DD` format.
   - Must be today or future, but not more than 90 days ahead.
3. Fetch the turf by `id`. If not found OR `turfs.status != APPROVED` → 404.
4. Fetch all `sub_courts` for this turf where `sub_courts.status = 'APPROVED'`. If none → 404.
5. For each sub-court:
   - Generate all hourly slots from `opening_hour` to `closing_hour` (e.g., 06:00–07:00, 07:00–08:00, …).
   - Query `booking_slots` JOIN `bookings` for:
     - `bookings.sub_court_id = sub_court.id`
     - `bookings.booking_date = :date`
     - `bookings.status IN ('CONFIRMED', 'COMPLETED')` — cancelled and refunded bookings free the slot.
   - For each generated slot, set `available = false` if there's a matching `booking_slot` row, else `available = true`.
   - If `date` is today, also mark slots with `start_time <= now()` as `available = false` (can't book a slot that's already started or passed).
6. Return the response (200).

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- The 90-day booking horizon is a business rule — adjust as needed.
- This endpoint is **race-condition-prone** at the booking step: two customers could see the same "available" slot, then both try to book it. The actual booking endpoint (next) must handle this with a unique constraint or transactional locking.
- Performance: for a turf with many sub-courts, this endpoint generates ~10-20 slots × N sub-courts. Slot generation should be in-memory (loop in Java), not in SQL.

---

### `POST /api/customer/bookings/initiate`

**Description:** Validate a proposed booking and create a Razorpay order. **Does NOT persist the booking yet.** The booking is only created after payment is verified via `/confirm`. Returns the Razorpay order details so the frontend can launch checkout.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:** None.

**Query Parameters:** None.

**Request Body:**
```json
{
  "sub_court_id": 41,
  "booking_date": "2026-05-20",
  "slots": [
    { "start_time": "18:00", "end_time": "19:00" },
    { "start_time": "19:00", "end_time": "20:00" }
  ]
}
```

> All slots must be on the **same sub-court** and **same date**. To book different sub-courts or dates, the customer makes separate bookings.

**Response — Success (200 OK):**
```json
{
  "sub_court_id": 41,
  "sub_court_name": "Court A",
  "turf_name": "Greenfield Sports Arena",
  "booking_date": "2026-05-20",
  "slots": [
    { "start_time": "18:00", "end_time": "19:00", "rate_at_booking": 600.00 },
    { "start_time": "19:00", "end_time": "20:00", "rate_at_booking": 600.00 }
  ],
  "total_amount": 1200.00,
  "razorpay_order_id": "order_NXyZ123abc456",
  "razorpay_key_id": "rzp_test_abc123"
}
```

> Note: `booking_id` is NOT returned here, because no booking exists yet.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (missing fields, invalid date/time format, empty slots) | `{ "error": "Validation failed", "details": { ... } }` |
| 400 | `booking_date` in the past or beyond 90 days | `{ "error": "Invalid booking date" }` |
| 400 | Slots not contiguous hourly slots or outside operating hours | `{ "error": "Invalid slot configuration" }` |
| 404 | Sub-court not found or its turf `status != APPROVED` | `{ "error": "Sub-court not available for booking" }` |
| 409 | One or more requested slots are already booked (CONFIRMED bookings exist) | `{ "error": "One or more slots are no longer available", "unavailable_slots": [...] }` |
| 502 | Razorpay order creation failed | `{ "error": "Unable to create payment order. Please try again." }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Validate request body (fields present, formats correct).
3. Fetch the sub-court by `sub_court_id`. If not found OR `sub_courts.status != APPROVED` OR turf `status != APPROVED` → 404.
4. Validate each slot is exactly 1 hour and falls within sub-court's `opening_hour`–`closing_hour`. Else → 400.
5. Validate `booking_date` is today–or–future, within 90-day horizon.
6. Check slot availability:
   - Query `booking_slots` JOIN `bookings` WHERE `sub_court_id = X AND booking_date = Y AND status IN ('CONFIRMED', 'COMPLETED')`.
   - For each requested slot, check there's no overlap with existing bookings.
   - If any slot is taken → 409 with list of unavailable slots.
7. Read `hourly_price` from `sub_courts` — this will be the `rate_at_booking`.
8. Compute `total_amount = number_of_slots × hourly_price`.
9. Call Razorpay API to create an order:
   - `amount = total_amount × 100` (paise)
   - `currency = "INR"`
   - `receipt = "init_" + user_id + "_" + timestamp`
   - `notes = { customer_id, sub_court_id, booking_date, slots_json }` — important: store the booking details in Razorpay's notes so we can reconstruct them in `/confirm`
10. If Razorpay fails → 502.
11. Return 200 with order details. **No DB writes occurred.**

**Side Effects:**
- Razorpay order created server-side.
- No DB writes.
- The booking intent is encoded in Razorpay's `notes` field — the `/confirm` endpoint reads it back from there.

**Notes:**
- Since the booking doesn't exist yet, two customers could initiate the same slot simultaneously. Both get valid Razorpay orders. Whichever's `/confirm` runs first wins. The other gets a 409 + auto-refund.
- We rely on Razorpay's `notes` field to remember the booking intent (sub_court, date, slots). Alternative: store it in a Redis/cache keyed by `razorpay_order_id`. For v1, notes are simpler.

---

### `POST /api/customer/bookings/confirm`

**Description:** Verify a completed Razorpay payment, and if valid, create the booking and associated records in the database. This is the **only** endpoint that actually creates a booking — `/initiate` is just validation + Razorpay order creation. If slot availability has changed since `/initiate` (race condition), the payment is automatically refunded via Razorpay.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:** None.

**Query Parameters:** None.

**Request Body:**
```json
{
  "razorpay_order_id": "order_NXyZ123abc456",
  "razorpay_payment_id": "pay_NXyZ789def012",
  "razorpay_signature": "9d8f7e6c5b4a3210..."
}
```

> These three values are returned by Razorpay Checkout to the frontend upon successful payment. The frontend just forwards them to this endpoint.

**Response — Success (201 Created):**
```json
{
  "booking_id": 1024,
  "status": "CONFIRMED",
  "sub_court_id": 41,
  "sub_court_name": "Court A",
  "turf_name": "Greenfield Sports Arena",
  "booking_date": "2026-05-20",
  "slots": [
    { "start_time": "18:00", "end_time": "19:00", "rate_at_booking": 600.00 },
    { "start_time": "19:00", "end_time": "20:00", "rate_at_booking": 600.00 }
  ],
  "total_amount": 1200.00,
  "payment_id": 512,
  "razorpay_payment_id": "pay_NXyZ789def012",
  "created_at": "2026-05-14T12:05:00Z"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Missing one or more of the three razorpay fields | `{ "error": "Missing payment verification data" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-customer role | `{ "error": "Forbidden" }` |
| 403 | Razorpay signature verification failed (tampering or fraud attempt) | `{ "error": "Invalid payment signature" }` |
| 404 | Razorpay order_id doesn't exist or has no `notes` (couldn't have come from `/initiate`) | `{ "error": "Order not found" }` |
| 409 | Slots have been booked by another customer between `/initiate` and `/confirm`. Auto-refund issued. | `{ "error": "Slots no longer available. Your payment has been refunded.", "razorpay_refund_id": "rfnd_..." }` |
| 502 | Razorpay API failure during refund (after slot conflict was detected) | `{ "error": "Payment captured but booking could not be confirmed. Support has been notified.", "razorpay_payment_id": "..." }` |

**Internal Logic:**

This must be wrapped in a **database transaction** with `SELECT ... FOR UPDATE` on the sub-court row to serialize concurrent confirms.

1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Validate all three razorpay fields are present.

3. **Verify the Razorpay signature** (critical security step):
   - Razorpay's signature is computed as: `HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)`
   - Compute the same on backend and compare with the submitted `razorpay_signature`.
   - If mismatch → 403 (this is the proof that the payment is real and untampered).

4. Fetch the Razorpay order via API using `razorpay_order_id`:
   - Extract `notes` field which contains `{ customer_id, sub_court_id, booking_date, slots_json, total_amount }`.
   - If order not found or no notes → 404.
   - Verify `notes.customer_id == user_id` (must be same customer who initiated) → else 403.
   - Verify Razorpay's `payment.status == "captured"` → else 400.

5. Begin DB transaction.

6. Lock the sub-court row: `SELECT ... FOR UPDATE` on `sub_courts` where `id = notes.sub_court_id`.

7. Fetch the sub-court — if `sub_courts.status != APPROVED` OR turf `status != APPROVED` (rare, but owner could have been suspended or sub-court rejected) → rollback, refund, return 409.

8. Re-check slot availability for `sub_court_id`, `booking_date`, slots (same query as `/initiate` step 6):
   - If any conflict → rollback transaction → call Razorpay Refund API for the full amount → return 409 with the refund ID.

9. Use `rate_at_booking` from the Razorpay notes (price freezing must match what the customer agreed to pay).
   - Sanity check: `notes.total_amount` must equal what Razorpay actually charged. If mismatch → critical inconsistency, log and return 502.

10. Compute `commission_amount = total_amount × platform_commission_rate`.

11. Insert into `bookings`:
    - `customer_id = user_id`, `sub_court_id`, `booking_date`, `total_amount`, `commission_amount`, `status = 'CONFIRMED'`

12. Insert each slot into `booking_slots`:
    - `booking_id`, `start_time`, `end_time`, `rate_at_booking` (frozen from notes)

13. Insert into `payments`:
    - `booking_id`, `amount = total_amount`, `payment_method` (from Razorpay response: `UPI` / `CARD` / `NETBANKING` / `WALLET` / `EMI` / `PAYLATER`), `gateway_transaction_id = razorpay_payment_id`, `status = 'SUCCESS'`

14. Insert into `payouts` (pre-schedule the owner's payout):
    - `owner_id` (fetch from turf), `booking_id`, `amount = total_amount - commission_amount`, `status = 'PENDING'`, `scheduled_at = booking_date + last_slot_end_time + X hours` (auto-payout delay)

15. Insert an in-app notification for the **owner** that a new booking was made.

16. Commit transaction.

17. Return 201.

**Side Effects:**
- New rows in `bookings`, `booking_slots`, `payments`, `payouts`.
- New row in `notifications` for the owner.
- If race condition → Razorpay refund issued (and `refunds` row inserted to track, with `razorpay_refund_id` stored).

**Notes:**
- **Signature verification is non-negotiable.** Without it, anyone could fake a successful payment by POSTing fake values. The signature is the proof that the payment came from Razorpay.
- The **race-condition refund** is the cost of the simplified design. In test mode, refunds are instant; in production, they take 5–7 working days.
- This endpoint is the only place where `bookings.status = CONFIRMED` is set on creation.
- The `payouts` row created here is in `PENDING` status. A scheduled job (separate cron) flips it to `PAID` after the configured delay following slot completion.

---

### `GET /api/customer/bookings`

**Description:** List the authenticated customer's own bookings. Supports filtering by status (upcoming, past, cancelled) and pagination.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `filter` | string | No | One of: `upcoming`, `past`, `cancelled`, `all` (default: `all`) |
| `sort_by` | string | No | One of: `date_desc` (newest first), `date_asc` (oldest first). Default: `date_desc` |
| `page` | integer | No | Page number, 1-indexed (default: `1`) |
| `page_size` | integer | No | Results per page (default: `10`, max: `50`) |

> Filter meanings:
> - `upcoming` → `booking_date > today OR (booking_date = today AND last slot end_time > now)` AND `status = 'CONFIRMED'`
> - `past` → `booking_date < today OR (booking_date = today AND last slot end_time < now)` AND `status IN ('CONFIRMED', 'COMPLETED')`
> - `cancelled` → `status IN ('CANCELLED', 'REFUNDED')`
> - `all` → everything (no status/date filter)

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 10,
  "total_results": 27,
  "total_pages": 3,
  "bookings": [
    {
      "booking_id": 1024,
      "turf_id": 15,
      "turf_name": "Greenfield Sports Arena",
      "sub_court_name": "Court A",
      "booking_date": "2026-05-20",
      "slot_summary": "18:00 – 20:00",
      "slot_count": 2,
      "total_amount": 1200.00,
      "status": "CONFIRMED",
      "is_upcoming": true,
      "can_reschedule": true,
      "can_cancel": true,
      "created_at": "2026-05-14T12:05:00Z"
    },
    {
      "booking_id": 1011,
      "turf_id": 23,
      "turf_name": "Champions Turf",
      "sub_court_name": "Main Field",
      "booking_date": "2026-05-08",
      "slot_summary": "19:00 – 20:00",
      "slot_count": 1,
      "total_amount": 800.00,
      "status": "COMPLETED",
      "is_upcoming": false,
      "can_reschedule": false,
      "can_cancel": false,
      "created_at": "2026-05-05T10:30:00Z"
    }
  ]
}
```

> `slot_summary` shows the contiguous time range (e.g., `18:00 – 20:00` for two slots).
> `can_reschedule` and `can_cancel` are computed booleans based on the cancellation/reschedule policy (X hours before slot). The frontend uses these to enable/disable buttons.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid `filter` or `sort_by` value | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-customer role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Validate query parameters.
3. Build the base query: `SELECT * FROM bookings WHERE customer_id = :user_id`
4. Apply the `filter`:
   - `upcoming`: add `AND status = 'CONFIRMED' AND (booking_date > CURRENT_DATE OR (booking_date = CURRENT_DATE AND max_slot_end_time > NOW))`
   - `past`: add `AND status IN ('CONFIRMED', 'COMPLETED') AND (booking_date < CURRENT_DATE OR (booking_date = CURRENT_DATE AND max_slot_end_time < NOW))`
   - `cancelled`: add `AND status IN ('CANCELLED', 'REFUNDED')`
   - `all`: no extra filter
5. Apply sort and pagination.
6. For each booking, fetch:
   - Sub-court + turf details (JOIN with `sub_courts` and `turfs`)
   - Slot range from `booking_slots` (MIN start_time, MAX end_time, count)
7. Compute booleans:
   - `is_upcoming`: `status == CONFIRMED AND (booking_date > today OR (booking_date == today AND last slot end_time > now))`
   - `can_reschedule`: `is_upcoming AND (booking_date_time - now) > X hours` (configured reschedule window)
   - `can_cancel`: `is_upcoming AND (booking_date_time - now) > X hours` (configured cancellation window)
8. Return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- Customers never see bookings made by other customers — `customer_id` is always pulled from the JWT, never from a query parameter.
- The "X hours" thresholds for reschedule and cancel are application-level constants (e.g., 24 hours, configurable later).

---

### `GET /api/customer/bookings/{id}`

**Description:** Retrieve full details of a single booking, including all slots, payment info, refund info (if applicable), and turf details. The booking must belong to the authenticated customer.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The booking's unique ID |

**Query Parameters:** None.

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "booking_id": 1024,
  "status": "CONFIRMED",
  "is_upcoming": true,
  "can_reschedule": true,
  "can_cancel": true,
  "turf": {
    "turf_id": 15,
    "name": "Greenfield Sports Arena",
    "address": "Plot 12, Baner Road, Pune",
    "city": "Pune",
    "owner_phone": "9876543211"
  },
  "sub_court": {
    "sub_court_id": 41,
    "name": "Court A"
  },
  "booking_date": "2026-05-20",
  "slots": [
    { "start_time": "18:00", "end_time": "19:00", "rate_at_booking": 600.00 },
    { "start_time": "19:00", "end_time": "20:00", "rate_at_booking": 600.00 }
  ],
  "total_amount": 1200.00,
  "commission_amount": 120.00,
  "payment": {
    "payment_id": 512,
    "amount": 1200.00,
    "payment_method": "UPI",
    "gateway_transaction_id": "pay_NXyZ789def012",
    "status": "SUCCESS",
    "created_at": "2026-05-14T12:05:00Z"
  },
  "refund": null,
  "created_at": "2026-05-14T12:05:00Z"
}
```

> For a cancelled booking, `refund` will be populated:
> ```json
> "refund": {
>   "refund_id": 88,
>   "amount": 1200.00,
>   "razorpay_refund_id": "rfnd_XYZ123",
>   "status": "SUCCESS",
>   "processed_at": "2026-05-18T10:00:00Z"
> }
> ```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-customer role | `{ "error": "Forbidden" }` |
| 403 | Booking exists but `customer_id` doesn't match JWT (someone else's booking) | `{ "error": "Forbidden" }` |
| 404 | Booking does not exist | `{ "error": "Booking not found" }` |

> "Booking belongs to someone else" returns 403 (not 404) — the booking does exist, the user just isn't authorized.

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Fetch booking by `id`. If not found → 404.
3. Verify `booking.customer_id == user_id`. Else → 403.
4. Fetch related rows:
   - `sub_courts` and `turfs` (for turf info, owner phone)
   - `booking_slots` (all slots)
   - `payments` (single row per booking)
   - `refunds` (NULL if no refund yet, otherwise full row)
5. Compute booleans:
   - `is_upcoming`, `can_reschedule`, `can_cancel` — same logic as the list endpoint.
6. Return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- This endpoint is the source for the customer's "view booking details" page and is also used by the receipt-generation endpoint internally.
- `payment.gateway_transaction_id` (Razorpay's `pay_xxx` ID) is shown so the customer can match it with their bank/UPI statement.
- `commission_amount` is exposed for transparency. Hide it via DTO mapping if not desired.

---

### `GET /api/customer/bookings/{id}/receipt`

**Description:** Generate and download a simple PDF receipt for a specific booking. The receipt includes booking details, slot breakdown, payment info, and refund info (if applicable). This is **not** a GST-compliant invoice — just a simple receipt.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The booking's unique ID |

**Query Parameters:** None.

**Request Body:** None.

**Response — Success (200 OK):**

Content-Type: `application/pdf`

The response body is the raw PDF file. The browser receives it with a `Content-Disposition: attachment; filename="receipt_booking_<id>.pdf"` header so it triggers a download.

**PDF Contents (template):**
```
═══════════════════════════════════════
              BOOKMYTURF
              Booking Receipt
═══════════════════════════════════════

Booking ID:       1024
Status:           CONFIRMED
Booked on:        14 May 2026, 12:05 PM

─── Turf Details ───
Turf:             Greenfield Sports Arena
Address:          Plot 12, Baner Road, Pune
Sub-court:        Court A
Owner contact:    9876543211

─── Slot Details ───
Date:             20 May 2026
Slots:            18:00 – 19:00  ₹600.00
                  19:00 – 20:00  ₹600.00
                                 ────────
Total:                          ₹1200.00

─── Payment Details ───
Method:           UPI
Transaction ID:   pay_NXyZ789def012
Paid on:          14 May 2026, 12:05 PM
Amount paid:      ₹1200.00

─── Customer ───
Name:             Rahul Sharma
Email:            rahul@example.com
Phone:            9876543210

═══════════════════════════════════════
This is a simple receipt, not a tax invoice.
═══════════════════════════════════════
```

> If the booking is cancelled and refunded, an additional `Refund Details` section is included.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-customer role | `{ "error": "Forbidden" }` |
| 403 | Booking doesn't belong to this customer | `{ "error": "Forbidden" }` |
| 404 | Booking not found | `{ "error": "Booking not found" }` |
| 422 | Receipt cannot be generated (booking not yet confirmed — e.g., payment is still processing) | `{ "error": "Receipt not available for this booking status" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Fetch booking by `id`. If not found → 404.
3. Verify `booking.customer_id == user_id`. Else → 403.
4. Verify `booking.status IN ('CONFIRMED', 'COMPLETED', 'CANCELLED', 'REFUNDED')`. Else → 422.
5. Fetch related data (same as `GET /bookings/{id}` internal logic):
   - Turf, sub-court, slots, payment, refund (if any), customer profile.
6. Use a PDF library (e.g., OpenPDF or Apache PDFBox) to generate the receipt PDF in-memory from a template.
7. Set HTTP headers:
   - `Content-Type: application/pdf`
   - `Content-Disposition: attachment; filename="receipt_booking_<id>.pdf"`
   - `Content-Length: <pdf size>`
8. Return the PDF bytes as the response body (status 200).

**Side Effects:**
- No DB writes. Pure read + PDF generation.

**Notes:**
- The PDF is generated on-demand. We don't store it in S3 or anywhere persistent — each request regenerates it. This keeps storage simple at the cost of slightly more CPU.
- Recommended PDF library: **OpenPDF** (LGPL, free fork of iText). Add to `pom.xml`: `com.github.librepdf:openpdf`. Alternative: Apache PDFBox.
- The text "This is a simple receipt, not a tax invoice." is intentionally on the receipt to make the non-GST nature explicit.

---

### `POST /api/customer/bookings/{id}/reschedule/initiate`

**Description:** Validate a proposed reschedule (same sub-court, different date and/or slot times), compute the price difference based on current sub-court rates, and (if extra payment is required) create a Razorpay order for the difference. **Does NOT modify the booking yet.** The reschedule is only applied via `/reschedule/confirm`.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The booking's unique ID |

**Query Parameters:** None.

**Request Body:**
```json
{
  "new_booking_date": "2026-05-25",
  "new_slots": [
    { "start_time": "19:00", "end_time": "20:00" },
    { "start_time": "20:00", "end_time": "21:00" }
  ]
}
```

> Number of new slots must equal the number of original slots. Same sub-court only — to change sub-court, customer must cancel and rebook.

**Response — Success (200 OK):**

The response shape depends on the price difference. Three scenarios:

**Scenario A: No price change (`price_diff = 0`)**
```json
{
  "booking_id": 1024,
  "old_total": 1200.00,
  "new_total": 1200.00,
  "price_diff": 0.00,
  "action_required": "NONE",
  "reschedule_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Scenario B: Price increase (`price_diff > 0`) — customer must pay extra**
```json
{
  "booking_id": 1024,
  "old_total": 1200.00,
  "new_total": 1400.00,
  "price_diff": 200.00,
  "action_required": "PAYMENT",
  "razorpay_order_id": "order_RschXyz789",
  "razorpay_key_id": "rzp_test_abc123",
  "reschedule_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Scenario C: Price decrease (`price_diff < 0`) — customer will get a partial refund**
```json
{
  "booking_id": 1024,
  "old_total": 1200.00,
  "new_total": 1000.00,
  "price_diff": -200.00,
  "action_required": "REFUND",
  "reschedule_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> `action_required` is one of `NONE`, `PAYMENT`, `REFUND`. The frontend uses this to decide:
> - `NONE` → call `/confirm` immediately with just the token
> - `PAYMENT` → launch Razorpay checkout with the order, then call `/confirm` with token + razorpay verification fields
> - `REFUND` → ask the user "you'll be refunded ₹200", then call `/confirm` with just the token; backend issues refund

> `reschedule_token` is a short-lived (15 min) signed JWT containing the proposed change (`booking_id`, `new_booking_date`, `new_slots`, `new_rate`, `price_diff`, `customer_id`). No DB or cache storage needed.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed | `{ "error": "Validation failed", "details": { ... } }` |
| 400 | New slot count ≠ original slot count | `{ "error": "Reschedule must keep the same number of slots" }` |
| 400 | New date in past or beyond 90-day horizon | `{ "error": "Invalid new date" }` |
| 400 | New slots aren't hourly or outside operating hours | `{ "error": "Invalid slot configuration" }` |
| 400 | Reschedule window has passed (< X hours to original slot) | `{ "error": "Booking can no longer be rescheduled" }` |
| 400 | Booking status isn't `CONFIRMED` | `{ "error": "Only confirmed upcoming bookings can be rescheduled" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | Booking doesn't belong to this customer | `{ "error": "Forbidden" }` |
| 404 | Booking not found | `{ "error": "Booking not found" }` |
| 409 | One or more new slots already booked | `{ "error": "One or more new slots are no longer available", "unavailable_slots": [...] }` |
| 502 | Razorpay order creation failed (PAYMENT scenario) | `{ "error": "Unable to create payment order. Please try again." }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Fetch booking. Verify ownership (403) and existence (404).
3. Verify `booking.status == 'CONFIRMED'`. Else → 400.
4. Verify reschedule window (X hours before earliest slot). Else → 400.
5. Validate request body (slot count matches, new date valid, slots hourly, within operating hours).
6. Check availability of new slots (excluding this booking itself from the conflict check). If conflict → 409.
7. Read current `sub_courts.hourly_price` (= `new_rate`).
8. Read the original `rate_at_booking` from any of the existing `booking_slots` (all have the same rate, per the price-freezing design).
9. Compute:
   - `old_total = bookings.total_amount`
   - `new_total = number_of_slots × new_rate`
   - `price_diff = new_total - old_total`
10. Branch on `price_diff`:
    - **If `price_diff == 0`** → build JWT payload and sign. Return scenario A.
    - **If `price_diff > 0`** → create Razorpay order for `price_diff × 100` paise (with the same payload in `notes`). Build JWT payload and sign. Return scenario B.
    - **If `price_diff < 0`** → build JWT payload and sign. Return scenario C.
11. JWT payload structure:
    ```json
    {
      "type": "RESCHEDULE",
      "booking_id": 1024,
      "customer_id": 1,
      "new_booking_date": "2026-05-25",
      "new_slots": [...],
      "new_rate": 700.00,
      "old_total": 1200.00,
      "new_total": 1400.00,
      "price_diff": 200.00,
      "razorpay_order_id": "order_RschXyz789" or null,
      "iat": <timestamp>,
      "exp": <timestamp + 900s>
    }
    ```
12. If Razorpay call fails (scenario B only) → 502.
13. Return 200.

**Side Effects:**
- For scenario B: Razorpay order created server-side.
- No DB writes anywhere. No bookings modification yet.
- The proposed change is self-contained inside the signed JWT.

**Notes:**
- The signed JWT uses the same `JWT_SECRET` and the same `JwtService` used for auth tokens, but carries `type = RESCHEDULE` to distinguish.
- 15-minute expiry is enforced via the `exp` claim — no cleanup cron needed.
- The customer cannot tamper with the token (signature verification will fail), so `price_diff` and `customer_id` are trustworthy in `/confirm`.

---

### `PUT /api/customer/bookings/{id}/reschedule/confirm`

**Description:** Apply the reschedule proposed in `/reschedule/initiate`. Verifies the signed `reschedule_token`, re-checks slot availability, handles payment verification (if extra payment was required) or refund issuance (if customer is owed money), and atomically updates the booking.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The booking's unique ID (must match the one in the token) |

**Query Parameters:** None.

**Request Body:**

Different fields are required based on the `action_required` returned by `/initiate`:

**For `action_required = NONE` or `REFUND`:**
```json
{
  "reschedule_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**For `action_required = PAYMENT`:**
```json
{
  "reschedule_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "razorpay_order_id": "order_RschXyz789",
  "razorpay_payment_id": "pay_RschABC123",
  "razorpay_signature": "9d8f7e6c5b4a3210..."
}
```

> The frontend already knows which fields to send based on the `action_required` it got from `/initiate`.

**Response — Success (200 OK):**

**For Scenario A (NONE):**
```json
{
  "booking_id": 1024,
  "status": "CONFIRMED",
  "rescheduled": true,
  "old_booking_date": "2026-05-20",
  "new_booking_date": "2026-05-25",
  "new_slots": [
    { "start_time": "19:00", "end_time": "20:00", "rate_at_booking": 600.00 },
    { "start_time": "20:00", "end_time": "21:00", "rate_at_booking": 600.00 }
  ],
  "total_amount": 1200.00,
  "price_diff": 0.00,
  "action_taken": "NONE",
  "rescheduled_at": "2026-05-14T14:30:00Z"
}
```

**For Scenario B (PAYMENT) — successful payment:**
```json
{
  "booking_id": 1024,
  "status": "CONFIRMED",
  "rescheduled": true,
  "old_booking_date": "2026-05-20",
  "new_booking_date": "2026-05-25",
  "new_slots": [
    { "start_time": "19:00", "end_time": "20:00", "rate_at_booking": 700.00 },
    { "start_time": "20:00", "end_time": "21:00", "rate_at_booking": 700.00 }
  ],
  "total_amount": 1400.00,
  "price_diff": 200.00,
  "action_taken": "PAYMENT",
  "additional_payment_id": 513,
  "razorpay_payment_id": "pay_RschABC123",
  "rescheduled_at": "2026-05-14T14:30:00Z"
}
```

**For Scenario C (REFUND) — partial refund issued:**
```json
{
  "booking_id": 1024,
  "status": "CONFIRMED",
  "rescheduled": true,
  "old_booking_date": "2026-05-20",
  "new_booking_date": "2026-05-25",
  "new_slots": [
    { "start_time": "19:00", "end_time": "20:00", "rate_at_booking": 500.00 },
    { "start_time": "20:00", "end_time": "21:00", "rate_at_booking": 500.00 }
  ],
  "total_amount": 1000.00,
  "price_diff": -200.00,
  "action_taken": "REFUND",
  "refund_id": 89,
  "razorpay_refund_id": "rfnd_RschDEF456",
  "rescheduled_at": "2026-05-14T14:30:00Z"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Missing `reschedule_token` or razorpay fields (when required) | `{ "error": "Missing required field" }` |
| 400 | Token's `booking_id` doesn't match URL path `id` | `{ "error": "Token does not match this booking" }` |
| 400 | Booking status is no longer `CONFIRMED` (e.g., cancelled in another tab) | `{ "error": "Booking is not in a reschedulable state" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | Auth JWT belongs to non-customer role | `{ "error": "Forbidden" }` |
| 403 | `reschedule_token` is invalid, expired, or tampered | `{ "error": "Invalid or expired reschedule token" }` |
| 403 | Token's `customer_id` doesn't match auth JWT | `{ "error": "Token does not belong to this customer" }` |
| 403 | Razorpay signature verification failed (PAYMENT only) | `{ "error": "Invalid payment signature" }` |
| 404 | Booking not found | `{ "error": "Booking not found" }` |
| 409 | New slots have been taken by someone else since `/initiate` | `{ "error": "Slots no longer available", "unavailable_slots": [...] }` |
| 502 | Razorpay refund call failed (REFUND only) | `{ "error": "Refund failed. Reschedule has been rolled back. Please try again." }` |

> For 409 in PAYMENT scenario: the customer already paid the extra. Backend must auto-refund that extra payment before responding. Response should also include `razorpay_refund_id` so the customer knows their extra is being returned.

**Internal Logic:**

Wrapped in a DB transaction with `SELECT ... FOR UPDATE` on the sub-court.

1. Extract `user_id` and `role` from auth JWT. Validate `role == CUSTOMER`.
2. **Verify the reschedule_token:**
   - Verify JWT signature using `JWT_SECRET`. If invalid → 403.
   - Verify `exp` claim (not expired). If expired → 403.
   - Verify `type == "RESCHEDULE"`. Else → 403.
   - Verify `customer_id == user_id`. Else → 403.
   - Verify `booking_id == path id`. Else → 400.
   - Parse `new_booking_date`, `new_slots`, `new_rate`, `price_diff`, `razorpay_order_id`.
3. Fetch the booking by `id`. If not found → 404.
4. Re-verify booking ownership and status (`status == 'CONFIRMED'`). Else → 400.
5. **If `price_diff > 0` (PAYMENT scenario):**
   - Verify `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature` are present. Else → 400.
   - Compute `HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)`. Compare with submitted signature. If mismatch → 403.
   - Fetch the Razorpay order. Verify `notes.booking_id == booking_id` and payment status is `captured`. If not → 400.
6. Begin DB transaction.
7. Lock the sub-court row (`SELECT ... FOR UPDATE`).
8. Verify `sub_courts.status = APPROVED` AND turf `status = APPROVED` (in case the owner was suspended or sub-court rejected). Else → 409.
9. Re-check availability of new slots, excluding this booking from the conflict check.
   - If conflict in PAYMENT scenario → rollback → call Razorpay Refund API for the extra payment → return 409 with refund ID.
   - If conflict in NONE/REFUND scenario → rollback → return 409.
10. **Apply the change:**
    - Update `bookings.booking_date = new_booking_date`.
    - Update `bookings.total_amount = new_total`.
    - Recompute and update `bookings.commission_amount = new_total × commission_rate`.
    - Delete existing `booking_slots` for this booking.
    - Insert new `booking_slots` rows with `rate_at_booking = new_rate`.
    - Recompute and update the existing `payouts.scheduled_at = new_booking_date + max(new_slot.end_time) + X hours` AND `payouts.amount = new_total - new_commission_amount`.
11. **For PAYMENT scenario:**
    - Insert a NEW row into `payments` for the additional amount:
      - `booking_id`, `amount = price_diff`, `payment_method` (from Razorpay), `gateway_transaction_id = razorpay_payment_id`, `status = 'SUCCESS'`.
12. **For REFUND scenario:**
    - Call Razorpay Refund API for the absolute value of `price_diff` against the original `payments.gateway_transaction_id`.
    - If refund call fails → rollback transaction → return 502.
    - Insert a row into `refunds`:
      - `booking_id`, `amount = |price_diff|`, `razorpay_refund_id`, `status = 'SUCCESS'`, `processed_at = now()`.
13. Insert in-app notification for the **owner** that the booking was rescheduled (and that their payable amount changed).
14. Commit transaction.
15. Return 200 with the appropriate response shape based on `action_taken`.

**Side Effects:**
- Updates `bookings.booking_date`, `bookings.total_amount`, `bookings.commission_amount`.
- Deletes old `booking_slots`, inserts new ones with the new `rate_at_booking`.
- Updates `payouts.scheduled_at` and `payouts.amount`.
- For PAYMENT: new row in `payments`.
- For REFUND: new row in `refunds` + Razorpay refund issued.
- New `notifications` row for the owner.

**Notes:**
- The `refunds` table holds rows from two sources: full-cancellation refunds and reschedule-difference partial refunds. A booking can end up with multiple refund rows over its lifetime; `refunds.booking_id` is intentionally not unique.
- Similarly, `payments` can hold multiple rows per booking — one for the original payment, additional ones for reschedule top-ups.
- After a reschedule, all `booking_slots` for that booking share the same new `rate_at_booking`. The original frozen rate is effectively replaced.
- **Important edge case:** if the booking has been rescheduled with extra payment and then cancelled, the cancellation refund should equal `bookings.total_amount` (the final amount), which already reflects the additional payment. The cancellation endpoint must read `bookings.total_amount` for the refund, not just the original payment.

---

### `DELETE /api/customer/bookings/{id}`

**Description:** Cancel an upcoming confirmed booking. If cancelled within the allowed window (more than X hours before the earliest slot), a full refund is auto-issued via Razorpay. Past the window, cancellation is rejected.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The booking's unique ID |

**Query Parameters:** None.

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "booking_id": 1024,
  "status": "CANCELLED",
  "cancelled_at": "2026-05-14T15:00:00Z",
  "refunds": [
    {
      "refund_id": 90,
      "amount": 1200.00,
      "razorpay_refund_id": "rfnd_CncXYZ123",
      "status": "SUCCESS",
      "processed_at": "2026-05-14T15:00:00Z"
    }
  ],
  "total_refunded": 1200.00
}
```

> If the booking had been rescheduled with an additional payment, there will be multiple refund entries in the `refunds` array — one per original `payments` row. `total_refunded` equals `bookings.total_amount`.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Booking status isn't `CONFIRMED` (e.g., already cancelled, completed, or refunded) | `{ "error": "Only confirmed upcoming bookings can be cancelled" }` |
| 400 | Cancellation window has passed (< X hours before earliest slot) | `{ "error": "Cancellation window has passed (less than X hours remaining)" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | Auth JWT belongs to non-customer role | `{ "error": "Forbidden" }` |
| 403 | Booking doesn't belong to this customer | `{ "error": "Forbidden" }` |
| 404 | Booking not found | `{ "error": "Booking not found" }` |
| 502 | Razorpay refund call failed | `{ "error": "Refund failed. Please contact support.", "support_reference": "BK-1024" }` |

> For 502, the booking is NOT marked as cancelled. The customer can retry. Their payment is intact.

**Internal Logic:**

Wrapped in a DB transaction.

1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Fetch booking by `id`. If not found → 404.
3. Verify `booking.customer_id == user_id`. Else → 403.
4. Verify `booking.status == 'CONFIRMED'`. Else → 400.
5. Compute earliest slot's full datetime: `booking_date + min(booking_slots.start_time)`.
6. If `earliest_slot_datetime - now < X hours` (cancellation window) → 400.
7. Begin DB transaction.
8. Fetch all `payments` rows for this booking with `status = 'SUCCESS'`.
9. Sanity check: `SUM(payments.amount)` should equal `bookings.total_amount`. If mismatch → log and proceed with the sum from payments (source of truth for actual money received).
10. For each successful payment row, call Razorpay Refund API using its `gateway_transaction_id`:
    - If any refund call fails → rollback transaction → return 502 (booking remains CONFIRMED).
11. Update `bookings.status = 'CANCELLED'`.
12. Update `payouts.status = 'CANCELLED'` for this booking (owner does not get paid for cancelled bookings).
13. Insert one row into `refunds` per Razorpay refund issued:
    - `booking_id`, `amount`, `razorpay_refund_id`, `status = 'SUCCESS'`, `processed_at = now()`.
14. Insert an in-app notification for the **owner** that the booking was cancelled.
15. Commit transaction.
16. Return 200 with refund details (array of all refund rows + total_refunded sum).

**Side Effects:**
- `bookings.status` set to `CANCELLED`.
- `payouts.status` set to `CANCELLED` (owner won't be paid).
- One or more rows in `refunds` (one per original payment).
- Razorpay refunds issued.
- New `notifications` row for the owner.

**Notes:**
- A booking that's already cancelled cannot be cancelled again (400).
- A booking that has passed (already played or after the slot end time) cannot be cancelled, since the cancellation window check will fail.
- The `payouts.status = CANCELLED` is read by the scheduled payout job — cancelled payouts are never released.
- For bookings with reschedule top-ups: the cancel endpoint refunds each `payments` row separately. Razorpay only allows refunding against the original `payment_id`, so per-payment refunds are required.

---

### `POST /api/customer/reviews`

**Description:** Submit a star rating and written review for a turf. The customer must have a completed booking at this turf. Only one review per booking is allowed. Reviews are auto-published with no moderation. The turf's `avg_rating` and `review_count` are recomputed atomically.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:** None.

**Query Parameters:** None.

**Request Body:**
```json
{
  "booking_id": 1011,
  "rating": 5,
  "review_text": "Excellent turf, great lighting and friendly staff."
}
```

> `rating` is an integer 1–5. `review_text` is optional but recommended; if omitted, only the rating counts.

**Response — Success (201 Created):**
```json
{
  "review_id": 145,
  "turf_id": 23,
  "turf_name": "Champions Turf",
  "booking_id": 1011,
  "rating": 5,
  "review_text": "Excellent turf, great lighting and friendly staff.",
  "created_at": "2026-05-14T18:30:00Z"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (rating out of range, review_text too long, etc.) | `{ "error": "Validation failed", "details": { ... } }` |
| 400 | Booking status isn't `COMPLETED` | `{ "error": "You can only review completed bookings" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | Auth JWT belongs to non-customer role | `{ "error": "Forbidden" }` |
| 403 | Booking doesn't belong to this customer | `{ "error": "Forbidden" }` |
| 404 | Booking not found | `{ "error": "Booking not found" }` |
| 409 | A review already exists for this booking | `{ "error": "You have already reviewed this booking", "existing_review_id": 144 }` |

**Internal Logic:**

Wrapped in a DB transaction (to keep `avg_rating` / `review_count` consistent).

1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Validate request body:
   - `rating` is integer 1–5.
   - `review_text` ≤ 1000 chars.
3. Fetch booking by `booking_id`. If not found → 404.
4. Verify `booking.customer_id == user_id`. Else → 403.
5. Verify `booking.status == 'COMPLETED'`. Else → 400.
6. Check uniqueness: query `reviews` for `booking_id`. If row exists → 409 with the existing review_id. (UNIQUE constraint on `reviews.booking_id` is the safety net.)
7. Begin DB transaction.
8. Insert into `reviews`:
   - `customer_id = user_id`, `turf_id = booking.sub_court.turf_id`, `booking_id`, `rating`, `review_text`, `created_at = now()`
9. Recompute turf's `avg_rating` and `review_count`:
   - `SELECT AVG(rating), COUNT(*) FROM reviews WHERE turf_id = ?`
   - Update `turfs.avg_rating` and `turfs.review_count` accordingly.
10. Commit transaction.
11. Return 201.

**Side Effects:**
- New row in `reviews`.
- Updated `avg_rating` and `review_count` on `turfs`.
- No notification sent (reviews are public, owner can check on their own).

**Notes:**
- The UNIQUE constraint on `reviews.booking_id` is the database-level enforcement of the "one review per booking" rule.
- Editing and deleting reviews are handled by separate endpoints (next two).
- Customer's name is intentionally stored as a FK to `customer_profiles` (via `customer_id`) rather than denormalized. If the customer changes their name later, the review's displayed name updates automatically.

---

### `DELETE /api/customer/reviews/{id}`

**Description:** Delete a review previously submitted by the authenticated customer. The turf's `avg_rating` and `review_count` are recomputed atomically after deletion. Any owner reply linked to the review is also deleted via ON DELETE CASCADE.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The review's unique ID |

**Query Parameters:** None.

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "review_id": 145,
  "deleted": true,
  "turf_id": 23,
  "updated_avg_rating": 4.3,
  "updated_review_count": 86
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | Auth JWT belongs to non-customer role | `{ "error": "Forbidden" }` |
| 403 | Review exists but doesn't belong to this customer | `{ "error": "Forbidden" }` |
| 404 | Review not found | `{ "error": "Review not found" }` |

**Internal Logic:**

Wrapped in a DB transaction.

1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Fetch review by `id`. If not found → 404.
3. Verify `review.customer_id == user_id`. Else → 403.
4. Begin DB transaction.
5. Delete the review row from `reviews`. The owner reply (if any) is automatically removed via `ON DELETE CASCADE` on `review_replies.review_id`.
6. Recompute turf's `avg_rating` and `review_count`:
   - `SELECT AVG(rating), COUNT(*) FROM reviews WHERE turf_id = ?`
   - If `COUNT == 0`, set `avg_rating = 0.0`, `review_count = 0`.
   - Else update with the new values.
7. Commit transaction.
8. Return 200 with the updated turf rating info.

**Side Effects:**
- Row deleted from `reviews`.
- If owner had replied, row in `review_replies` cascade-deleted.
- `turfs.avg_rating` and `turfs.review_count` recomputed.
- No notification sent.

**Notes:**
- Since the review's UNIQUE constraint is on `booking_id`, deleting the review frees the customer to submit a new review for the same booking. To update their opinion, the customer deletes the old review and submits a new one.
- The owner's reply is automatically removed via the cascade — no orphan replies remain.

---

### `POST /api/customer/complaints`

**Description:** Raise a complaint about a specific booking. The complaint goes into the unassigned complaint pool, awaiting admin assignment to a staff member. Subject and description are required.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:** None.

**Query Parameters:** None.

**Request Body:**
```json
{
  "booking_id": 1011,
  "subject": "Turf was not in good condition",
  "description": "When I arrived at the slot, the turf had several muddy patches and broken lights. The owner was not available to address it."
}
```

> `subject` is a short title (5–200 chars). `description` is the full complaint text (10–2000 chars).

**Response — Success (201 Created):**
```json
{
  "complaint_id": 67,
  "booking_id": 1011,
  "subject": "Turf was not in good condition",
  "description": "When I arrived at the slot, the turf had several muddy patches and broken lights. The owner was not available to address it.",
  "status": "OPEN",
  "created_at": "2026-05-14T19:00:00Z"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (subject too short/long, description too short/long, missing fields) | `{ "error": "Validation failed", "details": { ... } }` |
| 400 | Booking status isn't `CONFIRMED`, `COMPLETED`, `CANCELLED`, or `REFUNDED` | `{ "error": "Cannot raise complaint for this booking status" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | Auth JWT belongs to non-customer role | `{ "error": "Forbidden" }` |
| 403 | Booking doesn't belong to this customer | `{ "error": "Forbidden" }` |
| 404 | Booking not found | `{ "error": "Booking not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Validate request body (subject length, description length, booking_id present).
3. Fetch booking by `booking_id`. If not found → 404.
4. Verify `booking.customer_id == user_id`. Else → 403.
5. Verify `booking.status IN ('CONFIRMED', 'COMPLETED', 'CANCELLED', 'REFUNDED')`. Else → 400.
6. Insert into `complaints`:
   - `customer_id = user_id`, `booking_id`, `subject`, `description`, `assigned_staff_id = NULL`, `assigned_by_admin_id = NULL`, `status = 'OPEN'`, `created_at = now()`
7. Return 201.

**Side Effects:**
- New row in `complaints` with `status = OPEN`.
- No notifications for v1 (admins see new complaints on their dashboard).

**Notes:**
- Multiple complaints can be raised for the same booking — there's no uniqueness constraint, since a customer might have multiple distinct issues.
- The complaint stays `OPEN` and `assigned_staff_id = NULL` until an admin assigns it.

---

### `GET /api/customer/complaints`

**Description:** List the authenticated customer's own complaints, with optional filtering by status. Includes related booking info and the resolution status, but does NOT expose internal staff notes.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter by status: `OPEN`, `IN_PROGRESS`, `RESOLVED`, or `all` (default: `all`) |
| `sort_by` | string | No | One of: `created_desc` (newest first, default), `created_asc` |
| `page` | integer | No | Page number, 1-indexed (default: `1`) |
| `page_size` | integer | No | Results per page (default: `10`, max: `50`) |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 10,
  "total_results": 4,
  "total_pages": 1,
  "complaints": [
    {
      "complaint_id": 67,
      "booking_id": 1011,
      "turf_name": "Champions Turf",
      "booking_date": "2026-05-08",
      "subject": "Turf was not in good condition",
      "description": "When I arrived at the slot, the turf had several muddy patches...",
      "status": "IN_PROGRESS",
      "resolution_text": null,
      "created_at": "2026-05-14T19:00:00Z",
      "resolved_at": null
    },
    {
      "complaint_id": 52,
      "booking_id": 988,
      "turf_name": "Greenfield Sports Arena",
      "booking_date": "2026-04-22",
      "subject": "Owner did not arrive",
      "description": "The owner was supposed to open the gate but...",
      "status": "RESOLVED",
      "resolution_text": "We've spoken with the owner and confirmed they will be on-site for all future bookings. As compensation, your full booking amount has been refunded — please check your bank account in 5-7 working days.",
      "created_at": "2026-04-22T20:30:00Z",
      "resolved_at": "2026-04-23T11:00:00Z"
    }
  ]
}
```

> Internal staff notes (`complaint_notes`) are intentionally NOT included — they're for staff/admin only.
> `assigned_staff_id` is also hidden from the customer.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | Auth JWT belongs to non-customer role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Validate query parameters.
3. Build query: `SELECT * FROM complaints WHERE customer_id = :user_id`
4. Apply status filter if provided.
5. Apply sort and pagination.
6. For each complaint, JOIN with `bookings`, `sub_courts`, `turfs` to fetch `turf_name` and `booking_date`.
7. Return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- The customer's view is intentionally minimal — they see only what they need to track resolution status. Internal notes and staff assignment details stay private.
- Once a complaint is `RESOLVED`, the customer cannot reopen it from this endpoint. If they have a new issue, they raise a new complaint.

---

### `POST /api/customer/queries`

**Description:** Submit a general query or message that is not linked to any specific booking. The query goes into a shared pool, and any staff member can pick it up to resolve.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:** None.

**Query Parameters:** None.

**Request Body:**
```json
{
  "subject": "Question about payment methods",
  "description": "Hi, I wanted to know if you support international cards for payments. I have a friend visiting from abroad."
}
```

> `subject` is a short title (5–200 chars). `description` is the full query text (10–2000 chars).

**Response — Success (201 Created):**
```json
{
  "query_id": 88,
  "subject": "Question about payment methods",
  "description": "Hi, I wanted to know if you support international cards for payments. I have a friend visiting from abroad.",
  "status": "OPEN",
  "created_at": "2026-05-14T20:00:00Z"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (subject too short/long, description too short/long, missing fields) | `{ "error": "Validation failed", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | Auth JWT belongs to non-customer role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Validate request body (subject and description lengths).
3. Insert into `queries`:
   - `customer_id = user_id`, `subject`, `description`, `picked_up_by_staff_id = NULL`, `status = 'OPEN'`, `created_at = now()`
4. Return 201.

**Side Effects:**
- New row in `queries` with `status = OPEN` and no staff assigned.
- The query becomes visible to all staff via their `/api/staff/queries/pool` endpoint.

**Notes:**
- No booking is referenced, since this is a general query.
- The query stays in the shared pool until some staff member picks it up via the staff pick-up endpoint.

---

### `GET /api/customer/queries`

**Description:** List the authenticated customer's own queries, with optional filtering by status. Shows current status and the staff's resolution text (if resolved). Internal `picked_up_by_staff_id` is NOT exposed.

**Authentication:** Required. Role: `CUSTOMER` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter by status: `OPEN`, `IN_PROGRESS`, `RESOLVED`, or `all` (default: `all`) |
| `sort_by` | string | No | One of: `created_desc` (default), `created_asc` |
| `page` | integer | No | Page number, 1-indexed (default: `1`) |
| `page_size` | integer | No | Results per page (default: `10`, max: `50`) |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 10,
  "total_results": 3,
  "total_pages": 1,
  "queries": [
    {
      "query_id": 88,
      "subject": "Question about payment methods",
      "description": "Hi, I wanted to know if you support international cards for payments. I have a friend visiting from abroad.",
      "status": "IN_PROGRESS",
      "resolution_text": null,
      "created_at": "2026-05-14T20:00:00Z",
      "resolved_at": null
    },
    {
      "query_id": 71,
      "subject": "How to update phone number",
      "description": "I changed my phone number recently. How can I update it?",
      "status": "RESOLVED",
      "resolution_text": "Hi! Currently the phone number is locked once registered. You can request a phone change by raising a new query and our team will help you verify and update it manually. Sorry for the inconvenience.",
      "created_at": "2026-05-01T10:15:00Z",
      "resolved_at": "2026-05-01T14:30:00Z"
    }
  ]
}
```

> `picked_up_by_staff_id` is intentionally hidden from the customer — they don't need to know which specific staff is handling it. `resolution_text` is `null` until the staff resolves the query.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | Auth JWT belongs to non-customer role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == CUSTOMER`.
2. Validate query parameters.
3. Build query: `SELECT * FROM queries WHERE customer_id = :user_id`
4. Apply status filter if provided.
5. Apply sort and pagination.
6. Return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- Like complaints, the customer sees only the basics plus the resolution text. Internal staff details remain private.
- Once a query is `RESOLVED`, the customer cannot reopen it. To re-raise the same issue, they submit a new query.
- The staff endpoint for resolving a query (covered in the Staff section) requires the staff to provide `resolution_text` along with the status change to `RESOLVED`.

---

## Owner

### `GET /api/owner/profile`

**Description:** Retrieve the profile of the currently authenticated owner. Returns combined data from `users` and `owner_profiles` tables, plus a computed `bank_details_complete` flag.

**Authentication:** Required. Role: `OWNER` only.

**Path Parameters:** None.

**Query Parameters:** None.

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "user_id": 12,
  "name": "Vikram Patel",
  "email": "vikram@example.com",
  "phone": "9876543211",
  "bank_account_number": "1234567890",
  "ifsc_code": "HDFC0001234",
  "bank_details_complete": true,
  "created_at": "2026-05-01T10:30:00Z"
}
```

> If bank details have not been added yet, `bank_account_number` and `ifsc_code` will be `null`, and `bank_details_complete = false`.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-owner role | `{ "error": "Forbidden" }` |
| 404 | Owner profile not found (data integrity issue) | `{ "error": "Profile not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == OWNER`.
2. Query `users` table for `id = user_id` → get `email`, `phone`, `created_at`.
3. Query `owner_profiles` for `user_id` → get `name`, `bank_account_number`, `ifsc_code`.
4. If profile not found → 404.
5. Compute `bank_details_complete = (bank_account_number IS NOT NULL AND ifsc_code IS NOT NULL)`.
6. Return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- `password_hash` is never returned.
- `bank_details_complete` is a frontend convenience — UI can prompt the owner to complete bank details until this is `true`.

---

### `PUT /api/owner/profile`

**Description:** Update the authenticated owner's profile. Owners can change their name, bank account number, and IFSC code. Email, phone, and password cannot be changed via this endpoint.

**Authentication:** Required. Role: `OWNER` only.

**Path Parameters:** None.

**Query Parameters:** None.

**Request Body:**
```json
{
  "name": "Vikram K. Patel",
  "bank_account_number": "1234567890",
  "ifsc_code": "HDFC0001234"
}
```

> All fields are optional. Only the fields included get updated.

**Response — Success (200 OK):**
```json
{
  "user_id": 12,
  "name": "Vikram K. Patel",
  "email": "vikram@example.com",
  "phone": "9876543211",
  "bank_account_number": "1234567890",
  "ifsc_code": "HDFC0001234",
  "bank_details_complete": true,
  "updated_at": "2026-05-14T11:45:00Z"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (name length, IFSC format, account number format) | `{ "error": "Validation failed", "details": { "field_name": "error message" } }` |
| 400 | Request body is empty | `{ "error": "At least one field must be provided" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-owner role | `{ "error": "Forbidden" }` |
| 404 | Profile not found | `{ "error": "Profile not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == OWNER`.
2. Validate request body:
   - At least one field present.
   - `name`: 2–100 chars.
   - `bank_account_number`: 9–18 digits (if provided).
   - `ifsc_code`: matches `^[A-Z]{4}0[A-Z0-9]{6}$` (11 chars, if provided).
3. Fetch existing `owner_profiles` row. If not found → 404.
4. Update only the fields present in the request body.
5. Set `users.updated_at = now()`.
6. Recompute `bank_details_complete`.
7. Return 200.

**Side Effects:**
- Updates `owner_profiles`.
- Updates `users.updated_at`.

**Notes:**
- Email, phone, and password changes are out of scope for v1.
- Bank details are still stored as plain strings — no validation against real banks (payouts are simulated).

---

### `POST /api/owner/turfs`

**Description:** Create a new turf listing. The turf is created in `PENDING` status and is not visible to customers until an admin approves it. The owner provides turf details, photos, and at least one sub-court — each sub-court declares its own supported sports — in a single request.

**Authentication:** Required. Role: `OWNER` only.

**Path Parameters:** None.

**Query Parameters:** None.

**Request Body:**
```json
{
  "name": "Greenfield Sports Arena",
  "description": "Premium artificial turf with floodlights, changing rooms, and parking.",
  "address": "Plot 12, Baner Road, Pune",
  "city": "Pune",
  "contact_phone": "9876543211",
  "photos": [
    "https://cdn.example.com/turf_15_main.jpg",
    "https://cdn.example.com/turf_15_court.jpg",
    "https://cdn.example.com/turf_15_facility.jpg"
  ],
  "sub_courts": [
    {
      "name": "Court A",
      "sports": ["Cricket", "Football"],
      "hourly_price": 600.00,
      "opening_hour": "06:00",
      "closing_hour": "23:00"
    },
    {
      "name": "Court B",
      "sports": ["Football"],
      "hourly_price": 1200.00,
      "opening_hour": "06:00",
      "closing_hour": "23:00"
    }
  ]
}
```

> `photos` is a list of pre-uploaded image URLs (the actual image upload mechanism is out of v1 scope).
> Each sub-court must declare its own `sports` array (at least one sport per sub-court).
> Sport names are plain strings — they are normalized (trimmed, Title-cased) on insert. No lookup table.

**Response — Success (201 Created):**
```json
{
  "turf_id": 15,
  "owner_id": 12,
  "name": "Greenfield Sports Arena",
  "description": "Premium artificial turf with floodlights, changing rooms, and parking.",
  "address": "Plot 12, Baner Road, Pune",
  "city": "Pune",
  "contact_phone": "9876543211",
  "status": "PENDING",
  "avg_rating": 0.0,
  "review_count": 0,
  "all_sports": ["Cricket", "Football"],
  "photos": [
    "https://cdn.example.com/turf_15_main.jpg",
    "https://cdn.example.com/turf_15_court.jpg",
    "https://cdn.example.com/turf_15_facility.jpg"
  ],
  "sub_courts": [
    {
      "sub_court_id": 41,
      "name": "Court A",
      "sports": ["Cricket", "Football"],
      "hourly_price": 600.00,
      "opening_hour": "06:00",
      "closing_hour": "23:00",
      "status": "PENDING"
    },
    {
      "sub_court_id": 42,
      "name": "Court B",
      "sports": ["Football"],
      "hourly_price": 1200.00,
      "opening_hour": "06:00",
      "closing_hour": "23:00",
      "status": "PENDING"
    }
  ],
  "created_at": "2026-05-14T16:00:00Z"
}
```

> `all_sports` in the response is a derived union of all sub-courts' sports — useful for showing the turf summary at a glance.
> Both `turfs.status` and every new `sub_courts.status` start at `PENDING`. Admin reviews each independently.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (missing required fields, invalid format, no sub-courts, no photos, sub-court with no sports) | `{ "error": "Validation failed", "details": { ... } }` |
| 400 | Sub-court `closing_hour <= opening_hour` | `{ "error": "Sub-court closing time must be after opening time" }` |
| 400 | Duplicate sub-court names within the same turf | `{ "error": "Sub-court names must be unique within a turf" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-owner role | `{ "error": "Forbidden" }` |

**Internal Logic:**

Wrapped in a DB transaction.

1. Extract `user_id` and `role` from JWT. Validate `role == OWNER`.
2. Validate request body:
   - `name` (5–150 chars), `description` (optional, ≤2000 chars), `address` (5–255 chars), `city` (2–80 chars), `contact_phone` (10 digits).
   - `photos` non-empty (at least one URL).
   - `sub_courts` non-empty, each with valid `name` (2–80 chars), `sports` non-empty array, `hourly_price > 0`, valid `opening_hour` and `closing_hour`, `closing_hour > opening_hour`.
   - No duplicate sub-court names.
3. Normalize each sport name: trim whitespace, Title-case (`"cricket"` → `"Cricket"`). Deduplicate within each sub-court.
4. Begin DB transaction.
5. Insert into `turfs`:
   - `owner_id = user_id`, `name`, `description`, `address`, `city`, `contact_phone`, `status = 'PENDING'`, `avg_rating = 0.0`, `review_count = 0`, `created_at = now()`
6. For each photo URL, insert into `turf_photos`: `turf_id`, `photo_url`.
7. For each sub-court, insert into `sub_courts`: `turf_id`, `name`, `sports` (as JSON array), `hourly_price`, `opening_hour`, `closing_hour`, `status = 'PENDING'`.
8. Compute `all_sports` from the union of all sub-courts' sports.
9. Commit transaction.
10. Return 201 with the full created turf details.

**Side Effects:**
- New row in `turfs` (status = PENDING).
- N rows in `turf_photos` and `sub_courts`.
- No notifications. Admin sees pending turfs on their dashboard via `GET /api/admin/turfs/pending`.

**Notes:**
- The turf is **not visible to customers** until `status = APPROVED` (set by admin).
- Sport names are plain strings, normalized to Title Case. The frontend hardcodes the dropdown list of common sports (Cricket, Football, Badminton, Tennis, etc.); owners pick from it.
- Image upload: for v1, owners are expected to provide pre-uploaded image URLs. A separate image upload service (e.g., to S3 or Cloudinary) is a v2 enhancement.

---

### `GET /api/owner/turfs`

**Description:** List all turfs owned by the authenticated owner, regardless of approval status. Owners see all their listings — pending, approved, and rejected.

**Authentication:** Required. Role: `OWNER` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter by status: `PENDING`, `APPROVED`, `REJECTED`, or `all` (default: `all`) |
| `sort_by` | string | No | One of: `created_desc` (default), `created_asc`, `name_asc` |
| `page` | integer | No | Page number, 1-indexed (default: `1`) |
| `page_size` | integer | No | Results per page (default: `10`, max: `50`) |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 10,
  "total_results": 3,
  "total_pages": 1,
  "turfs": [
    {
      "turf_id": 15,
      "name": "Greenfield Sports Arena",
      "city": "Pune",
      "address": "Plot 12, Baner Road, Pune",
      "thumbnail_url": "https://cdn.example.com/turf_15_main.jpg",
      "all_sports": ["Cricket", "Football"],
      "sub_court_count": 2,
      "min_hourly_price": 600.00,
      "max_hourly_price": 1200.00,
      "status": "APPROVED",
      "avg_rating": 4.5,
      "review_count": 87,
      "created_at": "2026-05-01T10:30:00Z"
    },
    {
      "turf_id": 31,
      "name": "Star Cricket Ground",
      "city": "Pune",
      "address": "Kothrud, Pune",
      "thumbnail_url": "https://cdn.example.com/turf_31_main.jpg",
      "all_sports": ["Cricket"],
      "sub_court_count": 1,
      "min_hourly_price": 500.00,
      "max_hourly_price": 500.00,
      "status": "PENDING",
      "avg_rating": 0.0,
      "review_count": 0,
      "created_at": "2026-05-13T18:00:00Z"
    }
  ]
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-owner role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == OWNER`.
2. Validate query parameters.
3. Build query: `SELECT * FROM turfs WHERE owner_id = :user_id`
4. Apply status filter if not `all`.
5. Apply sort and pagination.
6. For each turf, fetch:
   - `thumbnail_url` → first photo from `turf_photos` (or NULL)
   - `sub_court_count` → COUNT(*) from `sub_courts WHERE turf_id = X`
   - `min_hourly_price`, `max_hourly_price` → MIN/MAX of `sub_courts.hourly_price`
   - `all_sports` → union of all sub-courts' `sports` arrays
7. Return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- Unlike the customer search endpoint, this returns turfs in **all statuses** (PENDING, APPROVED, REJECTED) since the owner needs to see and manage their own listings regardless of status.
- The owner uses `status = REJECTED` filter to see which listings were rejected by admin and need attention.

---

### `PUT /api/owner/turfs/{id}`

**Description:** Update a turf's top-level details (name, description, address, city, contact phone, photos). Sub-courts are managed separately. Any successful edit reverts the turf's status to `PENDING`, hiding it from customers until an admin re-approves it.

**Authentication:** Required. Role: `OWNER` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The turf's unique ID |

**Query Parameters:** None.

**Request Body:**
```json
{
  "name": "Greenfield Sports Arena (Updated)",
  "description": "Premium artificial turf with floodlights, changing rooms, parking, and new café.",
  "address": "Plot 12, Baner Road, Pune",
  "city": "Pune",
  "contact_phone": "9876543211",
  "photos": [
    "https://cdn.example.com/turf_15_main_v2.jpg",
    "https://cdn.example.com/turf_15_court.jpg",
    "https://cdn.example.com/turf_15_cafe.jpg"
  ]
}
```

> All fields are optional. Only the fields included get updated. If `photos` is provided, it **replaces** the entire photo list (not appended). Omit `photos` to keep existing photos unchanged.

**Response — Success (200 OK):**
```json
{
  "turf_id": 15,
  "owner_id": 12,
  "name": "Greenfield Sports Arena (Updated)",
  "description": "Premium artificial turf with floodlights, changing rooms, parking, and new café.",
  "address": "Plot 12, Baner Road, Pune",
  "city": "Pune",
  "contact_phone": "9876543211",
  "status": "PENDING",
  "previous_status": "APPROVED",
  "avg_rating": 4.5,
  "review_count": 87,
  "photos": [
    "https://cdn.example.com/turf_15_main_v2.jpg",
    "https://cdn.example.com/turf_15_court.jpg",
    "https://cdn.example.com/turf_15_cafe.jpg"
  ],
  "updated_at": "2026-05-14T17:30:00Z"
}
```

> `previous_status` is included so the owner sees clearly that their edit reverted an approved turf back to pending.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (invalid format, empty photos array) | `{ "error": "Validation failed", "details": { ... } }` |
| 400 | Request body is empty | `{ "error": "At least one field must be provided" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-owner role | `{ "error": "Forbidden" }` |
| 403 | Turf doesn't belong to this owner | `{ "error": "Forbidden" }` |
| 404 | Turf not found | `{ "error": "Turf not found" }` |

**Internal Logic:**

Wrapped in a DB transaction.

1. Extract `user_id` and `role` from JWT. Validate `role == OWNER`.
2. Validate request body:
   - At least one field present.
   - Each field passes its format rules (same as create endpoint).
   - If `photos` is provided, it must be non-empty.
3. Fetch turf by `id`. If not found → 404.
4. Verify `turf.owner_id == user_id`. Else → 403.
5. Capture `previous_status = turf.status`.
6. Begin DB transaction.
7. For each top-level field in the request, update the corresponding column on `turfs`.
8. **Revert turf-level status to PENDING** (regardless of previous status). Sub-courts' statuses are NOT changed.
9. If `photos` is provided:
   - Delete all existing rows in `turf_photos` for this `turf_id`.
   - Insert new rows from the provided list.
10. Commit transaction.
11. Return 200 with full turf details and `previous_status`.

**Side Effects:**
- Updates `turfs` row (turf-level status reverted to PENDING).
- May replace `turf_photos` rows.
- Sub-courts' statuses are NOT touched — already-approved sub-courts remain bookable.
- No notifications (admin sees pending turfs on their dashboard).
- **Customer-facing impact:** the turf disappears from customer search (since `turfs.status = PENDING`). Existing bookings remain unaffected.

**Notes:**
- Sub-courts are NOT updated via this endpoint. Use `PUT /api/owner/sub-courts/{id}` to update individual sub-courts.
- Status reversion is intentional: any change to a public listing requires re-approval to prevent abuse (e.g., owner approving a generic listing, then editing it to misleading content).
- Owner is informed of the reversion via `previous_status` in the response. The frontend should show a banner like "Your turf is being reviewed again by our team."

---

### `POST /api/owner/turfs/{id}/sub-courts`

**Description:** Add a new sub-court to an existing turf. The new sub-court starts in `PENDING` status and is not bookable by customers until an admin approves it. The turf's own status and other sub-courts are unaffected.

**Authentication:** Required. Role: `OWNER` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The turf's unique ID |

**Query Parameters:** None.

**Request Body:**
```json
{
  "name": "Court C",
  "sports": ["Tennis"],
  "hourly_price": 800.00,
  "opening_hour": "06:00",
  "closing_hour": "22:00"
}
```

**Response — Success (201 Created):**
```json
{
  "sub_court_id": 43,
  "turf_id": 15,
  "name": "Court C",
  "sports": ["Tennis"],
  "hourly_price": 800.00,
  "opening_hour": "06:00",
  "closing_hour": "22:00",
  "status": "PENDING"
}
```

> Only the new sub-court is PENDING. The parent turf's status and existing sub-courts are unchanged — bookings on already-approved sub-courts continue normally.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed | `{ "error": "Validation failed", "details": { ... } }` |
| 400 | `closing_hour <= opening_hour` | `{ "error": "Closing time must be after opening time" }` |
| 400 | A sub-court with the same name already exists for this turf | `{ "error": "Sub-court name already exists on this turf" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-owner role | `{ "error": "Forbidden" }` |
| 403 | Turf doesn't belong to this owner | `{ "error": "Forbidden" }` |
| 404 | Turf not found | `{ "error": "Turf not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == OWNER`.
2. Validate request body:
   - `name` (2–80 chars), `sports` non-empty array, `hourly_price > 0`, valid `opening_hour` and `closing_hour`, `closing_hour > opening_hour`.
3. Normalize each sport name (trim, Title-case, deduplicate).
4. Fetch turf by `id`. If not found → 404.
5. Verify `turf.owner_id == user_id`. Else → 403.
6. Check no existing sub-court with this `name` under the same turf. Else → 400.
7. Insert into `sub_courts`: `turf_id`, `name`, `sports` (JSON), `hourly_price`, `opening_hour`, `closing_hour`, `status = 'PENDING'`.
8. Return 201.

**Side Effects:**
- New row in `sub_courts` with `status = PENDING`.
- Parent turf's `status` is NOT changed.
- Other sub-courts are unaffected — customers can still book them.

**Notes:**
- Per-sub-court approval means adding a new sub-court does not punish the owner by hiding the whole turf. Court A keeps taking bookings while Court C awaits admin approval.

---

### `GET /api/owner/turfs/{id}/sub-courts`

**Description:** List all sub-courts of a turf owned by the authenticated owner.

**Authentication:** Required. Role: `OWNER` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The turf's unique ID |

**Query Parameters:** None.

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "turf_id": 15,
  "turf_name": "Greenfield Sports Arena",
  "turf_status": "APPROVED",
  "sub_courts": [
    {
      "sub_court_id": 41,
      "name": "Court A",
      "sports": ["Cricket", "Football"],
      "hourly_price": 600.00,
      "opening_hour": "06:00",
      "closing_hour": "23:00",
      "status": "APPROVED"
    },
    {
      "sub_court_id": 42,
      "name": "Court B",
      "sports": ["Football"],
      "hourly_price": 1200.00,
      "opening_hour": "06:00",
      "closing_hour": "23:00",
      "status": "PENDING"
    }
  ]
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-owner role | `{ "error": "Forbidden" }` |
| 403 | Turf doesn't belong to this owner | `{ "error": "Forbidden" }` |
| 404 | Turf not found | `{ "error": "Turf not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == OWNER`.
2. Fetch turf by `id`. If not found → 404.
3. Verify `turf.owner_id == user_id`. Else → 403.
4. Fetch all sub-courts for this turf, ordered by `name`.
5. Return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- This is a simple lookup endpoint, often used by the frontend to populate the "manage sub-courts" page.

---

### `PUT /api/owner/sub-courts/{id}`

**Description:** Update a sub-court's details — name, sports, hourly price, opening/closing hours. Price changes apply only to **new** bookings going forward; existing bookings keep their frozen `rate_at_booking`. Any successful update reverts THIS sub-court's status to `PENDING`. The parent turf and other sub-courts are unaffected.

**Authentication:** Required. Role: `OWNER` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The sub-court's unique ID |

**Query Parameters:** None.

**Request Body:**
```json
{
  "name": "Court A — Premium",
  "sports": ["Cricket", "Football", "Hockey"],
  "hourly_price": 700.00,
  "opening_hour": "05:30",
  "closing_hour": "23:30"
}
```

> All fields are optional. Only fields included get updated.

**Response — Success (200 OK):**
```json
{
  "sub_court_id": 41,
  "turf_id": 15,
  "name": "Court A — Premium",
  "sports": ["Cricket", "Football", "Hockey"],
  "hourly_price": 700.00,
  "opening_hour": "05:30",
  "closing_hour": "23:30",
  "status": "PENDING",
  "previous_status": "APPROVED",
  "updated_at": "2026-05-14T18:00:00Z"
}
```

> `previous_status` is included so the owner sees clearly that their edit reverted this sub-court back to pending. The turf's status is unchanged.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed | `{ "error": "Validation failed", "details": { ... } }` |
| 400 | Request body is empty | `{ "error": "At least one field must be provided" }` |
| 400 | `closing_hour <= opening_hour` (after applying changes) | `{ "error": "Closing time must be after opening time" }` |
| 400 | New name conflicts with another sub-court on the same turf | `{ "error": "Sub-court name already exists on this turf" }` |
| 400 | Sub-court has upcoming confirmed bookings whose slots would fall outside the new operating hours | `{ "error": "Cannot shrink operating hours — there are upcoming bookings in the affected slots", "conflicting_bookings": [...] }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-owner role | `{ "error": "Forbidden" }` |
| 403 | Sub-court's turf doesn't belong to this owner | `{ "error": "Forbidden" }` |
| 404 | Sub-court not found | `{ "error": "Sub-court not found" }` |

**Internal Logic:**

Wrapped in a DB transaction.

1. Extract `user_id` and `role` from JWT. Validate `role == OWNER`.
2. Validate request body:
   - At least one field present.
   - Each field passes its format rules.
3. Fetch sub-court by `id`. If not found → 404.
4. Fetch its parent turf. Verify `turf.owner_id == user_id`. Else → 403.
5. If `name` is being changed, check for conflict on the same turf. Else → 400.
6. If `opening_hour` or `closing_hour` is being changed:
   - Compute effective new hours (using existing values for fields not provided).
   - Validate `new_closing > new_opening`. Else → 400.
   - Query upcoming confirmed bookings on this sub-court: `bookings.sub_court_id = X AND status = 'CONFIRMED' AND booking_date >= TODAY`.
   - For each such booking, check that all its slots fall within the new operating window. If any slot is outside → 400 with list of conflicting bookings.
7. Normalize sport names if `sports` is being changed.
8. Capture `previous_status = sub_court.status`.
9. Begin DB transaction.
10. Update `sub_courts` row with the provided fields.
11. **Revert this sub-court's `status` to PENDING.** The parent turf's status and other sub-courts are untouched.
12. Commit transaction.
13. Return 200.

**Side Effects:**
- Updates `sub_courts` row (this sub-court's status reverted to PENDING).
- Parent turf and other sub-courts unaffected.
- Existing bookings (`booking_slots`) are NOT affected; their `rate_at_booking` is frozen.
- Customer-facing impact: this sub-court disappears from booking flows until admin re-approves; other sub-courts on the same turf remain bookable.

**Notes:**
- **Price changes do not retroactively affect existing bookings.** This is the core guarantee from the `rate_at_booking` design. The customer who booked at ₹600/hr keeps ₹600/hr even if the owner raises the price to ₹700.
- **Shrinking operating hours** is the trickiest case. If the owner tries to close at 22:00 but there's a confirmed booking at 22:00–23:00, we reject the change. Owner must wait for or cancel those bookings first.
- **Expanding operating hours** is always safe.

---

### `GET /api/owner/bookings`

**Description:** List bookings across all turfs owned by the authenticated owner. Supports filtering by turf, sub-court, date range, and status. Used by the owner's calendar/dashboard view to see who has booked when.

**Authentication:** Required. Role: `OWNER` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `turf_id` | integer | No | Filter by a specific turf (must belong to owner) |
| `sub_court_id` | integer | No | Filter by a specific sub-court (must belong to owner) |
| `date_from` | string (YYYY-MM-DD) | No | Start of date range (inclusive). Default: today |
| `date_to` | string (YYYY-MM-DD) | No | End of date range (inclusive). Default: today + 30 days |
| `status` | string | No | Filter by booking status: `CONFIRMED`, `CANCELLED`, `COMPLETED`, `REFUNDED`, or `all` (default: `all`) |
| `sort_by` | string | No | One of: `date_asc` (default, for calendar view), `date_desc`, `created_desc` |
| `page` | integer | No | Page number, 1-indexed (default: `1`) |
| `page_size` | integer | No | Results per page (default: `20`, max: `100`) |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_results": 47,
  "total_pages": 3,
  "bookings": [
    {
      "booking_id": 1024,
      "turf_id": 15,
      "turf_name": "Greenfield Sports Arena",
      "sub_court_id": 41,
      "sub_court_name": "Court A",
      "booking_date": "2026-05-20",
      "slot_summary": "18:00 – 20:00",
      "slot_count": 2,
      "total_amount": 1200.00,
      "commission_amount": 120.00,
      "owner_payout": 1080.00,
      "status": "CONFIRMED",
      "customer": {
        "customer_id": 1,
        "name": "Rahul Sharma",
        "phone": "9876543210",
        "email": "rahul@example.com"
      },
      "created_at": "2026-05-14T12:05:00Z"
    },
    {
      "booking_id": 1019,
      "turf_id": 15,
      "turf_name": "Greenfield Sports Arena",
      "sub_court_id": 42,
      "sub_court_name": "Court B",
      "booking_date": "2026-05-20",
      "slot_summary": "19:00 – 20:00",
      "slot_count": 1,
      "total_amount": 1200.00,
      "commission_amount": 120.00,
      "owner_payout": 1080.00,
      "status": "CONFIRMED",
      "customer": {
        "customer_id": 8,
        "name": "Priya Iyer",
        "phone": "9876543220",
        "email": "priya@example.com"
      },
      "created_at": "2026-05-13T16:00:00Z"
    }
  ]
}
```

> Per the locked-in decision: owners can see name, phone, and email of customers who booked.
> `owner_payout = total_amount - commission_amount`.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter (bad date format, date_from > date_to, etc.) | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-owner role | `{ "error": "Forbidden" }` |
| 403 | `turf_id` or `sub_court_id` provided but doesn't belong to this owner | `{ "error": "Forbidden" }` |
| 404 | `turf_id` or `sub_court_id` not found | `{ "error": "Not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == OWNER`.
2. Validate query parameters.
3. If `turf_id` provided: fetch turf, verify ownership (else 403/404).
4. If `sub_court_id` provided: fetch sub-court + parent turf, verify ownership (else 403/404).
5. Build query:
   - `SELECT bookings.* FROM bookings JOIN sub_courts ON bookings.sub_court_id = sub_courts.id JOIN turfs ON sub_courts.turf_id = turfs.id WHERE turfs.owner_id = :user_id`
   - Apply filters: `turf_id`, `sub_court_id`, `booking_date BETWEEN :date_from AND :date_to`, `status`.
6. Apply sort and pagination.
7. For each booking, JOIN with `booking_slots` to compute `slot_summary` (MIN start_time – MAX end_time) and `slot_count`.
8. For each booking, JOIN with `customer_profiles` and `users` to fetch customer's `name`, `phone`, `email`.
9. Return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- The default date range (today to today+30) is sized for a typical calendar view. Owners wanting to look at past bookings can pass an earlier `date_from`.
- For very large owners (many turfs, many bookings), this endpoint is performance-sensitive. Indexes on `(bookings.sub_court_id, bookings.booking_date)` will help.
- `customer.email` and `customer.phone` are intentionally exposed per your earlier decision. This is a privacy-sensitive endpoint — only the owner with verified ownership of the turf can see this.

---

### `GET /api/owner/bookings/{id}`

**Description:** Retrieve full details of a single booking on one of the owner's turfs, including slot breakdown, payment info, refund info, payout status, and the customer's contact details.

**Authentication:** Required. Role: `OWNER` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The booking's unique ID |

**Query Parameters:** None.

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "booking_id": 1024,
  "status": "CONFIRMED",
  "turf": {
    "turf_id": 15,
    "name": "Greenfield Sports Arena",
    "address": "Plot 12, Baner Road, Pune",
    "city": "Pune"
  },
  "sub_court": {
    "sub_court_id": 41,
    "name": "Court A"
  },
  "customer": {
    "customer_id": 1,
    "name": "Rahul Sharma",
    "phone": "9876543210",
    "email": "rahul@example.com"
  },
  "booking_date": "2026-05-20",
  "slots": [
    { "start_time": "18:00", "end_time": "19:00", "rate_at_booking": 600.00 },
    { "start_time": "19:00", "end_time": "20:00", "rate_at_booking": 600.00 }
  ],
  "total_amount": 1200.00,
  "commission_amount": 120.00,
  "owner_payout_amount": 1080.00,
  "payment": {
    "amount": 1200.00,
    "payment_method": "UPI",
    "gateway_transaction_id": "pay_NXyZ789def012",
    "status": "SUCCESS",
    "created_at": "2026-05-14T12:05:00Z"
  },
  "refund": null,
  "payout": {
    "payout_id": 200,
    "amount": 1080.00,
    "status": "PENDING",
    "scheduled_at": "2026-05-20T22:00:00Z",
    "paid_at": null
  },
  "created_at": "2026-05-14T12:05:00Z"
}
```

> The owner sees the booking financially in full: amount paid, platform commission, their own payout. Payout status tracks whether the simulated transfer has happened yet.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-owner role | `{ "error": "Forbidden" }` |
| 403 | Booking exists but is on a turf NOT owned by this owner | `{ "error": "Forbidden" }` |
| 404 | Booking not found | `{ "error": "Booking not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == OWNER`.
2. Fetch booking by `id`. If not found → 404.
3. JOIN with `sub_courts` and `turfs` to get the turf. Verify `turfs.owner_id == user_id`. Else → 403.
4. Fetch:
   - `sub_courts` and `turfs` data for the turf/sub-court block
   - `customer_profiles` and `users` for customer contact info
   - `booking_slots` for all slots
   - `payments` (single primary payment row; if there are multiple due to reschedule, show the most recent or aggregate)
   - `refunds` (if any)
   - `payouts` (single row per booking — pre-scheduled at booking time)
5. Return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- Owner sees the customer's full contact (name, phone, email) per your earlier decision.
- Payout amount = `total_amount - commission_amount`.
- If multiple `payments` rows exist (original + reschedule top-up), the response shows the primary payment. For a full audit, an admin or the customer's booking-detail endpoint shows the full picture.

---

### `GET /api/owner/revenue`

**Description:** Retrieve the owner's revenue dashboard — aggregated bookings and revenue across all turfs, with daily/weekly/monthly views, and a list of top-performing sub-courts.

**Authentication:** Required. Role: `OWNER` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `period` | string | No | One of: `daily`, `weekly`, `monthly` (default: `monthly`). Controls how the revenue trend graph is grouped. |
| `date_from` | string (YYYY-MM-DD) | No | Start of date range. Default: depends on `period` (30 days for daily, 12 weeks for weekly, 12 months for monthly) |
| `date_to` | string (YYYY-MM-DD) | No | End of date range. Default: today |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "period": "monthly",
  "date_from": "2025-06-01",
  "date_to": "2026-05-15",
  "summary": {
    "total_bookings": 320,
    "total_revenue": 384000.00,
    "total_commission_paid": 38400.00,
    "total_owner_earnings": 345600.00,
    "average_booking_value": 1200.00
  },
  "trend": [
    { "bucket": "2025-06", "bookings": 18, "revenue": 21600.00, "earnings": 19440.00 },
    { "bucket": "2025-07", "bookings": 24, "revenue": 28800.00, "earnings": 25920.00 },
    { "bucket": "2025-08", "bookings": 30, "revenue": 36000.00, "earnings": 32400.00 },
    { "bucket": "2026-05", "bookings": 42, "revenue": 50400.00, "earnings": 45360.00 }
  ],
  "top_sub_courts": [
    {
      "sub_court_id": 41,
      "turf_name": "Greenfield Sports Arena",
      "sub_court_name": "Court A",
      "bookings": 92,
      "revenue": 110400.00,
      "earnings": 99360.00
    },
    {
      "sub_court_id": 42,
      "turf_name": "Greenfield Sports Arena",
      "sub_court_name": "Court B",
      "bookings": 76,
      "revenue": 91200.00,
      "earnings": 82080.00
    },
    {
      "sub_court_id": 55,
      "turf_name": "Star Cricket Ground",
      "sub_court_name": "Pitch 1",
      "bookings": 64,
      "revenue": 76800.00,
      "earnings": 69120.00
    }
  ]
}
```

> `revenue` = total customer-paid amount. `commission_paid` = platform's cut. `earnings` (owner's actual payout) = revenue − commission.
> `bucket` format:
> - For `period=daily`: `YYYY-MM-DD`
> - For `period=weekly`: `YYYY-WXX` (ISO week number, e.g., `2026-W20`)
> - For `period=monthly`: `YYYY-MM`

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-owner role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == OWNER`.
2. Validate query parameters; apply defaults.
3. Build base query — only include bookings on this owner's turfs in revenue-generating states (CONFIRMED, COMPLETED — not CANCELLED, not REFUNDED):
   - `SELECT bookings.* FROM bookings JOIN sub_courts JOIN turfs WHERE turfs.owner_id = :user_id AND status IN ('CONFIRMED', 'COMPLETED') AND booking_date BETWEEN :date_from AND :date_to`
4. Compute summary aggregates (SUM, COUNT, AVG).
5. Compute trend grouping:
   - daily: `GROUP BY booking_date`
   - weekly: `GROUP BY YEARWEEK(booking_date)`
   - monthly: `GROUP BY YEAR(booking_date), MONTH(booking_date)`
6. Compute top sub-courts:
   - `GROUP BY sub_court_id ORDER BY SUM(total_amount) DESC LIMIT 5`
7. Return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- This endpoint only counts revenue from **non-refunded, non-cancelled** bookings. A booking that was rescheduled with a partial refund counts at its current `total_amount` (which already reflects the refunded delta).
- All amounts are in INR.
- For owners with no bookings, all aggregates are 0 and trend/top_sub_courts are empty arrays.

---

### `GET /api/owner/payouts`

**Description:** List the owner's payouts — including pending (not yet released), paid, failed, and cancelled. Each payout corresponds to one booking on one of the owner's turfs.

**Authentication:** Required. Role: `OWNER` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter by payout status: `PENDING`, `PAID`, `FAILED`, `CANCELLED`, or `all` (default: `all`) |
| `date_from` | string (YYYY-MM-DD) | No | Filter by `scheduled_at` from this date. Default: 30 days ago |
| `date_to` | string (YYYY-MM-DD) | No | Filter by `scheduled_at` up to this date. Default: 30 days from today |
| `sort_by` | string | No | One of: `scheduled_desc` (default), `scheduled_asc`, `paid_desc` |
| `page` | integer | No | Page number, 1-indexed (default: `1`) |
| `page_size` | integer | No | Results per page (default: `20`, max: `100`) |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_results": 35,
  "total_pages": 2,
  "summary": {
    "total_pending": 8400.00,
    "total_paid": 12500.00,
    "total_failed": 0.00
  },
  "payouts": [
    {
      "payout_id": 200,
      "booking_id": 1024,
      "turf_name": "Greenfield Sports Arena",
      "sub_court_name": "Court A",
      "booking_date": "2026-05-20",
      "amount": 1080.00,
      "status": "PENDING",
      "scheduled_at": "2026-05-20T22:00:00Z",
      "paid_at": null
    },
    {
      "payout_id": 198,
      "booking_id": 1019,
      "turf_name": "Greenfield Sports Arena",
      "sub_court_name": "Court B",
      "booking_date": "2026-05-15",
      "amount": 1080.00,
      "status": "PAID",
      "scheduled_at": "2026-05-15T22:00:00Z",
      "paid_at": "2026-05-15T22:01:00Z"
    },
    {
      "payout_id": 185,
      "booking_id": 1001,
      "turf_name": "Star Cricket Ground",
      "sub_court_name": "Pitch 1",
      "booking_date": "2026-05-10",
      "amount": 900.00,
      "status": "CANCELLED",
      "scheduled_at": "2026-05-10T22:00:00Z",
      "paid_at": null
    }
  ]
}
```

> `summary` reflects the totals across the filtered date range, not just the current page.
> `scheduled_at` is when the auto-payout job WILL release (or has released) the payout.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-owner role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == OWNER`.
2. Validate query parameters.
3. Build query: `SELECT * FROM payouts WHERE owner_id = :user_id`
4. Apply filters: status, scheduled_at date range.
5. Compute summary aggregates (sum of amounts per status, across full filter).
6. Apply sort and pagination.
7. For each payout, JOIN with `bookings`, `sub_courts`, `turfs` to get `turf_name`, `sub_court_name`, `booking_date`.
8. Return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- Per the earlier design: payouts are **simulated**. The scheduled job (separate cron) flips `PENDING` → `PAID` after the configured delay following slot completion. No real money moves.
- `CANCELLED` payouts come from cancelled bookings — the owner doesn't get paid for those.
- `FAILED` is a v2 concept (real payouts could fail); for v1 simulation, no payout will ever be FAILED.

---

### `GET /api/owner/reviews`

**Description:** List all customer reviews left on turfs owned by the authenticated owner. Owner sees the review text, customer name (full, not masked), rating, and their own reply if any.

**Authentication:** Required. Role: `OWNER` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `turf_id` | integer | No | Filter by a specific turf (must belong to owner) |
| `min_rating` | integer | No | Filter to reviews with rating >= this value (1–5) |
| `max_rating` | integer | No | Filter to reviews with rating <= this value (1–5) |
| `replied` | boolean | No | If `true`, only reviews with an owner reply. If `false`, only reviews without a reply. Omit for both. |
| `sort_by` | string | No | One of: `created_desc` (default), `created_asc`, `rating_desc`, `rating_asc` |
| `page` | integer | No | Page number, 1-indexed (default: `1`) |
| `page_size` | integer | No | Results per page (default: `10`, max: `50`) |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 10,
  "total_results": 87,
  "total_pages": 9,
  "summary": {
    "avg_rating": 4.5,
    "review_count": 87,
    "rating_breakdown": {
      "5": 50,
      "4": 25,
      "3": 8,
      "2": 3,
      "1": 1
    },
    "unreplied_count": 12
  },
  "reviews": [
    {
      "review_id": 145,
      "turf_id": 23,
      "turf_name": "Champions Turf",
      "customer_name": "Rahul Sharma",
      "rating": 5,
      "review_text": "Excellent turf, great lighting and friendly staff.",
      "created_at": "2026-05-14T18:30:00Z",
      "owner_reply": null
    },
    {
      "review_id": 102,
      "turf_id": 15,
      "turf_name": "Greenfield Sports Arena",
      "customer_name": "Amit Kumar",
      "rating": 5,
      "review_text": "Excellent turf, well maintained.",
      "created_at": "2026-05-10T14:30:00Z",
      "owner_reply": {
        "reply_text": "Thanks Amit, see you soon!",
        "created_at": "2026-05-11T09:00:00Z"
      }
    }
  ]
}
```

> Unlike the customer-facing turf detail endpoint (which masks names like "Amit K."), the owner sees the **full** customer name. This is intentional — the owner has a business relationship with the customer (the booking) and may want to follow up.
> `summary.unreplied_count` helps the owner spot reviews that need a response.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-owner role | `{ "error": "Forbidden" }` |
| 403 | `turf_id` provided but doesn't belong to this owner | `{ "error": "Forbidden" }` |
| 404 | `turf_id` not found | `{ "error": "Turf not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == OWNER`.
2. Validate query parameters.
3. If `turf_id` provided: fetch and verify ownership.
4. Build query:
   - `SELECT reviews.* FROM reviews JOIN turfs ON reviews.turf_id = turfs.id WHERE turfs.owner_id = :user_id`
   - Apply filters: turf_id, rating range, replied (LEFT JOIN with `review_replies` and check IS NULL / IS NOT NULL).
5. Compute summary: total count, avg rating, count per rating value, count of unreplied.
6. Apply sort and pagination.
7. For each review, fetch:
   - `customer_name` from `customer_profiles` (full, not masked).
   - `owner_reply` from `review_replies` (NULL if no reply).
8. Return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- Customer full names are exposed because the owner already has access to customer contact info via the bookings endpoint, so this isn't an additional privacy leak.
- The `summary` aggregates respect filters but are computed across the full filtered set (not just the current page).

---

### `POST /api/owner/reviews/{id}/reply`

**Description:** Add a reply to a customer review on one of the owner's turfs. Each review can have at most one reply. To change a previously posted reply, the owner submits this endpoint again — the existing reply is overwritten (upsert behavior). Replies are auto-published; no admin moderation.

**Authentication:** Required. Role: `OWNER` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `review_id` to reply to. |

**Query Parameters:** None.

**Request Body:**
```json
{
  "reply_text": "string, required, 1-1000 characters, trimmed"
}
```

**Response — Success (201 Created — new reply) or (200 OK — updated existing reply):**
```json
{
  "reply_id": 77,
  "review_id": 145,
  "reply_text": "Thanks for the kind words, Rahul! See you next weekend.",
  "created_at": "2026-05-15T10:22:00Z",
  "updated": false
}
```

> `updated` is `false` when the reply was newly created (201), `true` when an existing reply was overwritten (200). The frontend can use this to show a toast like "Reply posted" vs "Reply updated".

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (empty `reply_text`, too long, missing) | `{ "error": "Validation failed", "details": { "reply_text": "..." } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-owner role | `{ "error": "Forbidden" }` |
| 403 | The review is on a turf NOT owned by this owner | `{ "error": "Forbidden" }` |
| 404 | `review_id` does not exist | `{ "error": "Review not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == OWNER`.
2. Validate request body — trim `reply_text`, check length (1–1000 chars, non-empty after trim).
3. Fetch the review: `SELECT * FROM reviews WHERE id = :review_id`.
   - If not found → return 404.
4. Verify ownership: `SELECT owner_id FROM turfs WHERE id = reviews.turf_id`.
   - If `turfs.owner_id != JWT.user_id` → return 403.
5. Check if a reply already exists: `SELECT * FROM review_replies WHERE review_id = :review_id`.
6. **If no existing reply:**
   - Insert into `review_replies`: `review_id`, `owner_id = JWT.user_id`, `reply_text`, `created_at = now()`.
   - Return 201 with `updated: false`.
7. **If a reply exists:**
   - Update `reply_text` (keep original `created_at` to preserve the original reply timestamp — see Notes).
   - Return 200 with `updated: true`.

**Side Effects:**
- Inserts or updates a row in `review_replies`.
- No notification sent (customer reviews are not actively monitored by customers in v1; reply visible next time they view the turf).

**Notes:**
- The `review_replies` table has a `UNIQUE` constraint on `review_id`, which naturally enforces "one reply per review." Without upsert behavior, owners hitting this endpoint twice would get a 409 — upsert is friendlier.
- Design decision on `created_at`: we **keep the original `created_at`** on update. Reasoning: the customer-facing turf detail page shows "owner replied on DATE"; if the owner fixes a typo, we shouldn't make it look like a brand-new reply. If you'd prefer to refresh `created_at` on every update, that's a one-line change.
- If the underlying review is later deleted by the customer (`DELETE /api/customer/reviews/{id}`), the reply is cascade-deleted via the `ON DELETE CASCADE` on `review_replies.review_id`.
- No separate `DELETE /api/owner/reviews/{id}/reply` endpoint in v1 — owners can overwrite but not delete. Keeps the surface area smaller. Can add later if needed.

---

## Admin

_Endpoints under `/api/admin`. All require a valid JWT with `role == ADMIN` and `status == ACTIVE`. The standard 401/403/500 responses from the Conventions section apply and are not repeated unless behavior differs._

---

### `GET /api/admin/dashboard`

**Description:** Returns the platform-wide KPI summary and revenue graph data shown on the admin home screen. Single aggregate call so the dashboard loads in one request. Covers total users, total bookings, today's revenue, revenue trend over time, and top turfs/cities.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `trend` | string | No | Granularity of the revenue trend series: `daily`, `weekly`, or `monthly` (default: `daily`). |
| `trend_range` | integer | No | How many trend buckets to return, counting back from today. Default: `30` for daily, `12` for weekly, `12` for monthly. Max: `90`. |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "kpis": {
    "total_users": 1842,
    "total_customers": 1700,
    "total_owners": 130,
    "total_staff": 11,
    "total_admins": 3,
    "total_bookings": 5230,
    "bookings_today": 47,
    "revenue_today": 18400.00,
    "commission_today": 2760.00,
    "total_revenue": 4150000.00,
    "total_commission": 622500.00
  },
  "revenue_trend": {
    "granularity": "daily",
    "series": [
      { "bucket": "2026-05-13", "revenue": 16200.00, "commission": 2430.00, "bookings": 41 },
      { "bucket": "2026-05-14", "revenue": 19850.00, "commission": 2977.50, "bookings": 52 },
      { "bucket": "2026-05-15", "revenue": 18400.00, "commission": 2760.00, "bookings": 47 }
    ]
  },
  "top_turfs": [
    { "turf_id": 23, "turf_name": "Champions Turf", "city": "Pune", "bookings": 312, "revenue": 287000.00 },
    { "turf_id": 15, "turf_name": "Greenfield Sports Arena", "city": "Pune", "bookings": 280, "revenue": 251000.00 }
  ],
  "top_cities": [
    { "city": "Pune", "bookings": 1820, "revenue": 1640000.00 },
    { "city": "Mumbai", "bookings": 1310, "revenue": 1190000.00 }
  ]
}
```

> All revenue figures are **gross booking value** (what customers paid); `commission` is the platform's cut. "Revenue" here = sum of `bookings.total_amount`; "commission" = sum of `bookings.commission_amount`.
> `revenue_today` / `bookings_today` are computed on the server's local date boundary (IST, since this is an India-only v1).
> `top_turfs` and `top_cities` are the top 5 each, ranked by revenue (all-time).

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter (bad `trend` enum, `trend_range` out of bounds) | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == ADMIN`.
2. Validate query parameters (`trend` enum; `trend_range` integer within 1–90).
3. **KPIs:**
   - User counts: `SELECT role, COUNT(*) FROM users GROUP BY role`. `total_users` = sum. (Counts include suspended/banned users — they still exist.)
   - `total_bookings`: `COUNT(*) FROM bookings` where status in (`CONFIRMED`, `COMPLETED`) — excludes `CANCELLED`/`REFUNDED`.
   - `bookings_today`: same filter, `booking_date = CURDATE()` (IST).
   - `revenue_today` / `commission_today`: `SUM(total_amount)`, `SUM(commission_amount)` from `bookings` where `booking_date = CURDATE()` and status in (`CONFIRMED`,`COMPLETED`).
   - `total_revenue` / `total_commission`: same sums, all dates, status in (`CONFIRMED`,`COMPLETED`).
4. **Revenue trend:** bucket `bookings` by `booking_date` at the requested granularity for the last `trend_range` buckets. For each bucket: `SUM(total_amount)`, `SUM(commission_amount)`, `COUNT(*)`, same status filter. Buckets with no bookings returned with zeros (continuous x-axis).
5. **Top turfs:** JOIN `bookings → sub_courts → turfs`, group by turf, sum revenue, order desc, limit 5.
6. **Top cities:** same JOIN, group by `turfs.city`, sum revenue, order desc, limit 5.
7. Return 200.

**Side Effects:**
- No DB writes. Pure read. Potentially heavy aggregate query — see Notes on caching.

**Notes:**
- **Definitional choice — which bookings count as "revenue":** we count `CONFIRMED` + `COMPLETED`, and exclude `CANCELLED` + `REFUNDED`. A refunded booking shouldn't inflate platform revenue. This net-of-refunds definition is used consistently across the dashboard, admin bookings summary, and admin revenue endpoint.
- This is the heaviest read endpoint in the system. Implementation can cache the whole response for 5–15 minutes. Not part of the contract.
- All dates use IST (`Asia/Kolkata`) since v1 is India-only. "Today" = IST calendar day.
- `top_turfs`/`top_cities` are all-time by design. A date-ranged version is a v2 nicety.
- No per-owner or per-city drill-down here — that's what `GET /api/admin/revenue` is for.

---

### `GET /api/admin/users`

**Description:** List and search all users on the platform across every role. The admin's central user-management view — supports filtering by role and status, plus a free-text search on name/email/phone. Used to find a user before suspending, banning, or reactivating them.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `role` | string | No | Filter by role: `CUSTOMER`, `OWNER`, `STAFF`, `ADMIN`, or `all` (default: `all`). |
| `status` | string | No | Filter by account status: `ACTIVE`, `SUSPENDED`, `BANNED`, or `all` (default: `all`). |
| `search` | string | No | Free-text search across name, email, and phone (case-insensitive, partial match). Trimmed; min 2 chars if provided. |
| `sort_by` | string | No | One of: `created_desc` (default), `created_asc`, `name_asc`. |
| `page` | integer | No | Page number, 1-indexed (default: `1`). |
| `page_size` | integer | No | Results per page (default: `20`, max: `100`). |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_results": 1842,
  "total_pages": 93,
  "summary": {
    "active_count": 1790,
    "suspended_count": 40,
    "banned_count": 12
  },
  "users": [
    {
      "user_id": 7,
      "name": "Rahul Sharma",
      "email": "rahul@example.com",
      "phone": "9876543210",
      "role": "CUSTOMER",
      "status": "ACTIVE",
      "created_at": "2026-01-12T08:30:00Z"
    },
    {
      "user_id": 12,
      "name": "Vikram Patel",
      "email": "vikram@example.com",
      "phone": "9876543211",
      "role": "OWNER",
      "status": "SUSPENDED",
      "created_at": "2026-02-03T10:00:00Z"
    }
  ]
}
```

> `name` is resolved from the role-specific profile table (`customer_profiles`, `owner_profiles`, `staff_profiles`, `admin_profiles`).
> `summary` counts are across the **full filtered set** (respecting role/search filters but ignoring the status filter — so the admin always sees the active/suspended/banned split for the current role/search context).

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter (bad enum, search < 2 chars) | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == ADMIN`.
2. Validate query parameters.
3. Base query: `SELECT * FROM users WHERE 1=1`.
4. Apply filters:
   - `role` → `users.role = :role`.
   - `status` → `users.status = :status`.
   - `search` → name/email/phone partial match. Name lives in profile tables, so the query LEFT JOINs all four profile tables and coalesces the name, then matches `LOWER(name) LIKE %term%` OR `LOWER(email) LIKE %term%` OR `phone LIKE %term%`.
5. Compute `summary` counts (apply role/search filters, group by status, ignore the status filter for this aggregate).
6. Apply sort and pagination.
7. For each user, resolve `name` from the appropriate profile table based on `role`.
8. Return 200.

**Side Effects:**
- No DB writes. Pure read.

**Notes:**
- Admins can see and search **other admins** here too (`role=ADMIN`). The dedicated `GET /api/admin/admins` endpoint is a focused convenience view, but admins also surface in this general list.
- No password hashes, no bank details, no PII beyond name/email/phone/role/status are returned.
- The name search across four profile tables via LEFT JOIN + COALESCE is a known performance consideration at scale. For v1 volumes it's fine.

---

### `PUT /api/admin/users/{id}/suspend`

**Description:** Suspend a user account. A suspended user cannot log in (login returns 403) and any existing JWT is rejected on the next authenticated request. Suspension is **reversible** via the activate endpoint. Used for temporary enforcement (policy review, payment dispute, etc.).

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `user_id` to suspend. |

**Query Parameters:** None.

**Request Body:**
```json
{
  "reason": "string, optional, 0-500 characters, trimmed — internal note, not shown to the user"
}
```

> `reason` is optional and not persisted in v1 (no audit table in the schema). It's accepted so the frontend can collect it without breaking later when an audit log is added.

**Response — Success (200 OK):**
```json
{
  "user_id": 12,
  "status": "SUSPENDED",
  "previous_status": "ACTIVE"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Target user is an admin (admins cannot be suspended) | `{ "error": "Admins cannot be suspended", "details": { "user_id": 12 } }` |
| 400 | User is already `SUSPENDED` | `{ "error": "User already suspended" }` |
| 400 | User is `BANNED` (banned is terminal — cannot be downgraded to suspended) | `{ "error": "Cannot suspend a banned user" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 404 | `user_id` does not exist | `{ "error": "User not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == ADMIN`.
2. Fetch target: `SELECT * FROM users WHERE id = :id`. If not found → 404.
3. Guard rails:
   - If target `role == ADMIN` → 400.
   - If target `status == SUSPENDED` → 400.
   - If target `status == BANNED` → 400.
4. Update `users.status = 'SUSPENDED'`.
5. Return 200 with `previous_status`.

**Side Effects:**
- One row updated in `users`.
- The user's existing JWTs become unusable: the auth filter checks `users.status` on every request, so any in-flight token is rejected with 403 on the next call.
- No notification sent in v1.

---

### `PUT /api/admin/users/{id}/ban`

**Description:** Ban a user account. Same access effect as suspension (cannot log in, JWTs rejected), but **terminal** — a banned user cannot be reactivated or downgraded to suspended in v1. Used for serious/permanent enforcement.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `user_id` to ban. |

**Query Parameters:** None.

**Request Body:**
```json
{
  "reason": "string, optional, 0-500 characters, trimmed — internal note, not persisted in v1"
}
```

**Response — Success (200 OK):**
```json
{
  "user_id": 12,
  "status": "BANNED",
  "previous_status": "SUSPENDED"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Target user is an admin | `{ "error": "Admins cannot be banned", "details": { "user_id": 12 } }` |
| 400 | User is already `BANNED` | `{ "error": "User already banned" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 404 | `user_id` does not exist | `{ "error": "User not found" }` |

> Unlike suspend, banning is allowed **from either `ACTIVE` or `SUSPENDED`**. Escalation is always permitted; only the already-`BANNED` no-op is rejected.

**Internal Logic:**
1. Validate admin JWT.
2. Fetch target. If not found → 404.
3. Guard rails:
   - If target `role == ADMIN` → 400.
   - If target `status == BANNED` → 400.
   - `ACTIVE → BANNED` and `SUSPENDED → BANNED` are both allowed.
4. Update `users.status = 'BANNED'`.
5. Return 200 with `previous_status`.

**Side Effects:**
- One row updated in `users`.
- Existing JWTs rejected on next request (same mechanism as suspend).
- No notification in v1.

---

### `PUT /api/admin/users/{id}/activate`

**Description:** Reactivate a **suspended** user, returning them to `ACTIVE`. This is the inverse of suspend. It deliberately does **not** work on banned users — bans are terminal in v1.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `user_id` to reactivate. |

**Query Parameters:** None.

**Request Body:**
```json
{
  "reason": "string, optional, 0-500 characters, trimmed — internal note, not persisted in v1"
}
```

**Response — Success (200 OK):**
```json
{
  "user_id": 12,
  "status": "ACTIVE",
  "previous_status": "SUSPENDED"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | User is already `ACTIVE` | `{ "error": "User already active" }` |
| 400 | User is `BANNED` (ban is terminal — cannot be reactivated in v1) | `{ "error": "Banned users cannot be reactivated" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 404 | `user_id` does not exist | `{ "error": "User not found" }` |

**Internal Logic:**
1. Validate admin JWT.
2. Fetch target. If not found → 404.
3. Guard rails:
   - If `status == ACTIVE` → 400.
   - If `status == BANNED` → 400 (terminal).
   - Only `SUSPENDED → ACTIVE` is allowed.
4. Update `users.status = 'ACTIVE'`.
5. Return 200 with `previous_status`.

**Side Effects:**
- One row updated in `users`.
- User can log in again immediately.
- No notification in v1.

**Shared Notes (suspend / ban / activate):**
- **Admins are immune** to suspend/ban via these endpoints. Admin lifecycle is handled only by `POST /api/admin/admins` and `DELETE /api/admin/admins/{id}`.
- **State model:** `ACTIVE ⇄ SUSPENDED → BANNED` (terminal). Ban is a one-way door in v1. Undoing a ban is a deliberate out-of-band DB action.
- **`reason` is accepted but not stored** in v1 — the schema has no audit/action-log table. Accepting the field now means the frontend contract won't change when an `admin_actions` audit table is added in v2.
- The auth filter enforcing "suspended/banned ⇒ 403 on every request" is centralized; these endpoints just flip the flag.

---

### `GET /api/admin/turfs/pending`

**Description:** List turf listings awaiting admin approval — turfs in `PENDING` status. This is the admin's turf-moderation queue. Each entry includes enough detail (owner, address, photos, sub-courts summary) for the admin to make an approve/reject decision without extra calls.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `city` | string | No | Filter by city (case-insensitive exact match, trimmed). |
| `sort_by` | string | No | One of: `created_asc` (default — oldest pending first), `created_desc`. |
| `page` | integer | No | Page number, 1-indexed (default: `1`). |
| `page_size` | integer | No | Results per page (default: `20`, max: `100`). |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_results": 6,
  "total_pages": 1,
  "turfs": [
    {
      "turf_id": 51,
      "name": "Skyline Box Cricket",
      "description": "Rooftop box cricket with floodlights.",
      "address": "5th Floor, Galleria Mall, Hinjewadi, Pune",
      "city": "Pune",
      "contact_phone": "9123456780",
      "status": "PENDING",
      "created_at": "2026-05-12T10:00:00Z",
      "owner": {
        "owner_id": 30,
        "name": "Sunil Mehta",
        "email": "sunil@example.com",
        "phone": "9123456780"
      },
      "photos": [
        "https://cdn.bookmyturf.in/turfs/51/1.jpg",
        "https://cdn.bookmyturf.in/turfs/51/2.jpg"
      ],
      "sub_courts_summary": {
        "total": 2,
        "pending": 2,
        "approved": 0,
        "rejected": 0
      }
    }
  ]
}
```

> `sub_courts_summary` is a count breakdown, not the full sub-court objects. Full sub-court review is a separate queue (`GET /api/admin/sub-courts/pending`).
> Owner contact is included so the admin can call the owner if the listing needs clarification before approval.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Extract `user_id`, `role` from JWT. Validate `role == ADMIN`.
2. Validate query parameters.
3. Query: `SELECT * FROM turfs WHERE status = 'PENDING'`, optional `city` filter.
4. Compute `total_results`, apply sort + pagination.
5. For each turf hydrate:
   - `owner` via `users` + `owner_profiles` on `turfs.owner_id`.
   - `photos` — all `turf_photos.photo_url` for the turf, ordered by `id`.
   - `sub_courts_summary` — `SELECT status, COUNT(*) FROM sub_courts WHERE turf_id = :id GROUP BY status`, plus a total.
6. Return 200.

**Side Effects:** None. Pure read.

**Notes:**
- Default sort `created_asc` — oldest pending turf first, so owners aren't stuck waiting while newer listings jump the queue.
- A turf and its sub-courts are approved **independently**. This queue is turf-level only.
- Only `PENDING` turfs appear here. Once approved or rejected, the turf leaves this queue permanently.

---

### `PUT /api/admin/turfs/{id}/approve`

**Description:** Approve a pending turf listing. Sets the turf's status to `APPROVED`, making it eligible to appear in public/customer search (provided it also has at least one approved sub-court). Approval applies to turf-level fields only — sub-courts are approved separately.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `turf_id` to approve. |

**Query Parameters:** None.
**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "turf_id": 51,
  "status": "APPROVED",
  "previous_status": "PENDING"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Turf is already `APPROVED` | `{ "error": "Turf already approved" }` |
| 400 | Turf is `REJECTED` (terminal — cannot re-approve in v1) | `{ "error": "Cannot approve a rejected turf" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 404 | `turf_id` does not exist | `{ "error": "Turf not found" }` |

**Internal Logic:**
1. Validate admin JWT.
2. Fetch turf: `SELECT * FROM turfs WHERE id = :id`. If not found → 404.
3. Guard rails:
   - `status == APPROVED` → 400.
   - `status == REJECTED` → 400.
   - Only `PENDING → APPROVED` allowed.
4. Update `turfs.status = 'APPROVED'`.
5. Insert a notification for the owner: type `TURF_APPROVED`, message naming the turf.
6. Return 200 with `previous_status`.

**Side Effects:**
- One row updated in `turfs`.
- One row inserted into `notifications` for the owner (`TURF_APPROVED`).
- Sub-court statuses are **untouched**.

---

### `PUT /api/admin/turfs/{id}/reject`

**Description:** Reject a pending turf listing. Sets status to `REJECTED`. The turf will not appear in any search and the owner must create a new listing if they want to try again (no resubmit-in-place in v1). Optional rejection reason is sent to the owner via notification.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `turf_id` to reject. |

**Query Parameters:** None.

**Request Body:**
```json
{
  "reason": "string, optional, 0-500 characters, trimmed — included in the owner notification message if provided"
}
```

**Response — Success (200 OK):**
```json
{
  "turf_id": 51,
  "status": "REJECTED",
  "previous_status": "PENDING"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Turf is already `REJECTED` | `{ "error": "Turf already rejected" }` |
| 400 | Turf is `APPROVED` (cannot reject an already-live turf in v1) | `{ "error": "Cannot reject an approved turf" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 404 | `turf_id` does not exist | `{ "error": "Turf not found" }` |

**Internal Logic:**
1. Validate admin JWT.
2. Fetch turf. If not found → 404.
3. Guard rails:
   - `status == REJECTED` → 400.
   - `status == APPROVED` → 400.
   - Only `PENDING → REJECTED` allowed.
4. Update `turfs.status = 'REJECTED'`.
5. Insert a notification for the owner: type `TURF_REJECTED`, message including `reason` if provided.
6. Return 200 with `previous_status`.

**Side Effects:**
- One row updated in `turfs`.
- One row inserted into `notifications` for the owner (`TURF_REJECTED`).
- Sub-courts are left as-is.

**Shared Notes (turf approve / reject):**
- **Both decisions are terminal.** `PENDING` is the only state from which approve/reject works. Taking down a problematic live turf is handled by **banning the owner** (user-management), not by un-approving the turf — a deliberate v1 simplification.
- The README says admin can "approve or reject only" — no edits. These endpoints honor that.
- `TURF_APPROVED` / `TURF_REJECTED` notification types are added to the known-types list.

---

### `GET /api/admin/sub-courts/pending`

**Description:** List sub-courts awaiting admin approval — sub-courts in `PENDING` status. Separate moderation queue from turfs, because the schema approves sub-courts independently of their parent turf. Each entry includes the parent turf context and owner contact.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `turf_id` | integer | No | Filter to sub-courts of a specific turf. |
| `city` | string | No | Filter by the parent turf's city (case-insensitive exact, trimmed). |
| `sort_by` | string | No | One of: `created_asc` (default — see Notes), `turf_name_asc`. |
| `page` | integer | No | Page number, 1-indexed (default: `1`). |
| `page_size` | integer | No | Results per page (default: `20`, max: `100`). |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_results": 4,
  "total_pages": 1,
  "sub_courts": [
    {
      "sub_court_id": 88,
      "name": "Court A",
      "sports": ["Cricket", "Football"],
      "hourly_price": 1000.00,
      "opening_hour": "06:00",
      "closing_hour": "23:00",
      "status": "PENDING",
      "turf": {
        "turf_id": 51,
        "name": "Skyline Box Cricket",
        "city": "Pune",
        "status": "APPROVED"
      },
      "owner": {
        "owner_id": 30,
        "name": "Sunil Mehta",
        "phone": "9123456780"
      }
    }
  ]
}
```

> `turf.status` is included so the admin sees context — approving a sub-court whose parent turf is still `PENDING` is allowed (independent approval), but the turf won't be publicly visible until it's also approved.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 404 | `turf_id` provided but does not exist | `{ "error": "Turf not found" }` |

**Internal Logic:**
1. Validate admin JWT.
2. Validate query parameters. If `turf_id` provided, verify the turf exists (404 if not).
3. Query: `SELECT * FROM sub_courts WHERE status = 'PENDING'`, optional `turf_id` filter; `city` filter applied via JOIN to `turfs`.
4. Compute `total_results`, apply sort + pagination.
5. For each sub-court hydrate:
   - `turf` via `turfs` on `sub_courts.turf_id` (id, name, city, status).
   - `owner` via `users` + `owner_profiles` on `turfs.owner_id` (id, name, phone).
   - Parse `sports` JSON into an array.
6. Return 200.

**Side Effects:** None. Pure read.

**Notes:**
- **Schema gap:** `sub_courts` has no `created_at` column (unlike `turfs`). `created_asc` sorts by `sub_courts.id ASC` as a proxy for creation order (auto-increment PK is monotonic). If true submission timestamps are needed, add a `created_at` column to `sub_courts` (see Schema Notes at the end of this document).
- Sub-courts and turfs are independent moderation tracks. Public/customer search requires *both* turf `APPROVED` and at least one sub-court `APPROVED`.

---

### `PUT /api/admin/sub-courts/{id}/approve`

**Description:** Approve a pending sub-court. Sets its status to `APPROVED`, making its slots bookable (once the parent turf is also approved). Sub-court-level decision only.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `sub_court_id` to approve. |

**Query Parameters:** None.
**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "sub_court_id": 88,
  "status": "APPROVED",
  "previous_status": "PENDING",
  "turf_id": 51,
  "turf_status": "PENDING",
  "publicly_visible": false
}
```

> `publicly_visible` is a computed convenience flag: `true` only if this sub-court is now `APPROVED` **and** its parent turf is `APPROVED`.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Sub-court already `APPROVED` | `{ "error": "Sub-court already approved" }` |
| 400 | Sub-court is `REJECTED` (terminal) | `{ "error": "Cannot approve a rejected sub-court" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 404 | `sub_court_id` does not exist | `{ "error": "Sub-court not found" }` |

**Internal Logic:**
1. Validate admin JWT.
2. Fetch sub-court. If not found → 404.
3. Guard rails: `APPROVED` → 400; `REJECTED` → 400; only `PENDING → APPROVED`.
4. Update `sub_courts.status = 'APPROVED'`.
5. Look up parent turf status; compute `publicly_visible`.
6. Insert a notification for the owner: type `SUBCOURT_APPROVED`, naming the sub-court and parent turf.
7. Return 200.

**Side Effects:**
- One row updated in `sub_courts`.
- One notification inserted for the owner.

---

### `PUT /api/admin/sub-courts/{id}/reject`

**Description:** Reject a pending sub-court. Sets status to `REJECTED`. Its slots will never be bookable. Owner must add a new sub-court if they want to retry (no resubmit-in-place in v1). Optional reason relayed via notification.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `sub_court_id` to reject. |

**Query Parameters:** None.

**Request Body:**
```json
{
  "reason": "string, optional, 0-500 characters, trimmed — included in the owner notification if provided"
}
```

**Response — Success (200 OK):**
```json
{
  "sub_court_id": 88,
  "status": "REJECTED",
  "previous_status": "PENDING",
  "turf_id": 51
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Sub-court already `REJECTED` | `{ "error": "Sub-court already rejected" }` |
| 400 | Sub-court is `APPROVED` (cannot reject a live sub-court in v1) | `{ "error": "Cannot reject an approved sub-court" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 404 | `sub_court_id` does not exist | `{ "error": "Sub-court not found" }` |

**Internal Logic:**
1. Validate admin JWT.
2. Fetch sub-court. If not found → 404.
3. Guard rails: `REJECTED` → 400; `APPROVED` → 400; only `PENDING → REJECTED`.
4. Update `sub_courts.status = 'REJECTED'`.
5. Insert a notification for the owner: type `SUBCOURT_REJECTED`, including `reason` if provided.
6. Return 200.

**Side Effects:**
- One row updated in `sub_courts`.
- One notification inserted for the owner.

**Shared Notes (sub-court approve / reject):**
- Mirrors turf approve/reject exactly: `PENDING` is the only actionable state, both decisions terminal, no edits by admin.
- A booking can only ever have been created against an `APPROVED` sub-court, so rejecting a `PENDING` sub-court can never orphan an existing booking.
- New notification types added to the known-types list: `SUBCOURT_APPROVED`, `SUBCOURT_REJECTED`.

---

### `POST /api/admin/admins`

**Description:** Create a new admin account. Any existing admin can create another admin (all admins have equal power). The creating admin sets the new admin's email and password directly; the new admin logs in with those credentials immediately.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:** None.
**Query Parameters:** None.

**Request Body:**
```json
{
  "name": "string, required, 2-100 characters, trimmed",
  "email": "string, required, valid email format, unique across all users",
  "phone": "string, required, 10-digit Indian phone number, unique across all users",
  "password": "string, required, min 8 chars, 1 uppercase, 1 number, 1 special character"
}
```

**Response — Success (201 Created):**
```json
{
  "user_id": 4,
  "name": "Meera Joshi",
  "email": "meera@example.com",
  "phone": "9012345678",
  "role": "ADMIN",
  "status": "ACTIVE",
  "created_at": "2026-05-15T16:00:00Z"
}
```

> No JWT is returned — the creating admin is not the new admin. The new admin logs in separately via `POST /api/auth/login`.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (weak password, bad email/phone, missing field) | `{ "error": "Validation failed", "details": { "field": "..." } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 409 | Email already registered | `{ "error": "Email already registered" }` |
| 409 | Phone already registered | `{ "error": "Phone number already registered" }` |

**Internal Logic:**
1. Validate admin JWT (`role == ADMIN`).
2. Validate request body (same password/email/phone rules as customer registration).
3. Check `email` uniqueness in `users` → 409 if taken.
4. Check `phone` uniqueness in `users` → 409 if taken.
5. Hash password with BCrypt.
6. Insert into `users`: `email`, `phone`, `password_hash`, `role = 'ADMIN'`, `status = 'ACTIVE'`.
7. Insert into `admin_profiles`: `user_id`, `name`.
8. Return 201 (no token).

**Side Effects:**
- New rows in `users` and `admin_profiles`.
- No notification sent.

**Notes:**
- **First-admin bootstrap:** since this endpoint requires an existing admin, the very first admin is created out-of-band at deployment (DB seed / one-off SQL insert).
- No "temporary password / force reset on first login" flow in v1 — the creating admin sets the real password and communicates it out-of-band.
- All admins are equal; there's no super-admin.

---

### `GET /api/admin/admins`

**Description:** List all **active** admin accounts. A focused convenience view for managing the admin team (admins also appear in the general `GET /api/admin/users` list with `role=ADMIN`).

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `search` | string | No | Partial match on name/email/phone (case-insensitive, trimmed, min 2 chars). |
| `sort_by` | string | No | One of: `created_desc` (default), `created_asc`, `name_asc`. |
| `page` | integer | No | Page number, 1-indexed (default: `1`). |
| `page_size` | integer | No | Results per page (default: `20`, max: `100`). |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_results": 3,
  "total_pages": 1,
  "admins": [
    {
      "user_id": 2,
      "name": "Anika Desai",
      "email": "anika@example.com",
      "phone": "9000000002",
      "created_at": "2026-01-02T09:00:00Z",
      "is_self": true
    },
    {
      "user_id": 4,
      "name": "Meera Joshi",
      "email": "meera@example.com",
      "phone": "9012345678",
      "created_at": "2026-05-15T16:00:00Z",
      "is_self": false
    }
  ]
}
```

> `is_self` flags the currently-authenticated admin so the frontend can disable the "remove" button on their own row.
> Only `status = ACTIVE` admins are listed. Soft-removed admins (status flipped to `BANNED` via the delete endpoint) are excluded — they are no longer part of the manageable admin team.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Validate admin JWT.
2. Validate query params.
3. Query `users WHERE role = 'ADMIN' AND status = 'ACTIVE'`, JOIN `admin_profiles` for name; apply `search`, sort, pagination.
4. Set `is_self = (row.user_id == JWT.user_id)`.
5. Return 200.

**Side Effects:** None. Pure read.

**Notes:**
- Convenience endpoint — overlaps with `GET /api/admin/users?role=ADMIN`. Kept because the README lists it explicitly and the admin-team screen is simpler with a dedicated endpoint (no need to thread role filters and the `is_self` flag through the general list).
- The `status = 'ACTIVE'` filter is a direct consequence of the soft-deactivation removal model (see `DELETE /api/admin/admins/{id}`).

---

### `DELETE /api/admin/admins/{id}`

**Description:** Remove an admin's access. Implemented as a **soft deactivation** — the user row is preserved (so FK references from `staff_profiles.created_by_admin_id` and `complaints.assigned_by_admin_id` stay intact), but the account can no longer log in or act as an admin. Any admin can remove another admin. Two hard guards: cannot remove yourself, cannot remove the last active admin.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `user_id` of the admin to remove. |

**Query Parameters:** None.
**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "user_id": 4,
  "removed": true
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Attempting to remove yourself | `{ "error": "You cannot remove your own admin account" }` |
| 400 | Target is the last active admin | `{ "error": "Cannot remove the last admin account" }` |
| 400 | Target user exists but is not an admin | `{ "error": "Target user is not an admin" }` |
| 400 | Target admin is already removed | `{ "error": "Admin already removed" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 404 | `user_id` does not exist | `{ "error": "User not found" }` |

**Internal Logic:**
1. Validate admin JWT (`role == ADMIN`).
2. Fetch target: `SELECT * FROM users WHERE id = :id`. If not found → 404.
3. If `target.role != ADMIN` → 400 ("not an admin").
4. If `target.status == BANNED` → 400 ("already removed").
5. If `target.user_id == JWT.user_id` → 400 (no self-removal).
6. Count **active** admins: `SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'`. If count == 1 → 400 ("last admin").
7. Soft-deactivate: `UPDATE users SET status = 'BANNED' WHERE id = :id`.
8. Return 200 with `removed: true`.

**Side Effects:**
- One row updated in `users` (`status` → `BANNED`). No rows deleted.
- The removed admin's existing JWT is rejected on the next request (the auth filter blocks `status != ACTIVE`).
- `admin_profiles` row is **kept** — preserves the displayed name for historical FK references (e.g., "assigned by Meera Joshi" still resolves on old complaints).
- No notification sent.

**Notes:**
- **Soft-deactivation reuses the existing `BANNED` status value** rather than adding a new enum value or a soft-delete column — no schema change, no FK breakage. A removed admin is technically `BANNED`; this is invisible to end users and acceptable for v1. To distinguish "banned user" from "removed admin" later, add a `REMOVED` enum value in v2 — the endpoint contract won't change.
- A soft-removed admin still exists in `users` with `role = ADMIN` but `status = BANNED`. `GET /api/admin/admins` filters to `status = ACTIVE`, and the "last admin" guard counts only `status = ACTIVE` admins.
- **Reactivation:** `PUT /api/admin/users/{id}/activate` rejects `BANNED → ACTIVE`, so a soft-removed admin can't be restored via the API in v1 — restoration is an out-of-band DB action, same tier as first-admin bootstrap.
- The "last admin" race (two admins removing the second-to-last simultaneously) remains a negligible theoretical edge for v1 volumes; a `SELECT ... FOR UPDATE` over the active-admin set would close it if ever needed.

---

### `POST /api/admin/staff`

**Description:** Create a new staff (support) account. Only admins can create staff — there is no public staff registration. The creating admin sets the staff member's email and password directly; the staff logs in immediately. The creating admin is recorded as the staff's creator.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:** None.
**Query Parameters:** None.

**Request Body:**
```json
{
  "name": "string, required, 2-100 characters, trimmed",
  "email": "string, required, valid email format, unique across all users",
  "phone": "string, required, 10-digit Indian phone number, unique across all users",
  "password": "string, required, min 8 chars, 1 uppercase, 1 number, 1 special character"
}
```

**Response — Success (201 Created):**
```json
{
  "user_id": 18,
  "name": "Neha Roy",
  "email": "neha@example.com",
  "phone": "9876500011",
  "role": "STAFF",
  "status": "ACTIVE",
  "created_by_admin": {
    "admin_id": 2,
    "name": "Anika Desai"
  },
  "created_at": "2026-05-15T16:30:00Z"
}
```

> No JWT returned — the creating admin is not the new staff member. Staff logs in separately via `POST /api/auth/login`.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (weak password, bad email/phone, missing field) | `{ "error": "Validation failed", "details": { "field": "..." } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 409 | Email already registered | `{ "error": "Email already registered" }` |
| 409 | Phone already registered | `{ "error": "Phone number already registered" }` |

**Internal Logic:**
1. Validate admin JWT (`role == ADMIN`).
2. Validate request body (same email/phone/password rules as customer registration).
3. Check `email` uniqueness in `users` → 409 if taken.
4. Check `phone` uniqueness in `users` → 409 if taken.
5. Hash password with BCrypt.
6. Insert into `users`: `email`, `phone`, `password_hash`, `role = 'STAFF'`, `status = 'ACTIVE'`.
7. Insert into `staff_profiles`: `user_id`, `name`, `created_by_admin_id = JWT.user_id`.
8. Hydrate `created_by_admin` (name from `admin_profiles` of the calling admin) for the response.
9. Return 201 (no token).

**Side Effects:**
- New rows in `users` and `staff_profiles`.
- No notification sent.

**Notes:**
- Same credential model as `POST /api/admin/admins`: the creating admin sets the real password directly; no temporary-password / forced-reset flow in v1.
- `staff_profiles.created_by_admin_id` records provenance — one of the FKs that motivated the soft-deactivation approach for admin removal.
- **No staff-removal endpoint exists.** Disabling a staff member is done through general user-management: `PUT /api/admin/users/{id}/suspend` or `/ban`.
- A suspended/banned staff member: their assigned complaints and picked-up queries stay attached to their `user_id` (no auto-reassignment in v1). Admin can manually reassign complaints via `PUT /api/admin/complaints/{id}/assign`; picked-up queries have no reassignment path in v1.

---

### `GET /api/admin/complaints`

**Description:** List all complaints across the platform, regardless of assignment. The admin's complaint-oversight view — used to triage incoming complaints, see what's unassigned, monitor staff workload, and decide assignments.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter by status: `OPEN`, `IN_PROGRESS`, `RESOLVED`, or `all` (default: `all`). |
| `assignment` | string | No | `unassigned` (no staff yet), `assigned` (has a staff), or `all` (default: `all`). |
| `assigned_staff_id` | integer | No | Filter to complaints assigned to a specific staff member. |
| `date_from` | string (YYYY-MM-DD) | No | Filter by `created_at` from this date. Default: no lower bound. |
| `date_to` | string (YYYY-MM-DD) | No | Filter by `created_at` up to this date. Default: no upper bound. |
| `search` | string | No | Partial match on subject (case-insensitive, trimmed, min 2 chars). |
| `sort_by` | string | No | One of: `created_desc` (default), `created_asc`, `status_priority`. |
| `page` | integer | No | Page number, 1-indexed (default: `1`). |
| `page_size` | integer | No | Results per page (default: `20`, max: `100`). |

> `status_priority` → OPEN first, then IN_PROGRESS, then RESOLVED; newest first within each.

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_results": 128,
  "total_pages": 7,
  "summary": {
    "open_count": 14,
    "in_progress_count": 22,
    "resolved_count": 92,
    "unassigned_count": 9
  },
  "complaints": [
    {
      "complaint_id": 401,
      "subject": "Turf was waterlogged at slot time",
      "status": "OPEN",
      "customer_name": "Rahul Sharma",
      "booking_id": 1024,
      "turf_name": "Champions Turf",
      "assigned_staff": null,
      "created_at": "2026-05-14T20:15:00Z",
      "resolved_at": null
    },
    {
      "complaint_id": 395,
      "subject": "Lights went off mid-game",
      "status": "IN_PROGRESS",
      "customer_name": "Priya Iyer",
      "booking_id": 1018,
      "turf_name": "Greenfield Sports Arena",
      "assigned_staff": { "staff_id": 9, "name": "Neha Roy" },
      "created_at": "2026-05-12T21:30:00Z",
      "resolved_at": null
    }
  ]
}
```

> `summary` counts are across the full filtered set. `unassigned_count` helps the admin spot the triage backlog.
> `assigned_staff` is `null` for unassigned complaints.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Validate admin JWT (`role == ADMIN`).
2. Validate query params.
3. Base query: `SELECT * FROM complaints WHERE 1=1`.
4. Apply filters: `status`; `assignment` (`unassigned` ⇒ `assigned_staff_id IS NULL`, `assigned` ⇒ `IS NOT NULL`); `assigned_staff_id` exact; `created_at` range; `search` on subject.
5. Compute summary (per-status counts + unassigned count, across the filtered set).
6. Apply sort and pagination.
7. For each complaint hydrate: `customer_name`, `booking_id` + `turf_name` (bookings → sub_courts → turfs), `assigned_staff` (staff_profiles, null if unassigned).
8. Return 200.

**Side Effects:** None. Pure read.

**Notes:**
- Admin sees **all** complaints. This is the key difference from `GET /api/staff/complaints` (single-staff scope).
- **No admin complaint-detail endpoint** in v1 — full detail is the assigned staff's working view.
- Admin involvement in complaints is limited to **assignment** (next endpoint). Admins don't change status or add notes.

---

### `PUT /api/admin/complaints/{id}/assign`

**Description:** Assign or reassign a complaint to a staff member. Used both for initial assignment (unassigned → staff) and reassignment (one staff → another). Records which admin performed the assignment.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `complaint_id` to assign. |

**Query Parameters:** None.

**Request Body:**
```json
{
  "staff_id": "integer, required — user_id of an active STAFF member"
}
```

**Response — Success (200 OK):**
```json
{
  "complaint_id": 401,
  "assigned_staff": { "staff_id": 9, "name": "Neha Roy" },
  "assigned_by_admin": { "admin_id": 2, "name": "Anika Desai" },
  "previous_staff_id": null,
  "status": "OPEN"
}
```

> `previous_staff_id` is `null` on first assignment, or the prior staff's id on reassignment.
> `status` is returned unchanged — assignment does **not** alter complaint status.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | `staff_id` missing or not an integer | `{ "error": "Validation failed", "details": { "staff_id": "..." } }` |
| 400 | Target user is not a STAFF role | `{ "error": "Target user is not staff" }` |
| 400 | Target staff is suspended/banned | `{ "error": "Cannot assign to an inactive staff member" }` |
| 400 | Complaint is `RESOLVED` (cannot reassign a closed complaint in v1) | `{ "error": "Cannot reassign a resolved complaint" }` |
| 400 | `staff_id` is already the currently assigned staff | `{ "error": "Complaint already assigned to this staff member" }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 404 | `complaint_id` does not exist | `{ "error": "Complaint not found" }` |
| 404 | `staff_id` does not exist | `{ "error": "Staff member not found" }` |

**Internal Logic:**
1. Validate admin JWT (`role == ADMIN`).
2. Validate body: `staff_id` present and integer.
3. Fetch complaint: `SELECT * FROM complaints WHERE id = :id`. If not found → 404.
4. If `complaint.status == RESOLVED` → 400 (resolved is terminal; no reassignment).
5. Fetch target staff: `SELECT * FROM users WHERE id = :staff_id`. If not found → 404.
6. If `target.role != STAFF` → 400.
7. If `target.status != ACTIVE` → 400.
8. If `complaint.assigned_staff_id == staff_id` → 400.
9. Capture `previous_staff_id = complaint.assigned_staff_id`.
10. Update `complaints`: set `assigned_staff_id = :staff_id`, `assigned_by_admin_id = JWT.user_id`. **Status is not changed.**
11. Insert a notification for the newly assigned staff: type `COMPLAINT_ASSIGNED`, naming the complaint.
12. Return 200.

**Side Effects:**
- One row updated in `complaints` (`assigned_staff_id`, `assigned_by_admin_id`).
- One notification inserted for the newly assigned staff (`COMPLAINT_ASSIGNED`).
- On reassignment, the previous staff immediately loses visibility.

**Notes:**
- **Assignment does not change status.** An `OPEN` complaint stays `OPEN` after assignment; the assigned staff explicitly moves it to `IN_PROGRESS` when they start. (Contrast: queries auto-advance status on pickup.)
- **Reassignment is allowed only while not RESOLVED.** Resolved is terminal.
- **Reassignment is silent for the losing staff** in v1 — no notification, they just stop seeing it.
- Reassignment history is **not** tracked (no audit table) — only the current `assigned_staff_id` and most recent `assigned_by_admin_id` are stored.
- Notes left by a previous staff remain attached and visible to the new assignee (case continuity).

---

### `GET /api/admin/queries`

**Description:** List all general queries across the platform, regardless of pool/pickup state. The admin's read-only oversight view of the query system — used to monitor backlog and staff pickup activity. Admins do **not** assign or act on queries.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter by status: `OPEN`, `IN_PROGRESS`, `RESOLVED`, or `all` (default: `all`). |
| `pickup` | string | No | `unpicked` (still in pool), `picked` (claimed), or `all` (default: `all`). |
| `picked_up_by_staff_id` | integer | No | Filter to queries picked up by a specific staff member. |
| `date_from` | string (YYYY-MM-DD) | No | Filter by `created_at` from this date. Default: no lower bound. |
| `date_to` | string (YYYY-MM-DD) | No | Filter by `created_at` up to this date. Default: no upper bound. |
| `search` | string | No | Partial match on subject (case-insensitive, trimmed, min 2 chars). |
| `sort_by` | string | No | One of: `created_desc` (default), `created_asc`, `status_priority`. |
| `page` | integer | No | Page number, 1-indexed (default: `1`). |
| `page_size` | integer | No | Results per page (default: `20`, max: `100`). |

> `status_priority` → OPEN first, then IN_PROGRESS, then RESOLVED; newest first within each.

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_results": 64,
  "total_pages": 4,
  "summary": {
    "open_count": 7,
    "in_progress_count": 12,
    "resolved_count": 45,
    "unpicked_count": 7
  },
  "queries": [
    {
      "query_id": 312,
      "subject": "How do I change my registered phone number?",
      "status": "IN_PROGRESS",
      "customer_name": "Rahul Sharma",
      "picked_up_by_staff": { "staff_id": 9, "name": "Neha Roy" },
      "created_at": "2026-05-13T09:42:00Z",
      "resolved_at": null
    },
    {
      "query_id": 318,
      "subject": "Do you have turfs in Nashik?",
      "status": "OPEN",
      "customer_name": "Priya Iyer",
      "picked_up_by_staff": null,
      "created_at": "2026-05-14T11:10:00Z",
      "resolved_at": null
    }
  ]
}
```

> `summary.unpicked_count` = queries still sitting in the shared pool.
> `picked_up_by_staff` is `null` while the query is still in the pool.
> For queries, `OPEN` always implies unpicked and `IN_PROGRESS` always implies picked (pickup auto-advances status).

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Validate admin JWT (`role == ADMIN`).
2. Validate query params.
3. Base query: `SELECT * FROM queries WHERE 1=1`.
4. Apply filters: `status`; `pickup` (`unpicked` ⇒ `picked_up_by_staff_id IS NULL`, `picked` ⇒ `IS NOT NULL`); `picked_up_by_staff_id` exact; `created_at` range; `search` on subject.
5. Compute summary (per-status counts + unpicked count, across the filtered set).
6. Apply sort and pagination.
7. For each query hydrate: `customer_name`, `picked_up_by_staff` (staff_profiles, null if unpicked).
8. Return 200.

**Side Effects:** None. Pure read.

**Notes:**
- **Admins are observers only for queries.** There is no admin assign/reassign endpoint for queries (unlike complaints) — by design, queries are a self-serve staff pool.
- **No admin query-detail endpoint** in v1 (same stance as admin complaints).
- Mirrors `GET /api/admin/complaints` in shape so the admin frontend can reuse the same list component.

---

### `GET /api/admin/payouts`

**Description:** Platform-wide, view-only list of all owner payouts. Admins cannot trigger, hold, or modify payouts (per the README: "Payouts: view only (auto-processed)"). This is a monitoring/reconciliation view across every owner and every booking.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter by payout status: `PENDING`, `PAID`, `FAILED`, `CANCELLED`, or `all` (default: `all`). |
| `owner_id` | integer | No | Filter to payouts for a specific owner. |
| `turf_id` | integer | No | Filter to payouts for bookings on a specific turf. |
| `date_from` | string (YYYY-MM-DD) | No | Filter by `scheduled_at` from this date. Default: 30 days ago. |
| `date_to` | string (YYYY-MM-DD) | No | Filter by `scheduled_at` up to this date. Default: today. |
| `sort_by` | string | No | One of: `scheduled_desc` (default), `scheduled_asc`, `paid_desc`, `amount_desc`. |
| `page` | integer | No | Page number, 1-indexed (default: `1`). |
| `page_size` | integer | No | Results per page (default: `20`, max: `100`). |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_results": 540,
  "total_pages": 27,
  "summary": {
    "total_pending": 184000.00,
    "total_paid": 3120000.00,
    "total_failed": 0.00,
    "total_cancelled": 28000.00
  },
  "payouts": [
    {
      "payout_id": 200,
      "owner": { "owner_id": 30, "name": "Sunil Mehta" },
      "booking_id": 1024,
      "turf_name": "Champions Turf",
      "sub_court_name": "Court A",
      "booking_date": "2026-05-20",
      "amount": 1080.00,
      "status": "PENDING",
      "scheduled_at": "2026-05-20T22:00:00Z",
      "paid_at": null
    },
    {
      "payout_id": 198,
      "owner": { "owner_id": 30, "name": "Sunil Mehta" },
      "booking_id": 1019,
      "turf_name": "Champions Turf",
      "sub_court_name": "Court B",
      "booking_date": "2026-05-15",
      "amount": 1080.00,
      "status": "PAID",
      "scheduled_at": "2026-05-15T22:00:00Z",
      "paid_at": "2026-05-15T22:01:00Z"
    }
  ]
}
```

> `summary` totals are across the full filtered date range, broken down by status.
> `amount` = booking amount minus platform commission (the owner's net), as stored in `payouts.amount`.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 404 | `owner_id` or `turf_id` provided but not found | `{ "error": "Owner not found" }` / `{ "error": "Turf not found" }` |

**Internal Logic:**
1. Validate admin JWT (`role == ADMIN`).
2. Validate query params; if `owner_id`/`turf_id` provided, verify existence (404 if not).
3. Base query: `SELECT * FROM payouts WHERE 1=1`.
4. Apply filters: `status`, `owner_id`, `turf_id` (via JOIN `bookings → sub_courts → turfs`), `scheduled_at` date range.
5. Compute summary aggregates (sum of `amount` per status, across the full filtered set).
6. Apply sort and pagination.
7. For each payout hydrate: `owner` (owner_profiles), `booking_id`, `turf_name`, `sub_court_name`, `booking_date`.
8. Return 200.

**Side Effects:** None. Pure read. No write path exists for admins on payouts anywhere in the API.

**Notes:**
- **Strictly view-only.** No admin endpoint exists to retry, hold, release, or cancel a payout. Payout state transitions are owned entirely by the simulated payout job.
- `FAILED` is a v2 concept; in the v1 simulation no payout is ever `FAILED`. `CANCELLED` payouts come from cancelled/refunded bookings.
- Same payout-simulation caveats as `GET /api/owner/payouts` — no real bank transfer; bank fields stored as-is, unvalidated.

---

### `GET /api/admin/bookings`

**Description:** Platform-wide, view-only list of all bookings across every customer, owner, and turf. The admin's booking-oversight view for support and reconciliation. Admins cannot create, modify, cancel, or reschedule bookings — read-only.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter by booking status: `CONFIRMED`, `CANCELLED`, `COMPLETED`, `REFUNDED`, or `all` (default: `all`). |
| `customer_id` | integer | No | Filter to a specific customer's bookings. |
| `owner_id` | integer | No | Filter to bookings on a specific owner's turfs. |
| `turf_id` | integer | No | Filter to a specific turf. |
| `sub_court_id` | integer | No | Filter to a specific sub-court. |
| `date_from` | string (YYYY-MM-DD) | No | Filter by `booking_date` from this date. Default: 30 days ago. |
| `date_to` | string (YYYY-MM-DD) | No | Filter by `booking_date` up to this date. Default: 30 days ahead. |
| `search` | string | No | Partial match on customer name/email/phone (case-insensitive, trimmed, min 2 chars). |
| `sort_by` | string | No | One of: `date_desc` (default), `date_asc`, `created_desc`, `amount_desc`. |
| `page` | integer | No | Page number, 1-indexed (default: `1`). |
| `page_size` | integer | No | Results per page (default: `20`, max: `100`). |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_results": 5230,
  "total_pages": 262,
  "summary": {
    "confirmed_count": 410,
    "completed_count": 4600,
    "cancelled_count": 150,
    "refunded_count": 70,
    "gross_amount": 4180000.00,
    "commission_amount": 627000.00
  },
  "bookings": [
    {
      "booking_id": 1024,
      "customer": { "customer_id": 7, "name": "Rahul Sharma", "phone": "9876543210" },
      "turf_name": "Champions Turf",
      "sub_court_name": "Court A",
      "booking_date": "2026-05-20",
      "slots": [
        { "start_time": "18:00", "end_time": "19:00" },
        { "start_time": "19:00", "end_time": "20:00" }
      ],
      "total_amount": 1200.00,
      "commission_amount": 180.00,
      "status": "CONFIRMED",
      "created_at": "2026-05-15T14:30:00Z"
    }
  ]
}
```

> `summary` counts are per status across the full filtered set; `gross_amount` / `commission_amount` are sums **excluding** `CANCELLED`/`REFUNDED` (consistent with the dashboard's net-of-refunds revenue definition).

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 404 | A provided id filter doesn't exist | `{ "error": "<entity> not found" }` |

**Internal Logic:**
1. Validate admin JWT (`role == ADMIN`).
2. Validate query params; verify any provided id filters exist (404 if not).
3. Base query: `SELECT * FROM bookings WHERE 1=1`.
4. Apply filters: `status`, `customer_id`, `sub_court_id` directly; `turf_id`/`owner_id` via JOIN `sub_courts → turfs`; `booking_date` range; `search` via JOIN `customer_profiles` + `users`.
5. Compute summary (per-status counts across filtered set; gross/commission sums excluding CANCELLED/REFUNDED).
6. Apply sort and pagination.
7. For each booking hydrate: `customer` (customer_profiles + users phone), `turf_name`, `sub_court_name`, `slots` (booking_slots ordered by start_time).
8. Return 200.

**Side Effects:** None. Pure read.

**Notes:**
- **View-only.** No admin write path on bookings exists anywhere — all booking mutations are customer-driven.
- The `gross_amount`/`commission_amount` summary uses the **same net-of-refunds definition** as the dashboard so screens agree. Per-status counts include all statuses.
- Customer contact (name + phone) is exposed because this is a support tool and admins already have full platform access.

---

### `GET /api/admin/revenue`

**Description:** Platform-wide revenue and graph data with drill-down by city, owner, or turf — the deeper analytics companion to the dashboard. Supports date-ranged, grouped revenue analysis.

**Authentication:** Required. Role: `ADMIN` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `date_from` | string (YYYY-MM-DD) | No | Start of the analysis window (by `booking_date`). Default: 30 days ago. |
| `date_to` | string (YYYY-MM-DD) | No | End of the analysis window. Default: today. |
| `granularity` | string | No | Trend bucket size: `daily` (default), `weekly`, `monthly`. |
| `group_by` | string | No | Breakdown dimension for the `breakdown` array: `none` (default), `city`, `owner`, `turf`. |
| `city` | string | No | Restrict the whole analysis to a single city. |
| `owner_id` | integer | No | Restrict the whole analysis to a single owner. |

> No pagination — this endpoint returns aggregates, not rows. `breakdown` is capped (see Notes).

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "window": { "date_from": "2026-04-16", "date_to": "2026-05-16", "granularity": "daily" },
  "totals": {
    "gross_revenue": 1180000.00,
    "commission": 177000.00,
    "owner_payouts": 1003000.00,
    "bookings": 3120,
    "refunded_amount": 42000.00,
    "refunded_bookings": 70
  },
  "trend": [
    { "bucket": "2026-05-14", "gross_revenue": 19850.00, "commission": 2977.50, "bookings": 52 },
    { "bucket": "2026-05-15", "gross_revenue": 18400.00, "commission": 2760.00, "bookings": 47 }
  ],
  "breakdown": [
    { "key": "Pune", "gross_revenue": 640000.00, "commission": 96000.00, "bookings": 1700 },
    { "key": "Mumbai", "gross_revenue": 410000.00, "commission": 61500.00, "bookings": 1080 }
  ]
}
```

> `gross_revenue` and `commission` use the **net-of-refunds** definition (CONFIRMED + COMPLETED only) — consistent with the dashboard and admin bookings summary.
> `owner_payouts` = `gross_revenue − commission` (what owners net in aggregate).
> `refunded_amount` / `refunded_bookings` are reported **separately** so refunds are visible without polluting the revenue line.
> `breakdown` is empty when `group_by=none`; otherwise one entry per group `key` (city name, owner name, or turf name depending on `group_by`).

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter (bad enum, `date_from > date_to`, range too large) | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-admin role | `{ "error": "Forbidden" }` |
| 404 | `owner_id` provided but not found | `{ "error": "Owner not found" }` |

**Internal Logic:**
1. Validate admin JWT (`role == ADMIN`).
2. Validate query params: enums, `date_from <= date_to`, window not exceeding the max span, `owner_id`/`city` existence where applicable.
3. Apply global restrictions (`city`, `owner_id`) to the working set of `bookings` (JOINed to `sub_courts → turfs`).
4. **Totals:** sum `total_amount`, `commission_amount`, count bookings — status in (`CONFIRMED`,`COMPLETED`). Separately sum refunds via the `refunds` table joined on `booking_id`.
5. **Trend:** bucket by `booking_date` at the requested granularity across the window; zero-fill empty buckets.
6. **Breakdown:** if `group_by != none`, group the same net-of-refunds aggregate by city / owner / turf; order by `gross_revenue` desc; cap to top N.
7. Return 200.

**Side Effects:** None. Pure read. Heavy aggregate — see Notes on caching.

**Notes:**
- **Consistency:** revenue is defined identically across `GET /api/admin/dashboard`, `GET /api/admin/bookings` (summary), and here — CONFIRMED + COMPLETED only, refunds reported separately.
- **`breakdown` cap:** returns the **top 50** groups by `gross_revenue`. For v1 scale this comfortably covers all cities and most owners.
- **Max window:** reject windows longer than ~366 days (`400`) to bound aggregate cost.
- **Caching:** like the dashboard, this is an expensive aggregate. Implementation may cache per (window, granularity, group_by, filters) for 5–15 minutes. Not part of the contract.
- This endpoint intentionally has **no row-level output** — for individual bookings/payouts use `GET /api/admin/bookings` / `GET /api/admin/payouts`.

---

## Staff

_Endpoints under `/api/staff`. All require a valid JWT with `role == STAFF` and `status == ACTIVE`. The standard 401/403/500 responses from the Conventions section apply and are not repeated unless behavior differs._

---

### `GET /api/staff/complaints`

**Description:** List complaints assigned to the authenticated staff member. Staff can only see their own assigned complaints — never complaints assigned to other staff or unassigned ones. Supports filtering by status and pagination.

**Authentication:** Required. Role: `STAFF` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter by complaint status: `OPEN`, `IN_PROGRESS`, `RESOLVED`, or `all` (default: `all`). |
| `date_from` | string (YYYY-MM-DD) | No | Filter by `created_at` from this date. Default: no lower bound. |
| `date_to` | string (YYYY-MM-DD) | No | Filter by `created_at` up to this date. Default: no upper bound. |
| `sort_by` | string | No | One of: `created_desc` (default), `created_asc`, `status_priority`. |
| `page` | integer | No | Page number, 1-indexed (default: `1`). |
| `page_size` | integer | No | Results per page (default: `20`, max: `100`). |

> `status_priority` orders OPEN first, then IN_PROGRESS, then RESOLVED — actionable items at the top. Within each status, newer first.

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_results": 14,
  "total_pages": 1,
  "summary": {
    "open_count": 3,
    "in_progress_count": 5,
    "resolved_count": 6
  },
  "complaints": [
    {
      "complaint_id": 401,
      "subject": "Turf was waterlogged at slot time",
      "status": "OPEN",
      "customer_name": "Rahul Sharma",
      "booking_id": 1024,
      "turf_name": "Champions Turf",
      "booking_date": "2026-05-14",
      "created_at": "2026-05-14T20:15:00Z",
      "resolved_at": null
    },
    {
      "complaint_id": 395,
      "subject": "Lights went off mid-game",
      "status": "IN_PROGRESS",
      "customer_name": "Priya Iyer",
      "booking_id": 1018,
      "turf_name": "Greenfield Sports Arena",
      "booking_date": "2026-05-12",
      "created_at": "2026-05-12T21:30:00Z",
      "resolved_at": null
    }
  ]
}
```

> `summary` reflects the totals across the filtered date range and assigned staff (not just the current page).
> Full description, notes, and resolution text are **not** included here — use `GET /api/staff/complaints/{id}` for detail.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-staff role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == STAFF`.
2. Validate query parameters (status enum, date format, page bounds).
3. Build query: `SELECT * FROM complaints WHERE assigned_staff_id = :user_id`.
4. Apply filters: status, `created_at` date range.
5. Compute summary aggregates (counts per status across the full filter, not just the page).
6. Apply sort: `created_desc`/`created_asc` straightforward; `status_priority` → `ORDER BY FIELD(status, 'OPEN', 'IN_PROGRESS', 'RESOLVED'), created_at DESC`.
7. Apply pagination.
8. For each complaint, JOIN to fetch `customer_name` (customer_profiles), `booking_id`/`booking_date`/`turf_name` (bookings → sub_courts → turfs).
9. Return 200.

**Side Effects:** None. Pure read.

**Notes:**
- Staff explicitly cannot see complaints assigned to other staff. The `WHERE assigned_staff_id = :user_id` clause is non-negotiable — there's no "all complaints" view for staff (that's the admin's job).
- Unassigned complaints never appear here — admin assigns them first.
- A reassigned complaint moves with the assignment: the previous staff loses access, the new staff gains it. Reassignment history is not tracked.

---

### `GET /api/staff/complaints/{id}`

**Description:** Get full details of a single complaint assigned to the authenticated staff member, including the linked booking, customer contact info (name, phone, email), all internal notes, and the resolution text (if resolved). This is the staff's main "case file" view.

**Authentication:** Required. Role: `STAFF` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `complaint_id`. |

**Query Parameters:** None.
**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "complaint_id": 401,
  "subject": "Turf was waterlogged at slot time",
  "description": "Reached the ground at 6 PM, the entire field was flooded. Had to leave without playing. Asking for a refund and an apology.",
  "status": "IN_PROGRESS",
  "resolution_text": null,
  "created_at": "2026-05-14T20:15:00Z",
  "resolved_at": null,
  "assigned_by_admin": {
    "admin_id": 2,
    "name": "Anika Desai"
  },
  "customer": {
    "customer_id": 7,
    "name": "Rahul Sharma",
    "email": "rahul@example.com",
    "phone": "9876543210"
  },
  "booking": {
    "booking_id": 1024,
    "booking_date": "2026-05-14",
    "status": "COMPLETED",
    "total_amount": 1200.00,
    "turf": {
      "turf_id": 23,
      "name": "Champions Turf",
      "city": "Pune",
      "address": "Plot 14, Baner Road, Pune",
      "owner_phone": "9988776655"
    },
    "sub_court": {
      "sub_court_id": 45,
      "name": "Court A"
    },
    "slots": [
      { "start_time": "18:00", "end_time": "19:00" },
      { "start_time": "19:00", "end_time": "20:00" }
    ]
  },
  "notes": [
    {
      "note_id": 88,
      "staff_id": 9,
      "staff_name": "Neha Roy",
      "note_text": "Called customer, confirmed they want a refund. Owner reached, says drainage issue, will check feasibility of goodwill refund.",
      "created_at": "2026-05-15T09:00:00Z"
    },
    {
      "note_id": 92,
      "staff_id": 9,
      "staff_name": "Neha Roy",
      "note_text": "Owner agreed to one free slot as compensation. Coordinating reschedule with customer.",
      "created_at": "2026-05-15T14:20:00Z"
    }
  ]
}
```

> `resolution_text` is `null` until the complaint is moved to `RESOLVED`.
> `notes` are sorted oldest-first so the case reads top-to-bottom as a timeline.
> Owner phone is included so staff can contact the owner directly when investigating.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-staff role | `{ "error": "Forbidden" }` |
| 403 | Complaint exists but is assigned to a different staff member (or unassigned) | `{ "error": "Forbidden" }` |
| 404 | `complaint_id` does not exist | `{ "error": "Complaint not found" }` |

> When the complaint exists but is assigned to someone else, we return **403, not 404**. Staff IDs are not externally guessable, so leakage is minimal and the clearer error helps when an admin reassigns mid-session.

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == STAFF`.
2. Fetch complaint: `SELECT * FROM complaints WHERE id = :id`. If not found → 404.
3. Verify assignment: `complaints.assigned_staff_id == JWT.user_id`. If not → 403.
4. Hydrate `assigned_by_admin` (admin_profiles by `assigned_by_admin_id`).
5. Hydrate `customer` (users + customer_profiles).
6. Hydrate `booking`: bookings by `complaints.booking_id`; JOIN sub_courts, turfs; owner phone via users on `turfs.owner_id`; all `booking_slots` ordered by `start_time`.
7. Hydrate `notes`: `SELECT * FROM complaint_notes WHERE complaint_id = :id ORDER BY created_at ASC`; JOIN staff_profiles for `staff_name`.
8. Return 200.

**Side Effects:** None. Pure read.

**Notes:**
- Staff sees the **owner's phone** here (not just the customer's). Investigating a complaint usually means hearing both sides; the owner phone is already visible on the public turf detail page.
- All notes are visible to the assigned staff, including notes left by **previous** staff (continuity on reassignment). Notes are append-only.
- Only the **current** `assigned_by_admin` is shown; reassignment history is not tracked in v1.
- The booking is fetched even if `CANCELLED`/`REFUNDED` — the complaint may be about an already-cancelled booking.

---

### `PUT /api/staff/complaints/{id}/status`

**Description:** Update the status of a complaint assigned to the authenticated staff member. Drives the lifecycle `OPEN → IN_PROGRESS → RESOLVED`. When moving to `RESOLVED`, the staff must include a `resolution_text` — this is what the customer sees as the resolution message.

**Authentication:** Required. Role: `STAFF` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `complaint_id`. |

**Query Parameters:** None.

**Request Body:**
```json
{
  "status": "string, required, one of: IN_PROGRESS, RESOLVED",
  "resolution_text": "string, required ONLY when status = RESOLVED, 10-2000 characters, trimmed"
}
```

**Response — Success (200 OK):**
```json
{
  "complaint_id": 401,
  "status": "RESOLVED",
  "resolution_text": "We confirmed the drainage issue with the owner. As compensation, you've been offered one free slot at Champions Turf, redeemable within 30 days. The owner will contact you to schedule.",
  "resolved_at": "2026-05-15T18:45:00Z",
  "updated_at": "2026-05-15T18:45:00Z"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (missing/invalid `status`, missing `resolution_text` when resolving, text too short/long) | `{ "error": "Validation failed", "details": { "field_name": "..." } }` |
| 400 | Invalid status transition (e.g., RESOLVED → IN_PROGRESS, or any transition from RESOLVED) | `{ "error": "Invalid status transition", "details": { "from": "RESOLVED", "to": "IN_PROGRESS" } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-staff role | `{ "error": "Forbidden" }` |
| 403 | Complaint is assigned to a different staff member | `{ "error": "Forbidden" }` |
| 404 | `complaint_id` does not exist | `{ "error": "Complaint not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == STAFF`.
2. Validate request body:
   - `status` must be one of `IN_PROGRESS`, `RESOLVED`.
   - If `status == RESOLVED`: `resolution_text` required, trimmed, length 10–2000.
   - If `status == IN_PROGRESS`: `resolution_text` ignored (not stored).
3. Fetch complaint. If not found → 404.
4. Verify assignment: `complaints.assigned_staff_id == JWT.user_id`. If not → 403.
5. Validate transition. Allowed: `OPEN → IN_PROGRESS`, `OPEN → RESOLVED`, `IN_PROGRESS → RESOLVED`. Same-state no-op → 400. Any transition out of `RESOLVED` → 400.
6. Update `complaints`: set `status`; if `RESOLVED` also set `resolution_text` and `resolved_at = now()`.
7. Return 200 with the updated state.

**Side Effects:**
- One row updated in `complaints`.
- No notification sent to the customer in v1.

**Notes:**
- **`RESOLVED` is terminal.** If a customer comes back unhappy, v1 path: staff adds a note and admin reassigns (doesn't reopen), or the customer raises a fresh complaint linked to the same booking.
- `resolution_text` is meaningful for the customer, not internal. Internal commentary belongs in `complaint_notes`. Frontend should hint: "This message will be shown to the customer."
- Only changed fields returned — frontend can refetch detail if needed.

---

### `POST /api/staff/complaints/{id}/notes`

**Description:** Add an internal note to a complaint assigned to the authenticated staff member. Notes are private to staff and admin — customers never see them. Used to log investigation progress, calls made, owner conversations.

**Authentication:** Required. Role: `STAFF` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `complaint_id`. |

**Query Parameters:** None.

**Request Body:**
```json
{
  "note_text": "string, required, 1-2000 characters, trimmed"
}
```

**Response — Success (201 Created):**
```json
{
  "note_id": 92,
  "complaint_id": 401,
  "staff_id": 9,
  "staff_name": "Neha Roy",
  "note_text": "Owner agreed to one free slot as compensation. Coordinating reschedule with customer.",
  "created_at": "2026-05-15T14:20:00Z"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (empty `note_text`, too long, missing) | `{ "error": "Validation failed", "details": { "note_text": "..." } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-staff role | `{ "error": "Forbidden" }` |
| 403 | Complaint is assigned to a different staff member | `{ "error": "Forbidden" }` |
| 404 | `complaint_id` does not exist | `{ "error": "Complaint not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == STAFF`.
2. Validate request body — trim `note_text`, check length (1–2000 chars, non-empty after trim).
3. Fetch complaint. If not found → 404.
4. Verify assignment: `complaints.assigned_staff_id == JWT.user_id`. If not → 403.
5. Insert into `complaint_notes`: `complaint_id = :id`, `query_id = NULL`, `staff_id = JWT.user_id`, `note_text`, `created_at = now()`.
6. Hydrate `staff_name` from `staff_profiles`.
7. Return 201.

**Side Effects:**
- One row inserted into `complaint_notes`.
- No notification sent.

**Notes:**
- Notes are **append-only** in v1. No edit or delete endpoint. A wrong note is corrected with a follow-up note.
- Notes can be added on a complaint in **any status**, including `RESOLVED`.
- `complaint_notes.query_id` stays `NULL` for complaint notes — the schema reuses one table for both, distinguished by which FK is set.
- Notes are returned as part of `GET /api/staff/complaints/{id}` — no separate list endpoint.
- The customer-visible message lives in `complaints.resolution_text`, **not** here. Frontend should label this UI: "Internal note — not visible to customer."

---

### `GET /api/staff/queries/pool`

**Description:** List all open queries sitting in the shared pool — not yet picked up by any staff. Any authenticated staff member can view this pool and pick a query from it.

**Authentication:** Required. Role: `STAFF` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `date_from` | string (YYYY-MM-DD) | No | Filter by `created_at` from this date. Default: no lower bound. |
| `date_to` | string (YYYY-MM-DD) | No | Filter by `created_at` up to this date. Default: no upper bound. |
| `sort_by` | string | No | One of: `created_asc` (default — oldest first, fairest pickup order), `created_desc`. |
| `page` | integer | No | Page number, 1-indexed (default: `1`). |
| `page_size` | integer | No | Results per page (default: `20`, max: `100`). |

> Default sort `created_asc` so the oldest unpicked query is at the top — a soft fairness mechanism.

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_results": 7,
  "total_pages": 1,
  "queries": [
    {
      "query_id": 312,
      "subject": "How do I change my registered phone number?",
      "customer_name": "Rahul Sharma",
      "created_at": "2026-05-13T09:42:00Z"
    },
    {
      "query_id": 318,
      "subject": "Do you have turfs in Nashik?",
      "customer_name": "Priya Iyer",
      "created_at": "2026-05-14T11:10:00Z"
    }
  ]
}
```

> Description and customer contact details are not in the list view — only subject and customer name. Staff sees full details after picking up (or via the detail endpoint).
> The pool only contains queries in status `OPEN` with `picked_up_by_staff_id IS NULL`.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-staff role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == STAFF`.
2. Validate query parameters.
3. Build query: `SELECT * FROM queries WHERE picked_up_by_staff_id IS NULL AND status = 'OPEN'`.
4. Apply filters: `created_at` date range.
5. Compute `total_results`.
6. Apply sort and pagination.
7. For each query, JOIN `customer_profiles` for `customer_name`.
8. Return 200.

**Side Effects:** None. Pure read.

**Notes:**
- The pool is **shared across all staff**, regardless of admin assignment. Admin is not involved in queries.
- `status = OPEN` and `picked_up_by_staff_id IS NULL` should always be in sync; both are checked defensively.
- No claim lock — concurrent pickups race; the pickup endpoint resolves the race deterministically.
- Customer phone/email are deliberately **not** shown in the list — staff get full contact info after pickup.

---

### `PUT /api/staff/queries/{id}/pick-up`

**Description:** Claim a query from the shared pool. The first staff member to call this successfully gets the query assigned to them; concurrent attempts fail. Once picked up, the query moves out of the pool, transitions `OPEN → IN_PROGRESS`, and becomes visible via `GET /api/staff/queries/my`.

**Authentication:** Required. Role: `STAFF` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `query_id`. |

**Query Parameters:** None.
**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "query_id": 312,
  "picked_up_by_staff_id": 9,
  "status": "IN_PROGRESS",
  "picked_up_at": "2026-05-15T10:30:00Z"
}
```

> `picked_up_at` is derived server-side (the schema has no dedicated column) — see Notes / Schema Notes.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-staff role | `{ "error": "Forbidden" }` |
| 404 | `query_id` does not exist | `{ "error": "Query not found" }` |
| 409 | Query was already picked up by another staff (race lost) | `{ "error": "Query already picked up", "picked_up_by_staff_name": "Neha Roy" }` |
| 409 | Query is no longer in the pool (e.g., already RESOLVED) | `{ "error": "Query not available in pool" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == STAFF`.
2. Fetch query: `SELECT * FROM queries WHERE id = :id`. If not found → 404.
3. Check state:
   - If `picked_up_by_staff_id IS NOT NULL` → 409 ("already picked up"). Hydrate `picked_up_by_staff_name`.
   - If `status != OPEN` → 409 ("not available in pool").
4. **Atomic claim** via conditional update:
   ```sql
   UPDATE queries
      SET picked_up_by_staff_id = :user_id, status = 'IN_PROGRESS'
    WHERE id = :id AND picked_up_by_staff_id IS NULL AND status = 'OPEN';
   ```
5. If `rowcount == 1` → success, return 200. If `rowcount == 0` → another staff won the race; re-fetch and return the appropriate 409.
6. Return 200 with the post-update state.

**Side Effects:**
- One row updated in `queries` (when claim succeeds).
- Query disappears from the pool for all staff; appears in the picking staff's `queries/my`.
- No notification sent.

**Notes:**
- **No undo / unclaim endpoint in v1.** Once picked up, a query stays with that staff member until resolution.
- `picked_up_at` in the response is **derived**, not stored (no `picked_up_at` column on `queries`). See Schema Notes for the optional column.
- The status auto-advances `OPEN → IN_PROGRESS` on pickup — picking it up *is* starting work. (Contrast: complaints leave status as `OPEN` until staff explicitly moves it.)
- The 409 on "already picked up" includes the winning staff's name for clearer UX.

---

### `GET /api/staff/queries/my`

**Description:** List queries picked up by the authenticated staff member — past and present. Staff sees only their own; queries picked up by other staff are never returned. Mirrors `GET /api/staff/complaints` but filtered on `picked_up_by_staff_id`.

**Authentication:** Required. Role: `STAFF` only.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter by query status: `IN_PROGRESS`, `RESOLVED`, or `all` (default: `all`). |
| `date_from` | string (YYYY-MM-DD) | No | Filter by `created_at` from this date. Default: no lower bound. |
| `date_to` | string (YYYY-MM-DD) | No | Filter by `created_at` up to this date. Default: no upper bound. |
| `sort_by` | string | No | One of: `created_desc` (default), `created_asc`, `status_priority`. |
| `page` | integer | No | Page number, 1-indexed (default: `1`). |
| `page_size` | integer | No | Results per page (default: `20`, max: `100`). |

> `status_priority` orders IN_PROGRESS first, then RESOLVED. `OPEN` is not a valid filter here because a query in this view has already been picked up.

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_results": 9,
  "total_pages": 1,
  "summary": {
    "in_progress_count": 4,
    "resolved_count": 5
  },
  "queries": [
    {
      "query_id": 312,
      "subject": "How do I change my registered phone number?",
      "status": "IN_PROGRESS",
      "customer_name": "Rahul Sharma",
      "created_at": "2026-05-13T09:42:00Z",
      "resolved_at": null
    },
    {
      "query_id": 298,
      "subject": "Refund not received yet",
      "status": "RESOLVED",
      "customer_name": "Amit Kumar",
      "created_at": "2026-05-10T16:00:00Z",
      "resolved_at": "2026-05-11T11:00:00Z"
    }
  ]
}
```

> Full description, notes, and resolution_text are not in the list view — use `GET /api/staff/queries/{id}` for detail.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-staff role | `{ "error": "Forbidden" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == STAFF`.
2. Validate query parameters.
3. Build query: `SELECT * FROM queries WHERE picked_up_by_staff_id = :user_id`.
4. Apply filters: status, `created_at` date range.
5. Compute summary aggregates (counts per status across the full filter).
6. Apply sort: `status_priority` → `ORDER BY FIELD(status, 'IN_PROGRESS', 'RESOLVED'), created_at DESC`.
7. Apply pagination.
8. For each query, JOIN `customer_profiles` for `customer_name`.
9. Return 200.

**Side Effects:** None. Pure read.

**Notes:**
- Once picked up, a query stays in this view for the same staff forever, even after resolution. No archive/unassign in v1.
- A query cannot appear in both `queries/pool` and `queries/my` simultaneously — mutually exclusive on `picked_up_by_staff_id`.
- Unlike complaints, no admin reassignment happens for queries.

---

### `GET /api/staff/queries/{id}`

**Description:** Get full details of a single query picked up by the authenticated staff member, including the customer's contact info (name, phone, email), full description, all internal notes, and resolution text (if resolved). Mirrors `GET /api/staff/complaints/{id}` but without a linked booking or assigning admin.

> **Note:** This endpoint is not in the original README's Staff route table. It was added to provide a detail view that includes notes (no separate notes-list endpoint exists), parallel to the complaint detail endpoint. See README Corrections at the end of this document.

**Authentication:** Required. Role: `STAFF` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `query_id`. |

**Query Parameters:** None.
**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "query_id": 312,
  "subject": "How do I change my registered phone number?",
  "description": "I changed my phone number last month and want to update it on my account. The profile edit screen doesn't seem to allow phone changes. What's the process?",
  "status": "IN_PROGRESS",
  "resolution_text": null,
  "created_at": "2026-05-13T09:42:00Z",
  "resolved_at": null,
  "customer": {
    "customer_id": 7,
    "name": "Rahul Sharma",
    "email": "rahul@example.com",
    "phone": "9876543210"
  },
  "notes": [
    {
      "note_id": 110,
      "staff_id": 9,
      "staff_name": "Neha Roy",
      "note_text": "Called customer. Verified identity via booking history. Will ask backend team for manual phone update steps.",
      "created_at": "2026-05-13T11:00:00Z"
    }
  ]
}
```

> Notes are sorted oldest-first (timeline order).
> No `booking` or `assigned_by_admin` object — queries don't have either.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-staff role | `{ "error": "Forbidden" }` |
| 403 | Query exists but was picked up by a different staff member (or is still in the pool) | `{ "error": "Forbidden" }` |
| 404 | `query_id` does not exist | `{ "error": "Query not found" }` |

> Same 403-vs-404 reasoning as `GET /api/staff/complaints/{id}`.

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == STAFF`.
2. Fetch query: `SELECT * FROM queries WHERE id = :id`. If not found → 404.
3. Verify pickup: `queries.picked_up_by_staff_id == JWT.user_id`. If NULL (still in pool) or another staff → 403.
4. Hydrate `customer` (users + customer_profiles).
5. Hydrate `notes`: `SELECT * FROM complaint_notes WHERE query_id = :id ORDER BY created_at ASC`; JOIN staff_profiles for `staff_name`.
6. Return 200.

**Side Effects:** None. Pure read.

**Notes:**
- The notes table (`complaint_notes`) is shared between complaints and queries — filtered on `query_id = :id`.
- Staff sees the customer's email and phone — needed for off-platform follow-up (call/email), part of the v1 workflow.
- No "first picked up at" timestamp because the schema doesn't store it. See Schema Notes.

---

### `PUT /api/staff/queries/{id}/status`

**Description:** Update the status of a query picked up by the authenticated staff member. Drives `IN_PROGRESS → RESOLVED`. When resolving, the staff must include a `resolution_text` — what the customer sees as the resolution message. Mirrors `PUT /api/staff/complaints/{id}/status`.

**Authentication:** Required. Role: `STAFF` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `query_id`. |

**Query Parameters:** None.

**Request Body:**
```json
{
  "status": "string, required, must be: RESOLVED",
  "resolution_text": "string, required, 10-2000 characters, trimmed"
}
```

> Only `RESOLVED` is accepted. `OPEN` is the pool state (pre-pickup) and `IN_PROGRESS` is set automatically by the pickup endpoint.

**Response — Success (200 OK):**
```json
{
  "query_id": 312,
  "status": "RESOLVED",
  "resolution_text": "Phone number changes aren't self-serve in v1. We've updated your registered phone to 9876500000 on your behalf. Please log out and log back in for the change to take effect.",
  "resolved_at": "2026-05-15T18:45:00Z"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (missing/invalid `status`, missing `resolution_text`, text too short/long) | `{ "error": "Validation failed", "details": { "field_name": "..." } }` |
| 400 | Status transition not allowed (e.g., query already RESOLVED, or `IN_PROGRESS` sent) | `{ "error": "Invalid status transition", "details": { "from": "RESOLVED", "to": "RESOLVED" } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-staff role | `{ "error": "Forbidden" }` |
| 403 | Query is picked up by a different staff member (or still in the pool) | `{ "error": "Forbidden" }` |
| 404 | `query_id` does not exist | `{ "error": "Query not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == STAFF`.
2. Validate request body: `status` must equal `RESOLVED`; `resolution_text` required, trimmed, length 10–2000.
3. Fetch query. If not found → 404.
4. Verify pickup: `queries.picked_up_by_staff_id == JWT.user_id`. If NULL or other staff → 403.
5. Validate transition. Allowed: `IN_PROGRESS → RESOLVED`. Any transition from `RESOLVED` → 400. `OPEN → RESOLVED` shouldn't occur (pickup moves OPEN→IN_PROGRESS atomically); if encountered, → 400.
6. Update `queries`: set `status = RESOLVED`, `resolution_text`, `resolved_at = now()`.
7. Return 200 with the updated state.

**Side Effects:**
- One row updated in `queries`.
- No notification sent. Customer sees the resolution next time they view the query.

**Notes:**
- **`RESOLVED` is terminal** — same as complaints. Customer follow-up = a new query.
- `resolution_text` is for the customer. Internal commentary lives in `complaint_notes` via the notes endpoint. Frontend should label: "This message will be shown to the customer."
- No `IN_PROGRESS` transition here — pickup *is* starting. (Contrast: complaints have an explicit `OPEN → IN_PROGRESS` step.)
- Only changed fields returned.

---

### `POST /api/staff/queries/{id}/notes`

**Description:** Add an internal note to a query picked up by the authenticated staff member. Notes are private to staff and admin — customers never see them. Mirrors `POST /api/staff/complaints/{id}/notes` with `query_id` instead of `complaint_id`.

**Authentication:** Required. Role: `STAFF` only.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `query_id`. |

**Query Parameters:** None.

**Request Body:**
```json
{
  "note_text": "string, required, 1-2000 characters, trimmed"
}
```

**Response — Success (201 Created):**
```json
{
  "note_id": 110,
  "query_id": 312,
  "staff_id": 9,
  "staff_name": "Neha Roy",
  "note_text": "Called customer. Verified identity via booking history. Will ask backend team for manual phone update steps.",
  "created_at": "2026-05-13T11:00:00Z"
}
```

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Validation failed (empty `note_text`, too long, missing) | `{ "error": "Validation failed", "details": { "note_text": "..." } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | JWT belongs to a non-staff role | `{ "error": "Forbidden" }` |
| 403 | Query is picked up by a different staff member (or still in the pool) | `{ "error": "Forbidden" }` |
| 404 | `query_id` does not exist | `{ "error": "Query not found" }` |

**Internal Logic:**
1. Extract `user_id` and `role` from JWT. Validate `role == STAFF`.
2. Validate request body — trim `note_text`, check length (1–2000 chars, non-empty after trim).
3. Fetch query. If not found → 404.
4. Verify pickup: `queries.picked_up_by_staff_id == JWT.user_id`. If NULL or other staff → 403.
5. Insert into `complaint_notes`: `complaint_id = NULL`, `query_id = :id`, `staff_id = JWT.user_id`, `note_text`, `created_at = now()`.
6. Hydrate `staff_name` from `staff_profiles`.
7. Return 201.

**Side Effects:**
- One row inserted into `complaint_notes` (the shared notes table).
- No notification sent.

**Notes:**
- Same shared `complaint_notes` table as complaint notes — distinguished by which FK is set. The "one of complaint_id/query_id must be set" rule is enforced at the application layer.
- Notes are **append-only** — no edit, no delete in v1.
- Notes can be added in any pickup status, including `RESOLVED`.
- Returned via `GET /api/staff/queries/{id}` — no separate list endpoint.

---

## Notifications

_Endpoints under `/api/notifications`. Shared across all authenticated roles (CUSTOMER, OWNER, STAFF, ADMIN) — the JWT determines whose notifications are returned. The standard 401/500 responses from the Conventions section apply._

---

### `GET /api/notifications`

**Description:** List in-app notifications for the authenticated user. Available to all roles — the JWT determines whose notifications are returned. Used to render the bell icon dropdown and the notifications page.

**Authentication:** Required. Any authenticated, active role.

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `unread_only` | boolean | No | If `true`, return only notifications where `is_read = false`. Default: `false`. |
| `type` | string | No | Filter by notification type (e.g., `BOOKING_CONFIRMED`, `COMPLAINT_ASSIGNED`). Default: all types. |
| `date_from` | string (YYYY-MM-DD) | No | Filter by `created_at` from this date. Default: 30 days ago. |
| `date_to` | string (YYYY-MM-DD) | No | Filter by `created_at` up to this date. Default: today. |
| `page` | integer | No | Page number, 1-indexed (default: `1`). |
| `page_size` | integer | No | Results per page (default: `20`, max: `100`). |

> Default 30-day window keeps the typical bell-dropdown response fast. Users wanting older notifications can extend the range.

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_results": 12,
  "total_pages": 1,
  "summary": {
    "unread_count": 3
  },
  "notifications": [
    {
      "notification_id": 5012,
      "type": "BOOKING_CONFIRMED",
      "message": "Your booking at Champions Turf on May 20 (6:00 PM) is confirmed.",
      "is_read": false,
      "created_at": "2026-05-15T14:30:00Z"
    },
    {
      "notification_id": 5008,
      "type": "COMPLAINT_ASSIGNED",
      "message": "A new complaint has been assigned to you (Complaint #401).",
      "is_read": false,
      "created_at": "2026-05-14T20:20:00Z"
    },
    {
      "notification_id": 4995,
      "type": "PAYOUT_RELEASED",
      "message": "Payout of ₹1,080.00 has been released for Booking #1019.",
      "is_read": true,
      "created_at": "2026-05-15T22:01:00Z"
    }
  ]
}
```

> `summary.unread_count` is computed **across the entire user's notifications** (ignoring filters), so it can drive the bell-icon badge accurately.
> Sorted by `created_at` descending — newest first.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | User is suspended or banned (status != ACTIVE) | `{ "error": "Forbidden" }` |

> No role-based 403 — all authenticated, active users can call this.

**Internal Logic:**
1. Extract `user_id` and `status` from JWT. Validate `status == ACTIVE`.
2. Validate query parameters (date format, page bounds, type non-empty if provided).
3. Build query: `SELECT * FROM notifications WHERE user_id = :user_id`.
4. Apply filters: `is_read` (if `unread_only=true`), `type`, `created_at` date range.
5. Compute `summary.unread_count`: separate query, **no filters applied**, counts all rows where `user_id = :user_id AND is_read = false`.
6. Compute `total_results` for the filtered set.
7. Apply sort (`ORDER BY created_at DESC, id DESC`) and pagination.
8. Return 200.

**Side Effects:**
- No DB writes. Reading the list does **not** auto-mark notifications as read.

**Notes:**
- The endpoint is role-agnostic on purpose. The `type` field tells the frontend what kind of notification it is and how to render/link it. Backend doesn't filter by role — a customer simply won't have `COMPLAINT_ASSIGNED` notifications because none get inserted for that user.
- Known notification types (non-exhaustive; schema is `VARCHAR(50)`):
  - Customer: `BOOKING_CONFIRMED`, `BOOKING_REMINDER`, `BOOKING_CANCELLED`, `RESCHEDULE_CONFIRMED`, `REFUND_PROCESSED`, `COMPLAINT_RESOLVED`, `QUERY_RESOLVED`.
  - Owner: `NEW_BOOKING`, `BOOKING_CANCELLED`, `PAYOUT_RELEASED`, `TURF_APPROVED`, `TURF_REJECTED`, `SUBCOURT_APPROVED`, `SUBCOURT_REJECTED`.
  - Staff: `COMPLAINT_ASSIGNED`.
  - Admin: (none in v1).
- Notifications are never deleted via API in v1. They accumulate; a background prune job is a later concern, not part of the contract.
- The `message` is a frontend-ready string built at notification creation time. No templating or i18n in v1.

---

### `PUT /api/notifications/{id}/read`

**Description:** Mark a single notification as read. Idempotent — calling this on an already-read notification is a no-op and still returns success. Used when the user clicks/taps a notification.

**Authentication:** Required. Any authenticated, active role.

**Path Parameters:**
| Name | Type | Description |
|---|---|---|
| `id` | integer | The `notification_id`. |

**Query Parameters:** None.
**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "notification_id": 5012,
  "is_read": true,
  "unread_count": 2
}
```

> `unread_count` is the user's **new** total unread count after this update — lets the frontend update the bell badge without a second request.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 401 | Missing or invalid JWT | `{ "error": "Unauthorized" }` |
| 403 | User is suspended or banned (status != ACTIVE) | `{ "error": "Forbidden" }` |
| 403 | Notification exists but belongs to a different user | `{ "error": "Forbidden" }` |
| 404 | `notification_id` does not exist | `{ "error": "Notification not found" }` |

> Same 403-vs-404 reasoning: when the notification exists but isn't yours, return 403. Notification IDs aren't externally guessable.

**Internal Logic:**
1. Extract `user_id` and `status` from JWT. Validate `status == ACTIVE`.
2. Fetch notification: `SELECT * FROM notifications WHERE id = :id`. If not found → 404.
3. Verify ownership: `notifications.user_id == JWT.user_id`. If not → 403.
4. If `is_read` is already `true` → skip the UPDATE (idempotent no-op).
5. Otherwise, update: `UPDATE notifications SET is_read = true WHERE id = :id`.
6. Recompute the user's unread count: `SELECT COUNT(*) FROM notifications WHERE user_id = :user_id AND is_read = false`.
7. Return 200 with `is_read: true` and the fresh `unread_count`.

**Side Effects:**
- At most one row updated in `notifications`.
- No notification sent.

**Notes:**
- **Idempotent on purpose.** Clicking the same notification twice, or two tabs racing, both succeed.
- **No bulk "mark all as read" endpoint in v1.** Frontend can loop if needed. Add `PUT /api/notifications/read-all` later if it becomes a UX pain point.
- **No "mark as unread" endpoint in v1.** Once read, stays read.
- **No delete endpoint** — notifications accumulate; cleanup is a background job concern, not a user action in v1.

---

## Public

_Endpoints under `/api/public`. No authentication required._

---

### `GET /api/public/cities`

**Description:** Returns the list of cities where BookMyTurf currently has at least one approved, listed turf. Used by the frontend to populate the city dropdown on the search page. A city only appears once a turf in that city has been admin-approved.

**Authentication:** Not required (public endpoint).

**Path Parameters:** None.
**Query Parameters:** None.
**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "total": 4,
  "cities": [
    { "name": "Bengaluru", "turf_count": 18 },
    { "name": "Mumbai", "turf_count": 12 },
    { "name": "Pune", "turf_count": 9 },
    { "name": "Hyderabad", "turf_count": 5 }
  ]
}
```

> Sorted by `turf_count` descending, then by `name` ascending for stable ties. `turf_count` counts `APPROVED` turfs only.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 500 | Unexpected server error | `{ "error": "Internal server error" }` |

> No 401/403 — endpoint is public. No 400 — no inputs to validate.

**Internal Logic:**
1. Run the query:
   ```sql
   SELECT city AS name, COUNT(*) AS turf_count
   FROM turfs
   WHERE status = 'APPROVED'
   GROUP BY city
   ORDER BY turf_count DESC, city ASC;
   ```
2. Normalize each `name` before grouping — trim whitespace and Title-case (so "pune", "Pune", " Pune " collapse into "Pune").
3. Wrap results in the response envelope with a `total` count of distinct cities.
4. Return 200.

**Side Effects:** None. Pure read.

**Notes:**
- No dedicated `cities` table — the list is derived live from `turfs.city`. No admin upkeep, no drift.
- Cities with only `PENDING`/`REJECTED` turfs are hidden — otherwise a customer would filter by a city and get an empty result.
- **Caching:** read-heavy, slow-changing data. Implementation can cache the response in memory for ~1 hour. Not part of the contract.
- The `name` field is the display value and also the value passed back as the `city` filter to `GET /api/customer/turfs` / `GET /api/public/turfs`. Keep it identical between endpoints so the filter matches.

---

### `GET /api/public/turfs`

**Description:** Public turf search for unauthenticated visitors. Returns a paginated list of approved turfs, with the same filters as the customer-facing search. Booking, availability, and turf-detail endpoints still require authentication — this endpoint is only for the discovery/listing view.

**Authentication:** Not required (public endpoint).

**Path Parameters:** None.

**Query Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `city` | string | No | Filter by city name (case-insensitive exact match, trimmed). |
| `sport` | string | No | Filter to turfs with at least one approved sub-court supporting this sport (case-insensitive). |
| `min_price` | decimal | No | At least one approved sub-court with `hourly_price >= min_price`. |
| `max_price` | decimal | No | At least one approved sub-court with `hourly_price <= max_price`. |
| `min_rating` | decimal | No | Filter by `turfs.avg_rating >= min_rating` (0.0–5.0). |
| `sort_by` | string | No | One of: `rating_desc` (default), `price_asc`, `price_desc`, `newest`. |
| `page` | integer | No | Page number, 1-indexed (default: `1`). |
| `page_size` | integer | No | Results per page (default: `10`, max: `50`). |

**Request Body:** None.

**Response — Success (200 OK):**
```json
{
  "page": 1,
  "page_size": 10,
  "total_results": 23,
  "total_pages": 3,
  "turfs": [
    {
      "turf_id": 23,
      "name": "Champions Turf",
      "city": "Pune",
      "address": "Plot 14, Baner Road, Pune",
      "cover_photo_url": "https://cdn.bookmyturf.in/turfs/23/cover.jpg",
      "min_hourly_price": 800.00,
      "max_hourly_price": 1200.00,
      "supported_sports": ["Cricket", "Football"],
      "avg_rating": 4.6,
      "review_count": 87
    },
    {
      "turf_id": 15,
      "name": "Greenfield Sports Arena",
      "city": "Pune",
      "address": "Survey No. 42, Wakad, Pune",
      "cover_photo_url": "https://cdn.bookmyturf.in/turfs/15/cover.jpg",
      "min_hourly_price": 900.00,
      "max_hourly_price": 900.00,
      "supported_sports": ["Football"],
      "avg_rating": 4.4,
      "review_count": 52
    }
  ]
}
```

> `min_hourly_price` / `max_hourly_price` are computed across the turf's **approved** sub-courts.
> `supported_sports` is the de-duplicated union of sports across all approved sub-courts.
> `cover_photo_url` is the first row in `turf_photos` (lowest `id`); `null` if no photos.

**Response — Errors:**
| Status Code | When | Response |
|---|---|---|
| 400 | Invalid query parameter (e.g., `min_price > max_price`, `min_rating > 5`, `page < 1`) | `{ "error": "Invalid query parameter", "details": { ... } }` |
| 500 | Unexpected server error | `{ "error": "Internal server error" }` |

> No 401/403 — endpoint is public.

**Internal Logic:**
1. Validate query parameters: numeric ranges (`page >= 1`, `1 <= page_size <= 50`, prices >= 0, `0 <= min_rating <= 5`); if both price bounds present, `min_price <= max_price`; `sort_by` in the allowed enum.
2. Normalize filters: trim `city`/`sport`, lowercase for comparison.
3. Build base query:
   ```
   SELECT t.* FROM turfs t
   WHERE t.status = 'APPROVED'
     AND EXISTS (SELECT 1 FROM sub_courts sc WHERE sc.turf_id = t.id AND sc.status = 'APPROVED')
   ```
4. Apply filters:
   - `city` → `LOWER(t.city) = LOWER(:city)`.
   - `min_rating` → `t.avg_rating >= :min_rating`.
   - `sport` → tightens the `EXISTS`: `AND JSON_CONTAINS(sc.sports, JSON_QUOTE(:sport_normalized))`.
   - `min_price`/`max_price` → tightens the `EXISTS`: `AND sc.hourly_price BETWEEN :min_price AND :max_price` (defaults of 0 / large number when only one bound provided).
5. Compute `total_results`.
6. Apply sort:
   - `rating_desc` → `ORDER BY t.avg_rating DESC, t.review_count DESC, t.id ASC`.
   - `price_asc`/`price_desc` → by the turf's `min_hourly_price` across approved sub-courts.
   - `newest` → `ORDER BY t.created_at DESC, t.id DESC`.
7. Apply pagination.
8. For each turf in the page, hydrate `min/max_hourly_price`, `supported_sports`, `cover_photo_url`.
9. Return 200.

**Side Effects:** None. Pure read.

**Notes:**
- Intentionally a **subset** of `GET /api/customer/turfs` — same filters, same shape (minus anything personalized). Frontend can reuse the same list component.
- Turf detail, availability, and booking remain auth-gated. Clicking a turf card on the public page should prompt login/signup.
- Owner phone is **not** exposed here (nor in the customer search) — only on the authenticated turf detail page.
- Price filter semantics: "the turf has at least one sub-court in this price range." A turf with sub-courts at 500 and 1500 matches `min_price=1000` because the 1500 court qualifies.
- Read-heavy; same caching note as `GET /api/public/cities` applies if traffic grows. Not part of the contract.

---

## Appendix A — README & Schema Corrections

The following deltas emerged while specifying the Admin / Staff / Public / Notifications endpoints. They should be applied to `README.md` and (optionally) the database schema so documentation stays consistent.

### README route-table corrections

1. **Notifications moved to a shared section.** The README lists `GET /notifications` and `PUT /notifications/{id}/read` under Staff (`/api/staff`). They are actually shared across all roles and live under `/api/notifications`. Replace the two Staff rows with a new section:

   | Method | Endpoint | Description |
   |---|---|---|
   | GET | `/notifications` | List in-app notifications for the authenticated user (any role) |
   | PUT | `/notifications/{id}/read` | Mark a notification as read |

2. **New endpoint: `GET /api/staff/queries/{id}`.** Not present in the README's Staff route table. Add it (parallel to `GET /api/staff/complaints/{id}`):

   | Method | Endpoint | Description |
   |---|---|---|
   | GET | `/queries/{id}` | View a picked-up query with customer details & internal notes |

   Rationale: per the design decision to avoid a separate notes-list endpoint, query notes are surfaced through a detail endpoint, exactly mirroring the complaint detail endpoint.

### Schema notes (optional — not required for v1)

These are documented design accommodations, not blocking issues. v1 works without schema changes; the items below note where a small column addition would make the implementation cleaner if desired later.

1. **`sub_courts` has no `created_at` column.** `GET /api/admin/sub-courts/pending` sorts pending sub-courts by `id ASC` as a proxy for creation order (an auto-increment PK is monotonic, so this is equivalent in practice). If true submission timestamps are ever needed for reporting, add `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` to `sub_courts`.

2. **`queries` has no `picked_up_at` column.** `PUT /api/staff/queries/{id}/pick-up` returns a `picked_up_at` value derived server-side at the moment of the atomic claim; it is not persisted. If pickup timestamps are needed for SLA reporting, add `picked_up_at TIMESTAMP NULL` to `queries` and set it during the claim UPDATE.

3. **No audit/action-log table.** Admin actions that accept an optional `reason` (`suspend`, `ban`, `activate`, turf/sub-court `reject`) accept the field for forward compatibility but do not persist it in v1, except where the reason is relayed in a notification message (turf/sub-court reject). An `admin_actions` audit table is a clean v2 addition; the API contract will not need to change.

4. **Admin removal is a soft deactivation.** `DELETE /api/admin/admins/{id}` flips `users.status` to `BANNED` rather than deleting the row, to preserve FK references from `staff_profiles.created_by_admin_id` and `complaints.assigned_by_admin_id`. A dedicated `REMOVED` value in the `users.status` enum would make this semantically cleaner in v2; not required for v1.
