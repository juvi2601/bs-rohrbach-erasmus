VERSION 12.1.0 DEV.7

Ziel
- Microsoft-Login fordert nun zusätzlich den delegierten Scope Sites.Read.All an.
- Bibliotheksdiagnose bleibt READ ONLY.
- Keine Dateien oder Ordner werden erstellt, geändert oder gelöscht.

Geändert
- SCOPES: User.Read, Files.ReadWrite, Sites.Read.All
- Rechtetest zeigt an, ob Sites.Read.All tatsächlich im Access Token steckt.
- Diagnoseauswertung erkennt den Fall /drives = 0 und /drive = 403 korrekt.

Test
1. Update einspielen und pushen.
2. /admin/microsoft.html mit Strg+F5 öffnen.
3. Abmelden.
4. Neu anmelden und zusätzliche Berechtigung akzeptieren.
5. Berechtigungen prüfen: Sites.Read.All muss in Token-Scopes erscheinen.
6. Bibliothekszugriff diagnostizieren.

Commit-Vorschlag
Version 12.1.0 DEV.7 – Sites.Read.All im Microsoft-Token
