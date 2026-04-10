/* global Swiper */
(() => {
  const themeCreateProductSwiper = () => {
    if (!customElements.get('product-swiper')) {
      class ProductSwiper extends HTMLElement {
        connectedCallback() {
          const fullWidth = this.dataset.fullWidth === 'true';
          let spaceBetweenMobile = 24;
          let spaceBetweenDesktop = 40;
          let progressCB = null;
          let setTransitionCB = null;
          if (this.dataset.effect === 'coverflow') {
            spaceBetweenMobile = 50;
            spaceBetweenDesktop = 80;
            progressCB = ProductSwiper.focusSwiperProgress;
            setTransitionCB = ProductSwiper.dynamicSwiperSetTransition;
          } else if (this.dataset.effect === 'arc') {
            spaceBetweenMobile = 60;
            spaceBetweenDesktop = 100;
            progressCB = ProductSwiper.arcSwiperProgress;
            setTransitionCB = ProductSwiper.dynamicSwiperSetTransition;
          }

          // Duplicate all slides to get enough for effects
          this.querySelectorAll('.swiper-slide').forEach((slide) => {
            const clone = slide.cloneNode(true);
            slide.parentElement.appendChild(clone);
          });

          this.swiper = new Swiper(`#${CSS.escape(this.id)} .swiper`, {
            speed: 500,
            cssMode: false,
            grabCursor: true,
            centeredSlides: true,
            touchEventsTarget: 'container',
            slidesPerView: 'auto',
            spaceBetween: spaceBetweenMobile,
            breakpoints: {
              768: {
                spaceBetween: spaceBetweenDesktop
              }
            },
            loop: true,
            loopedSlides: 12,
            loopAdditionalSlides: 2,
            slidesPerGroup: 1,
            loopPreventsSliding: false,
            effect: 'slide',
            watchSlidesProgress: true,
            navigation: {
              nextEl: `#${CSS.escape(this.id)} .slider-nav__btn[name=next]`,
              prevEl: `#${CSS.escape(this.id)} .slider-nav__btn[name=prev]`
            },
            a11y: {
              slideRole: null
            },
            on: {
              init: fullWidth ? null : this.updateEdgeSlideVisibility,
              slideChange: fullWidth ? null : this.updateEdgeSlideVisibility,
              progress: progressCB,
              setTransition: setTransitionCB,
              // Prevent hover interaction while in motion
              sliderMove: (swiper) => {
                swiper.el.classList.add('swiper-interactions-disabled');
              },
              transitionStart: (swiper) => {
                swiper.el.classList.add('swiper-interactions-disabled');
              },
              transitionEnd: (swiper) => {
                swiper.el.classList.remove('swiper-interactions-disabled');
              }
            }
          });

          // Stop update() running after every image load event
          this.swiper.el.removeEventListener('load', this.swiper.onLoad, true);

          this.swiper.on('init', this.updateSlideTabIndex.bind(this));
          this.swiper.on('slideChange', this.updateSlideTabIndex.bind(this));

          // Safari does not recognise when images are in the viewport when transforms are applied
          const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
          if (isSafari) {
            setTimeout(() => {
              this.querySelectorAll('img[loading="lazy"]').forEach((img) => {
                img.removeAttribute('loading');
              });
            }, 1000);
          }
        }

        static focusSwiperProgress(swiper) {
          for (let i = 0; i < swiper.slides.length; i += 1) {
            const slide = swiper.slides[i];
            const { progress } = slide;
            const absProgress = Math.abs(progress);

            const z = -absProgress * 180;
            const scale = 1 - (absProgress * 0.08);

            const squeeze = 80;
            const curvature = 1.1;

            const xOffset = progress * (absProgress ** (curvature - 1)) * squeeze;

            slide.style.transform = `translate3d(${xOffset}px, 0, ${z}px) scale(${scale})`;
          }
        }

        static arcSwiperProgress(swiper) {
          const isMd = theme.mediaMatches.md;
          const xMult = isMd ? 20 : 25;
          const arcInt = isMd ? 32 : 12;
          const tiltMult = isMd ? 8.1 : 5;
          const visibleSideCount = 3;

          for (let i = 0; i < swiper.slides.length; i += 1) {
            const slide = swiper.slides[i];
            const { progress } = slide;
            const absProgress = Math.abs(progress);

            const xOffset = progress * xMult;
            const yOffset = (absProgress ** 2) * arcInt;
            const tilt = -progress * tiltMult;

            slide.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0) rotate(${tilt}deg)`;
            const opacity = (visibleSideCount - absProgress) ** 5;
            slide.style.opacity = Math.max(Math.min(1, opacity), 0);
          }
        }

        static dynamicSwiperSetTransition(swiper, speed) {
          for (let i = 0; i < swiper.slides.length; i += 1) {
            swiper.slides[i].style.transitionDuration = `${speed}ms`;
          }
        }

        updateSlideTabIndex() {
          this.swiper.slides.forEach((slide, index) => {
            const focusableElements = slide.querySelectorAll(
              'product-card, a, button, input, textarea, select, [tabindex]'
            );
            if (index === this.swiper.activeIndex) {
              slide.removeAttribute('tabindex');
              focusableElements.forEach((el) => el.removeAttribute('tabindex'));
            } else {
              slide.setAttribute('tabindex', '-1');
              focusableElements.forEach((el) => el.setAttribute('tabindex', '-1'));
            }
          });
        }

        updateEdgeSlideVisibility() {
          this.slides.forEach((slide) => slide.classList.remove('is-visible'));

          const { activeIndex } = this;
          const { slidesPerView } = this.params;
          let range;
          if (slidesPerView <= 1) {
            range = 0;
          } else if (slidesPerView <= 3) {
            range = 1;
          } else if (slidesPerView <= 4) {
            range = 2;
          } else {
            range = 3;
          }

          for (let i = -range; i <= range; i += 1) {
            const index = (activeIndex + i + this.slides.length) % this.slides.length;
            this.slides[index].classList.add('is-visible');
          }
        }
      }

      customElements.define('product-swiper', ProductSwiper);
    }
  };

  if (theme.Swiper) {
    themeCreateProductSwiper();
  } else {
    document.addEventListener('swiper-loaded', themeCreateProductSwiper);
  }
})();
