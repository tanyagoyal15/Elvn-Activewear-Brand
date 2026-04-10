/**
 * Converts a string into a handle.
 * @param {string} str - The string to be converted.
 * @returns {string}
 */
function handleize(str) {
  if (!str) return null;

  // duplicate the string
  let result = str.slice();

  // trim the string
  result = result.trim();

  // convert to lowercase
  result = result.toLowerCase();

  // remove ' " ( ) [ ]
  result = result.replace(/['"()[\]]/g, '');

  // replace non-word chars with -, keeping unicode letters and numbers
  result = result.replace(/[^\p{L}\p{N}]+/gu, '-');

  // remove trailing hyphens
  result = result.replace(/-+$/, '');

  // remove leading hyphens
  result = result.replace(/^-+/, '');

  return result;
}

if (!customElements.get('quiz-component')) {
  class QuizComponent extends HTMLElement {
    constructor() {
      super();

      this.init();
    }

    init() {
      this.setAttribute('loading', '');

      // State
      this.currentScreenIndex = 0;

      // UI
      this.form = this.querySelector('.quiz__form');
      this.screens = Array.from(this.querySelectorAll('.quiz__screen'));
      this.results = this.querySelector('.js-results');
      this.nextBtns = Array.from(this.querySelectorAll('[name="next"]'));
      this.previousBtn = this.querySelector('[name="previous"]');
      this.submitBtn = this.querySelector('[type="submit"]');
      this.retryBtn = this.querySelector('[name="retry"]');

      // Events
      this.form.addEventListener('submit', this.handleSubmit.bind(this));
      this.form.addEventListener('change', this.handleChange.bind(this));
      this.nextBtns.forEach((nextBtn) => {
        nextBtn.addEventListener('click', this.handleNext.bind(this));
      });
      this.previousBtn.addEventListener('click', this.handlePrevious.bind(this));
      this.retryBtn.addEventListener('click', this.handleRetry.bind(this));

      // Update UI
      this.initWidget();
      this.render(false);
      this.removeAttribute('loading');
      this.setAttribute('loaded', '');
    }

    get action() {
      return this.form.action.split('?')[0];
    }

    get currentScreen() {
      return this.currentScreenIndex;
    }

    set currentScreen(value = 0) {
      const min = 0;
      const max = (this.screens.length - 1);
      const to = Math.max(min, Math.min(value, max));

      if (this.currentScreenIndex === to) return;

      this.currentScreenIndex = to;

      this.render();
    }

    get prevEnabled() {
      const isFirstScreen = this.currentScreen <= 0;
      return !isFirstScreen;
    }

    get nextEnabled() {
      const isLastScreen = this.currentScreen >= (this.screens.length - 1);
      const currentScreenElement = this.screens[this.currentScreen];
      const currentScreenHasInput = Boolean(
        currentScreenElement.querySelector('[type="checkbox"], [type="radio"]')
      );
      const currentScreenHasSelection = Boolean(
        currentScreenElement.querySelector('[type="checkbox"]:checked, [type="radio"]:checked')
      );
      return !isLastScreen
          && (currentScreenHasInput ? currentScreenHasSelection : true);
    }

    get submitEnabled() {
      let allQuestionScreensHaveAnswers = true;
      this.screens
        .filter((screen) => screen.querySelector('[type="checkbox"], [type="radio"]'))
        .forEach((screen) => {
          if (!screen.querySelector('[type="checkbox"]:checked, [type="radio"]:checked')) {
            allQuestionScreensHaveAnswers = false;
          }
        });
      return allQuestionScreensHaveAnswers;
    }

    async handleSubmit(event) {
      event.preventDefault();

      try {
        // Update UI
        this.previousBtn.disabled = true;
        this.submitBtn.disabled = true;
        if (!this.submitBtn.querySelector('.btn__loader')) {
          const btnLoader = document.createElement('div');
          btnLoader.classList.add('btn__loader');
          btnLoader.innerHTML = '<span></span><span></span><span></span>';
          this.submitBtn.appendChild(btnLoader);
        }
        this.submitBtn.setAttribute('loading', true);
        this.results.innerHTML = '';

        // Get selected values
        const selectedOptions = Array.from(this.querySelectorAll('[type="checkbox"]:checked, [type="radio"]:checked'));
        const selectedValues = Array.from(new Set(
          selectedOptions.flatMap((option) => option.value.split(',').map((value) => handleize(value)))
        )).filter(Boolean);

        if (!selectedValues.length) throw new Error('Failed to find any selected answers.');

        // Prepare the requests
        const requests = [
          // eslint-disable-next-line no-promise-executor-return
          new Promise((resolve) => setTimeout(resolve, 3000))
        ];
        const params = new URLSearchParams('');
        params.append('page', '1');

        if (this.form.dataset.logic === 'AND') {
          requests.push(
            fetch(`${this.action}/${selectedValues.join('+')}?${params.toString()}`, { redirect: 'manual' })
          );
        } else {
          selectedValues.forEach((selectedValue) => {
            requests.push(
              fetch(`${this.action}/${selectedValue}?${params.toString()}`, { redirect: 'manual' })
            );
          });
        }

        // Make the requests
        const responses = (await Promise.all(requests)).filter(Boolean);

        // Get the results from each response
        const results = [];
        for (const response of responses) {
          // Skip redirected requests
          if (
            !response.ok
            && response.status === 0
            && response.type === 'opaqueredirect'
          ) {
            // eslint-disable-next-line no-continue
            continue;
          }

          if (!response.ok) throw new Error('An error occurred while fetching results.');

          // eslint-disable-next-line no-await-in-loop
          const html = await response.text();
          if (!html) throw new Error('An error occurred while parsing response.');

          const dom = new DOMParser().parseFromString(html, 'text/html');
          const items = dom.querySelectorAll('#filter-results product-card');
          items.forEach((item) => {
            const url = item.querySelector('a').href;
            const match = results.find((result) => result.querySelector('a').href === url);
            if (!match) {
              results.push(item);
            }
          });
        }
        if (!results.length) throw new Error('Failed to find any results.');

        // Render the results
        const template = this.querySelector('template');
        const updatedResults = template.content.querySelector('ul').cloneNode(true);
        const hasCutoutCards = updatedResults.classList.contains('has-cutout-cards');
        const hasImageBlending = updatedResults.classList.contains('has-image-blending');
        results.forEach((card) => {
          const media = card.querySelector('.media');
          if (hasImageBlending && !hasCutoutCards) {
            media.classList.add('image-blend');
          } else {
            media.classList.remove('image-blend');
          }
          const item = document.createElement('li');
          item.appendChild(card);
          updatedResults.appendChild(item);
        });
        this.results.appendChild(updatedResults);

        // Show the next screen
        /* eslint-disable */
        this.currentScreen = (this.currentScreen + 1);
        /* eslint-enable */
      } catch (error) {
        // eslint-disable-next-line
        console.warn(error);

        // Render no results
        const template = this.querySelector('template');
        const updatedResults = template.content.querySelector('div').cloneNode(true);
        this.results.appendChild(updatedResults);

        // Show the next screen
        /* eslint-disable */
        this.currentScreen = (this.currentScreen + 1);
        /* eslint-enable */
      } finally {
        this.previousBtn.disabled = false;
        this.submitBtn.disabled = false;
        this.submitBtn.removeAttribute('loading');
      }
    }

    handleChange() {
      this.renderButtons();
    }

    handleNext(event) {
      event.preventDefault();

      /* eslint-disable */
      this.currentScreen = (this.currentScreen + 1);
      /* eslint-enable */
    }

    handlePrevious(event) {
      event.preventDefault();

      /* eslint-disable */
      this.currentScreen = (this.currentScreen - 1);
      /* eslint-enable */
    }

    handleRetry(event) {
      event.preventDefault();

      this.screens
        .filter((screen) => screen.querySelector('[type="checkbox"], [type="radio"]'))
        .forEach((screen) => {
          screen.querySelectorAll('[type="checkbox"]:checked, [type="radio"]:checked').forEach((input) => {
            input.checked = false;
          });
        });
      this.results.innerHTML = '';

      /* eslint-disable */
      this.currentScreen = 0;
      /* eslint-enable */
    }

    render(scrollIntoView = true) {
      this.renderScreen();
      this.renderButtons();

      if (scrollIntoView) {
        this.scrollIntoView();
      }
    }

    scrollIntoView() {
      const announcementHeight = parseInt(document.documentElement.style.getPropertyValue('--announcement-height'), 10) || 0;
      const headerHeight = parseInt(document.documentElement.style.getPropertyValue('--header-height'), 10) || 0;
      const targetPosition = Math.round(
        this.getBoundingClientRect().top + window.scrollY - (headerHeight - announcementHeight)
      ) || 0;

      if (Math.round(window.scrollY) > announcementHeight) {
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      }
    }

    renderScreen() {
      this.screens.forEach((screen, index) => {
        if (index === this.currentScreen) {
          screen.classList.add('is-visible');
        } else {
          screen.classList.remove('is-visible');
        }
      });
    }

    renderButtons() {
      this.nextBtns.forEach((nextBtn) => {
        nextBtn.disabled = !this.nextEnabled;
      });
      this.previousBtn.disabled = !this.prevEnabled;
      this.submitBtn.disabled = !this.submitEnabled;
    }

    initWidget() {
      const screen = this.screens.find((s) => s.classList.contains('quiz__personalize'));
      if (!screen) return;

      const input = screen.querySelector('input[name="name"]');
      if (!input) return;

      this.name = input.value.trim();

      const caption = screen.querySelector('figcaption');
      const nameElements = Array.from(this.querySelectorAll('.js-name'));
      const regex = /\[name\]/gi;

      nameElements.forEach((el) => {
        if (!el.dataset.default) {
          el.dataset.default = el.textContent;
        }
      });

      const updateElements = () => {
        if (caption) {
          caption.textContent = (this.name === '' && caption.dataset.default) ? caption.dataset.default : this.name;
        }
        nameElements.forEach((element) => {
          if (element.dataset.default) {
            const newText = element.dataset.default.replace(regex, this.name).replace(/\s+([.,!?;:])/g, '$1');
            if (element.textContent !== newText) {
              element.textContent = newText;
            }
          }
        });
      };

      updateElements();

      input.addEventListener('input', () => {
        this.name = input.value.trim();

        updateElements();
      });
    }
  }

  customElements.define('quiz-component', QuizComponent);
}
