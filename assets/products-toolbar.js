if (!customElements.get('products-toolbar')) {
  class ProductsToolbar extends HTMLElement {
    constructor() {
      super();
      this.init();
    }

    init() {
      this.filtersComponent = document.querySelector('facet-filters');
      this.filtersColumn = document.querySelector('.main-products-grid__filters');
      this.sortBy = this.querySelector('.products-toolbar__sort');
      this.layoutSwitcher = this.querySelector('.products-toolbar__layout');

      if (this.filtersColumn) {
        this.filterToggle = this.querySelector('.js-toggle-filters');
        this.filterToggle.addEventListener('click', this.toggleFilters.bind(this));
      }

      if (!this.filtersComponent && this.sortBy) {
        this.sortBy.addEventListener('change', ProductsToolbar.handleSortByChange);
      }

      if (this.layoutSwitcher) {
        this.productsGrid = document.querySelector('.main-products-grid');

        this.layoutSwitcher.addEventListener('change', this.handleLayoutChange.bind(this));
        this.handleBreakpointChangeListener = this.handleBreakpointChange.bind(this);
        window.addEventListener('on:breakpoint-change', this.handleBreakpointChangeListener);

        this.applySelectedLayout();
      }
    }

    disconnectedCallback() {
      if (this.layoutSwitcher) {
        window.removeEventListener('on:breakpoint-change', this.handleBreakpointChangeListener);
      }
    }

    /**
     * Toggles open/closed state of the filters on desktop.
     */
    toggleFilters() {
      this.filterToggle.classList.toggle('is-active');
      this.filtersOpen = this.filterToggle.classList.contains('is-active');
      this.filterToggle.setAttribute('aria-expanded', this.filtersOpen);

      this.filtersComponent.open();
    }

    /**
     * Handles 'change' events on the layout switcher buttons.
     * @param {object} evt - Event object.
     */
    handleLayoutChange(evt) {
      const layoutColumns = this.currentColumns;

      if (theme.mediaMatches.lg) {
        this.productsGrid.dataset.columnsLg = evt.target.value;
        layoutColumns.lg = evt.target.value;
      } else if (theme.mediaMatches.md) {
        this.productsGrid.dataset.columnsMd = evt.target.value;
        layoutColumns.md = evt.target.value;
      } else if (theme.mediaMatches.sm) {
        this.productsGrid.dataset.columnsSm = evt.target.value;
        layoutColumns.sm = evt.target.value;
      } else if (!theme.mediaMatches.sm) {
        this.productsGrid.dataset.columnsMobile = evt.target.value;
        layoutColumns.mobile = evt.target.value;
      }

      try {
        const persistedColumns = JSON.stringify(layoutColumns);
        sessionStorage.setItem('cc-products-layout', persistedColumns);
      } catch (e) {
        //
      }
    }

    /**
     * Handles when a sort by dropdown is changed (and filtering is disabled)
     * @param {object} evt - Event object.
     */
    static handleSortByChange(evt) {
      const urlObj = new URL(window.location.href);
      urlObj.searchParams.set('sort_by', evt.detail.selectedValue);
      urlObj.hash = 'products-toolbar';
      window.location.href = urlObj.toString();
    }

    /**
     * Applies the users layout switcher selection.
     */
    applySelectedLayout() {
      const persistedColumns = sessionStorage.getItem('cc-products-layout');
      if (!persistedColumns) return;

      try {
        const layoutColumns = JSON.parse(persistedColumns);

        this.productsGrid.dataset.columnsLg = layoutColumns.lg;
        this.productsGrid.dataset.columnsMd = layoutColumns.md;
        this.productsGrid.dataset.columnsSm = layoutColumns.sm;
        this.productsGrid.dataset.columnsMobile = layoutColumns.mobile;

        this.updateSelectedLayoutOption();
      } catch (e) {
        //
      }
    }

    /**
     * Handles 'change' events when the breakpoint of the viewport changes.
     */
    handleBreakpointChange() {
      this.updateSelectedLayoutOption();
    }

    /**
     * Sets the selected layout switcher input.
     */
    updateSelectedLayoutOption() {
      const layoutColumns = this.currentColumns;
      let selectedValue;

      if (theme.mediaMatches.lg) {
        selectedValue = layoutColumns.lg;
      } else if (theme.mediaMatches.md) {
        selectedValue = layoutColumns.md;
      } else if (theme.mediaMatches.sm) {
        selectedValue = layoutColumns.sm;
      } else if (!theme.mediaMatches.sm) {
        selectedValue = layoutColumns.mobile;
      }

      const options = Array.from(this.layoutSwitcher.querySelectorAll('input[name="products-layout"]'));
      options.forEach((option) => {
        option.checked = (option.value === selectedValue);
      });
    }

    /**
     * Get the current column data attributes from the DOM.
     * @returns {object} Object containing the current columns for each breakpoint.
     */
    get currentColumns() {
      return {
        mobile: this.productsGrid.dataset.columnsMobile,
        sm: this.productsGrid.dataset.columnsSm,
        md: this.productsGrid.dataset.columnsMd,
        lg: this.productsGrid.dataset.columnsLg
      };
    }
  }

  customElements.define('products-toolbar', ProductsToolbar);
}
