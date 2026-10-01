import { EwoElement } from './base';
export type ThemeChoice = 'system' | 'light' | 'dark';
/** The stored choice, or 'system'. */
export declare function storedTheme(): ThemeChoice;
/** Applies a choice to the page, stores it and syncs theme-color. */
export declare function setTheme(choice: ThemeChoice): void;
/** What the pre-paint script in <head> does (inline it as a classic script). */
export declare function restoreTheme(): void;
/**
 * The sun/moon button, on the `ewo:theme` contract.
 *
 * @tagname ewo-theme-toggle
 * @attr {boolean} cycle - system → light → dark instead of light ↔ dark.
 * @attr {string} label-light - Accessible label for "switch to light".
 * @attr {string} label-dark - Accessible label for "switch to dark".
 * @fires change - `detail: { theme }` after a click.
 * @cssprop [--ewo-theme-toggle-size=36px]
 * @csspart button
 */
export declare class EwoThemeToggle extends EwoElement {
    #private;
    static styles: CSSStyleSheet[];
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
}
declare global {
    interface HTMLElementTagNameMap {
        'ewo-theme-toggle': EwoThemeToggle;
    }
}
