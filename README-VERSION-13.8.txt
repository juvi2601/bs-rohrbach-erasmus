BS Rohrbach Erasmus+ – Version 13.8 – Zentraler Rollen-Login

Neu:
- öffentlicher Footer-Link „Administrator“ führt zentral zu /admin/login.html
- Microsoft-Anmeldung erkennt die Reise-Rolle automatisch
- Admin -> vollständiges Admin-Dashboard
- Lehrkraft -> Reise-Redaktion
- alle anderen Konten -> „Sie haben keinen Zugriff auf diesen Bereich.“
- direkter Aufruf von /admin/ wird ebenfalls rollenabhängig geschützt:
  Lehrkräfte werden zur Reise-Redaktion umgeleitet, Unberechtigte zum Login
- bestehende Microsoft-/Entra-Konfiguration wird weiterverwendet; keine neue Redirect-URI nötig
