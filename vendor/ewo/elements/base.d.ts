/** Tagged template → a shared, CSP-safe stylesheet. */
export declare function css(strings: TemplateStringsArray, ...values: unknown[]): CSSStyleSheet;
/** Every element starts from this: sizing, font and the focus ring. */
export declare const hostBase: CSSStyleSheet;
export declare abstract class EwoElement extends HTMLElement {
    /** Sheets adopted by every instance, in order. */
    static styles: CSSStyleSheet[];
    protected readonly root: ShadowRoot;
    constructor(init?: ShadowRootInit);
    /** Boolean attribute accessor. */
    protected flag(name: string, on?: boolean): boolean;
    /** A `change`-style event that crosses the shadow boundary, like native ones. */
    protected emit<T>(type: string, detail?: T, cancelable?: boolean): boolean;
}
/** Defines once, so importing a module twice (or two bundles) is harmless. */
export declare function define(tag: string, ctor: CustomElementConstructor): void;
export declare const reducedMotion: () => boolean;
/** The theme the page is showing right now: [data-theme] wins, else the system. */
export declare function effectiveTheme(): 'light' | 'dark';
/** Calls back whenever the effective theme changes (toggle, system, another tab). */
export declare function onThemeChange(callback: () => void): () => void;
