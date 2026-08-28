export type ConditionalOperator = 'equals' | 'not_equals' | 'in' | 'not_in' | 'is_empty' | 'is_not_empty';

export type ConditionalRule = {
  question_stable_key: string;
  operator: ConditionalOperator;
  value?: unknown;
};

function comparable(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of ['selected', 'bool', 'text', 'number', 'date', 'datetime', 'time', 'value']) {
      if (key in record) return record[key];
    }
  }
  return value;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  const a = comparable(left);
  const b = comparable(right);
  if (typeof b === 'boolean' && typeof a === 'string') {
    if (a.toLowerCase() === 'yes') return b === true;
    if (a.toLowerCase() === 'no') return b === false;
  }
  if (typeof a === 'boolean' && typeof b === 'string') {
    if (b.toLowerCase() === 'yes') return a === true;
    if (b.toLowerCase() === 'no') return a === false;
  }
  return a === b;
}

export function isMeaningfullyAnswered(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return true;
}

export function evaluateConditional(
  rule: ConditionalRule | undefined | null,
  answersByStableKey: Map<string, unknown> | Record<string, unknown>,
): boolean {
  if (!rule || !rule.question_stable_key || !rule.operator) return true;
  const answer = answersByStableKey instanceof Map
    ? answersByStableKey.get(rule.question_stable_key)
    : answersByStableKey[rule.question_stable_key];
  const value = comparable(answer);
  const expected = rule.value;
  switch (rule.operator) {
    case 'equals':
      return valuesEqual(value, expected);
    case 'not_equals':
      return !valuesEqual(value, expected);
    case 'in':
      return Array.isArray(expected) && expected.some(item => valuesEqual(value, item));
    case 'not_in':
      return Array.isArray(expected) && !expected.some(item => valuesEqual(value, item));
    case 'is_empty':
      return !isMeaningfullyAnswered(value);
    case 'is_not_empty':
      return isMeaningfullyAnswered(value);
    default:
      return false;
  }
}

export function isQuestionVisible(
  question: { config_json?: Record<string, unknown> | null },
  answersByStableKey: Map<string, unknown> | Record<string, unknown>,
): boolean {
  const config = question.config_json || {};
  return evaluateConditional((config.show_when || config.visibility_when) as ConditionalRule | undefined, answersByStableKey);
}

export function isQuestionRequired(
  question: { config_json?: Record<string, unknown> | null },
  answersByStableKey: Map<string, unknown> | Record<string, unknown>,
): boolean {
  const config = question.config_json || {};
  const conditional = config.required_when || config.conditional_required;
  const validation = config.validation && typeof config.validation === 'object' ? config.validation as Record<string, unknown> : {};
  return Boolean(config.required || validation.required) || Boolean(conditional && evaluateConditional(conditional as ConditionalRule, answersByStableKey));
}