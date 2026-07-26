(function () {
  var CMS = window.CMS;
  var h = window.h;
  var createClass = window.createClass;
  var L = window.L;

  if (!CMS || !h || !createClass) {
    console.error('Karteneditor: Decap-CMS-Komponenten sind nicht verfügbar.');
    return;
  }
  if (!L) {
    console.error('Karteneditor: Leaflet konnte nicht geladen werden.');
    return;
  }

  var DEFAULT_POINT = { lat: 50.8467, lng: 4.3525 };

  function numberValue(value, key, fallback) {
    var raw;
    if (value && typeof value.get === 'function') raw = value.get(key);
    else raw = value && value[key];
    var n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  var MapPointControl = createClass({
    getInitialState: function () {
      return { searchStatus: '' };
    },

    getPoint: function () {
      return {
        lat: numberValue(this.props.value, 'lat', DEFAULT_POINT.lat),
        lng: numberValue(this.props.value, 'lng', DEFAULT_POINT.lng)
      };
    },

    componentDidMount: function () {
      var self = this;
      try {
        var point = this.getPoint();
        this.map = L.map(this.mapNode, {
          scrollWheelZoom: false,
          zoomControl: true
        }).setView([point.lat, point.lng], 14);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap-Mitwirkende'
        }).addTo(this.map);

        this.marker = L.marker([point.lat, point.lng], { draggable: true }).addTo(this.map);
        this.map.on('click', function (event) {
          self.setPoint(event.latlng.lat, event.latlng.lng, true);
        });
        this.marker.on('dragend', function () {
          var p = self.marker.getLatLng();
          self.setPoint(p.lat, p.lng, false);
        });

        var refresh = function () {
          if (self.map) self.map.invalidateSize(false);
        };
        this.refreshTimers = [100, 450, 1000].map(function (delay) {
          return window.setTimeout(refresh, delay);
        });

        if ('ResizeObserver' in window) {
          this.resizeObserver = new ResizeObserver(refresh);
          this.resizeObserver.observe(this.mapNode);
        }
      } catch (error) {
        console.error('Karteneditor konnte nicht initialisiert werden.', error);
        this.setState({ searchStatus: 'Die Karte konnte nicht geladen werden. Seite bitte neu laden.' });
      }
    },

    componentDidUpdate: function (prevProps) {
      if (!this.map || !this.marker || prevProps.value === this.props.value) return;
      var point = this.getPoint();
      var markerPoint = this.marker.getLatLng();
      if (Math.abs(markerPoint.lat - point.lat) > 0.000001 || Math.abs(markerPoint.lng - point.lng) > 0.000001) {
        this.marker.setLatLng([point.lat, point.lng]);
      }
      this.map.invalidateSize(false);
    },

    componentWillUnmount: function () {
      if (this.refreshTimers) this.refreshTimers.forEach(window.clearTimeout);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.map) this.map.remove();
    },

    setPoint: function (lat, lng, moveMap) {
      if (!this.map || !this.marker) return;
      var point = {
        lat: Number(Number(lat).toFixed(6)),
        lng: Number(Number(lng).toFixed(6))
      };
      this.marker.setLatLng([point.lat, point.lng]);
      if (moveMap !== false) this.map.panTo([point.lat, point.lng]);
      this.props.onChange(point);
      this.setState({ searchStatus: 'Position übernommen ✓' });
    },

    useMapCenter: function () {
      if (!this.map) return;
      var p = this.map.getCenter();
      this.setPoint(p.lat, p.lng, false);
    },

    searchAddress: function (event) {
      var self = this;
      event.preventDefault();
      var query = ((this.searchInput && this.searchInput.value) || '').trim();
      if (!query) {
        this.setState({ searchStatus: 'Bitte einen Ort oder eine Adresse eingeben.' });
        return;
      }

      this.setState({ searchStatus: 'Adresse wird gesucht …' });
      var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=de&q=' + encodeURIComponent(query);
      fetch(url, { headers: { Accept: 'application/json' } })
        .then(function (response) {
          if (!response.ok) throw new Error('search');
          return response.json();
        })
        .then(function (rows) {
          if (!rows.length) {
            self.setState({ searchStatus: 'Kein passender Ort gefunden.' });
            return;
          }
          var lat = Number(rows[0].lat);
          var lng = Number(rows[0].lon);
          self.map.setView([lat, lng], 17);
          self.setPoint(lat, lng, false);
          self.setState({ searchStatus: 'Adresse gefunden und Position übernommen ✓' });
        })
        .catch(function (error) {
          console.error('Adresssuche fehlgeschlagen.', error);
          self.setState({ searchStatus: 'Suche derzeit nicht verfügbar. Bitte direkt auf die Karte klicken.' });
        });
    },

    render: function () {
      var self = this;
      var point = this.getPoint();
      return h('div', { className: 'map-point-widget' },
        h('form', { className: 'map-point-search', onSubmit: this.searchAddress },
          h('input', {
            ref: function (node) { self.searchInput = node; },
            type: 'search',
            placeholder: 'Adresse oder Ort suchen, z. B. Atomium Brüssel',
            'aria-label': 'Adresse oder Ort suchen'
          }),
          h('button', { type: 'submit' }, 'Suchen')
        ),
        h('div', {
          ref: function (node) { self.mapNode = node; },
          className: 'map-point-canvas',
          role: 'application',
          'aria-label': 'Karte zur Auswahl des Standortes'
        }),
        h('div', { className: 'map-point-footer' },
          h('div', { className: 'map-point-values' },
            h('span', null, 'Breitengrad: ', h('strong', null, point.lat.toFixed(6))),
            h('span', null, 'Längengrad: ', h('strong', null, point.lng.toFixed(6)))
          ),
          h('button', { type: 'button', className: 'map-center-button', onClick: this.useMapCenter }, 'Kartenmitte übernehmen')
        ),
        h('p', { className: 'map-point-status', 'aria-live': 'polite' },
          this.state.searchStatus || 'Klicke auf die Karte oder verschiebe den Marker. Die Position wird automatisch gespeichert.'
        )
      );
    }
  });

  var MapPointPreview = createClass({
    render: function () {
      var lat = numberValue(this.props.value, 'lat', DEFAULT_POINT.lat);
      var lng = numberValue(this.props.value, 'lng', DEFAULT_POINT.lng);
      return h('span', null, lat.toFixed(6) + ', ' + lng.toFixed(6));
    }
  });

  CMS.registerWidget('map-point', MapPointControl, MapPointPreview);
  console.info('Karteneditor 10.4.2 wurde geladen.');
})();
