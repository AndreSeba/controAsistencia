#!/usr/bin/env bash
# ============================================================================
# Despliega (o actualiza) el backend en el VPS ya configurado por setup-vps.sh.
# Idempotente: la primera vez clona, las siguientes hace pull y reinicia.
#
# Uso:
#   sudo bash deploy-app.sh https://github.com/AndreSeba/controAsistencia.git [rama]
# ============================================================================
set -euo pipefail

REPO="${1:-}"
RAMA="${2:-main}"
APP_DIR="/opt/controasistencia"
REPO_DIR="$APP_DIR/repo"
ENV_FILE="$APP_DIR/.env"

if [[ -z "$REPO" ]]; then
  echo "Uso: sudo bash deploy-app.sh <url-del-repo> [rama]" >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Correr con sudo." >&2
  exit 1
fi

echo "==> 1/4 Obteniendo el código (rama: $RAMA)"
if [[ -d "$REPO_DIR/.git" ]]; then
  git -C "$REPO_DIR" fetch --all --prune
  git -C "$REPO_DIR" checkout "$RAMA"
  git -C "$REPO_DIR" reset --hard "origin/$RAMA"
else
  git clone --branch "$RAMA" "$REPO" "$REPO_DIR"
fi
chown -R controasist:controasist "$REPO_DIR"

echo "==> 2/4 Instalando dependencias de producción"
# --omit=dev: en el servidor no hacen falta eslint y compañía.
sudo -u controasist npm --prefix "$REPO_DIR/backend" ci --omit=dev \
  || sudo -u controasist npm --prefix "$REPO_DIR/backend" install --omit=dev

if [[ ! -f "$ENV_FILE" ]]; then
  echo
  echo "!! Falta $ENV_FILE — el servicio no va a arrancar sin él."
  echo "   Crealo con las variables reales (mismas que en Render) y volvé a correr este script:"
  echo "     sudo cp $REPO_DIR/deploy/oracle/env.ejemplo $ENV_FILE"
  echo "     sudo nano $ENV_FILE"
  echo "     sudo chown controasist:controasist $ENV_FILE && sudo chmod 600 $ENV_FILE"
  exit 1
fi
chown controasist:controasist "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "==> 3/4 Instalando el servicio systemd"
cp "$REPO_DIR/deploy/oracle/controasistencia.service" /etc/systemd/system/controasistencia.service
systemctl daemon-reload
systemctl enable controasistencia
systemctl restart controasistencia

echo "==> 4/4 Verificando"
sleep 5
systemctl --no-pager --lines=15 status controasistencia || true
echo
if curl -fsS --max-time 15 http://127.0.0.1:3001/api/health >/dev/null; then
  echo "OK: el backend responde en el propio servidor."
  echo "Probá desde afuera:  curl https://TU-DOMINIO/api/health"
else
  echo "El backend NO responde. Ver los logs con:"
  echo "  sudo journalctl -u controasistencia -n 80 --no-pager"
  exit 1
fi
