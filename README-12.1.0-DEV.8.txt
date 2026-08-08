Version 12.1.0 DEV.8 – Adminfreier SharePoint-/OneDrive-Zielordner-Test

Ziel:
- KEIN Sites.Read.All mehr im Login
- KEINE Administratorzustimmung notwendig
- Test eines direkten Microsoft-Freigabelinks mit User.Read + Files.ReadWrite
- weiterhin 100 % READ ONLY

Vorgehen:
1. Update in Projekt kopieren, committen und pushen.
2. /admin/microsoft.html mit Strg+F5 öffnen.
3. Einmal abmelden und neu anmelden. Es darf keine Admin-Genehmigung mehr verlangt werden.
4. Berechtigungen prüfen: Token sollte User.Read + Files.ReadWrite enthalten, nicht Sites.Read.All.
5. In SharePoint/OneDrive den gewünschten Foto-Zielordner öffnen und über "Link kopieren" einen Freigabelink erzeugen.
6. Link in DEV.8 einfügen und "Freigabelink prüfen (READ ONLY)" klicken.

DEV.8 erstellt, ändert und löscht keine Datei und keinen Ordner.

Commit-Vorschlag:
Version 12.1.0 DEV.8 – Adminfreier Zielordner-Test
