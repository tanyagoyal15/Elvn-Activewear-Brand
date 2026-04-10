if (!customElements.get('cart-discount')) {
  class CartDiscount extends HTMLElement {
    constructor() {
      super();
      this.activeFetch = null;
      this.isFetching = false;

      // Bound event handlers
      this.onApplyClick = this.applyDiscount.bind(this);
      this.onRemoveClick = this.removeDiscount.bind(this);

      this.init();
    }

    init() {
      this.cartDrawerExists = document.getElementById('cart-drawer') !== null;
      this.cartDiscountCodes = this.querySelector('.cart-discount__codes');
      this.cartDiscountError = this.querySelector('[ref="cartDiscountError"]');
      this.cartDiscountErrorDiscountCode = this.querySelector('[ref="cartDiscountErrorDiscountCode"]');
      this.cartDiscountErrorShipping = this.querySelector('[ref="cartDiscountErrorShipping"]');
      this.controller = null;

      this.setupEventListeners();
    }

    setupEventListeners() {
      const keyDownInput = this.querySelector('#cart-discount');
      const submitButton = this.querySelector('.cart-discount__button');
      const removeDiscountButton = this.querySelector('.cart-discount__pill-remove');

      if (keyDownInput) {
        keyDownInput.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.keyCode === 13) {
            this.onApplyClick();
          }
        });
      }

      if (submitButton) {
        submitButton.removeEventListener('click', this.onApplyClick);
        submitButton.addEventListener('click', this.onApplyClick);
      }

      if (removeDiscountButton) {
        removeDiscountButton.removeEventListener('click', this.onRemoveClick);
        removeDiscountButton.addEventListener('click', this.onRemoveClick);
      }
    }

    existingDiscounts() {
      const discountCodes = [];
      const discountPills = this.querySelectorAll('.cart-discount__pill');
      for (const pill of discountPills) {
        const { discountCode } = pill.dataset;
        if (discountCode) discountCodes.push(discountCode);
      }
      return discountCodes;
    }

    hideAllErrorMessages() {
      this.cartDiscountError.classList.add('hidden');
      this.cartDiscountErrorDiscountCode.classList.add('hidden');
      this.cartDiscountErrorShipping.classList.add('hidden');
    }

    handleDiscountError(type) {
      const target = type === 'discount_code' ? this.cartDiscountErrorDiscountCode : this.cartDiscountErrorShipping;
      this.cartDiscountError.classList.remove('hidden');
      target.classList.remove('hidden');
    }

    async applyDiscount() {
      const discountInput = this.querySelector('input[name="discount"]');
      const discountCodeValue = discountInput?.value?.trim();
      if (this.isFetching || !discountCodeValue) return;

      const existingDiscounts = this.existingDiscounts();
      if (existingDiscounts.includes(discountCodeValue)) return;

      this.isFetching = true;
      this.controller?.abort();
      this.controller = new AbortController();

      try {
        const requestBody = {
          discount: [...existingDiscounts, discountCodeValue].join(','),
          sections: this.dataset.sectionId
        };

        const fetchOptions = {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: this.controller.signal
        };

        this.hideAllErrorMessages();

        const response = await fetch(`${theme.routes.cartUpdate}`, fetchOptions);
        if (!response.ok) throw new Error(response.status);
        const data = await response.json();

        let discountCodeExists = false;
        let discountCodeIsShipping = false;

        if (
          data.discount_codes.find((discount) => discount.code === discountCodeValue
            && discount.applicable === false)
        ) {
          discountInput.value = '';
          this.handleDiscountError('discount_code');
          this.dispatchEvent(new CustomEvent('on:cart:discount-error', {
            bubbles: true,
            detail: {
              code: discountCodeValue
            }
          }));
        } else {
          discountCodeExists = true;
        }

        const newHtml = data.sections[this.dataset.sectionId];
        const parsedHtml = new DOMParser().parseFromString(newHtml, 'text/html');
        const section = parsedHtml.getElementById(`shopify-section-${this.dataset.sectionId}`);
        const newCartDiscountCodes = section?.querySelector('.cart-discount__codes');
        const discountCodes = section?.querySelectorAll('.cart-discount__pill') || [];

        if (section) {
          const codes = Array.from(discountCodes)
            .map((element) => (element instanceof HTMLLIElement
              ? element.dataset.discountCode
              : null))
            .filter(Boolean);

          const hasSameNumberOfPills = codes.length === existingDiscounts.length;
          const areExistingPillsIdentical = codes.every(
            (code) => existingDiscounts.includes(code)
          );
          const newDiscountAppliedSuccessfully = data.discount_codes.find(
            (discount) => discount.code === discountCodeValue && discount.applicable === true
          );

          if (
            hasSameNumberOfPills
            && areExistingPillsIdentical
            && newDiscountAppliedSuccessfully
          ) {
            this.handleDiscountError('shipping');
            discountInput.value = '';
            discountCodeIsShipping = true;
          }
        }

        if (discountCodeExists && !discountCodeIsShipping) {
          if (this.cartDrawerExists) {
            document.dispatchEvent(new CustomEvent('dispatch:cart-drawer:refresh', { bubbles: true }));
          } else {
            const summaryAndBlocks = section?.querySelector('[data-cart-component]');
            const currentSummary = document.querySelector('[data-cart-component]');
            if (summaryAndBlocks && currentSummary) {
              currentSummary.replaceWith(summaryAndBlocks);
            }
          }
        }

        this.cartDiscountCodes = document.querySelector('.cart-discount__codes');

        if (newCartDiscountCodes instanceof HTMLElement) {
          this.cartDiscountCodes.replaceWith(newCartDiscountCodes);
          this.cartDiscountCodes = newCartDiscountCodes;
          this.setupEventListeners();
        }

        if (discountCodeExists && !discountCodeIsShipping) {
          this.dispatchEvent(new CustomEvent('on:cart:discount-added', {
            bubbles: true,
            detail: {
              code: discountCodeValue
            }
          }));
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          // eslint-disable-next-line
          console.log('Fetch aborted');
        } else {
          // eslint-disable-next-line
          console.error('Fetch error:', error);
        }
      } finally {
        this.isFetching = false;
        this.controller = null;
      }
    }

    async removeDiscount(event) {
      event.preventDefault();
      event.stopPropagation();

      const pill = event.target.closest('.cart-discount__pill');
      if (!(pill instanceof HTMLLIElement)) return;

      const { discountCode } = pill.dataset;
      if (!discountCode) return;

      const existingDiscounts = this.existingDiscounts();
      const index = existingDiscounts.indexOf(discountCode);
      if (index === -1) return;
      existingDiscounts.splice(index, 1);

      this.controller?.abort();
      this.controller = new AbortController();

      try {
        const fetchOptions = {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            discount: existingDiscounts.join(','),
            sections: this.dataset.sectionId
          }),
          signal: this.controller.signal
        };

        const response = await fetch(`${theme.routes.cartUpdate}`, fetchOptions);
        if (!response.ok) throw new Error(response.status);
        const data = await response.json();

        const newHtml = data.sections[this.dataset.sectionId];
        const parsedHtml = new DOMParser().parseFromString(newHtml, 'text/html');
        const section = parsedHtml.getElementById(`shopify-section-${this.dataset.sectionId}`);
        const newCartDiscountCodes = section?.querySelector('.cart-discount__codes');

        if (this.cartDrawerExists) {
          document.dispatchEvent(new CustomEvent('dispatch:cart-drawer:refresh', { bubbles: true }));
        } else {
          const summaryAndBlocks = section?.querySelector('[data-cart-component]');
          const currentSummary = document.querySelector('[data-cart-component]');
          if (summaryAndBlocks && currentSummary) {
            currentSummary.replaceWith(summaryAndBlocks);
          }
        }

        if (newCartDiscountCodes instanceof HTMLElement) {
          this.cartDiscountCodes.replaceWith(newCartDiscountCodes);
          this.cartDiscountCodes = newCartDiscountCodes;
          this.setupEventListeners();
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          // eslint-disable-next-line
          console.log('Remove discount request aborted');
        } else {
          // eslint-disable-next-line
          console.error('Remove discount error:', error);
        }
      } finally {
        this.controller = null;
      }
    }
  }

  customElements.define('cart-discount', CartDiscount);
}
