from __future__ import annotations

import os
import sys

import httpx


def build_job_url(job_path: str) -> str:
    base_url = os.getenv("BACKEND_BASE_URL", "").rstrip("/")
    if base_url:
        return f"{base_url}{job_path}"

    hostport = os.getenv("BACKEND_HOSTPORT", "").strip()
    if hostport:
        return f"http://{hostport}{job_path}"

    raise RuntimeError("Set BACKEND_BASE_URL or BACKEND_HOSTPORT")


def main() -> int:
    if len(sys.argv) != 2 or not sys.argv[1].startswith("/jobs/"):
        print("Usage: python scripts/trigger_internal_job.py /jobs/reminders/send", file=sys.stderr)
        return 1

    reminder_secret = os.getenv("REMINDER_JOB_SECRET", "").strip()
    if not reminder_secret:
        raise RuntimeError("REMINDER_JOB_SECRET is missing")

    url = build_job_url(sys.argv[1])
    response = httpx.post(
        url,
        headers={"X-Reminder-Secret": reminder_secret},
        timeout=30.0,
    )
    response.raise_for_status()
    print(response.text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

