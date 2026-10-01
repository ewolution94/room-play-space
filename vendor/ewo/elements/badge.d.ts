import { EwoElement } from './base';
/**
 * A status pill: a dot that can pulse, a tone, a label.
 *
 * @tagname ewo-badge
 * @attr {'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'unknown' | 'accent'} tone
 * @attr {'outline' | 'soft' | 'plain'} variant
 * @attr {'md' | 'sm'} size
 * @attr {boolean} pulse - A ring breathes out of the dot (off under reduced motion).
 * @attr {boolean} nodot - Text only.
 * @attr {boolean} live - Announce changes politely (role=status).
 * @slot - The label.
 * @csspart dot
 */
export declare class EwoBadge extends EwoElement {
    #private;
    static styles: CSSStyleSheet[];
    static observedAttributes: string[];
    constructor();
    attributeChangedCallback(): void;
}
declare global {
    interface HTMLElementTagNameMap {
        'ewo-badge': EwoBadge;
    }
}
