BS Rohrbach Erasmus – Version 12.1.0 DEV.8.2

Hotfix für DEV.8:
- Initialisierungsfehler behoben: DEV.8 referenzierte noch den entfernten Button library-button.
- Dadurch brach der DOMContentLoaded-Handler vor init() ab und app blieb null.
- Microsoft-Login bleibt bei User.Read + Files.ReadWrite; Sites.Read.All wird NICHT angefordert.
- Freigabelink-Test bleibt READ ONLY.

Einspielen: Inhalt über den aktuellen Projektordner kopieren, ersetzen, committen und pushen.

Fix DEV.8.2:
- Entfernt den letzten Verweis auf das nicht mehr vorhandene Element library-button.
- Login-Ansicht setzt hidden nur noch bei tatsächlich vorhandenen DOM-Elementen.
- Keine Änderungen an Microsoft-/Entra-Berechtigungen oder Website-Inhalten.
