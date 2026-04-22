"""FastAPI app factory."""
from __future__ import annotations

from fastapi import FastAPI

from api.routes.passes import router as passes_router
from api.routes.sky_track import router as sky_track_router
from api.settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Return a FastAPI app configured from `settings`."""
    _settings = settings or Settings()
    app = FastAPI(title="Satellite Visibility", version="0.2.0")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(passes_router)
    app.include_router(sky_track_router)

    app.state.settings = _settings
    return app
