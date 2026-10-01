import { EwoElement } from './base';
/**
 * A switch, optionally as a settings row with a label and a hint.
 *
 * @tagname ewo-switch
 * @attr {boolean} checked
 * @attr {boolean} disabled
 * @attr {boolean} row - Label left, switch right, across the full width.
 * @attr {'neutral' | 'accent'} tone - Colour of the track when on.
 * @attr {string} name - Form field name.
 * @attr {string} value - Submitted when on (default `on`).
 * @slot - The label.
 * @slot hint - A second, quieter line under the label.
 * @fires change - `detail: { checked }` after the user toggles it.
 * @fires input - Same, fired first.
 * @csspart track
 * @csspart knob
 * @csspart label
 */
export declare class EwoSwitch extends EwoElement {
    #private;
    static styles: CSSStyleSheet[];
    static formAssociated: boolean;
    static observedAttributes: string[];
    constructor();
    connectedCallback(): void;
    attributeChangedCallback(): void;
    get checked(): boolean;
    set checked(v: boolean);
    get disabled(): boolean;
    set disabled(v: boolean);
    get value(): string;
    set value(v: string);
    formResetCallback(): void;
}
declare global {
    interface HTMLElementTagNameMap {
        'ewo-switch': EwoSwitch;
    }
}
