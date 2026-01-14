/**
 * Internal Executor - Handles control flow and data transformation primitives
 */
export class InternalExecutor {
  async execute(
    primitiveId: string,
    config: Record<string, unknown>,
    inputs: Record<string, unknown>
  ): Promise<unknown> {
    switch (primitiveId) {
      case "data.input":
        return this.executeDataInput(config);

      case "control.merge":
        return this.executeMerge(config, inputs);

      default:
        throw new Error(`Unknown internal primitive: ${primitiveId}`);
    }
  }

  private executeDataInput(config: Record<string, unknown>): unknown {
    const dataType = config.dataType as string || "text";
    const value = config.value as string || "";

    switch (dataType) {
      case "number":
        return { data: parseFloat(value) || 0 };

      case "json":
        try {
          return { data: JSON.parse(value) };
        } catch {
          return { data: value, parseError: true };
        }

      case "text":
      default:
        return { data: value };
    }
  }

  private executeMerge(
    config: Record<string, unknown>,
    inputs: Record<string, unknown>
  ): unknown {
    const strategy = config.strategy as string || "object";

    if (strategy === "array") {
      // Merge all inputs into an array
      const merged: unknown[] = [];
      for (const key of Object.keys(inputs).sort()) {
        if (inputs[key] !== undefined && inputs[key] !== null) {
          merged.push(inputs[key]);
        }
      }
      return { merged };
    }

    // Default: merge as object
    const merged: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(inputs)) {
      if (value !== undefined && value !== null) {
        // If value is an object, spread it; otherwise assign directly
        if (typeof value === "object" && !Array.isArray(value)) {
          Object.assign(merged, value);
        } else {
          merged[key] = value;
        }
      }
    }

    return { merged };
  }
}
