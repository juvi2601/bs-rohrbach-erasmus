DEV 14.0 – Modul 9.1.2 Published-Resource API Fix

Ursache des Linz/Brüssel-Problems:
Der Endpoint /api/trips/public-resource erzeugte seine Response mit einem falschen Aufruf:
  json(data, {headers:{...}})
Die Hilfsfunktion erwartet jedoch:
  json(data, status, extraHeaders)

Dadurch wurde das Header-Objekt fälschlich als HTTP-Status übergeben.
Der Published-Resource-Request konnte deshalb nicht korrekt antworten.
Die dynamische Linz-Seite bekam ihre Snapshot-Daten nicht und der im HTML vorhandene
Brüssel-Fallback blieb sichtbar.

Fix:
- public-resource liefert JSON nun korrekt mit Status 200 aus.
- Diagnose-Header für Trip und Resource ergänzt.
- Linz-Shell zeigt intern eindeutig, ob der Published-Site-Snapshot geladen wurde.
- Keine erneute Veröffentlichung erforderlich: der bestehende Snapshot bleibt verwendbar.

Brüssel-Schutz:
- public/index.html unverändert
- public/app.js unverändert
- public/styles.css unverändert
- public/404.html unverändert
