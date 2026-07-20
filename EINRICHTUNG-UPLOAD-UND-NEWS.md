# Einrichtung: Upload und News

## 1. Schüler-Upload mit Microsoft 365

1. Öffne Microsoft Forms mit deinem Schulkonto.
2. Erstelle ein neues Formular, zum Beispiel „Brüsselreise 2026 – Foto-Upload“.
3. Wähle bei den Formulareinstellungen:
   - **Nur Personen in meiner Organisation können antworten**
   - Name aufzeichnen
   - Eine Antwort pro Person nach Bedarf
4. Füge folgende Fragen hinzu:
   - Tag/Programmpunkt
   - Kurzer Bildtext
   - Dateiupload (JPG, PNG oder HEIC)
   - Zustimmung zur Veröffentlichung
5. Kopiere den Freigabelink.
6. Öffne `config.js` und ersetze:
   `HIER_MICROSOFT_FORMS_LINK_EINTRAGEN`
   durch den vollständigen Forms-Link.
7. Die Dateien landen im Microsoft-365-Speicher des Formulareigentümers bzw. der Gruppe.
8. Bilder immer erst nach Sichtung veröffentlichen.

Wichtig: Die Einschränkung auf Schulkonten wird durch Microsoft Forms umgesetzt, nicht durch Netlify.

## 2. News-Redaktion

Die Website enthält Decap CMS unter:
`https://DEINE-SEITE.netlify.app/admin/`

Damit Änderungen dauerhaft gespeichert und automatisch veröffentlicht werden, muss die Netlify-Seite mit einem GitHub- oder GitLab-Repository verbunden sein.

### Einrichtung in Netlify

1. Projektdateien in ein GitHub-Repository hochladen.
2. Netlify-Projekt mit diesem Repository verbinden.
3. In Netlify **Identity** aktivieren.
4. Registrierung auf **Invite only** stellen.
5. Unter Identity / Services **Git Gateway** aktivieren.
6. Dich selbst als Benutzer einladen.
7. Danach `/admin/` öffnen und anmelden.
8. Unter „Reiseportal“ → „News und Hinweise“ neue Beiträge anlegen.

Nach dem Speichern wird eine Änderung im Repository erzeugt und Netlify veröffentlicht die aktualisierte Website.

## 3. Datenschutz

- Keine privaten Telefonnummern oder Schülerdaten öffentlich anzeigen.
- Fotos mit erkennbaren Personen nur entsprechend den schulischen Einwilligungen veröffentlichen.
- Uploads vor Veröffentlichung prüfen.
- Schüler sollten keine Zugangsdaten direkt auf dieser Website eingeben; die Anmeldung erfolgt ausschließlich auf der offiziellen Microsoft-Seite.
