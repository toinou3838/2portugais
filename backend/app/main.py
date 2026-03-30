from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.session import SessionLocal
from app.services.quiz import ensure_default_vocabulary
from app.services.reminders import run_automatic_reminders_once

logger = logging.getLogger("app.reminders")


@asynccontextmanager
async def lifespan(_: FastAPI):
    with SessionLocal() as session:
        ensure_default_vocabulary(session)
    yield


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def automatic_reminder_middleware(request: Request, call_next):
    response = await call_next(request)

    if request.url.path in {"/health", "/jobs/reminders/send"}:
        return response

    if settings.reminder_auto_run_enabled:
        logger.info("Scheduling automatic reminder check after request path=%s", request.url.path)
        asyncio.create_task(asyncio.to_thread(run_automatic_reminders_once))

    return response

app.include_router(api_router, prefix=settings.api_prefix)
