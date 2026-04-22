"""FastAPI app factory."""
from __future__ import annotations

from fastapi import FastAPI

from api.settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Return a FastAPI app configured from `settings`.

    Routes are registered here. Tests create a fresh app with
    overridden dependencies via `app.dependency_overrides`.
    """
    _settings = settings or Settings()
    app = FastAPI(title="Satellite Visibility", version="0.2.0")

    @app.get("/health")
    def health() -> dict[str, str]:
        """Liveness probe — always returns {status: ok}."""
        return {"status": "ok"}

    # Route modules register themselves here (later tasks).
    # from api.routes import passes, sky_track, horizon, tle_freshness
    # app.include_router(passes.router)
    # ...

    app.state.settings = _settings
    return app
