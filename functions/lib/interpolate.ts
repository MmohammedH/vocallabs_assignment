// Resolves {{steps.<key>.output.<path>}} / {{trigger.input.<path>}} templates
// inside a step's JSONB config against the run's accumulated context. Used by
// llm_call, http_request, db_write, and notify steps so later steps can
// reference earlier steps' outputs (e.g. an http_request body referencing the
// llm_call's output).

export type RunContext = {
  steps: Record<string, any>; // keyed by both step_order (as string) and step name, when present
  trigger: { input: any };
};

function getPath(obj: any, path: string): any {
  if (!path) return obj;
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

const TEMPLATE_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

function resolveExpr(expr: string, context: RunContext): any {
  const [root, ...rest] = expr.split(".");
  const path = rest.join(".");
  if (root === "trigger") return getPath(context.trigger, path);
  if (root === "steps") {
    const [key, ...stepRest] = rest;
    return getPath(context.steps[key], stepRest.join("."));
  }
  return undefined;
}

function resolveString(value: string, context: RunContext): any {
  const trimmed = value.trim();
  const fullMatch = trimmed.match(/^\{\{\s*([\w.]+)\s*\}\}$/);
  if (fullMatch) {
    // whole string is a single {{...}} expression -> return the raw resolved
    // value (may be an object/number/boolean), not a stringified version.
    return resolveExpr(fullMatch[1], context);
  }
  return value.replace(TEMPLATE_RE, (_match, expr) => {
    const resolved = resolveExpr(expr, context);
    return resolved === undefined || resolved === null
      ? ""
      : typeof resolved === "string"
      ? resolved
      : JSON.stringify(resolved);
  });
}

export function resolveConfig(config: any, context: RunContext): any {
  if (typeof config === "string") return resolveString(config, context);
  if (Array.isArray(config)) return config.map((v) => resolveConfig(v, context));
  if (config && typeof config === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(config)) out[k] = resolveConfig(v, context);
    return out;
  }
  return config;
}

// Registers a completed step's output under both its step_order and (if set)
// its name, so later steps can reference either `{{steps.3.output...}}` or
// `{{steps.classify_ticket.output...}}`.
export function registerStepOutput(context: RunContext, stepOrder: number, name: string | null, output: any) {
  context.steps[String(stepOrder)] = { output };
  if (name) context.steps[name] = { output };
}
