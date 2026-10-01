import { EwoElement as e, css as t, define as n } from "./base.js";
//#region packages/elements/src/empty.ts
var r = t`
  :host {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--ewo-space-4);
    padding: var(--ewo-space-8) var(--ewo-space-5);
    border: 1px dashed var(--ewo-line);
    border-radius: var(--ewo-r-lg);
    text-align: center;
    color: var(--ewo-fg-2);
  }
  :host([variant='solid']) {
    border-style: solid;
    background: var(--ewo-bg-raised);
    box-shadow: var(--ewo-highlight), var(--ewo-shadow);
  }
  :host([compact]) { padding: var(--ewo-space-6) var(--ewo-space-4); gap: var(--ewo-space-3); }

  .mark {
    position: relative;
    display: grid;
    place-items: center;
    color: var(--ewo-fg-2);
  }
  .mark:not(.has) { display: none; }
  :host([tone='bad']) .mark { color: var(--ewo-bad); }
  :host([tone='accent']) .mark { color: var(--ewo-accent); }
  :host([rings]) .mark::before,
  :host([rings]) .mark::after {
    content: '';
    position: absolute;
    inset: -24px;
    border: 1px solid var(--ewo-line);
    border-radius: 50%;
    opacity: 0.6;
  }
  :host([rings]) .mark::after { inset: -48px; opacity: 0.3; }
  :host([rings]) { padding-block: calc(var(--ewo-space-8) + 24px); }

  h2 {
    margin: 0;
    font-size: var(--ewo-text-lg);
    font-weight: 500;
    color: var(--ewo-fg);
    text-wrap: balance;
  }
  h2:empty { display: none; }
  .body {
    max-width: 28rem;
    font-family: var(--ewo-mono);
    font-size: var(--ewo-text-xs);
    line-height: 1.6;
    color: var(--ewo-fg-3);
    text-wrap: pretty;
  }
  :host([variant='solid']) .body { font-family: var(--ewo-sans); font-size: var(--ewo-text-md); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--ewo-space-2); justify-content: center; }
  .actions:not(.has) { display: none; }
`, i = class extends e {
	static styles = [r];
	static observedAttributes = ["heading"];
	#e;
	constructor() {
		super(), this.root.innerHTML = "\n      <div class=\"mark\" part=\"mark\"><slot name=\"mark\"></slot></div>\n      <h2 part=\"heading\"></h2>\n      <div class=\"body\" part=\"body\"><slot></slot></div>\n      <div class=\"actions\" part=\"actions\"><slot name=\"actions\"></slot></div>", this.#e = this.root.querySelector("h2");
		for (let e of ["mark", "actions"]) {
			let t = this.root.querySelector(`slot[name='${e}']`);
			t.addEventListener("slotchange", () => t.parentElement.classList.toggle("has", t.assignedElements().length > 0));
		}
	}
	attributeChangedCallback() {
		this.#e.textContent = this.getAttribute("heading") ?? "";
	}
};
n("ewo-empty", i);
//#endregion
export { i as EwoEmpty };
