from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api.routes import router
from app.api.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist
    await init_db()
    yield
    # Shutdown


app = FastAPI(
    title="Valvix API",
    description="Steam Library Analytics, Co-op Matcher, and AI Persona Engine",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS setup (strip trailing slashes so exact origin matching works reliably in production)
origins = list({
    settings.FRONTEND_URL.rstrip("/"),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(auth_router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "valvix-backend",
        "version": "1.0.0",
        "database": settings.DATABASE_URL.split("://")[0],
    }
