import { EwoElement as e, css as t, define as n, effectiveTheme as r, onThemeChange as i } from "./base.js";
//#region packages/elements/src/theme-toggle.ts
var a = "ewo:theme", o = t`
  :host { display: inline-grid; }
  button {
    display: grid;
    place-items: center;
    width: var(--ewo-theme-toggle-size, 36px);
    aspect-ratio: 1;
    border-radius: 50%;
    color: var(--ewo-fg-2);
    transition: color var(--ewo-dur-2) var(--ewo-ease), background-color var(--ewo-dur-2) var(--ewo-ease);
  }
  button:hover { color: var(--ewo-fg); background: var(--ewo-fill-2); }
  svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; overflow: visible; }
  .sun, .moon { transition: opacity var(--ewo-dur-3) var(--ewo-ease), rotate var(--ewo-dur-3) var(--ewo-ease-spring), scale var(--ewo-dur-3) var(--ewo-ease-spring); transform-origin: 8px 8px; }
  :host([data-shows='light']) .moon, :host([data-shows='dark']) .sun { opacity: 0; rotate: -45deg; scale: 0.6; }
  .auto { opacity: 0; transition: opacity var(--ewo-dur-2) var(--ewo-ease); }
  :host([data-pinned='false'][cycle]) .auto { opacity: 1; }
`, s = "\n  <svg viewBox=\"0 0 16 16\" aria-hidden=\"true\">\n    <g class=\"sun\"><circle cx=\"8\" cy=\"8\" r=\"3\"/><path d=\"M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1\"/></g>\n    <g class=\"moon\"><path d=\"M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1Z\"/></g>\n    <circle class=\"auto\" cx=\"14\" cy=\"2\" r=\"1.3\" fill=\"currentColor\" stroke=\"none\"/>\n  </svg>";
function c() {
	try {
		let e = localStorage.getItem(a);
		if (e === "light" || e === "dark") return e;
	} catch {}
	return "system";
}
function l(e) {
	let t = document.documentElement;
	e === "system" ? delete t.dataset.theme : t.dataset.theme = e;
	try {
		e === "system" ? localStorage.removeItem(a) : localStorage.setItem(a, e);
	} catch {}
	let n = getComputedStyle(t).getPropertyValue("--ewo-bg").trim();
	if (n) for (let e of document.querySelectorAll("meta[name=\"theme-color\"]")) e.content = n;
	window.dispatchEvent(new CustomEvent("ewo-theme", { detail: {
		choice: e,
		theme: r()
	} }));
}
function u() {
	let e = c();
	e !== "system" && (document.documentElement.dataset.theme = e);
}
var d = class extends e {
	static styles = [o];
	#e;
	#t = null;
	constructor() {
		super(), this.root.innerHTML = `<button type="button" part="button">${s}</button>`, this.#e = this.root.querySelector("button"), this.#e.addEventListener("click", () => this.#r());
	}
	connectedCallback() {
		this.#t = i(() => this.#i()), window.addEventListener("storage", this.#n), this.#i();
	}
	disconnectedCallback() {
		this.#t?.(), window.removeEventListener("storage", this.#n);
	}
	#n = (e) => {
		e.key === a && l(c());
	};
	#r() {
		let e = document.documentElement.dataset.theme;
		if (this.hasAttribute("cycle")) {
			let t = [
				"system",
				"light",
				"dark"
			];
			l(t[(t.indexOf(e ?? "system") + 1) % t.length]);
		} else l(r() === "dark" ? "light" : "dark");
		this.emit("change", { theme: r() });
	}
	#i() {
		let e = r(), t = document.documentElement.dataset.theme;
		this.dataset.shows = e === "dark" ? "light" : "dark", this.dataset.pinned = String(t === "light" || t === "dark");
		let n = this.getAttribute(e === "dark" ? "label-light" : "label-dark") ?? (e === "dark" ? "Switch to light theme" : "Switch to dark theme");
		this.#e.setAttribute("aria-label", n), this.#e.title = n;
	}
};
n("ewo-theme-toggle", d);
//#endregion
export { d as EwoThemeToggle, u as restoreTheme, l as setTheme, c as storedTheme };
