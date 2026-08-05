import * as React from "react";
import { Input } from "@/components/ui/input";

interface NumberFieldProps extends Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> {
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
}

/**
 * A numeric input that lets you type freely -- including clearing the field
 * completely, or selecting the whole value and typing a fresh number -- and
 * only clamps/commits the value on blur (or Enter). Plain `<input
 * type="number">` bound directly to a clamped number (e.g. `value={w}
 * onChange={e => setW(Math.max(50, parseInt(e.target.value) || 0))}`) fights
 * the user on every keystroke: backspacing to clear the field re-parses the
 * empty string as 0/NaN and immediately snaps back to the min, so the field
 * can never actually be emptied or retyped. This component keeps the
 * in-progress text as local state and only pushes a parsed, clamped value
 * back out once editing is done.
 */
export const NumberField = React.forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ value, onCommit, min, max, onKeyDown, ...props }, ref) => {
    const [draft, setDraft] = React.useState(String(value));
    const focusedRef = React.useRef(false);
    // Bumped by every commit, so the sync effect below re-runs even when
    // `value` did NOT change -- which is exactly what happens when the
    // owner clamps the committed number to what it already was, or refuses
    // it outright (e.g. a wall height below the openings already in the
    // wall). Without this the field goes on displaying the rejected number
    // while the app holds a different one, which reads as "it worked".
    const [commitTick, setCommitTick] = React.useState(0);

    React.useEffect(() => {
      if (!focusedRef.current) setDraft(String(value));
    }, [value, commitTick]);

    const commit = () => {
      const parsed = parseFloat(draft);
      let next = Number.isFinite(parsed) ? parsed : value;
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      setDraft(String(next));
      if (next !== value) onCommit(next);
      // Batched with whatever onCommit just did, so the effect above runs
      // once, after the owner has settled, and shows what is actually in
      // effect rather than what was typed.
      setCommitTick((t) => t + 1);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          focusedRef.current = true;
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          focusedRef.current = false;
          commit();
          props.onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
          onKeyDown?.(e);
        }}
      />
    );
  },
);
NumberField.displayName = "NumberField";
