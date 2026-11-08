# TaskFlow

A multi-user task and project manager. Register, create projects, add tasks with a priority, status and due date, and watch the dashboard statistics and project progress bars update.

**Live demo:** https://taskflow-arsene.onrender.com/

The demo runs on Render's free tier, so the first request after a quiet period can take about a minute while the server wakes up. Register your own account to try it, and please don't enter real personal data.

## Features

- Register and log in (bcrypt password hashing, JWT valid for 24 hours)
- Projects: create, list, edit, delete (deleting a project deletes its tasks)
- Tasks: create, list recent tasks, tick to mark completed, delete
- Dashboard statistics: total projects, total tasks, completed and in progress
- Project cards with real task counts and progress bars
- Every user sees and changes only their own data

## Tech stack

- Node.js (ES modules) and Express 5
- PostgreSQL through the `pg` connection pool
- JWT authentication with `jsonwebtoken` and `bcryptjs`
- `helmet` security headers and `express-rate-limit` on login and register
- Plain HTML, CSS and JavaScript frontend served from `public/`
- Hosted on Render (web service and PostgreSQL database)

## Project structure

```
server.js                    startup: env check, database check, listen
src/app.js                   Express app: middleware, routes, error handlers
src/Middleware/authMiddleware.js   verifies the JWT and sets req.userId
src/Routes/                  authRoute, projectRoute, taskRoute
src/controllers/             authController, projectController, taskController
src/db/index.js              PostgreSQL pool (DATABASE_URL or DB_* variables)
src/db/schema.sql            tables: users, projects, tasks
public/                      index.html and style.css (the dashboard)
```

## Run it locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a PostgreSQL database and load the tables:
   ```bash
   psql -U postgres -c "CREATE DATABASE taskflow;"
   psql -U postgres -d taskflow -f src/db/schema.sql
   ```
3. Copy `.env.example` to `.env` and fill in the values (see below).
4. Start the server:
   ```bash
   npm run dev
   ```
5. Open http://localhost:9777

## Environment variables

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Secret used to sign tokens. At least 32 characters, or the server exits at startup. |
| `PORT` | Port to listen on. Defaults to 9777 locally. Render sets it automatically. |
| `DATABASE_URL` | Full PostgreSQL connection string. Used on Render. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Local database settings, used when `DATABASE_URL` is not set. |
| `NODE_ENV` | Set to `production` on the server. |

Never commit `.env`. Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## API

Every route except register, login and health needs the header `Authorization: Bearer <token>`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in, returns a token |
| GET | `/api/auth/me` | Current user |
| GET | `/api/projects` | List projects with task and completed counts |
| POST | `/api/projects` | Create a project |
| GET | `/api/projects/:id` | Get one project |
| PUT | `/api/projects/:id` | Update a project |
| DELETE | `/api/projects/:id` | Delete a project and its tasks |
| GET | `/api/tasks` | 10 most recent tasks |
| GET | `/api/tasks/stats` | Dashboard statistics |
| POST | `/api/tasks` | Create a task |
| PATCH | `/api/tasks/:id/status` | Change a task's status |
| DELETE | `/api/tasks/:id` | Delete a task |
| GET | `/api/health` | Health check |

Errors return JSON like `{ "error": "message" }`. A resource that belongs to another user returns `404`.

## Security notes

- Passwords are hashed with bcrypt, and tokens expire after 24 hours.
- All SQL uses parameters, and every query checks ownership in the database, so one user cannot read or change another user's data.
- Login and register are rate limited, request bodies are capped at 10 KB, and `helmet` adds security headers.
- User-entered text is rendered with `textContent`, never `innerHTML`.

## Deploying to Render

1. Create a PostgreSQL database and load `src/db/schema.sql` into it.
2. Create a web service from this repository in the same region.
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/api/health`
3. Add the environment variables `DATABASE_URL` (the internal URL), `JWT_SECRET` and `NODE_ENV=production`. Do not set `PORT`.

Render runs Linux, so every import path must match the folder and file names exactly, including capital letters.

## Known limitations

- The task table shows the 10 most recent tasks only.
- The sidebar links other than Dashboard, the search box and the notification bell are not wired up yet.
- There is no task edit screen yet, only create, complete and delete.
