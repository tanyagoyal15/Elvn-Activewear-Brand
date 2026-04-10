const ccThemeRole = Shopify.theme.role ?? 'unknown';
const ccLSCheckKey = `cc-settings-loaded-${theme.info?.name ?? ''}`;
if (!localStorage.getItem(ccLSCheckKey) || localStorage.getItem(ccLSCheckKey) !== ccThemeRole) {
  const decode = (t) => new DOMParser().parseFromString(t, 'text/html').documentElement.textContent.trim();

  const getStoreName = () => {
    const ogContent = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
    if (ogContent) return decode(ogContent);

    const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
    for (const script of scripts) {
      try {
        const data = [].concat(JSON.parse(script.textContent));
        const name = data.find((obj) => obj?.['@type']?.toLowerCase() === 'organization')?.name;
        if (name) return decode(String(name));
      } catch (e) { /* Skip */ }
    }

    return document.title?.split(/\s[–—\-|]\s/).pop()?.trim() || '';
  };

  fetch('https://check.cleancanvas.co.uk/', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
    mode: 'cors',
    body: new URLSearchParams({
      shop: Shopify.shop,
      theme: theme.info?.name ?? '',
      version: theme.info?.version ?? '',
      role: ccThemeRole,
      storeName: getStoreName(),
      country: Shopify.country,
      contact: document.querySelector('script[src*=theme-editor][data-contact]')?.dataset.contact
    })
  })
    .then((response) => {
      if (response.ok) {
        localStorage.setItem(ccLSCheckKey, ccThemeRole);
      }
    });
}

document.addEventListener('shopify:section:load', (evt) => {
  // Load and evaluate section specific scripts immediately.
  evt.target.querySelectorAll('script[src]').forEach((script) => {
    const s = document.createElement('script');
    s.src = script.src;
    document.body.appendChild(s);
  });

  // Set header and viewport height CSS variable values.
  if (evt.target.classList.contains('cc-header')) {
    setTimeout(() => {
      window.setHeaderHeight();
    }, 200);
  }

  // If loaded section is a pop-up, open it.
  if (evt.target.matches('.cc-pop-up')) {
    customElements.whenDefined('pop-up').then(() => {
      evt.target.querySelector('pop-up').open();
    });
  }

  // Update all parallax containers
  document.querySelectorAll('parallax-container').forEach((el) => el.update());

  // Clear fetch cache
  theme.fetchCache.clear();
});

document.addEventListener('shopify:section:select', (evt) => {
  // Show hidden announcement bar
  if (evt.target.matches('.cc-announcement')) {
    evt.target.querySelector('announcement-bar').hidden = false;
  }

  if (evt.target.matches('.cc-social-video-carousel')) {
    try {
      window.instgrm.Embeds.process();
    } catch (error) {
      console.log(error); // eslint-disable-line
    }
  }

  // If selected section is a modal size guide, open it
  if (evt.target.matches('.section-size-guide') && evt.target.querySelector('modal-dialog')) {
    Promise.all([
      customElements.whenDefined('size-guide'),
      customElements.whenDefined('modal-dialog')
    ]).then(() => {
      const modal = evt.target.querySelector('modal-dialog');
      modal.classList.add('modal--no-transition');
      modal.open();
    });
  }
});

document.addEventListener('shopify:section:deselect', (evt) => {
  // If selected section is a modal size guide, close it
  if (evt.target.matches('.section-size-guide') && evt.target.querySelector('modal-dialog')) {
    Promise.all([
      customElements.whenDefined('size-guide'),
      customElements.whenDefined('modal-dialog')
    ]).then(() => {
      const modal = evt.target.querySelector('modal-dialog');
      modal.classList.remove('modal--no-transition');
      modal.close();
    });
  }
});

document.addEventListener('shopify:block:select', (evt) => {
  // If selected block is a slideshow slide, show it and pause autoplay (if enabled).
  if (evt.target.matches('.slideshow__slide')) {
    const slideshow = evt.target.closest('slide-show');

    setTimeout(() => {
      slideshow.setActiveSlide(Number(evt.target.dataset.index));
      slideshow.pauseAutoplay();
    }, 200);
  }

  // If selected block is a slider item, scroll to it.
  if (evt.target.matches('.slider__item')) {
    const carousel = evt.target.closest('carousel-slider');
    setTimeout(() => {
      if (!carousel.slider) return;
      carousel.slider.scrollTo({
        left: carousel.slides[Array.from(carousel.slides).indexOf(evt.target)].offsetLeft,
        behavior: 'smooth'
      });
    }, 200);
  }

  // If the selected block is a quiz screen, show it.
  if (evt.target.matches('.quiz__screen')) {
    const quiz = evt.target.closest('quiz-component');

    setTimeout(() => {
      const blockElement = document.getElementById(`${quiz.id}-${evt.detail.blockId}`);
      const blockIndex = quiz.screens.indexOf(blockElement);

      /* eslint-disable */
      quiz.currentScreen = blockIndex;
      /* eslint-enable */
    }, 200);
  }

  // If the selected block is a Hero Collection, show it.
  if (evt.target.parentElement.matches('.hero-collections')) {
    evt.target.classList.add('is-editing');
  }

  // If the selected block is a mega menu, reveal it.
  if (evt.target.parentElement.matches('.mega-nav')) {
    evt.target.closest('main-menu').handlePrimaryDropdownLinkMouseEnter({
      currentTarget: evt.target.closest('details')
    });
  }

  // If the select block is a shoppable hotspot, show it.
  if (evt.target.matches('.hotspot')) {
    evt.target.querySelector('button[aria-expanded="false"]').click();
  }

  // If in tab, select tab
  if (evt.target.closest('tabbed-content > [role="tabpanel"]')) {
    const panel = evt.target.closest('tabbed-content > [role="tabpanel"]');
    const button = panel.parentElement.querySelector(`.tablist__tab[aria-controls=${CSS.escape(panel.id)}]`);
    button.click();
  }
});

document.addEventListener('shopify:block:deselect', (evt) => {
  // If deselected block is a slideshow slide, resume autoplay (if enabled).
  if (evt.target.matches('.slideshow__slide')) {
    const slideshow = evt.target.closest('slide-show');

    setTimeout(() => {
      slideshow.resumeAutoplay();
    }, 200);
  }

  // If the deselected block is a quiz screen, change to the first quiz screen
  if (evt.target.matches('.quiz__screen')) {
    const quiz = evt.target.closest('quiz-component');

    setTimeout(() => {
      /* eslint-disable */
      quiz.currentScreen = 0;
      /* eslint-enable */
    }, 200);
  }

  // If the selected block is a Hero Collection, hide it.
  if (evt.target.parentElement.matches('.hero-collections')) {
    evt.target.classList.remove('is-editing');
  }

  // If the selected block is a mega menu, hide it.
  if (evt.target.parentElement.matches('.mega-nav')) {
    evt.target.closest('main-menu').handlePrimaryDropdownLinkMouseLeave({
      currentTarget: evt.target.closest('details')
    });
  }
});

// Debug out custom events
const customEvents = [
  'on:cart:add',
  'on:variant:change',
  'on:line-item:change',
  'on:cart:error',
  'on:cart:discount-added',
  'on:cart:discount-error',
  'on:cart-drawer:before-open',
  'on:cart-drawer:after-open',
  'on:cart-drawer:after-close',
  'on:quickbuy:before-open',
  'on:quickbuy:after-open',
  'on:quickbuy:after-close',
  'dispatch:cart-drawer:open',
  'dispatch:cart-drawer:refresh',
  'dispatch:cart-drawer:close'
];
customEvents.forEach((event) => {
  document.addEventListener(event, (evt) => {
    if (event.includes('dispatch:cart-drawer') && theme.settings.cartType !== 'drawer') {
      // eslint-disable-next-line
      console.warn(
        'Beautify Theme: The Cart Drawer is not enabled. To enable it, change Theme Settings > Cart > Cart type.'
      );
    } else {
      // eslint-disable-next-line
      console.info(
        '%cTheme event triggered',
        'background: #000; color: #bada55',
        event,
        evt.detail
      );
    }
  });
});
