# Version 12.1.0 DEV.1 – Microsoft-Rechtetest

## Ziel
Diese Entwicklungsstufe prüft, ob der Foto-Workflow mit den vorhandenen Benutzerrechten als delegierte Microsoft-Anmeldung möglich ist.

## Neu
- Microsoft-Anmeldung im Browser mit MSAL und PKCE vorbereitet.
- Test der delegierten Scopes `User.Read` und `Files.ReadWrite`.
- Prüfung von Benutzerprofil und persönlichem Microsoft-Drive.
- Bestehender App-only-Test bleibt als Vergleich erhalten.
- Keine Dateien in `public/content/` wurden verändert.

## Geänderte Dateien
- `src/index.js`
- `public/admin/microsoft.html`
- `public/admin/microsoft-365.html`
- `admin/microsoft.html`
- `admin/microsoft-365.html`
- `public/version.json`

## Vor dem Test in Microsoft Entra
Bei der bestehenden App-Registrierung unter **Authentication** eine Plattform **Single-page application** hinzufügen und diese Redirect-URI eintragen:

`https://erasmus-bsrohrbach.eu/admin/microsoft.html`

Unter **API permissions** werden als delegierte Berechtigungen benötigt:
- `User.Read`
- `Files.ReadWrite`

Ob dafür in eurem Tenant eine Zustimmung möglich ist, zeigt anschließend der neue Test.

## Installation
1. Inhalt dieses Update-Ordners in das Repository kopieren.
2. Vorhandene Dateien ersetzen.
3. Commit: `Version 12.1.0 DEV.1 – Microsoft-Rechtetest`
4. Push origin.
