DEV 14.0 – Modul 10.0.2 Microsoft-Login Rollenverwaltung

Fix:
- JavaScript-Namenskollision auf /admin/teilnehmer.html beseitigt.
- Die lokale Variable 'msal' hatte die globale MSAL-Bibliothek überschattet.
- Verwendung jetzt analog zur funktionierenden Medienfreigabe über 'msalApp'.
- loginPopup, acquireTokenSilent, acquireTokenPopup und logoutPopup verwenden dieselbe initialisierte Instanz.

Bewusst unverändert:
- Öffentliche Brüssel-/Linz-Seiten und deren Footer
- Upload
- Medienfreigabe
- Rollen-/CSV-Logik aus 10.0.1
