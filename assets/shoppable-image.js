/* global trapFocus, removeTrapFocus */

if (!customElements.get('shoppable-image')) {
  class ShoppableImage extends HTMLElement {
    constructor() {
      super();

      this.hotspotSlider = this.querySelector('hotspot-slider');
      this.hotspotCarousel = this.closest('.cc-shoppable-carousel');
      this.slider = this.hotspotCarousel?.querySelector('.shoppable-carousel');

      this.EDGE_BUFFER = 20;

      this.onClick = this.handleClick.bind(this);
      this.onClickOutside = this.handleClickOutside.bind(this);
      this.onKeyup = this.handleKeyup.bind(this);
      this.onResize = this.closeActiveHotspot.bind(this);
      this.onTransitionEnd = this.handleTransitionEnd.bind(this);

      this.addEventListener('click', this.onClick);
    }

    handleClick(evt) {
      const isHotspotBtn = evt.target.matches('.hotspot__btn');
      const isAddBtn = evt.target.matches('.btn[name="add"]');
      if (!isHotspotBtn || isAddBtn) return;

      const hotspot = evt.target.parentNode;

      if (this.hotspotSlider && !theme.mediaMatches.md) {
        this.hotspotSlider.scrollToSlide(Number(evt.target.dataset.hotspotIndex));
        return;
      }

      const isActive = hotspot === this.activeHotspot;
      if (isActive) {
        this.closeActiveHotspot(evt);
      } else {
        if (this.activeHotspot) this.closeActiveHotspot(evt);
        this.activateHotspot(hotspot);
      }
    }

    handleClickOutside(evt) {
      const isInsideHotspot = evt.target.matches('.hotspot__btn')
      || evt.target.closest('.hotspot__card')
      || evt.target.matches('.btn[name="add"]');

      if (!isInsideHotspot && this.activeHotspot) {
        this.closeActiveHotspot(evt);
      }
    }

    handleKeyup(evt) {
      if (evt.key === 'Escape' && this.activeHotspot) {
        this.closeActiveHotspot(evt);
      }
    }

    handleTransitionEnd(evt) {
      if (evt.propertyName !== 'opacity' || this.activeHotspot) return;

      this.classList.add('overflow-hidden');
      this.activeCard.style = null;
      this.activeCard = null;

      this.removeEventListener('transitionend', this.onTransitionEnd);
    }

    activateHotspot(hotspot) {
      this.activeCard = hotspot.querySelector('.hotspot__card');
      this.setHotspotActiveState(hotspot, true);
      this.classList.remove('overflow-hidden');

      trapFocus(hotspot);
      requestAnimationFrame(() => this.checkCardPosition());

      document.addEventListener('click', this.onClickOutside);
      document.addEventListener('keyup', this.onKeyup);
      window.addEventListener('resize', this.onResize);
    }

    closeActiveHotspot(evt) {
      if (!this.activeHotspot) return;

      this.setHotspotActiveState(this.activeHotspot, false);
      removeTrapFocus();

      if (evt.type !== 'resize') {
        this.addEventListener('transitionend', this.onTransitionEnd);
      } else {
        this.classList.add('overflow-hidden');
        this.activeCard.style = null;
        this.activeCard = null;
      }

      document.removeEventListener('click', this.onClickOutside);
      document.removeEventListener('keyup', this.onKeyup);
      window.removeEventListener('resize', this.onResize);
    }

    checkCardPosition() {
      if (!this.activeHotspot || !this.activeCard) return;

      const { style } = this.activeCard;
      style.cssText = '';

      this.activeHotspot.classList.remove('hotspot--above', 'hotspot--below');

      const imageRect = this.hotspotCarousel
        ? this.hotspotCarousel.getBoundingClientRect()
        : this.getBoundingClientRect();

      const hotspotRect = this.activeHotspot.getBoundingClientRect();
      const spaceAbove = hotspotRect.top - imageRect.top;
      const spaceBelow = imageRect.bottom - hotspotRect.bottom;

      const verticalClass = spaceAbove > spaceBelow ? 'hotspot--above' : 'hotspot--below';
      this.activeHotspot.classList.add(verticalClass);

      const newCardRect = this.activeCard.getBoundingClientRect();

      const overflowLeft = newCardRect.left < imageRect.left;
      const overflowRight = newCardRect.right > imageRect.right;

      style.left = '50%';
      style.right = '';
      style.transform = 'translate(-50%, 0)';

      if (overflowRight && !overflowLeft) {
        const shiftAmount = newCardRect.right - imageRect.right + this.EDGE_BUFFER;
        style.left = `calc(50% - ${shiftAmount}px)`;
      }

      if (overflowLeft && !overflowRight) {
        const shiftAmount = imageRect.left - newCardRect.left + this.EDGE_BUFFER;
        style.left = `calc(50% + ${shiftAmount}px)`;
      }
    }

    setHotspotActiveState(hotspot, isActive) {
      this.hotspotCarousel?.querySelectorAll('.hotspot.is-active').forEach((h) => h.classList.remove('is-active'));

      hotspot.classList.toggle('is-active', isActive);
      hotspot.querySelector('.hotspot__btn')?.setAttribute('aria-expanded', isActive);
      hotspot.querySelector('.hotspot__card')?.setAttribute('aria-hidden', !isActive);

      this.activeHotspot = isActive ? hotspot : null;
    }
  }

  customElements.define('shoppable-image', ShoppableImage);
}
