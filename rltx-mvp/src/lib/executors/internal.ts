// Internal Executor - Handles control flow and data transformation nodes

import { BaseExecutor } from "./base";
import {
  ExecutorContext,
  ExecutorResult,
  ExecutorType,
  ExecutionError,
} from "./types";

export class InternalExecutor extends BaseExecutor {
  type: ExecutorType = "internal";
  primitiveIds = [
    "data.input",
    "control.condition",
    "control.loop",
    "control.merge",
  ];

  async execute(ctx: ExecutorContext): Promise<ExecutorResult> {
    const startedAt = new Date();

    ctx.onProgress(10, "Processing...");

    let outputs: Record<string, unknown>;

    switch (ctx.primitiveId) {
      case "data.input":
        outputs = this.executeDataInput(ctx);
        break;
      case "control.condition":
        outputs = this.executeCondition(ctx);
        break;
      case "control.loop":
        outputs = await this.executeLoop(ctx);
        break;
      case "control.merge":
        outputs = this.executeMerge(ctx);
        break;
      default:
        throw new ExecutionError(
          "UNKNOWN_PRIMITIVE",
          `Unknown internal primitive: ${ctx.primitiveId}`,
          false
        );
    }

    ctx.onProgress(100, "Complete");

    return {
      outputs,
      timing: this.createTiming(startedAt),
    };
  }

  private executeDataInput(ctx: ExecutorContext): Record<string, unknown> {
    const { dataType, value } = ctx.config;

    let parsedValue: unknown = value;

    switch (dataType) {
      case "number":
        parsedValue = Number(value);
        if (isNaN(parsedValue as number)) {
          throw new ExecutionError("INVALID_NUMBER", "Value is not a valid number", false);
        }
        break;
      case "json":
        try {
          parsedValue = JSON.parse(value as string);
        } catch {
          throw new ExecutionError("INVALID_JSON", "Value is not valid JSON", false);
        }
        break;
      case "text":
      default:
        parsedValue = String(value ?? "");
        break;
    }

    return { data: parsedValue };
  }

  private executeCondition(ctx: ExecutorContext): Record<string, unknown> {
    const { value } = ctx.inputs;
    const { operator, compareValue } = ctx.config;

    let result: boolean;

    switch (operator) {
      case "equals":
        result = String(value) === String(compareValue);
        break;
      case "notEquals":
        result = String(value) !== String(compareValue);
        break;
      case "greaterThan":
        result = Number(value) > Number(compareValue);
        break;
      case "lessThan":
        result = Number(value) < Number(compareValue);
        break;
      case "contains":
        result = String(value).includes(String(compareValue));
        break;
      case "isEmpty":
        result = value === null || value === undefined || value === "" ||
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === "object" && Object.keys(value as object).length === 0);
        break;
      default:
        throw new ExecutionError("UNKNOWN_OPERATOR", `Unknown operator: ${operator}`, false);
    }

    // Return value on the appropriate output port
    return {
      true: result ? value : undefined,
      false: !result ? value : undefined,
    };
  }

  private async executeLoop(ctx: ExecutorContext): Promise<Record<string, unknown>> {
    const { items } = ctx.inputs;
    const { parallel, maxConcurrency = 5 } = ctx.config;

    if (!Array.isArray(items)) {
      throw new ExecutionError("INVALID_INPUT", "Loop input must be an array", false);
    }

    ctx.onProgress(20, `Processing ${items.length} items...`);

    // For now, loop just passes through items
    // In a full implementation, this would spawn sub-executions
    const results: unknown[] = [];

    if (parallel) {
      // Process in batches for parallel execution
      for (let i = 0; i < items.length; i += maxConcurrency as number) {
        const batch = items.slice(i, i + (maxConcurrency as number));
        const batchResults = await Promise.all(
          batch.map(async (item) => {
            // In real implementation, this would execute a sub-workflow
            return { item, processed: true };
          })
        );
        results.push(...batchResults);
        ctx.onProgress(20 + (80 * (i + batch.length) / items.length), `Processed ${i + batch.length}/${items.length}`);
      }
    } else {
      // Sequential processing
      for (let i = 0; i < items.length; i++) {
        results.push({ item: items[i], processed: true });
        ctx.onProgress(20 + (80 * (i + 1) / items.length), `Processed ${i + 1}/${items.length}`);
      }
    }

    return { results };
  }

  private executeMerge(ctx: ExecutorContext): Record<string, unknown> {
    const { input1, input2, input3 } = ctx.inputs;
    const { strategy } = ctx.config;

    if (strategy === "array") {
      // Merge as array
      const merged: unknown[] = [];
      if (input1 !== undefined) merged.push(input1);
      if (input2 !== undefined) merged.push(input2);
      if (input3 !== undefined) merged.push(input3);
      return { merged };
    } else {
      // Merge as object (default)
      const merged: Record<string, unknown> = {};

      if (input1 !== undefined) {
        if (typeof input1 === "object" && input1 !== null) {
          Object.assign(merged, input1);
        } else {
          merged.input1 = input1;
        }
      }

      if (input2 !== undefined) {
        if (typeof input2 === "object" && input2 !== null) {
          Object.assign(merged, input2);
        } else {
          merged.input2 = input2;
        }
      }

      if (input3 !== undefined) {
        if (typeof input3 === "object" && input3 !== null) {
          Object.assign(merged, input3);
        } else {
          merged.input3 = input3;
        }
      }

      return { merged };
    }
  }
}

// Export singleton instance
export const internalExecutor = new InternalExecutor();
