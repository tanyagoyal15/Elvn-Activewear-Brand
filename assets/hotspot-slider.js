/**
 * Returns a function that as long as it continues to be invoked, won't be triggered.
 * @param {Function} fn - Callback function.
 * @param {number} [wait=300] - Delay (in milliseconds).
 * @returns {Function}
 */
function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* global CarouselSlider */

if (!customElements.get('hotspot-slider')) {
  class HotspotSlider extends CarouselSlider {
    init() {
      super.init();

      this.hotspots = this.closest('.shoppable-image').querySelectorAll('.hotspot');
      this.hotspotScrollHandler = debounce(this.handleHotspotScroll.bind(this), 100);
      this.slider.addEventListener('scroll', this.hotspotScrollHandler);
    }

    scrollToSlide(index) {
      let scrollPosition = index * this.slideSpan;

      if (this.rtl) scrollPosition = -Math.abs(scrollPosition);

      this.slider.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    }

    handleHotspotScroll() {
      this.currentIndex = Math.round(this.slider.scrollLeft / this.slideSpan);
      if (this.rtl) this.currentIndex = Math.abs(this.currentIndex);
      this.hotspots.forEach((hotspot) => { hotspot.classList.remove('hotspot--active'); });
      this.hotspots[this.currentIndex].classList.add('hotspot--active');
    }
  }

  customElements.define('hotspot-slider', HotspotSlider);
}
