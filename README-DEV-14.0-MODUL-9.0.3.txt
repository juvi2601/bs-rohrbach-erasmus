DEV 14.0 – Modul 9.0.3 Zweite Reise-URL reserviert

Neu:
- /linz-2027/ ist als zukünftige Reise-URL reserviert.
- Intern ist sie mit dem bestehenden Entwurf testreise-2027 verknüpft.
- Die Reise wird unter /linz-2027/ NOCH NICHT öffentlich angezeigt.
- Direkter Aufruf liefert bewusst „noch nicht veröffentlicht“.
- /api/trips/routes zeigt die Verknüpfung als draft / published:false.
- /api/trips/route-draft?route=linz-2027 erlaubt Admins die interne Verknüpfung zu prüfen.
- publishingEnabled bleibt false.

Unverändert:
- /
- /bruessel-2026/
- Brüssel-HTML/CSS/JS
- dynamisches Master-Template
