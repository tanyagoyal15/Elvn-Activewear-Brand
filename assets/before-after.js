if (!customElements.get('before-after')) {
  class BeforeAfter extends HTMLElement {
    constructor() {
      super();
      window.initLazyScript(this, this.init.bind(this));
    }

    init() {
      this.divider = this.querySelector('.before-after__divider');
      this.button = this.querySelector('.before-after__btn');
      this.touchStartTimeStamp = 0;

      this.handlePointerMove = this.handlePointerMove.bind(this);

      this.addEventListener('pointerdown', this.handlePointerDown.bind(this));
      this.addEventListener('keydown', this.handleKeyDown.bind(this));
      this.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });

      if (this.classList.contains('before-after--animate')) {
        this.animateOnLoad();
      }
    }

    async animateOnLoad() {
      if (!this.classList.contains('before-after--animate')) return;

      this.classList.add('before-after--animating');
      await Promise.all(
        this.getAnimations({ subtree: true }).map((animation) => animation.finished)
      );
      this.classList.remove('before-after--animating');
      this.classList.remove('before-after--animate');
    }

    handlePointerDown(event) {
      this.style.setProperty('--btn-cursor', 'grabbing');

      document.addEventListener('pointerup', this.handlePointerUp.bind(this), { once: true });
      if (matchMedia('screen and (pointer: fine)').matches) {
        document.addEventListener('pointermove', this.handlePointerMove);
        this.calculatePosition(event);
      }
    }

    handlePointerUp(event) {
      this.style.setProperty('--btn-cursor', 'grab');

      document.removeEventListener('pointermove', this.handlePointerMove);

      if (!matchMedia('screen and (pointer: fine)').matches) {
        if (event.timeStamp - this.touchStartTimeStamp <= 250) { // ignore touch & hold
          this.calculatePosition(event);
        }
      }
    }

    handlePointerMove(event) {
      this.calculatePosition(event);
    }

    handleTouchStart(event) {
      if (event.target === this.divider || this.divider.contains(event.target)) {
        event.preventDefault();
        document.addEventListener('pointermove', this.handlePointerMove);
      } else {
        this.touchStartTimeStamp = event.timeStamp;
      }
    }

    handleKeyDown(event) {
      if (event.target !== this.divider || (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight')) {
        return;
      }

      event.preventDefault();

      const offset = (parseInt(getComputedStyle(this.button).getPropertyValue('width'), 10) / 2) + 4;
      const max = this.clientWidth - offset;
      let x;
      let newPosition;
      let currentPosition = parseInt(this.style.getPropertyValue('--percent'), 10);
      if (Number.isNaN(currentPosition)) {
        currentPosition = parseInt(getComputedStyle(this).getPropertyValue('--percent'), 10);
      }
      if (event.code === 'ArrowLeft') {
        x = this.divider.getBoundingClientRect().left - this.getBoundingClientRect().left;
        newPosition = currentPosition - 1;
      } else if (event.code === 'ArrowRight') {
        x = this.divider.getBoundingClientRect().right - this.getBoundingClientRect().left;
        newPosition = currentPosition + 1;
      }

      let percent = (Math.max(offset, Math.min(x, max)) * 100) / this.clientWidth;
      if ((event.code === 'ArrowLeft' && newPosition > percent) || (event.code === 'ArrowRight' && newPosition < percent)) {
        percent = newPosition;
      }

      if (document.dir === 'rtl') {
        percent = (100 - percent);
      }

      this.setPosition(percent);
    }

    calculatePosition(event) {
      const offset = (parseInt(getComputedStyle(this.button).getPropertyValue('width'), 10) / 2) + 4;
      const max = this.clientWidth - offset;
      const x = event.clientX - this.getBoundingClientRect().left;
      let percent = (Math.max(offset, Math.min(x, max)) * 100) / this.clientWidth;
      if (document.dir === 'rtl') {
        percent = (100 - percent);
      }

      this.setPosition(percent);
    }

    setPosition(percent) {
      cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame(() => this.style.setProperty('--percent', `${Math.min(Math.max(percent, 0), 100)}%`));
    }
  }

  customElements.define('before-after', BeforeAfter);
}
