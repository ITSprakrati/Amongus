# Free way to run EvalOS "deployed and connected"

The production stack (Postgres + Redis + MinIO + Celery + backend + frontend) needs a VM.
**Lite mode** runs everything in ONE process/container, so the frontend and API share one URL:

| | Full stack (`docker-compose.yml`) | Lite mode (this doc) |
|---|---|---|
| Database | PostgreSQL | SQLite file |
| Files | MinIO / S3 | local folder |
| Async OCR | Celery worker + Redis | same task, run inline |
| Frontend | nginx :3000, calls API on :8000 | served by FastAPI, same origin (no CORS / no `VITE_API_URL` issue) |
| Cost | a VM | $0 |

Same code, same golden path, same honest UNAVAILABLE states. It is switched on by `EVALOS_LITE=1`
(the Postgres stack behaves exactly as before when the variable is absent).
**Trade-off:** SQLite/local files are ephemeral on free hosts — data resets when the container
restarts. The golden-path assessment is re-provisioned on every boot, so the demo always starts clean.
Single examiner / single user only (same as the full stack).

## Option 1 — your laptop, no Docker (most reliable for a live demo)
```bash
./run_lite.sh                # http://localhost:8000   (first run builds the frontend)
```
Needs python3 and node 18+. Optional: `tesseract-ocr` for scanned PDFs.

To give judges a public link from your laptop, for free and with no account:
```bash
cloudflared tunnel --url http://localhost:8000     # prints https://<random>.trycloudflare.com
```
(`ngrok http 8000` works too.) Because the frontend and API are the same origin, that one URL is
all that is needed. *Not verified in my sandbox (no access to Cloudflare) — standard usage.*

## Option 2 — Hugging Face Spaces (free CPU, Docker)
1. New Space → SDK **Docker** → push this repo.
2. Put this block at the very top of the Space's `README.md`:
   ```
   ---
   title: EvalOS
   sdk: docker
   app_port: 7860
   ---
   ```
3. The root `Dockerfile` is the lite image (port 7860). Open the Space URL when the build finishes.

## Option 3 — Render (free web service, Docker)
New → Blueprint → point at the repo (`render.yaml` is included). Free services sleep when idle
and cold-start in about a minute — open the URL a few minutes before presenting.

> Free-tier limits change; check the provider's current terms. **I could not build the Docker image or
> deploy to Hugging Face/Render from my sandbox** — what I did verify is listed in the report:
> the same code path ran with the project's pinned requirements, SQLite, local storage, inline tasks,
> with Redis and MinIO stopped, serving the built frontend from FastAPI.

## Demo script (~2 minutes) — files in `demo_assets/`
1. **Stage 01 Upload** → upload `sample_unparseable_scheme.pdf` as the Marking Scheme →
   tile shows *"parsing unavailable, using provisioned assessment"* (the honest fallback).
2. Upload `sample_marking_scheme.pdf` instead → *"Marking scheme: 6 questions parsed"*.
   Upload `sample_answer_script.pdf` as the Answer Script → **Initialize**.
3. **Stage 02/03** OCR → categorisation (honestly `REVIEW REQUIRED`: no semantic model configured).
4. **Stage 04** the examiner workspace now lists the six parsed questions (max marks 4/6/5/5/6/4).
   Mark them, enter a *Recorded Total* that differs from the sum (e.g. 29 vs 30) →
   **Verify** flags `TOTAL_MISMATCH` → **Moderation** resolves the real case → **Result** (from the DB).
5. Run the `sample_marking_scheme.pdf` upload again → *"matching assessment re-activated"* (no duplicate).

Regenerate the PDFs with `python3 demo_assets/make_demo_pdfs.py` (needs `reportlab`).
