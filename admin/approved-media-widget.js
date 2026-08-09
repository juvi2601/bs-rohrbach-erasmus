(function () {
  var CMS = window.CMS;
  var h = window.h;
  var createClass = window.createClass;

  if (!CMS || !h || !createClass) {
    console.error('Fotoauswahl: Decap-CMS-Komponenten sind nicht verfügbar.');
    return;
  }

  function toArray(value) {
    if (!value) return [];
    if (typeof value.toJS === 'function') return value.toJS();
    return Array.isArray(value) ? value : [];
  }

  var ApprovedMediaListControl = createClass({
    getInitialState: function () {
      return { items: [], loading: true, error: '' };
    },

    componentDidMount: function () {
      var self = this;
      fetch('/api/media/gallery', { cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) throw new Error('Galerie konnte nicht geladen werden.');
          return response.json();
        })
        .then(function (data) {
          var items = Array.isArray(data && data.items) ? data.items : [];
          self.setState({
            items: items.filter(function (item) { return item.mediaType === 'image'; }),
            loading: false,
            error: ''
          });
        })
        .catch(function (error) {
          console.error('Fotoauswahl konnte nicht geladen werden.', error);
          self.setState({ error: error.message || 'Galerie konnte nicht geladen werden.', loading: false });
        });
    },

    selectedValues: function () {
      return toArray(this.props.value);
    },

    toggle: function (url) {
      var values = this.selectedValues();
      var next = values.indexOf(url) >= 0
        ? values.filter(function (value) { return value !== url; })
        : values.concat([url]);
      this.props.onChange(next);
    },

    render: function () {
      var self = this;
      var selected = this.selectedValues();

      if (this.state.loading) {
        return h('div', { style: { padding: '14px 0' } }, 'Freigegebene Fotos werden geladen …');
      }
      if (this.state.error) {
        return h('div', { style: { padding: '14px', border: '1px solid #d9a6a6', borderRadius: '8px' } }, this.state.error);
      }
      if (!this.state.items.length) {
        return h('p', null, 'Noch keine freigegebenen Fotos vorhanden.');
      }

      return h('div', null,
        h('div', { style: { marginBottom: '10px', fontWeight: '700' } }, selected.length + ' Foto(s) ausgewählt'),
        h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '10px'
          }
        }, this.state.items.map(function (item, index) {
          var url = item.image;
          var isSelected = selected.indexOf(url) >= 0;
          return h('button', {
            type: 'button',
            key: item.id || url || index,
            onClick: function () { self.toggle(url); },
            'aria-pressed': isSelected,
            title: isSelected ? 'Auswahl entfernen' : 'Foto auswählen',
            style: {
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '10px',
              border: isSelected ? '3px solid #0f9b78' : '1px solid #cfd8e3',
              background: isSelected ? '#eefaf6' : '#fff',
              textAlign: 'left'
            }
          },
            h('img', {
              src: url,
              alt: item.alt || item.title || 'Freigegebenes Foto',
              style: { width: '100%', height: '105px', objectFit: 'cover', borderRadius: '6px', display: 'block' }
            }),
            h('span', { style: { display: 'block', marginTop: '6px', fontSize: '12px', fontWeight: isSelected ? '700' : '500' } },
              isSelected ? '✓ Ausgewählt' : (item.day || item.title || 'Foto')
            )
          );
        }))
      );
    }
  });

  var ApprovedMediaListPreview = createClass({
    render: function () {
      var values = toArray(this.props.value);
      if (!values.length) return h('span', null, 'Keine Galeriefotos ausgewählt.');
      return h('div', null, values.map(function (src, index) {
        return h('img', {
          key: src || index,
          src: src,
          alt: 'Ausgewähltes Galeriefoto',
          style: { maxWidth: '160px', maxHeight: '110px', objectFit: 'cover', margin: '4px' }
        });
      }));
    }
  });

  CMS.registerWidget('approved_media_list', ApprovedMediaListControl, ApprovedMediaListPreview);
  console.info('Fotoauswahl DEV.14.2 wurde geladen.');
})();
