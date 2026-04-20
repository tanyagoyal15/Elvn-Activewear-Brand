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

  // get local mini card
  const container = anchor.closest(".set-image");
  const miniCard = container.querySelector(".mini-card");

  if (!miniCard) return;

  // close others
  document.querySelectorAll(".mini-card.show").forEach((card) => {
    card.classList.remove("show");
  });

  // content
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

  // position RELATIVE TO IMAGE
  const rect = anchor.getBoundingClientRect();
  const parentRect = container.getBoundingClientRect();

  const CARD_WIDTH = 240; // match your CSS width
  const OFFSET = 12; // safe padding from edges

  // position vertically (slightly below hotspot)
  let top = rect.top - parentRect.top + 16;

  // center horizontally around hotspot
  let left = rect.left - parentRect.left - CARD_WIDTH / 2;

  // LEFT EDGE FIX
  if (left < OFFSET) {
    left = OFFSET;
  }

  // RIGHT EDGE FIX
  if (left + CARD_WIDTH > parentRect.width - OFFSET) {
    left = parentRect.width - CARD_WIDTH - OFFSET;
  }

  miniCard.style.top = `${top}px`;
  miniCard.style.left = `${left}px`;

  miniCard.classList.add("show");

  // CTA click
  miniCard.querySelector(".mini-view").onclick = () => {
    miniCard.classList.remove("show");
    openDrawer(set);
  };
}

// ================= STATE =================

let state = {
  items: [],
};

function initState(set) {
  state.items = set.products.map((p) => {
    const firstVariant = p.variants[0];
    const color = firstVariant.title.split("/")[0].trim();

    return {
      productId: p.id,
      variantId: firstVariant.id,
      selectedColor: color,
      price: p.price,
    };
  });
}

// ================= DRAWER =================

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

  const container = document.querySelector(".drawer-content");

  const html = set.products
    .map((p) => {
      const item = state.items.find((i) => i.productId == p.id);

      const colorMap = {};

      p.variants.forEach((v) => {
        const [color, size] = v.title.split("/").map((s) => s.trim());

        if (!colorMap[color]) colorMap[color] = [];
        colorMap[color].push({ id: v.id, size, available: v.available });
      });

      const colors = Object.keys(colorMap);
      const defaultColor = item?.selectedColor || colors[0];
      const sizes = colorMap[defaultColor] || [];

      return `
        <div class="drawer-item" data-product="${p.id}">

          <img src="${p.featured_image || set.image}" />

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
                .map((v) => {
                  const isAvailable = v.available !== false;

                  return `
                    <button 
                      class="variant-btn 
                      ${v.id === item.variantId ? "active" : ""} 
                      ${!isAvailable ? "disabled" : ""}"
                      data-variant="${v.id}"
                      data-product="${p.id}"
                      ${!isAvailable ? "disabled" : ""}
                    >
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
    })
    .join("");

  container.innerHTML = html;

  attachColorLogic();
  attachVariantLogic();
  updateCTA();
  updateTotal();
}

// ================= CTA =================

function updateCTA() {
  const cta = document.querySelector(".drawer-cta");
  if (!cta) return;

  cta.textContent = "Add Full Look";
}

// ================= VARIANT =================

function attachVariantLogic() {
  document.querySelectorAll(".variant-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;

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

// ================= COLOR =================

function attachColorLogic() {
  document.querySelectorAll(".color-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parent = btn.closest(".drawer-item");
      const productId = btn.dataset.product;
      const selectedColor = btn.dataset.color;

      parent
        .querySelectorAll(".color-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const product = window.MATCHING_SETS.flatMap((s) => s.products).find(
        (p) => p.id == productId,
      );

      if (!product) return;

      const filtered = product.variants.filter((v) => {
        const color = v.title.split("/")[0].trim();
        return color === selectedColor;
      });

      parent.querySelector(".variant-row").innerHTML = filtered
        .map(
          (v, i) => `
            <button 
              class="variant-btn ${i === 0 ? "active" : ""}" 
              data-variant="${v.id}"
              data-product="${productId}">
              ${v.title.split("/").pop().trim()}
            </button>
          `,
        )
        .join("");

      const item = state.items.find((i) => i.productId == productId);

      const firstAvailable = filtered.find((v) => v.available !== false);

      if (item) {
        item.selectedColor = selectedColor;
        item.variantId = firstAvailable?.id || null;
      }

      attachVariantLogic();
    });
  });
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
  const items = state.items.map((i) => ({
    id: i.variantId,
    quantity: 1,
  }));

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
