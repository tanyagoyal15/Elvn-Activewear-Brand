/**
 * Loads a script.
 * @param {string} src - Url of script to load.
 * @returns {Promise}
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

/**
 * Loads a stylesheet.
 * @param {string} href - Url of stylesheet to load.
 * @returns {Promise}
 */
function loadStylesheet(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve(link);
    link.onerror = () => reject;
    document.head.appendChild(link);
  });
}

/* global Modal, Swiper */

customElements.whenDefined('modal-dialog').then(() => {
  if (!customElements.get('video-testimonials')) {
    class VideoTestimonials extends Modal {
      connectedCallback() {
        this.pauseBtn = this.querySelector('.pause-btn');
        this.muteBtn = this.querySelector('.mute-btn');

        this.pauseBtn.addEventListener('click', this.pauseActiveVideo.bind(this));
        this.muteBtn.addEventListener('click', this.muteAllVideos.bind(this));
      }

      open(opener) {
        super.open(opener);
        const { videoId } = opener.querySelector('video-thumbnail').dataset;

        if (!this.swiper) {
          if (theme.swiperLoaded) {
            this.initSwiper(videoId);
          } else {
            Promise.all([
              loadScript(this.dataset.swiperJsPath),
              loadStylesheet(this.dataset.swiperCssPath)
            ]).then(() => {
              theme.swiperLoaded = true;
              this.initSwiper(videoId);
            });
          }
        } else {
          const videoIndex = parseInt(this.querySelector(`.swiper-slide:not(.theme-clone)[data-video-id="${videoId}"]`).dataset.swiperSlideIndex, 10);
          this.swiper.slideToLoop(videoIndex, 0, true);
        }

        this.stickyAtc = this.closest('.shopify-section').querySelector('sticky-atc-panel');
        this.stickyAtc?.videoTestimonialsOpened();
      }

      close() {
        this.pauseAllVideos();
        super.close();
        this.stickyAtc?.videoTestimonialsClosed();
      }

      initSwiper(videoId) {
        const slides = [...this.querySelectorAll('.swiper-slide')];
        let videoIndex = 0;
        slides.forEach((el, index) => {
          if (el.dataset.videoId === videoId) {
            videoIndex = index;
          }
          // Duplicate slides if more than one exists as more are needed for Swiper's loop effect
          if (slides.length > 1) {
            el.parentElement.insertAdjacentHTML('beforeend', el.outerHTML);
            el.parentElement.lastElementChild.classList.add('theme-clone');
          }
        });

        this.swiper = new Swiper(`#${this.id} .swiper--testimonial-videos`, {
          effect: 'coverflow',
          initialSlide: videoIndex,
          grabCursor: true,
          centeredSlides: true,
          slidesPerView: 3,
          spaceBetween: 20,
          breakpoints: {
            768: {
              slidesPerView: 3,
              spaceBetween: 0
            }
          },
          coverflowEffect: {
            rotate: 0,
            stretch: 0,
            depth: 400,
            modifier: 1,
            slideShadows: false
          },
          loop: true,

          navigation: {
            nextEl: `#${this.id} .swiper--testimonial-videos--next`,
            prevEl: `#${this.id} .swiper--testimonial-videos--prev`
          },
          a11y: {
            slideRole: null
          },

          on: {
            slideChange: (swiper) => { // called more often than you'd expect
              const video = swiper.slides[swiper.activeIndex].querySelector('video');
              if (this.hasAttribute('open')) {
                this.pauseAllVideos(video);
                video.play();
              } else {
                this.pauseAllVideos();
              }
              this.updateControls(video);
            },
            afterInit: () => {
              setTimeout(this.updateControls.bind(this), 250);
            }
          }
        });
      }

      pauseActiveVideo() {
        const video = this.swiper.slides[this.swiper.activeIndex].querySelector('video');
        if (VideoTestimonials.isVideoPlaying(video)) {
          video.pause();
        } else {
          video.play();
        }
        this.updateControls(video);
      }

      muteAllVideos() {
        const video = this.swiper.slides[this.swiper.activeIndex].querySelector('video');
        if (video.muted) {
          this.querySelectorAll('video').forEach((v) => { v.muted = false; });
        } else {
          this.querySelectorAll('video').forEach((v) => { v.muted = true; });
        }
        this.updateControls(video);
      }

      updateControls(videoParam) {
        const video = videoParam || this.swiper.slides[this.swiper.activeIndex].querySelector('video');
        const playing = VideoTestimonials.isVideoPlaying(video);

        this.pauseBtn.querySelector('.pause-btn__pause-icon').toggleAttribute('hidden', !playing);
        this.pauseBtn.querySelector('.pause-btn__play-icon').toggleAttribute('hidden', playing);

        this.muteBtn.querySelector('.mute-btn__mute-icon').toggleAttribute('hidden', video.muted);
        this.muteBtn.querySelector('.mute-btn__unmute-icon').toggleAttribute('hidden', !video.muted);
      }

      pauseAllVideos(except) {
        this.querySelectorAll('video').forEach((video) => {
          if (video !== except) video.pause();
        });
      }

      static isVideoPlaying(video) {
        return video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2;
      }
    }

    customElements.define('video-testimonials', VideoTestimonials);
  }
});
