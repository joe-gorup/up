export type ConditionalOperator = 'equals' | 'not_equals' | 'in' | 'not_in' | 'is_empty' | 'is_not_empty';

export type ConditionalRule = {
  question_stable_key: string;
  operator: ConditionalOperator;
  value?: unknown;
};

export type FormOption = {
  key: string;
  label: string;
  icon?: string;
};

export function normalizeFormOption(option: unknown): FormOption {
  if (typeof option === 'string') return { key: option, label: option };
  const record = option && typeof option === 'object' ? option as Record<string, unknown> : {};
  const key = String(record.key || record.value || '');
  return {
    key,
    label: String(record.label || record.key || record.value || ''),
    icon: record.icon ? String(record.icon) : undefined,
  };
}

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

type ConditionalQuestion = {
  id: string;
  stable_key: string;
  config_json?: Record<string, unknown> | null;
};

export function normalizeConditionalAnswers(
  questions: ConditionalQuestion[],
  answers: Map<string, unknown>,
) {
  const visibleAnswers = new Map(answers);
  for (let pass = 0; pass <= questions.length; pass += 1) {
    const lookup = new Map<string, unknown>();
    for (const question of questions) lookup.set(question.stable_key, visibleAnswers.get(question.id));
    let removed = false;
    for (const question of questions) {
      if (!isQuestionVisible(question, lookup) && visibleAnswers.delete(question.id)) removed = true;
    }
    if (!removed) return { answers: visibleAnswers, lookup };
  }
  const lookup = new Map<string, unknown>();
  for (const question of questions) lookup.set(question.stable_key, visibleAnswers.get(question.id));
  return { answers: visibleAnswers, lookup };
}

export function missingRequiredQuestionPrompts(
  questions: ConditionalQuestion[],
  answers: Map<string, unknown>,
): string[] {
  const normalized = normalizeConditionalAnswers(questions, answers);
  return questions
    .filter(question => isQuestionVisible(question, normalized.lookup) && isQuestionRequired(question, normalized.lookup))
    .filter(question => !isMeaningfullyAnswered(normalized.answers.get(question.id)))
    .map(question => (question as ConditionalQuestion & { prompt?: string }).prompt || question.stable_key);
}