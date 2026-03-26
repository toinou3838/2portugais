from __future__ import annotations

import os
import subprocess
import sys


def run(command: list[str]) -> None:
    result = subprocess.run(command, check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def main() -> int:
    # Free Render web services do not expose a pre-deploy hook, so we migrate
    # immediately before booting the API process.
    run(["alembic", "upgrade", "head"])

    port = os.getenv("PORT", "10000")
    os.execvp(
        "uvicorn",
        [
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            port,
        ],
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

