# AI Development Log - Uptime Pulse MVP

This log details the AI tools used, the prompts provided, the engineering problems solved, and how issues and incorrect suggestions were resolved during development.

---

## 1. AI Tools and Environment
- **AI Agent**: Antigravity IDE (Advanced Agentic Coding assistant developed by Google DeepMind)
- **Primary Models Used**: Gemini 3.5 Flash (High), Claude Opus 4.6 (Thinking)
- **Development IDE**: Antigravity IDE with system permissions for file management, terminal command execution, Docker orchestration, and browser-based UI verification.

---

## 2. Development Prompts & Flow

### Primary Prompt (Shipped the Core Application)

The following raw prompt was provided to the AI assistant to generate the full MVP:

> **Prompt:**
> "Build a complete production-quality MVP for a lightweight uptime monitoring application.
> Users can register URLs. The backend periodically checks every registered URL once every minute.
> Each health check stores: HTTP status code, Response time in milliseconds, Timestamp, Whether the URL is UP or DOWN.
> The frontend displays all monitored URLs with their latest status and response time and updates automatically.
>
> Tech Stack: Backend — Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, Axios, node-cron.
> Frontend — React, Vite, TypeScript, Tailwind CSS, Axios.
> Containerization — Docker, Docker Compose.
>
> Create Prisma models for Url (id, url, createdAt) and HealthCheck (id, urlId, statusCode, responseTime, isUp, checkedAt).
> Implement REST endpoints: POST /urls, GET /urls (with latest check), GET /urls/:id/history, DELETE /urls/:id.
> Health check rules: HTTP 2xx and 3xx = UP, network errors = DOWN, timeout after 10 seconds.
> Frontend: header, add-URL form, table with columns (URL, Status, HTTP Status, Response Time, Last Checked, Delete button), green/red status badges, auto refresh every 5 seconds, loading and error states.
> Everything must start with docker compose up --build."

### Follow-Up Prompts

- **"Check the assignment requirements against the codebase"** — Used to audit deliverables against submission criteria.
- **"Why are there errors in the IDE?"** — Diagnosed that `node_modules` were only inside Docker containers, not on the host. Resolved by running `npm install` and `npx prisma generate` locally.
- **"Why is ChatGPT showing as OFFLINE with 403?"** — Explained that Cloudflare-protected sites block automated bot requests, and a 403 is correctly classified as DOWN per the spec's rules (only 2xx/3xx = UP).

---

## 3. Problems Encountered and Resolutions

### Problem 1: Database Migration Timing in Docker Compose
- **Symptom**: If the backend container starts before PostgreSQL is fully initialized, running `prisma db push` or starting the app fails with a database connection refusal.
- **AI Suggestion**: Use basic `depends_on: [db]` in Docker Compose.
- **Why it was incorrect**: A simple `depends_on` only waits for the database container to *start*, not for PostgreSQL to initialize and listen for network requests.
- **Correction**: Introduced a PostgreSQL container `healthcheck` that runs `pg_isready` inside the container. Configured the backend service's dependency with `condition: service_healthy` to block the API service starting until the DB is fully ready.

### Problem 2: Vite Hot Module Reloading (HMR) in Docker Volumes
- **Symptom**: When editing files in a mounted local directory, Vite's dev server running inside a Docker container sometimes fails to pick up file change notifications from Windows host volumes.
- **AI Suggestion**: Run `vite` directly without any additional configurations.
- **Why it was incorrect**: On Windows host systems mounting volumes to Linux containers, standard file system watcher events (inotify) do not propagate automatically.
- **Correction**: Configured Vite's watch system to use polling by adding `watch: { usePolling: true }` in `frontend/vite.config.ts`. This ensures changes are immediately synchronized and hot-reloading is triggered on save.

### Problem 3: Axios Rejects on HTTP Error Codes (4xx/5xx)
- **Symptom**: The health checker would register a valid URL returning 500 or 404 status codes as a network error, rather than recording it as a successful request with a bad status code.
- **AI Suggestion**: Use standard `axios.get(url)` and catch error branches to read `error.response.status`.
- **Why it was incorrect**: While catching errors works, standard Axios rejects all statuses outside the 2xx range. Doing so creates unnecessary exception overhead and can group bad statuses in network error logs.
- **Correction**: Configured Axios request parameters to include `validateStatus: () => true`. This instructs Axios to resolve the promise for *any* HTTP response code (including 404, 500, etc.), allowing clean processing of the status in the main block and keeping the catch block reserved for genuine network errors or timeouts.

### Problem 4: Incorrect Prisma Client Binary Target
- **Symptom**: Docker build fails on `npx prisma generate` with `Error: Unknown binary target debian-openssl-3.0.y in generator client.`
- **AI Suggestion**: The schema configuration used `debian-openssl-3.0.y` as a binary target.
- **Why it was incorrect**: Prisma ORM uses specific versioned suffixes like `.x` (e.g., `debian-openssl-3.0.x`). The suffix `.y` is not a valid Prisma binary target identifier.
- **Correction**: Replaced `debian-openssl-3.0.y` with `debian-openssl-3.0.x` in `backend/prisma/schema.prisma` to match the actual Prisma target for Debian Bookworm slim images.

### Problem 5: TypeScript Strict Null Check Error in Cron Handler
- **Symptom**: Backend compilation fails with `src/cron.ts(55,15): error TS18047: 'statusCode' is possibly 'null'.`
- **AI Suggestion**: Assigned `statusCode = error.response.status` and then compared `statusCode >= 200` directly.
- **Why it was incorrect**: Since `statusCode` is typed as `number | null`, the TypeScript compiler does not narrow the type after assignment when `strict` mode is enabled. The subsequent comparison `statusCode >= 200` still sees the variable as potentially `null`.
- **Correction**: Declared a local `const status = error.response.status` to capture the value in a non-nullable variable, then assigned it to `statusCode` and compared the local `status` variable instead. This satisfies the strict null checker.

### Problem 6: Missing package-lock.json Breaks `npm ci` in Docker
- **Symptom**: Docker build fails with `The npm ci command can only install with an existing package-lock.json`.
- **AI Suggestion**: Use `npm ci` in Dockerfiles for reproducible installs.
- **Why it was incorrect**: `npm ci` requires a committed `package-lock.json` file, which was not present in the repository.
- **Correction**: Changed `RUN npm ci` to `RUN npm install` in both `backend/Dockerfile` and `frontend/Dockerfile`. Also changed `npm ci --only=production` to `npm install --omit=dev` in the backend production stage.

### Problem 7: POST /urls Returned Non-Standard HTTP 210 Status Code
- **Symptom**: Successful URL registration returned HTTP status code `210`, which is non-standard.
- **AI Suggestion**: Return status `210` for successful creation.
- **Why it was incorrect**: HTTP 210 is not a recognized status code. The standard code for successful resource creation is `201 Created`.
- **Correction**: Changed `res.status(210)` to `res.status(201)` in the POST handler.
