from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.services.clerk import AuthenticatedUser, provision_user_from_claims, token_verifier

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_auth_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> AuthenticatedUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Clerk token")

    try:
        claims = token_verifier.verify(credentials.credentials)
        user = provision_user_from_claims(db, claims)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Clerk token",
        ) from exc

    return AuthenticatedUser(user=user, claims=claims)


def get_optional_auth_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> AuthenticatedUser | None:
    if credentials is None:
        return None

    try:
        claims = token_verifier.verify(credentials.credentials)
        user = provision_user_from_claims(db, claims)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Clerk token",
        ) from exc

    return AuthenticatedUser(user=user, claims=claims)


def verify_job_secret(
    reminder_secret: Annotated[str | None, Header(alias="X-Reminder-Secret")] = None,
) -> None:
    if not settings.reminder_job_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Reminder job secret not configured",
        )
    if reminder_secret != settings.reminder_job_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid reminder secret",
        )


def verify_admin_code(
    admin_code: Annotated[str | None, Header(alias="X-Admin-Code")] = None,
) -> None:
    if not settings.admin_access_code:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin access code not configured",
        )
    if admin_code != settings.admin_access_code:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin code",
        )
