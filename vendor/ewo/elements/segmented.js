import { EwoElement as e, css as t, define as n } from "./base.js";
//#region packages/elements/src/segmented.ts
var r = t`
  :host {
    --_h: 30px;
    --_font: var(--ewo-text-sm);
    --_pad: 0 12px;
    display: inline-grid;
    width: fit-content; /* only [stretch] fills the container */
    vertical-align: middle;
  }
  :host([size='sm']) {
    --_h: 24px;
    --_font: var(--ewo-text-2xs);
    --_pad: 0 10px;
  }
  :host([stretch]) { display: grid; width: auto; }
  :host([disabled]) { opacity: 0.5; pointer-events: none; }

  .track {
    position: relative;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    padding: 3px;
    border-radius: var(--ewo-r-pill);
    background: var(--ewo-fill);
    border: 1px solid var(--ewo-line);
  }
  .indicator {
    position: absolute;
    inset-block: 3px;
    left: 3px;
    width: calc((100% - 6px) / var(--n, 1));
    translate: calc(var(--i, 0) * 100%) 0;
    border-radius: var(--ewo-r-pill);
    background: var(--ewo-fill-3);
    box-shadow: var(--ewo-highlight);
    transition: translate var(--ewo-dur-3) var(--ewo-ease-spring);
  }
  :host([tone='invert']) .indicator { background: var(--ewo-invert); }
  :host([tone='accent']) .indicator { background: var(--ewo-accent); }

  button {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: var(--_h);
    padding: var(--_pad);
    border-radius: var(--ewo-r-pill);
    font-size: var(--_font);
    font-weight: 500;
    color: var(--ewo-fg-2);
    white-space: nowrap;
    transition: color var(--ewo-dur-2) var(--ewo-ease);
  }
  :host([size='sm']) button { font-family: var(--ewo-mono); font-weight: 400; }
  button:hover,
  button[aria-checked='true'] { color: var(--ewo-fg); }
  :host([tone='invert']) button[aria-checked='true'] { color: var(--ewo-invert-ink); }
  :host([tone='accent']) button[aria-checked='true'] { color: var(--ewo-accent-ink); }
  button:focus-visible { outline-offset: -2px; }
`, i = class extends e {
	static styles = [r];
	static formAssociated = !0;
	static observedAttributes = [
		"value",
		"label",
		"disabled"
	];
	#e = this.attachInternals();
	#t = null;
	#n = document.createElement("div");
	#r = new MutationObserver(() => this.#o());
	constructor() {
		super(), this.#n.className = "track", this.#n.part.add("track"), this.#n.addEventListener("click", (e) => {
			let t = e.target.closest("button");
			t && this.#i(t.value, !1);
		}), this.#n.addEventListener("keydown", (e) => this.#a(e)), this.root.append(this.#n), this.#e.role = "radiogroup";
	}
	connectedCallback() {
		this.#r.observe(this, {
			childList: !0,
			subtree: !0,
			characterData: !0,
			attributes: !0
		}), this.#o();
	}
	disconnectedCallback() {
		this.#r.disconnect();
	}
	attributeChangedCallback() {
		this.isConnected && this.#o();
	}
	get value() {
		return this.getAttribute("value") ?? this.options[0]?.value ?? "";
	}
	set value(e) {
		this.setAttribute("value", e);
	}
	get options() {
		return this.#t ? this.#t : Array.from(this.querySelectorAll("option"), (e) => ({
			value: e.value,
			label: e.textContent?.trim() ?? e.value
		}));
	}
	set options(e) {
		this.#t = e, this.#o();
	}
	get label() {
		return this.getAttribute("label") ?? "";
	}
	set label(e) {
		this.setAttribute("label", e);
	}
	get disabled() {
		return this.flag("disabled");
	}
	set disabled(e) {
		this.flag("disabled", e);
	}
	formResetCallback() {
		this.removeAttribute("value");
	}
	#i(e, t) {
		e !== this.value && (this.value = e, this.emit("input", { value: e }), this.emit("change", { value: e }), t && this.#n.querySelector("button[aria-checked='true']")?.focus());
	}
	#a(e) {
		let t = this.options, n = Math.max(0, t.findIndex((e) => e.value === this.value)), r = t.length - 1, i = e.key === "ArrowRight" || e.key === "ArrowDown" ? (n + 1) % t.length : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (n - 1 + t.length) % t.length : e.key === "Home" ? 0 : e.key === "End" ? r : -1;
		i < 0 || (e.preventDefault(), this.#i(t[i].value, !0));
	}
	#o() {
		let e = this.options, t = this.value, n = Math.max(0, e.findIndex((e) => e.value === t)), r = Array.from(this.#n.querySelectorAll("button"));
		if (!(r.length === e.length && r.every((t, n) => t.value === e[n].value))) {
			this.#n.replaceChildren();
			let t = document.createElement("span");
			t.className = "indicator", t.part.add("indicator"), this.#n.append(t);
			for (let t of e) {
				let e = document.createElement("button");
				e.type = "button", e.value = t.value, e.setAttribute("role", "radio"), e.part.add("option"), this.#n.append(e);
			}
		}
		this.#n.querySelectorAll("button").forEach((t, r) => {
			let i = r === n;
			t.textContent = e[r].label, t.setAttribute("aria-checked", String(i)), t.tabIndex = i && !this.disabled ? 0 : -1, t.part.toggle("selected", i);
		}), this.#n.style.setProperty("--n", String(Math.max(1, e.length))), this.#n.style.setProperty("--i", String(n)), this.#e.ariaLabel = this.label || null, this.#e.ariaDisabled = this.disabled ? "true" : null, this.#e.setFormValue(t);
	}
};
n("ewo-segmented", i);
//#endregion
export { i as EwoSegmented };
