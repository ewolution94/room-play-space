import { EwoElement as e, css as t, define as n } from "./base.js";
//#region packages/elements/src/ticks.ts
var r = t`
  :host {
    display: flex;
    flex-direction: column;
    gap: 6px;
    --ewo-ticks-h: 32px;
  }
  .bar {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    border-radius: 3px;
    touch-action: pan-y;
    outline-offset: 4px;
  }
  @media (max-width: 640px) { .bar { gap: 1px; } }
  i {
    flex: 1;
    min-width: 0;
    max-width: 7px;
    height: var(--ewo-ticks-h);
    border-radius: 1.5px;
    background: var(--ewo-fg-4);
    opacity: 0.9;
    transition: transform 150ms var(--ewo-ease), opacity 150ms var(--ewo-ease);
  }
  i[data-s='ok']      { background: var(--ewo-ok); }
  i[data-s='warn']    { background: var(--ewo-warn); }
  i[data-s='bad']     { background: var(--ewo-bad); }
  i[data-s='unknown'] { background: var(--ewo-unknown); opacity: 0.35; }
  i[data-s='none']    { background: var(--ewo-fg-4); opacity: 0.2; }
  .bar.active i { opacity: 0.45; }
  .bar.active i[data-s='none'] { opacity: 0.1; }
  .bar.active i.on { opacity: 1; transform: scaleY(1.14); }

  .caption {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-family: var(--ewo-mono);
    font-size: 10px;
    color: var(--ewo-fg-3);
    font-variant-numeric: tabular-nums;
  }
  .caption .a { white-space: nowrap; }
  .caption .b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar.active + .caption .a { color: var(--ewo-fg-2); }
`, i = class extends e {
	static styles = [r];
	static observedAttributes = [
		"states",
		"label",
		"start",
		"end"
	];
	#e = null;
	#t = null;
	#n;
	#r;
	#i;
	constructor() {
		super(), this.root.innerHTML = "\n      <div class=\"bar\" part=\"bar\" role=\"slider\" tabindex=\"0\" aria-valuemin=\"1\"></div>\n      <div class=\"caption\" part=\"caption\" aria-hidden=\"true\"><span class=\"a\"></span><span class=\"b\"></span></div>", this.#n = this.root.querySelector(".bar"), this.#r = this.root.querySelector(".a"), this.#i = this.root.querySelector(".b");
		let e = (e) => {
			let t = this.#n.getBoundingClientRect(), n = Math.min(Math.max(e.clientX - t.left, 0), t.width - 1);
			return Math.floor(n / t.width * this.ticks.length);
		};
		this.#n.addEventListener("pointerdown", (t) => this.#a(e(t))), this.#n.addEventListener("pointermove", (t) => {
			(t.pointerType === "mouse" || t.buttons) && this.#a(e(t));
		}), this.#n.addEventListener("pointerleave", (e) => {
			e.pointerType === "mouse" && this.#a(null);
		}), this.#n.addEventListener("focus", () => {
			this.#n.matches(":focus-visible") && this.#a(this.ticks.length - 1);
		}), this.#n.addEventListener("blur", () => this.#a(null)), this.#n.addEventListener("keydown", (e) => {
			let t = this.ticks.length - 1, n = this.#t ?? t, r = e.key === "ArrowLeft" ? Math.max(0, n - 1) : e.key === "ArrowRight" ? Math.min(t, n + 1) : e.key === "Home" ? 0 : e.key === "End" ? t : void 0;
			e.key === "Escape" && this.#a(null), r !== void 0 && (e.preventDefault(), this.#a(r));
		});
	}
	connectedCallback() {
		this.#o();
	}
	attributeChangedCallback() {
		this.isConnected && this.#o();
	}
	get ticks() {
		return this.#e ? this.#e : (this.getAttribute("states") ?? "").split(/\s+/).filter(Boolean).map((e) => ({ state: e }));
	}
	set ticks(e) {
		this.#e = e, this.#t = null, this.isConnected && this.#o();
	}
	#a(e) {
		e !== this.#t && (this.#t = e, this.#s(), e !== null && this.emit("ewo-tick", {
			index: e,
			tick: this.ticks[e]
		}));
	}
	#o() {
		let e = this.ticks, t = this.#n.children;
		for (; t.length > e.length;) t[t.length - 1].remove();
		for (; t.length < e.length;) this.#n.append(document.createElement("i"));
		e.forEach((e, n) => {
			t[n].dataset.s = e.state;
		}), this.#n.setAttribute("aria-label", this.getAttribute("label") ?? ""), this.#n.setAttribute("aria-valuemax", String(e.length)), this.#s();
	}
	#s() {
		let e = this.ticks, t = this.#t;
		this.#n.classList.toggle("active", t !== null), Array.from(this.#n.children).forEach((e, n) => e.classList.toggle("on", n === t));
		let n = t === null ? null : e[t], r = n?.label ?? (t === null ? "" : `#${t + 1}`);
		this.#r.textContent = n ? r : this.getAttribute("start") ?? "", this.#i.textContent = n ? n.detail ?? n.state : this.getAttribute("end") ?? "", this.#n.setAttribute("aria-valuenow", String((t ?? e.length - 1) + 1)), this.#n.setAttribute("aria-valuetext", n ? `${r}: ${n.detail ?? n.state}` : this.getAttribute("end") ?? "");
	}
};
n("ewo-ticks", i);
//#endregion
export { i as EwoTicks };
