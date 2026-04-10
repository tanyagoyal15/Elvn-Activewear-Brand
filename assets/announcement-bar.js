if (!customElements.get('announcement-bar')) {
  class AnnouncementBar extends HTMLElement {
    connectedCallback() {
      if (sessionStorage.getItem('cc-theme-announcement-dismissed') === 'true' && !Shopify.designMode) {
        this.hidden = true;
        return;
      }

      this.announcement = this.querySelector('.announcement');
      this.backgrounds = this.querySelectorAll('.announcement-bg');

      const observer = new MutationObserver(this.mutationCallback.bind(this));
      const config = { attributes: true, attributeFilter: ['class'] };
      this.querySelectorAll('.slideshow__slide').forEach((el) => {
        observer.observe(el, config);
      });

      this.querySelector('.announcement__close').addEventListener('click', this.close.bind(this));
    }

    mutationCallback(mutationList) {
      // eslint-disable-next-line no-restricted-syntax
      for (const mutation of mutationList) {
        if (mutation.type === 'attributes') {
          if (mutation.target.classList.contains('is-active')) {
            this.setActiveSlide(mutation.target);
          }
        }
      }
    }

    setActiveSlide(slide) {
      this.style.setProperty('--announcement-text-color', slide.dataset.textColor);
      this.backgrounds.forEach((el) => {
        el.classList.toggle('is-active', el.dataset.index === slide.dataset.index);
      });
    }

    close() {
      sessionStorage.setItem('cc-theme-announcement-dismissed', 'true');
      this.hidden = true;
    }
  }

  customElements.define('announcement-bar', AnnouncementBar);
}
