# BookMyTurf
### Slot it. Book it. Play it.

---

## Table of Contents

- [About the Project](#about-the-project)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Folder Structure](#folder-structure)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Screenshots / Demo](#screenshots--demo)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## About the Project

BookMyTurf is a web-based marketplace that connects sports enthusiasts with turf owners across India. Customers can search, compare, and book hourly slots at sports turfs near them, while turf owners get a single dashboard to list their grounds, manage bookings, and track revenue.

The platform addresses common pain points in the Indian turf-booking experience — manual phone bookings, unclear availability, last-minute cancellations, and no centralized way to discover nearby grounds.

Built for four user roles — customers, turf owners, platform admins, and support staff — BookMyTurf streamlines the entire booking lifecycle from discovery to payment to post-game support.

---

## Features

### 👤 Customer
- Search and book turfs by location, sport, price, and rating
- Book single or multiple hourly slots in one go
- Secure online payment via UPI, cards, and wallets
- Reschedule, cancel, and get auto-refunds per policy
- Rate turfs and raise booking complaints or general queries

<details>
<summary>View all customer features</summary>

- Sign up via email/password
- Profile with name, phone, email, preferred sports, city
- Search turfs by location, sport, price range, and rating
- List view of turfs (no map)
- Turf detail page: photos, description, price, address, owner phone
- Hourly slot booking (e.g., 6–7 PM, 7–8 PM)
- Single or multiple slots in one booking
- Online payment only (UPI, cards, wallets)
- Free cancellation up to X hours before slot (auto-refund per policy)
- Reschedule booking up to X hours before slot
- Booking history: view past + upcoming, download receipt, reschedule upcoming, cancel upcoming
- Star rating + written review after booking
- Contact owner via phone number on turf detail page
- Raise complaint via form linked to a specific booking
- Submit general queries (not tied to any booking) to the staff query pool
- In-app notifications for booking confirmations and reminders

</details>

### 🏟️ Turf Owner
- List multiple turfs with sub-courts under one account
- Manage bookings via a calendar view with sub-court filters
- Track daily, weekly, and monthly revenue
- Auto-payouts to bank after slot completion
- Respond to customer reviews

<details>
<summary>View all owner features</summary>

- Self-registration (account active immediately)
- Multiple turfs under one owner account
- Turf listing: name, address, photos, price, sports supported, owner contact, multiple sub-courts (Court A, Court B, etc.)
- Turf listings require admin approval before going live
- Slots configured per sub-court
- Flat hourly pricing per sub-court (no peak/off-peak or weekend variations)
- Calendar view of bookings with filter by sub-court
- Cannot block slots once published
- Cannot manually add bookings (all bookings come through the customer platform)
- Revenue dashboard: daily/weekly/monthly revenue, booking counts, top sub-courts
- Payouts: held until X hours after slot completes, then auto-payout to bank
- View customer details (name, phone, email) for bookings on their turf
- Reply to customer reviews
- Notifications: In-app notifications for new bookings, cancellations, payouts

</details>

### 🛠️ Admin
- Approve or reject new turf listings
- Manage users — suspend or ban customers, owners, and staff
- Add or remove other admin accounts
- View revenue graphs and platform KPIs
- Assign customer complaints to staff

<details>
<summary>View all admin features</summary>

- Single admin role (all admins have equal power)
- Any admin can add or remove other admin accounts
- Dashboard KPIs: total users, total bookings, total revenue today, revenue graphs (daily, weekly, monthly), top turfs, top cities
- User management: view, search/filter, suspend/ban customers, owners, and staff
- Turf listing approval: approve or reject only
- Flat commission percentage applied across all turfs
- Payouts: view only (auto-processed)
- Refunds: auto-processed per policy (no admin involvement)
- Reviews: no moderation (auto-publish)
- View bookings and revenue details
- Create staff accounts with credentials
- Assign complaints to staff (manual assignment, with ability to reassign)

</details>

### 🎧 Staff
- Handle complaints assigned by admin
- Pick up general queries from a shared pool
- Track complaint lifecycle: Open → In Progress → Resolved
- View booking and customer contact details for each case

<details>
<summary>View all staff features</summary>

- Account created by admin only (with credentials)
- View only their own assigned complaints (current and past)
- For each complaint, view: complaint details, related booking details, customer contact (name, phone, email)
- Actions on complaint: update status, add internal notes, contact customer outside platform (call/email)
- Complaints are manually assigned by admin (and can be reassigned)
- General queries go into a shared pool — any staff can pick up
- Once a staff picks up a query, it is assigned to them
- Lifecycle for both complaints and queries: Open → In Progress → Resolved
- In-app notifications when a complaint is assigned

</details>

---

## Tech Stack

**Frontend**
- React.js
- React Router (for page navigation)
- Axios (for API calls to backend)
- Tailwind CSS or Material UI (TBD for styling)
- Vite or Create React App (build tool)

**Backend**
- Java 17+
- Spring Boot 3.x
- Spring Web (REST APIs)
- Spring Data JPA (database operations)
- Spring Security (authentication)
- Hibernate (ORM)
- Maven (build tool)
- Lombok (boilerplate reduction)

**Database**
- MySQL 8.x

**Authentication**
- JWT (JSON Web Tokens)
- BCrypt (password hashing)

**Third-party integrations**
- Payment gateway: Razorpay (test mode for v1)

**Tools**
- Git + GitHub (version control)
- IntelliJ IDEA / VS Code (IDEs)
- Postman (API testing)
- MySQL Workbench (database management)

---

## System Architecture

```
┌─────────────┐      REST API       ┌──────────────────┐      JPA       ┌──────────┐
│   React.js  │ ──── (HTTPS) ────▶  │   Spring Boot    │ ──────────▶    │  MySQL   │
│  (Frontend) │ ◀────  JSON  ────── │   (Backend)      │ ◀──────────    │   (DB)   │
└─────────────┘                     └──────────────────┘                └──────────┘
                                            │
                                            │ (Server-side calls only)
                                            ▼
                                  ┌────────────────────┐
                                  │  Razorpay (Test)   │
                                  └────────────────────┘
```

BookMyTurf follows a classic **three-tier monolithic architecture**:

- **Frontend (React.js):** Handles UI, routing, and user interactions. Communicates with the backend via REST API calls (JSON over HTTPS). Stores the JWT token locally and sends it with every authenticated request.

- **Backend (Spring Boot):** Exposes REST endpoints, validates input, enforces business rules, and handles authentication via JWT. Uses Spring Data JPA / Hibernate to talk to the database. The Razorpay integration is called server-side only, never from the frontend.

- **Database (MySQL):** Stores all persistent data — users, turfs, bookings, complaints, queries, payouts, and in-app notifications. Accessed exclusively through the backend.

- **Authentication:** Stateless JWT-based. Passwords are hashed using BCrypt.

- **Notifications:** All notifications are stored in the `notifications` table and shown in-app. No email or SMS in v1.

- **Payouts:** Fully simulated — the system records `payouts.status = PAID` after the configured delay, but no real bank transfer happens. Bank account fields are stored as-is and not validated against real banks.

---

## Folder Structure

```
bookmyturf/
├── backend/                         ← Spring Boot project
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/bookmyturf/
│   │   │   │   ├── controller/      ← REST endpoints
│   │   │   │   ├── service/         ← Business logic
│   │   │   │   ├── repository/      ← Database access (JPA)
│   │   │   │   ├── model/           ← Entities (User, Turf, Booking…)
│   │   │   │   ├── dto/             ← Data Transfer Objects
│   │   │   │   ├── config/          ← Spring config (security, CORS…)
│   │   │   │   ├── security/        ← JWT filters, auth utils
│   │   │   │   ├── exception/       ← Custom exceptions, handlers
│   │   │   │   └── BookMyTurfApp.java
│   │   │   └── resources/
│   │   │       ├── application.properties
│   │   │       └── static/
│   │   └── test/
│   ├── pom.xml                      ← Maven config
│   └── README.md
│
├── frontend/                        ← React project
│   ├── public/
│   ├── src/
│   │   ├── components/              ← Reusable UI components
│   │   ├── pages/                   ← Page-level views
│   │   ├── services/                ← API call functions (axios)
│   │   ├── context/                 ← React Context (auth, user state)
│   │   ├── hooks/                   ← Custom hooks
│   │   ├── utils/                   ← Helper functions
│   │   ├── assets/                  ← Images, icons, fonts
│   │   ├── styles/                  ← Global CSS
│   │   ├── routes/                  ← Route definitions
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
│
├── docs/                            ← Documentation, ER diagrams, API specs
├── .gitignore
└── README.md
```

---

## Prerequisites

Make sure you have the following installed:

- [Java JDK 17+](https://adoptium.net/)
- [Maven 3.8+](https://maven.apache.org/download.cgi)
- [Node.js 18+ and npm](https://nodejs.org/)
- [MySQL 8.0+](https://dev.mysql.com/downloads/)
- [Git](https://git-scm.com/)

---

## Installation and Setup

### Clone
```bash
git clone https://github.com/your-username/bookmyturf.git
cd bookmyturf
```

### Database
Create a MySQL database named `bookmyturf`.

### Backend
```bash
cd backend
```
Update DB credentials in `src/main/resources/application.properties`, then:
```bash
mvn spring-boot:run
```
→ Runs on `http://localhost:8080`

### Frontend
```bash
cd frontend
npm install
```
Create a `.env` file (see Environment Variables section), then:
```bash
npm run dev
```
→ Runs on `http://localhost:5173`

---

## Environment Variables

The project uses environment variables for configuration.

1. Copy the example files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
2. Fill in your actual values (database credentials, JWT secret, Razorpay test keys)
3. Never commit your real `.env` files — they're listed in `.gitignore`

**Backend variables (`backend/.env.example`):**
- `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` — MySQL connection
- `JWT_SECRET`, `JWT_EXPIRATION` — JWT signing
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — Razorpay test mode credentials

**Frontend variables (`frontend/.env.example`):**
- `VITE_API_BASE_URL` — Backend URL (default `http://localhost:8080/api`)
- `VITE_RAZORPAY_KEY_ID` — Razorpay test key (public key, safe to expose)

---

## Database Schema

BookMyTurf uses a **hybrid user model**: a single `users` table for shared login/auth fields, with role-specific profile tables linked by `user_id`.

### 1. `users`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK, AUTO_INCREMENT | |
| email | VARCHAR(150), UNIQUE, NOT NULL | |
| phone | VARCHAR(15), UNIQUE, NOT NULL | |
| password_hash | VARCHAR(255), NOT NULL | BCrypt |
| role | ENUM('CUSTOMER','OWNER','STAFF','ADMIN'), NOT NULL | |
| status | ENUM('ACTIVE','SUSPENDED','BANNED'), DEFAULT 'ACTIVE' | |
| created_at | TIMESTAMP, DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP, ON UPDATE CURRENT_TIMESTAMP | |

### 2. `customer_profiles`
| Column | Type | Notes |
|---|---|---|
| user_id | BIGINT, PK, FK → users.id | |
| name | VARCHAR(100), NOT NULL | |
| city | VARCHAR(80) | |
| preferred_sports | VARCHAR(255) | Comma-separated or JSON |

### 3. `owner_profiles`
| Column | Type | Notes |
|---|---|---|
| user_id | BIGINT, PK, FK → users.id | |
| name | VARCHAR(100), NOT NULL | |
| bank_account_number | VARCHAR(30) | |
| ifsc_code | VARCHAR(15) | |

### 4. `staff_profiles`
| Column | Type | Notes |
|---|---|---|
| user_id | BIGINT, PK, FK → users.id | |
| name | VARCHAR(100), NOT NULL | |
| created_by_admin_id | BIGINT, FK → users.id | |

### 5. `admin_profiles`
| Column | Type | Notes |
|---|---|---|
| user_id | BIGINT, PK, FK → users.id | |
| name | VARCHAR(100), NOT NULL | |

### 6. `turfs`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK | |
| owner_id | BIGINT, FK → users.id | |
| name | VARCHAR(150), NOT NULL | |
| description | TEXT | |
| address | VARCHAR(255), NOT NULL | |
| city | VARCHAR(80), NOT NULL | |
| contact_phone | VARCHAR(15) | |
| avg_rating | DECIMAL(2,1), DEFAULT 0.0 | Average of all reviews (updated when a review is submitted) |
| review_count | INT, DEFAULT 0 | Total review count |
| status | ENUM('PENDING','APPROVED','REJECTED'), DEFAULT 'PENDING' | |
| created_at | TIMESTAMP | |

### 7. `turf_photos`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK | |
| turf_id | BIGINT, FK → turfs.id | |
| photo_url | VARCHAR(500), NOT NULL | |

### 8. `sub_courts`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK | |
| turf_id | BIGINT, FK → turfs.id | |
| name | VARCHAR(80), NOT NULL | e.g., 'Court A' |
| sports | JSON, NOT NULL | Array of supported sport names, e.g., `["Cricket", "Football"]`. Names are normalized (trimmed, Title-cased) on insert. |
| hourly_price | DECIMAL(10,2), NOT NULL | Flat per sub-court |
| opening_hour | TIME, NOT NULL | |
| closing_hour | TIME, NOT NULL | |
| status | ENUM('PENDING','APPROVED','REJECTED'), DEFAULT 'PENDING' | Independent of turf status; admin approves per sub-court |

### 9. `bookings`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK | |
| customer_id | BIGINT, FK → users.id | |
| sub_court_id | BIGINT, FK → sub_courts.id | |
| booking_date | DATE, NOT NULL | |
| total_amount | DECIMAL(10,2), NOT NULL | Frozen at booking time; refunds always use this, never current sub-court price |
| commission_amount | DECIMAL(10,2), NOT NULL | Platform's cut |
| status | ENUM('CONFIRMED','CANCELLED','COMPLETED','REFUNDED'), DEFAULT 'CONFIRMED' | |
| created_at | TIMESTAMP | |

### 10. `booking_slots`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK | |
| booking_id | BIGINT, FK → bookings.id | |
| start_time | TIME, NOT NULL | e.g., 18:00 |
| end_time | TIME, NOT NULL | e.g., 19:00 |
| rate_at_booking | DECIMAL(10,2), NOT NULL | Per-slot price frozen at the time of booking; refunds always use this, never the current sub-court price |

> Uniqueness across (sub_court_id, booking_date, start_time) is enforced at the application layer (joined with bookings) to prevent double-booking.

### 11. `payments`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK | |
| booking_id | BIGINT, FK → bookings.id | |
| amount | DECIMAL(10,2), NOT NULL | |
| payment_method | ENUM('UPI','CARD','NETBANKING','WALLET','EMI','PAYLATER') | Razorpay returns one of these |
| gateway_transaction_id | VARCHAR(100) | |
| status | ENUM('SUCCESS','FAILED','PENDING') | |
| created_at | TIMESTAMP | |

### 12. `refunds`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK | |
| booking_id | BIGINT, FK → bookings.id | |
| amount | DECIMAL(10,2), NOT NULL | |
| razorpay_refund_id | VARCHAR(100) | ID returned by Razorpay Refund API |
| status | ENUM('PENDING','SUCCESS','FAILED') | |
| processed_at | TIMESTAMP | |

### 13. `payouts`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK | |
| owner_id | BIGINT, FK → users.id | |
| booking_id | BIGINT, FK → bookings.id | |
| amount | DECIMAL(10,2), NOT NULL | Booking amount minus commission |
| status | ENUM('PENDING','PAID','FAILED','CANCELLED'), DEFAULT 'PENDING' | |
| scheduled_at | TIMESTAMP | When auto-payout will fire |
| paid_at | TIMESTAMP | |

### 14. `reviews`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK | |
| customer_id | BIGINT, FK → users.id | |
| turf_id | BIGINT, FK → turfs.id | |
| booking_id | BIGINT, FK → bookings.id, UNIQUE | One review per booking |
| rating | TINYINT, NOT NULL | 1–5 |
| review_text | TEXT | |
| created_at | TIMESTAMP | |

### 15. `review_replies`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK | |
| review_id | BIGINT, FK → reviews.id, UNIQUE, ON DELETE CASCADE | One reply per review; deleted when review is deleted |
| owner_id | BIGINT, FK → users.id | |
| reply_text | TEXT, NOT NULL | |
| created_at | TIMESTAMP | |

### 16. `complaints`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK | |
| customer_id | BIGINT, FK → users.id | |
| booking_id | BIGINT, FK → bookings.id, NOT NULL | Always linked to a booking |
| subject | VARCHAR(200) | |
| description | TEXT | |
| assigned_staff_id | BIGINT, FK → users.id, NULLABLE | Set when admin assigns |
| assigned_by_admin_id | BIGINT, FK → users.id, NULLABLE | |
| status | ENUM('OPEN','IN_PROGRESS','RESOLVED'), DEFAULT 'OPEN' | |
| resolution_text | TEXT, NULLABLE | Staff's reply / resolution message, visible to customer once RESOLVED |
| created_at | TIMESTAMP | |
| resolved_at | TIMESTAMP | |

### 17. `queries`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK | |
| customer_id | BIGINT, FK → users.id | |
| subject | VARCHAR(200) | |
| description | TEXT | |
| picked_up_by_staff_id | BIGINT, FK → users.id, NULLABLE | NULL = still in pool |
| status | ENUM('OPEN','IN_PROGRESS','RESOLVED'), DEFAULT 'OPEN' | |
| resolution_text | TEXT, NULLABLE | Staff's reply / resolution message, visible to customer once RESOLVED |
| created_at | TIMESTAMP | |
| resolved_at | TIMESTAMP | |

### 18. `complaint_notes`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK | |
| complaint_id | BIGINT, FK → complaints.id, NULLABLE | |
| query_id | BIGINT, FK → queries.id, NULLABLE | One of complaint_id/query_id must be set |
| staff_id | BIGINT, FK → users.id | |
| note_text | TEXT, NOT NULL | |
| created_at | TIMESTAMP | |

### 19. `notifications`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT, PK | |
| user_id | BIGINT, FK → users.id | |
| type | VARCHAR(50) | e.g., 'COMPLAINT_ASSIGNED' |
| message | VARCHAR(500) | |
| is_read | BOOLEAN, DEFAULT FALSE | |
| created_at | TIMESTAMP | |

---

## API Documentation

The backend exposes a REST API. All endpoints are prefixed with `/api`.

For interactive, live documentation with request/response schemas and the ability to try endpoints in the browser, run the backend and visit:

**Swagger UI:** `http://localhost:8080/swagger-ui.html`

Below is a summary of all endpoints grouped by module.

### 🔐 Auth (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/register/customer` | Self-registration for customers (email + password) |
| POST | `/register/owner` | Self-registration for owners — account active immediately |
| POST | `/login` | Login for all roles (customer, owner, staff, admin) — returns JWT with role |

> Logout is handled entirely client-side: the frontend deletes the JWT from `localStorage`. The 24-hour token expiry acts as the safety net.

> Staff and admin accounts are created via `/api/admin/staff` and `/api/admin/admins`. No public registration for them.

### 👤 Customer (`/api/customer`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/profile` | Get current customer profile |
| PUT | `/profile` | Update profile |
| GET | `/turfs` | Search turfs (filters: city, sport, price, rating) |
| GET | `/turfs/{id}` | Get turf details |
| GET | `/turfs/{id}/availability` | Get available slots for a date |
| POST | `/bookings/initiate` | Validate slots + create Razorpay order (does not persist booking) |
| POST | `/bookings/confirm` | Verify Razorpay payment + persist booking |
| GET | `/bookings` | List own bookings (past + upcoming) |
| GET | `/bookings/{id}` | Get booking details |
| GET | `/bookings/{id}/receipt` | Download receipt (PDF) |
| POST | `/bookings/{id}/reschedule/initiate` | Validate reschedule + create payment order if rate diff is positive |
| PUT | `/bookings/{id}/reschedule/confirm` | Apply reschedule (with payment verification or refund as needed) |
| DELETE | `/bookings/{id}` | Cancel a booking |
| POST | `/reviews` | Submit a review for a booked turf |
| DELETE | `/reviews/{id}` | Delete own review |
| POST | `/complaints` | Raise a complaint linked to a booking |
| GET | `/complaints` | View own complaints |
| POST | `/queries` | Submit a general query |
| GET | `/queries` | View own queries |

### 🏟️ Owner (`/api/owner`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/profile` | Get owner profile |
| PUT | `/profile` | Update profile |
| POST | `/turfs` | Create a turf listing |
| GET | `/turfs` | List own turfs |
| PUT | `/turfs/{id}` | Update a turf listing |
| POST | `/turfs/{id}/sub-courts` | Add a sub-court |
| GET | `/turfs/{id}/sub-courts` | List sub-courts |
| PUT | `/sub-courts/{id}` | Update sub-court (name, price, hours) |
| GET | `/bookings` | View bookings (calendar, filter by sub-court) |
| GET | `/bookings/{id}` | View booking details with customer info |
| GET | `/revenue` | Revenue dashboard (daily/weekly/monthly) |
| GET | `/payouts` | View payout history |
| GET | `/reviews` | View reviews on own turfs |
| POST | `/reviews/{id}/reply` | Reply to a review |

### 🛠️ Admin (`/api/admin`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard` | KPIs + revenue graphs |
| GET | `/users` | List users (filter by role, status, search) |
| PUT | `/users/{id}/suspend` | Suspend a user |
| PUT | `/users/{id}/ban` | Ban a user |
| PUT | `/users/{id}/activate` | Reactivate a user |
| GET | `/turfs/pending` | List turfs awaiting approval |
| PUT | `/turfs/{id}/approve` | Approve a turf listing (turf-level fields) |
| PUT | `/turfs/{id}/reject` | Reject a turf listing (turf-level fields) |
| GET | `/sub-courts/pending` | List sub-courts awaiting approval |
| PUT | `/sub-courts/{id}/approve` | Approve a sub-court |
| PUT | `/sub-courts/{id}/reject` | Reject a sub-court |
| POST | `/admins` | Create a new admin account |
| GET | `/admins` | List all admins |
| DELETE | `/admins/{id}` | Remove an admin account |
| POST | `/staff` | Create a staff account |
| GET | `/complaints` | List all complaints |
| PUT | `/complaints/{id}/assign` | Assign or reassign complaint to staff |
| GET | `/queries` | View all queries |
| GET | `/payouts` | View all payouts (view-only) |
| GET | `/bookings` | View all bookings |
| GET | `/revenue` | Platform-wide revenue and graphs |

### 🎧 Staff (`/api/staff`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/complaints` | List complaints assigned to me |
| GET | `/complaints/{id}` | View complaint with booking & customer details |
| PUT | `/complaints/{id}/status` | Update complaint status |
| POST | `/complaints/{id}/notes` | Add an internal note |
| GET | `/queries/pool` | View open queries available to pick up |
| PUT | `/queries/{id}/pick-up` | Pick up a query from pool |
| GET | `/queries/my` | List queries I've picked up |
| GET | `/queries/{id}` | View a picked-up query with customer details & internal notes |
| PUT | `/queries/{id}/status` | Update query status |
| POST | `/queries/{id}/notes` | Add an internal note on a query |

> Notifications are not staff-specific — they are shared across all roles. See the **Notifications** section below.

### 🔔 Notifications (`/api/notifications`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/notifications` | List in-app notifications for the authenticated user (any role) |
| PUT | `/notifications/{id}/read` | Mark a notification as read |

### 🌐 Public (`/api/public`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/cities` | List active cities |
| GET | `/turfs` | Public turf search (no auth required) |

---

## Running the Application

Make sure MySQL is running locally, then:

### Start the backend
```bash
cd backend
mvn spring-boot:run
```
→ Backend runs on `http://localhost:8080`
→ Swagger UI: `http://localhost:8080/swagger-ui.html`

### Start the frontend
```bash
cd frontend
npm run dev
```
→ Frontend runs on `http://localhost:5173`

### Open the app
Visit `http://localhost:5173` in your browser.

---

## Testing

### Backend
```bash
cd backend
mvn test                      # Run all tests
mvn test -Dtest=ClassName     # Run a specific test class
```

### Frontend
```bash
cd frontend
npm test                      # Run all tests in watch mode
npm test -- --coverage        # Run with coverage report
```

---

## Screenshots / Demo

_Screenshots coming soon._

---

## Roadmap

Planned future enhancements:

1. **Mobile apps (Android + iOS)** — biggest reach expansion
2. **Map view with directions** — better discovery of nearby turfs
3. **Hindi language support** — broader user base in India
4. **Peak/off-peak and weekend pricing** — flexible pricing for owners
5. **Coupons and referral rewards** — growth lever for the marketplace
6. **In-app chat between customer and owner** — keep communication on platform
7. **WhatsApp notifications** — preferred channel for Indian users
8. **Tournament hosting and registration** — new revenue stream

---

## Contributing

This is a personal portfolio project and is not actively accepting pull requests at this time.

However, feedback, bug reports, and feature suggestions are very welcome — feel free to open an [issue](../../issues) to start a discussion.
