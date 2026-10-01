import { EwoElement } from './base';
export type ToastTone = 'neutral' | 'ok' | 'bad' | 'accent';
export type ToastOptions = {
    tone?: ToastTone;
    /** ms before it leaves on its own; 0 keeps it until dismissed. */
    duration?: number;
    action?: {
        label: string;
        run: () => void;
    };
};
/**
 * The region toasts appear in. Usually created for you by `toast()`.
 *
 * @tagname ewo-toaster
 * @attr {'bottom' | 'top'} position
 * @csspart stack
 * @csspart toast
 */
export declare class EwoToaster extends EwoElement {
    #private;
    static styles: CSSStyleSheet[];
    constructor();
    connectedCallback(): void;
    /** Shows a toast; returns a function that dismisses it early. */
    show(message: string, { tone, duration, action }?: ToastOptions): () => void;
}
export declare function toast(message: string, options?: ToastOptions): () => void;
declare global {
    interface HTMLElementTagNameMap {
        'ewo-toaster': EwoToaster;
    }
}
