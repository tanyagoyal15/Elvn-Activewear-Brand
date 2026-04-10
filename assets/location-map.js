/**
 * Loads a script.
 * @param {string} src - Url of script to load.
 * @returns {Promise}
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

/* global google */

if (!customElements.get('location-map')) {
  class LocationMap extends HTMLElement {
    constructor() {
      super();
      if (!this.dataset.apiKey || !this.dataset.address) return;

      window.initLazyScript(this, this.init.bind(this));
    }

    init() {
      this.mapOptions = {
        scrollwheel: false,
        zoom: 14
      };

      // Map ID for styling.
      if (this.dataset.mapId) {
        this.mapOptions.mapId = this.dataset.mapId;
      }

      loadScript(`https://maps.googleapis.com/maps/api/js?key=${this.dataset.apiKey}`)
        .then(this.createMap.bind(this));
    }

    createMap() {
      const map = new google.maps.Map(this, this.mapOptions);
      const geocoder = new google.maps.Geocoder();

      geocoder.geocode({ address: this.dataset.address })
        .then(({ results }) => {
          if (results[0]) {
            map.setCenter(results[0].geometry.location);

            // eslint-disable-next-line no-new
            new google.maps.Marker({
              map,
              position: results[0].geometry.location,
              clickable: false
            });
          }
        })
        .catch((error) => {
          const mapContainer = this.querySelector('.map-container');

          if (Shopify.designMode && mapContainer) {
            mapContainer.innerHTML = `<div class="alert mb-8 bg-error-bg text-error-text">${error}</div>`;
          }
        });
    }
  }

  customElements.define('location-map', LocationMap);
}
