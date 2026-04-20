# MOTR v2 — Frontend

## Setup

```bash
cd frontend
npm install

# Copy env and set your Xano API URL
cp .env.example .env
```

Edit `.env`:
```
VITE_API_URL=https://xxek-swe1-ixjm.n7e.xano.io/api:motr
```

## Run

```bash
npm run dev
```

Open http://localhost:5173

## What works right now

- **Login** — authenticates against `POST /auth/me` and `POST /auth/login`
- **Role-based routing** — sidebar shows only the views your role can access
- **Customer list** — fetches from `GET /customers`
- **Customer detail** — click a customer to see their info + ROs
- **Create RO** — click "New RO" on any customer → fills job type, priority, rental, notes → posts to `POST /repair-orders`

## View structure

| View | Route | Status |
|---|---|---|
| customer-view | / (default for CSR) | ✅ Built |
| logistics-view | / (default for logistics) | 🔲 Stub |
| production-view | / (default for production) | 🔲 Stub |
| technician-view | / (default for technicians) | 🔲 Stub |
| nttbe-view | / (default for NTTBE) | 🔲 Stub |
| accounting-view | / (default for accounting) | 🔲 Stub |
| admin-view | / (default for admin/upper management) | 🔲 Stub |
