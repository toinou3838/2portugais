from __future__ import annotations

from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.jobs import router as jobs_router
from app.api.quiz import router as quiz_router
from app.api.users import router as users_router
from app.api.vocabulary import router as vocabulary_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(users_router)
api_router.include_router(quiz_router)
api_router.include_router(vocabulary_router)
api_router.include_router(jobs_router)

