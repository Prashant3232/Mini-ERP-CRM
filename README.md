# Mini ERP + CRM Operations Portal

A small internal ERP/CRM system for a wholesale/distribution company, covering customers, products/inventory, and sales challans with role-based access for Admin, Sales, Warehouse, and Accounts teams.

---

## Tech Stack

**Backend:** Node.js, TypeScript, Express.js, PostgreSQL, Prisma ORM, JWT auth, express-validator
**Frontend:** React, TypeScript, Vite, React Router, Axios
**Deployment target:** Render/Railway (backend + Postgres) + Vercel/Netlify (frontend), free tier — AWS is optional/bonus per the assignment brief

---

## Project Structure

```
erp-crm/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # DB schema (Users, Customers, Products, Challans, etc.)
│   │   └── seed.ts             # Creates test users for all 4 roles + sample data
│   ├── src/
│   │   ├── controllers/        # Business logic per module
│   │   ├── routes/             # Express route definitions + validation rules
│   │   ├── middleware/         # auth (JWT), role guard, error handler
│   │   ├── utils/               # JWT/bcrypt helpers, API response helpers
│   │   ├── prisma/client.ts     # Prisma client singleton
│   │   ├── app.ts               # Express app assembly
│   │   └── server.ts            # Entry point
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/client.ts        # Axios instance with JWT interceptor
│   │   ├── context/AuthContext.tsx
│   │   ├── components/          # Layout, ProtectedRoute
│   │   ├── pages/                # Login, Dashboard, Customers, Products, Challans
│   │   └── types/                 # Shared TS types matching backend models
│   ├── .env.example
│   └── package.json
├── docker-compose.yml            # Local Postgres for development
└── postman_collection.json       # Full API collection
```

---

## Architecture (short explanation)

- **Backend** is a layered Express app: `routes` (validation only) -> `controllers` (business logic + Prisma calls) -> `middleware` (auth/role guards, centralized error handler). All errors flow through `asyncHandler` into one `errorHandler`, so every endpoint returns a consistent `{ success, data | message }` shape.
- **Auth** is stateless JWT. The token encodes `userId`, `email`, `role`. `authenticate` middleware verifies it; `authorize(...roles)` middleware gates specific routes by role.
- **Data integrity for stock** is handled with Prisma `$transaction`: creating/confirming a challan validates stock for *every* line item first, and only deducts stock if all items pass — so a challan can never leave stock negative or partially deducted.
- **Challans store product snapshots** (name, SKU, unit price at time of sale) on `ChallanItem`, not just a `productId` reference — so historical challans stay accurate even if a product's price or name changes later.
- **Frontend** is a standard SPA: `AuthContext` holds the logged-in user and JWT (persisted to `localStorage`), `ProtectedRoute` guards pages, and role-sensitive UI (e.g. "Add Customer" button) checks `user.role` before rendering actions the backend would reject anyway.

---

## Roles & Permissions

| Action | Admin | Sales | Warehouse | Accounts |
|---|:---:|:---:|:---:|:---:|
| View customers/products/challans | Yes | Yes | Yes | Yes |
| Create/edit customers, add follow-ups | Yes | Yes | No | No |
| Create/edit products, record stock movement | Yes | No | Yes | No |
| Create/confirm/cancel challans | Yes | Yes | No | No |
| Register new users | Yes | No | No | No |

(Accounts currently has read-only access across modules — extend `authorize()` in the relevant route file if you want to give them write access to something.)

---

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (local install, or use the included `docker-compose.yml`)

### 1. Database
Easiest option — spin up Postgres with Docker:
```bash
docker compose up -d
```
This starts Postgres on `localhost:5432` with user/password `postgres`/`postgres` and database `erp_crm` (matches the default `.env.example`).

If you'd rather use a hosted free Postgres (Neon/Supabase/Render), just copy their connection string into `DATABASE_URL` in step 2.

### 2. Backend
```bash
cd backend
cp .env.example .env
# edit .env if your DATABASE_URL / JWT_SECRET differ from the defaults

npm install
npx prisma migrate dev --name init   # creates tables
npm run prisma:seed                  # creates test users + sample data
npm run dev                          # starts on http://localhost:5000
```

> **Note on Prisma generate:** `npm install` and `prisma migrate dev` both trigger `prisma generate` automatically, which downloads a small platform-specific query engine binary from Prisma's CDN. This requires normal internet access — if you're behind a restrictive corporate proxy/firewall that blocks `binaries.prisma.sh`, either allow that domain or run `npx prisma generate` from an unrestricted network once (the generated client is then cached locally).

### 3. Frontend
```bash
cd frontend
cp .env.example .env
# edit .env if your backend isn't on localhost:5000

npm install
npm run dev     # starts on http://localhost:5173
```

Open `http://localhost:5173` and log in with any of the seeded test accounts below.

---

## Test Login Credentials (all roles)

Created by `npm run prisma:seed`:

| Role | Email | Password |
|---|---|---|
| Admin | admin@erp.com | Password@123 |
| Sales | sales@erp.com | Password@123 |
| Warehouse | warehouse@erp.com | Password@123 |
| Accounts | accounts@erp.com | Password@123 |

---

## Environment Variables

**Backend (`backend/.env`)**
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | API port (default 5000) |
| `JWT_SECRET` | Secret used to sign JWTs — **change this for any real deployment** |
| `JWT_EXPIRES_IN` | Token lifetime (default 8h) |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins |

**Frontend (`frontend/.env`)**
| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API |

Neither `.env` file is committed (see `.gitignore`) — only the `.env.example` templates are, per standard practice.

---

## API Overview

All endpoints are prefixed by the backend base URL. Full request/response examples are in `postman_collection.json` — import it directly into Postman.

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/auth/login` | Public | Returns JWT + user |
| POST | `/auth/register` | Admin only | Create a user for any role |
| GET | `/auth/me` | Any logged-in user | |
| GET | `/customers` | Any | `?search=&status=&customerType=&page=&limit=` |
| GET | `/customers/:id` | Any | Includes follow-up notes + recent challans |
| POST | `/customers` | Admin, Sales | |
| PUT | `/customers/:id` | Admin, Sales | |
| POST | `/customers/:id/notes` | Admin, Sales | Add a follow-up note |
| GET | `/products` | Any | `?search=&category=&lowStock=true&page=&limit=` |
| GET | `/products/:id` | Any | Includes stock movement log |
| POST | `/products` | Admin, Warehouse | |
| PUT | `/products/:id` | Admin, Warehouse | Details only, not stock quantity |
| POST | `/products/:id/stock-movement` | Admin, Warehouse | The only way stock quantity changes; rejects if it would go negative |
| GET | `/challans` | Any | `?status=&customerId=&page=&limit=` |
| GET | `/challans/:id` | Any | |
| POST | `/challans` | Admin, Sales | `status: DRAFT` (default) or `CONFIRMED`; confirming deducts stock atomically |
| PATCH | `/challans/:id/confirm` | Admin, Sales | Moves DRAFT to CONFIRMED, deducts stock |
| PATCH | `/challans/:id/cancel` | Admin, Sales | Restores stock if it had been CONFIRMED |
| GET | `/health` | Public | Health check |

All list endpoints return `{ success, data, meta: { page, limit, total, totalPages } }`. All errors return `{ success: false, message }` with the appropriate HTTP status code (400 validation, 401 unauthenticated, 403 wrong role, 404 not found, 409 conflict/duplicate, 500 server error).

---

## Deployment

The assignment treats AWS as bonus and expects free-tier deployment as the baseline. Suggested path:

1. **Database:** Create a free Postgres instance on Neon (neon.tech) or Supabase (supabase.com). Copy the connection string.
2. **Backend:** Deploy `backend/` to Render (render.com) (Web Service) or Railway (railway.app).
   - Build command: `npm install && npx prisma generate && npm run build`
   - Start command: `npm start`
   - Set `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN` (your frontend's deployed URL) as environment variables.
   - Run migrations once against the hosted DB: `npx prisma migrate deploy` (via Render's shell, or add it as part of the build/start script), then `npm run prisma:seed` to create the test role accounts.
3. **Frontend:** Deploy `frontend/` to Vercel (vercel.com) or Netlify (netlify.com).
   - Build command: `npm run build`
   - Output directory: `dist`
   - Set `VITE_API_BASE_URL` to your deployed backend URL.

### AWS (bonus, optional)
- Backend: Elastic Beanstalk or an EC2 instance behind Nginx, with the same env vars.
- Database: RDS for PostgreSQL.
- Frontend: S3 + CloudFront static hosting.
- Product image uploads (bonus feature) would use S3 with signed upload URLs.

---

## Known Limitations / Not Yet Implemented

- **Product images / S3 upload** — bonus feature, not implemented in this submission.
- **Invoice PDF export** — bonus feature, not implemented; challans currently only render as an in-app detail page.
- **Docker for the app itself** — only Postgres is dockerized (`docker-compose.yml`); the Node backend and Vite frontend are not containerized, since local `npm run dev` was prioritized for the 48-hour window.
- **GitHub Actions CI/CD** — not set up.
- **Refresh tokens** — auth uses a single JWT with an 8-hour expiry; there's no refresh-token rotation, so users are logged out and redirected to `/login` when it expires.
- **Accounts role** is currently read-only everywhere; the assignment doesn't specify what Accounts should be able to write, so no write permissions were assumed on their behalf.
- **Pagination UI** — the API supports `page`/`limit`, but the frontend list pages currently fetch a fixed page size without pager controls (acceptable for the small sample datasets used in the assignment demo, but worth adding for a large customer/product base).
- **Prisma client generation could not be verified in the environment this was built in** (see setup note above) — the backend has been carefully hand-reviewed for type correctness, but run `npm run build` locally right after your first `npx prisma generate` and double check for errors.

---

## Assumptions Made

- Sales challans store a **product snapshot** (name, SKU, unit price) rather than only a foreign key, per the brief's explicit requirement — this means editing a product's price later does not retroactively change historical challans.
- Challan numbers are auto-generated as `CH-<year>-<sequence>` (e.g. `CH-2026-0001`), resetting the sequence each calendar year.
- "Search customer" covers name, mobile, email, and business name (case-insensitive partial match).
- Only Admin can create new user accounts (`/auth/register`) — there's no public self-signup, consistent with an internal operations tool.
- Cancelling a `CONFIRMED` challan restores the deducted stock (with a logged `IN` stock movement referencing the cancellation) — this wasn't explicitly specified but is standard business behavior and keeps the stock ledger consistent.
