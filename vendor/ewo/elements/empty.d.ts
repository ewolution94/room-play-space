import { EwoElement } from './base';
/**
 * The "nothing here yet" panel, or a centred error card.
 *
 * @tagname ewo-empty
 * @attr {string} heading
 * @attr {'dashed' | 'solid'} variant
 * @attr {'neutral' | 'bad' | 'accent'} tone - Colour of the mark.
 * @attr {boolean} rings - Harbor's orbit rings behind the mark.
 * @attr {boolean} compact
 * @slot - The body text.
 * @slot mark - An icon or a project mark.
 * @slot actions - Buttons or links.
 * @csspart mark
 * @csspart heading
 * @csspart body
 * @csspart actions
 */
export declare class EwoEmpty extends EwoElement {
    #private;
    static styles: CSSStyleSheet[];
    static observedAttributes: string[];
    constructor();
    attributeChangedCallback(): void;
}
declare global {
    interface HTMLElementTagNameMap {
        'ewo-empty': EwoEmpty;
    }
}
