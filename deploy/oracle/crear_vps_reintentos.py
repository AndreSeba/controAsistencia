"""
Reintenta crear la instancia VM.Standard.A1.Flex (Ampere, 4 OCPU / 24GB) en Oracle
Cloud São Paulo hasta que haya capacidad disponible. Corre en segundo plano de
verdad (proceso real, no requiere que nadie esté mirando ni clickeando).

- Reintenta solo ante "Out of capacity" (esperado, no es un error real).
- Si el error es otro (credenciales, cuota, etc.), corta y avisa — no tiene sentido
  reintentar algo que no se va a arreglar solo.
- Al lograrlo: agrega el SSH key, pide IP pública, y deja todo en resultado.json.

Uso:
  python crear_vps_reintentos.py
"""
import json
import time
import datetime
import sys
import oci

INTERVALO_SEGUNDOS = 300  # 5 min entre intentos
MAX_INTENTOS = 500        # ~41 horas de reintentos como techo de seguridad

SHAPE = "VM.Standard.A1.Flex"
OCPUS = 4
MEMORIA_GB = 24
NOMBRE_INSTANCIA = "controasistencia"

with open("resumen_datos.json") as f:
    datos = json.load(f)

with open(r"C:\Users\Sebas\.ssh\oracle_controasistencia.pub") as f:
    ssh_public_key = f.read().strip()

config = oci.config.from_file()
compute = oci.core.ComputeClient(config)
network = oci.core.VirtualNetworkClient(config)


def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    linea = f"[{ts}] {msg}"
    print(linea, flush=True)


def intentar_lanzar():
    return compute.launch_instance(
        oci.core.models.LaunchInstanceDetails(
            compartment_id=datos["compartment_id"],
            availability_domain=datos["availability_domain"],
            display_name=NOMBRE_INSTANCIA,
            shape=SHAPE,
            shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(
                ocpus=OCPUS,
                memory_in_gbs=MEMORIA_GB,
            ),
            source_details=oci.core.models.InstanceSourceViaImageDetails(
                image_id=datos["image_id"],
            ),
            create_vnic_details=oci.core.models.CreateVnicDetails(
                subnet_id=datos["subnet_id"],
                assign_public_ip=True,
            ),
            metadata={"ssh_authorized_keys": ssh_public_key},
        )
    )


def main():
    log(f"Arrancando. Shape={SHAPE} {OCPUS}OCPU/{MEMORIA_GB}GB, imagen={datos['image_name']}")
    log(f"Reintentando cada {INTERVALO_SEGUNDOS}s, máximo {MAX_INTENTOS} intentos.")

    for intento in range(1, MAX_INTENTOS + 1):
        try:
            resp = intentar_lanzar()
            instancia = resp.data
            log(f"¡ÉXITO en el intento {intento}! Instancia creada: {instancia.id}")
            log("Esperando a que quede RUNNING para pedir la IP pública...")

            oci.wait_until(
                compute,
                compute.get_instance(instancia.id),
                "lifecycle_state",
                "RUNNING",
                max_wait_seconds=600,
            )

            vnic_attachments = compute.list_vnic_attachments(
                datos["compartment_id"], instance_id=instancia.id
            ).data
            vnic = network.get_vnic(vnic_attachments[0].vnic_id).data

            resultado = {
                "exito": True,
                "instancia_id": instancia.id,
                "ip_publica": vnic.public_ip,
                "ip_privada": vnic.private_ip,
                "intentos_necesarios": intento,
            }
            with open("resultado.json", "w") as f:
                json.dump(resultado, f, indent=2)

            log(f"IP pública: {vnic.public_ip}")
            log("Guardado en resultado.json. Listo para el siguiente paso (setup-vps.sh).")
            return 0

        except oci.exceptions.ServiceError as e:
            mensaje = str(e.message or "")
            if "Out of capacity" in mensaje or e.status == 500:
                log(f"Intento {intento}/{MAX_INTENTOS}: sin capacidad todavía. Reintento en {INTERVALO_SEGUNDOS}s.")
                time.sleep(INTERVALO_SEGUNDOS)
                continue
            log(f"ERROR NO ES DE CAPACIDAD (status={e.status}, code={e.code}): {mensaje}")
            log("Corto acá — este tipo de error no se arregla solo reintentando.")
            with open("resultado.json", "w") as f:
                json.dump({"exito": False, "error": mensaje, "status": e.status, "code": e.code}, f, indent=2)
            return 1
        except Exception as e:
            log(f"ERROR INESPERADO: {e}")
            with open("resultado.json", "w") as f:
                json.dump({"exito": False, "error": str(e)}, f, indent=2)
            return 1

    log(f"Se agotaron los {MAX_INTENTOS} intentos sin conseguir capacidad. Corriendo manualmente de nuevo más tarde.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
