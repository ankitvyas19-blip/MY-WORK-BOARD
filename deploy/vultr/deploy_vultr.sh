#!/usr/bin/env bash
# =============================================================================
# Safe Re-use Deployment Script for Existing Mumbai Vultr VM (65.20.71.124)
# Deploys MY-WORK-BOARD (24x7 on :8083) + Kashti Music Studio (Weekly Timer)
# into /opt/my-work-board WITHOUT touching :8081 (SCALPER Radar 2) or :8082 (Radar 1).
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/my-work-board}"
APP_PORT="${APP_PORT:-8083}"
REPO_URL="${REPO_URL:-https://github.com/ankitvyas19-blip/MY-WORK-BOARD.git}"
BRANCH="${BRANCH:-main}"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

echo "========================================================================"
echo "  Vultr Deployment — MY-WORK-BOARD + Kashti Music Studio"
echo "  Target Directory : ${APP_DIR}"
echo "  Target Port      : :${APP_PORT} (keeps :8081 & :8082 untouched)"
echo "========================================================================"

# 1. Hard safety checks — NEVER touch SCALPER Radar ports or unrelated /opt paths
if [ "${APP_PORT}" = "8081" ] || [ "${APP_PORT}" = "8082" ]; then
  echo "ERROR: Port ${APP_PORT} is reserved for SCALPER Radar (8081/8082). Use APP_PORT=8083 (or another free port)."
  exit 1
fi

case "${APP_DIR}" in
  "/"|"/opt"|"/opt/"|*"scalper"*|*"SCALPER"*)
    echo "ERROR: Refusing unsafe APP_DIR='${APP_DIR}'."
    exit 1
    ;;
esac

# Check if another unrelated service already occupies APP_PORT
if command -v ss >/dev/null 2>&1; then
  PORT_IN_USE="$(ss -ltnp 2>/dev/null | grep -E ":${APP_PORT}[[:space:]]" || true)"
  if [ -n "${PORT_IN_USE}" ]; then
    if ! systemctl is-active --quiet my-work-board.service 2>/dev/null; then
      echo "ERROR: Port :${APP_PORT} is already in use by another process:"
      echo "  ${PORT_IN_USE}"
      echo "Re-run with a free port, e.g.: APP_PORT=8084 bash deploy_vultr.sh"
      exit 1
    fi
  fi
fi

# 2. Install required system packages (FFmpeg, Hindi Noto fonts, Python venv, git, curl)
echo "[1/7] Installing system packages (ffmpeg, Hindi Noto fonts, python3-venv)..."
${SUDO} apt-get update -y
${SUDO} apt-get install -y git curl ca-certificates gnupg ffmpeg fonts-noto-core fonts-noto-extra fontconfig python3 python3-venv python3-pip
${SUDO} fc-cache -f

echo "  -> Checking Hindi Devanagari font availability:"
fc-list :lang=hi family | head -n 5 || true

# 3. Ensure Node.js >= 20 is installed
NEED_NODE=0
if ! command -v node >/dev/null 2>&1; then
  NEED_NODE=1
else
  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
  if [ "${NODE_MAJOR}" -lt 20 ]; then
    NEED_NODE=1
  fi
fi

if [ "${NEED_NODE}" -eq 1 ]; then
  echo "[2/7] Installing Node.js 22 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | ${SUDO} -E bash -
  ${SUDO} apt-get install -y nodejs
else
  echo "[2/7] Node.js already ready: $(node -v)"
fi
NODE_BIN_DIR="$(dirname "$(command -v node)")"

# 4. Clone or update repository into /opt/my-work-board
echo "[3/7] Syncing repository into ${APP_DIR}..."
${SUDO} mkdir -p "$(dirname "${APP_DIR}")"
if [ -d "${APP_DIR}/.git" ]; then
  if [ -n "$(${SUDO} git -c safe.directory="${APP_DIR}" -C "${APP_DIR}" status --porcelain)" ]; then
    echo "  -> Stashing local runtime changes before update..."
    ${SUDO} git -c safe.directory="${APP_DIR}" -C "${APP_DIR}" stash push -m "vultr-deploy-$(date +%s)" || true
  fi
  ${SUDO} git -c safe.directory="${APP_DIR}" -C "${APP_DIR}" fetch origin "${BRANCH}"
  ${SUDO} git -c safe.directory="${APP_DIR}" -C "${APP_DIR}" checkout "${BRANCH}"
  ${SUDO} git -c safe.directory="${APP_DIR}" -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
else
  ${SUDO} git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

# 5. Create .env once (never overwrite existing user secrets on re-deploy)
if [ ! -f "${APP_DIR}/.env" ]; then
  echo "[4/7] Creating ${APP_DIR}/.env from template..."
  ${SUDO} cp "${APP_DIR}/deploy/vultr/.env.vultr.example" "${APP_DIR}/.env"
  ${SUDO} sed -i "s|^PORT=.*|PORT=${APP_PORT}|" "${APP_DIR}/.env"
  ${SUDO} sed -i "s|^APP_URL=.*|APP_URL=http://65.20.71.124:${APP_PORT}|" "${APP_DIR}/.env"
  ${SUDO} chmod 600 "${APP_DIR}/.env"
else
  echo "[4/7] Preserving existing ${APP_DIR}/.env (secrets untouched)."
fi

# 6. Build MY-WORK-BOARD web app & set up Kashti Music Studio Python venv
echo "[5/7] Building MY-WORK-BOARD web app..."
(
  cd "${APP_DIR}"
  ${SUDO} npm install
  ${SUDO} npm run build
)

echo "[5b/7] Setting up Kashti Music Studio Python virtual environment..."
VENV_DIR="${APP_DIR}/kashti-music-studio/.venv"
if [ ! -d "${VENV_DIR}" ]; then
  ${SUDO} python3 -m venv "${VENV_DIR}"
fi
${SUDO} "${VENV_DIR}/bin/pip" install --upgrade pip
${SUDO} "${VENV_DIR}/bin/pip" install google-genai google-api-python-client google-auth-oauthlib google-auth-httplib2

# 7. Install systemd units (24x7 web app + weekly Friday studio timer)
echo "[6/7] Installing systemd services & weekly timer..."
render_unit() {
  local src="$1"
  local dst="$2"
  sed \
    -e "s|__APP_DIR__|${APP_DIR}|g" \
    -e "s|__APP_PORT__|${APP_PORT}|g" \
    -e "s|__NODE_BIN_DIR__|${NODE_BIN_DIR}|g" \
    "${src}" | ${SUDO} tee "${dst}" >/dev/null
}

render_unit "${APP_DIR}/deploy/vultr/my-work-board.service" "/etc/systemd/system/my-work-board.service"
render_unit "${APP_DIR}/deploy/vultr/kashti-studio.service" "/etc/systemd/system/kashti-studio.service"
${SUDO} cp "${APP_DIR}/deploy/vultr/kashti-studio.timer" "/etc/systemd/system/kashti-studio.timer"

${SUDO} systemctl daemon-reload
${SUDO} systemctl enable --now my-work-board.service
${SUDO} systemctl restart my-work-board.service
${SUDO} systemctl enable --now kashti-studio.timer

# Open ONLY APP_PORT in UFW if active (never resets UFW or touches 8081/8082)
if command -v ufw >/dev/null 2>&1; then
  if ${SUDO} ufw status 2>/dev/null | grep -qi "Status: active"; then
    echo "  -> Opening port ${APP_PORT}/tcp in UFW..."
    ${SUDO} ufw allow "${APP_PORT}/tcp" >/dev/null
  fi
fi

# 8. Health verification
echo "[7/7] Verifying MY-WORK-BOARD on :${APP_PORT} and existing SCALPER ports (:8081, :8082)..."
sleep 2
curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" && echo ""

echo ""
echo "Active listening ports check:"
ss -ltnp 2>/dev/null | grep -E ":(8081|8082|${APP_PORT})[[:space:]]" || true

echo ""
echo "========================================================================"
echo "  DEPLOY COMPLETE!"
echo "  - MY-WORK-BOARD (24x7)   : http://65.20.71.124:${APP_PORT}"
echo "  - Kashti Studio Timer    : Every Friday 12:00 PM IST (kashti-studio.timer)"
echo "  - Edit secrets once      : nano ${APP_DIR}/.env"
echo "  - Manual studio test run : sudo systemctl start kashti-studio.service"
echo "  - Watch logs             : journalctl -u my-work-board -u kashti-studio -f"
echo "========================================================================"
