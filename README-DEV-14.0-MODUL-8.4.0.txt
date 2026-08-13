DEV 14.0 – Modul 8.4.0
Stabiler Master-Template-Meilenstein

Basis:
- exakt DEV 14.0 Modul 8.3.8 (bestätigter Stand mit wieder korrekter Brüsselwebsite)

Sicherheitsgrenze:
- public/index.html unverändert
- public/app.js unverändert
- public/styles.css unverändert
- public/app-dynamic.js unverändert
- public/styles-dynamic.css unverändert

Neu:
- robustes Geocoding ausschließlich im Worker
- Nominatim primär, Photon als Fallback
- mehrere Suchvarianten aus Name / Adresse / Reiseziel / Land
- Unterkunft wird automatisch als Kartenort ergänzt
- Version konsistent auf 14.0-dev.8.4.0

Ziel:
Brüssel 2026 bleibt stabil. Neue Reisen verwenden weiterhin das getrennte dynamische Master-Template.
