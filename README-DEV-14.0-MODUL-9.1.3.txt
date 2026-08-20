DEV 14.0 – Modul 9.1.3 Response-Status-Härtung

Fehlerbild:
GET /api/trips/public-resource?trip=linz-2027&resource=site
lieferte:
"Responses may only be constructed with status codes in the range 200 to 599"

Fix:
- zentrale normalizeHttpStatus()-Absicherung
- json() akzeptiert nur noch gültige numerische HTTP-Statuscodes
- mediaError() kann keine ungültigen Statuswerte mehr weiterreichen
- Diagnose-Endpunkt /api/trips/public-health ergänzt
- bestehender Published-Resource-Endpunkt bleibt auf korrektem json(data,200,headers)-Aufruf

Testreihenfolge:
1. /api/trips/public-health
2. /api/trips/public-resource?trip=linz-2027&resource=site
3. erst danach /linz-2027/

Brüssel-Schutz:
- public/index.html unverändert
- public/app.js unverändert
- public/styles.css unverändert
- public/404.html unverändert
