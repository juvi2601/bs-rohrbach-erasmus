DEV 14.0 – Modul 8.2.1 Vorschau-Login Fix

- Reisevorschau öffnet kein zweites Microsoft-Popup mehr.
- Vorhandene MSAL-Sitzung wird bevorzugt verwendet.
- Falls eine Anmeldung nötig ist, erfolgt sie per Redirect innerhalb des Vorschau-Tabs.
- MSAL-Cache der Vorschau nutzt localStorage, damit die Anmeldung tabübergreifend verfügbar ist.
- Redirect-Ziel ist die Vorschauseite selbst; danach wird der Entwurf weiter geladen.
- Kein Livegang und keine Veröffentlichung.
- Brüssel 2026 bleibt unverändert.
