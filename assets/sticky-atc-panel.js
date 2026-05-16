if (!customElements.get('sticky-atc-panel')) {
  class StickyAtcPanel extends HTMLElement {
    constructor() {
      super();

      this.productSection = this.closest('.cc-main-product');
      this.productInfo = this.productSection.querySelector('.product-info');
      this.productForm = this.productSection.querySelector('product-form');
      this.atcButton = this.querySelector('.js-atc-button');
      this.productFormAtcButton = this.productForm.querySelector('.js-add-to-cart');

      if (this.productFormAtcButton) {
        this.productFormAtcButton.setAttribute('data-connected-button', '.js-atc-button');
      }

      this.bindEvents();
    }

    // eslint-disable-next-line class-methods-use-this
    disconnectedCallback() {
      window.removeEventListener('scroll', StickyAtcPanel.handleScroll);
      this.atcButton.removeEventListener('click', this.atcClickHandler);
    }

    bindEvents() {
      if (this.hasAttribute('data-show-on-scroll')) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.target === this.productForm && !theme.mediaMatches.md) {
              this.classList.toggle('sticky-atc-panel--out', entry.boundingClientRect.bottom > 0);
            } else if (entry.target === this.productInfo && theme.mediaMatches.md) {
              this.classList.toggle('sticky-atc-panel--out', entry.isIntersecting);
            }
          });
        });

        if (this.productForm) observer.observe(this.productForm);
        if (this.productInfo) observer.observe(this.productInfo);

        window.addEventListener('scroll', StickyAtcPanel.handleScroll);
      }

      this.atcClickHandler = this.atcClickHandler || this.handleAtcClick.bind(this);
      this.atcButton.addEventListener('click', this.atcClickHandler);

      // Grab the currently selected swatch
      const stickyAtcVariantSwatch = this.querySelector('.js-atc-selected-variant-swatch');
      const activeSwatch = document.querySelector('.product-main .opt-btn:checked + .opt-label--swatch');
      if (stickyAtcVariantSwatch && activeSwatch) {
        stickyAtcVariantSwatch.innerHTML = activeSwatch.outerHTML;
      }
    }

    /**
     * Watches for a scroll to the bottom of the page
     */
    static handleScroll() {
      document.body.classList.toggle(
        'scrolled-to-bottom',
        window.scrollY + window.innerHeight + 100 > document.body.scrollHeight
      );
    }

    /**
     * Handle the click of the atc button
     */
    handleAtcClick() {
      if (this.productFormAtcButton) this.productFormAtcButton.click();
    }

    /**
     * Handle use as part of video testimonials
     */
    videoTestimonialsOpened() {
      this.classList.add('sticky-atc-panel--force-show');
      this.videoTestimonialsVariantClickHandler = () => {
        document.querySelector('video-testimonials[open]').close();
      };
      this.querySelector('a[href="#variants"]').addEventListener('click', this.videoTestimonialsVariantClickHandler);
    }

    /**
     * Reset to normal visibility
     */
    videoTestimonialsClosed() {
      this.classList.remove('sticky-atc-panel--force-show');
      this.querySelector('a[href="#variants"]').removeEventListener('click', this.videoTestimonialsVariantClickHandler);
    }
  }

  customElements.define('sticky-atc-panel', StickyAtcPanel);
}
