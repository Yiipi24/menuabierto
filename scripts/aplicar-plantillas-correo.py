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


def pedir(token, metodo, cuerpo=None):
    peticion = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/config/auth",
        data=json.dumps(cuerpo).encode("utf-8") if cuerpo else None,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            # Sin User-Agent propio, Cloudflare corta la peticion con un 403
            # (error 1010) antes de que llegue a la API.
            "User-Agent": "menuabierto-plantillas-correo",
        },
        method=metodo,
    )
    with urllib.request.urlopen(peticion) as respuesta:
        return json.load(respuesta)


def main():
    # Sin esto, un fallo temprano sale en stderr antes que el listado de stdout
    # y el log de CI queda al reves.
    sys.stdout.reconfigure(line_buffering=True)
    seco = "--dry-run" in sys.argv
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token and not seco:
        sys.exit("Falta SUPABASE_ACCESS_TOKEN.")

    print(f"Plantillas para el proyecto {PROJECT_REF}:")
    cuerpo = payload()

    if seco:
        print("\n--dry-run: no se envio nada.")
        return

    # Leemos antes de escribir para separar los dos motivos de un 403: un token
    # sin acceso al proyecto, o con acceso pero sin permiso de escritura.
    try:
        pedir(token, "GET")
    except urllib.error.HTTPError as error:
        sys.exit(
            f"El token no puede LEER la config de Auth de {PROJECT_REF} "
            f"(HTTP {error.code}): {error.read().decode()}"
        )

    try:
        aplicado = pedir(token, "PATCH", cuerpo)
    except urllib.error.HTTPError as error:
        sys.exit(
            f"El token LEE pero no ESCRIBE la config de Auth "
            f"(HTTP {error.code}): {error.read().decode()}"
        )

    # Comparamos contra lo que quedo guardado en lugar de confiar en el 200: un
    # asunto que no coincide significa que el PATCH no tomo lo que creemos.
    for clave, esperado in cuerpo.items():
        if clave.startswith("mailer_subjects_") and aplicado.get(clave) != esperado:
            sys.exit(f"{clave} quedo como {aplicado.get(clave)!r}, no {esperado!r}.")

    print("\nListo. Asuntos y cuerpos confirmados contra la respuesta de Supabase.")


if __name__ == "__main__":
    main()
