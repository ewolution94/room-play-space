import { EwoElement } from './base';
export type TickState = 'ok' | 'warn' | 'bad' | 'unknown' | 'none';
export type Tick = {
    label?: string;
    state: TickState;
    detail?: string;
};
/**
 * A row of state ticks with a readout line: Pulse's uptime bar.
 *
 * @tagname ewo-ticks
 * @attr {string} states - Space-separated states: ok, warn, bad, unknown, none.
 * @attr {string} label - Accessible name of the slider.
 * @attr {string} start - Caption at the left end while nothing is pointed at.
 * @attr {string} end - Caption at the right end.
 * @prop {Tick[]} ticks - Per-tick `{ label, state, detail }`; wins over `states`.
 * @fires ewo-tick - `detail: { index, tick }` when another tick is pointed at.
 * @cssprop [--ewo-ticks-h=32px] - Height of the ticks.
 * @csspart bar
 * @csspart caption
 */
export declare class EwoTicks extends EwoElement {
    #private;
    static styles: CSSStyleSheet[];
    static observedAttributes: string[];
    constructor();
    connectedCallback(): void;
    attributeChangedCallback(): void;
    get ticks(): Tick[];
    set ticks(list: Tick[]);
}
declare global {
    interface HTMLElementTagNameMap {
        'ewo-ticks': EwoTicks;
    }
}
