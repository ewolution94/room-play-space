// Types for @ewo/elements in Svelte 5 markup. Reference it once in an app:
//   /// <reference types="@ewo/elements/types/svelte" />
//
// Svelte sets a prop as a *property* when the element has one (value,
// options, ticks, checked, open), else as an attribute, and `onchange`
// listens for the element's own change event.

import type { HTMLAttributes } from 'svelte/elements';
import type { EwoBadge, EwoEmpty, EwoHalftone, EwoSegmented, EwoSheet, EwoSkeleton, EwoSwitch, EwoThemeToggle, EwoTicks, EwoToaster, SegmentedOption, Tick } from './index';

type Handler<E, D> = (event: CustomEvent<D> & { currentTarget: E }) => void;

declare module 'svelte/elements' {
  interface SvelteHTMLElements {
    'ewo-segmented': Omit<HTMLAttributes<EwoSegmented>, 'onchange' | 'oninput'> & {
      value?: string;
      options?: SegmentedOption[];
      label?: string;
      name?: string;
      size?: 'md' | 'sm';
      tone?: 'neutral' | 'invert' | 'accent';
      stretch?: boolean;
      disabled?: boolean;
      onchange?: Handler<EwoSegmented, { value: string }>;
      oninput?: Handler<EwoSegmented, { value: string }>;
    };
    'ewo-switch': Omit<HTMLAttributes<EwoSwitch>, 'onchange'> & {
      checked?: boolean;
      disabled?: boolean;
      row?: boolean;
      tone?: 'neutral' | 'accent';
      name?: string;
      value?: string;
      onchange?: Handler<EwoSwitch, { checked: boolean }>;
    };
    'ewo-badge': HTMLAttributes<EwoBadge> & {
      tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'unknown' | 'accent';
      variant?: 'outline' | 'soft' | 'plain';
      size?: 'md' | 'sm';
      pulse?: boolean;
      nodot?: boolean;
      live?: boolean;
    };
    'ewo-empty': HTMLAttributes<EwoEmpty> & { heading?: string; variant?: 'dashed' | 'solid'; tone?: 'neutral' | 'bad' | 'accent'; rings?: boolean; compact?: boolean };
    'ewo-skeleton': HTMLAttributes<EwoSkeleton> & { width?: string; height?: string; radius?: string; lines?: number };
    'ewo-ticks': HTMLAttributes<EwoTicks> & { ticks?: Tick[]; states?: string; label?: string; start?: string; end?: string };
    'ewo-toaster': HTMLAttributes<EwoToaster> & { position?: 'bottom' | 'top' };
    'ewo-sheet': Omit<HTMLAttributes<EwoSheet>, 'oncancel' | 'onclose'> & { open?: boolean; label?: string; wide?: boolean; placement?: 'center' | 'top'; oncancel?: Handler<EwoSheet, void>; onclose?: Handler<EwoSheet, void> };
    'ewo-theme-toggle': HTMLAttributes<EwoThemeToggle> & { cycle?: boolean; 'label-light'?: string; 'label-dark'?: string };
    'ewo-halftone': Omit<HTMLAttributes<EwoHalftone>, 'onload' | 'onerror'> & { src?: string; alt?: string; cell?: number; color?: 'ink' | 'photo'; fit?: 'cover' | 'contain'; lens?: boolean; ripple?: boolean; origin?: string };
  }
}

export {};
