if (!customElements.get('product-form')) {
  class ProductForm extends HTMLElement {
    constructor() {
      super();
      if (this.hasChildNodes()) this.init();
    }

    init() {
      this.form = this.querySelector('.js-product-form');
      if (this.form) {
        this.cartDrawer = document.querySelector('cart-drawer');
        this.quickAddDrawer = this.closest('quick-add-drawer');

        if (this.quickAddDrawer && Shopify && Shopify.PaymentButton) {
          Shopify.PaymentButton.init();
        }

        if (theme.settings.afterAtc !== 'no-js') {
          this.form.addEventListener('submit', this.handleSubmit.bind(this));
        }
      }
    }

    /**
     * Handles submission of the product form.
     * @param {object} evt - Event object.
     */
    async handleSubmit(evt) {
      if (evt.target.id === 'product-signup_form') return;

      evt.preventDefault();

      this.submitBtn = this.querySelector('[name="add"]');

      if (this.submitBtn.getAttribute('aria-disabled') === 'true') return;

      if (this.submitBtn.dataset.connectedButton && !this.connectedBtn) {
        this.connectedBtn = document.querySelector(this.submitBtn.dataset.connectedButton);
      }

      this.errorMsg = null;
      this.setErrorMsgState();

      // Disable "Add to Cart" button until submission is complete.
      this.submitBtn.setAttribute('aria-disabled', 'true');
      this.submitBtn.classList.add('is-loading');
      this.submitBtn.setAttribute('disabled', 'disabled');

      if (this.connectedBtn) {
        this.connectedBtn.setAttribute('aria-disabled', 'true');
        this.connectedBtn.classList.add('is-loading');
        this.connectedBtn.setAttribute('disabled', 'disabled');
      }

      const productIdInForm = this.form.querySelector('[name="id"]').value;
      const giftWrapCheckbox = document.getElementById('gift-wrap');
      if (productIdInForm === theme.settings.giftWrapProductId && giftWrapCheckbox) {
        if (giftWrapCheckbox.checked === false) giftWrapCheckbox.click();
        this.atcCompleted();
        if (this.cartDrawer) this.cartDrawer.open();
        return;
      }

      const formData = new FormData(this.form);

      const sections = this.cartDrawer ? `${this.cartDrawer.dataset.section},cart-icon-bubble` : 'cart-icon-bubble';

      formData.append('sections_url', window.location.pathname);
      formData.append('sections', sections);

      const fetchRequestOpts = {
        method: 'POST',
        headers: {
          Accept: 'application/javascript',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
      };

      try {
        const oldCartResponse = await fetch(`${theme.routes.cart}.js`);
        if (!oldCartResponse.ok) throw new Error(oldCartResponse.status);
        const oldCartData = await oldCartResponse.json();

        const response = await fetch(theme.routes.cartAdd, fetchRequestOpts);
        const data = await response.json();
        let error = typeof data.description === 'string' ? data.description : data.message;
        if (data.errors && typeof data.errors === 'object') {
          error = Object.entries(data.errors).map((item) => item[1].join(', '));
        }

        if (data.status) this.setErrorMsgState(error);

        if (!response.ok) throw new Error(response.status);

        if (theme.settings.afterAtc === 'page') {
          // Allow the tick animation to complete
          setTimeout(() => {
            window.location.href = theme.routes.cart;
          }, 300);
        } else {
          // Update cart icon count.
          ProductForm.updateCartIcon(data);

          // If item was added from Quick Add drawer, show "Added to cart" message.
          if (this.quickAddDrawer) this.quickAddDrawer.addedToCart();

          setTimeout(() => {
            // Update cart drawer contents.
            if (this.cartDrawer) {
              this.cartDrawer.renderContents(
                data,
                !this.quickAddDrawer && theme.settings.afterAtc === 'drawer',
                this.submitBtn
              );
            } else if (window.location.pathname === theme.routes.cart) {
              const cartItems = document.querySelector('cart-items');
              if (cartItems) {
                if (cartItems.dataset.empty === 'true') {
                  window.location.reload();
                } else {
                  cartItems.refresh();
                }
              }
            }
          }, 700);
        }

        const newCartResponse = await fetch(`${theme.routes.cart}.js`);
        if (!newCartResponse.ok) throw new Error(newCartResponse.status);
        const newCartData = await newCartResponse.json();
        const itemInOldCart = oldCartData.items.filter(
          (item) => item.variant_id === data.variant_id
        )[0];

        // Check if product was already in the cart
        if (itemInOldCart) {
          this.dispatchEvent(new CustomEvent('on:line-item:change', {
            bubbles: true,
            detail: {
              cart: newCartData,
              variantId: data.variant_id,
              oldQuantity: itemInOldCart.quantity,
              newQuantity: (itemInOldCart.quantity === data.quantity)
                ? itemInOldCart.quantity : data.quantity
            }
          }));
        } else {
          this.dispatchEvent(new CustomEvent('on:cart:add', {
            bubbles: true,
            detail: {
              cart: newCartData,
              variantId: data.variant_id
            }
          }));
        }
      } catch (error) {
        console.log(error); // eslint-disable-line
        this.dispatchEvent(new CustomEvent('on:cart:error', {
          bubbles: true,
          detail: {
            error: this.errorMsg?.textContent
          }
        }));

        if (this.cartDrawer) this.cartDrawer.refresh(true);
      } finally {
        this.atcCompleted();
      }
    }

    atcCompleted() {
      // Re-enable 'Add to Cart' button.
      this.submitBtn.classList.add('is-success');
      this.submitBtn.removeAttribute('aria-disabled');
      setTimeout(() => {
        this.submitBtn.classList.remove('is-loading');
        this.submitBtn.classList.remove('is-success');
        this.submitBtn.removeAttribute('disabled');
      }, 1400);

      if (this.connectedBtn) {
        // Re-enable 'Add to Cart' button.
        this.connectedBtn.classList.add('is-success');
        this.connectedBtn.removeAttribute('aria-disabled');
        setTimeout(() => {
          this.connectedBtn.classList.remove('is-loading');
          this.connectedBtn.classList.remove('is-success');
          this.connectedBtn.removeAttribute('disabled');
        }, 1400);
      }
    }

    /**
     * Updates the cart icon count in the header.
     * @param {object} response - Response JSON.
     */
    static updateCartIcon(response) {
      const cartIconBubble = document.getElementById('cart-icon-bubble');
      if (cartIconBubble) {
        const tmpl = document.createElement('template');
        tmpl.innerHTML = response.sections['cart-icon-bubble'] || '';
        const el = tmpl.content.querySelector('.shopify-section');
        if (el) {
          cartIconBubble.innerHTML = el.innerHTML;
        }
      }
    }

    /**
     * Shows/hides an error message.
     * @param {string} [error=false] - Error to show a message for.
     */
    setErrorMsgState(error = false) {
      this.errorMsg = this.errorMsg || this.querySelector('.js-form-error');
      if (!this.errorMsg) return;

      this.errorMsg.hidden = !error;
      if (error) {
        this.errorMsg.innerHTML = '';
        const errorArray = Array.isArray(error) ? error : [error];
        errorArray.forEach((err, index) => {
          if (index > 0) this.errorMsg.insertAdjacentHTML('beforeend', '<br>');
          this.errorMsg.insertAdjacentText('beforeend', err);
        });

        // Scroll to the error message if it’s out of the viewport
        this.errorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  customElements.define('product-form', ProductForm);
}
