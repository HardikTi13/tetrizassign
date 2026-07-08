# AI Collaboration Log — Uptime Pulse MVP

This document describes how AI tooling was used as a **thinking partner** throughout the development of this project — for brainstorming architecture, breaking the work into manageable pieces, and validating the final codebase against the assignment rubric.

---

## 1. AI Tools Used

- **Antigravity IDE** (Google DeepMind) — primary development environment
- **Models consulted**: Gemini 3.5 Flash, Claude Opus 4.6
- Used for: architectural brainstorming, task decomposition, debugging assistance, and final codebase review

---

## 2. How AI Was Used in the Development Workflow

### Phase 1: Brainstorming & Architecture Planning

Before writing any code, I used the AI assistant to think through the system design and make technology decisions. The conversation went roughly like this:

> **Me:** "I need to build a lightweight uptime monitor — backend pings a list of URLs every minute, stores status codes and response times, frontend shows a live dashboard. What's a clean, minimal stack for this that I can containerize easily?"

The AI helped me evaluate trade-offs between different approaches:
- **Express vs. Fastify** for the API layer — went with Express for ecosystem maturity and middleware simplicity.
- **Prisma vs. raw SQL** — chose Prisma for type-safe queries and easy schema migrations, which saves time on an MVP.
- **node-cron vs. Bull/BullMQ** — node-cron was the right fit since we don't need distributed job queues at MVP scale.
- **Polling vs. WebSockets** on the frontend — chose polling (5-second interval) since it's simpler and sufficient for a dashboard with ~dozens of URLs.

### Phase 2: Breaking the Project into Tasks

I asked the AI to help me decompose the project into a logical build order so I wouldn't get stuck context-switching:

> **Me:** "Help me break this into an ordered task list — what should I build first, and what depends on what?"

The AI suggested the following sequence, which I followed:
1. Define the Prisma schema (`Url` and `HealthCheck` models)
2. Set up the Express server with CRUD routes
3. Implement the health check logic with Axios + node-cron
4. Wire up PostgreSQL via Docker Compose with health checks
5. Build the React frontend with Vite
6. Connect frontend to backend API
7. Add the Docker Compose orchestration for all three services
8. Write the deployment sketch and documentation

This ordering made development smooth — each step had its dependencies already in place.

### Phase 3: Targeted Debugging Assistance

During development, I hit a few specific issues where I consulted the AI for a second opinion:

**Issue 1 — Axios rejecting 4xx/5xx responses:**
My health checker was throwing exceptions for URLs returning 500 or 404. I knew Axios rejects non-2xx by default but wasn't sure of the cleanest fix. The AI confirmed using `validateStatus: () => true` to resolve all HTTP responses, keeping the `catch` block reserved for genuine network failures.

**Issue 2 — Docker Compose startup ordering:**
The backend was crashing because PostgreSQL wasn't ready when `prisma db push` ran. I knew about `depends_on` but wasn't aware of the `condition: service_healthy` syntax with `pg_isready`. The AI pointed me to the correct health check configuration.

**Issue 3 — Vite HMR not working in Docker on Windows:**
File changes weren't triggering hot reload in the containerized Vite dev server. The AI explained that Windows-to-Linux volume mounts don't propagate inotify events and suggested `watch: { usePolling: true }` in the Vite config.

**Issue 4 — Prisma binary target for Docker:**
The Docker build failed because I initially had an incorrect binary target string in `schema.prisma`. The AI helped me identify that the correct target for the `node:20-slim` (Debian Bookworm) image is `debian-openssl-3.0.x`.

**Issue 5 — TypeScript strict null check in cron handler:**
A `statusCode` variable typed as `number | null` wasn't narrowing properly after assignment. The AI suggested using a separate `const` to capture the value, which satisfies the strict null checker cleanly.

### Phase 4: Final Codebase Review & Scoring

After completing the implementation, I used the AI to do a full audit of the codebase against the assignment requirements:

> **Me:** "Check the assignment requirements against the codebase and score how complete it is."

The AI reviewed every deliverable:
- ✅ Backend API — all endpoints implemented, health check logic correct
- ✅ Frontend UI — dashboard with live status, history modal, add/delete functionality
- ✅ Containerization — `docker compose up --build` works end-to-end
- ✅ Deployment Sketch — AWS architecture with Terraform IaC
- ✅ AI Log — documented (this file)
- ✅ Verification steps — README covers UP and DOWN test cases

This review helped me catch a couple of gaps I'd missed, like adding the `.env.example` file and ensuring the README documented the exact test URLs.

---

## 3. What AI Did NOT Do

To be clear about the boundaries of AI involvement:

- **All application code was written by hand** — the Express routes, Prisma schema, cron logic, React components, and Docker configurations.
- **AI was not used to generate the codebase**. It was used to plan the architecture, break down tasks, debug specific issues, and verify completeness.
- **Design decisions were mine** — the choice of glassmorphism UI, the 5-second polling interval, the cascade delete strategy, and the multi-stage Docker build for the backend.

---

## 4. Reflection

The most valuable use of AI in this project was **task decomposition** — having a structured build order before touching any code meant I could move fast without backtracking. The debugging assistance was also useful for Docker/platform-specific issues (Windows volume mounts, Prisma binary targets) that would have taken longer to diagnose through documentation alone.
