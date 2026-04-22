"""FastAPI app factory."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from api.routes.catalog import router as catalog_router
from api.routes.horizon import router as horizon_router
from api.routes.passes import router as passes_router
from api.routes.sky_track import router as sky_track_router
from api.routes.tle_freshness import router as tle_freshness_router
from api.settings import Settings
from core.catalog.celestrak import CelestrakError
from core.terrain.opentopo import OpenTopoError


def create_app(settings: Settings | None = None) -> FastAPI:
    """Return a FastAPI app configured from `settings`."""
    _settings = settings or Settings()
    app = FastAPI(title="Satellite Visibility", version="0.2.0")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.exception_handler(OpenTopoError)
    async def _opentopo_error_handler(request: Request, exc: OpenTopoError) -> JSONResponse:
        """Surface OpenTopography fetch / config failures with the underlying message.

        Most common trigger: `SATVIS_OPENTOPOGRAPHY_API_KEY` not set. Without it the
        generic FastAPI 500 handler would return "Internal Server Error" with no
        indication that a config fix is required.
        """
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    @app.exception_handler(CelestrakError)
    async def _celestrak_error_handler(request: Request, exc: CelestrakError) -> JSONResponse:
        """Surface Celestrak fetch failures with the underlying message."""
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    app.include_router(catalog_router)
    app.include_router(horizon_router)
    app.include_router(passes_router)
    app.include_router(sky_track_router)
    app.include_router(tle_freshness_router)

    app.state.settings = _settings
    return app
