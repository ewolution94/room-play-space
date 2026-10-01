import { EwoElement as e, css as t, define as n } from "./base.js";
//#region packages/elements/src/skeleton.ts
var r = t`
  :host {
    --_w: 100%;
    --_h: 0.875rem;
    --_r: var(--ewo-r-xs);
    display: block;
    width: var(--_w);
  }
  .block, .line {
    height: var(--_h);
    border-radius: var(--_r);
    background:
      linear-gradient(100deg, transparent 20%, var(--ewo-fill-2) 50%, transparent 80%) 0 0 / 200% 100%,
      var(--ewo-fill-2);
    animation: sheen 1.6s linear infinite;
  }
  .lines { display: grid; gap: 0.6em; }
  .line:last-child:not(:first-child) { width: 62%; }
  @keyframes sheen { from { background-position: 150% 0, 0 0; } to { background-position: -50% 0, 0 0; } }
  @media (prefers-reduced-motion: reduce) {
    .block, .line { animation: none; }
  }
`, i = {
	none: "0",
	xs: "var(--ewo-r-xs)",
	sm: "var(--ewo-r-sm)",
	md: "var(--ewo-r-md)",
	lg: "var(--ewo-r-lg)",
	pill: "var(--ewo-r-pill)",
	circle: "50%"
}, a = class extends e {
	static styles = [r];
	static observedAttributes = [
		"width",
		"height",
		"radius",
		"lines"
	];
	connectedCallback() {
		this.setAttribute("aria-hidden", "true"), this.#e();
	}
	attributeChangedCallback() {
		this.#e();
	}
	#e() {
		let e = this.getAttribute("width"), t = this.getAttribute("height"), n = this.getAttribute("radius");
		e && this.style.setProperty("--_w", e), t && this.style.setProperty("--_h", t), n && this.style.setProperty("--_r", i[n] ?? n);
		let r = Number(this.getAttribute("lines") ?? 0);
		if (r > 0) {
			let e = document.createElement("div");
			e.className = "lines";
			for (let t = 0; t < r; t++) {
				let t = document.createElement("div");
				t.className = "line", e.append(t);
			}
			this.root.replaceChildren(e);
		} else if (!this.root.querySelector(".block")) {
			let e = document.createElement("div");
			e.className = "block", e.part.add("block"), this.root.replaceChildren(e);
		}
	}
};
n("ewo-skeleton", a);
//#endregion
export { a as EwoSkeleton };
