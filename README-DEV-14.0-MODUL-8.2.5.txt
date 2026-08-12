DEV 14.0 – Modul 8.2.5 MSAL Recovery
- Festhängende MSAL-Interaktionsmarker werden in sessionStorage und localStorage bereinigt.
- Bereinigung erfolgt vor dem Initialisieren der Microsoft-Anmeldung.
- Wenn interaction_in_progress nochmals auftritt, wird der Status zurückgesetzt und der Login kann direkt nochmals gestartet werden.
- Keine pauschale Löschung von Account-/Token-Caches.
- Vorschau bleibt ohne eigenen Redirect.
