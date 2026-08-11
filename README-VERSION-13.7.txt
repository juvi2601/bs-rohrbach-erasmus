BS Rohrbach Erasmus+ – Version 13.7 – Microsoft-Reise-Redaktion

Neu:
- Reisetagebuch, Live-Status und Galerie für Admin/Lehrkräfte aktiv
- keine GitHub-Konten für Lehrkräfte erforderlich
- Microsoft-Rolle wird bei jedem Lese-/Schreibzugriff serverseitig geprüft
- Änderungen werden als R2-Content-Override gespeichert
- öffentliche Website liest Diary/Gallery/Site automatisch aus R2, falls ein Redaktionsstand vorhanden ist
- statische GitHub-Dateien bleiben als sichere Basis/Fallback erhalten

Wichtig für Admin:
Sobald ein Bereich erstmals über die Microsoft-Reise-Redaktion gespeichert wurde, hat dessen R2-Redaktionsstand Vorrang
vor der statischen JSON-Datei aus GitHub. So können Lehrkräfte live ändern, ohne GitHub-Rechte und ohne Deployment.
