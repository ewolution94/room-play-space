import { EwoElement as e, css as t, define as n, reducedMotion as r } from "./base.js";
//#region packages/elements/src/toaster.ts
var i = t`
  :host {
    position: fixed;
    inset: auto 0 max(20px, env(safe-area-inset-bottom)) 0;
    width: max-content;
    max-width: calc(100vw - 32px);
    height: auto;
    margin: 0 auto;
    padding: 0;
    border: 0;
    background: none;
    overflow: visible;
    color: inherit;
    pointer-events: none;
  }
  :host([position='top']) { inset: max(20px, env(safe-area-inset-top)) 0 auto 0; }
  .stack { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  :host([position='top']) .stack { flex-direction: column-reverse; }

  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: min(440px, calc(100vw - 32px));
    padding: 10px 14px;
    border-radius: var(--ewo-r-pill);
    background: var(--ewo-fg);
    color: var(--ewo-bg);
    font-size: var(--ewo-text-md);
    font-weight: 500;
    line-height: 1.35;
    box-shadow: 0 16px 40px -12px rgb(0 0 0 / 0.5);
    pointer-events: auto;
    transition:
      opacity var(--ewo-dur-3) var(--ewo-ease),
      translate var(--ewo-dur-3) var(--ewo-ease);
  }
  @starting-style { .toast { opacity: 0; translate: 0 16px; } }
  .toast.leaving { opacity: 0; translate: 0 8px; }
  .toast:has(button) { padding-right: 8px; }
  .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--ewo-fg-3); }
  .ok .dot { background: var(--ewo-ok); }
  .bad .dot { background: var(--ewo-bad); }
  .accent .dot { background: var(--ewo-accent); }
  .msg { min-width: 0; }
  button {
    flex: none;
    padding: 4px 12px;
    border-radius: var(--ewo-r-pill);
    background: color-mix(in oklab, var(--ewo-bg) 16%, transparent);
    font-size: var(--ewo-text-sm);
    font-weight: 600;
  }
  button:hover { background: color-mix(in oklab, var(--ewo-bg) 26%, transparent); }
`, a = class extends e {
	static styles = [i];
	#e;
	constructor() {
		super(), this.root.innerHTML = "<div class=\"stack\" part=\"stack\" role=\"status\" aria-live=\"polite\"></div>", this.#e = this.root.querySelector(".stack");
	}
	connectedCallback() {
		this.setAttribute("popover", "manual");
	}
	show(e, { tone: t = "neutral", duration: n = 2800, action: i } = {}) {
		let a = document.createElement("div");
		a.className = `toast ${t}`, a.part.add("toast");
		let o = document.createElement("span");
		o.className = "dot";
		let s = document.createElement("span");
		s.className = "msg", s.textContent = e, a.append(o, s);
		let c = 0, l = () => {
			if (clearTimeout(c), !a.isConnected || a.classList.contains("leaving")) return;
			a.classList.add("leaving");
			let e = () => {
				a.remove(), !this.#e.childElementCount && this.matches(":popover-open") && this.hidePopover();
			};
			r() ? e() : (a.addEventListener("transitionend", e, { once: !0 }), setTimeout(e, 450));
		};
		if (i) {
			let e = document.createElement("button");
			e.type = "button", e.textContent = i.label, e.addEventListener("click", () => {
				i.run(), l();
			}), a.append(e);
		}
		return this.#e.append(a), this.matches(":popover-open") && this.hidePopover(), this.showPopover(), n > 0 && (c = window.setTimeout(l, n)), l;
	}
};
n("ewo-toaster", a);
function o(e, t) {
	let n = document.querySelector("ewo-toaster");
	return n || (n = document.createElement("ewo-toaster"), document.body.append(n)), n.show(e, t);
}
//#endregion
export { a as EwoToaster, o as toast };
