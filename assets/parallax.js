/* eslint-disable max-len */
if (!customElements.get('parallax-container')) {
  class ParallaxContainer extends HTMLElement {
    connectedCallback() {
      this.docOffsetTop = this.getBoundingClientRect().top + window.scrollY;

      this.boundUpdate = () => {
        requestAnimationFrame(this.update.bind(this));
      };
      window.addEventListener('scroll', this.boundUpdate);

      this.resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          this.docOffsetTop = this.getBoundingClientRect().top + window.scrollY;
          this.update();
        });
      });
      this.resizeObserver.observe(this);

      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.isVisible = true;
            } else {
              this.isVisible = false;
            }
          });
        }
      );
      this.intersectionObserver.observe(this);
    }

    update() {
      if (!this.isVisible) return;

      const thisCenter = this.docOffsetTop + this.clientHeight / 2;
      const viewportCenter = window.scrollY + window.innerHeight / 2;
      let progress;
      if (this.clientHeight > window.innerHeight) {
        progress = (window.scrollY - this.docOffsetTop) / (this.clientHeight - window.innerHeight);
      } else {
        progress = (viewportCenter - this.docOffsetTop) / this.clientHeight;
      }

      this.style.setProperty('--parallax-center-offset-y', `${viewportCenter - thisCenter}px`);
      this.style.setProperty('--parallax-top-offset-y', `${window.scrollY - this.docOffsetTop}`);
      this.style.setProperty('--parallax-window-progress', progress);
    }
  }

  customElements.define('parallax-container', ParallaxContainer);
}
