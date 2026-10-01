// JSX types for @ewo/elements in React 19. Reference it once in an app:
//   /// <reference types="@ewo/elements/types/react" />
//
// React 19 sets a prop as a *property* when the element has one (value,
// options, ticks, checked, open) and as an attribute otherwise. Lower-case
// `on<event>` props become addEventListener(<event>) on custom elements, so
// `onchange` receives the element's own CustomEvent with its detail.
//
// Hand-written for the MVP; a generator (custom-element-jsx-integration)
// can produce this from custom-elements.json.

import type { DOMAttributes, HTMLAttributes, Key, Ref } from 'react';
import type { EwoBadge, EwoEmpty, EwoHalftone, EwoSegmented, EwoSheet, EwoSkeleton, EwoSwitch, EwoThemeToggle, EwoTicks, EwoToaster, SegmentedOption, Tick } from './index';

type Base<E> = Omit<HTMLAttributes<E>, 'onChange' | 'onInput' | 'onLoad' | 'onError' | 'onCancel' | 'onClose'> &
  Pick<DOMAttributes<E>, 'children'> & {
    ref?: Ref<E>;
    key?: Key;
    class?: string;
    slot?: string;
  };

type Handler<D> = (event: CustomEvent<D>) => void;

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'ewo-segmented': Base<EwoSegmented> & {
        value?: string;
        options?: SegmentedOption[];
        label?: string;
        name?: string;
        size?: 'md' | 'sm';
        tone?: 'neutral' | 'invert' | 'accent';
        stretch?: boolean;
        disabled?: boolean;
        onchange?: Handler<{ value: string }>;
        oninput?: Handler<{ value: string }>;
      };
      'ewo-switch': Base<EwoSwitch> & {
        checked?: boolean;
        disabled?: boolean;
        row?: boolean;
        tone?: 'neutral' | 'accent';
        name?: string;
        value?: string;
        onchange?: Handler<{ checked: boolean }>;
      };
      'ewo-badge': Base<EwoBadge> & {
        tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'unknown' | 'accent';
        variant?: 'outline' | 'soft' | 'plain';
        size?: 'md' | 'sm';
        pulse?: boolean;
        nodot?: boolean;
        live?: boolean;
      };
      'ewo-empty': Base<EwoEmpty> & { heading?: string; variant?: 'dashed' | 'solid'; tone?: 'neutral' | 'bad' | 'accent'; rings?: boolean; compact?: boolean };
      'ewo-skeleton': Base<EwoSkeleton> & { width?: string; height?: string; radius?: string; lines?: number };
      'ewo-ticks': Base<EwoTicks> & { ticks?: Tick[]; states?: string; label?: string; start?: string; end?: string };
      'ewo-toaster': Base<EwoToaster> & { position?: 'bottom' | 'top' };
      'ewo-sheet': Base<EwoSheet> & { open?: boolean; label?: string; wide?: boolean; placement?: 'center' | 'top'; oncancel?: Handler<void>; onclose?: Handler<void> };
      'ewo-theme-toggle': Base<EwoThemeToggle> & { cycle?: boolean; 'label-light'?: string; 'label-dark'?: string };
      'ewo-halftone': Base<EwoHalftone> & { src?: string; alt?: string; cell?: number; color?: 'ink' | 'photo'; fit?: 'cover' | 'contain'; lens?: boolean; ripple?: boolean; origin?: string };
    }
  }
}
