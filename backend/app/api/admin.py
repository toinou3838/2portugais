from __future__ import annotations

import csv
from datetime import datetime, timedelta
from io import StringIO
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import verify_admin_code
from app.core.config import settings
from app.db.session import get_db
from app.models.daily_progress import DailyProgress
from app.models.user import User
from app.models.vocabulary_entry import VocabularyEntry
from app.schemas.admin import (
    AdminBulkImportIn,
    AdminBulkImportOut,
    AdminConjugationRow,
    AdminDashboardOut,
    AdminPairUpdateIn,
    AdminPeriodStats,
    AdminReminderRow,
    AdminUserRow,
    AdminVerifyOut,
    AdminVocabularyRow,
)
from app.services.progress import compute_current_streak
from app.services.quiz import (
    create_custom_quiz_entry,
    delete_vocabulary_entry_everywhere,
    hide_conjugation_entry,
    infer_difficulty_from_text,
    load_visible_conjugation_entries,
    load_visible_vocabulary_entries,
    update_custom_quiz_entry,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(verify_admin_code)])


def _build_period_stats(
    entries: list[DailyProgress],
    *,
    period_start,
    period_end,
) -> AdminPeriodStats:
    relevant_entries = [entry for entry in entries if period_start <= entry.day <= period_end]
    return AdminPeriodStats(
        period_start=period_start,
        period_end=period_end,
        answered_questions=sum(entry.answered_questions for entry in relevant_entries),
        correct_answers=sum(entry.correct_answers for entry in relevant_entries),
        quizzes_completed=sum(entry.quizzes_completed for entry in relevant_entries),
        goal_reached_count=sum(1 for entry in relevant_entries if entry.goal_reached),
        reminders_sent_count=sum(1 for entry in relevant_entries if entry.reminder_sent_at is not None),
    )


@router.get("/verify", response_model=AdminVerifyOut)
def verify_admin_access() -> AdminVerifyOut:
    return AdminVerifyOut(ok=True)


@router.get("/dashboard", response_model=AdminDashboardOut)
def read_admin_dashboard(
    db: Annotated[Session, Depends(get_db)],
) -> AdminDashboardOut:
    conjugations = [
        AdminConjugationRow(
            id=str(item["id"]),
            fr=str(item["fr"]),
            pt=str(item["pt"]),
            dir=int(item["dir"]),
            difficulty=int(item.get("difficulty", 2)),
            source=str(item.get("source", "conjugaison")),
            record_type=str(item.get("record_type", "bundled")),
            linked_entry_id=(
                int(item["linked_entry_id"]) if item.get("linked_entry_id") is not None else None
            ),
            created_at=datetime.fromisoformat(str(item["created_at"]))
            if item.get("created_at")
            else None,
        )
        for item in load_visible_conjugation_entries(db)
    ]

    user_rows = db.scalars(select(User).order_by(User.updated_at.desc(), User.id.desc())).all()
    user_display_names = {
        user.id: user.display_name or user.email or f"Utilisateur #{user.id}" for user in user_rows
    }

    vocabulary_entries = db.scalars(
        select(VocabularyEntry)
        .where(VocabularyEntry.source == "vocab")
        .order_by(VocabularyEntry.created_at.desc(), VocabularyEntry.id.desc())
    ).all()
    vocabulary = [
        AdminVocabularyRow(
            id=entry.id,
            fr=entry.fr,
            pt=entry.pt,
            dir=entry.dir,
            difficulty=entry.difficulty,
            source=entry.source,
            created_by_user_id=entry.created_by_user_id,
            created_by_display_name=(
                "Système"
                if entry.created_by_user_id is None
                else user_display_names.get(entry.created_by_user_id, "Utilisateur inconnu")
            ),
            created_at=entry.created_at,
        )
        for entry in vocabulary_entries
    ]

    users: list[AdminUserRow] = []
    pending_reminders: list[AdminReminderRow] = []
    today = datetime.now().date()
    week_start = today - timedelta(days=6)
    month_start = today - timedelta(days=29)
    progress_rows = db.scalars(
        select(DailyProgress).where(DailyProgress.day >= month_start)
    ).all()
    progress_by_user: dict[int, list[DailyProgress]] = {}
    for progress in progress_rows:
        progress_by_user.setdefault(progress.user_id, []).append(progress)

    for user in user_rows:
        user_progress_entries = progress_by_user.get(user.id, [])
        day_stats = _build_period_stats(
            user_progress_entries,
            period_start=today,
            period_end=today,
        )
        week_stats = _build_period_stats(
            user_progress_entries,
            period_start=week_start,
            period_end=today,
        )
        month_stats = _build_period_stats(
            user_progress_entries,
            period_start=month_start,
            period_end=today,
        )

        day_entries = [entry for entry in user_progress_entries if entry.day == today]
        today_answered_questions = day_stats.answered_questions
        today_correct_answers = day_stats.correct_answers
        today_quizzes_completed = day_stats.quizzes_completed
        today_goal_reached = day_stats.goal_reached_count > 0
        today_reminder_sent_at = max(
            (entry.reminder_sent_at for entry in day_entries if entry.reminder_sent_at is not None),
            default=None,
        )
        today_day = today
        streak = compute_current_streak(db, user)
        users.append(
            AdminUserRow(
                id=user.id,
                clerk_user_id=user.clerk_user_id,
                email=user.email,
                display_name=user.display_name,
                reminder_opt_in=user.reminder_opt_in,
                current_streak=streak,
                today_day=today_day,
                today_answered_questions=today_answered_questions,
                today_correct_answers=today_correct_answers,
                today_quizzes_completed=today_quizzes_completed,
                today_goal_reached=today_goal_reached,
                today_reminder_sent_at=today_reminder_sent_at,
                created_at=user.created_at,
                updated_at=user.updated_at,
                day_stats=day_stats,
                week_stats=week_stats,
                month_stats=month_stats,
            )
        )

        if user.reminder_opt_in and not today_goal_reached and today_reminder_sent_at is None:
            pending_reminders.append(
                AdminReminderRow(
                    id=user.id,
                    email=user.email,
                    display_name=user.display_name,
                    current_streak=streak,
                    answered_questions=today_answered_questions,
                    remaining_questions=max(settings.reminder_goal - today_answered_questions, 0),
                    reminder_opt_in=user.reminder_opt_in,
                    reminder_sent_at=today_reminder_sent_at,
                    goal_reached=today_goal_reached,
                    day=today_day,
                )
            )

    pending_reminders.sort(key=lambda row: (row.remaining_questions, -row.current_streak, row.email))

    return AdminDashboardOut(
        conjugations=conjugations,
        vocabulary=vocabulary,
        users=users,
        pending_reminders=pending_reminders,
    )


@router.delete("/vocabulary/{entry_id}")
def delete_vocabulary_row(
    entry_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, bool]:
    entry = db.get(VocabularyEntry, entry_id)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entrée de vocabulaire introuvable.",
        )

    delete_vocabulary_entry_everywhere(db, entry)
    return {"ok": True}


@router.patch("/vocabulary/{entry_id}")
def update_vocabulary_row(
    entry_id: int,
    payload: AdminPairUpdateIn,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, bool]:
    entry = db.get(VocabularyEntry, entry_id)
    if entry is None or entry.source != "vocab":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entrée de vocabulaire introuvable.",
        )

    duplicate = db.scalar(
        select(VocabularyEntry).where(
            VocabularyEntry.id != entry.id,
            VocabularyEntry.source == "vocab",
            func.lower(VocabularyEntry.fr) == payload.fr.strip().lower(),
            func.lower(VocabularyEntry.pt) == payload.pt.strip().lower(),
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cette paire existe déjà dans la base de vocabulaire.",
        )

    update_custom_quiz_entry(db, entry, fr=payload.fr, pt=payload.pt)
    db.commit()
    return {"ok": True}


@router.delete("/conjugations/{entry_id}")
def delete_conjugation_row(
    entry_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, bool]:
    hide_conjugation_entry(db, entry_id)
    return {"ok": True}


@router.patch("/conjugations/{entry_id}")
def update_conjugation_row(
    entry_id: str,
    payload: AdminPairUpdateIn,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, bool]:
    if payload.dir is None or payload.difficulty is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La direction et la difficulté sont requises pour modifier une conjugaison.",
        )

    if entry_id.startswith("conjdb-"):
        custom_id = int(entry_id.replace("conjdb-", ""))
        entry = db.get(VocabularyEntry, custom_id)
        if entry is None or entry.source != "conjugaison":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Entrée de conjugaison introuvable.",
            )
        update_custom_quiz_entry(db, entry, fr=payload.fr, pt=payload.pt)
        entry.dir = payload.dir
        entry.difficulty = payload.difficulty
        db.add(entry)
        db.commit()
        return {"ok": True}

    hide_conjugation_entry(db, entry_id)
    create_custom_quiz_entry(
        db,
        fr=payload.fr,
        pt=payload.pt,
        source="conjugaison",
        difficulty=payload.difficulty,
        dir=payload.dir,
    )
    db.commit()
    return {"ok": True}


def _normalize_target(raw_value: str) -> str:
    normalized = raw_value.strip().lower()
    mapping = {
        "vocab": "vocab",
        "vocabulaire": "vocab",
        "vocabulary": "vocab",
        "conjugaison": "conjugaison",
        "conjugation": "conjugaison",
        "verbe": "conjugaison",
        "verbes": "conjugaison",
    }
    if normalized not in mapping:
        raise ValueError(f"Emplacement inconnu: {raw_value}")
    return mapping[normalized]


def _parse_difficulty(value: str | None, fr: str) -> int:
    if not value:
        return infer_difficulty_from_text(fr)

    normalized = value.strip().lower()
    mapping = {
        "1": 1,
        "facile": 1,
        "easy": 1,
        "2": 2,
        "intermediaire": 2,
        "intermédiaire": 2,
        "medium": 2,
        "3": 3,
        "difficile": 3,
        "hard": 3,
    }
    if normalized not in mapping:
        return infer_difficulty_from_text(fr)
    return mapping[normalized]


@router.post("/import", response_model=AdminBulkImportOut)
def bulk_import_pairs(
    payload: AdminBulkImportIn,
    db: Annotated[Session, Depends(get_db)],
) -> AdminBulkImportOut:
    def detail_for_row(index: int, fr: str, pt: str, reason: str) -> str:
        left = fr.strip() or "?"
        right = pt.strip() or "?"
        return f"Ligne {index} : {left} = {right} : {reason}"

    raw_text = payload.raw_text.strip()
    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le bloc CSV est vide.",
        )

    try:
        dialect = csv.Sniffer().sniff(raw_text[:1024], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
        dialect.delimiter = ";"

    reader = csv.reader(StringIO(raw_text), dialect)
    rows = [row for row in reader if any(cell.strip() for cell in row)]
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune ligne exploitable n’a été détectée.",
        )

    header = [cell.strip().lower() for cell in rows[0]]
    has_header = "francais" in header or "français" in header or "portugais" in header
    data_rows = rows[1:] if has_header else rows

    imported = 0
    skipped = 0
    details: list[str] = []

    for index, row in enumerate(data_rows, start=2 if has_header else 1):
        cleaned = [cell.strip() for cell in row]
        if has_header:
            row_map = {header[col_index]: cleaned[col_index] for col_index in range(min(len(header), len(cleaned)))}
            fr = row_map.get("français") or row_map.get("francais") or ""
            pt = row_map.get("portugais") or ""
            target = row_map.get("emplacement") or row_map.get("source") or ""
            difficulty = row_map.get("difficulté") or row_map.get("difficulte")
        else:
            if len(cleaned) < 3:
                skipped += 1
                fr = cleaned[0] if len(cleaned) > 0 else ""
                pt = cleaned[1] if len(cleaned) > 1 else ""
                details.append(detail_for_row(index, fr, pt, "colonnes insuffisantes"))
                continue
            fr, pt, target = cleaned[:3]
            difficulty = cleaned[3] if len(cleaned) > 3 else None

        if not fr or not pt or not target:
            skipped += 1
            details.append(detail_for_row(index, fr, pt, "colonnes obligatoires manquantes"))
            continue

        try:
            normalized_target = _normalize_target(target)
            parsed_difficulty = _parse_difficulty(difficulty, fr)
        except ValueError as exc:
            skipped += 1
            details.append(detail_for_row(index, fr, pt, str(exc)))
            continue

        duplicate = db.scalar(
            select(VocabularyEntry).where(
                VocabularyEntry.source == normalized_target,
                func.lower(VocabularyEntry.fr) == fr.strip().lower(),
                func.lower(VocabularyEntry.pt) == pt.strip().lower(),
            )
        )
        if duplicate is not None:
            skipped += 1
            details.append(detail_for_row(index, fr, pt, "paire déjà présente"))
            continue

        create_custom_quiz_entry(
            db,
            fr=fr,
            pt=pt,
            source=normalized_target,
            difficulty=parsed_difficulty,
            dir=None,
        )
        imported += 1

    db.commit()
    return AdminBulkImportOut(imported=imported, skipped=skipped, details=details[:20])
