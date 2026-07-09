# Logicopilot

Multi-tenant document-extraction + RPA data-entry platform. Three roles (Super Admin →
Tenant Admin → Operator), a no-code visual template builder, AI extraction/verification, and
automated web form entry. See the original planning docs in this folder for full product
context; this file is about **running and deploying the code**.

Current status: **Security & Access Module** built (login, roles, multi-tenant isolation).
Everything else in the 42-day plan is still to build.

```
Logicopilot/
├── backend/     FastAPI + SQLAlchemy + Alembic (Python)
├── frontend/    React + Vite + TypeScript
└── *.docx       Original planning documents
```

---

## 1. Do I need to install dependencies myself? (short answer: no, one command each)

There is **no `requirements.txt`**. This project uses `uv` for Python instead of plain `pip`.
`uv` reads `backend/pyproject.toml` (the list of packages) and `backend/uv.lock` (the exact
pinned versions) and installs everything into a private `backend/.venv` folder with **one
command**: `uv sync`. You never run `pip install` by hand.

The frontend uses plain `npm` — `frontend/package.json` lists the packages, `npm install`
installs them into `frontend/node_modules`. Same idea, different tool.

You only need to run these installs (1) the very first time, and (2) any time `pyproject.toml`
or `package.json` changes (e.g. after pulling new code that added a dependency).

---

## 2. One-time setup

### 2a. Install `uv` (Python package manager) — only needed once per machine

Check if it's already installed:

```powershell
uv --version
```

If that fails with "not recognized", install it:

```powershell
python -m pip install --user uv
```

On this machine, that installed `uv.exe` to:

```
C:\Users\abcom\AppData\Roaming\Python\Python312\Scripts\uv.exe
```

That folder is **not** on PATH by default, so either:
- **Recommended, one-time:** add it to PATH yourself — Windows Settings → "Edit environment
  variables for your account" → select `Path` → New → paste
  `C:\Users\abcom\AppData\Roaming\Python\Python312\Scripts` → OK, then open a **new**
  PowerShell window. After that, plain `uv` works everywhere.
- **Or:** use the full path every time, e.g.
  `& "C:\Users\abcom\AppData\Roaming\Python\Python312\Scripts\uv.exe" sync`

The rest of this README assumes `uv` is on PATH (option 1). If you didn't add it, prefix every
`uv ...` command below with the full path shown above.

### 2b. Backend setup

```powershell
cd C:\Users\abcom\Desktop\office\Logicopilot\backend
copy .env.example .env
uv sync
uv run alembic upgrade head
```

- `uv sync` — installs every backend dependency (FastAPI, SQLAlchemy, etc.) into `backend/.venv`.
- `uv run alembic upgrade head` — creates `backend/logicopilot.db` (a local SQLite file) with
  all the tables. You only need to re-run this when a new migration is added later.

Seed your Super Admin login (only needs doing once — nothing in the app itself can create a
Super Admin, on purpose):

```powershell
uv run python -m app.cli
```

It will prompt for email, full name, and password (typed twice to confirm).

### 2c. Frontend setup

```powershell
cd C:\Users\abcom\Desktop\office\Logicopilot\frontend
copy .env.example .env
npm install
```

That's it for one-time setup.

---

## 3. Running the project (every time you sit down to work)

You need **two terminals open at once** — one for the backend, one for the frontend. They are
two separate programs; one doesn't start the other.

### Terminal 1 — backend

```powershell
cd C:\Users\abcom\Desktop\office\Logicopilot\backend
uv run python -m app.main
```

That's it — this **is** the "just run main.py" version. It reads `app/main.py`, sees the
`if __name__ == "__main__":` block at the bottom, and starts the server.

**Why not literally `python main.py`?**
1. There is no `main.py` in the backend root — the app lives at `app/main.py`, inside the
   `app` package, so Python needs to be told "run the `app.main` module" (`python -m app.main`),
   not "run this file directly".
2. `uv run` in front means "run this using the packages installed in this project's private
   `.venv`", the same way `npm run dev` uses `frontend/node_modules` instead of some global
   install. Skipping `uv run` and typing plain `python` would use your system's global Python
   instead — which might not have the right packages at all, or (worse, and actually true on
   this machine) might have *older, slightly incompatible versions* of them from some other
   project, causing bugs that only happen on your computer and are hard to reproduce.

**What actually happens when it starts:** a FastAPI app is a set of Python functions that know
how to respond to web requests, but they don't listen on a network port by themselves — that
job belongs to a separate program called an **ASGI server**. This project uses `uvicorn` for
that. `uv run python -m app.main` starts uvicorn *for* you (I wired that up in `app/main.py`
so you don't need to remember the longer command). If you ever see instructions elsewhere
referencing it directly, this is the same thing spelled out:

```powershell
uv run uvicorn app.main:app --reload --port 8000
```

`app.main:app` = "the `app` object defined in `app/main.py`". `--reload` restarts the server
automatically whenever you save a code change, so you don't have to stop/start it by hand.

**If PowerShell says `uv : The term 'uv' is not recognized`:** you installed `uv` in this
session but haven't picked up the PATH update yet. Environment variable changes only apply to
*newly started* programs — **fully close VS Code (all windows, not just the terminal tab) and
reopen it**, since VS Code itself is what's holding the stale PATH; a new terminal tab inside
the same still-running VS Code window won't help. Then `uv --version` should work.

If you don't want to restart anything right now, run this instead — it works regardless of
PATH state:

```powershell
.\run.ps1
```

Once it's running:
- API: `http://localhost:8000`
- Interactive API docs (click-to-test every endpoint without touching the frontend):
  `http://localhost:8000/docs`

### Terminal 2 — frontend

```powershell
cd C:\Users\abcom\Desktop\office\Logicopilot\frontend
npm run dev
```

Yes — this one really is that simple. `npm run dev` looks up the `"dev"` entry in
`frontend/package.json` (it's `vite`, the frontend build tool) and starts it. Vite serves the
React app and, like `--reload` above, auto-refreshes the browser whenever you save a file.

- App: `http://localhost:5173`

### Using it

Open `http://localhost:5173` in a browser and log in with the Super Admin account you seeded
in step 2b. The frontend (5173) talks to the backend (8000) over HTTP behind the scenes — both
must be running at the same time for login to work.

To stop either one, click into that terminal and press `Ctrl+C`.

---

## 4. Running the tests

```powershell
cd C:\Users\abcom\Desktop\office\Logicopilot\backend
uv run pytest
```

23 tests currently cover login/session handling, role permissions, and — the most important
ones — that one company's data can never be seen by another company.

---

## 5. What's next (per the implementation plan)

Already built:
- [x] Security & Access Module (login, roles, tenant isolation)

Still to build, in the order the plan lays them out:
- [ ] Super Admin Panel & Onboarding Wizard (label builder, bounding-box cropper, template
      uploader, cross-document verification linker, AI prompt training loop)
- [ ] Tenant Admin Panel (operator management, formatting settings, field hints)
- [ ] Daily Operator Dashboard (transaction uploader, side-by-side extraction viewer,
      discrepancy alerts)
- [ ] AI Document Extraction Engine (Google Document AI OCR + OpenAI extraction/verification)
- [ ] RPA Web Recorder & Headless Playback (Playwright/Selenium)
- [ ] QA & cross-testing pass

---

## 6. Deploying to a VPS (not done yet — plan for when we get there)

Nothing below has been executed. This is the checklist for when we're ready to put this on a
real server, based on decisions already made (Postgres in production, SQLite only for local
dev).

### 6a. Server prerequisites (Ubuntu VPS, adjust for whatever distro is chosen)
- Python 3.12+, `uv`, Node.js + npm
- PostgreSQL server (or a managed Postgres — either works, it's just a `DATABASE_URL`)
- `nginx` (reverse proxy + TLS termination + serving the built frontend)
- `certbot` (free HTTPS certificate)

### 6b. Backend
1. Clone the repo onto the server, `cd backend`.
2. `uv sync --frozen` (installs exactly the locked versions from `uv.lock`).
3. Create `backend/.env` on the server with **production** values:
   - `DATABASE_URL=postgresql+psycopg://user:password@host:5432/logicopilot`
   - `JWT_SECRET_KEY=` — a long random string, **different from local dev**, kept secret
   - `COOKIE_SECURE=true` — required once served over HTTPS
   - `CORS_ORIGINS=` — the real frontend domain (e.g. `https://app.logicopilot.com`)
4. `uv run alembic upgrade head` — runs the exact same migrations against Postgres. No model
   or migration code changes needed; this is the entire point of building on SQLAlchemy from
   day one.
5. `uv run python -m app.cli` — seed the production Super Admin.
6. Run the API as a persistent service (don't just leave a terminal open) — a `systemd` unit
   running `uv run uvicorn app.main:app --host 127.0.0.1 --port 8000` with `Restart=always`
   is the simplest approach. `nginx` reverse-proxies `https://api.yourdomain.com` to
   `127.0.0.1:8000`.

### 6c. Frontend
1. `cd frontend`, create `.env` with `VITE_API_BASE_URL=https://api.yourdomain.com/api/v1`.
2. `npm install && npm run build` — produces a static `frontend/dist/` folder.
3. Point `nginx` at `frontend/dist/` to serve the built site directly (no Node process needed
   in production — it's just static files).

### 6d. HTTPS + domain
- Point your domain's DNS at the VPS.
- `certbot --nginx` to get and auto-renew a free TLS certificate for both the frontend and API
  domains/subdomains.

### 6e. Redis / job queue (not needed yet)
Not required for anything built so far. Gets added when we build the AI extraction pipeline
and RPA playback engine, which need a background job queue — that's the point where we'll also
decide on Docker vs. native install on the VPS.

We'll flesh this section out with exact commands once we're actually provisioning a server.
