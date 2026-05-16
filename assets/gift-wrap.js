if (!customElements.get('cart-gift-wrap')) {
  class CartGiftWrap extends HTMLElement {
    constructor() {
      super();
      this.cartDrawer = document.querySelector('cart-drawer');
      this.cartSummary = document.querySelector('.cart__summary');
      this.cartItems = document.querySelector('cart-items');
      this.giftWrapId = this.dataset.gwProductId;
      this.loader = this.querySelector('.cart-item__loader');

      this.fetchRequestOpts = {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      };

      this.init();
      this.addListeners();
    }

    disconnectedCallback() {
      if (this.cartDrawer) {
        this.cartDrawer.removeEventListener('change', this.giftWrapHandler);
      }

      if (this.cartSummary) {
        this.cartSummary.removeEventListener('change', this.giftWrapHandler);
      }
    }

    init() {
      this.checkGiftWrap();
    }

    addListeners() {
      this.giftWrapHandler = this.giftWrapHandler || this.handleGiftWrapChange.bind(this);
      if (this.cartDrawer) {
        this.cartDrawer.addEventListener('change', this.giftWrapHandler);
      }
      if (this.cartSummary) {
        this.cartSummary.addEventListener('change', this.giftWrapHandler);
      }
    }

    handleGiftWrapChange(evt) {
      if (evt.target.matches('[name="attributes[gift-wrap]"]')) {
        evt.target.checked ? this.setGiftWrap() : this.removeGiftWrap();
      } else if (evt.target.matches('#gift-note')) {
        this.updateGiftNoteAttribute(evt.target.value);
      }
    }

    setGiftWrap() {
      const formData = new FormData();
      formData.append('id', this.giftWrapId);
      formData.append('quantity', '1');
      formData.append('properties[_gift-wrap]', true);

      let fetchRequestOpts = {
        ...this.fetchRequestOpts,
        headers: {
          Accept: 'application/javascript',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
      };

      this.startFetch();
      fetch(theme.routes.cartAdd, fetchRequestOpts).then((response) => {
        if (!response.ok) throw new Error('Failed to add Gift Wrap product');
        return response.json();
      }).then(() => {
        fetchRequestOpts = {
          ...this.fetchRequestOpts,
          body: JSON.stringify({
            attributes: { 'gift-wrap': true }
          })
        };

        return fetch(theme.routes.cartUpdate, fetchRequestOpts).then((response) => {
          if (!response.ok) throw new Error('Failed to set Gift Wrap cart attribute');
          return response.json();
        }).then(() => {
          if (this.cartDrawer) {
            this.cartDrawer.refresh().finally(this.endFetch.bind(this));
          } else if (this.cartItems) {
            this.cartItems.refresh().finally(this.endFetch.bind(this));
          } else {
            this.endFetch();
          }
        });
      }).catch(this.endFetch.bind(this));
    }

    removeGiftWrap() {
      document.getElementById('gift-wrap').checked = false;

      const fetchRequestOpts = {
        ...this.fetchRequestOpts,
        body: JSON.stringify({
          updates: { [this.giftWrapId]: 0 },
          attributes: { 'gift-wrap': '', 'gift-note': '' }
        })
      };

      this.startFetch();
      fetch(theme.routes.cartUpdate, fetchRequestOpts).then(() => {
        if (this.cartDrawer) {
          this.cartDrawer.refresh().finally(this.endFetch.bind(this));
        } else if (this.cartItems) {
          this.cartItems.refresh().finally(this.endFetch.bind(this));
        } else {
          this.endFetch();
        }
      });
    }

    updateGiftNoteAttribute(note) {
      const fetchRequestOpts = {
        ...this.fetchRequestOpts,
        body: JSON.stringify({
          attributes: { 'gift-note': note }
        })
      };
      this.startFetch();
      fetch(theme.routes.cartUpdate, fetchRequestOpts).finally(this.endFetch.bind(this));
    }

    startFetch() {
      if (this && this.cartDrawer) {
        this.cartDrawer.querySelector('.cart-actions')?.classList.add('pointer-events-none', 'disabled');
      }
      this.querySelector('.cart-gift-wrap__inner').classList.add('pointer-events-none', 'disabled');
      this.loader.hidden = false;
    }

    endFetch() {
      if (this && this.cartDrawer) {
        this.cartDrawer.querySelector('.cart-actions')?.classList.remove('pointer-events-none', 'disabled');
      }
      this.querySelector('.cart-gift-wrap__inner').classList.remove('pointer-events-none', 'disabled');
      this.loader.hidden = true;
    }

    checkGiftWrap() {
      const itemSize = parseInt(this.dataset.gwCartItemSize, 10);
      const giftWrapsInCart = parseInt(this.dataset.gwInCart, 10);
      const isGiftWrappingAttributeBlank = this.dataset.gwAttributeBlank === 'true';

      if (itemSize === 1 && giftWrapsInCart > 0) {
        this.removeGiftWrap();
      } else if (giftWrapsInCart > 0 && giftWrapsInCart !== 1) {
        this.setGiftWrap();
      } else if (giftWrapsInCart > 0 && isGiftWrappingAttributeBlank) {
        this.setGiftWrap();
      } else if (giftWrapsInCart === 0 && !isGiftWrappingAttributeBlank) {
        this.setGiftWrap();
      }
    }
  }

  customElements.define('cart-gift-wrap', CartGiftWrap);
}
