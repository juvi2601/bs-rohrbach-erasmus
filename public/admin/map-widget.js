(function () {
  const CMS = window.CMS;
  const React = window.React;
  if (!CMS || !React || !window.L) {
    console.error('Karteneditor konnte nicht geladen werden.');
    return;
  }

  const h = React.createElement;
  const DEFAULT_POINT = { lat: 50.8467, lng: 4.3525 };

  const numberValue = (value, key, fallback) => {
    if (value && typeof value.get === 'function') {
      const n = Number(value.get(key));
      return Number.isFinite(n) ? n : fallback;
    }
    const n = Number(value && value[key]);
    return Number.isFinite(n) ? n : fallback;
  };

  class MapPointControl extends React.Component {
    constructor(props) {
      super(props);
      this.mapNode = React.createRef();
      this.searchInput = React.createRef();
      this.state = { searchStatus: '' };
      this.setPoint = this.setPoint.bind(this);
      this.searchAddress = this.searchAddress.bind(this);
      this.useMapCenter = this.useMapCenter.bind(this);
    }

    getPoint() {
      return {
        lat: numberValue(this.props.value, 'lat', DEFAULT_POINT.lat),
        lng: numberValue(this.props.value, 'lng', DEFAULT_POINT.lng)
      };
    }

    componentDidMount() {
      const point = this.getPoint();
      this.map = L.map(this.mapNode.current, { scrollWheelZoom: false }).setView([point.lat, point.lng], 14);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap-Mitwirkende'
      }).addTo(this.map);
      this.marker = L.marker([point.lat, point.lng], { draggable: true }).addTo(this.map);
      this.map.on('click', event => this.setPoint(event.latlng.lat, event.latlng.lng));
      this.marker.on('dragend', () => {
        const p = this.marker.getLatLng();
        this.setPoint(p.lat, p.lng, false);
      });
      setTimeout(() => this.map.invalidateSize(), 250);
    }

    componentDidUpdate(prevProps) {
      if (!this.map || prevProps.value === this.props.value) return;
      const point = this.getPoint();
      const markerPoint = this.marker.getLatLng();
      if (Math.abs(markerPoint.lat - point.lat) > 0.000001 || Math.abs(markerPoint.lng - point.lng) > 0.000001) {
        this.marker.setLatLng([point.lat, point.lng]);
      }
    }

    componentWillUnmount() {
      if (this.map) this.map.remove();
    }

    setPoint(lat, lng, moveMap = true) {
      const point = { lat: Number(Number(lat).toFixed(6)), lng: Number(Number(lng).toFixed(6)) };
      this.marker.setLatLng([point.lat, point.lng]);
      if (moveMap) this.map.panTo([point.lat, point.lng]);
      this.props.onChange(point);
      this.setState({ searchStatus: 'Position übernommen ✓' });
    }

    useMapCenter() {
      const p = this.map.getCenter();
      this.setPoint(p.lat, p.lng, false);
    }

    async searchAddress(event) {
      event.preventDefault();
      const query = (this.searchInput.current && this.searchInput.current.value || '').trim();
      if (!query) {
        this.setState({ searchStatus: 'Bitte einen Ort oder eine Adresse eingeben.' });
        return;
      }
      this.setState({ searchStatus: 'Adresse wird gesucht …' });
      try {
        const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=de&q=' + encodeURIComponent(query);
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('search');
        const rows = await response.json();
        if (!rows.length) {
          this.setState({ searchStatus: 'Kein passender Ort gefunden.' });
          return;
        }
        this.map.setView([Number(rows[0].lat), Number(rows[0].lon)], 17);
        this.setPoint(rows[0].lat, rows[0].lon, false);
        this.setState({ searchStatus: 'Adresse gefunden und Position übernommen ✓' });
      } catch {
        this.setState({ searchStatus: 'Suche derzeit nicht verfügbar. Bitte direkt auf die Karte klicken.' });
      }
    }

    render() {
      const point = this.getPoint();
      return h('div', { className: 'map-point-widget' },
        h('form', { className: 'map-point-search', onSubmit: this.searchAddress },
          h('input', { ref: this.searchInput, type: 'search', placeholder: 'Adresse oder Ort suchen, z. B. Atomium Brüssel' }),
          h('button', { type: 'submit' }, 'Suchen')
        ),
        h('div', { ref: this.mapNode, className: 'map-point-canvas', role: 'application', 'aria-label': 'Karte zur Auswahl des Standortes' }),
        h('div', { className: 'map-point-footer' },
          h('div', { className: 'map-point-values' },
            h('span', null, 'Breitengrad: ', h('strong', null, point.lat.toFixed(6))),
            h('span', null, 'Längengrad: ', h('strong', null, point.lng.toFixed(6)))
          ),
          h('button', { type: 'button', className: 'map-center-button', onClick: this.useMapCenter }, 'Kartenmitte übernehmen')
        ),
        h('p', { className: 'map-point-status', 'aria-live': 'polite' }, this.state.searchStatus || 'Klicke auf die Karte oder verschiebe den Marker. Die Position wird automatisch gespeichert.')
      );
    }
  }

  const MapPointPreview = props => {
    const lat = numberValue(props.value, 'lat', DEFAULT_POINT.lat);
    const lng = numberValue(props.value, 'lng', DEFAULT_POINT.lng);
    return h('span', null, lat.toFixed(6) + ', ' + lng.toFixed(6));
  };

  CMS.registerWidget('map-point', MapPointControl, MapPointPreview);
})();
