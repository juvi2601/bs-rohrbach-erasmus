DEV 14.0 – Modul 10.0.1 Teilnehmer & Rollen pro Reise

Neu:
- Reisebezogene Rollenverwaltung unter /admin/teilnehmer.html?trip=<reise>
- Manuelles Hinzufügen mit E-Mail, Name und Rolle
- Rollenänderung per Dropdown
- CSV-Datei oder CSV-Text
- Spalten: E-Mail; Name; Rolle
- Rollen: admin, teacher, student
- Ohne Rolle automatisch student
- Speicherung je Reise in R2: __system/access/<reise>/roster.json
- Die Reiseverwaltung verlinkt auf „Teilnehmer & Rollen“

Sicherheit:
- Nur Admins der jeweiligen Reise dürfen die Liste lesen oder ändern.
- Bestehende fixe Systemzugänge bleiben gesperrt/unveränderbar und dienen als Sicherheitsnetz.
- Dynamische Rollen werden unmittelbar von tripAccessFor berücksichtigt.

Öffentliche Brüssel-/Linz-Seiten, Upload und Medienfreigabe unverändert.
