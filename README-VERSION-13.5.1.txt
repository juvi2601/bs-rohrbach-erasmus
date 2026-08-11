BS Rohrbach Erasmus+ – Version 13.5.1

Fix Microsoft-Anmeldung für „Benutzer & Rollen“:
- Rollen-Seite verwendet nun exakt den bereits funktionierenden Redirect aus /api/media/config
- MSAL-Konfiguration an den funktionierenden Foto-/Video-Upload angeglichen
- navigateToLoginRequestUrl deaktiviert
- Native Broker deaktiviert
- Session-Cache und Token-Fallback (silent -> popup) vereinheitlicht

Entra:
Die bereits ergänzte SPA-Redirect-URI /admin/access.html darf bestehen bleiben.
Es müssen keine zusätzlichen impliziten Tokenflows aktiviert werden.
