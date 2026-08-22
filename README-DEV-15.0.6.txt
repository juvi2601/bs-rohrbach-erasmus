DEV 15.0.6 – Robuster Handbuch-Login

Fix:
- Lehrkräfte-Handbuch öffnet aus Redaktion/Hilfe/Admin nicht mehr automatisch in einem neuen Tab.
- Dadurch bleibt die bestehende MSAL-sessionStorage-Anmeldung erhalten.
- Der Viewer versucht ausschließlich stille Anmeldung.
- Falls keine Sitzung vorhanden ist, erscheint ein sichtbarer Button „Mit Microsoft anmelden“.
- Ein Login-Popup wird nur nach bewusstem Benutzerklick geöffnet und kann daher nicht mehr vom Popup-Blocker als automatisches Popup verworfen werden.
- PDF bleibt weiterhin serverseitig geschützt.
