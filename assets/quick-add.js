/* global SideDrawer, trapFocus, removeTrapFocus */

if (!customElements.get("quick-add-drawer")) {
  class QuickAddDrawer extends SideDrawer {
    constructor() {
      super();
      this.content = this.querySelector(".js-product-details");
      this.footer = this.querySelector(".drawer__footer");
      this.footerContent = this.querySelector(".js-footer-content");
      this.notification = this.querySelector(".js-added-to-cart");
      this.backBtn = this.querySelector(".drawer__back-btn");
      this.openCartDrawerLinks = this.querySelectorAll(".js-open-cart-drawer");
      this.cartDrawer = document.querySelector("cart-drawer");
      this.documentClickHandler = this.handleDocumentClick.bind(this);

      document.addEventListener("click", this.documentClickHandler);
      this.addEventListener(
        "on:variant:change",
        this.handleVariantChange.bind(this),
      );

      this.openCartDrawerLinks.forEach((link) => {
        link.addEventListener("click", this.handleOpenCartClick.bind(this));
      });
    }

    disconnectedCallback() {
      document.removeEventListener("click", this.documentClickHandler);
    }

    /**
     * Handles 'click' events on success notification's 'View cart' link
     * @param {object} evt - Event object.
     */
    handleOpenCartClick(evt) {
      // Open the cart drawer if available on the page
      if (this.cartDrawer) {
        evt.preventDefault();
        this.cartDrawer.open();
      } else if (window.location.pathname === theme.routes.cart) {
        evt.preventDefault();
        this.close();
      }
    }

    /**
     * Handles 'click' events on the document.
     * Also called directly by siblingLinkHandler.
     * @param {object} evt - Event object.
     */
    handleDocumentClick(evt) {
      if (!evt.target.matches(".js-quick-add")) return;

      // Handle an anchor tag
      if (evt.target.tagName === "A") {
        evt.preventDefault();
      }

      // Close the cart drawer if it's open
      if (this.cartDrawer && this.cartDrawer.ariaHidden === "false") {
        const overlay = document.querySelector(".js-overlay.is-visible");
        if (overlay) overlay.style.transitionDelay = "200ms";

        this.cartDrawer.close();

        // Wait a few ms for a more optimal ux/animation
        setTimeout(() => {
          this.backBtn.hidden = false;
          this.open(evt.target);
          if (overlay) overlay.style.transitionDelay = "";
        }, 200);
      } else {
        this.open(evt.target);
      }
    }

    /**
     * Handles 'on:variant:change' events on the Quick Add drawer.
     * @param {object} evt - Event object.
     */
    handleVariantChange(evt) {
      // Update product links
      let url = this.productUrl;

      if (evt.detail.variant) {
        const separator = this.productUrl.split("?").length > 1 ? "&" : "?";
        url += `${separator}variant=${evt.detail.variant.id}`;
      }

      this.querySelectorAll(".js-prod-link").forEach((link) => {
        link.href = url;
      });
    }

    /**
     * Opens the drawer and fetches the product details.
     * @param {Element} opener - Element that triggered opening of the drawer.
     */
    async open(opener) {
      opener.setAttribute("aria-disabled", "true");
      if (this.notification) this.notification.hidden = true;

      this.header = this.querySelector(".js-quick-add-heading");

      // If it's the same product as previously shown, there's no need to re-fetch the details.
      // if (this.productUrl && this.productUrl === this.productUrl) {
      //   if (opener.dataset.selectedColor) this.setActiveVariant(opener);
      //   super.open(opener);
      //   opener.removeAttribute('aria-disabled');
      //   return;
      // }

      this.productUrl =
        opener.tagName === "A" ? opener.href : opener.dataset.productUrl;
      this.header.innerHTML = "";
      this.content.innerHTML = "";
      document.querySelector(".quick-add__header--price")?.remove();
      this.classList.add("is-loading");
      this.content.classList.add("drawer__content--out");
      this.footer.classList.add("drawer__footer--out");

      super.open(opener);

      const response = await fetch(this.productUrl);
      if (response.ok) {
        const pageContentHtml = await response.text();
        this.renderProduct(opener, pageContentHtml);

        if (this.querySelector(".shopify-payment-button")) {
          setTimeout(() => {
            removeTrapFocus();
            trapFocus(this);
          }, 1000);
        } else {
          removeTrapFocus();
          trapFocus(this);
        }
      }

      opener.removeAttribute("aria-disabled");
    }

    /**
     * Closes the cart drawer.
     */
    close() {
      document.querySelector(".js-overlay").innerHTML = "";
      super.close(() => {
        this.backBtn.hidden = true;
      });
    }

    /**
     * Renders the product details.
     * @param {Element} opener - Element that triggered opening of the drawer.
     * @param {string} pageContentHtml - Product page HTML for the product we wish to show.
     */
    renderProduct(opener, pageContentHtml) {
      const tmpl = document.createElement("template");
      tmpl.innerHTML = pageContentHtml;
      this.productEl = tmpl.content
        .getElementById("quick-buy-template")
        .content.querySelector(".js-product");

      // Load any external resources
      tmpl.content
        .querySelectorAll('.cc-main-product link[rel="stylesheet"]')
        .forEach((el) => {
          if (
            !document.querySelector(
              `link[rel="stylesheet"][href="${el.getAttribute("href")}"]`,
            )
          ) {
            document.head.insertAdjacentHTML("beforeend", el.outerHTML);
          }
        });
      tmpl.content
        .querySelectorAll(".cc-main-product script[src]")
        .forEach((el) => {
          if (
            !document.querySelector(`script[src="${el.getAttribute("src")}"]`)
          ) {
            const scr = document.createElement("script");
            scr.src = el.getAttribute("src");
            scr.defer = "defer";
            document.head.appendChild(scr);
          }
        });

      // Update content
      QuickAddDrawer.convertToQuickBuyContent(this.productEl, this.productUrl);
      this.updateFooter();
      this.updateContent();

      // Check whether to select the first variant
      const variantPicker = this.productEl.querySelector("variant-picker");
      if (variantPicker) {
        this.selectFirstVariant =
          variantPicker.dataset.selectFirstVariant === "true";
      }

      if (opener.dataset.selectedColor && this.selectFirstVariant) {
        this.setActiveVariant(opener);
      }

      this.querySelectorAll(".product-siblings a").forEach((el) => {
        el.addEventListener("click", this.siblingLinkHandler.bind(this));
      });
    }

    /**
     * Handling selecting a sibling in the product form
     * @param {object} evt - Event object.
     */
    siblingLinkHandler(evt) {
      evt.preventDefault();
      const qbBtn = document.createElement("button");
      qbBtn.className = "js-quick-add";
      qbBtn.dataset.productUrl = evt.currentTarget.getAttribute("href");
      this.handleDocumentClick({ target: qbBtn });
    }

    /**
     * Set color variant to match the one selected in the card.
     * @param {Element} opener - Element that triggered opening of the drawer.
     */
    setActiveVariant(opener) {
      const colorOptionBox = this.querySelector(
        `.opt-btn[value="${opener.dataset.selectedColor}"]`,
      );
      if (colorOptionBox) {
        setTimeout(() => {
          this.querySelector(
            `.opt-btn[value="${opener.dataset.selectedColor}"]`,
          ).click();
        }, 100);
      } else {
        const colorOptionDropdown = this.querySelector(
          `.custom-select__option[data-value="${opener.dataset.selectedColor}"]`,
        );
        if (colorOptionDropdown) {
          const customSelect = colorOptionDropdown.closest("custom-select");
          customSelect.selectOption(colorOptionDropdown);
        }
      }
    }

    /**
     * Builds the markup for the drawer content element.
     */
    updateContent() {
      this.header.innerHTML = theme.strings.quickAddHeading;

      const productContent = this.productEl.querySelector(
        ".js-product-details",
      );
      if (productContent) {
        this.content.innerHTML = productContent.innerHTML;
      }

      this.classList.remove("is-loading");
      this.content.classList.remove("drawer__content--out");
    }

    /**
     * Renders the markup for the drawer footer element.
     */
    updateFooter() {
      const footerContent = this.productEl.querySelector(".js-footer-content");
      this.footer.classList.remove("quick-add__footer-message");

      if (footerContent && footerContent.hasChildNodes()) {
        this.footerContent.innerHTML = footerContent.innerHTML;
      } else {
        this.footerContent.innerHTML = "";
      }

      this.footer.classList.remove("drawer__footer--out");
    }

    /**
     * Shows an "Added to cart" message in the drawer.
     */
    addedToCart() {
      if (this.notification) {
        setTimeout(() => {
          this.notification.hidden = false;
        }, 300);

        setTimeout(() => {
          this.notification.hidden = true;
        }, this.notification.dataset.visibleFor);
      }
    }

    /**
     * Convert product template content to quick buy content.
     * @param {Element} container - Container element containing new content to use.
     */
    static convertToQuickBuyContent(container) {
      // Prevent variant picker from updating the URL on change.
      const variantPicker = container.querySelector("variant-picker");
      if (variantPicker) variantPicker.dataset.updateUrl = "false";

      // Remove size chart modal and link (if they exist).
      container
        .querySelectorAll("open-or-scroll-to:has(.size-chart-link)")
        .forEach((el) => el.remove());

      // Always use carousel media gallery
      const mg = container.querySelector("media-gallery");
      if (mg) mg.dataset.layout = "carousel";
    }
  }

  customElements.define("quick-add-drawer", QuickAddDrawer);

  window.theme = window.theme || {};
  window.theme.quickBuy = window.theme.quickBuy || {};
  window.theme.quickBuy.convertToQuickBuyContent =
    QuickAddDrawer.convertToQuickBuyContent;
}
