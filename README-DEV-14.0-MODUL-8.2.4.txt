DEV 14.0 – Modul 8.2.4 Auth-Recovery

- Redirect-/Upload-Brücke aus 8.2.3 vollständig entfernt.
- Reisevorschau startet keine eigene Microsoft-Anmeldung mehr.
- Vorschau übernimmt das bereits gültige Admin-Token sicher per same-origin postMessage vom Reise-Assistenten.
- API bleibt geschützt und validiert das Token serverseitig.
- Stale MSAL interaction_in_progress / interaction.status Einträge aus dem 8.2.x-Test werden beim Admin-Einstieg bereinigt.
- Normale Upload-Seite ist wieder ohne Vorschau-Sonderlogik.
- Kein Livegang / keine Veröffentlichung.
- Brüssel 2026 Reisedaten unverändert.
