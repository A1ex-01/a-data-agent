/**
 * Agent step identifiers and their display labels.
 *
 * The backend writes these `id` strings from every LangGraph node into the
 * SSE stream (see `app/agent/nodes/*.py`). Frontends should iterate over
 * `AGENT_STEPS` to render a timeline — never hard-code the strings.
 *
 * The `label` field is the human-readable translation for the chat UI.
 * Add more locales here later if needed.
 */

export interface AgentStep {
  /**
   * Stable identifier — exactly matches the `step` field in
   * `ProgressEvent` emitted by the backend.
   */
  id: string;
  /** Human-readable label for the chat UI. */
  label: string;
  /**
   * If `true`, this step's success means the query has produced a final
   * result downstream and no more meaningful work will happen (useful for
   * UI hints like "done").
   */
  terminal?: boolean;
}

/**
 * The full pipeline the agent runs through. Order matches execution order
 * in `app/agent/graph.py`. Note that `recallColumn`, `recallMetric`, and
 * `recallValue` run in parallel from a UI-timeline perspective; consumers
 * should treat them as siblings.
 */
export const AGENT_STEPS: readonly AgentStep[] = [
  { id: "抽取关键字", label: "Extract keywords" },
  { id: "召回字段", label: "Recall columns" },
  { id: "召回字段取值", label: "Recall values" },
  { id: "召回指标", label: "Recall metrics" },
  { id: "合并召回信息", label: "Merge retrieved info" },
  { id: "过滤表格", label: "Filter tables" },
  { id: "过滤指标", label: "Filter metrics" },
  { id: "添加额外上下文信息", label: "Add extra context" },
  { id: "生成SQL", label: "Generate SQL" },
  { id: "验证SQL", label: "Validate SQL" },
  { id: "校正SQL", label: "Correct SQL" },
  { id: "执行SQL", label: "Execute SQL", terminal: true },
] as const;

/** A lookup map from step id → its metadata. */
export const AGENT_STEPS_BY_ID: Readonly<Record<string, AgentStep>> =
  Object.freeze(
    Object.fromEntries(AGENT_STEPS.map((s) => [s.id, s] as const)),
  );
