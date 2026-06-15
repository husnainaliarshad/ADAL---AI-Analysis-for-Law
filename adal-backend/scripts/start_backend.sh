#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${BACKEND_ROOT}"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-9006}"
RELOAD="${RELOAD:-1}"

detect_python_bin() {
    python_has_uvicorn() {
        "$1" -c "import uvicorn" >/dev/null 2>&1
    }

    local fallback=""
    local unix_candidates=(
        "${BACKEND_ROOT}/venv/bin/python"
        "${BACKEND_ROOT}/.venv/bin/python"
        "${BACKEND_ROOT}/adal/bin/python"
    )

    local candidate
    for candidate in "${unix_candidates[@]}"; do
        if [[ -x "${candidate}" ]]; then
            if [[ -z "${fallback}" ]]; then
                fallback="${candidate}"
            fi
            if python_has_uvicorn "${candidate}"; then
                echo "${candidate}"
                return 0
            fi
        fi
    done

    if command -v python >/dev/null 2>&1; then
        candidate="$(command -v python)"
        if [[ -z "${fallback}" ]]; then
            fallback="${candidate}"
        fi
        if python_has_uvicorn "${candidate}"; then
            echo "${candidate}"
            return 0
        fi
    fi

    if command -v python3 >/dev/null 2>&1; then
        candidate="$(command -v python3)"
        if [[ -z "${fallback}" ]]; then
            fallback="${candidate}"
        fi
        if python_has_uvicorn "${candidate}"; then
            echo "${candidate}"
            return 0
        fi
    fi

    if [[ -z "${WSL_DISTRO_NAME:-}" && -z "${WSL_INTEROP:-}" ]]; then
        local windows_candidates=(
            "${BACKEND_ROOT}/venv/Scripts/python.exe"
            "${BACKEND_ROOT}/.venv/Scripts/python.exe"
            "${BACKEND_ROOT}/adal/Scripts/python.exe"
        )

        for candidate in "${windows_candidates[@]}"; do
            if [[ -x "${candidate}" ]]; then
                if [[ -z "${fallback}" ]]; then
                    fallback="${candidate}"
                fi
                if python_has_uvicorn "${candidate}"; then
                    echo "${candidate}"
                    return 0
                fi
            fi
        done
    fi

    if [[ -n "${fallback}" ]]; then
        echo "${fallback}"
        return 0
    fi

    return 1
}

PYTHON_BIN="$(detect_python_bin || true)"
if [[ -z "${PYTHON_BIN}" ]]; then
    echo "Error: Could not find a Python interpreter for ADAL backend."
    echo "Create a virtual environment (preferred: venv for Windows, adal for WSL) or install Python."
    exit 1
fi

if [[ ! -f "${BACKEND_ROOT}/.env" ]]; then
    echo "Warning: .env file not found at ${BACKEND_ROOT}/.env"
fi

if ! "${PYTHON_BIN}" -c "import uvicorn" >/dev/null 2>&1; then
    echo "Error: uvicorn is not installed for ${PYTHON_BIN}"
    echo "Install dependencies with:"
    echo "  ${PYTHON_BIN} -m pip install -r requirements.txt"
    exit 1
fi

CMD=("${PYTHON_BIN}" -m uvicorn app.main:app --host "${HOST}" --port "${PORT}")
if [[ "${RELOAD}" != "0" ]]; then
    CMD+=(--reload)
fi

if [[ "$#" -gt 0 ]]; then
    CMD+=("$@")
fi

echo "Starting ADAL backend..."
echo "Python: ${PYTHON_BIN}"
echo "URL: http://${HOST}:${PORT}"
exec "${CMD[@]}"
