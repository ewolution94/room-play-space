/**
 * Undo steps for settings that change many times a second. A colour picker reports every step of
 * a drag across its colour field, and a step per report would bury everything else in history
 * (it keeps 100). So changes to the same setting within COALESCE_MS of each other join the step
 * the first one took: a drag is one undo, a pick after a pause is a new one. Anything else that
 * takes a step in between (moving an item, an undo) ends the run.
 */
export const COALESCE_MS = 1000;

/** The setting the last undo step was taken for, and when it last changed. */
export interface CoalesceRun {
  key: string;
  at: number;
}

/** Whether a change to `key` at `now` takes a new undo step, given the run so far (null: none). */
export function startsNewStep(
  run: CoalesceRun | null,
  key: string,
  now: number,
  windowMs = COALESCE_MS,
): boolean {
  return !run || run.key !== key || now - run.at >= windowMs;
}
