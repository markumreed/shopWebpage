// builder.js — the pre-battle builder screen. Owns the #builder overlay: a
// Blade/Ratchet/Bit picker, a horizontal bar-graph of the combined stats, and a
// preview of the selected blade. TO BATTLE hands the chosen build to the arena.
import { BLADES, RATCHETS, BITS } from "./parts.js";
import { combineStats, buildBars } from "./build.js";

export function mountBuilder(opts) {
  const {
    overlayEl, bladeSelEl, ratchetSelEl, bitSelEl,
    graphEl, previewEl, nameEl, battleBtnEl, closeBtnEl, onBattle,
  } = opts;

  let build = { blade: BLADES[0], ratchet: RATCHETS[0], bit: BITS[0] };

  function fillSelect(sel, arr) {
    sel.innerHTML = "";
    arr.forEach((p, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = p.name;
      sel.appendChild(o);
    });
  }

  function renderGraph() {
    const bars = buildBars(combineStats(build.blade, build.ratchet, build.bit));
    graphEl.innerHTML = "";
    bars.forEach((bar) => {
      const row = document.createElement("div"); row.className = "bar-row";
      const label = document.createElement("span"); label.className = "bar-label"; label.textContent = bar.label;
      const track = document.createElement("div"); track.className = "bar-track";
      const fill = document.createElement("div"); fill.className = "bar-fill"; fill.style.width = bar.pct + "%";
      const val = document.createElement("span"); val.className = "bar-val"; val.textContent = String(bar.value);
      track.appendChild(fill);
      row.append(label, track, val);
      graphEl.appendChild(row);
    });
  }

  function renderPreview() {
    previewEl.style.visibility = "visible";
    previewEl.src = build.blade.image;
    previewEl.alt = build.blade.name;
    previewEl.onerror = () => { previewEl.style.visibility = "hidden"; };
    nameEl.textContent = `${build.blade.name} / ${build.ratchet.name} / ${build.bit.name}`;
  }

  function render() { renderGraph(); renderPreview(); }

  function open() { overlayEl.hidden = false; render(); }
  function close() { overlayEl.hidden = true; }

  fillSelect(bladeSelEl, BLADES);
  fillSelect(ratchetSelEl, RATCHETS);
  fillSelect(bitSelEl, BITS);
  bladeSelEl.addEventListener("change", () => { build = { ...build, blade: BLADES[Number(bladeSelEl.value)] }; render(); });
  ratchetSelEl.addEventListener("change", () => { build = { ...build, ratchet: RATCHETS[Number(ratchetSelEl.value)] }; render(); });
  bitSelEl.addEventListener("change", () => { build = { ...build, bit: BITS[Number(bitSelEl.value)] }; render(); });
  battleBtnEl.addEventListener("click", () => { close(); onBattle(build); });
  closeBtnEl.addEventListener("click", close);
  render();

  return { open, close };
}
