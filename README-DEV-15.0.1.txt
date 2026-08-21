DEV 15.0.1 – Reisebezogenes Admin-Dashboard & Redaktion

Wesentliche Korrektur:
- Admin- und Redaktionsbereich besitzen jetzt einen eindeutigen aktiven Reise-Kontext.
- Der Kontext wird über ?trip=<reise> übergeben und zusätzlich lokal als letzte Auswahl gespeichert.
- Dashboard zeigt die aktive Reise deutlich an und bietet eine Reiseauswahl.
- Links zu Website, Hilfe, Reise-Redaktion, Medien, Tagebuch, Live-Status, Galerie und Teilnehmern übernehmen die aktive Reise.
- Einstieg über „Administrator“ auf Brüssel bzw. dynamischen Reisen übergibt automatisch die richtige Reise.

Serverseitige Sicherheit:
- /api/access/me prüft die konkret ausgewählte Reise.
- Tagebuch, Galerie und Live-Status werden in __system/editor/<reise>/... getrennt gespeichert.
- Dynamische veröffentlichte Reisen lesen ihre eigenen Redaktions-Overrides.
- Änderungen an Luxemburg/Linz/etc. können dadurch Brüssel nicht überschreiben.
- Mediengalerie und alte Access-Endpunkte wurden ebenfalls reisebezogen abgesichert.

Dashboard:
- Inhalte und Pre-Flight-Check werden aus der aktiven Reise gelesen.
- Keine fest verdrahtete „Brüsselreise läuft“-Anzeige mehr.
- Für dynamische Reisen wird die Microsoft-/R2-Redaktion statt des Brüssel-GitHub-CMS bewertet.

Version: 15.0.1-dev
