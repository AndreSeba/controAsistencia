#!/usr/bin/env bash
# ============================================================================
# Configura un VPS limpio (Oracle Cloud Always Free) para correr el backend de
# control de asistencia detrás de Nginx con HTTPS de Let's Encrypt.
#
# Detecta solo si la imagen es Oracle Linux / RHEL (dnf + firewalld) o
# Ubuntu / Debian (apt + ufw): Oracle Cloud ofrece las dos y los comandos
# difieren.
#
# NO abre puertos en la consola web de Oracle — eso hay que hacerlo aparte
# (Security List de la VCN). Son capas distintas y las dos son obligatorias:
# el firewall del sistema operativo (esto) y el de la red virtual (la consola).
#
# Uso:
#   sudo bash setup-vps.sh <dominio> <email-para-lets-encrypt>
# Ejemplo:
#   sudo bash setup-vps.sh pizzario.duckdns.org andrespeinadoardaya780@gmail.com
# ============================================================================
set -euo pipefail

DOMINIO="${1:-}"
EMAIL="${2:-}"
APP_DIR="/opt/controasistencia"
NODE_MAJOR=22   # misma versión mayor que Render, para no introducir diferencias

if [[ -z "$DOMINIO" || -z "$EMAIL" ]]; then
  echo "Uso: sudo bash setup-vps.sh <dominio> <email>" >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Correr con sudo." >&2
  exit 1
fi

echo "==> 1/7 Detectando distribución"
if [[ -f /etc/os-release ]]; then . /etc/os-release; fi
case "${ID:-}" in
  ol|rhel|centos|almalinux|rocky) FAMILIA=rhel ;;
  ubuntu|debian)                  FAMILIA=debian ;;
  *) echo "Distribución no reconocida (${ID:-desconocida})." >&2; exit 1 ;;
esac
echo "    Familia: $FAMILIA (${PRETTY_NAME:-})"

echo "==> 2/7 Instalando Node.js ${NODE_MAJOR}, Nginx, certbot y git"
if [[ "$FAMILIA" == "rhel" ]]; then
  dnf install -y curl git nginx policycoreutils-python-utils
  curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  dnf install -y nodejs
  dnf install -y certbot python3-certbot-nginx
else
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y curl git nginx
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
  apt-get install -y certbot python3-certbot-nginx
fi
echo "    Node: $(node --version) · npm: $(npm --version)"

echo "==> 3/7 Abriendo puertos 80 y 443 en el firewall DEL SISTEMA"
# Oracle Cloud deja iptables con reglas restrictivas por defecto en sus imágenes:
# abrir solo en la consola web NO alcanza, hay que abrir también acá.
if [[ "$FAMILIA" == "rhel" ]]; then
  systemctl enable --now firewalld
  firewall-cmd --permanent --add-service=http
  firewall-cmd --permanent --add-service=https
  firewall-cmd --reload
else
  # El puerto 22 PRIMERO y explícito: habilitar ufw sin permitir SSH deja el
  # servidor inaccesible y no hay forma de volver a entrar.
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi
# Las imágenes de Oracle traen además reglas iptables propias que persisten aparte.
if iptables -L INPUT -n 2>/dev/null | grep -q REJECT; then
  iptables -I INPUT 5 -p tcp --dport 80  -j ACCEPT || true
  iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT || true
  if [[ "$FAMILIA" == "rhel" ]]; then
    dnf install -y iptables-services >/dev/null 2>&1 || true
    service iptables save 2>/dev/null || true
  else
    apt-get install -y iptables-persistent >/dev/null 2>&1 || true
    netfilter-persistent save 2>/dev/null || true
  fi
fi

echo "==> 4/7 Creando usuario de servicio y carpeta de la app"
id -u controasist &>/dev/null || useradd --system --create-home --shell /usr/sbin/nologin controasist
mkdir -p "$APP_DIR"
chown -R controasist:controasist "$APP_DIR"

echo "==> 5/7 Configurando Nginx como proxy inverso"
cat > /etc/nginx/conf.d/controasistencia.conf <<NGINX
server {
    listen 80;
    server_name ${DOMINIO};

    # La selfie y la foto de referencia viajan por acá; el default de Nginx (1MB)
    # las rechazaría con 413.
    client_max_body_size 12M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # El reconocimiento facial puede tardar varios segundos.
        proxy_read_timeout 120s;
    }
}
NGINX
# En RHEL/Oracle Linux, SELinux bloquea que Nginx abra conexiones salientes
# (al backend en :3001) salvo que se habilite explícitamente.
if [[ "$FAMILIA" == "rhel" ]] && command -v setsebool >/dev/null; then
  setsebool -P httpd_can_network_connect 1 || true
fi
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "==> 6/7 Emitiendo certificado HTTPS (Let's Encrypt)"
echo "    Si esto falla, casi siempre es que el puerto 80 no llega desde afuera:"
echo "    revisar la Security List de la VCN en la consola de Oracle."
certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos -m "$EMAIL" --redirect

echo "==> 7/7 Renovación automática del certificado"
systemctl enable --now certbot-renew.timer 2>/dev/null || systemctl enable --now certbot.timer 2>/dev/null || true

echo
echo "======================================================================"
echo " Servidor listo. Falta desplegar el código:"
echo "   sudo bash deploy-app.sh <url-del-repo>"
echo " Probar cuando termine:  curl https://${DOMINIO}/api/health"
echo "======================================================================"
