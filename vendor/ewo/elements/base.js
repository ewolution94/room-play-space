//#region packages/elements/src/base.ts
function e(e, ...t) {
	let n = new CSSStyleSheet();
	return n.replaceSync(String.raw({ raw: e }, ...t)), n;
}
var t = e`
  :host {
    box-sizing: border-box;
    font-family: var(--ewo-sans);
    -webkit-tap-highlight-color: transparent;
  }
  :host([hidden]) { display: none !important; }
  *, *::before, *::after { box-sizing: inherit; }
  :focus-visible { outline: var(--ewo-focus); outline-offset: 2px; }
  button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; }
`, n = class extends HTMLElement {
	static styles = [];
	root;
	constructor(e = { mode: "open" }) {
		super(), this.root = this.attachShadow(e), this.root.adoptedStyleSheets = [t, ...this.constructor.styles];
	}
	flag(e, t) {
		return t !== void 0 && this.toggleAttribute(e, t), this.hasAttribute(e);
	}
	emit(e, t, n = !1) {
		return this.dispatchEvent(new CustomEvent(e, {
			detail: t,
			bubbles: !0,
			composed: !0,
			cancelable: n
		}));
	}
};
function r(e, t) {
	customElements.get(e) || customElements.define(e, t);
}
var i = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function a() {
	let e = document.documentElement.dataset.theme;
	return e === "light" || e === "dark" ? e : matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function o(e) {
	let t = matchMedia("(prefers-color-scheme: light)"), n = new MutationObserver(e);
	return n.observe(document.documentElement, {
		attributes: !0,
		attributeFilter: ["data-theme"]
	}), t.addEventListener("change", e), () => {
		n.disconnect(), t.removeEventListener("change", e);
	};
}
//#endregion
export { n as EwoElement, e as css, r as define, a as effectiveTheme, t as hostBase, o as onThemeChange, i as reducedMotion };
