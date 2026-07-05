# MR GRAIN Business Command Centre

A full-stack business management system for MR GRAIN covering CRM, orders, invoicing, payments, expenses, inventory, tasks, and reporting.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS, React Router, TanStack Query
- **Backend:** Node.js + Express + TypeScript, Prisma ORM
- **Database:** PostgreSQL

## Project Structure

```
/backend    Express API, Prisma schema/migrations, business logic
/frontend   React SPA
USER_GUIDE.md   Plain-English guide for end users
```

## Local Setup

### 1. Database

Create a local PostgreSQL database (adjust credentials as needed):

```bash
sudo -u postgres psql -c "CREATE USER mrgrain WITH PASSWORD 'mrgrain' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE mrgrain OWNER mrgrain;"
```

### 2. Backend

```bash
cd backend
cp .env.example .env       # adjust DATABASE_URL / JWT_SECRET / SMTP settings as needed
npm install
npm run prisma:migrate     # applies migrations
npm run seed                # seeds roles, permissions, settings, a default Owner user, and sample products
npm run dev                  # starts the API on http://localhost:4000
```

Default seeded login: `owner@mrgrain.com.au` / `ChangeMe123!` — change this password after first login.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev    # starts the app on http://localhost:5173 (proxies /api to the backend)
```

## Notes

- **Email:** If `SMTP_HOST` is not set in `backend/.env`, outgoing emails are logged to the console instead of sent — useful for local development.
- **File uploads** (receipts, logos) are stored under `backend/uploads/` and served at `/uploads/...`.
- **Backups:** a nightly cron job (02:00 server time) dumps the database to `backend/backups/` and prunes anything older than 30 days.
- **Overdue invoices** are checked once daily (06:00 server time) and on server startup, flipping status to `overdue` and notifying the Owner/Accountant.
