"""Recolecta los OCID que hacen falta para lanzar la instancia: compartment,
availability domain, imagen Ubuntu 22.04 (ARM) y la red (VCN/subred) que Oracle
haya alcanzado a crear en los intentos anteriores (o None si no hay ninguna)."""
import oci
import json

config = oci.config.from_file()
compartment_id = config["tenancy"]  # compartimento raiz

identity = oci.identity.IdentityClient(config)
ads = identity.list_availability_domains(compartment_id).data
print("Availability domains:")
for ad in ads:
    print(f"  {ad.name}")

compute = oci.core.ComputeClient(config)
images = compute.list_images(
    compartment_id,
    operating_system="Canonical Ubuntu",
    operating_system_version="22.04",
    shape="VM.Standard.A1.Flex",
).data
print("\nImagenes Ubuntu 22.04 compatibles con VM.Standard.A1.Flex:")
imagen_elegida = None
for img in images:
    print(f"  {img.display_name}  ->  {img.id}")
    if imagen_elegida is None and "Minimal" not in img.display_name and "aarch64" not in img.display_name:
        imagen_elegida = img

network = oci.core.VirtualNetworkClient(config)
vcns = network.list_vcns(compartment_id).data
print("\nVCNs existentes:")
subred_publica = None
for vcn in vcns:
    print(f"  {vcn.display_name} ({vcn.lifecycle_state})  ->  {vcn.id}")
    subnets = network.list_subnets(compartment_id, vcn_id=vcn.id).data
    for sn in subnets:
        publica = "publica" if not sn.prohibit_public_ip_on_vnic else "PRIVADA"
        print(f"      subred: {sn.display_name} ({publica}, {sn.lifecycle_state})  ->  {sn.id}")
        if not sn.prohibit_public_ip_on_vnic and subred_publica is None:
            subred_publica = sn

resumen = {
    "compartment_id": compartment_id,
    "availability_domain": ads[0].name if ads else None,
    "image_id": imagen_elegida.id if imagen_elegida else None,
    "image_name": imagen_elegida.display_name if imagen_elegida else None,
    "subnet_id": subred_publica.id if subred_publica else None,
    "subnet_name": subred_publica.display_name if subred_publica else None,
}
print("\n--- RESUMEN (JSON) ---")
print(json.dumps(resumen, indent=2))

with open("resumen_datos.json", "w") as f:
    json.dump(resumen, f, indent=2)
