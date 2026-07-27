# Migración del backend a un VPS de Oracle Cloud (Always Free)

Reemplaza a Render como host del backend. **No toca** la base de datos ni el
almacenamiento: siguen en Supabase. El panel y la PWA siguen en Vercel — solo
cambia a dónde apuntan sus rewrites.

## Antes de empezar (lo que hay que tener a mano)

| Qué | Dónde se consigue |
|---|---|
| Instancia creada y su **IP pública** | Consola de Oracle → Compute → Instances |
| Clave SSH privada de la instancia | Se descarga al crear la instancia (`.key`) |
| Un **dominio o subdominio** apuntando a esa IP | Ver "Dominio" abajo |
| Las variables de entorno reales | Render → servicio → Environment |

### Por qué el dominio no es opcional
El panel y la PWA se sirven por HTTPS desde Vercel. Un navegador **bloquea** que una
página HTTPS llame a un backend por HTTP (mixed content). Sin certificado válido en el
VPS, el sistema no funciona — no es una mejora, es un requisito.

Si no querés comprar un dominio, **DuckDNS** (gratis) alcanza:
1. Entrar a <https://www.duckdns.org> y loguearse con Google/GitHub.
2. Crear un subdominio, ej. `pizzario` → queda `pizzario.duckdns.org`.
3. En el campo "current ip" poner la **IP pública del VPS** y darle a *update ip*.
4. Verificar que resuelve: `nslookup pizzario.duckdns.org` debe devolver esa IP.

## Paso 1 — Abrir los puertos en la consola de Oracle

Oracle bloquea el tráfico entrante en **dos capas independientes**. Esta es la primera
(la de red); la segunda (la del sistema operativo) la resuelve `setup-vps.sh`.

Consola → Networking → Virtual Cloud Networks → tu VCN → Security Lists → *Default
Security List* → **Add Ingress Rules**, una por cada puerto:

| Source CIDR | IP Protocol | Destination Port |
|---|---|---|
| `0.0.0.0/0` | TCP | 80 |
| `0.0.0.0/0` | TCP | 443 |

> El error más común de esta migración es abrir los puertos **solo acá** y que igual no
> entre tráfico, porque falta la capa del sistema operativo.

## Paso 2 — Conectarse por SSH

```bash
ssh -i /ruta/a/tu-clave.key ubuntu@<IP>     # imágenes Ubuntu
ssh -i /ruta/a/tu-clave.key opc@<IP>        # imágenes Oracle Linux
```

## Paso 3 — Configurar el servidor

```bash
sudo dnf install -y git || sudo apt-get update -y && sudo apt-get install -y git
git clone https://github.com/AndreSeba/controAsistencia.git /tmp/ca
sudo bash /tmp/ca/deploy/oracle/setup-vps.sh <tu-dominio> <tu-email>
```

Instala Node 22, Nginx y certbot; abre los puertos del sistema operativo; deja Nginx
como proxy inverso hacia `127.0.0.1:3001` y emite el certificado HTTPS.

## Paso 4 — Cargar las variables de entorno

```bash
sudo mkdir -p /opt/controasistencia
sudo cp /tmp/ca/deploy/oracle/env.ejemplo /opt/controasistencia/.env
sudo nano /opt/controasistencia/.env      # pegar los valores reales de Render
sudo chown controasist:controasist /opt/controasistencia/.env
sudo chmod 600 /opt/controasistencia/.env
```

## Paso 5 — Desplegar el backend

```bash
sudo bash /tmp/ca/deploy/oracle/deploy-app.sh https://github.com/AndreSeba/controAsistencia.git main
curl https://<tu-dominio>/api/health      # debe devolver {"ok":true}
```

## Paso 6 — Apuntar el panel y la PWA al VPS

En `panel-rrhh/vercel.json` y `pwa/vercel.json`, cambiar el destino de los rewrites de
`https://controasistencia.onrender.com` a `https://<tu-dominio>`. Commit + push →
Vercel redespliega solo.

## Paso 7 — Verificar de punta a punta antes de apagar Render

1. Entrar al panel y loguearse (prueba el circuito completo: panel → VPS → Supabase).
2. Marcar una asistencia real desde la PWA (prueba selfie + reconocimiento facial, que
   es lo más pesado).
3. Recién con eso funcionando, suspender el servicio en Render.

**Dejar Render prendido hasta ese momento**: es el plan de rollback. Si algo falla,
revertir los `vercel.json` al dominio de Render y todo vuelve a funcionar.

## Operación diaria

```bash
sudo systemctl status controasistencia          # estado
sudo journalctl -u controasistencia -f          # logs en vivo
sudo systemctl restart controasistencia         # reiniciar
sudo bash deploy-app.sh <repo> main             # actualizar a la última versión
```

> A diferencia de Render, **acá no hay despliegue automático al hacer push**: cada
> actualización requiere correr `deploy-app.sh` a mano.

## Cosas que cambian respecto de Render

| | Render (free) | VPS Oracle |
|---|---|---|
| Límite de horas | 750/mes (se agotaban) | Sin límite |
| Se duerme sin tráfico | Sí (30-50s de cold start) | No |
| Memoria | 512 MB (causaba los 502 al subir fotos) | 24 GB |
| Deploy al hacer push | Automático | Manual (`deploy-app.sh`) |
| Certificado HTTPS | Lo maneja Render | Certbot (renovación automática) |
| Actualizaciones del SO | Las maneja Render | Tuyas |

## Riesgo a tener presente
Oracle puede **reclamar** una instancia Always Free considerada inactiva (CPU por debajo
del 20% en el percentil 95 durante 7 días). Un backend de piloto liviano puede caer en
ese rango. La forma de eliminar el riesgo es pasar la cuenta a *Pay As You Go* (se sigue
pagando 0 mientras no se excedan los límites del free tier).
