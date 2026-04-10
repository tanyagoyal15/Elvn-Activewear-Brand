/* global SideDrawer */

if (!customElements.get('localization-drawer')) {
  class LocalizationDrawer extends SideDrawer {
    constructor() {
      super();
      window.initLazyScript(this, this.init.bind(this));
    }

    init() {
      this.maxVisible = 12;
      this.flagsLoaded = false;

      // adjacent toggles
      const drawerId = this.dataset.triggeredBy;
      this.localizationToggles = document.querySelectorAll(`[data-localization-trigger="${drawerId}"]`);

      // overlay
      this.overlay = document.querySelector('.js-localization-overlay');

      // Form & input fields
      this.localizationForm = this.querySelector(`#form-${drawerId}`);
      this.countryCode = this.querySelector('[name="country_code"]');
      this.languageCode = this.querySelector('[name="locale_code"]');

      // Buttons
      this.localizationSubmit = this.querySelector('.js-localization-submit');
      this.localizationCountryToggle = this.querySelector('.js-localization-country-toggle');
      this.localizationLanguageToggle = this.querySelector('.js-localization-language-toggle');

      // Elements
      this.countryList = this.querySelector('.js-localization-country-list');
      this.languageList = this.querySelector('.js-localization-language-list');
      this.localizationCountries = this.querySelectorAll('.js-localization-country');
      this.localizationLanguages = this.querySelectorAll('.js-localization-language');

      // Flag elements to lazy load
      this.localizationFlags = this.querySelectorAll('.localization-country__flag');

      // Event listeners
      this.localizationToggles.forEach((el) => {
        el.addEventListener('click', (evt) => this.toggleLocalization(evt.currentTarget));
      });

      this.localizationSubmit?.addEventListener('click', () => {
        this.submitLocalization();
      });

      this.localizationCountryToggle?.addEventListener('click', this.toggleCountryList.bind(this));
      this.localizationLanguageToggle?.addEventListener('click', this.toggleLanguageList.bind(this));

      // Country input handlers
      this.localizationCountries.forEach((country) => {
        country.addEventListener('change', this.updateCountryCode.bind(this));
      });

      // Language input handlers
      this.localizationLanguages.forEach((language) => {
        language.addEventListener('change', this.updateLanguageCode.bind(this));
      });
    }

    toggleListVisibility(listElement, toggleButton) {
      const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
      const listItems = listElement?.querySelectorAll('li');

      listItems?.forEach((li, index) => {
        if (isExpanded && index >= this.maxVisible) {
          li.setAttribute('hidden', true);
        } else {
          li.removeAttribute('hidden');
        }
      });

      toggleButton.setAttribute('aria-expanded', (!isExpanded).toString());

      const showAllText = toggleButton.dataset.showAll;
      const showLessText = toggleButton.dataset.showLess;
      toggleButton.textContent = isExpanded ? showAllText : showLessText;
    }

    toggleCountryList() {
      this.toggleListVisibility(this.countryList, this.localizationCountryToggle);
    }

    toggleLanguageList() {
      this.toggleListVisibility(this.languageList, this.localizationLanguageToggle);
    }

    showAllLanguages() {
      this.localizationLanguages.forEach((input) => {
        const parentLi = input.closest('li');
        if (parentLi?.hasAttribute('hidden')) {
          parentLi.removeAttribute('hidden');
        }
      });

      this.LocalizationLanguageShow?.setAttribute('hidden', true);
    }

    updateLanguageCode({ currentTarget }) {
      if (this.languageCode) this.languageCode.value = currentTarget.value;
    }

    updateCountryCode({ currentTarget }) {
      if (this.countryCode) this.countryCode.value = currentTarget.value;
    }

    /**
     * Opens the drawer.
     * @param {Element} [opener] - Element that triggered opening of the drawer.
     */
    toggleLocalization(opener) {
      if (this.localizationToggles.length === 0) return;

      const isActive = !this.localizationToggles[0].classList.contains('is-active');

      this.localizationToggles.forEach((el) => {
        el.classList.toggle('is-active', isActive);
        el.setAttribute('aria-expanded', isActive);
      });

      this.filtersOpen = isActive;
      this.open(opener);
      this.loadFlagImages();
    }

    loadFlagImages() {
      if (this.flagsLoaded) return;

      this.localizationFlags.forEach((flag) => {
        const flagUrl = flag.getAttribute('data-flag-url');
        if (flagUrl) {
          flag.style.setProperty('--flag-image', `url(${flagUrl})`);
        }
      });

      this.flagsLoaded = true;
    }

    submitLocalization() {
      if (!this.localizationForm) return;
      this.localizationForm.submit();
    }
  }

  customElements.define('localization-drawer', LocalizationDrawer);
}
