DEV 14.0 – Modul 8.3.4 Brüssel-Datenadapter

Architektur:
Reise-Assistent → Reise-Entwurf → /api/trips/draft-resource → Original-Brüssel-Datenverträge → originales index.html/styles.css/app.js.

Wichtig:
- Vorschau basiert auf dem echten public/index.html.
- Originale Renderfunktionen von app.js werden verwendet.
- app.js wurde nur verallgemeinert: externe Datenquelle, dynamische Jahres-/Reisebegriffe, Theme und optionale Bereiche.
- Titelbild/Hotelbild/Tages- und Programmbilder werden geschützt geladen und als Blob-URLs an die Original-Renderer übergeben.
- Programmpunktbilder wurden rückwärtskompatibel im Original-Timeline-Renderer ergänzt.
- Haupt-/Akzentfarbe greifen jetzt über die zentralen Theme-Variablen breiter.
- Brüssel 2026 behält über seine bestehenden JSON-Dateien das bisherige Verhalten.

Hinweis:
Manuelle Kartenorte werden bereits ins places-Format übersetzt. Automatische Geokodierung der eingegebenen Adressen folgt als eigener Schritt, damit keine Koordinaten manuell eingegeben werden müssen.
