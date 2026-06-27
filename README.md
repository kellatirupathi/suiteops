# SuitesOps — Hotel Operations Management System

A web-based operations system for **RK Suites** that replaces manual registers for guest check-in, payment tracking, inventory, analytics, and staff accountability.

Built for the Aurora Institute of Technology Industry Internship Programme (Batch 2025-26).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS + React Router |
| Backend | Node.js + Express |
| Database | MongoDB (Mongoose) |
| Auth | JWT with role-based access control (RBAC) |
| PDF | jsPDF + jspdf-autotable (invoices/receipts) |
| Security | helmet, CORS, rate limiting, bcrypt password hashing |

## Features

- **Digital Guest Register** — check-in form, searchable/filterable guest list, check-out with actual date.
- **Payments & Dues** — record payments (cash/card/UPI + reference), automatic balance computation, fully-paid/outstanding status, overdue flagging.
- **Inventory Dashboard** — track linen / toiletries / minibar / cleaning supplies, +/− stock adjustments, low-stock alerts at threshold.
- **Daily Analytics** — occupancy rate, revenue today & this month, check-ins/outs today, total pending dues, low-stock count.
- **Staff Activity Log** — full audit trail of every check-in, checkout, payment and inventory change with user + timestamp (manager-only).
- **Access Control** — two roles. **Manager** = full access. **Front Desk** = check-in, checkout, payment entry, inventory adjust (no rooms/staff/audit management).
- **Mobile responsive** — collapsible sidebar; works on tablet/phone.
- **Invoice PDF** — generate a per-guest invoice/receipt from the guest detail page.

## Project Structure

```
suitesops/
├── backend/          Express API
│   └── src/
│       ├── config/   db connection
│       ├── models/   User, Room, Guest, Payment, InventoryItem, ActivityLog
│       ├── middleware/ auth (JWT + RBAC), error handling
│       ├── controllers/ business logic
│       ├── routes/   REST endpoints
│       └── utils/    finance calc, activity logger, seed script
└── frontend/         React app
    └── src/
        ├── pages/    Login, Dashboard, Guests, GuestDetail, Dues, Inventory, Rooms, Activity, Staff
        ├── components/ Layout, Modal, Toast, ProtectedRoute
        ├── context/  AuthContext
        ├── api/      axios client
        └── utils/    formatting, invoice PDF
```

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas URI

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env       # adjust MONGO_URI / JWT_SECRET as needed
npm run seed               # creates demo accounts, rooms & inventory
npm run dev                # starts API on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                # starts UI on http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:5000`, so no extra config is needed.

## Demo Accounts (after `npm run seed`)

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@rksuites.com | Manager@123 |
| Front Desk | frontdesk@rksuites.com | Frontdesk@123 |

> Change these via the `SEED_*` env vars (or the Staff page) before any real deployment.

## API Overview

| Method | Endpoint | Access | Purpose |
|--------|----------|--------|---------|
| POST | `/api/auth/login` | public | login, returns JWT |
| GET | `/api/auth/me` | auth | current user |
| GET/POST | `/api/auth/users` | manager | list / create staff |
| GET | `/api/rooms` | auth | list rooms |
| POST/PATCH/DELETE | `/api/rooms` | manager | manage rooms |
| GET/POST | `/api/guests` | auth | list / check-in |
| POST | `/api/guests/:id/checkout` | auth | check out |
| GET/POST | `/api/payments` | auth | list / record payments |
| GET | `/api/payments/dues` | auth | outstanding balances |
| GET | `/api/inventory` | auth | list stock |
| PATCH | `/api/inventory/:id/adjust` | auth | adjust stock |
| POST/PATCH/DELETE | `/api/inventory` | manager | manage catalogue |
| GET | `/api/analytics/dashboard` | auth | dashboard figures |
| GET | `/api/activity` | manager | audit trail |

## Security Notes

- All API routes (except login & health) require a valid JWT.
- Passwords are hashed with bcrypt; the hash is never returned.
- RBAC enforced server-side — front desk cannot reach manager-only routes even by crafting requests.
- Rate limiting on login (brute-force protection) and the API generally.
- helmet sets secure HTTP headers; CORS restricted to `CLIENT_URL`.

## Balance Calculation

`totalCharges = nights × dailyRate` (nights = ceil of stay duration, min 1).
For an in-house guest, nights are billed up to the later of *today* or *expected checkout*.
At checkout the total is frozen for accurate historical reporting.
`balanceDue = max(0, totalCharges − sum(payments))`. A guest is **overdue** when a balance remains past their checkout date.
