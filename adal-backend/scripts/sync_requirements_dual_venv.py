#!/usr/bin/env python3
"""Install backend requirements into both local virtual environments.

Default behavior (`mirror` mode): install both requirements files into both envs,
so adding a package to either file can be applied to both environments with one run.

Environment conventions:
- Windows/main: `venv`
- WSL/Codex: `adal`
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path
from typing import Iterable, List


def echo(message: str) -> None:
    print(f"[sync-requirements] {message}")


def run(cmd: List[str], cwd: Path, strict: bool) -> bool:
    echo("$ " + " ".join(cmd))
    try:
        subprocess.run(cmd, cwd=str(cwd), check=True)
        return True
    except OSError as exc:
        echo(f"Command failed to start: {exc}")
        if strict:
            raise
        return False
    except subprocess.CalledProcessError as exc:
        echo(f"Command failed with exit code {exc.returncode}")
        if strict:
            raise
        return False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Install requirements into both adal and venv virtual environments."
    )
    parser.add_argument(
        "--mode",
        choices=["mirror", "native"],
        default="mirror",
        help=(
            "mirror: install both requirements files into both envs (default). "
            "native: install requirements.txt -> venv and requirements-wsl.txt -> adal only."
        ),
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Stop immediately if any install command fails.",
    )
    parser.add_argument(
        "--skip-pip-upgrade",
        action="store_true",
        help="Skip `python -m pip install --upgrade pip` step for each env.",
    )
    return parser.parse_args()


def resolve_python(candidates: Iterable[Path]) -> Path | None:
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def install_for_env(
    env_name: str,
    python_exe: Path,
    req_files: Iterable[Path],
    backend_root: Path,
    strict: bool,
    skip_pip_upgrade: bool,
) -> bool:
    echo(f"Installing for {env_name}: {python_exe}")

    ok = True

    if not skip_pip_upgrade:
        ok = run([str(python_exe), "-m", "pip", "install", "--upgrade", "pip"], backend_root, strict) and ok

    for req_file in req_files:
        ok = run(
            [str(python_exe), "-m", "pip", "install", "-r", str(req_file)],
            backend_root,
            strict,
        ) and ok

    return ok


def main() -> int:
    args = parse_args()

    backend_root = Path(__file__).resolve().parents[1]
    req_windows = backend_root / "requirements.txt"
    req_wsl = backend_root / "requirements-wsl.txt"

    missing_reqs = [str(p) for p in (req_windows, req_wsl) if not p.exists()]
    if missing_reqs:
        echo("Missing requirements file(s):")
        for item in missing_reqs:
            echo(f"  - {item}")
        return 1

    envs = [
        {
            "name": "venv (Windows)",
            "python": resolve_python(
                [
                    backend_root / "venv" / "Scripts" / "python.exe",
                    backend_root / "venv" / "bin" / "python",
                ]
            ),
        },
        {
            "name": "adal (WSL)",
            "python": resolve_python(
                [
                    backend_root / "adal" / "bin" / "python",
                    backend_root / "adal" / "Scripts" / "python.exe",
                ]
            ),
        },
    ]

    if args.mode == "mirror":
        reqs_for_venv = [req_windows, req_wsl]
        reqs_for_adal = [req_wsl, req_windows]
    else:
        reqs_for_venv = [req_windows]
        reqs_for_adal = [req_wsl]

    any_failure = False

    for env in envs:
        python_exe = env["python"]
        if python_exe is None:
            echo(f"Skipping {env['name']} (python not found)")
            any_failure = True
            continue

        req_files = reqs_for_venv if env["name"].startswith("venv") else reqs_for_adal
        success = install_for_env(
            env_name=env["name"],
            python_exe=python_exe,
            req_files=req_files,
            backend_root=backend_root,
            strict=args.strict,
            skip_pip_upgrade=args.skip_pip_upgrade,
        )
        if not success:
            any_failure = True

    if any_failure:
        echo("Completed with warnings/errors. Review output above.")
        return 1

    echo("All installs completed successfully.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        echo("Interrupted by user")
        raise SystemExit(130)
