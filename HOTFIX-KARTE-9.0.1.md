# Hotfix 9.0.1 – Reisekarte

## Ursache
Der Subresource-Integrity-Prüfwert der Leaflet-CSS-Datei enthielt einen Tippfehler. Moderne Browser blockierten deshalb das Stylesheet. Die Kartenlogik lief, aber Kartenkacheln, Marker und Leaflet-Bedienelemente wurden nicht korrekt dargestellt.

## Korrektur
Der offizielle SHA-256-Prüfwert wurde in `index.html` und `public/index.html` korrigiert.

## Installation
Den vollständigen Inhalt dieses Ordners in das bestehende GitHub-Repository kopieren, vorhandene Dateien ersetzen, committen und pushen. Danach Cloudflare-Deployment abwarten und die Website mit Strg+F5 neu laden.
