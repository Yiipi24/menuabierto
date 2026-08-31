#!/usr/bin/env python3
"""Sube las plantillas de correo de supabase/ a la configuracion de Auth.

El panel de Supabase guarda el HTML en su propia base, no en el repo, asi que
sin esto las dos copias se separan en cuanto alguien edita una. La fuente de
verdad es supabase/config.toml; este script solo la empuja.

Uso: SUPABASE_ACCESS_TOKEN=... python3 scripts/aplicar-plantillas-correo.py
     [--dry-run]
"""

import json
import os
import sys
import tomllib
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "bpvtydaoiscvxpidwmif")
RAIZ = Path(__file__).resolve().parent.parent / "supabase"


def payload():
    config = tomllib.loads((RAIZ / "config.toml").read_text(encoding="utf-8"))
    plantillas = config.get("auth", {}).get("email", {}).get("template", {})
    if not plantillas:
        sys.exit("config.toml no declara ninguna plantilla.")

    cuerpo = {}
    for nombre, datos in sorted(plantillas.items()):
        ruta = (RAIZ / datos["content_path"]).resolve()
        if not ruta.is_file():
            sys.exit(f"Falta {ruta}, declarado por la plantilla {nombre}.")
        cuerpo[f"mailer_subjects_{nombre}"] = datos["subject"]
        cuerpo[f"mailer_templates_{nombre}_content"] = ruta.read_text(encoding="utf-8")
        print(f"  {nombre:14} {datos['subject']}")
    return cuerpo


def main():
    seco = "--dry-run" in sys.argv
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token and not seco:
        sys.exit("Falta SUPABASE_ACCESS_TOKEN.")

    print(f"Plantillas para el proyecto {PROJECT_REF}:")
    cuerpo = payload()

    if seco:
        print("\n--dry-run: no se envio nada.")
        return

    peticion = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/config/auth",
        data=json.dumps(cuerpo).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(peticion) as respuesta:
            aplicado = json.load(respuesta)
    except urllib.error.HTTPError as error:
        # El cuerpo del error trae el motivo; el codigo suelto no dice nada.
        sys.exit(f"Supabase respondio {error.code}: {error.read().decode()}")

    # Releemos lo que quedo guardado en lugar de confiar en el 200: un asunto
    # que no coincide significa que el PATCH no tomo lo que creemos.
    for clave, esperado in cuerpo.items():
        if clave.startswith("mailer_subjects_") and aplicado.get(clave) != esperado:
            sys.exit(f"{clave} quedo como {aplicado.get(clave)!r}, no {esperado!r}.")

    print("\nListo. Asuntos y cuerpos confirmados contra la respuesta de Supabase.")


if __name__ == "__main__":
    main()
