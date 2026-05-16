if (!customElements.get('brands-index')) {
  class BrandsIndex extends HTMLElement {
    connectedCallback() {
      window.initLazyScript(this, this.init.bind(this));
    }

    init() {
      this.searchInput = this.querySelector('.js-brands-search');
      if (this.searchInput) {
        this.index = [];
        this.querySelectorAll('.brand').forEach((el) => {
          const textEl = el.querySelector('.brand-text');
          this.index.push([el, textEl, textEl.innerText, textEl.innerText.toLowerCase()]);
        });
        this.brandList = this.querySelector('.brand-list');
        this.initials = [];
        this.querySelectorAll('a.brand-initial').forEach((el) => {
          this.initials.push([el, this.querySelector(el.getAttribute('href')).closest('.brand-list__group, .brand-list')]);
        });
        this.resetBtn = this.querySelector('.js-search-reset');
        this.resetBtn.addEventListener('click', this.resetBtnClickHandler.bind(this));
        this.searchInput.addEventListener('input', this.performSearch.bind(this));
      }
    }

    performSearch() {
      const searchValue = this.searchInput.value.toLowerCase();
      this.classList.toggle('brands-index--search-active', searchValue.length);
      this.resetBtn.toggleAttribute('hidden', !searchValue.length);
      this.index.forEach((item) => {
        const [brandEl, textEl, textOriginal, textSearchable] = item;
        const found = searchValue.length && textSearchable.indexOf(searchValue) >= 0;

        if (found) {
          brandEl.classList.add('brand-search-found');
          const foundPos = textSearchable.indexOf(searchValue);
          textEl.innerHTML = `${textOriginal.substring(0, foundPos)}<span class="brand-search-part">${textOriginal.substring(foundPos, foundPos + searchValue.length)}</span>${textOriginal.substring(foundPos + searchValue.length)}`;
        } else if (brandEl.classList.contains('brand-search-found')) {
          brandEl.classList.remove('brand-search-found');
          textEl.innerText = textOriginal;
        }
      });
      this.initials.forEach((item) => {
        const [initialEl, initialTarget] = item;
        initialEl.classList.toggle('brand-initial-search-found', initialTarget.querySelector('.brand-search-found'));
      });
    }

    resetBtnClickHandler() {
      this.searchInput.value = '';
      this.searchInput.dispatchEvent(new CustomEvent('input', { bubbles: true }));
    }
  }

  customElements.define('brands-index', BrandsIndex);
}
