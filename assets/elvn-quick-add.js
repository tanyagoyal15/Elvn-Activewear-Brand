/**
 * Elvn Quick Add Strip
 * Hooks into Beautify's ProductCard custom element.
 * Requires main.js to be loaded first.
 */

(function () {
  "use strict";

  // ── Helpers ──────────────────────────────────────────────

  /**
   * Get variant data from the JSON block inside a product-card.
   */
  function getVariantData(card) {
    const json = card.querySelector(".elvn-variants-json");
    if (!json) return null;
    try {
      return JSON.parse(json.textContent);
    } catch (e) {
      return null;
    }
  }

  /**
   * Get the currently selected color value from swatch inputs.
   * Returns null if product has no color option.
   */
  function getActiveColor(card) {
    const checked = card.querySelector(".card__swatches .opt-btn:checked");
    if (checked) return checked.value;
    // Fallback: no swatches, return null (single-color product)
    return null;
  }

  /**
   * Build size chip HTML for a given list of variants.
   */
  function buildChips(variants) {
    if (!variants.length) return "";
    return variants
      .map((v) => {
        const oos = !v.available ? " is-oos" : "";
        return `<button 
          class="elvn-size-chip${oos}" 
          type="button"
          data-variant-id="${v.id}"
          data-size="${v.size}"
          ${!v.available ? 'aria-disabled="true"' : ""}
        >${v.size}</button>`;
      })
      .join("");
  }

  /**
   * Update the cart count badge in the header.
   * Handles the edge case where badge doesn't exist (empty cart).
   */
  async function updateCartCount() {
    try {
      const res = await fetch("/cart.js");
      const cart = await res.json();
      const count = cart.item_count;

      let badge = document.querySelector(".header__cart-count");

      if (!badge) {
        // Badge doesn't exist yet (was empty cart) — create and inject it
        const cartIcon = document.querySelector("#cart-icon");
        if (!cartIcon) return;

        const newBadge = document.createElement("div");
        newBadge.className =
          "header__cart-count count-badge absolute text-center";
        cartIcon.appendChild(newBadge);
        badge = newBadge;
      }

      const visibleSpan = badge.querySelector("span[aria-hidden]");
      const hiddenSpan = badge.querySelector(".visually-hidden");

      if (count < 100) {
        if (visibleSpan) {
          visibleSpan.textContent = count;
        } else {
          badge.insertAdjacentHTML(
            "afterbegin",
            `<span aria-hidden="true">${count}</span>`,
          );
        }
      } else {
        if (visibleSpan) visibleSpan.remove();
      }

      if (hiddenSpan) {
        hiddenSpan.textContent = `${count} items in cart`;
      }

      // Animate the badge briefly
      badge.classList.add("elvn-count-bump");
      setTimeout(() => badge.classList.remove("elvn-count-bump"), 400);
    } catch (e) {
      // Cart count update failed silently — not critical
    }
  }

  // ── Per-card controller ───────────────────────────────────

  class ElvnQuickAdd {
    constructor(card) {
      this.card = card;
      this.strip = card.querySelector(".elvn-size-strip");
      this.chipsContainer = card.querySelector(".elvn-size-strip__chips");
      this.addBtn = card.querySelector(".elvn-size-strip__add");

      if (!this.strip || !this.chipsContainer || !this.addBtn) return;

      this.variantData = getVariantData(card);
      if (!this.variantData) return;

      this.selectedVariantId = null;
      this.isAdding = false;

      this.bindEvents();
      this.renderChips(); // initial render
    }

    bindEvents() {
      // Chip selection
      this.chipsContainer.addEventListener("click", (e) => {
        const chip = e.target.closest(".elvn-size-chip");
        if (!chip || chip.classList.contains("is-oos")) return;

        e.preventDefault(); // ✅ stop default behavior
        e.stopPropagation(); // ✅ stop bubbling to product link
        e.stopImmediatePropagation();

        this.selectChip(chip);
      });

      // Add to cart
      this.addBtn.addEventListener("click", (e) => {
        e.preventDefault(); // ✅ stop default behavior
        e.stopPropagation(); // prevent card link navigation
        this.handleAdd();
      });

      // Re-render chips when color swatch changes
      this.card.addEventListener("change", (e) => {
        if (e.target.matches(".opt-btn")) {
          // Small delay to let existing handleSwatchChange run first
          setTimeout(() => {
            this.selectedVariantId = null;
            this.renderChips();
            this.resetAddBtn();
            this.clearMsg();
          }, 50);
        }
      });

      // Reset selected size when card closes (mouse leaves)
      this.card.addEventListener("mouseleave", () => {
        setTimeout(() => {
          if (!this.card.classList.contains("is-open")) {
            this.selectedVariantId = null;
            this.renderChips();
            this.resetAddBtn();
            this.clearMsg();
          }
        }, 350); // after close transition
      });

      // Mobile: tap on card image to open strip
      const media = this.card.querySelector(".card__media");
      if (media && window.matchMedia("(hover: none)").matches) {
        media.addEventListener("click", (e) => {
          // Don't intercept clicks on the strip itself or card links
          if (e.target.closest(".elvn-size-strip")) return;
          if (e.target.closest("a")) return;

          e.preventDefault();
          this.card.classList.toggle("elvn-touch-open");
        });

        // Close on outside tap
        document.addEventListener("click", (e) => {
          if (!this.card.contains(e.target)) {
            this.card.classList.remove("elvn-touch-open");
            this.selectedVariantId = null;
            this.renderChips();
            this.resetAddBtn();
          }
        });
      }
    }

    /**
     * Render size chips filtered by current active color.
     */
    renderChips() {
      const { variants, hasColorOption } = this.variantData;
      const activeColor = getActiveColor(this.card);

      let filtered;
      if (hasColorOption && activeColor) {
        filtered = variants.filter(
          (v) => v.color && v.color.toLowerCase() === activeColor.toLowerCase(),
        );
      } else {
        filtered = variants;
      }

      // Dedupe by size (keep first occurrence per size)
      const seen = new Set();
      const unique = filtered.filter((v) => {
        if (seen.has(v.size)) return false;
        seen.add(v.size);
        return true;
      });

      this.chipsContainer.innerHTML = buildChips(unique);

      // Re-select previously selected variant if still valid
      if (this.selectedVariantId) {
        const stillValid = unique.find(
          (v) => v.id === this.selectedVariantId && v.available,
        );
        if (stillValid) {
          const chip = this.chipsContainer.querySelector(
            `[data-variant-id="${this.selectedVariantId}"]`,
          );
          if (chip) chip.classList.add("is-selected");
        } else {
          this.selectedVariantId = null;
        }
      }
    }

    selectChip(chip) {
      // Deselect all
      this.chipsContainer.querySelectorAll(".elvn-size-chip").forEach((c) => {
        c.classList.remove("is-selected");
      });

      chip.classList.add("is-selected");
      this.selectedVariantId = parseInt(chip.dataset.variantId, 10);
      this.clearMsg();
    }

    // async handleAdd() {
    //   if (this.isAdding) return;

    //   if (!this.selectedVariantId) {
    //     this.showMsg("Please select a size");
    //     this.addBtn.classList.add("is-error");
    //     setTimeout(() => this.addBtn.classList.remove("is-error"), 1000);
    //     return;
    //   }

    //   this.isAdding = true;
    //   this.addBtn.disabled = true;
    //   this.addBtn.textContent = "...";
    //   this.clearMsg();

    //   try {
    //     const res = await fetch("/cart/add.js", {
    //       method: "POST",
    //       headers: {
    //         "Content-Type": "application/json",
    //         "X-Requested-With": "XMLHttpRequest",
    //       },
    //       body: JSON.stringify({ id: this.selectedVariantId, quantity: 1 }),
    //     });

    //     if (!res.ok) {
    //       const err = await res.json();
    //       throw new Error(err.description || "Could not add to cart");
    //     }

    //     // Success
    //     this.addBtn.textContent = "Added ✓";
    //     this.addBtn.classList.add("is-added");
    //     await updateCartCount();

    //     // Check if theme setting opens cart drawer after ATC
    //     if (window.theme?.settings?.afterAtc === "drawer") {
    //       const cartDrawer = document.querySelector("cart-drawer");
    //       if (cartDrawer) {
    //         setTimeout(() => cartDrawer.open(), 300);
    //       }
    //     }

    //     // Reset after 2s
    //     setTimeout(() => {
    //       this.addBtn.classList.remove("is-added");
    //       this.resetAddBtn();
    //       // Don't reset chip selection — user may want to add again
    //     }, 2000);
    //   } catch (err) {
    //     this.addBtn.textContent = "Error";
    //     this.addBtn.classList.add("is-error");
    //     this.showMsg(err.message || "Something went wrong");

    //     setTimeout(() => {
    //       this.addBtn.classList.remove("is-error");
    //       this.resetAddBtn();
    //     }, 2000);
    //   } finally {
    //     this.isAdding = false;
    //     this.addBtn.disabled = false;
    //   }
    // }

    async handleAdd() {
      if (this.isAdding) return;

      if (!this.selectedVariantId) {
        this.showMsg("Please select a size");
        this.addBtn.classList.add("is-error");
        setTimeout(() => this.addBtn.classList.remove("is-error"), 1000);
        return;
      }

      this.isAdding = true;
      this.addBtn.disabled = true;
      this.addBtn.textContent = "...";
      this.clearMsg();

      try {
        // 1. Add to cart
        const res = await fetch("/cart/add.js", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({
            id: this.selectedVariantId,
            quantity: 1,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.description || "Could not add to cart");
        }

        // 2. Update cart count
        await updateCartCount();

        // 3. Refresh cart drawer content
        const cartDrawer = document.querySelector("cart-drawer");

        if (cartDrawer) {
          const drawerRes = await fetch("/?section_id=cart-drawer");
          const html = await drawerRes.text();

          const temp = document.createElement("div");
          temp.innerHTML = html;

          const newDrawer = temp.querySelector("cart-drawer");

          if (newDrawer) {
            cartDrawer.innerHTML = newDrawer.innerHTML;
          }

          // Open updated drawer
          cartDrawer.open();
        }

        // 4. Success UI
        this.addBtn.textContent = "Added ✓";
        this.addBtn.classList.add("is-added");

        setTimeout(() => {
          this.addBtn.classList.remove("is-added");
          this.resetAddBtn();
        }, 2000);
      } catch (err) {
        // Error UI
        this.addBtn.textContent = "Error";
        this.addBtn.classList.add("is-error");
        this.showMsg(err.message || "Something went wrong");

        setTimeout(() => {
          this.addBtn.classList.remove("is-error");
          this.resetAddBtn();
        }, 2000);
      } finally {
        this.isAdding = false;
        this.addBtn.disabled = false;
      }
    }

    resetAddBtn() {
      this.addBtn.textContent = "Add";
      this.addBtn.disabled = false;
      this.addBtn.classList.remove("is-added", "is-error");
    }

    showMsg(text) {
      this.clearMsg();
      const msg = document.createElement("span");
      msg.className = "elvn-size-strip__msg";
      msg.textContent = text;
      this.strip.appendChild(msg);
    }

    clearMsg() {
      this.strip.querySelector(".elvn-size-strip__msg")?.remove();
    }
  }

  // ── Init all cards on page ────────────────────────────────

  function initCards() {
    document.querySelectorAll("product-card").forEach((card) => {
      if (!card.dataset.elvnQaInit) {
        card.dataset.elvnQaInit = "1";
        new ElvnQuickAdd(card);
      }
    });
  }

  // Init on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCards);
  } else {
    initCards();
  }

  // Re-init when new cards are injected (infinite scroll, quick view, etc.)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === "PRODUCT-CARD") {
            if (!node.dataset.elvnQaInit) {
              node.dataset.elvnQaInit = "1";
              new ElvnQuickAdd(node);
            }
          }
          // Also check descendants (e.g. section injected by infinite scroll)
          if (node.querySelectorAll) {
            node
              .querySelectorAll("product-card:not([data-elvn-qa-init])")
              .forEach((card) => {
                card.dataset.elvnQaInit = "1";
                new ElvnQuickAdd(card);
              });
          }
        });
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
