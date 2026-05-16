if (!customElements.get('video-carousel-player')) {
  class VideoCarouselPlayer extends HTMLElement {
    connectedCallback() {
      this.initPlayer();
      if (this.player) {
        this.initVisibilityObserver();
      }
    }

    disconnectedCallback() {
      this.observer?.disconnect();
    }

    initPlayer() {
      this.player = this.querySelector('video');
      if (!this.player) return false;

      this.player.muted = this.dataset.muted !== 'false'; // default to true unless explicitly set to "false"

      this.initMuteToggle();
      this.initPlayToggle();
      return true;
    }

    initPlayToggle() {
      this.playBtn = this.querySelector('[data-vc-play-toggle]');
      if (!this.playBtn || !this.player) return;

      this.pauseIcon = this.playBtn.querySelector('[data-vc-play]'); // pause icon
      this.playIcon = this.playBtn.querySelector('[data-vc-pause]'); // play icon

      this.playBtn.addEventListener('click', this.handlePlayButtonClick.bind(this));
      this.player.addEventListener('play', this.handlePlay.bind(this));
      this.player.addEventListener('pause', this.handlePause.bind(this));
      this.player.addEventListener('ended', this.handleEnded.bind(this));
    }

    initMuteToggle() {
      this.muteBtn = this.querySelector('[data-vc-mute-toggle]');
      if (!this.muteBtn || !this.player) return;

      this.muteIcon = this.muteBtn.querySelector('[data-vc-mute]');
      this.unmuteIcon = this.muteBtn.querySelector('[data-vc-unmute]');

      this.updateMuteButtonUI();

      this.handleMute = this.handleMute.bind(this);
      this.muteBtn.addEventListener('click', this.handleMute);
    }

    // Horizontal play / pause when in view
    initVisibilityObserver() {
      const autoplayMobile = this.dataset.autoplayMobile === 'true';

      if (theme.mediaMatches?.sm) return; // only run on mobile

      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.5;

            if (autoplayMobile && isVisible) {
              // Play if autoplayMobile is true
              this.dispatchEvent(new CustomEvent('video-visible', {
                bubbles: true,
                detail: { player: this }
              }));
            } else if (!isVisible) {
              // Always pause when out of view
              this.player?.pause();
            }
          });
        },
        { threshold: [0.5] }
      );

      this.observer.observe(this);
    }

    handleMute() {
      const newState = !this.player.muted;
      this.setMuted(newState);

      this.dispatchEvent(new CustomEvent('video-muted', {
        bubbles: true,
        detail: { muted: newState }
      }));
    }

    handlePlayButtonClick() {
      const isPlaying = !this.player.paused && !this.player.ended && this.player.readyState > 2;

      if (isPlaying) {
        this.player.pause();
      } else {
        this.player.play();
      }
    }

    handlePlay() {
      this.updatePlayButtonUI();
      this.dispatchEvent(new CustomEvent('video-played', {
        bubbles: true,
        detail: { player: this }
      }));
    }

    handlePause() {
      this.updatePlayButtonUI();
    }

    handleEnded() {
      this.updatePlayButtonUI();
      this.dispatchEvent(new CustomEvent('video-ended', {
        bubbles: true,
        detail: { player: this }
      }));
    }

    updatePlayButtonUI() {
      const isPlaying = !this.player.paused && !this.player.ended;
      this.playBtn.classList.toggle('is-playing', isPlaying);
    }

    updateMuteButtonUI() {
      const isMuted = this.player.muted;
      if (this.muteIcon) this.muteIcon.hidden = !isMuted;
      if (this.unmuteIcon) this.unmuteIcon.hidden = isMuted;
    }

    setMuted(state) {
      if (!this.player) return;
      this.player.muted = state;
      this.updateMuteButtonUI();
    }
  }

  customElements.define('video-carousel-player', VideoCarouselPlayer);
}
