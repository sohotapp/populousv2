// Executor registry - import and register all executors

import { registerExecutor, getExecutor, getExecutorByType, BaseExecutor } from "./base";
import { llmExecutor } from "./llm";
import { internalExecutor } from "./internal";
import { externalExecutor } from "./external";
import { computeExecutor } from "./compute";

export * from "./types";
export * from "./base";

// Register all executors
registerExecutor(llmExecutor);
registerExecutor(internalExecutor);
registerExecutor(externalExecutor);
registerExecutor(computeExecutor);

// Re-export for convenience
export { llmExecutor, internalExecutor, externalExecutor, computeExecutor };
export { getExecutor, getExecutorByType };
