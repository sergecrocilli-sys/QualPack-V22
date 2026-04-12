#!/usr/bin/env python3
"""
QualPack — Téléchargement des librairies locales
Exécute ce script UNE SEULE FOIS depuis le dossier qualpack_v3/
  python3 download_libs.py
"""
import urllib.request, os, sys

LIBS = [
    (
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'libs/jspdf.umd.min.js'
    ),
    (
        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
        'libs/xlsx.full.min.js'
    ),
]

for url, dest in LIBS:
    print(f'Téléchargement {dest}...', end=' ', flush=True)
    try:
        urllib.request.urlretrieve(url, dest)
        size = os.path.getsize(dest)
        print(f'OK ({size/1024:.0f} KB)')
    except Exception as e:
        print(f'ERREUR: {e}')
        sys.exit(1)

print('\nTerminé — libs prêtes pour le hors-ligne.')
