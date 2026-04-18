document.addEventListener("DOMContentLoaded", () => {
  // ---------------- HOTSPOT CLICK ----------------
  document.querySelectorAll(".hotspot").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // prevents instant close

      const setId = btn.dataset.set;
      const type = btn.dataset.type;

      const set = window.MATCHING_SETS[setId - 1];

      if (!set) return;

      showMiniCard(set, type, btn);
    });
  });

  // ---------------- OPEN DRAWER CTA ----------------
  document.querySelectorAll(".open-drawer").forEach((btn) => {
    btn.addEventListener("click", () => {
      const setId = btn.dataset.set;
      const set = window.MATCHING_SETS[setId - 1];

      if (!set) return;

      openDrawer(set);
    });
  });

  // ---------------- OUTSIDE CLICK CLOSE ----------------
  document.addEventListener("click", (e) => {
    const card = document.getElementById("matching-mini-card");

    if (!card) return;

    if (!e.target.closest(".mini-card")) {
      card.classList.remove("show");
    }
  });

  const drawer = document.getElementById("matching-drawer");

  if (drawer) {
    const closeBtn = drawer.querySelector(".drawer-close");
    const overlay = drawer.querySelector(".drawer-overlay");

    if (closeBtn) closeBtn.onclick = closeDrawer;
    if (overlay) overlay.onclick = closeDrawer;
  }

  if (drawer) {
    drawer.addEventListener("click", (e) => {
      const btn = e.target.closest(".variant-btn");
      if (!btn) return;

      // remove active from siblings
      btn.parentElement
        .querySelectorAll(".variant-btn")
        .forEach((b) => b.classList.remove("active"));

      // set active
      btn.classList.add("active");

      // OPTIONAL (IMPORTANT): update state
      const variantId = btn.dataset.variant;
      const productId = btn.closest(".drawer-item").dataset.product;

      const item = state.items.find((i) => i.productId == productId);
      if (item) {
        item.variantId = variantId;
      }
    });
  }

  if (drawer) {
    const cta = drawer.querySelector(".drawer-cta");

    if (cta) {
      cta.addEventListener("click", addAllToCart);
    }
  }
});

// ================= MINI CARD =================

function showMiniCard(set, type, anchor) {
  const product =
    type === "top" ? set.products[0] : set.products[1] || set.products[0];

  const miniCard = document.getElementById("matching-mini-card");

  if (!product || !miniCard) return;

  // ---------------- RENDER HTML ----------------
  miniCard.innerHTML = `
      <div class="row">
        <img src="${product.featured_image || set.image}" />
        <div>
          <div style="font-size:13px;">${product.title}</div>
          <div style="font-size:12px; opacity:0.7;">
            ${formatPrice(product.price)}
          </div>
        </div>
      </div>
  
      <div class="actions">
        <button class="mini-add">Add</button>
        <button class="mini-view">View Set</button>
      </div>
    `;

  // ---------------- POSITIONING ----------------
  const rect = anchor.getBoundingClientRect();

  const cardWidth = 220;
  const offsetY = 90;

  let left = rect.left - cardWidth / 2;

  // prevent overflow right
  if (left + cardWidth > window.innerWidth - 10) {
    left = window.innerWidth - cardWidth - 10;
  }

  // prevent overflow left
  if (left < 10) {
    left = 10;
  }

  miniCard.style.top = rect.top - offsetY + "px";
  miniCard.style.left = left + "px";

  // ---------------- ANIMATION TRIGGER ----------------
  miniCard.classList.remove("show");

  requestAnimationFrame(() => {
    miniCard.classList.add("show");
  });

  // ---------------- ACTIONS ----------------
  miniCard.querySelector(".mini-add").onclick = () => {
    miniCard.classList.remove("show");
    openDrawer(set);
  };

  miniCard.querySelector(".mini-view").onclick = () => {
    miniCard.classList.remove("show");
    openDrawer(set);
  };
}

// ================= DRAWER =================

let state = {
  items: [],
};

function initState(set) {
  state.items = set.products.map((p) => ({
    productId: p.id,
    variantId: p.variants[0].id,
    price: p.price,
    selected: true,
  }));
}

function openDrawer(set) {
  console.log("OPEN DRAWER", set);
  const drawer = document.getElementById("matching-drawer");
  console.log("DRAWER: ", drawer);

  if (!drawer) return;

  drawer.classList.add("open");

  renderDrawer(set);
}

function closeDrawer() {
  const drawer = document.getElementById("matching-drawer");
  drawer.classList.remove("open");
}

//all color  + sizes
// function renderDrawer(set) {
//   initState(set);

//   const container = document.querySelector(".drawer-content");

//   const html = set.products
//     .map(
//       (p) => `
//           <div class="drawer-item">

//             <img src="${p.featured_image || set.image}" />

//             <div class="drawer-info">

//               <div class="drawer-name">${p.title}</div>

//               <div class="variant-row">
//                 ${p.variants
//                   .map(
//                     (v, i) => `
//                       <button
//                         class="variant-btn ${i === 0 ? "active" : ""}"
//                         data-variant="${v.id}">
//                         ${v.title}
//                       </button>
//                     `,
//                   )
//                   .join("")}
//               </div>

//               <div class="drawer-price">${formatPrice(p.price)}</div>

//             </div>

//           </div>
//         `,
//     )
//     .join("");

//   container.innerHTML = html;

//   updateTotal();
// }

//matching set color and its all sizes (not color specific sizes)
// function renderDrawer(set) {
//   initState(set);

//   const container = document.querySelector(".drawer-content");

//   const html = set.products
//     .map((p) => {
//       // extract color from first variant
//       const firstVariant = p.variants[0];
//       const color = firstVariant.title.split("/")[0].trim();

//       return `
//         <div class="drawer-item" data-product="${p.id}">

//           <img src="${p.featured_image || set.image}" />

//           <div class="drawer-info">

//             <div class="drawer-name">${p.title}</div>

//             <!--  COLOR -->
//             <div class="drawer-color">${color}</div>

//             <!-- SIZES -->
//             <div class="variant-row">
//               ${p.variants
//                 .map((v, i) => {
//                   const parts = v.title.split("/");
//                   const size = parts[parts.length - 1].trim();

//                   return `
//                     <button
//                       class="variant-btn ${i === 0 ? "active" : ""}"
//                       data-variant="${v.id}">
//                       ${size}
//                     </button>
//                   `;
//                 })
//                 .join("")}
//             </div>

//             <div class="drawer-price">${formatPrice(p.price)}</div>

//           </div>

//         </div>
//       `;
//     })
//     .join("");

//   container.innerHTML = html;

//   updateTotal();
// }

// color specific + size specific of that color
function renderDrawer(set) {
  initState(set);

  const container = document.querySelector(".drawer-content");

  const html = set.products
    .map((p) => {
      // get color from first variant
      const firstVariant = p.variants[0];
      const color = firstVariant.title.split("/")[0].trim().toLowerCase();

      // FILTER variants by this color
      const filteredVariants = p.variants.filter((v) => {
        const vColor = v.title.split("/")[0].trim().toLowerCase();
        return vColor === color;
      });

      return `
        <div class="drawer-item" data-product="${p.id}">

          <img src="${p.featured_image || set.image}" />

          <div class="drawer-info">

            <div class="drawer-name">${p.title}</div>

            <!-- COLOR -->
            <div class="drawer-color">${firstVariant.title.split("/")[0].trim()}</div>

            <!-- SIZES (ONLY FILTERED) -->
            <div class="variant-row">
              ${filteredVariants
                .map((v, i) => {
                  const parts = v.title.split("/");
                  const size = parts[parts.length - 1].trim();

                  return `
                    <button 
                      class="variant-btn ${i === 0 ? "active" : ""}" 
                      data-variant="${v.id}">
                      ${size}
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

  updateTotal();
}

// ================= TOTAL =================

function updateTotal() {
  const totalEl = document.querySelector(".total");
  if (!totalEl) return;

  const total = state.items
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + i.price, 0);

  totalEl.innerText = formatPrice(total);
}

// ================= ADD TO CART =================

// function addAllToCart() {
//   const items = state.items
//     .filter((i) => i.selected)
//     .map((i) => ({
//       id: i.variantId,
//       quantity: 1,
//     }));

//   console.log("CART ITEMS: ", items);

//   // enable when ready
//   fetch("/cart/add.js", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ items }),
//   });
// }

async function addAllToCart() {
  const items = state.items
    .filter((i) => i.selected)
    .map((i) => ({
      id: i.variantId,
      quantity: 1,
    }));

  console.log("CART ITEMS:", items);

  if (!items.length) return;

  const cta = document.querySelector(".drawer-cta");

  try {
    // loading state
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

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.description || "Could not add to cart");
    }

    const data = await res.json();
    console.log("Added to cart:", data);

    // update cart count (reuse your existing function)
    if (typeof updateCartCount === "function") {
      await updateCartCount();
    }

    // update cart drawer (same as your quick add)
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

      cartDrawer.open();
    }

    // close matching drawer
    closeDrawer();

    // success feedback
    if (cta) {
      cta.textContent = "Added ✓";
    }
  } catch (err) {
    console.error("Cart error:", err);

    if (cta) {
      cta.textContent = "Error";
    }
  } finally {
    if (cta) {
      setTimeout(() => {
        cta.textContent = "Add full look";
        cta.disabled = false;
      }, 1500);
    }
  }
}

// ================= HELPERS =================

function formatPrice(price) {
  return "₹" + (price / 100).toFixed(2);
}
