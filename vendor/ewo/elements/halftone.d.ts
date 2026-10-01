import { EwoElement } from './base';
/**
 * An image redrawn as halftone dots in the page's ink.
 *
 * @tagname ewo-halftone
 * @attr {string} src
 * @attr {string} alt
 * @attr {number} cell - Dot pitch in CSS px (default 4.6, the portrait's).
 * @attr {'ink' | 'photo'} color - `photo` keeps some of the image's colour.
 * @attr {'cover' | 'contain'} fit
 * @attr {boolean} lens - Dots swell and part under the pointer.
 * @attr {boolean} ripple - Entrance ripple from `origin`.
 * @attr {string} origin - Ripple origin as "u v" fractions (default "0.5 0.4").
 * @fires load
 * @fires error
 * @cssprop [--ewo-halftone-ratio=4 / 3] - Aspect ratio of the box.
 */
export declare class EwoHalftone extends EwoElement {
    #private;
    static styles: CSSStyleSheet[];
    static observedAttributes: string[];
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string): void;
    /** Replays the entrance ripple. */
    replay(): void;
}
declare global {
    interface HTMLElementTagNameMap {
        'ewo-halftone': EwoHalftone;
    }
}
