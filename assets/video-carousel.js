if (!customElements.get('video-carousel')) {
  class VideoCarousel extends HTMLElement {
    constructor() {
      super();

      this.videoPlayers = [];
      this.hoverPlay = this.dataset.hoverPlay === 'true';
      this.autoplay = this.dataset.autoplay === 'true';
      this.intersectionObserver = null;
      this.firstAutoplayDone = false;

      this.handleHoverPlay = this.handleHoverPlay.bind(this);
      this.handleIntersectionChange = this.handleIntersectionChange.bind(this);
      this.handleQuickAddClick = this.handleQuickAddClick.bind(this);
      this.handleVideoPlayed = this.handleVideoPlayed.bind(this);
      this.handleGlobalMute = this.handleGlobalMute.bind(this);
      this.handleVideoInView = this.handleVideoInView.bind(this);
      this.handleVideoEnded = this.handleVideoEnded.bind(this);
    }

    connectedCallback() {
      this.init();
      this.initIntersectionObserver();
      this.initQuickAddListeners();

      this.addEventListener('video-played', this.handleVideoPlayed);
      this.addEventListener('video-muted', this.handleGlobalMute);
      this.addEventListener('video-visible', this.handleVideoInView);
      this.addEventListener('video-ended', this.handleVideoEnded);
    }

    disconnectedCallback() {
      this.intersectionObserver?.disconnect();
    }

    init() {
      this.videoPlayers = [...this.querySelectorAll('video-carousel-player')];
      this.initPlayers();
    }

    initPlayers() {
      if (!theme.mediaMatches?.sm) return;

      if (this.hoverPlay) {
        this.videoPlayers.forEach((playerEl) => {
          playerEl.addEventListener('mouseenter', () => this.handleHoverPlay(playerEl));
        });
      }
    }

    handleHoverPlay(playerEl) {
      const video = playerEl.querySelector('video');
      if (!video) return;
      video.play();

      this.videoPlayers.forEach((otherEl) => {
        if (otherEl !== playerEl) {
          const otherVideo = otherEl.querySelector('video');
          if (otherVideo && !otherVideo.paused && !otherVideo.ended) {
            otherVideo.pause();
          }
        }
      });
    }

    initIntersectionObserver() {
      this.intersectionObserver = new IntersectionObserver(this.handleIntersectionChange, {
        threshold: 0.1
      });

      this.intersectionObserver.observe(this);
    }

    handleIntersectionChange(entries) {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // First time in view: autoplay first video
          if (this.autoplay && !this.firstAutoplayDone) {
            const firstPlayer = this.videoPlayers[0];
            const firstVideo = firstPlayer?.querySelector('video');

            if (firstVideo && firstVideo.paused && !firstVideo.ended) {
              firstVideo.play();
            }

            this.firstAutoplayDone = true;
          }
        } else {
          // Pause and mute all when out of view
          this.videoPlayers.forEach((playerEl) => {
            playerEl.querySelector('video')?.pause();
            playerEl.setMuted?.(true);
          });
        }
      });
    }

    initQuickAddListeners() {
      const quickAddButtons = this.querySelectorAll('.quick-add-btn');
      quickAddButtons.forEach((btn) => {
        btn.addEventListener('click', this.handleQuickAddClick);
      });
    }

    handleQuickAddClick() {
      this.pauseAllVideos();
    }

    handleVideoPlayed(event) {
      const activePlayer = event.detail.player;
      this.videoPlayers.forEach((playerEl) => {
        const video = playerEl.querySelector('video');
        if (!video) return;

        if (playerEl !== activePlayer && !video.paused && !video.ended) {
          video.pause();
        }
      });
    }

    handleGlobalMute(event) {
      const isMuted = event.detail.muted;
      this.videoPlayers.forEach((playerEl) => {
        playerEl.setMuted?.(isMuted);
      });
    }

    handleVideoInView(event) {
      const activePlayer = event.detail.player;

      this.videoPlayers.forEach((playerEl) => {
        const video = playerEl.querySelector('video');
        if (!video) return;

        if (playerEl === activePlayer) {
          if (video.paused && !video.ended) {
            video.play();
          }
        } else if (!video.paused && !video.ended) {
          video.pause();
        }
      });
    }

    handleVideoEnded(event) {
      if (!theme.mediaMatches?.sm) return;

      const currentPlayer = event.detail.player;
      const currentIndex = this.videoPlayers.indexOf(currentPlayer);
      const currentVideo = currentPlayer.querySelector('video');

      if (currentVideo) {
        currentVideo.pause();
        currentVideo.currentTime = 0;
      }

      const nextPlayer = this.videoPlayers[currentIndex + 1];
      const nextVideo = nextPlayer?.querySelector('video');
      if (!nextPlayer || !nextVideo) return;

      const rect = nextPlayer.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

      const isMostlyVisible = rect.left >= 0
        && rect.right <= viewportWidth
        && rect.width > 0;

      if (isMostlyVisible && nextVideo.paused && !nextVideo.ended) {
        nextVideo.play();
      }
    }

    pauseAllVideos() {
      this.videoPlayers.forEach((playerEl) => {
        const video = playerEl.querySelector('video');
        if (video && !video.paused && !video.ended) {
          video.pause();
        }
      });
    }
  }

  customElements.define('video-carousel', VideoCarousel);
}
