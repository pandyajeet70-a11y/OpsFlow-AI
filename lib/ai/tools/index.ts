/**
 * lib/ai/tools/index.ts
 *
 * Loads all built-in OpsFlow tools.
 */

import "./builtins/lead-tools";
import "./builtins/campaign-tools";

export { executeTool } from "./executor";
export {
  getTool,
  hasTool,
  listTools,
  registerTool,
  unregisterTool,
} from "./registry";
export {
  approvalRequiredFor,
  decideToolCallWithModel,
  normalizeModelDecision,
} from "./decision";
export {
  buildToolCatalog,
  extractToolJSON,
  validateToolInput,
} from "./schema";