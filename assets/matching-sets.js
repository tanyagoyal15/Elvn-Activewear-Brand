document.addEventListener("DOMContentLoaded", () => {
  // ---------------- HOTSPOT CLICK ----------------
  document.querySelectorAll(".hotspot").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const setId = btn.dataset.set;
      const type = btn.dataset.type;
      const set = window.MATCHING_SETS[setId - 1];
      if (!set) return;
      showMiniCard(set, type, btn);
    });
  });

  // ---------------- SHOP FULL SET ----------------
  document.querySelectorAll(".open-drawer").forEach((btn) => {
    btn.addEventListener("click", () => {
      const setId = btn.dataset.set;
      const set = window.MATCHING_SETS[setId - 1];
      if (!set) return;
      openDrawer(set);
    });
  });

  // ---------------- MINI CARD CLOSE ----------------
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".mini-card") && !e.target.closest(".hotspot")) {
      document.querySelectorAll(".mini-card.show").forEach((card) => {
        card.classList.remove("show");
      });
    }
  });

  // ---------------- DRAWER CLOSE ----------------
  const drawer = document.getElementById("matching-drawer");
  if (drawer) {
    const closeBtn = drawer.querySelector(".drawer-close");
    const overlay = drawer.querySelector(".drawer-overlay");
    if (closeBtn) closeBtn.onclick = closeDrawer;
    if (overlay) overlay.onclick = closeDrawer;

    const cta = drawer.querySelector(".drawer-cta");
    if (cta) cta.addEventListener("click", addAllToCart);
  }

  document.querySelectorAll(".set-image img").forEach((img) => {
    if (img.complete) {
      img.closest(".set-image")?.classList.add("loaded");
    } else {
      img.addEventListener("load", () => {
        img.closest(".set-image")?.classList.add("loaded");
      });
    }
  });

  document.querySelectorAll(".matching-set-card img").forEach((img) => {
    const card = img.closest(".matching-set-card");
    if (img.complete) {
      card?.classList.add("loaded");
    } else {
      img.addEventListener("load", () => {
        card?.classList.add("loaded");
      });
    }
  });
});

// ================= MINI CARD =================

function showMiniCard(set, type, anchor) {
  const product =
    type === "top" ? set.products[0] : set.products[1] || set.products[0];
  if (!product) return;

  const container = anchor.closest(".set-image");
  const miniCard = container.querySelector(".mini-card");
  if (!miniCard) return;

  document.querySelectorAll(".mini-card.show").forEach((card) => {
    card.classList.remove("show");
  });

  miniCard.innerHTML = `
    <div class="mini-card-inner">
      <div class="mini-left">
        <img src="${product.featured_image || set.image}" />
      </div>
      <div class="mini-right">
        <div class="mini-title">${product.title}</div>
        <div class="mini-price">${formatPrice(product.price)}</div>
        <button class="mini-view">View Set</button>
      </div>
    </div>
  `;

  const rect = anchor.getBoundingClientRect();
  const parentRect = container.getBoundingClientRect();
  const CARD_WIDTH = 240;
  const OFFSET = 12;

  let top = rect.top - parentRect.top + 16;
  let left = rect.left - parentRect.left - CARD_WIDTH / 2;
  if (left < OFFSET) left = OFFSET;
  if (left + CARD_WIDTH > parentRect.width - OFFSET)
    left = parentRect.width - CARD_WIDTH - OFFSET;

  miniCard.style.top = `${top}px`;
  miniCard.style.left = `${left}px`;
  miniCard.classList.add("show");

  miniCard.querySelector(".mini-view").onclick = () => {
    miniCard.classList.remove("show");
    openDrawer(set);
  };
}

// ================= GROUPING =================

function groupProducts(products) {
  const tops = [],
    bottoms = [],
    other = [];
  (products || []).forEach((p) => {
    const t = (p.type || "").toLowerCase().trim();
    if (t === "top" || t === "tops") tops.push(p);
    else if (t === "bottom" || t === "bottoms") bottoms.push(p);
    else other.push(p);
  });
  return { top: tops, bottom: bottoms, other };
}

// ================= STATE =================

let state = {
  items: [],
  currentSet: null,
};

function initState(set) {
  state.currentSet = set;
  state.items = [];

  const groups = groupProducts(set.products);
  const hasGroups = groups.top.length > 0 || groups.bottom.length > 0;

  if (hasGroups) {
    [
      { groupType: "top", products: groups.top },
      { groupType: "bottom", products: groups.bottom },
    ].forEach(({ groupType, products }) => {
      if (!products.length) return;
      const p = products[0];
      const firstVariant = p.variants[0];
      const color = firstVariant.title.split("/")[0].trim();
      state.items.push({
        productId: p.id,
        variantId: firstVariant.id,
        selectedColor: color,
        price: p.price,
        groupType,
      });
    });

    groups.other.forEach((p) => {
      const firstVariant = p.variants[0];
      const color = firstVariant.title.split("/")[0].trim();
      state.items.push({
        productId: p.id,
        variantId: firstVariant.id,
        selectedColor: color,
        price: p.price,
        groupType: "other",
      });
    });
  } else {
    set.products.forEach((p) => {
      const firstVariant = p.variants[0];
      const color = firstVariant.title.split("/")[0].trim();
      state.items.push({
        productId: p.id,
        variantId: firstVariant.id,
        selectedColor: color,
        price: p.price,
        groupType: "other",
      });
    });
  }
}

// ================= DRAWER OPEN/CLOSE =================

function openDrawer(set) {
  const drawer = document.getElementById("matching-drawer");
  if (!drawer) return;
  drawer.classList.add("open");
  renderDrawer(set);
}

function closeDrawer() {
  const drawer = document.getElementById("matching-drawer");
  drawer.classList.remove("open");
}

// ================= RENDER =================

function renderDrawer(set) {
  initState(set);
  renderDrawerContent();
  updateTotal();
}

function renderDrawerContent() {
  const set = state.currentSet;
  const container = document.querySelector(".drawer-content");
  const groups = groupProducts(set.products);
  const hasGroups = groups.top.length > 0 || groups.bottom.length > 0;

  let html = "";

  if (hasGroups) {
    if (groups.top.length > 0) html += renderProductGroup("top", groups.top, set);
    if (groups.bottom.length > 0) html += renderProductGroup("bottom", groups.bottom, set);
    groups.other.forEach((p) => {
      html += renderDrawerItem(p, "other", set);
    });
  } else {
    set.products.forEach((p) => {
      html += renderDrawerItem(p, "other", set);
    });
  }

  container.innerHTML = html;
  attachColorLogic();
  attachVariantLogic();
  attachSwapLogic();
  updateCTA();
}

function renderProductGroup(groupType, products, set) {
  const stateItem = state.items.find((i) => i.groupType === groupType);
  const activeId = stateItem?.productId;
  const active = products.find((p) => p.id == activeId) || products[0];
  const alternates = products.filter((p) => p.id != active.id);
  const label = groupType === "top" ? "Top" : "Bottom";

  return `
    <div class="drawer-group" data-group="${groupType}">
      <div class="drawer-group-label">${label}</div>
      ${renderDrawerItem(active, groupType, set)}
      ${alternates.length > 0 ? renderAlsoPairWith(alternates, groupType, set) : ""}
    </div>
  `;
}

function renderAlsoPairWith(products, groupType, set) {
  const stateItem = state.items.find((i) => i.groupType === groupType);
  const activeColor = stateItem?.selectedColor;

  const items = products
    .map((p) => {
      const img =
        (activeColor && p.colorImages && p.colorImages[activeColor]) ||
        p.featured_image ||
        set.image;
      return `
        <button class="also-pair-item" data-product-id="${p.id}" data-group="${groupType}">
          <div class="also-pair-img-wrap">
            <img src="${img}" alt="${p.title}" loading="lazy" />
          </div>
          <span class="also-pair-name">${p.title}</span>
        </button>
      `;
    })
    .join("");

  return `
    <div class="also-pair-with">
      <div class="also-pair-header">
        <span class="also-pair-divider"></span>
        <span class="also-pair-label">Also pair with</span>
        <span class="also-pair-divider"></span>
      </div>
      <div class="also-pair-options">${items}</div>
    </div>
  `;
}

function renderDrawerItem(p, groupType, set) {
  const stateItem = state.items.find((i) => i.productId == p.id);

  const colorMap = {};
  p.variants.forEach((v) => {
    const [color, size] = v.title.split("/").map((s) => s.trim());
    if (!colorMap[color]) colorMap[color] = [];
    colorMap[color].push({ id: v.id, size, available: v.available });
  });

  const colors = Object.keys(colorMap);
  const defaultColor = stateItem?.selectedColor || colors[0];
  const sizes = colorMap[defaultColor] || [];

  const img =
    (p.colorImages && p.colorImages[defaultColor]) ||
    p.featured_image ||
    set.image;

  return `
    <div class="drawer-item" data-product="${p.id}" data-group="${groupType || ""}">
      <img
        src="${img}"
        alt="${p.title}"
        data-product-img="${p.id}"
      />
      <div class="drawer-info">
        <div class="drawer-name">${p.title}</div>
        <div class="color-row">
          ${colors
            .map(
              (c) => `
            <button
              class="color-btn ${c === defaultColor ? "active" : ""}"
              data-color="${c}"
              data-product="${p.id}">
              ${c}
            </button>
          `,
            )
            .join("")}
        </div>
        <div class="variant-row">
          ${sizes
            .map((v, i) => {
              const isAvailable = v.available !== false;
              return `
              <button
                class="variant-btn ${i === 0 ? "active" : ""} ${!isAvailable ? "disabled" : ""}"
                data-variant="${v.id}"
                data-product="${p.id}"
                ${!isAvailable ? "disabled" : ""}>
                ${v.size}
              </button>
            `;
            })
            .join("")}
        </div>
        <div class="drawer-price">${formatPrice(p.price)}</div>
      </div>
    </div>
  `;
}

// ================= SWAP LOGIC =================

function attachSwapLogic() {
  document.querySelectorAll(".also-pair-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const productId = btn.dataset.productId;
      const groupType = btn.dataset.group;
      const set = state.currentSet;
      const newProduct = set.products.find((p) => p.id == productId);
      if (!newProduct) return;

      const firstVariant = newProduct.variants[0];
      const color = firstVariant.title.split("/")[0].trim();

      const idx = state.items.findIndex((i) => i.groupType === groupType);
      const newItem = {
        productId: newProduct.id,
        variantId: firstVariant.id,
        selectedColor: color,
        price: newProduct.price,
        groupType,
      };

      if (idx >= 0) state.items[idx] = newItem;
      else state.items.push(newItem);

      renderDrawerContent();
      updateTotal();
    });
  });
}

// ================= COLOR LOGIC =================

function attachColorLogic() {
  document.querySelectorAll(".color-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parent = btn.closest(".drawer-item");
      const productId = btn.dataset.product;
      const selectedColor = btn.dataset.color;
      const groupType = parent.dataset.group;

      // Highlight active color btn
      parent
        .querySelectorAll(".color-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const set = state.currentSet;
      const product = set.products.find((p) => p.id == productId);
      if (!product) return;

      // Update product image
      const imgEl = parent.querySelector(`[data-product-img="${productId}"]`);
      if (imgEl && product.colorImages) {
        const newImg = product.colorImages[selectedColor];
        if (newImg) imgEl.src = newImg;
      }

      // Rebuild size buttons for selected color
      const filtered = product.variants.filter(
        (v) => v.title.split("/")[0].trim() === selectedColor,
      );
      parent.querySelector(".variant-row").innerHTML = filtered
        .map((v, i) => {
          const available = v.available !== false;
          return `
            <button
              class="variant-btn ${i === 0 ? "active" : ""} ${!available ? "disabled" : ""}"
              data-variant="${v.id}"
              data-product="${productId}"
              ${!available ? "disabled" : ""}>
              ${v.title.split("/").pop().trim()}
            </button>
          `;
        })
        .join("");

      // Update state
      const stateItem = state.items.find((i) => i.productId == productId);
      const firstAvailable = filtered.find((v) => v.available !== false);
      if (stateItem) {
        stateItem.selectedColor = selectedColor;
        stateItem.variantId = firstAvailable?.id || null;
      }

      // Update "Also pair with" thumbnails in the same group to reflect color
      updateAlsoPairThumbnails(groupType, selectedColor);

      attachVariantLogic();
    });
  });
}

// Update thumbnails in the "Also pair with" strip when color changes within a group
function updateAlsoPairThumbnails(groupType, color) {
  const set = state.currentSet;
  document.querySelectorAll(`.also-pair-item[data-group="${groupType}"]`).forEach((btn) => {
    const productId = btn.dataset.productId;
    const product = set.products.find((p) => p.id == productId);
    if (!product) return;
    const img = btn.querySelector("img");
    if (img && product.colorImages?.[color]) {
      img.src = product.colorImages[color];
    }
  });
}

// ================= VARIANT LOGIC =================

function attachVariantLogic() {
  document.querySelectorAll(".variant-btn:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parent = btn.closest(".drawer-item");
      const productId = btn.dataset.product;
      const variantId = btn.dataset.variant;

      parent
        .querySelectorAll(".variant-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const item = state.items.find((i) => i.productId == productId);
      if (item) item.variantId = variantId;
    });
  });
}

// ================= CTA =================

function updateCTA() {
  const cta = document.querySelector(".drawer-cta");
  if (!cta) return;
  cta.textContent = "Add Full Look";
}

// ================= TOTAL =================

function updateTotal() {
  const totalEl = document.querySelector(".total");
  if (!totalEl) return;
  const total = state.items.reduce((sum, i) => sum + i.price, 0);
  totalEl.innerText = formatPrice(total);
}

// ================= ADD TO CART =================

async function addAllToCart() {
  const items = state.items
    .filter((i) => i.variantId)
    .map((i) => ({ id: i.variantId, quantity: 1 }));

  const cta = document.querySelector(".drawer-cta");

  try {
    if (cta) {
      cta.textContent = "Adding...";
      cta.disabled = true;
    }

    const res = await fetch("/cart/add.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ items }),
    });

    if (!res.ok) throw new Error("Cart error");

    const cartDrawer = document.querySelector("cart-drawer");
    if (cartDrawer) {
      const html = await fetch("/?section_id=cart-drawer").then((r) =>
        r.text(),
      );
      const temp = document.createElement("div");
      temp.innerHTML = html;
      const newDrawer = temp.querySelector("cart-drawer");
      if (newDrawer) cartDrawer.innerHTML = newDrawer.innerHTML;
      cartDrawer.open();
    }

    closeDrawer();
    if (cta) cta.textContent = "Added ✓";
  } catch (err) {
    console.error(err);
    if (cta) cta.textContent = "Error";
  } finally {
    setTimeout(() => {
      if (cta) {
        cta.textContent = "Add Full Look";
        cta.disabled = false;
      }
    }, 1500);
  }
}

// ================= HELPERS =================

function formatPrice(price) {
  return "₹" + (price / 100).toFixed(2);
}
