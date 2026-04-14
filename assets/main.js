/**
 * Polyfills :focus-visible for non supporting browsers (Safari < 15.4).
 */
function focusVisiblePolyfill() {
  const navKeys = [
    "Tab",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Enter",
    "Space",
    "Escape",
    "Home",
    "End",
    "PageUp",
    "PageDown",
  ];
  let currentFocusedElement = null;
  let mouseClick = null;

  window.addEventListener("keydown", (evt) => {
    if (navKeys.includes(evt.code)) mouseClick = false;
  });

  window.addEventListener("mousedown", () => {
    mouseClick = true;
  });

  window.addEventListener(
    "focus",
    () => {
      if (currentFocusedElement)
        currentFocusedElement.classList.remove("is-focused");
      if (mouseClick) return;

      currentFocusedElement = document.activeElement;
      currentFocusedElement.classList.add("is-focused");
    },
    true,
  );
}

// Add polyfill if :focus-visible is not supported.
try {
  document.querySelector(":focus-visible");
} catch (e) {
  focusVisiblePolyfill();
}

theme.fetchCache = {
  MAX_CACHE_SIZE: 20,
  cache: new Map(),
  pending: new Map(),

  /**
   * Fetches a URL and returns text, storing the result in a cache used for subsequent requests
   * to the same URL. Use theme.fetchCache.fetch(url) in theme code to return a Promise.
   * @param {Element} url - URL to fetch.
   * @returns {string} Text from request.
   */
  async fetchAndCache(url) {
    const response = await fetch(url);
    const text = await response.text();

    // Evict oldest if needed
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = [...this.cache.entries()].sort(
        (a, b) => a[1].timestamp - b[1].timestamp,
      )[0][0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(url, { text, timestamp: Date.now() });
    this.pending.delete(url);
    return text;
  },

  /**
   * Fetches a URL and returns text, using a local cache.
   * @param {Element} url - URL to fetch.
   * @returns {Promise} Promise that completes and returns the response as a string parameter.
   */
  fetch(url) {
    if (this.cache.has(url)) {
      return Promise.resolve(this.cache.get(url).text);
    }

    if (this.pending.has(url)) {
      return this.pending.get(url);
    }

    const promise = this.fetchAndCache(url);
    this.pending.set(url, promise);
    return promise;
  },

  /**
   * Preload a URL in the fetch cache.
   * @param {Element} url - URL to preload.
   */
  preload(url) {
    this.fetch(url).catch(() => {
      this.cache.delete(url);
      this.pending.delete(url);
    });
  },

  /**
   * Clear the cache.
   */
  clear() {
    this.cache.clear();
  },
};

/**
 * Creates a 'mediaMatches' object from the media queries specified in the theme,
 * and adds listeners for each media query. If a breakpoint is crossed, the mediaMatches
 * values are updated and a 'on:breakpoint-change' event is dispatched.
 */
(() => {
  const { mediaQueries } = theme;
  if (!mediaQueries) return;

  const mqKeys = Object.keys(mediaQueries);
  const mqLists = {};
  theme.mediaMatches = {};

  /**
   * Handles a media query (breakpoint) change.
   */
  const handleMqChange = () => {
    const newMatches = mqKeys.reduce((acc, media) => {
      acc[media] = !!(mqLists[media] && mqLists[media].matches);
      return acc;
    }, {});

    // Update mediaMatches values after breakpoint change.
    Object.keys(newMatches).forEach((key) => {
      theme.mediaMatches[key] = newMatches[key];
    });

    window.dispatchEvent(new CustomEvent("on:breakpoint-change"));
  };

  mqKeys.forEach((mq) => {
    // Create mqList object for each media query.
    mqLists[mq] = window.matchMedia(mediaQueries[mq]);

    // Get initial matches for each query.
    theme.mediaMatches[mq] = mqLists[mq].matches;

    // Add an event listener to each query.
    try {
      mqLists[mq].addEventListener("change", handleMqChange);
    } catch (err1) {
      // Fallback for legacy browsers (Safari < 14).
      mqLists[mq].addListener(handleMqChange);
    }
  });
})();

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

/**
 * Sets a 'viewport-height' custom property on the root element.
 */
function setViewportHeight() {
  document.documentElement.style.setProperty(
    "--viewport-height",
    `${window.innerHeight}px`,
  );
}

/**
 * Sets a 'header-height' custom property on the root element.
 */
function setHeaderHeight() {
  const header = document.querySelector(".js-header-height");
  if (!header) return;
  let height = header.offsetHeight;

  // Add announcement bar height (if shown).
  const announcement = document.querySelector(".cc-announcement");
  const announcementHeight = announcement ? announcement.offsetHeight : 0;
  height += announcementHeight;

  document.documentElement.style.setProperty(
    "--announcement-height",
    `${announcementHeight}px`,
  );
  document.documentElement.style.setProperty("--header-height", `${height}px`);
}

/**
 * Sets a 'scrollbar-width' custom property on the root element.
 */
function setScrollbarWidth() {
  document.documentElement.style.setProperty(
    "--scrollbar-width",
    `${window.innerWidth - document.documentElement.clientWidth}px`,
  );
}

/**
 * Sets the dimension variables.
 */
function setDimensionVariables() {
  setViewportHeight();
  setHeaderHeight();
  setScrollbarWidth();
}

// Set the dimension variables once the DOM is loaded
document.addEventListener("DOMContentLoaded", setDimensionVariables);

// Update the dimension variables if viewport resized.
window.addEventListener("resize", debounce(setDimensionVariables, 400));

// iOS alters screen width without resize event, if unexpectedly wide content is found
setTimeout(setViewportHeight, 3000);

/**
 * Adds an observer to initialise a script when an element is scrolled into view.
 * @param {Element} element - Element to observe.
 * @param {Function} callback - Function to call when element is scrolled into view.
 * @param {number} [threshold=500] - Distance from viewport (in pixels) to trigger init.
 */
function initLazyScript(element, callback, threshold = 500) {
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (typeof callback === "function") {
              callback();
              observer.unobserve(entry.target);
            }
          }
        });
      },
      { rootMargin: `0px 0px ${threshold}px 0px` },
    );

    io.observe(element);
  } else {
    callback();
  }
}

window.addEventListener(
  "resize",
  debounce(() => {
    window.dispatchEvent(new CustomEvent("on:debounced-resize"));
  }),
);

/**
 * Utility function for scrolling to reveal an element
 */
(() => {
  theme.stickyHeaderHeight = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(
      "--header-height",
    );
    if (v) {
      return parseInt(v, 10) || 0;
    }
    return 0;
  };

  theme.getOffsetTopFromDoc = (el) =>
    el.getBoundingClientRect().top + window.scrollY;

  theme.getScrollParent = (node) => {
    const isElement = node instanceof HTMLElement;
    const overflowY = isElement && window.getComputedStyle(node).overflowY;
    const isScrollable = overflowY !== "visible" && overflowY !== "hidden";

    if (!node) {
      return null;
    }

    if (isScrollable && node.scrollHeight > node.clientHeight) {
      return node;
    }

    return (
      theme.getScrollParent(node.parentNode) ||
      document.scrollingElement ||
      window
    );
  };

  theme.scrollToRevealElement = (el) => {
    const scrollContainer = theme.getScrollParent(el);
    const scrollTop =
      scrollContainer === window ? window.scrollY : scrollContainer.scrollTop;
    const scrollVisibleHeight =
      scrollContainer === window
        ? window.innerHeight
        : scrollContainer.clientHeight;
    const elTop = theme.getOffsetTopFromDoc(el);
    const elBot = elTop + el.offsetHeight;
    const inViewTop = scrollTop + theme.stickyHeaderHeight();
    const inViewBot = scrollTop + scrollVisibleHeight - 50;

    if (elTop < inViewTop || elBot > inViewBot) {
      scrollContainer.scrollTo({
        top: elTop - 100 - theme.stickyHeaderHeight(),
        left: 0,
        behavior: "smooth",
      });
    }
  };
})();

/**
 * Pauses all media (videos/models) within an element.
 * @param {Element} [el=document] - Element to pause media within.
 * @param {Element} [excludeVideo] - Video element to not pause.
 */
function pauseAllMedia(el = document, excludeVideo = null) {
  el.querySelectorAll(".js-youtube, .js-vimeo, video").forEach((video) => {
    if (video === excludeVideo) return;
    const component = video.closest("video-component");
    if (component && component.dataset.background === "true") return;

    if (video.matches(".js-youtube")) {
      video.contentWindow.postMessage(
        '{ "event": "command", "func": "pauseVideo", "args": "" }',
        "*",
      );
    } else if (video.matches(".js-vimeo")) {
      video.contentWindow.postMessage('{ "method": "pause" }', "*");
    } else {
      video.pause();
    }
  });

  el.querySelectorAll("product-model").forEach((model) => {
    try {
      if (model.modelViewerUI) model.modelViewerUI.pause();
    } catch {
      // Do nothing
    }
  });
}

class DeferredMedia extends HTMLElement {
  constructor() {
    super();

    const loadBtn = this.querySelector(".js-load-media");
    if (loadBtn) {
      loadBtn.addEventListener("click", this.loadContent.bind(this));
    } else {
      this.addObserver();
    }
  }

  /**
   * Adds an Intersection Observer to load the content when viewport scroll is near
   */
  addObserver() {
    if ("IntersectionObserver" in window === false) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadContent(false, false, "observer");
            observer.unobserve(this);
          }
        });
      },
      { rootMargin: "0px 0px 1000px 0px" },
    );

    observer.observe(this);
  }

  /**
   * Loads the deferred media.
   * @param {boolean} [focus=true] - Focus the deferred media element after loading.
   * @param {boolean} [pause=true] - Whether to pause all media after loading.
   * @param {string} [loadTrigger='click'] - The action that caused the deferred content to load.
   */
  loadContent(focus = true, pause = true, loadTrigger = "click") {
    if (pause) pauseAllMedia();
    if (this.getAttribute("loaded") !== null) return;

    this.loadTrigger = loadTrigger;
    const content =
      this.querySelector("template").content.firstElementChild.cloneNode(true);
    this.appendChild(content);
    this.setAttribute("loaded", "");

    const deferredEl = this.querySelector("video, model-viewer, iframe");
    if (deferredEl && focus) deferredEl.focus();
  }
}

customElements.define("deferred-media", DeferredMedia);

class DetailsDisclosure extends HTMLElement {
  constructor() {
    super();
    this.disclosure = this.querySelector("details");
    this.toggle = this.querySelector("summary");
    this.panel = this.toggle.nextElementSibling;
    this.transitionsEnabled = null;
    this.groupContainer = this.dataset.groupContainer
      ? this.closest(this.dataset.groupContainer)
      : null;

    this.toggle.addEventListener("click", this.handleToggle.bind(this));
    this.disclosure.addEventListener(
      "transitionend",
      this.handleTransitionEnd.bind(this),
    );
  }

  /**
   * Handles 'click' events on the summary element.
   * @param {object} evt - Event object.
   */
  handleToggle(evt) {
    if (this.transitionsEnabled === null) this.checkTransitionsEnabled();
    if (!this.transitionsEnabled) return;

    evt.preventDefault();

    if (!this.disclosure.open) {
      this.open();
    } else {
      this.close();
    }
  }

  /**
   * Check if transitions are enabled on this disclosure, saving this in this.transitionsEnabled
   */
  checkTransitionsEnabled() {
    // Style check may cause break in Chrome dev tools - do not perform on init
    this.transitionsEnabled =
      window.getComputedStyle(this.panel).transitionDuration !== "0s";
  }

  /**
   * Handles 'transitionend' events on the details element.
   * @param {object} evt - Event object.
   */
  handleTransitionEnd(evt) {
    if (evt.target !== this.panel) return;

    if (this.disclosure.classList.contains("is-closing")) {
      this.disclosure.classList.remove("is-closing");
      this.disclosure.open = false;
    }

    this.panel.removeAttribute("style");

    if (this.groupContainer) {
      this.groupContainer.style.minHeight = null;
    }
  }

  /**
   * Adds inline 'height' style to the content element, to trigger open transition.
   */
  addContentHeight() {
    this.panel.style.height = `${this.panel.scrollHeight}px`;
  }

  /**
   * Opens the details element.
   */
  open() {
    // If we're in a group container, close any open disclosures in the group
    if (this.groupContainer) {
      this.groupContainer.style.minHeight = `${this.groupContainer.getBoundingClientRect().height}px`;
      const openDisclosure = this.groupContainer.querySelector(
        "details-disclosure:has(.disclosure[open])",
      );
      if (openDisclosure) openDisclosure.close();
    }

    // Set content 'height' to zero before opening the details element.
    this.panel.style.height = "0";

    // Open the details element
    this.disclosure.open = true;

    // Set content 'height' to its scroll height, to enable CSS transition.
    this.addContentHeight();
  }

  /**
   * Closes the details element.
   */
  close() {
    // Set content height to its scroll height, to enable transition to zero.
    this.addContentHeight();

    // Add class to enable styling of content or toggle icon before or during close transition.
    this.disclosure.classList.add("is-closing");

    // Set content height to zero to trigger the transition.
    // Slight delay required to allow scroll height to be applied before changing to '0'.
    setTimeout(() => {
      this.panel.style.height = "0";
    });
  }
}

customElements.define("details-disclosure", DetailsDisclosure);

const trapFocusHandlers = {};

/**
 * Removes focus trap event listeners and optionally focuses an element.
 * @param {Element} [elementToFocus=null] - Element to focus when trap is removed.
 */
function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener("focusin", trapFocusHandlers.focusin);
  document.removeEventListener("focusout", trapFocusHandlers.focusout);
  document.removeEventListener("keydown", trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

/**
 * Traps focus within a container, e.g. modal or side drawer.
 * @param {Element} container - Container element to trap focus within.
 * @param {Element} [elementToFocus=container] - Initial element to focus when trap is applied.
 */
function trapFocus(container, elementToFocus = container) {
  const focusableEls = Array.from(
    container.querySelectorAll(
      'summary, a[href], area[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), object, iframe, audio[controls], video[controls], [tabindex]:not([tabindex^="-"])',
    ),
  );

  let firstEl = null;
  let lastEl = null;
  const isVisible = (el) =>
    el.offsetParent && getComputedStyle(el).visibility !== "hidden";

  const setFirstLastEls = () => {
    for (let i = 0; i < focusableEls.length; i += 1) {
      if (isVisible(focusableEls[i])) {
        firstEl = focusableEls[i];
        break;
      }
    }
    for (let i = focusableEls.length - 1; i >= 0; i -= 1) {
      if (isVisible(focusableEls[i])) {
        lastEl = focusableEls[i];
        break;
      }
    }
  };

  removeTrapFocus();

  trapFocusHandlers.focusin = (evt) => {
    setFirstLastEls();

    if (
      evt.target !== container &&
      evt.target !== lastEl &&
      evt.target !== firstEl
    )
      return;
    document.addEventListener("keydown", trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = () => {
    document.removeEventListener("keydown", trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = (evt) => {
    if (evt.code !== "Tab") return;

    setFirstLastEls();

    // If tab pressed on last focusable element, focus the first element.
    if (evt.target === lastEl && !evt.shiftKey) {
      evt.preventDefault();
      firstEl.focus();
    }

    //  If shift + tab pressed on the first focusable element, focus the last element.
    if ((evt.target === container || evt.target === firstEl) && evt.shiftKey) {
      evt.preventDefault();
      lastEl.focus();
    }
  };

  document.addEventListener("focusout", trapFocusHandlers.focusout);
  document.addEventListener("focusin", trapFocusHandlers.focusin);

  (elementToFocus || container).focus();
}

class Modal extends HTMLElement {
  constructor() {
    super();
    this.addEventListener("click", this.handleClick.bind(this));
  }

  /**
   * Handles 'click' events on the modal.
   * @param {object} evt - Event object.
   */
  handleClick(evt) {
    if (evt.target !== this && !evt.target.matches(".js-close-modal")) return;
    this.close();
  }

  /**
   * Opens the modal.
   * @param {Element} opener - Modal opener element.
   */
  open(opener) {
    this.setAttribute("open", "");
    this.openedBy = opener;

    trapFocus(this);
    window.pauseAllMedia();

    // Add event handler (so the bound event listener can be removed).
    this.keyupHandler = (evt) => evt.key === "Escape" && this.close();

    // Add event listener (for while modal is open).
    this.addEventListener("keyup", this.keyupHandler);

    // Wrap tables in a '.scrollable-table' element for a better mobile experience.
    this.querySelectorAll(":not(.scrollable-table) > table").forEach(
      (table) => {
        const wrapper = document.createElement("div");
        wrapper.className = "scrollable-table";
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      },
    );
  }

  /**
   * Closes the modal.
   */
  close() {
    this.removeAttribute("open");

    removeTrapFocus(this.openedBy);
    window.pauseAllMedia();

    // Remove event listener added on modal opening.
    this.removeEventListener("keyup", this.keyupHandler);
  }
}

customElements.define("modal-dialog", Modal);

class ModalOpener extends HTMLElement {
  constructor() {
    super();

    const button = this.querySelector("button");
    if (!button) return;

    button.addEventListener("click", () => {
      const modal = document.getElementById(this.dataset.modal);
      if (modal) modal.open(button);
    });
  }
}

customElements.define("modal-opener", ModalOpener);

/* eslint-disable max-len */
if (!customElements.get("parallax-container")) {
  class ParallaxContainer extends HTMLElement {
    connectedCallback() {
      this.docOffsetTop = this.getBoundingClientRect().top + window.scrollY;

      this.boundUpdate = () => {
        requestAnimationFrame(this.update.bind(this));
      };
      window.addEventListener("scroll", this.boundUpdate);

      this.resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          this.docOffsetTop = this.getBoundingClientRect().top + window.scrollY;
          this.update();
        });
      });
      this.resizeObserver.observe(this);

      this.intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.isVisible = true;
          } else {
            this.isVisible = false;
          }
        });
      });
      this.intersectionObserver.observe(this);
    }

    update() {
      if (!this.isVisible) return;

      const thisCenter = this.docOffsetTop + this.clientHeight / 2;
      const viewportCenter = window.scrollY + window.innerHeight / 2;
      let progress;
      if (this.clientHeight > window.innerHeight) {
        progress =
          (window.scrollY - this.docOffsetTop) /
          (this.clientHeight - window.innerHeight);
      } else {
        progress = (viewportCenter - this.docOffsetTop) / this.clientHeight;
      }

      this.style.setProperty(
        "--parallax-center-offset-y",
        `${viewportCenter - thisCenter}px`,
      );
      this.style.setProperty(
        "--parallax-top-offset-y",
        `${window.scrollY - this.docOffsetTop}`,
      );
      this.style.setProperty("--parallax-window-progress", progress);
    }
  }

  customElements.define("parallax-container", ParallaxContainer);
}

class ProductRecommendations extends HTMLElement {
  constructor() {
    super();
    window.initLazyScript(this, this.init.bind(this), 500);
  }

  async init() {
    const { productId } = this.dataset;
    if (!productId) return;

    try {
      const response = await fetch(
        `${this.dataset.url}&product_id=${productId}`,
      );
      if (!response.ok) throw new Error(response.status);

      const tmpl = document.createElement("template");
      tmpl.innerHTML = await response.text();

      const el = tmpl.content.querySelector("product-recommendations");
      if (el && el.hasChildNodes()) {
        this.innerHTML = el.innerHTML;
      }
    } catch (error) {
      console.log(error); // eslint-disable-line
    }
  }
}

customElements.define("product-recommendations", ProductRecommendations);

class SideDrawer extends HTMLElement {
  constructor() {
    super();
    this.overlay = document.querySelector(".js-overlay");
  }

  /**
   * Handles a 'click' event on the drawer.
   * @param {object} evt - Event object.
   */
  handleClick(evt) {
    if (evt.target.matches(".js-close-drawer") || evt.target === this.overlay) {
      this.close();
    }
  }

  /**
   * Opens the drawer.
   * @param {Element} [opener] - Element that triggered opening of the drawer.
   * @param {Element} [elementToFocus] - Element to focus after drawer opened.
   * @param {Function} [callback] - Callback function to trigger after the open has completed
   */
  open(opener, elementToFocus, callback) {
    this.dispatchEvent(
      new CustomEvent(`on:${this.dataset.name}:before-open`, {
        bubbles: true,
      }),
    );

    this.overlay.classList.add("is-visible");
    this.setAttribute("open", "");
    this.setAttribute("aria-hidden", "false");
    this.opener = opener;

    trapFocus(this, elementToFocus);

    // Create event handler variables (so the bound event listeners can be removed).
    this.clickHandler = this.clickHandler || this.handleClick.bind(this);
    this.keyupHandler = (evt) => {
      if (evt.key !== "Escape" || evt.target.closest(".cart-drawer-popup"))
        return;
      this.close();
    };

    // Add event listeners (for while drawer is open).
    this.addEventListener("click", this.clickHandler);
    this.addEventListener("keyup", this.keyupHandler);
    this.overlay.addEventListener("click", this.clickHandler);

    // Handle events after the drawer opens
    const transitionDuration = parseFloat(
      getComputedStyle(this).getPropertyValue("--longest-transition-in-ms"),
    );
    setTimeout(() => {
      if (callback) callback();
      this.dispatchEvent(
        new CustomEvent(`on:${this.dataset.name}:after-open`, {
          bubbles: true,
        }),
      );
    }, transitionDuration);
  }

  /**
   * Closes the drawer.
   * @param {Function} [callback] - Call back function to trigger after the close has completed
   */
  close(callback) {
    this.dispatchEvent(
      new CustomEvent(`on:${this.dataset.name}:before-close`, {
        bubbles: true,
      }),
    );

    this.removeAttribute("open");
    this.setAttribute("aria-hidden", "true");
    this.overlay.classList.remove("is-visible");

    removeTrapFocus(this.opener);

    // Remove event listeners added on drawer opening.
    this.removeEventListener("click", this.clickHandler);
    this.removeEventListener("keyup", this.keyupHandler);
    this.overlay.removeEventListener("click", this.clickHandler);

    // Handle events after the drawer closes
    const transitionDuration = parseFloat(
      getComputedStyle(this).getPropertyValue("--longest-transition-in-ms"),
    );
    setTimeout(() => {
      if (callback) callback();
      this.dispatchEvent(
        new CustomEvent(`on:${this.dataset.name}:after-close`, {
          bubbles: true,
        }),
      );
    }, transitionDuration);
  }
}

customElements.define("side-drawer", SideDrawer);

class CarouselSlider extends HTMLElement {
  constructor() {
    super();
    this.slides = [
      ...this.querySelector(".slider__item").parentElement.querySelectorAll(
        ":scope > .slider__item:not([hidden])",
      ),
    ];
    if (this.slides.length < 2) {
      this.setCarouselState(false);
      return;
    }

    window.initLazyScript(this, this.init.bind(this));
  }

  init() {
    this.slider = this.querySelector(".slider");
    this.grid = this.querySelector(".slider__grid");
    this.nav = this.querySelector(
      `.slider-nav__btn[aria-controls='${this.slider.id}']`,
    )?.closest(".slider-nav");
    this.rtl = document.dir === "rtl";

    if (this.nav) {
      this.prevBtn = this.nav.querySelector('button[name="prev"]');
      this.nextBtn = this.nav.querySelector('button[name="next"]');
    }

    this.initSlider();
    window.addEventListener(
      "on:debounced-resize",
      this.handleResize.bind(this),
    );

    this.setAttribute("loaded", "");
  }

  initSlider() {
    this.gridWidth = this.grid.clientWidth;

    // Distance between leading edges of adjacent slides (i.e. width of card + gap).
    this.slideSpan =
      this.getWindowOffset(this.slides[1]) -
      this.getWindowOffset(this.slides[0]);

    // Note: Slide can re-initialise after previous use
    this.currentIndex =
      Math.round(this.slider.scrollLeft / this.slideSpan) || 0;

    // Width of gap between slides.
    this.slideGap = this.slideSpan - this.slides[0].clientWidth;

    this.slidesPerPage = Math.round(
      (this.gridWidth + this.slideGap) / this.slideSpan,
    );
    this.slidesToScroll =
      theme.settings.sliderItemsPerNav === "page" ? this.slidesPerPage : 1;
    this.totalPages = this.slides.length - this.slidesPerPage + 1;

    this.setCarouselState(this.totalPages > 1);
    if (this.dataset.dynamicHeight === "true") {
      this.updateDynamicHeight();
    }
    this.addListeners();

    this.sliderStart = this.getWindowOffset(this.slider);
    if (!this.sliderStart)
      this.sliderStart = (this.slider.clientWidth - this.gridWidth) / 2;
    this.sliderEnd = this.sliderStart + this.gridWidth;

    if (this.totalPages < 2) return;

    // Remove reveal transitions from off-screen slides
    if (
      !this.dataset.keepAnimations &&
      this.grid.querySelector("[data-cc-animate]")
    ) {
      for (let i = this.slidesPerPage; i < this.slides.length; i += 1) {
        if (this.slides[i].dataset.ccAnimate) {
          this.slides[i].removeAttribute("data-cc-animate-delay");
          this.slides[i].classList.add("cc-animate-in");
        }
        this.slides[i].querySelectorAll("[data-cc-animate]").forEach((el) => {
          el.removeAttribute("data-cc-animate-delay");
          el.classList.add("cc-animate-in");
        });
      }
    }

    if (window.matchMedia("(pointer: fine)").matches) {
      this.slider.classList.add("is-grabbable");
    }

    if (!this.nav) return;

    this.setButtonStates();
  }

  /**
   * Re-initialise state. Call if slides have changed.
   */
  refresh() {
    if (this.hasAttribute("loaded")) {
      this.removeListeners();
      this.style.removeProperty("--current-slide-height");
    }
    this.slides = [
      ...this.querySelector(".slider__item").parentElement.querySelectorAll(
        ":scope > .slider__item:not([hidden])",
      ),
    ];
    if (this.slides.length < 2) {
      this.setCarouselState(false);
      return;
    }
    this.init();
  }

  addListeners() {
    this.scrollHandler = debounce(this.handleScroll.bind(this), 100);
    this.slider.addEventListener("scroll", this.scrollHandler);

    if (this.nav) {
      this.navClickHandler = this.handleNavClick.bind(this);
      this.nav.addEventListener("click", this.navClickHandler);
    }

    if (window.matchMedia("(pointer: fine)").matches) {
      this.mousedownHandler = this.handleMousedown.bind(this);
      this.mouseupHandler = this.handleMouseup.bind(this);
      this.mousemoveHandler = this.handleMousemove.bind(this);

      this.slider.addEventListener("mousedown", this.mousedownHandler);
      this.slider.addEventListener("mouseup", this.mouseupHandler);
      this.slider.addEventListener("mouseleave", this.mouseupHandler);
      this.slider.addEventListener("mousemove", this.mousemoveHandler);
      this.slider.addEventListener("dragstart", (evt) => {
        evt.preventDefault();
      });
    }
  }

  removeListeners() {
    this.slider.removeEventListener("scroll", this.scrollHandler);

    if (this.nav) {
      this.nav.removeEventListener("click", this.navClickHandler);
    }

    if (window.matchMedia("(pointer: fine)").matches) {
      this.slider.removeEventListener("mousedown", this.mousedownHandler);
      this.slider.removeEventListener("mouseup", this.mouseupHandler);
      this.slider.removeEventListener("mouseleave", this.mouseupHandler);
      this.slider.removeEventListener("mousemove", this.mousemoveHandler);
    }
  }

  /**
   * Handles 'scroll' events on the slider element.
   */
  handleScroll() {
    // Scroll may be triggered immediately after a resize
    if (this.gridWidth !== this.grid.clientWidth) this.handleResize();

    const previousIndex = this.currentIndex;
    this.currentIndex = Math.round(
      Math.abs(this.slider.scrollLeft) / this.slideSpan,
    );

    if (this.nav) {
      this.setButtonStates();
    }

    if (this.dataset.dynamicHeight === "true") {
      this.updateDynamicHeight();
    }

    if (
      this.dataset.dispatchEvents === "true" &&
      previousIndex !== this.currentIndex
    ) {
      this.dispatchEvent(
        new CustomEvent("on:carousel-slider:select", {
          bubbles: true,
          detail: {
            index: this.currentIndex,
            slide: this.slides[this.currentIndex],
          },
        }),
      );
    }
  }

  /**
   * Handles 'mousedown' events on the slider element.
   * @param {object} evt - Event object.
   */
  handleMousedown(evt) {
    this.mousedown = true;
    this.mousemoved = false;
    this.startX = evt.pageX - this.sliderStart;
    this.scrollPos = this.slider.scrollLeft;
    this.slider.classList.add("is-grabbing");
  }

  /**
   * Handles 'mouseup' events on the slider element.
   * @param {object} evt - Event object.
   */
  handleMouseup(evt) {
    this.mousedown = false;
    this.slider.classList.remove("is-grabbing");
    if (this.mousemoved) {
      evt.preventDefault();
      this.slider.classList.remove("is-dragging");
    }
  }

  /**
   * Handles 'mousemove' events on the slider element.
   * @param {object} evt - Event object.
   */
  handleMousemove(evt) {
    if (!this.mousedown) return;
    evt.preventDefault();

    const x = evt.pageX - this.sliderStart;
    this.slider.scrollTo({
      left: this.scrollPos - (x - this.startX),
      behavior: "instant",
    });
    // Allow a click with small movement
    if (Math.abs(x - this.startX) > 10) {
      this.mousemoved = true;
      this.slider.classList.add("is-dragging");
    }
  }

  /**
   * Handles 'click' events on the nav buttons container.
   * @param {object} evt - Event object.
   */
  handleNavClick(evt) {
    if (!evt.target.matches(".slider-nav__btn")) return;

    if (
      (evt.target.name === "next" && !this.rtl) ||
      (evt.target.name === "prev" && this.rtl)
    ) {
      this.scrollPos =
        this.slider.scrollLeft + this.slidesToScroll * this.slideSpan;
    } else {
      this.scrollPos =
        this.slider.scrollLeft - this.slidesToScroll * this.slideSpan;
    }

    this.slider.scrollTo({ left: this.scrollPos, behavior: "smooth" });
  }

  /**
   * Handles 'on:debounced-resize' events on the window.
   */
  handleResize() {
    if (this.nav) this.removeListeners();
    this.initSlider();
  }

  /**
   * Show a specific item inside this slider.
   * @param {Element} el - Slide element
   * @param {string} transition - Transition to pass to behavior parameter of scrollTo (optional)
   */
  scrollToElement(el, transition) {
    if (!this.getSlideVisibility(el)) {
      // TODO: Finalise RTL scroll position fix
      // this.scrollPos = this.rtl ? (el.offsetLeft + this.slideSpan) : el.offsetLeft;
      this.scrollPos = el.offsetLeft;
      this.slider.scrollTo({
        left: this.scrollPos,
        behavior: transition || "smooth",
      });
    }
  }

  /**
   * Sets a height property based on the current slide.
   */
  updateDynamicHeight() {
    this.style.setProperty(
      "--current-slide-height",
      `${this.slides[this.currentIndex].firstElementChild.clientHeight}px`,
    );
  }

  /**
   * Gets the offset of an element from the edge of the viewport (left for ltr, right for rtl).
   * @param {number} el - Element.
   * @returns {number}
   */
  getWindowOffset(el) {
    return this.rtl
      ? window.innerWidth - el.getBoundingClientRect().right
      : el.getBoundingClientRect().left;
  }

  /**
   * Gets the visible state of a slide.
   * @param {Element} el - Slide element.
   * @returns {boolean}
   */
  getSlideVisibility(el) {
    this.sliderStart = this.getWindowOffset(this.slider); // Ensure sliderStart is updated
    const slideStart = this.getWindowOffset(el);
    const slideEnd = Math.floor(slideStart + this.slides[0].clientWidth);
    return slideStart >= this.sliderStart && slideEnd <= this.sliderEnd;
  }

  /**
   * Sets the active state of the carousel.
   * @param {boolean} active - Set carousel as active.
   */
  setCarouselState(active) {
    if (active) {
      this.removeAttribute("inactive");

      // If slider width changed when activated, reinitialise it.
      if (this.gridWidth !== this.grid.clientWidth) {
        this.handleResize();
      }
    } else {
      this.setAttribute("inactive", "");
    }
  }

  /**
   * Sets the disabled state of the nav buttons.
   */
  setButtonStates() {
    this.prevBtn.disabled =
      this.getSlideVisibility(this.slides[0]) && this.slider.scrollLeft === 0;
    this.nextBtn.disabled = this.getSlideVisibility(
      this.slides[this.slides.length - 1],
    );
  }
}

customElements.define("carousel-slider", CarouselSlider);

class QuantityInput extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector(".qty-input__input");
    this.currentQty = this.input.value;
    this.changeEvent = new Event("change", { bubbles: true });

    this.addEventListener("click", this.handleClick.bind(this));
    this.input.addEventListener("focus", QuantityInput.handleFocus);
    this.input.addEventListener("keydown", this.handleKeydown.bind(this));
  }

  /**
   * Handles 'click' events on the quantity input element.
   * @param {object} evt - Event object.
   */
  handleClick(evt) {
    if (!evt.target.matches(".qty-input__btn")) return;
    evt.preventDefault();

    this.currentQty = this.input.value;

    if (evt.target.name === "plus") {
      this.input.stepUp();
    } else {
      this.input.stepDown();
    }

    if (this.input.value !== this.currentQty) {
      this.input.dispatchEvent(this.changeEvent);
      this.currentQty = this.input.value;
    }
  }

  /**
   * Handles 'focus' events on the quantity input element.
   * @param {object} evt - Event object.
   */
  static handleFocus(evt) {
    if (window.matchMedia("(pointer: fine)").matches) {
      evt.target.select();
    }
  }

  /**
   * Handles 'keydown' events on the input field.
   * @param {object} evt - Event object.
   */
  handleKeydown(evt) {
    if (evt.key !== "Enter") return;
    evt.preventDefault();

    if (this.input.value !== this.currentQty) {
      this.input.blur();
      this.input.focus();
      this.currentQty = this.input.value;
    }
  }
}

customElements.define("quantity-input", QuantityInput);

if (!customElements.get("main-header")) {
  class MainHeader extends HTMLElement {
    connectedCallback() {
      this.announcement = document.querySelector(".announcement");
      this.overlay = document.querySelector(".js-overlay");

      // Opening search bar
      this.querySelectorAll(".js-toggle-search").forEach((el) => {
        el.addEventListener("click", this.handleSearchToggleClick.bind(this));
      });

      // Tab on cart icon
      this.querySelector("#cart-icon").addEventListener(
        "keydown",
        this.handleCartIconKeydown.bind(this),
      );

      // Closing mobile nav
      this.querySelectorAll(".js-close-nav").forEach((el) => {
        el.addEventListener("click", this.handleCloseNavClick.bind(this));
      });

      // Save announcement bar height, used when setting scroll state
      this.announcementHeight = 0;
      if (this.announcement) {
        this.setAnnouncementHeight();
        window.addEventListener("on:debounced-resize", () => {
          if (this.announcement) this.setAnnouncementHeight();
        });
      }

      // Set scroll state
      this.scrolledDown = false;
      if (this.classList.contains("header--sticky")) {
        this.setScrolledState();
        document.addEventListener("scroll", this.setScrolledState.bind(this));
      }
    }

    /**
     * Handles 'click' events on search icon and close button.
     * @param {object} evt - Event object.
     */
    handleSearchToggleClick(evt) {
      evt.preventDefault();

      // Close open nav
      document.querySelector(".main-nav .is-open > summary")?.click();

      // Toggle search area
      const search = this.querySelector(".header__search");
      if (search.hidden) {
        search.classList.add("header__search-pre-reveal");
        this.tempOverlayClickHandler = this.handleSearchToggleClick.bind(this);
        this.overlay.addEventListener("click", this.tempOverlayClickHandler);
      }
      search.toggleAttribute("hidden");
      if (!search.hidden) {
        search.querySelector(".search__input").focus();
        setTimeout(
          () => search.classList.remove("header__search-pre-reveal"),
          10,
        );
      } else {
        this.overlay.removeEventListener("click", this.tempOverlayClickHandler);
        this.tempOverlayClickHandler = null;
      }
      this.overlay.classList.toggle("overlay--nav", !search.hidden);
      this.overlay.classList.toggle("is-visible", !search.hidden);
    }

    /**
     * Handles 'click' events on mobile nav close button.
     * @param {object} evt - Event object.
     */
    handleCloseNavClick(evt) {
      evt.preventDefault();
      this.querySelector("main-menu").handleMainMenuToggle(evt);
    }

    /**
     * Handles 'keydown' events on cart icon.
     * @param {object} evt - Event object.
     */
    handleCartIconKeydown(evt) {
      // If tabbing forward, close any open nav dropdowns
      if (evt.key === "Tab" && !evt.shiftKey) {
        const mainMenu = this.querySelector("main-menu");
        this.querySelectorAll(
          ".main-nav__item--primary + details[open]",
        ).forEach((el) => {
          mainMenu.close(el);
        });
      }
    }

    /**
     * Saves the height of the announcement bar.
     */
    setAnnouncementHeight() {
      this.announcementHeight = this.announcement
        ? this.announcement.clientHeight
        : 0;
    }

    /**
     * Toggles a 'scrolled-down' class on the body, according to the scrolled state of the page.
     */
    setScrolledState() {
      const scrollY = window.scrollY
        ? window.scrollY
        : -document.body.getBoundingClientRect().top;
      if (!this.scrolledDown) {
        if (scrollY > this.announcementHeight) {
          document.body.classList.add("scrolled-down");
          this.scrolledDown = true;
        }
      } else {
        clearTimeout(this.timeout);

        this.timeout = setTimeout(
          () => {
            document.body.classList.toggle(
              "scrolled-down",
              scrollY > this.announcementHeight,
            );
            this.scrolledDown =
              document.body.classList.contains("scrolled-down");
          },
          window.scrollY <= 0 ? 0 : 200,
        );
      }
    }
  }

  customElements.define("main-header", MainHeader);
}

class MainMenu extends HTMLElement {
  constructor() {
    super();
    this.mainDisclosure = document.querySelector(".main-menu__disclosure");
    this.mainToggle = document.querySelector(".main-menu__toggle");
    this.nav = document.querySelector(".main-nav");
    this.backBtns = document.querySelectorAll(".js-back");
    this.overlay = document.querySelector(".js-overlay");

    this.childNavOpen = false;
    this.overlayInitiated = false;
    this.overlayOpen = false;

    this.addListeners();
    this.init();
  }

  addListeners() {
    this.mainDisclosure.addEventListener(
      "transitionend",
      this.handleTransition.bind(this),
    );
    this.mainDisclosure.addEventListener(
      "animationend",
      this.handleTransition.bind(this),
    );
    this.mainToggle.addEventListener(
      "click",
      this.handleMainMenuToggle.bind(this),
    );
    this.nav.addEventListener("click", this.handleNavClick.bind(this));
    window.addEventListener("on:breakpoint-change", this.init.bind(this));

    // Hover/tap to open a menu
    this.querySelectorAll(
      ".main-nav > li:has(> .main-nav__item--primary):has(> details)",
    ).forEach((el) => {
      el.addEventListener(
        "mouseenter",
        this.handlePrimaryDropdownLinkMouseEnter.bind(this),
      );
      el.addEventListener(
        "mouseleave",
        this.handlePrimaryDropdownLinkMouseLeave.bind(this),
      );
      el.addEventListener(
        "touchstart",
        this.handlePrimaryDropdownLinkTouchStart.bind(this),
      );
    });
  }

  /**
   * Handles 'mouseenter' event on the main disclosure element.
   * @param {?object} evt - Event object.
   */
  handlePrimaryDropdownLinkMouseEnter(evt) {
    if (!theme.mediaMatches.lg || this.touchStartOccurredRecently) return;
    this.mouseControlEnabled = true;
    const disclosure = evt.currentTarget.querySelector("details");
    clearTimeout(disclosure.dataset.dropdownOpenTimeout);
    clearTimeout(disclosure.dataset.dropdownCloseTimeout);
    disclosure.dataset.dropdownOpenTimeout = setTimeout(() => {
      this.open(disclosure);
      this.toggleOverlay(true);
    }, 150);
  }

  /**
   * Handles 'mouseleave' event on the main disclosure element.
   * @param {?object} evt - Event object.
   */
  handlePrimaryDropdownLinkMouseLeave(evt) {
    if (!theme.mediaMatches.lg || this.touchStartOccurredRecently) return;
    const disclosure = evt.currentTarget.querySelector("details");
    clearTimeout(disclosure.dataset.dropdownOpenTimeout);
    clearTimeout(disclosure.dataset.dropdownCloseTimeout);
    disclosure.dataset.dropdownCloseTimeout = setTimeout(() => {
      this.close(disclosure, true);
    }, 400);
  }

  /**
   * Handles 'touchstart' event on a disclosure element. Used to block iOS' simulated mouse events.
   */
  handlePrimaryDropdownLinkTouchStart() {
    if (!theme.mediaMatches.lg) return;
    this.touchStartOccurredRecently = true;
    setTimeout(() => {
      this.touchStartOccurredRecently = false;
    }, 150);
  }

  /**
   * Sets 'open' state of the main disclosure element.
   * @param {?object} evt - Event object.
   */
  init(evt) {
    if (!evt) {
      // First init
      this.mainDisclosure.open = theme.mediaMatches.lg;
    } else if (!theme.mediaMatches.lg && !this.childNavOpen) {
      // On resize, mobile
      this.close(this.mainDisclosure);

      if (this.overlayOpen) this.toggleOverlay(false);
    } else {
      // On resize, desktop
      this.open(this.mainDisclosure);

      if (!this.childNavOpen) {
        if (this.overlayOpen) this.toggleOverlay(false);
      }

      this.querySelectorAll(".main-nav__child.mega-nav details").forEach(
        (el) => {
          el.open = true;
        },
      );
    }

    // Close disclosures
    if (!theme.mediaMatches.lg) {
      this.querySelectorAll(".main-nav__child details").forEach((el) => {
        el.open = false;
        el.classList.remove("is-open");
      });
    } else {
      // Open 3rd tier in basic dropdown
      this.querySelectorAll(".main-nav__child:not(.mega-nav) details").forEach(
        (el) => {
          el.open = true;
          el.classList.remove("is-open");
        },
      );
    }
  }

  /**
   * Handles 'toggle' event on the main disclosure element.
   * @param {object} evt - Event object.
   */
  handleMainMenuToggle(evt) {
    evt.preventDefault();
    this.opener = this.mainToggle;

    if (!this.mainDisclosure.open) {
      this.open(this.mainDisclosure);
      this.toggleOverlay(true);
    } else {
      this.close(this.mainDisclosure, true);
      this.toggleOverlay(false);
    }
  }

  /**
   * Handles 'click' event on the nav.
   * @param {object} evt - Event object.
   */
  handleNavClick(evt) {
    const target = evt.target.matches("summary")
      ? evt.target
      : evt.target.closest(".main-nav__item");
    if (!target) return;

    if (target.matches("summary")) {
      // Summary
      evt.preventDefault();

      const details = target.closest("details");
      if (!details.classList.contains("is-open")) {
        const isTier1 = details.previousElementSibling.classList.contains(
          "main-nav__item--primary",
        );
        if (isTier1) {
          this.querySelectorAll(
            ".main-nav__item--primary + details.is-open",
          ).forEach((el) => {
            this.close(el, true);
          });
        }
        this.childNavOpen = true;
        this.open(details);
      } else {
        this.close(details, true);
        this.childNavOpen = false;
        this.toggleOverlay(false);
      }
    } else if (target.matches(".js-back")) {
      // Back
      evt.preventDefault();

      this.close(target.closest("details"), true);
      this.childNavOpen = false;
      this.toggleOverlay(false);
    } else {
      // Link
      const disclosure = target.parentElement.querySelector("details");

      if (
        disclosure &&
        !theme.mediaMatches.lg &&
        this.dataset.parentOpensChildMobile === "true"
      ) {
        evt.preventDefault();

        if (!disclosure.classList.contains("is-open")) {
          this.childNavOpen = true;
          this.open(disclosure);
        } else {
          this.close(disclosure, true);
          this.childNavOpen = false;
          this.toggleOverlay(false);
        }
      }
    }
  }

  /**
   * Handles 'transitionend' and 'animationend' event on the nav.
   * @param {object} evt - Event object.
   */
  handleTransition(evt) {
    if (
      !evt.target.matches(
        ":is(.main-menu__content, .main-nav__child, .main-nav__grandchild)",
      )
    )
      return;

    const disclosure = evt.target.closest("details");

    if (disclosure.classList.contains("is-opening")) {
      disclosure.classList.remove("is-opening");
    }

    if (disclosure.classList.contains("is-closing")) {
      disclosure.classList.remove("is-closing");
      disclosure.open = false;

      this.opener = null;

      // Any child nav open
      if (
        theme.mediaMatches.lg &&
        !document.querySelector("[open] > .main-nav__item--primary")
      ) {
        this.mouseControlEnabled = false;
        this.toggleOverlay(false);
      }
    }
  }

  /**
   * Handles a 'click' event on the overlay and a 'keyup' event on the nav.
   * @param {object} evt - Event object.
   */
  handleClose(evt) {
    if (evt.type === "keyup" && evt.key !== "Escape") return;
    const disclosure = this.nav.querySelector("details.is-open");

    this.close(disclosure, !theme.mediaMatches.lg);
    this.toggleOverlay(false);
    this.childNavOpen = false;
  }

  /**
   * Toggles visibility of the background overlay.
   * @param {boolean} show - Show the overlay.
   */
  toggleOverlay(show) {
    this.overlayOpen = show;
    this.overlay.classList.toggle("overlay--nav", show);
    this.overlay.classList.toggle("is-visible", show);

    if (show) {
      // Add event handler (so the bound event listener can be removed).
      this.closeHandler = this.closeHandler || this.handleClose.bind(this);

      // Add event listeners (for while the nav is open).
      this.overlay.addEventListener("click", this.closeHandler);
      this.nav.addEventListener("keyup", this.closeHandler);
    } else {
      // Remove event listener added on nav opening.
      this.overlay.removeEventListener("click", this.closeHandler);
      this.nav.removeEventListener("keyup", this.closeHandler);
    }
  }

  /**
   * Updates open/opening classes for disclosure element.
   * @param {Element} el - Disclosure element.
   */
  open(el) {
    if (el.classList.contains("is-open")) return;

    el.open = true;
    const isMainMenu = el.classList.contains("main-menu__disclosure");

    // Slight delay required before starting transitions.
    setTimeout(() => {
      el.classList.remove("is-closing");
      if (theme.mediaMatches.lg && !isMainMenu) {
        el.classList.add("is-opening");
        const childHeight = el.querySelector(
          ".mega-nav__grid, .child-nav, .main-nav__grandchild",
        ).clientHeight;
        el.style.setProperty("--transition-height", `${childHeight}px`);
        el.classList.add("is-open");
      } else {
        el.classList.add("is-open");
      }
    });

    // Mobile nav open - trap focus
    if (isMainMenu) {
      trapFocus(el);

      // On return from localization, trap focus
      document.addEventListener(
        "on:localization-drawer-header:after-close",
        () => {
          trapFocus(el);
          this.querySelector(".js-toggle-localization").focus();
        },
      );
    }

    if (isMainMenu) {
      this.style.setProperty(
        "--mobile-menu-header-height",
        `${this.querySelector(".main-menu__mobile-nav-header").clientHeight}px`,
      );
    } else {
      const grandChild = el.querySelector(".main-nav__grandchild");

      if (grandChild) {
        const gch =
          grandChild.lastElementChild.offsetTop +
          grandChild.lastElementChild.clientHeight;
        el.style.setProperty("--mobile-nav-grandchild-height", `${gch}px`);
      }

      const isTier1 = el.previousElementSibling.classList.contains(
        "main-nav__item--primary",
      );
      if (isTier1) {
        el.style.setProperty(
          "--nav-link-width",
          `${el.parentElement.clientWidth}px`,
        );
      }
    }
  }

  /**
   * Updates close/closing classes of a disclosure element.
   * @param {Element} el - Disclosure element.
   * @param {boolean} [transition=false] - Close action has a CSS transition.
   */
  close(el, transition = false) {
    el.classList.remove("is-open");

    if (transition) {
      el.classList.add("is-closing");
    } else {
      el.classList.remove("is-closing");
      el.open = false;

      this.opener = null;
    }

    const isMainMenu = el.classList.contains("main-menu__disclosure");
    if (isMainMenu) {
      removeTrapFocus();
      el.focus();
    }
  }
}

customElements.define("main-menu", MainMenu);

class ProductCard extends HTMLElement {
  constructor() {
    super();
    window.initLazyScript(this, this.init.bind(this));
  }

  init() {
    this.images = this.querySelectorAll(".card__main-image");
    this.links = this.querySelectorAll(".js-prod-link");
    this.quickAddBtns = this.querySelectorAll(".js-quick-add");
    this.carouselSlider = this.querySelector("product-card-image-slider");
    this.info = this.querySelector(".card__info");
    this.swatchesMax = 4;

    const isStandardType = this.classList.contains("card--standard");

    this.quickAddBtns.forEach((el) => {
      this.productUrl = el.dataset.productUrl;
    });

    if (!this.quickAddBtns && this.links.length) {
      this.productUrl = this.links[0].href;
    }

    if (isStandardType) {
      this.addEventListener("mouseenter", this.handleMouseEnter.bind(this));
      this.addEventListener("mouseleave", this.handleMouseLeave.bind(this));
      this.addEventListener("focusin", this.handleFocusIn.bind(this));
      this.addEventListener("focusout", this.handleFocusOut.bind(this));
    }

    this.initSwatches();

    if (this.matches(":hover, :focus-within") || this.dataset.focusSwatch) {
      this.style.setProperty("--transition-duration", "0s");
      this.loadHoverImage();
      this.handleMouseEnter();
      requestAnimationFrame(() => {
        this.style.removeProperty("--transition-duration");
      });
    } else {
      this.loadHoverImage(1000);
    }

    if (this.dataset.focusSwatch) {
      this.focusCardSwatch(this.dataset.focusSwatch);
    }
  }

  /**
   * Initialise swatch-dependent content
   */
  initSwatches() {
    this.swatches = this.querySelector(".card__swatches");
    const hasSwatches = this.swatches
      ? getComputedStyle(this.swatches).getPropertyValue("display") !== "none"
      : false;
    if (hasSwatches) {
      this.swatchesMoreBtn = this.querySelector(".card__swatches__more-btn");
      this.handleResize();
    }
    if (hasSwatches && !this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(
        debounce(this.handleResize.bind(this)),
      );
      this.resizeObserver.observe(this);
    }
    if (!this.handleSwatchChangeAttached) {
      this.addEventListener("change", this.handleSwatchChange.bind(this));
      this.handleSwatchChangeAttached = true;
    }
  }

  /**
   * Handles size changes on the product card.
   */
  handleResize() {
    if (this.cachedWidth === this.clientWidth) return;

    this.cachedWidth = this.clientWidth;

    if (this.swatchesMoreBtn) {
      const targets = this.swatches.querySelectorAll("label");
      const gap = Number(
        getComputedStyle(this.swatches.firstChild)
          .getPropertyValue("column-gap")
          .replace("px", ""),
      );
      const availableWidth = this.querySelector(".card__content").clientWidth;

      this.swatchesMoreBtn.hidden = false;
      targets.forEach((target, index) => {
        target.hidden = false;

        if (index > this.swatchesMax) {
          target.hidden = true;
        } else {
          const targetWidth = target.offsetWidth;
          const nextWidthAndMoreBtn =
            targetWidth * (index + 2) + gap * (index + 1);

          target.hidden = availableWidth < nextWidthAndMoreBtn;
        }
      });

      const hiddenTargets = Array.from(targets).filter((target) =>
        target.hasAttribute("hidden"),
      );
      const totalSwatches = Number(this.swatches.dataset.total);
      if (hiddenTargets.length || totalSwatches > targets.length) {
        this.swatchesMoreBtn.hidden = false;
      } else {
        this.swatchesMoreBtn.hidden = true;
      }
    }
  }

  /**
   * Handles 'mouseenter' events on the product card.
   */
  async handleMouseEnter() {
    try {
      // getComputedStyle is subpixel accurate and calculated before transforms
      this.style.height = getComputedStyle(this).height;
      this.info.style.minHeight = getComputedStyle(this.info).height;

      this.classList.remove("is-open");
      this.classList.remove("is-closing");
      this.classList.add("is-opening");

      await this.waitForTransitions();

      this.classList.remove("is-opening");
      this.classList.add("is-open");
    } catch (ex) {
      //
    }
  }

  /**
   * Handles 'mouseleave' events on the product card.
   */
  async handleMouseLeave() {
    try {
      this.classList.remove("is-opening");
      this.classList.add("is-closing");

      await this.waitForTransitions();

      this.classList.remove("is-open");
      this.classList.remove("is-closing");
      this.style.removeProperty("height");
      this.info.style.removeProperty("min-height");
    } catch (ex) {
      //
    }
  }

  /**
   * Handles 'focusin' events on the product card.
   */
  async handleFocusIn() {
    if (!this.matches(":hover")) {
      this.handleMouseEnter();
    }
  }

  /**
   * Handles 'focusout' events on the product card.
   */
  async handleFocusOut() {
    if (!this.matches(":hover")) {
      this.handleMouseLeave();
    }
  }

  focusCardSwatch(id) {
    this.querySelector(
      `.card__swatches .opt-btn[value="${CSS.escape(id)}"]`,
    ).focus();
    this.removeAttribute("data-focus-swatch");
  }

  /**
   * Handles 'change' events in the product card swatches.
   * @param {object} evt - Event object.
   */
  handleSwatchChange(evt) {
    if (!evt.target.matches(".opt-btn")) return;

    // Sibling card replacement
    if (evt.target.dataset.siblingUrl) {
      const cardGrid = this.closest(
        ".main-products-grid, .grid, .swiper-wrapper, .mega-nav__grid",
      );
      const siblingCard = (cardGrid || document).querySelector(
        `product-card[data-product-id="${CSS.escape(evt.target.value)}"]`,
      );
      if (siblingCard) {
        // Already exists in grid, copy over
        const hash = Date.now().toString(10);
        const wrapper = document.createElement("div");
        wrapper.innerHTML = siblingCard.outerHTML;
        wrapper.firstChild.removeAttribute("data-cc-animate");
        wrapper.firstChild.removeAttribute("data-cc-animate-delay");
        wrapper.firstChild.classList.remove(
          "cc-animate-init",
          "cc-animate-in",
          "fade-in-up",
        );
        wrapper.firstChild
          .querySelectorAll(".card__swatches input")
          .forEach((input) => {
            const newName = input.name.replace(/-dedup-[0-9]+/, "");
            input.name = `${newName}-dedup-${hash}`;
            input.checked = input.value === evt.target.value;
          });
        wrapper.firstChild.dataset.focusSwatch = evt.target.value;
        this.replaceWith(wrapper.firstChild);
      } else {
        // Not in grid, fetch
        this.setAttribute("loading-swatches", "");
        const sep = evt.target.dataset.siblingUrl.indexOf("?") > -1 ? "&" : "?";
        fetch(`${evt.target.dataset.siblingUrl}${sep}section_id=product-card`)
          .then((response) => {
            if (!response.ok) throw new Error(response.status);
            return response.text();
          })
          .then((html) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            // Copy transferrable content before replacing card
            const newCard = doc.querySelector("product-card");
            newCard.removeAttribute("data-cc-animate");
            newCard.removeAttribute("data-cc-animate-delay");
            newCard.classList.remove(
              "cc-animate-init",
              "cc-animate-in",
              "fade-in-up",
            );
            const firstMedia = newCard.querySelector(".media");
            firstMedia.setAttribute(
              "style",
              this.querySelector(".media").getAttribute("style"),
            );
            const hasImageBlend = Boolean(
              this.querySelector(".media.image-blend"),
            );
            newCard.querySelectorAll(".media").forEach((media) => {
              media.classList.toggle("image-blend", hasImageBlend);
            });
            newCard.dataset.focusSwatch = evt.target.value;
            this.replaceWith(newCard);
          })
          .catch((error) => {
            // eslint-disable-next-line
            console.warn(error);
            this.removeAttribute("loading-swatches");
          });
      }
      return;
    }

    // Swap current card image to selected variant image.
    if (evt.target.dataset.mediaId && !this.carouselSlider) {
      const variantMedia = this.querySelector(
        `[data-media-id="${evt.target.dataset.mediaId}"]`,
      );

      if (variantMedia) {
        this.images.forEach((image) => {
          image.hidden = true;
        });
        variantMedia.hidden = false;
      }
    }

    const separator = this.productUrl.split("?").length > 1 ? "&" : "?";
    const url = `${this.productUrl + separator}variant=${evt.target.dataset.variantId}`;

    // Update link hrefs to url of selected variant.
    this.links.forEach((link) => {
      link.href = url;
    });

    // Update the Quick Add button data.
    this.quickAddBtns.forEach((el) => {
      el.dataset.selectedColor = evt.target.value;
    });
  }

  /**
   * Load hover image after an optional delay
   * @param {number} delay - Optional delay.
   */
  loadHoverImage(delay = 0) {
    const hoverImage = this.querySelector(".card__hover-image");
    if (!hoverImage || !hoverImage.classList.contains("is-inactive")) return;

    setTimeout(() => {
      hoverImage.classList.remove("is-inactive");
    }, delay);
  }

  waitForTransitions(subtree = true) {
    return Promise.all(
      this.getAnimations({ subtree }).map((animation) => animation.finished),
    );
  }
}

customElements.define("product-card", ProductCard);

window.initLazyScript = initLazyScript;

document.addEventListener("keydown", (evt) => {
  if (evt.code === "Tab") {
    document.body.classList.add("tab-used");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  requestAnimationFrame(() => {
    document.body.classList.add("dom-loaded");
  });

  if (theme.settings.externalLinksNewTab) {
    document.addEventListener("click", (evt) => {
      const link =
        evt.target.tagName === "A" ? evt.target : evt.target.closest("a");
      if (
        link &&
        link.tagName === "A" &&
        link.href &&
        window.location.hostname !== new URL(link.href).hostname
      ) {
        link.target = "_blank";
      }
    });
  }

  // Ensure anchor scrolling is smooth (this shouldn't be added in the CSS)
  document.addEventListener("click", (evt) => {
    if (
      evt.target.tagName === "A" &&
      evt.target.href.includes("#") &&
      evt.target.getAttribute("href").length > 1 &&
      window.location.hostname === new URL(evt.target.href).hostname
    ) {
      if (document.querySelector(".header--sticky")) {
        const target = document.getElementById(evt.target.href.split("#")[1]);
        target.style.scrollMarginTop =
          "calc(var(--scroll-target-offset, 20px) + var(--header-height, 0) - var(--announcement-height, 0))";
      }

      document.getElementsByTagName("html")[0].style.scrollBehavior = "smooth";
      setTimeout(() => {
        document.getElementsByTagName("html")[0].style.scrollBehavior = "";
      }, 1000);
    }
  });
});

document.addEventListener("on:variant:before-replace-element", (evt) => {
  evt.detail.replaceWith.removeAttribute("data-cc-animate");
});
