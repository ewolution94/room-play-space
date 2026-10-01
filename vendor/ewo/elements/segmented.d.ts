import { EwoElement } from './base';
export type SegmentedOption = {
    value: string;
    label: string;
};
/**
 * A pill radio group with one sliding indicator.
 *
 * @tagname ewo-segmented
 * @attr {string} value - The chosen option's value (defaults to the first).
 * @attr {string} label - Accessible name of the group.
 * @attr {string} name - Form field name.
 * @attr {'md' | 'sm'} size - `sm` is the mono pill of the landing's EN/DE switch.
 * @attr {'neutral' | 'invert' | 'accent'} tone - Colour of the indicator.
 * @attr {boolean} stretch - Fill the container's width.
 * @attr {boolean} disabled
 * @slot - `<option value>` elements, one per choice.
 * @fires change - `detail: { value }` after the user picks another option.
 * @fires input - Same, fired first.
 * @csspart track - The pill.
 * @csspart indicator - The sliding highlight.
 * @csspart option - Each choice; the chosen one also has `selected`.
 */
export declare class EwoSegmented extends EwoElement {
    #private;
    static styles: CSSStyleSheet[];
    static formAssociated: boolean;
    static observedAttributes: string[];
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(): void;
    get value(): string;
    set value(v: string);
    /** The choices. Set it from JS, or leave it and write <option> children. */
    get options(): SegmentedOption[];
    set options(list: SegmentedOption[]);
    get label(): string;
    set label(v: string);
    get disabled(): boolean;
    set disabled(v: boolean);
    formResetCallback(): void;
}
declare global {
    interface HTMLElementTagNameMap {
        'ewo-segmented': EwoSegmented;
    }
}
