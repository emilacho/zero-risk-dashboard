/**
 * no-function-format-prop · Phase 4.2 regression guard.
 *
 * Forbids passing a function callback to the `format` prop of
 * `<AnimatedNumber>` or `<OpsKpiCell>` (and similar surface-level
 * components that mirror the same API). React 19 + Next 15 will reject
 * function props at the server→client component boundary as
 * non-serializable · this surfaces as digest 3406040795 crashes and
 * is exactly the regression Phase 4.1 closed off by switching to a
 * string-identifier `formatType` API.
 *
 * Allowed value shapes ·
 *   - StringLiteral · format="currency"
 *   - StringLiteral inside JSX expression container · format={"currency"}
 *   - Identifier (assumed string runtime) · format={kind}
 *   - MemberExpression / OptionalMemberExpression · format={cfg.kind}
 *   - ConditionalExpression / LogicalExpression resolving to strings
 *     · format={x ? "currency" : "compact"}
 *
 * Disallowed shapes ·
 *   - ArrowFunctionExpression · format={(v) => `$${v}`}
 *   - FunctionExpression · format={function(v) { return ... }}
 *   - Bare Identifier with a name that is conventionally a fn (e.g.
 *     `formatCurrency`, `fmt`, `fmtUsd`, anything ending in `Fn` or
 *     starting with `format`). This is a heuristic backstop · the AST
 *     doesn't tell us a free Identifier resolves to a function.
 *
 * Also flags the alias `formatter={...}` for the same components ·
 * historically some callers used that name during pre-Phase-4
 * iteration.
 */

const TARGET_COMPONENTS = new Set(["AnimatedNumber", "OpsKpiCell"])
const FUNCTION_PROP_NAMES = new Set(["format", "formatter"])

const FUNCTION_NAMING_HEURISTIC = /^(fmt|formatter|format[A-Z])|Fn$/

function getJsxComponentName(openingNode) {
  if (!openingNode || !openingNode.name) return null
  // <Foo />
  if (openingNode.name.type === "JSXIdentifier") return openingNode.name.name
  // <Foo.Bar /> · use the trailing name
  if (openingNode.name.type === "JSXMemberExpression") {
    return openingNode.name.property?.name ?? null
  }
  return null
}

const FORBID_NODE_TYPES = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
])

function reportIfFunctionLike(context, node, valueExpr) {
  if (!valueExpr) return
  if (FORBID_NODE_TYPES.has(valueExpr.type)) {
    context.report({
      node: valueExpr,
      messageId: "callbackForbidden",
    })
    return
  }
  // Conservative naming heuristic for free identifiers
  if (valueExpr.type === "Identifier" && FUNCTION_NAMING_HEURISTIC.test(valueExpr.name)) {
    context.report({
      node: valueExpr,
      messageId: "identifierLikelyFunction",
      data: { name: valueExpr.name },
    })
  }
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow function callbacks on AnimatedNumber/OpsKpiCell `format` prop · use string `formatType` identifier instead (digest 3406040795 regression guard).",
      recommended: true,
    },
    schema: [],
    messages: {
      callbackForbidden:
        "{{component}}.{{propName}} must be a string identifier (e.g. 'currency') · function callbacks break server→client serialization in Next 15 + React 19 (digest 3406040795). Migrate to `formatType` + `formatOptions` instead.",
      identifierLikelyFunction:
        "{{component}}.{{propName}} = `{{name}}` looks like a function reference · use the string `formatType` API to avoid the digest 3406040795 regression. If `{{name}}` is actually a string · rename it to a non-fn-shaped identifier (e.g. `formatKind`).",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const componentName = getJsxComponentName(node)
        if (!componentName || !TARGET_COMPONENTS.has(componentName)) return
        for (const attr of node.attributes ?? []) {
          if (attr.type !== "JSXAttribute") continue
          const propName = attr.name?.name
          if (!propName || !FUNCTION_PROP_NAMES.has(propName)) continue
          const v = attr.value
          if (!v) continue
          if (v.type === "JSXExpressionContainer") {
            const expr = v.expression
            // Walk through wrappers (parens / TS as-expressions)
            const inner = unwrap(expr)
            // Allow safe shapes
            const SAFE = new Set([
              "Literal", // "currency"
              "TemplateLiteral", // `currency`
              "ConditionalExpression",
              "LogicalExpression",
              "MemberExpression",
              "OptionalMemberExpression",
              "CallExpression", // assume returns string (e.g. fmt())
              "BinaryExpression",
            ])
            if (SAFE.has(inner.type)) continue
            // Otherwise report function-like
            const baseReport = (target) =>
              context.report({
                node: target,
                messageId:
                  target.type === "Identifier"
                    ? "identifierLikelyFunction"
                    : "callbackForbidden",
                data: {
                  component: componentName,
                  propName,
                  name: target.name ?? "",
                },
              })
            if (FORBID_NODE_TYPES.has(inner.type)) {
              baseReport(inner)
              continue
            }
            if (
              inner.type === "Identifier" &&
              FUNCTION_NAMING_HEURISTIC.test(inner.name)
            ) {
              baseReport(inner)
              continue
            }
            // Anything else (e.g. plain bare Identifier that doesn't
            // look fn-shaped) is allowed · best effort static rule.
            void reportIfFunctionLike(context, node, inner)
          }
          // StringLiteral · format="currency" · always safe.
        }
      },
    }
  },
}

function unwrap(expr) {
  let cur = expr
  while (
    cur &&
    (cur.type === "TSAsExpression" ||
      cur.type === "TSSatisfiesExpression" ||
      cur.type === "TSNonNullExpression" ||
      cur.type === "TSTypeAssertion" ||
      cur.type === "ParenthesizedExpression")
  ) {
    cur = cur.expression
  }
  return cur
}
