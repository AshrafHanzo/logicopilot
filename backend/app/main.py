from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import app.db.base  # noqa: F401  (registers all models with the ORM mapper before first query)
from app.api.v1 import api_router
from app.core.config import get_settings

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Logicopilot API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def require_custom_header_on_mutations(request: Request, call_next):
        """Cheap CSRF mitigation alongside SameSite=Lax cookies: a cross-site form POST
        cannot set custom headers, so a same-origin XHR/fetch header is required here."""
        if request.method in MUTATING_METHODS and "x-requested-with" not in request.headers:
            return JSONResponse(status_code=403, content={"detail": "Missing required header"})
        return await call_next(request)

    app.include_router(api_router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()


if __name__ == "__main__":
    # Lets you run this file directly (`uv run python -m app.main`) instead of typing out
    # the full `uvicorn app.main:app --reload --port 8000` command every time.
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
