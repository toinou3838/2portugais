from __future__ import annotations

import json
import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.vocabulary_entry import VocabularyEntry


def google_sheets_enabled() -> bool:
    return bool(
        settings.google_sheets_enabled
        and settings.google_sheet_id
        and settings.google_service_account_json
    )


def sync_google_sheet_vocabulary(db: Session) -> dict[str, int | bool]:
    if not google_sheets_enabled():
        return {"enabled": False, "imported": 0, "skipped": 0}

    import gspread
    from google.oauth2.service_account import Credentials

    credentials = Credentials.from_service_account_info(
        json.loads(settings.google_service_account_json),
        scopes=[
            "https://www.googleapis.com/auth/spreadsheets.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
        ],
    )

    client = gspread.authorize(credentials)
    worksheet = client.open_by_key(settings.google_sheet_id).worksheet(settings.google_sheet_name)
    rows = worksheet.get_all_records()

    existing_pairs = {
        (entry.fr.lower(), entry.pt.lower())
        for entry in db.scalars(select(VocabularyEntry)).all()
    }

    imported = 0
    skipped = 0

    for row in rows:
        fr = str(row.get("fr", "")).strip().lower()
        pt = str(row.get("pt", "")).strip().lower()
        if not fr or not pt or (fr, pt) in existing_pairs:
            skipped += 1
            continue

        db.add(
            VocabularyEntry(
                fr=fr,
                pt=pt,
                dir=random.choice([0, 1]),
                source="vocab",
            )
        )
        existing_pairs.add((fr, pt))
        imported += 1

    db.commit()
    return {"enabled": True, "imported": imported, "skipped": skipped}

