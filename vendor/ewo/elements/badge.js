import { EwoElement as e, css as t, define as n } from "./base.js";
//#region packages/elements/src/badge.ts
var r = t`
  :host {
    --_c: var(--ewo-fg-2);
    display: inline-flex;
    width: fit-content; /* don't stretch as a grid or flex-column item */
    align-items: center;
    gap: 0.5em;
    height: 1.9em;
    padding: 0 0.85em;
    border-radius: var(--ewo-r-pill);
    border: 1px solid var(--ewo-line);
    background: var(--ewo-fill);
    color: var(--_c);
    font-family: var(--ewo-mono);
    font-size: var(--ewo-text-xs);
    line-height: 1;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  :host([tone='ok'])      { --_c: var(--ewo-ok); }
  :host([tone='warn'])    { --_c: var(--ewo-warn); }
  :host([tone='bad'])     { --_c: var(--ewo-bad); }
  :host([tone='info'])    { --_c: var(--ewo-info); }
  :host([tone='unknown']) { --_c: var(--ewo-unknown); }
  :host([tone='accent'])  { --_c: var(--ewo-accent); }

  :host([variant='soft']) {
    border-color: color-mix(in oklab, var(--_c) 30%, transparent);
    background: color-mix(in oklab, var(--_c) 10%, transparent);
  }
  :host([variant='plain']) { border-color: transparent; background: none; padding: 0; }
  :host([size='sm']) { font-size: var(--ewo-text-2xs); height: 1.75em; padding: 0 0.7em; }

  .dot {
    position: relative;
    width: 0.5em;
    height: 0.5em;
    flex: none;
    border-radius: 50%;
    background: currentColor;
  }
  :host([nodot]) .dot { display: none; }
  :host([pulse]) .dot::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: currentColor;
    animation: ring 2.2s var(--ewo-ease) infinite;
  }
  @keyframes ring {
    0%   { transform: scale(1); opacity: 0.55; }
    70%  { transform: scale(2.8); opacity: 0; }
    100% { transform: scale(2.8); opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    :host([pulse]) .dot::after { animation: none; }
  }
`, i = class extends e {
	static styles = [r];
	static observedAttributes = ["live"];
	#e = this.attachInternals();
	constructor() {
		super(), this.root.innerHTML = "<span class=\"dot\" part=\"dot\"></span><slot></slot>";
	}
	attributeChangedCallback() {
		this.#e.role = this.hasAttribute("live") ? "status" : null;
	}
};
n("ewo-badge", i);
//#endregion
export { i as EwoBadge };
