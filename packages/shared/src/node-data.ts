/**
 * Keys C.A.F.E. keeps in a node's `data` for its own bookkeeping.
 *
 * They ride along with the node so they survive the editor's store, which rebuilds
 * every node from `{id, type, position, data}` and drops anything else. They are
 * stripped before the YAML is written and hidden from the property editor, so they
 * never reach Home Assistant and nobody has to look at them.
 */
export const CafeNodeDataKeys = {
  /**
   * This condition came from inside the action sequence — an `if:` block, or a bare
   * condition guard in the list — rather than from the automation's root
   * `conditions:` block.
   *
   * The two are not equivalent, which is the whole reason to remember which one it
   * was: `automation.trigger` skips the root conditions by default, so an automation
   * that another automation calls would run its actions unconditionally if we moved
   * the condition up there.
   */
  IN_SEQUENCE: 'cafe_in_sequence',
} as const;

export type CafeNodeDataKey = (typeof CafeNodeDataKeys)[keyof typeof CafeNodeDataKeys];

const RESERVED: ReadonlySet<string> = new Set(Object.values(CafeNodeDataKeys));

/** Whether a node-data key is C.A.F.E.'s own rather than Home Assistant's. */
export function isCafeNodeDataKey(key: string): boolean {
  return RESERVED.has(key);
}

/** A copy of `data` without C.A.F.E.'s bookkeeping keys, ready to be written out. */
export function stripCafeNodeData<T extends Record<string, unknown>>(data: T): T {
  if (!Object.keys(data).some(isCafeNodeDataKey)) {
    return data;
  }
  return Object.fromEntries(Object.entries(data).filter(([key]) => !isCafeNodeDataKey(key))) as T;
}

/** Whether a condition node came from inside the action sequence. */
export function isConditionInSequence(data: Record<string, unknown> | undefined): boolean {
  return data?.[CafeNodeDataKeys.IN_SEQUENCE] === true;
}

/** Mark condition data as having come from inside the action sequence. */
export function markConditionInSequence<T extends Record<string, unknown>>(data: T): T {
  return { ...data, [CafeNodeDataKeys.IN_SEQUENCE]: true };
}
