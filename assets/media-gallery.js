/**
 * Pauses all media (videos/models) within an element.
 * @param {Element} [el=document] - Element to pause media within.
 * @param {Element} [excludeVideo] - Video element to not pause.
 */
function pauseAllMedia(el = document, excludeVideo = null) {
  el.querySelectorAll('.js-youtube, .js-vimeo, video').forEach((video) => {
    if (video === excludeVideo) return;
    const component = video.closest('video-component');
    if (component && component.dataset.background === 'true') return;

    if (video.matches('.js-youtube')) {
      video.contentWindow.postMessage('{ "event": "command", "func": "pauseVideo", "args": "" }', '*');
    } else if (video.matches('.js-vimeo')) {
      video.contentWindow.postMessage('{ "method": "pause" }', '*');
    } else {
      video.pause();
    }
  });

  el.querySelectorAll('product-model').forEach((model) => {
    try {
      if (model.modelViewerUI) model.modelViewerUI.pause();
    } catch {
      // Do nothing
    }
  });
}

if (!customElements.get('media-gallery')) {
  class MediaGallery extends HTMLElement {
    constructor() {
      super();

      if (Shopify.designMode) {
        setTimeout(() => this.init(), 200);
      } else {
        this.init();
      }
    }

    disconnectedCallback() {
      window.removeEventListener('on:debounced-resize', this.resizeHandler);

      if (this.resizeInitHandler) {
        window.removeEventListener('on:debounced-resize', this.resizeInitHandler);
      }

      if (this.zoomInitHandler) {
        window.removeEventListener('on:debounced-resize', this.zoomInitHandler);
      }
    }

    init() {
      this.section = this.closest('.js-product');
      this.noSelectedVariant = this.hasAttribute('data-no-selected-variant');
      this.mediaGroupingEnabled = this.hasAttribute('data-media-grouping-enabled')
        && this.getMediaGroupData();
      if (!this.closest('quick-add-drawer')) {
        this.stackedScroll = this.dataset.stackedScroll;
        this.stackedScrollSticky = this.dataset.stackedScrollSticky;
      } else {
        this.stackedScroll = 'never';
        this.stackedScrollSticky = null;
      }
      this.stackedUnderline = this.dataset.stackedUnderline === 'true' && !this.mediaGroupingEnabled;
      this.isFeatured = this.dataset.isFeatured === 'true';
      this.viewer = this.querySelector('.media-viewer');
      this.thumbs = this.querySelector('.media-thumbs');
      this.thumbsItems = this.querySelectorAll('.media-thumbs__item');
      this.controls = this.querySelector('.media-ctrl');
      this.prevBtn = this.querySelector('.media-ctrl__btn[name="prev"]');
      this.nextBtn = this.querySelector('.media-ctrl__btn[name="next"]');
      this.counterCurrent = this.querySelector('.media-ctrl__current-item');
      this.counterTotal = this.querySelector('.media-ctrl__total-items');
      this.liveRegion = this.querySelector('.media-gallery__status');
      this.zoomLinks = this.querySelectorAll('.js-zoom-link');
      this.loadingSpinner = this.querySelector('.loading-spinner');
      this.xrButton = this.querySelector('.media-xr-button');
      this.stackedScrollUp = this.querySelector('.js-stacked-scroll-up');
      this.stackedScrollDown = this.querySelector('.js-stacked-scroll-down');
      this.scrollIndicator = this.querySelector('.js-sticky-scroll-indicator');

      if (this.hasAttribute('data-zoom-enabled')) {
        this.galleryModal = this.querySelector('.js-media-zoom-template').content.firstElementChild.cloneNode(true);
      }

      if (this.mediaGroupingEnabled && !this.noSelectedVariant) {
        this.setActiveMediaGroup(this.getMediaGroupFromOptionSelectors());
      }

      if (this.dataset.layout === 'stacked' && theme.mediaMatches.md) {
        if (this.stackedScrollSticky) this.initGallery();
        this.resizeInitHandler = this.resizeInitHandler || this.initGallery.bind(this);
        window.addEventListener('on:debounced-resize', this.resizeInitHandler);
        this.setVisibleItems();
        this.previousMediaItem = this.querySelector('.media-viewer__item.is-current-variant');
        setTimeout(() => this.customSetActiveMedia(this.previousMediaItem, this.stackedScroll === 'always'), 200);
        this.addEventListener('on:media:play', (evt) => {
          pauseAllMedia(document, evt.detail.player);
        });
      } else {
        this.initGallery();
      }

      if (this.zoomLinks) {
        if (this.dataset.zoomTrigger === 'hover') {
          this.triggerZoomInit();
        } else {
          this.zoomLinks.forEach((zoomLink) => {
            zoomLink.addEventListener('click', (evt) => {
              this.triggerZoomInit();
              evt.preventDefault();
            });
          });
        }
      }

      this.section.addEventListener('on:variant:change', this.onVariantChange.bind(this));

      // Play deferred media for the stacked layout
      if (this.closest('.product-media--stacked')) {
        this.section.querySelectorAll('deferred-media').forEach((deferredMedia) => {
          if (deferredMedia
            && deferredMedia.dataset.autoplay === 'true'
            && typeof deferredMedia.loadContent === 'function'
          ) {
            deferredMedia.loadContent(false);
            const firstVideo = this.section.querySelector('video');
            if (firstVideo) firstVideo.play();
          }
        });
      }

      // Loading graphic
      this.querySelectorAll('.media:has(img)').forEach((media) => {
        media.classList.add('media--loading');
        const img = media.querySelector('img');
        img.decode()
          .then(() => {
            media.classList.add('media--loaded');
          })
          .catch(() => {
            media.classList.add('media--loaded');
            media.classList.add('media--load-error');
          });
      });
    }

    /**
     * Initialises the media gallery slider and associated controls.
     */
    initGallery() {
      this.setVisibleItems();
      if (this.visibleItems.length <= 1) return;

      this.viewerItemOffset = this.visibleItems[1].offsetLeft - this.visibleItems[0].offsetLeft;
      this.currentIndex = Math.round(this.viewer.scrollLeft / this.viewerItemOffset);
      this.currentItem = this.visibleItems[this.currentIndex];
      this.addListeners();

      if (this.thumbs && this.currentItem) {
        this.currentThumb = this.thumbs.querySelector(
          `[data-media-id="${this.currentItem.dataset.mediaId}"]`
        );
      }

      if (!this.isFeatured && document.hasFocus()) {
        // Eager load the slider images for smooth UX
        this.viewer.querySelectorAll('.product-image[loading="lazy"]').forEach((img, index) => {
          setTimeout(() => {
            img.loading = 'eager';
          }, 500 * (index + 1));
        });
      }

      const currentItem = this.querySelector('.media-viewer__item.is-current-variant');
      const doScroll = this.dataset.layout !== 'stacked' || !theme.mediaMatches.md || this.stackedScroll === 'always';
      this.customSetActiveMedia(currentItem, doScroll, false);
    }

    addListeners() {
      this.viewer.addEventListener('scroll', this.handleScroll.bind(this));
      if (this.controls) this.controls.addEventListener('click', this.handleNavClick.bind(this));
      if (this.thumbs) this.thumbs.addEventListener('click', this.handleThumbClick.bind(this));
      if (this.stackedScrollSticky) {
        this.stackedScrollUp.addEventListener('click', this.handleStackedScrollUp.bind(this));
        this.stackedScrollDown.addEventListener('click', this.handleStackedScrollDown.bind(this));
      }
      this.resizeHandler = this.resizeHandler || this.handleResize.bind(this);
      window.addEventListener('on:debounced-resize', this.resizeHandler);
    }

    triggerZoomInit() {
      this.zoomInitHandler = this.zoomInitHandler || this.initZoom.bind(this);
      this.zoomEventListener = this.zoomEventListener || this.handleZoomMouseMove.bind(this);
      this.mouseLeaveListener = this.mouseLeaveListener || this.destroyZoom.bind(this);
      window.addEventListener('on:debounced-resize', this.zoomInitHandler);
      this.initZoom();
      this.zoomLinks.forEach((zoomLink) => {
        zoomLink.addEventListener('click', (evt) => {
          evt.preventDefault();
        });
      });
    }

    /**
     * Handle a change in variant on the page.
     * @param {Event} evt - variant change event dispatched by variant-picker
     */
    onVariantChange(evt) {
      if (this.mediaGroupingEnabled) {
        this.setActiveMediaGroup(this.getMediaGroupFromOptionSelectors());
      }

      if (evt.detail.variant && evt.detail.variant.featured_media) {
        const variantMedia = this.viewer.querySelector(
          `[data-media-id="${evt.detail.variant.featured_media.id}"]`
        );
        if (variantMedia) {
          this.customSetActiveMedia(variantMedia, true);
        }
      }
    }

    /**
     * Gets the media group from currently selected variant options.
     * @returns {?object}
     */
    getMediaGroupFromOptionSelectors() {
      const optionSelectors = this.section.querySelectorAll('.option-selector');
      if (optionSelectors.length > this.getMediaGroupData().groupOptionIndex) {
        const selector = optionSelectors[this.getMediaGroupData().groupOptionIndex];
        if (selector.dataset.selectorType === 'dropdown') {
          return selector.querySelector('.custom-select__btn').textContent.trim();
        }
        return selector.querySelector('input:checked').value;
      }
      return null;
    }

    /**
     * Gets the variant media associations for a product.
     * @returns {?object}
     */
    getMediaGroupData() {
      if (typeof this.variantMediaData === 'undefined') {
        const dataEl = this.querySelector('.js-data-variant-media');
        this.variantMediaData = dataEl ? JSON.parse(dataEl.textContent) : false;
      }

      return this.variantMediaData;
    }

    /**
     * Gets an object mapping media to groups, and the reverse
     * @returns {?object}
     */
    getMediaGroupMap() {
      if (!this.mediaGroupMap) {
        this.mediaGroupMap = {
          groups: {}
        };

        // set up grouping
        const variantMediaData = this.getMediaGroupData();
        let currentMediaOptionName = false;
        this.viewerItems = this.querySelectorAll('.media-viewer__item');
        this.viewerItems.forEach((item) => {
          for (let i = 0; i < variantMediaData.variantMedia.length; i += 1) {
            if (parseInt(item.dataset.mediaId, 10) === variantMediaData.variantMedia[i].mediaId) {
              if (currentMediaOptionName !== variantMediaData.variantMedia[i].option) {
                currentMediaOptionName = variantMediaData.variantMedia[i].option;
              }
            }
          }
          if (currentMediaOptionName) {
            if (!this.mediaGroupMap.groups[currentMediaOptionName]) {
              this.mediaGroupMap.groups[currentMediaOptionName] = {
                name: currentMediaOptionName,
                items: []
              };
            }
            const groupItem = { main: item };
            if (this.thumbs) {
              groupItem.thumb = this.thumbs.querySelector(
                `[data-media-id="${item.dataset.mediaId}"].media-thumbs__item`
              );
            }
            this.mediaGroupMap.groups[currentMediaOptionName].items.push(groupItem);
          }
        });

        // add helper
        this.mediaGroupMap.groupFromItem = (item) => {
          const groups = Object.keys(this.mediaGroupMap.groups);
          for (let i = 0; i < groups; i += 1) {
            const group = groups[i];
            for (let j = 0; j < this.mediaGroupMap.groups[group].items.length; j += 1) {
              if (this.mediaGroupMap.groups[group].items[j] === item) {
                return this.mediaGroupMap.groups[group];
              }
            }
          }
          return this.mediaGroupMap.groups[Object.keys(this.mediaGroupMap.groups)[0]];
        };
      }

      return this.mediaGroupMap;
    }

    /**
     * Show only images associated to the current variant
     * @param {string} groupName - optional - Group to show (uses this.currentItem if empty)
     */
    setActiveMediaGroup(groupName) {
      const mediaGroupMap = this.getMediaGroupMap();
      const selectedGroup = groupName
        ? mediaGroupMap.groups[groupName]
        : mediaGroupMap.groupFromItem(this.currentItem);

      if (selectedGroup) {
        if (this.currentGroup !== selectedGroup) {
          this.currentGroup = selectedGroup;
          // Hide & reset all
          this.viewerItems.forEach((item) => {
            item.style.display = 'none';
            item.classList.remove('media-viewer__item--single');
          });
          this.thumbsItems.forEach((item) => {
            item.style.display = 'none';
          });

          // Show relevant
          let currentItemIsVisible = false;
          selectedGroup.items.forEach((item) => {
            item.main.style.display = '';
            if (item.thumb) {
              item.thumb.style.display = '';
            }
            if (item.main === this.currentItem) {
              currentItemIsVisible = true;
            }
          });
          this.setVisibleItems();

          // Move hidden to end, to allow nth-child CSS
          const moveHiddenItemsToEnd = (items) => {
            [...items]
              .filter((item) => item.style.display === 'none')
              .forEach((item) => item.parentNode.appendChild(item));
          };

          moveHiddenItemsToEnd(this.viewerItems);
          moveHiddenItemsToEnd(this.thumbsItems);

          // If current item is not in this group, set it as the active item
          if (!currentItemIsVisible) {
            this.customSetActiveMedia(selectedGroup.items[0].main, true);
          }

          // Handle single images on stacked view
          if (selectedGroup.items.length === 1) {
            selectedGroup.items[0].main.classList.add('media-viewer__item--single');
          }
        }
      } else {
        this.viewerItems.forEach((item) => {
          item.style.display = '';
        });
        this.thumbsItems.forEach((item) => {
          item.style.display = '';
        });
      }
    }

    /**
     * Initialized the zoom on hover for desktop
     */
    initZoom() {
      this.zoomLinks.forEach((el) => {
        const zoomWidth = Number(el.querySelector('.zoom-image').dataset.originalWidth || 0);
        const imageWidth = el.querySelector('.product-image').getBoundingClientRect().width;
        if (theme.mediaMatches.md && ((zoomWidth - 75) > (imageWidth))) {
          el.addEventListener('mousemove', this.zoomEventListener);
          el.addEventListener('mouseleave', this.mouseLeaveListener);
          el.classList.remove('pointer-events-none');
        } else {
          el.removeEventListener('mousemove', this.zoomEventListener);
          el.classList.add('pointer-events-none');
        }
      });
    }

    destroyZoom() {
      this.zoomLinks.forEach((el) => {
        el.removeEventListener('mousemove', this.zoomEventListener);
        requestAnimationFrame(() => {
          el.classList.add('media--zoom-not-loaded');
        });
      });
    }

    /**
     * Handles mouse move over a zoomable image
     * @param {?object} evt - Event object.
     */
    handleZoomMouseMove(evt) {
      const hoverElem = evt.currentTarget;
      const zoomImage = hoverElem.querySelector('.js-zoom-image');

      // Download the zoom image if necessary
      if (zoomImage.dataset.src) {
        this.loadingSpinner.classList.remove('loading-spinner--out');

        const img = new Image();
        img.src = zoomImage.dataset.src;
        img.onload = () => {
          zoomImage.src = img.src;
          hoverElem.classList.remove('media--zoom-not-loaded');
          this.loadingSpinner.classList.add('loading-spinner--out');
        };
        zoomImage.removeAttribute('data-src');
      } else {
        hoverElem.classList.remove('media--zoom-not-loaded');
      }

      try {
        const offsetX = evt.offsetX ? evt.offsetX : evt.touches[0].pageX;
        const offsetY = evt.offsetY ? evt.offsetY : evt.touches[0].pageY;
        const x = (offsetX / zoomImage.offsetWidth) * 100;
        const y = (offsetY / zoomImage.offsetHeight) * 100;
        zoomImage.style.objectPosition = `${x}% ${y}%`;
      } catch (err) {
        // Fail silently
      }
    }

    /**
     * Handles 'scroll' events on the main media container.
     */
    handleScroll() {
      if (!this.stackedScrollSticky || !theme.mediaMatches.md) {
        const newIndex = Math.round(this.viewer.scrollLeft / this.viewerItemOffset);

        if (newIndex !== this.currentIndex) {
          const viewerItemOffset = this.visibleItems[1].offsetLeft
            - this.visibleItems[0].offsetLeft;

          // If scroll wasn't caused by a resize event, update the active media.
          if (viewerItemOffset === this.viewerItemOffset) {
            this.customSetActiveMedia(this.visibleItems[newIndex], false);
          }
        }
      } else {
        this.scrollToMediaViewer();

        const hasScrollableContent = this.viewer.scrollHeight > this.viewer.clientHeight;
        const { clientHeight, scrollHeight, scrollTop } = this.viewer;

        // Disable both buttons if there's no content to scroll
        if (!hasScrollableContent) {
          this.stackedScrollUp.disabled = true;
          this.stackedScrollDown.disabled = true;
          return;
        }

        // Enable/disable the scroll up button based on scroll position
        if (this.viewer.scrollTop === 0) {
          this.stackedScrollUp.disabled = true;
        } else {
          this.stackedScrollUp.disabled = false;
        }

        // Enable/disable the scroll down button based on scroll position
        if ((this.viewer.scrollTop + this.viewer.clientHeight >= this.viewer.scrollHeight)
          || (scrollTop + clientHeight >= scrollHeight)) {
          this.stackedScrollDown.disabled = true;
        } else {
          this.stackedScrollDown.disabled = false;
        }

        // Calculate the percentage of how far we've scrolled and set the and position of
        // the scroll indicator. 50 is the height of the custom scrollbar.
        const scrollPercentage = scrollTop / (scrollHeight - clientHeight);
        const scrollableHeight = this.scrollIndicator.parentElement.clientHeight - 50;
        this.scrollIndicator.style.top = `${scrollableHeight * scrollPercentage}px`;
      }
    }

    /**
     * Scrolls the page to the media viewer
     */
    scrollToMediaViewer() {
      if (theme.mediaMatches.md && !this.isFeatured) {
        const headerHeight = document.querySelector('.js-header-height').clientHeight;
        const viewerPosition = this.getBoundingClientRect().top + window.scrollY;
        const targetScrollPosition = viewerPosition - headerHeight;

        // Only scroll if the current position isn't within +-5 pixels of the target
        if (Math.abs(window.scrollY - targetScrollPosition) > 5) {
          window.scrollTo({
            top: targetScrollPosition,
            behavior: 'smooth'
          });
        }
      }
    }

    /**
     * Handles 'click' events on the stacked arrows.
     */
    handleStackedScrollUp() {
      this.scrollToMediaViewer();
      this.viewer.scrollTo({
        top: this.viewer.scrollTop - this.viewer.clientHeight,
        behavior: 'smooth'
      });
    }

    /**
     * Handles 'click' events on the stacked arrows.
     */
    handleStackedScrollDown() {
      this.scrollToMediaViewer();
      this.viewer.scrollTo({
        top: this.viewer.scrollTop + this.viewer.clientHeight,
        behavior: 'smooth'
      });
    }

    /**
     * Handles 'click' events on the controls container.
     * @param {object} evt - Event object.
     */
    handleNavClick(evt) {
      if (!evt.target.matches('.media-ctrl__btn')) return;

      const itemToShow = evt.target === this.nextBtn
        ? this.visibleItems[this.currentIndex + 1]
        : this.visibleItems[this.currentIndex - 1];

      this.viewer.scrollTo({ left: itemToShow.offsetLeft, behavior: 'smooth' });
    }

    /**
     * Handles 'click' events on the thumbnails container.
     * @param {object} evt - Event object.
     */
    handleThumbClick(evt) {
      const thumb = evt.target.closest('[data-media-id]');
      if (!thumb) return;

      const itemToShow = this.querySelector(`[data-media-id="${thumb.dataset.mediaId}"]`);
      this.customSetActiveMedia(itemToShow);

      MediaGallery.playActiveMedia(itemToShow);
    }

    /**
     * Handles debounced 'resize' events on the window.
     */
    handleResize() {
      // Reset distance from leading edge of one slide to the next.
      this.viewerItemOffset = this.visibleItems[1].offsetLeft - this.visibleItems[0].offsetLeft;

      if (this.thumbs && this.currentThumb) {
        this.checkThumbVisibilty(this.currentThumb);
      }
    }

    /**
     * Stub for variant-picker calls. Listening to change event instead.
     */
    // eslint-disable-next-line class-methods-use-this
    setActiveMedia() {}

    /**
     * Sets the active media item.
     * @param {Element} mediaItem - Media element to set as active.
     * @param {boolean} [scrollToItem=true] - Scroll to the active media item.
     * @param {boolean} [smoothScroll=true] - Smoothly scroll, if scrolling to media.
     */
    customSetActiveMedia(mediaItem, scrollToItem = true, smoothScroll = true) {
      if (mediaItem === this.currentItem) return;
      pauseAllMedia(this);
      this.currentItem = mediaItem;
      this.currentIndex = this.visibleItems.indexOf(this.currentItem);

      if (this.dataset.layout === 'stacked' && theme.mediaMatches.md) {
        // Update the active class and scroll to the active media
        if (this.stackedUnderline) {
          if (this.previousMediaItem) this.previousMediaItem.classList.remove('is-active');
          mediaItem.classList.add('is-active');
          this.previousMediaItem = mediaItem;
        }

        if (this.stackedScroll !== 'never') {
          if (this.stackedScrollSticky) {
            setTimeout(() => {
              this.viewer.scrollTo({ top: this.currentItem.offsetTop, behavior: 'smooth' });
            }, 0);
          } else {
            const y = mediaItem.getBoundingClientRect().top
              + document.documentElement.scrollTop - 150;

            // If the element is far enough away to scroll to it
            if (Math.abs(y - document.documentElement.scrollTop) > 300 && !this.isFeatured) {
              window.scrollTo({
                top: y < 100 ? 0 : y,
                behavior: 'smooth'
              });
            }
          }
        }
        return;
      }

      if (scrollToItem) {
        this.viewer.scrollTo({
          left: this.currentItem.offsetLeft,
          behavior: smoothScroll ? 'auto' : 'instant'
        });
      }
      if (this.thumbs) this.setActiveThumb();

      if (this.controls) {
        if (this.prevBtn) {
          this.prevBtn.disabled = this.currentIndex === 0;
        }

        if (this.nextBtn) {
          this.nextBtn.disabled = this.currentIndex === this.visibleItems.length - 1;
        }

        if (this.counterCurrent) {
          this.counterCurrent.textContent = this.currentIndex + 1;
        }
      }

      this.announceLiveRegion(this.currentItem, this.currentIndex + 1);

      if (this.xrButton && mediaItem.dataset.mediaType === 'model') {
        this.xrButton.dataset.shopifyModel3dId = mediaItem.dataset.mediaId;
      }
    }

    /**
     * Sets the active thumbnail.
     */
    setActiveThumb() {
      this.currentThumb = this.thumbs.querySelector(
        `[data-media-id="${this.currentItem.dataset.mediaId}"]`
      );
      const btn = this.currentThumb.querySelector('button');

      this.thumbs.querySelectorAll('.media-thumbs__btn').forEach((el) => {
        el.classList.remove('is-active');
        el.removeAttribute('aria-current');
      });

      btn.classList.add('is-active');
      btn.setAttribute('aria-current', 'true');
      this.checkThumbVisibilty(this.currentThumb);
    }

    /**
     * Creates an array of the visible media items.
     */
    setVisibleItems() {
      this.viewerItems = this.querySelectorAll('.media-viewer__item');
      this.visibleItems = Array.from(this.viewerItems).filter((el) => el.clientWidth > 0);
      this.dataset.mediaCount = this.visibleItems.length;
      if (this.counterTotal) {
        this.counterTotal.textContent = this.visibleItems.length;
      }
    }

    /**
     * Ensures a thumbnail is in the visible area of the slider.
     * @param {Element} thumb - Thumb item element.
     */
    checkThumbVisibilty(thumb) {
      const scrollPos = this.thumbs.scrollLeft;
      const lastVisibleThumbOffset = this.thumbs.clientWidth + scrollPos;
      const thumbOffset = thumb.offsetLeft;

      if (thumbOffset + thumb.clientWidth > lastVisibleThumbOffset || thumbOffset < scrollPos) {
        this.thumbs.scrollTo({ left: thumbOffset, behavior: 'smooth' });
      }
    }

    /**
     * Updates the media gallery status.
     * @param {Element} mediaItem - Active media element.
     * @param {number} index - Active media index.
     */
    announceLiveRegion(mediaItem, index) {
      const image = mediaItem.querySelector('.media-viewer img');
      if (!image) return;

      this.liveRegion.setAttribute('aria-hidden', 'false');
      this.liveRegion.innerHTML = theme.strings.imageAvailable.replace('[index]', index);

      setTimeout(() => {
        this.liveRegion.setAttribute('aria-hidden', 'true');
      }, 2000);
    }

    /**
     * Loads the deferred media for the active item.
     * @param {Element} mediaItem - Active media element.
     */
    static playActiveMedia(mediaItem) {
      pauseAllMedia();
      const deferredMedia = mediaItem.querySelector('deferred-media');
      if (deferredMedia) deferredMedia.loadContent();
      setTimeout(() => {
        const video = mediaItem.querySelector('video');
        if (video) video.play();
      }, 500);
    }
  }

  customElements.define('media-gallery', MediaGallery);
}
