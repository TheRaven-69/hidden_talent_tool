import logging
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import applications, assessments, jobs, recommendations

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")

app = FastAPI(title="Hidden Talent Tool")

# All API routes live under /api (matches the Vite dev proxy)
api = APIRouter(prefix="/api")
api.include_router(jobs.router)
api.include_router(applications.router)
api.include_router(assessments.router)
api.include_router(recommendations.router)
app.include_router(api)

# Serve the built React app in production
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = DIST / path
        return FileResponse(f if f.is_file() else DIST / "index.html")
