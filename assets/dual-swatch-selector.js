if (!customElements.get('dual-swatch-selector')) {
  class DualSwatchSelector extends HTMLElement {
    constructor() {
      super();
      this.nativeSelect = this.querySelector('select');
      this.customSelect = this.querySelector('custom-select');
      this.shadeButtons = this.querySelectorAll('.js-change-shade');
      this.swatchRadios = this.querySelectorAll('input[type="radio"].js-option');
      this.urlShade = DualSwatchSelector.getUrlParam('shade');
      this.isSiblingSelector = this.closest('.product-siblings');

      if (this.isSiblingSelector) {
        this.customSelect?.addEventListener('change', this.handleSiblingChange.bind(this));
      } else {
        this.nativeSelect?.addEventListener('change', this.handleSelectChange.bind(this));
      }

      this.swatchRadios.forEach((swatchRadio) => {
        swatchRadio.addEventListener('change', this.handleRadioChange.bind(this));
      });

      this.shadeButtons.forEach((shadeButton) => {
        shadeButton.addEventListener('click', this.handleShadeChange.bind(this));
        if (this.urlShade?.toLowerCase() === shadeButton.dataset.selectedShade?.toLowerCase()) {
          shadeButton.click();
        }
      });

      // Handle unavailable variant
      const colorLabel = this.querySelector('.js-color-text');
      if (colorLabel) {
        const selectedInput = this.querySelector('input:checked');
        colorLabel.textContent = selectedInput ? selectedInput.value : '';
      }
    }

    handleSiblingChange(evt) {
      const productRelativeUrl = evt.detail.selectedValue.match(/\/products\/.*$/)[0];
      const link = this.querySelector(`button[data-product-url$="${CSS.escape(productRelativeUrl)}"]`);
      if (link) {
        link.click();
      }
    }

    handleSelectChange(evt) {
      evt.stopPropagation();

      // Trigger a click event on the corresponding swatch value
      this.querySelector(`input[value="${CSS.escape(evt.target.value)}"]`)?.click();
    }

    handleRadioChange(evt) {
      if (evt.target.checked) {
        const customSelectOption = this.customSelect?.querySelector(`li[data-value="${CSS.escape(evt.target.value)}"]`);
        if (customSelectOption) {
          this.customSelect.selectOption(customSelectOption);
        }
      }
    }

    static updateURLWithShade(shade) {
      if (Shopify.designMode) {
        theme.dualSwatchSelectorShade = shade;
        return;
      }

      const url = new URL(window.location);
      if (shade) {
        url.searchParams.set('shade', shade);
      } else {
        url.searchParams.delete('shade');
      }
      window.history.replaceState({}, '', url);
    }

    static getUrlParam(param) {
      if (Shopify.designMode && param === 'shade') {
        return theme.dualSwatchSelectorShade;
      }

      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(param);
    }

    static setParamInHref(href, param, value) {
      const url = new URL(href, window.location.origin);

      if (value !== '') {
        url.searchParams.set(param, value);
      } else {
        url.searchParams.delete(param);
      }

      return url.toString();
    }

    handleShadeChange(evt) {
      if (!this.dataset.featuredProduct) {
        DualSwatchSelector.updateURLWithShade(evt.target.dataset.selectedShade);
      }

      // Change the active button
      this.shadeButtons.forEach((shadeButton) => {
        shadeButton.classList.toggle('font-bold', evt.target === shadeButton);
      });

      // Hide the relevant shades
      this.querySelectorAll('[data-shade]').forEach((elem) => {
        elem.hidden = elem.dataset.shade !== evt.target.dataset.selectedShade && evt.target.dataset.selectedShade !== '';

        if (this.isSiblingSelector && elem.tagName === 'A' && !this.dataset.featuredProduct) {
          elem.href = DualSwatchSelector.setParamInHref(elem.href, 'shade', evt.target.dataset.selectedShade);
        } else if (this.isSiblingSelector && elem.classList.contains('custom-select__option') && !this.dataset.featuredProduct) {
          elem.dataset.value = DualSwatchSelector.setParamInHref(elem.dataset.value, 'shade', evt.target.dataset.selectedShade);
        }
      });

      // If there are no visible selections, select the first visible
      if (this.isSiblingSelector) {
        if (!this.querySelector('.opt-label.active:not([hidden])')) {
          const link = this.querySelector('.opt-label:not([hidden])');
          link.click();
        }
      } else if (![...this.swatchRadios].find((rad) => !rad.hidden && rad.checked)) {
        let foundVisibleSwatch = false;
        this.swatchRadios.forEach((radio) => {
          if (!foundVisibleSwatch && !radio.hasAttribute('hidden')) {
            radio.click();
            foundVisibleSwatch = true;
          }
        });
      }
    }
  }

  customElements.define('dual-swatch-selector', DualSwatchSelector);
}
