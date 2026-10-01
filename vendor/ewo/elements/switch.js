import { EwoElement as e, css as t, define as n } from "./base.js";
//#region packages/elements/src/switch.ts
var r = t`
  :host {
    display: inline-flex;
    align-items: center;
    gap: var(--ewo-space-4);
    cursor: pointer;
    user-select: none;
    color: var(--ewo-fg);
  }
  :host([row]) {
    display: flex;
    justify-content: space-between;
  }
  :host([disabled]) { cursor: default; opacity: 0.5; }
  :host(:focus-visible) { outline: none; }
  :host(:focus-visible) .track { outline: var(--ewo-focus); outline-offset: 2px; }

  .text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .text:not(.has-label) { display: none; }
  .label { font-size: var(--ewo-text-md); }
  ::slotted([slot='hint']) { font-size: 12.5px; color: var(--ewo-fg-3); line-height: 1.45; }

  .track {
    position: relative;
    flex: none;
    width: 40px;
    height: 24px;
    border-radius: var(--ewo-r-pill);
    background: var(--ewo-fill-3);
    border: 1px solid var(--ewo-line);
    transition: background-color var(--ewo-dur-2) var(--ewo-ease), border-color var(--ewo-dur-2) var(--ewo-ease);
  }
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--ewo-fg);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
    transition:
      translate 260ms var(--ewo-ease-spring),
      background-color var(--ewo-dur-2) var(--ewo-ease);
  }
  :host([checked]) .track { background: var(--ewo-invert); border-color: transparent; }
  :host([checked]) .knob { translate: 16px 0; background: var(--ewo-invert-ink); }
  :host([checked][tone='accent']) .track { background: var(--ewo-accent); }
  :host([checked][tone='accent']) .knob { background: var(--ewo-accent-ink); }
  :host(:not([disabled]):hover) .track { border-color: var(--ewo-line-strong); }
`, i = class extends e {
	static styles = [r];
	static formAssociated = !0;
	static observedAttributes = [
		"checked",
		"disabled",
		"value"
	];
	#e = this.attachInternals();
	constructor() {
		super({
			mode: "open",
			delegatesFocus: !1
		}), this.root.innerHTML = "\n      <span class=\"text\" part=\"text\">\n        <span class=\"label\" part=\"label\"><slot></slot></span>\n        <slot name=\"hint\"></slot>\n      </span>\n      <span class=\"track\" part=\"track\"><span class=\"knob\" part=\"knob\"></span></span>", this.#e.role = "switch";
		let e = this.root.querySelector(".text"), t = this.root.querySelector("slot:not([name])");
		t.addEventListener("slotchange", () => {
			let n = t.assignedNodes().some((e) => e.nodeType === 1 || e.textContent?.trim());
			e.classList.toggle("has-label", n);
		}), this.addEventListener("click", () => this.#t()), this.addEventListener("keydown", (e) => {
			(e.key === " " || e.key === "Enter") && (e.preventDefault(), this.#t());
		});
	}
	connectedCallback() {
		this.hasAttribute("tabindex") || (this.tabIndex = 0), this.#n();
	}
	attributeChangedCallback() {
		this.#n();
	}
	get checked() {
		return this.flag("checked");
	}
	set checked(e) {
		this.flag("checked", e);
	}
	get disabled() {
		return this.flag("disabled");
	}
	set disabled(e) {
		this.flag("disabled", e);
	}
	get value() {
		return this.getAttribute("value") ?? "on";
	}
	set value(e) {
		this.setAttribute("value", e);
	}
	formResetCallback() {
		this.checked = !1;
	}
	#t() {
		this.disabled || (this.checked = !this.checked, this.emit("input", { checked: this.checked }), this.emit("change", { checked: this.checked }));
	}
	#n() {
		this.#e.ariaChecked = String(this.checked), this.#e.ariaDisabled = this.disabled ? "true" : null, this.#e.setFormValue(this.checked ? this.value : null), this.disabled ? this.removeAttribute("tabindex") : !this.hasAttribute("tabindex") && this.isConnected && (this.tabIndex = 0);
	}
};
n("ewo-switch", i);
//#endregion
export { i as EwoSwitch };
