BS Rohrbach Erasmus+ – DEV.14.7

Security-Fix für das Redaktions-CMS:
- Nach erfolgreichem GitHub-OAuth wird das tatsächlich angemeldete GitHub-Konto serverseitig über die GitHub-API geprüft.
- Standardmäßig ist ausschließlich der GitHub-Benutzer „juvi2601“ für das CMS freigeschaltet.
- Andere GitHub-Konten erhalten „Kein Zugriff auf die Redaktion“ und bekommen kein CMS-Zugriffstoken.
- Optional kann später die Cloudflare-Variable GITHUB_ADMIN_USERS als kommagetrennte Allowlist verwendet werden.
- Die bestehende Microsoft-Adminprüfung der R2-Medienfreigabe bleibt unverändert.
- Version 12.1.0-dev.14.7.

Hinweis:
Die Admin-HTML-Seiten selbst sind weiterhin technisch abrufbar; entscheidende Schreib-/Freigabeaktionen sind jedoch authentifiziert. Dieser Fix beschränkt den GitHub-CMS-Login serverseitig.
