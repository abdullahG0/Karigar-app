# Parkview Home Services — Monorepo

A full-stack home services platform built for residential communities. Residents can book service professionals (plumbers, electricians, cleaners, etc.) and track jobs in real time.

## Monorepo Structure

```
parkview-homeservices/
├── apps/
│   ├── admin/          React + Vite admin dashboard (port 5173)
│   └── mobile/         Expo React Native app (residents + professionals)
├── backend/            Node.js + Express REST API + Socket.IO (port 3001)
├── shared/             TypeScript interfaces shared across all packages
├── .env.example        Environment variable template
└── package.json        npm workspaces root
```

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9 (workspaces support)
- **Expo Go** app on your phone (for mobile testing), or Android Studio / Xcode for emulators

---

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd parkview-homeservices
npm install
```

### 2. Configure Environment

```bash
cp .env.example backend/.env
```

Edit `backend/.env` if needed (defaults work for local dev).

### 3. Build Shared Types

```bash
npm run build:shared
```

### 4. Run the Backend

```bash
npm run dev:backend
# Server starts at http://localhost:3001
# SQLite database auto-created at backend/database.sqlite
```

### 5. Run the Admin Panel

```bash
npm run dev:admin
# Open http://localhost:5173
```

### 6. Run the Mobile App

```bash
cd apps/mobile
npm install          # first time only
npx expo start
# Scan QR code with Expo Go, or press 'a' for Android emulator
```

---

## Backend API Reference

Base URL: `http://localhost:3001/api`

### Auth

| Method | Endpoint         | Auth | Description              |
|--------|-----------------|------|--------------------------|
| POST   | /auth/register  | —    | Register a new user      |
| POST   | /auth/login     | —    | Login, returns JWT token |
| GET    | /auth/me        | JWT  | Get current user profile |
| GET    | /auth/users     | Admin| List all users           |

**Register body:**
```json
{
  "name": "John Doe",
  "phone": "+15550001234",
  "password": "secret",
  "role": "resident",
  "society_id": "society-abc"
}
```

### Service Categories

| Method | Endpoint       | Auth  | Description          |
|--------|---------------|-------|----------------------|
| GET    | /categories   | —     | List all categories  |
| POST   | /categories   | Admin | Create a category    |

### Professionals

| Method | Endpoint           | Auth         | Description                |
|--------|--------------------|--------------|----------------------------|
| GET    | /professionals     | —            | List all professionals     |
| GET    | /professionals/:id | —            | Get a professional profile |
| PATCH  | /professionals/me  | Professional | Update own profile         |

### Bookings

| Method | Endpoint              | Auth     | Description           |
|--------|-----------------------|----------|-----------------------|
| GET    | /bookings             | JWT      | List user's bookings  |
| POST   | /bookings             | Resident | Create a booking      |
| GET    | /bookings/:id         | JWT      | Get booking detail    |
| PATCH  | /bookings/:id/status  | JWT      | Update booking status |

**Create booking body:**
```json
{
  "category_id": "uuid",
  "scheduled_at": "2024-03-15T10:00:00Z",
  "address": "123 Main St, Apt 4B",
  "problem_description": "Leaking pipe under kitchen sink"
}
```

### Quotes

| Method | Endpoint                        | Auth         | Description          |
|--------|---------------------------------|--------------|----------------------|
| GET    | /quotes/booking/:bookingId      | JWT          | List quotes for booking |
| POST   | /quotes                         | Professional | Submit a quote       |
| PATCH  | /quotes/:id/accept              | Resident     | Accept a quote       |

### Messages (REST + Socket.IO)

| Method | Endpoint                        | Auth | Description              |
|--------|---------------------------------|------|--------------------------|
| GET    | /messages/booking/:bookingId    | JWT  | Get chat history         |
| POST   | /messages                       | JWT  | Send a message           |

**Socket.IO events:**

```js
// Connect and join a booking room
socket.emit('join_booking', bookingId)

// Send a real-time message
socket.emit('send_message', { booking_id, sender_id, content })

// Listen for incoming messages
socket.on('new_message', (message) => { ... })
```

### Reviews

| Method | Endpoint                          | Auth     | Description                  |
|--------|-----------------------------------|----------|------------------------------|
| GET    | /reviews/professional/:id         | JWT      | Get reviews for a professional |
| POST   | /reviews                          | Resident | Submit a review (1–5 stars)  |

### Health Check

```
GET /api/health  →  { "status": "ok", "timestamp": "..." }
```

---

## Authentication

All protected routes require a Bearer token:

```
Authorization: Bearer <jwt_token>
```

Tokens expire in 7 days. The JWT secret is configured via `JWT_SECRET` in `.env`.

---

## Database

SQLite via `better-sqlite3`. No setup required — the database file is auto-created at the path set in `DB_PATH` (default: `backend/database.sqlite`).

**Tables:** `users`, `professionals`, `service_categories`, `bookings`, `quotes`, `messages`, `reviews`

---

## Environment Variables

| Variable    | Default                | Description                         |
|-------------|------------------------|-------------------------------------|
| PORT        | 3001                   | Backend server port                 |
| JWT_SECRET  | pvc_dev_secret_2024    | JWT signing secret (change in prod) |
| DB_PATH     | ./database.sqlite      | Path to SQLite database file        |

---

## Root Scripts

```bash
npm run dev:backend     # Start backend with nodemon (hot reload)
npm run dev:admin       # Start Vite dev server for admin panel
npm run build:shared    # Compile shared TypeScript types
npm run build:backend   # Compile backend to dist/
npm run build:admin     # Build admin panel for production
npm run build:all       # Build shared → backend → admin in order
```

---

## Tech Stack

| Layer    | Technology                                              |
|----------|---------------------------------------------------------|
| Mobile   | Expo, React Native, TypeScript                          |
| Admin    | React 18, Vite, Tailwind CSS, Recharts, React Router v6 |
| Backend  | Node.js, Express, Socket.IO, better-sqlite3, JWT        |
| Shared   | TypeScript interfaces (compiled to CommonJS + ESM types)|

---

## Seeding Initial Data

After starting the backend, register an admin account:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","phone":"+15550000000","password":"admin123","role":"admin"}'
```

Then create service categories via the admin panel or API.
