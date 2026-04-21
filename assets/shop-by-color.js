document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".cc-shop-by-color").forEach(initShopByColor);
});

function initShopByColor(section) {
  const btns   = section.querySelectorAll(".shop-by-color__color-btn");
  const panels = section.querySelectorAll(".shop-by-color__panel");

  if (!btns.length) return;

  function activate(index) {
    btns.forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.color === index ? "true" : "false");
    });
    panels.forEach((panel) => {
      const isThis = panel.dataset.colorPanel === index;
      panel.classList.toggle("is-visible", isThis);
      panel.setAttribute("aria-hidden", isThis ? "false" : "true");
    });
  }

  btns.forEach((btn) => {
    btn.addEventListener("click", () => activate(btn.dataset.color));
  });

  activate(btns[0].dataset.color);
}
