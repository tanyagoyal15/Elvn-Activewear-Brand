/* eslint-disable no-else-return */
/**
 * Size Guide
 *
 * Note: See 'shopify:section:select' in theme-editor.js for editing while selected
 * Note: See 'shopify:block:select' in theme-editor.js for tab handling on selection
 */
if (!customElements.get('size-guide')) {
  class SizeGuide extends HTMLElement {
    constructor() {
      super();

      // Select first tab
      this.querySelector('.tablist__tab')?.click();

      // Default conversions
      this.querySelectorAll('.size-guide-unit-converter__input:checked').forEach((el) => {
        const table = el.closest('.size-guide-table-container').querySelector('table');
        SizeGuide.convertTo(el.value, table);
      });

      // Set helper CSS
      this.querySelectorAll('.size-guide-table').forEach((el) => {
        const columnCount = el.querySelectorAll('tr:first-child :is(td, th)').length - 1;
        el.style.setProperty('--table-column-count', columnCount);
      });

      // Add events
      this.addEventListener('change', SizeGuide.handleChange);
    }

    /**
     * Handles 'change' events on the cart items element.
     * @param {object} evt - Event object.
     */
    static handleChange(evt) {
      if (evt.target.classList.contains('size-guide-unit-converter__input')) {
        const table = evt.target.closest('.size-guide-table-container').querySelector('table');
        SizeGuide.convertTo(evt.target.value, table);
      }
    }

    /**
     * Converts all values inside to metric or imperial.
     * @param {string} unit - Unit to convert to - 'metric' or 'imperial'.
     * @param {Element} table - Table element containing values to convert.
     */
    static convertTo(unit, table) {
      if (!table || !['metric', 'imperial'].includes(unit)) return;

      const precision = parseInt(table.dataset.precision, 10);

      // unit conversions
      const IN_TO_CM = 2.54;
      const LB_TO_KG = 0.45359237;
      const OZ_TO_G = 28.349523125;

      // regex to find single values or ranges (case-insensitive)
      const token = '("|in|cm|lb|kg|g|oz)';
      const number = '[-+]?(?:\\d+|\\d*\\.\\d+)';
      const singleRe = new RegExp(`^\\s*(${number})(\\s*)${token}\\s*$`, 'i');
      const rangeSplitRe = /\s*-\s*/;

      /**
       * Helper - Format using unary plus operator to remove trailing zeroes
       * @param {number} num - Number to format
       * @param {string} suffix - Unit to append
       * @param {string} space - Space between value and unit ('true' or 'false')
       * @returns {Array} - [Formatted number, new unit]
       */
      function formatNumber(num, suffix, space) {
        const rounded = Number(num).toFixed(precision);
        const spaceChar = space === 'true' ? ' ' : '';
        return [`${+rounded}${spaceChar}${suffix}`, suffix];
      }

      /**
       * Helper - Convert one [value, unit] to desired system
       * @param {string} numStr - Number as string
       * @param {string} fromUnit - Unit to convert from
       * @param {string} target - System to convert to
       * @param {string} space - Space between value and unit ('true' or 'false')
       * @returns {string|null} - Formatted string or null
       */
      function convertSingle(numStr, fromUnit, target, space) {
        const n = Number(numStr);
        if (!Number.isFinite(n)) return null;
        const fu = fromUnit.toLowerCase();

        // If the unit is already in the target system, return null
        if (target === 'metric' && (fu === 'cm' || fu === 'kg' || fu === 'g')) return null;
        if (target === 'imperial' && (fu === '"' || fu === 'in' || fu === 'lb' || fu === 'oz')) return null;

        // Convert
        if (fu === '"') return formatNumber(n * IN_TO_CM, 'cm', 'false'); // '1"' to '2.5cm'
        if (fu === 'in') return formatNumber(n * IN_TO_CM, 'cm', space);
        if (fu === 'cm') return formatNumber(n / IN_TO_CM, '"', 'false');
        if (fu === 'lb') return formatNumber(n * LB_TO_KG, 'kg', space);
        if (fu === 'kg') return formatNumber(n / LB_TO_KG, 'lb', space);
        if (fu === 'oz') return formatNumber(n * OZ_TO_G, 'g', space);
        if (fu === 'g') return formatNumber(n / OZ_TO_G, 'oz', space);

        return null;
      }

      // Process all table cells
      const cells = table.querySelectorAll('td, th');
      cells.forEach((cell) => {
        const text = cell.textContent.trim();
        if (!text) return;

        // If the whole cell is a single value
        const m = text.match(singleRe);
        if (m) {
          const [, num, space, u] = m;

          // Store original unit
          if (!cell.dataset.originalUnit) {
            cell.dataset.originalUnit = u;
            cell.dataset.originalContent = cell.textContent;
            cell.dataset.space = Boolean(space);
          }

          // if already in target system and canonical form (we still normalise to two decimals)
          const converted = convertSingle(num, u, unit, cell.dataset.space);

          // Always use original instead of converting back
          if (converted !== null) {
            if (converted[1] === cell.dataset.originalUnit) {
              cell.textContent = cell.dataset.originalContent;
            } else {
              cell.textContent = converted[0];
            }
          }
          return;
        }

        // If the whole cell is a hyphen-separated range like "2cm - 4cm"
        // Accept formats: "a - b", "a-b", case-insensitive units; both sides must parse
        const parts = text.split(rangeSplitRe);
        if (parts.length === 2) {
          const left = parts[0].trim();
          const right = parts[1].trim();
          const ml = left.match(singleRe);
          const mr = right.match(singleRe);
          if (ml && mr) {
            const [, nl, spaceL, ul] = ml;
            const [, nr, , ur] = mr;

            // Store original unit
            if (!cell.dataset.originalUnit) {
              cell.dataset.originalUnit = ul;
              cell.dataset.originalContent = cell.textContent;
              cell.dataset.space = Boolean(spaceL);
            }

            const convL = convertSingle(nl, ul, unit, cell.dataset.space);
            if (convL !== null && convL[1] === cell.dataset.originalUnit) {
              cell.textContent = cell.dataset.originalContent;
            } else {
              const convR = convertSingle(nr, ur, unit, cell.dataset.space);
              if (convL !== null && convR !== null) {
                cell.textContent = `${convL[0]} - ${convR[0]}`;
              }
            }
          }
        }
      });
    }
  }

  customElements.define('size-guide', SizeGuide);
}
