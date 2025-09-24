# NeuroNews
One-liner: a newsroom assistant that monitors RSS sources, generates AI drafts, and adds accessibility (audio & voice controls) to speed up publishing.

**Track:** STEPPE  
**Team Name:** NeuroNews

---

## 1. Project Overview
NeuroNews reduces the time to publish by automating source monitoring, first-draft writing, and formatting. Editors stay “in the loop”: they receive an AI draft and keep final control. Target time per story: ~15–25 minutes (vs ~60–90).

## 2. Problem & Goal
- **Problem.** Newsrooms spend too much time on routine monitoring and rewriting; publications are delayed.  
- **Why it matters.** Automation cuts routine and increases throughput 2–3× while preserving quality via editor review.  
- **Goal (KPI).** Reduce the end‑to‑end cycle **from ~60–90 min to ~15–25 min** per story.

## 3. Technical Approach
Single Django project (backend **and** frontend via templates). Background jobs with **Celery**; **Redis** as broker/cache; content in **SQLite** (for local development). Integrated LLM for drafting; text‑to‑speech and a voice assistant for accessibility.

### 3.1 Architecture
Sources (RSS) → parsing/normalization (Celery Beat) → LLM draft generation → editor review (Django UI) → publish (web + optional audio).

### 3.2 Key Technologies
- **Backend:** Django  
- **Frontend:** Django Templates (HTMX/JS if needed)  
- **Databases/Storage:** SQLite (content), Redis (cache & Celery broker)  
- **Messaging/Queue:** Celery (workers + Beat)  
- **Infrastructure/Hosting:** **Local Django server** (`runserver`), Redis running locally

### 3.3 Main Modules / Components
- **Sources & Ingestion:** manage RSS, schedule fetch (Beat), parse/deduplicate.  
- **AI Drafting:** category‑specific prompts; generate headline/lede/body; editor approval.  
- **Accessibility & Voice:** themes/contrast/zoom, hide images, **TTS for articles and voice control**.

## 4. Use of LLaMA / AI
- **Models:** Llama 3.x or a compatible hosted LLM (via API).  
- **Integration:** server‑side Celery tasks for generation/summary and post‑processing.  
- **Approach:** short prompt templates by category; optional retrieval for facts (RAG).  
- **Safety & quality:** editor‑in‑the‑loop, style constraints, basic fact control.

## 5. Data & Pipelines (no public API details)
- **Core schema:**  
  `Source(id, name, rss_url, lang, priority, enabled)` →  
  `Item(id, source_id, guid, title, link, fetched_at, status)` →  
  `Draft(id, item_id, title, summary, body, quality_score)` →  
  `Article(id, draft_id, slug, published_at, audio_url)`  
- **Pipeline:** collect RSS → clean → enqueue tasks → AI draft → editor review → publish (page + optional audio).

## 6. Demo Instructions (local only)

### 6.1 Clone & virtual environment
```bash
git clone <repo>
cd <repo>

python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows (PowerShell)
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

### 6.2 Migrations and superuser
```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

### 6.3 Redis (local)
Install and run Redis locally.
- macOS (Homebrew): `brew install redis && brew services start redis`
- Ubuntu/Debian: `sudo apt-get install redis-server && sudo systemctl enable --now redis`
- Windows: install Redis (MSI/WSL) and start the service.
Check: `redis-cli ping` should return `PONG`.

### 6.4 Celery (separate terminals)
```bash
# worker
python -m celery -A steppe_clone worker -l INFO -P solo

# beat (scheduler)
python -m celery -A steppe_clone beat -l INFO
```

### 6.4.2 Environment variables (.env)
Create a .env file in the root of the project and add:
```bash
DJANGO_SECRET_KEY='django-insecure-k$_xsw60&x2f7lun*#zfduh++su_)gr0*o54tbz@rwd7+q-=fm'
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=*
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=gemma3:12b
LLM_API_KEY=ollama
```
Note: The DJANGO_SECRET_KEY value is enclosed in quotation marks to ensure correct parsing of the $ and # symbols.

### 6.4.3 Install Ollama and download model
1) Download and install Ollama: https://ollama.ai/download
2) Download the gemma3:12b model:
```bash
ollama pull gemma3:12b
```

If the service doesn't start automatically on Linux, run: ollama serve &

### 6.5 Run Django
```bash
python manage.py runserver
```
Open `http://127.0.0.1:8000/admin/`, log in with the superuser, and manage sources/content via the admin.



### 6.6 Sign in to the admin
- Open `http://127.0.0.1:8000/admin/`.
- Log in using the superuser credentials created in **6.2**.
- You should now see access to the editorial sections (e.g., “Sources”, “Inbox”).

### 6.7 Add an RSS source
- Open `http://127.0.0.1:8000/studio/sources/`.
- Add a new source (name, language).
- Paste the RSS URL, e.g. `https://feeds.bbci.co.uk/russian/rss.xml` (or any other valid RSS feed).
- Save — Celery/Beat will ingest it on schedule.

### 6.8 Generate drafts from Inbox
- Open `http://127.0.0.1:8000/studio/inbox/`.
- New items from your sources will appear here; you can generate news/drafts from selected inbox items.



### 6.9 Publish and view
- On the draft/editor page, click **Publish**.
- Open `http://127.0.0.1:8000/news/` to see the published article.

## 7. Team Roles
- Stas Kirichenko — Founder (Project Manager)
- Islam Kulenov — Developer (Backend)
- Umurzakh Nurdaulet — Developer (Frontend)

## 8. Next Steps
- Improve AI draft quality and category templates;
- Ship podcast RSS + web audio player;
- Extend voice assistant to full‑site control;
- RU/KZ → EN auto‑translation, Telegram autoposting;
- Prepare external pilot with editorial partners.
