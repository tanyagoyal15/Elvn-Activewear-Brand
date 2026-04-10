if (!customElements.get('video-thumbnail')) {
  class VideoThumbnail extends HTMLElement {
    constructor() {
      super();
      window.initLazyScript(this, this.init.bind(this));

      this.video = this.querySelector('video');

      this.handleMouseOver = this.handleMouseOver.bind(this);
      this.handleMouseOut = this.handleMouseOut.bind(this);
      this.handleKeyPress = this.handleKeyPress.bind(this);
    }

    init() {
      this.addEventListener('mouseover', this.handleMouseOver);
      this.addEventListener('mouseout', this.handleMouseOut);
      this.addEventListener('keypress', this.handleKeyPress);
    }

    handleMouseOver() {
      this.video.play();
    }

    handleMouseOut() {
      this.video.pause();
    }

    handleKeyPress(event) {
      if (event.key === 'Enter') {
        this.click();
      }
    }
  }

  customElements.define('video-thumbnail', VideoThumbnail);
}
