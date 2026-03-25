from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User


@dataclass
class AuthenticatedUser:
    user: User
    claims: dict[str, Any]


class ClerkTokenVerifier:
    def __init__(self) -> None:
        self.jwks_client = PyJWKClient(settings.clerk_jwks_url)

    def verify(self, token: str) -> dict[str, Any]:
        signing_key = self.jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.clerk_audience,
            issuer=settings.clerk_issuer,
        )


token_verifier = ClerkTokenVerifier()


def _extract_email(payload: dict[str, Any] | None, claims: dict[str, Any]) -> str:
    if payload:
        email_addresses = payload.get("email_addresses") or []
        if email_addresses:
            return email_addresses[0].get("email_address") or claims.get("email") or ""
    return claims.get("email") or claims.get("email_address") or ""


def _extract_display_name(payload: dict[str, Any] | None, claims: dict[str, Any]) -> str | None:
    if payload:
        first_name = payload.get("first_name") or ""
        last_name = payload.get("last_name") or ""
        full_name = f"{first_name} {last_name}".strip()
        if full_name:
            return full_name
        if payload.get("username"):
            return payload["username"]
    return claims.get("name") or claims.get("username")


def _extract_avatar(payload: dict[str, Any] | None, claims: dict[str, Any]) -> str | None:
    if payload and payload.get("image_url"):
        return payload["image_url"]
    return claims.get("image_url") or claims.get("picture")


def fetch_clerk_user(clerk_user_id: str) -> dict[str, Any] | None:
    if not settings.clerk_secret_key:
        return None

    try:
        response = httpx.get(
            f"{settings.clerk_api_base_url}/users/{clerk_user_id}",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError:
        return None


def provision_user_from_claims(db: Session, claims: dict[str, Any]) -> User:
    clerk_user_id = claims.get("sub")
    if not clerk_user_id:
        raise ValueError("Clerk token missing subject")

    user = db.scalar(select(User).where(User.clerk_user_id == clerk_user_id))
    clerk_payload = fetch_clerk_user(clerk_user_id)

    email = _extract_email(clerk_payload, claims)
    display_name = _extract_display_name(clerk_payload, claims)
    avatar_url = _extract_avatar(clerk_payload, claims)

    if user is None:
        user = User(
            clerk_user_id=clerk_user_id,
            email=email or f"{clerk_user_id}@unknown.local",
            display_name=display_name,
            avatar_url=avatar_url,
        )
        db.add(user)
    else:
        if email:
            user.email = email
        user.display_name = display_name or user.display_name
        user.avatar_url = avatar_url or user.avatar_url

    db.commit()
    db.refresh(user)
    return user
