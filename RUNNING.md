# Running ParkView HomeServices

A monorepo containing:
- **backend/** — Express REST API + Socket.IO (Node.js)
- **apps/mobile/** — Expo React Native app (residents & professionals)
- **apps/admin/** — React + Vite admin dashboard

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Bundled with Node.js |
| Expo Go | Latest | Install on your phone from the App Store / Play Store |

> **iOS Simulator / Android Emulator** — optionally install Xcode (macOS) or Android Studio to test without a physical device.

---

## Step 1 — Install Dependencies

Run once from the repo root (npm workspaces hoists all packages):

```bash
npm install
```

> If you encounter peer-dependency warnings, they are safe to ignore.

---

## Step 2 — Configure the Backend

```bash
cp .env.example backend/.env
```

The default values work for local development — no changes needed:

```
PORT=3001
JWT_SECRET=pvc_dev_secret_2024
DB_PATH=./database.sqlite
```

---

## Step 3 — Start All Services

```bash
npm run dev
```

This starts three processes concurrently:

| Process | URL / Output |
|---------|-------------|
| Backend API | http://localhost:3001 |
| Admin dashboard | http://localhost:5173 |
| Expo dev server | QR code printed in the mobile terminal |

> **Tip:** On first boot the backend auto-creates and seeds the SQLite database — no manual setup needed.

---

## Step 4 — Open the Mobile App

1. On your phone, open the **Expo Go** app.
2. Scan the QR code printed in the mobile terminal tab.
3. The app loads on your device.

> **Same network required** — your phone and computer must be on the same Wi-Fi network.
>
> **Update the API URL** — open `apps/mobile/src/config.ts` and replace the IP address with your machine's local IP:
> ```ts
> export const API_BASE_URL = 'http://YOUR_LOCAL_IP:3001/api';
> ```
> Find your IP: `ipconfig` (Windows) or `ifconfig` (macOS/Linux).

---

## Step 5 — Test Credentials

See [TEST_ACCOUNTS.md](./TEST_ACCOUNTS.md) for all seeded accounts.

Quick reference:

| Role | Phone | Password |
|------|-------|----------|
| Admin | +92300000001 | password123 |
| Resident | +92311111001 | password123 |
| Professional | +92322222001 | password123 |

---

## Step 6 — Admin Panel

Open [http://localhost:5173](http://localhost:5173) in your browser.

Use the **"Use Admin Account"** quick-fill button on the login page, or enter:
- Phone: `+92300000001`
- Password: `password123`

---

## Running Individual Services

```bash
# Backend only
npm run dev:backend

# Admin dashboard only
npm run dev:admin

# Expo / Mobile only
npm run dev:mobile
```

---

## Re-seed the Database

If you want to reset to a clean state:

```bash
npm run seed
```

This deletes the existing SQLite file and re-inserts all seed data.

---

## Production Build

```bash
npm run build:all
```

Builds shared types, backend (tsc → dist/), and admin dashboard (Vite → dist/).
