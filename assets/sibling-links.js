/**
 * Component for coupling external product links with the variant picker.
 */
if (!customElements.get('sibling-links')) {
  class PreloadLinks extends HTMLElement {
    connectedCallback() {
      this.querySelectorAll('button').forEach((link) => {
        link.addEventListener('mouseenter', this.handleMouseEnter.bind(this), { once: true });
        link.addEventListener('focus', this.handleFocus.bind(this), { once: true });
        link.addEventListener('click', this.handleClick.bind(this), { once: false });
      });

      this.toggleAttribute('active', true);
    }

    /**
     * Handles the mouse enter event on a link.
     * @param {object} evt - Event object.
     */
    handleMouseEnter(evt) {
      this.preload(evt.currentTarget);
    }

    /**
     * Handles the focus event on a link.
     * @param {object} evt - Event object.
     */
    handleFocus(evt) {
      this.preload(evt.currentTarget);
    }

    /**
     * Handles the click event on a link.
     * @param {object} evt - Event object.
     */
    handleClick(evt) {
      evt.preventDefault();
      const vp = this.closest('.shopify-section, .js-quickbuy').querySelector('variant-picker');
      vp.handleVariantChange({
        target: evt.currentTarget
      });
    }

    /**
     * Handle preloading this link.
     * @param {HTMLElement} link - Link to preload.
     */
    preload(link) {
      const vp = this.closest('.shopify-section, .js-quickbuy').querySelector('variant-picker');
      vp.handleLabelMouseEnter({
        currentTarget: link
      });
    }
  }

  customElements.define('sibling-links', PreloadLinks);
}
