/* global DetailsDisclosure, trapFocus, removeTrapFocus */

if (!customElements.get('cart-summary-disclosure')) {
  class CartSummaryDisclosure extends DetailsDisclosure {
    constructor() {
      super();
      this.openBtn = this.querySelector('summary');
      this.closeBtn = this.querySelector('.js-close');
      this.overlay = document.querySelector('.overlay--cart-actions');
      this.drawerCloseHandler = this.handleDrawerClose.bind(this);
    }

    connectedCallback() {
      document.addEventListener('on:cart-drawer:before-close', this.drawerCloseHandler);
    }

    disconnectedCallback() {
      document.removeEventListener('on:cart-drawer:before-close', this.drawerCloseHandler);
    }

    /**
     * Handles 'click' events on the custom element.
     * @param {object} evt - Event object.
     */
    handleClick(evt) {
      if (!evt.target.matches('.js-close')) return;
      this.close();
    }

    /**
     * Handles 'on:cart-drawer:before-close' events.
     */
    handleDrawerClose() {
      if (this.disclosure.open) {
        this.close();
      }
    }

    /**
     * Opens the details element.
     */
    open() {
      super.open();

      if (this.closest('.cart-actions--stacked')) return;

      this.overlay.classList.add('is-visible');
      trapFocus(this);

      // Create event handler variables (so the bound event listeners can be removed).
      this.clickHandler = this.clickHandler || this.handleClick.bind(this);
      this.keyupHandler = (evt) => evt.key === 'Escape' && this.close();

      // Add event listeners (for while disclosure is open).
      this.addEventListener('click', this.clickHandler);
      this.addEventListener('keyup', this.keyupHandler);
      this.overlay.addEventListener('click', this.clickHandler);
    }

    /**
     * Closes the details element.
     */
    close() {
      this.overlay.classList.remove('is-visible');
      super.close();
      removeTrapFocus(this.openBtn);

      this.removeEventListener('click', this.clickHandler);
      this.removeEventListener('keyup', this.keyupHandler);
      this.overlay.removeEventListener('click', this.clickHandler);
    }
  }

  customElements.define('cart-summary-disclosure', CartSummaryDisclosure);
}
