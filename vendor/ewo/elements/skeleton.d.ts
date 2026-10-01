import { EwoElement } from './base';
/**
 * A placeholder block or lines of text, with a sheen.
 *
 * @tagname ewo-skeleton
 * @attr {string} width - Any CSS length (default 100%).
 * @attr {string} height - Any CSS length (default 0.875rem).
 * @attr {'none' | 'xs' | 'sm' | 'md' | 'lg' | 'pill' | 'circle'} radius
 * @attr {number} lines - Render this many text lines instead of one block.
 * @csspart block
 */
export declare class EwoSkeleton extends EwoElement {
    #private;
    static styles: CSSStyleSheet[];
    static observedAttributes: string[];
    connectedCallback(): void;
    attributeChangedCallback(): void;
}
declare global {
    interface HTMLElementTagNameMap {
        'ewo-skeleton': EwoSkeleton;
    }
}
