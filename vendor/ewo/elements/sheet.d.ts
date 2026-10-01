import { EwoElement } from './base';
/**
 * A modal: a bottom sheet on phones, a centred card from 720px.
 *
 * @tagname ewo-sheet
 * @attr {boolean} open
 * @attr {string} label - Accessible name of the dialog.
 * @attr {boolean} wide - 720px instead of 480px on desktop.
 * @attr {'center' | 'top'} placement - `top` anchors it high (a search palette).
 * @slot - The content (scrolls).
 * @slot heading
 * @slot footer
 * @fires cancel - Cancelable: Escape, backdrop, close button or drag asked to close.
 * @fires close - After it has closed.
 * @csspart dialog
 * @csspart header
 * @csspart body
 * @csspart footer
 * @csspart close
 * @csspart grip
 */
export declare class EwoSheet extends EwoElement {
    #private;
    static styles: CSSStyleSheet[];
    static observedAttributes: string[];
    constructor();
    connectedCallback(): void;
    attributeChangedCallback(name: string): void;
    get open(): boolean;
    set open(v: boolean);
    show(): void;
    close(): void;
}
declare global {
    interface HTMLElementTagNameMap {
        'ewo-sheet': EwoSheet;
    }
}
