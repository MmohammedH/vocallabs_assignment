// Structured (non-eval) condition evaluator for conditional_branch steps.
// Deliberately not a free-form JS/expression evaluator — evaluating
// user-authored strings as code inside the run executor would be a code
// execution risk, so the condition is a small fixed vocabulary instead.
//
// config shape:
//   { "path": "sentiment", "operator": "eq", "value": "positive",
//     "skip_step_orders_if_false": [4, 5] }
// `path` is resolved against the PREVIOUS executed step's output.

export type Condition = {
  path?: string;
  operator: "eq" | "neq" | "contains" | "gt" | "lt" | "gte" | "lte" | "truthy";
  value?: any;
};

function getPath(obj: any, path?: string): any {
  if (!path) return obj;
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function evaluateCondition(condition: Condition, previousOutput: any): boolean {
  const actual = getPath(previousOutput, condition.path);
  switch (condition.operator) {
    case "eq":
      return actual === condition.value;
    case "neq":
      return actual !== condition.value;
    case "contains":
      return typeof actual === "string" && actual.includes(String(condition.value));
    case "gt":
      return Number(actual) > Number(condition.value);
    case "lt":
      return Number(actual) < Number(condition.value);
    case "gte":
      return Number(actual) >= Number(condition.value);
    case "lte":
      return Number(actual) <= Number(condition.value);
    case "truthy":
      return Boolean(actual);
    default:
      return false;
  }
}
