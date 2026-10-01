import { EwoElement as e, css as t, define as n, reducedMotion as r } from "./base.js";
//#region packages/elements/src/sheet.ts
var i = t`
  :host { display: contents; }

  dialog {
    position: fixed;
    inset: auto 0 0 0;
    width: 100%;
    max-width: 100%;
    max-height: min(92dvh, 900px);
    margin: 0;
    padding: 0;
    border: 1px solid var(--ewo-line);
    border-bottom: 0;
    border-radius: var(--ewo-r-xl) var(--ewo-r-xl) 0 0;
    background: var(--ewo-bg-raised);
    color: var(--ewo-fg);
    box-shadow: var(--ewo-highlight), 0 -30px 80px -20px rgb(0 0 0 / 0.5);
    overflow: hidden;
    translate: 0 var(--drag, 0px);
  }
  dialog[open] {
    display: flex;
    flex-direction: column;
    animation: up var(--ewo-dur-3) var(--ewo-ease);
  }
  /* The dialog takes focus itself on open (autofocus), so no control lights up. */
  dialog:focus { outline: none; }
  dialog.dragging { transition: none; }
  dialog:not(.dragging) { transition: translate var(--ewo-dur-2) var(--ewo-ease); }
  dialog.closing { animation: down 260ms var(--ewo-ease-io) forwards; }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
    backdrop-filter: blur(2px);
    animation: fade var(--ewo-dur-3) var(--ewo-ease);
  }
  dialog.closing::backdrop { animation: fade 260ms var(--ewo-ease-io) reverse forwards; }

  @media (min-width: 720px) {
    dialog {
      inset: 0;
      width: min(480px, calc(100vw - 48px));
      max-height: min(80dvh, 760px);
      margin: auto;
      border-bottom: 1px solid var(--ewo-line);
      border-radius: var(--ewo-r-xl);
      box-shadow: var(--ewo-highlight), var(--ewo-shadow);
      translate: none;
    }
    :host([wide]) dialog { width: min(720px, calc(100vw - 48px)); }
    :host([placement='top']) dialog { margin-top: 12dvh; }
    dialog[open] { animation-name: pop; }
    dialog.closing { animation-name: unpop; }
    .grip { display: none; }
  }

  @keyframes up { from { translate: 0 100%; } }
  @keyframes down { to { translate: 0 100%; } }
  @keyframes pop { from { opacity: 0; scale: 0.96; } }
  @keyframes unpop { to { opacity: 0; scale: 0.97; } }
  @keyframes fade { from { opacity: 0; } }

  .grip { display: grid; place-items: center; height: 22px; flex: none; touch-action: none; cursor: grab; }
  .grip span { width: 36px; height: 4px; border-radius: 2px; background: var(--ewo-fill-3); }

  header {
    display: flex;
    align-items: center;
    gap: var(--ewo-space-3);
    padding: var(--ewo-space-3) var(--ewo-space-5) var(--ewo-space-2);
  }
  @media (min-width: 720px) { header { padding-top: var(--ewo-space-5); } }
  .heading { flex: 1; min-width: 0; font-size: var(--ewo-text-lg); font-weight: 600; }
  .close {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--ewo-fg-2);
    background: var(--ewo-fill-2);
  }
  .close:hover { color: var(--ewo-fg); background: var(--ewo-fill-3); }
  .close svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
  .body { flex: 1; overflow: auto; overscroll-behavior: contain; padding: var(--ewo-space-2) var(--ewo-space-5) var(--ewo-space-5); }
  footer { padding: var(--ewo-space-3) var(--ewo-space-5) max(var(--ewo-space-5), env(safe-area-inset-bottom)); border-top: 1px solid var(--ewo-line-2); }
  footer:not(.has) { display: none; }
`, a = class extends e {
	static styles = [i];
	static observedAttributes = ["open", "label"];
	#e;
	#t = !1;
	#n = 0;
	#r = 0;
	constructor() {
		super(), this.root.innerHTML = "\n      <dialog part=\"dialog\" tabindex=\"-1\" autofocus>\n        <div class=\"grip\" part=\"grip\" aria-hidden=\"true\"><span></span></div>\n        <header part=\"header\">\n          <div class=\"heading\"><slot name=\"heading\"></slot></div>\n          <button class=\"close\" part=\"close\" type=\"button\" aria-label=\"Close\">\n            <svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><path d=\"M4 4l8 8M12 4l-8 8\"/></svg>\n          </button>\n        </header>\n        <div class=\"body\" part=\"body\"><slot></slot></div>\n        <footer part=\"footer\"><slot name=\"footer\"></slot></footer>\n      </dialog>";
		let e = this.#e = this.root.querySelector("dialog");
		e.addEventListener("cancel", (e) => {
			e.preventDefault(), this.#i();
		}), e.addEventListener("click", (t) => {
			t.target === e && this.#i();
		}), e.addEventListener("animationend", (t) => {
			this.#t && t.target === e && this.#o();
		}), this.root.querySelector(".close").addEventListener("click", () => this.#i());
		let t = this.root.querySelector("footer"), n = t.querySelector("slot");
		n.addEventListener("slotchange", () => t.classList.toggle("has", n.assignedElements().length > 0));
		let r = this.root.querySelector(".grip");
		r.addEventListener("pointerdown", (t) => {
			t.pointerType !== "mouse" && (this.#n = t.clientY, e.classList.add("dragging"), r.setPointerCapture(t.pointerId));
		}), r.addEventListener("pointermove", (t) => {
			e.classList.contains("dragging") && (this.#r = Math.max(0, t.clientY - this.#n), e.style.setProperty("--drag", `${this.#r}px`));
		});
		let i = () => {
			e.classList.contains("dragging") && (e.classList.remove("dragging"), this.#r > 90 ? this.#i() : e.style.setProperty("--drag", "0px"), this.#r = 0);
		};
		r.addEventListener("pointerup", i), r.addEventListener("pointercancel", i);
	}
	connectedCallback() {
		this.#a();
	}
	attributeChangedCallback(e) {
		e === "label" ? this.#e.setAttribute("aria-label", this.getAttribute("label") ?? "") : this.isConnected && this.#a();
	}
	get open() {
		return this.flag("open");
	}
	set open(e) {
		this.flag("open", e);
	}
	show() {
		this.open = !0;
	}
	close() {
		this.open = !1;
	}
	#i() {
		this.emit("cancel", void 0, !0) && this.close();
	}
	#a() {
		let e = this.#e;
		if (this.open && !e.open) this.#t = !1, e.classList.remove("closing"), e.style.setProperty("--drag", "0px"), e.showModal();
		else if (!this.open && e.open && !this.#t) {
			if (r()) return this.#o();
			this.#t = !0, e.classList.add("closing"), setTimeout(() => this.#t && this.#o(), 450);
		}
	}
	#o() {
		this.#t = !1, this.#e.classList.remove("closing"), this.#e.open && this.#e.close(), this.emit("close");
	}
};
n("ewo-sheet", a);
//#endregion
export { a as EwoSheet };
