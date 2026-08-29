import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  evaluateConditional,
  isMeaningfullyAnswered,
  isQuestionRequired,
  isQuestionVisible,
  missingRequiredQuestionPrompts,
  normalizeFormOption,
} from '../shared/formLogic';

describe('Phase 3 conditional logic', () => {
  const answers = {
    status: { selected: 'good' },
    safety: { bool: true },
    notes: { text: 'A note' },
    emptyList: [],
    emptyObject: {},
  };

  test('supports every v1 operator with raw and structured answers', () => {
    const cases: Array<[string, boolean]> = [
      ['equals', evaluateConditional({ question_stable_key: 'status', operator: 'equals', value: 'good' }, answers)],
      ['not_equals', evaluateConditional({ question_stable_key: 'status', operator: 'not_equals', value: 'hard' }, answers)],
      ['in', evaluateConditional({ question_stable_key: 'status', operator: 'in', value: ['okay', 'good'] }, answers)],
      ['not_in', evaluateConditional({ question_stable_key: 'status', operator: 'not_in', value: ['hard', 'okay'] }, answers)],
      ['is_empty', evaluateConditional({ question_stable_key: 'emptyList', operator: 'is_empty' }, answers)],
      ['is_not_empty', evaluateConditional({ question_stable_key: 'notes', operator: 'is_not_empty' }, answers)],
    ];
    assert.deepEqual(cases, cases.map(([operator]) => [operator, true]));
    assert.equal(evaluateConditional({ question_stable_key: 'safety', operator: 'equals', value: true }, answers), true);
    assert.equal(evaluateConditional({ question_stable_key: 'safety', operator: 'equals', value: 'no' }, answers), false);
    assert.equal(isMeaningfullyAnswered(answers.emptyObject), false);
  });

  test('hides conditional questions and only requires visible conditional follow-ups', () => {
    const questions = [
      { id: 'safety', stable_key: 'safety', prompt: 'Safety?', config_json: { required: true } },
      {
        id: 'details',
        stable_key: 'details',
        prompt: 'Describe what happened.',
        config_json: {
          show_when: { question_stable_key: 'safety', operator: 'equals', value: 'yes' },
          required_when: { question_stable_key: 'safety', operator: 'equals', value: 'yes' },
        },
      },
    ];
    const noSafety = new Map([['safety', 'no'], ['details', '']]);
    const yesSafety = new Map([['safety', 'yes'], ['details', '']]);
    assert.equal(isQuestionVisible(questions[1], new Map([['safety', 'no']])), false);
    assert.equal(isQuestionRequired(questions[1], new Map([['safety', 'no']])), false);
    assert.deepEqual(missingRequiredQuestionPrompts(questions, noSafety), []);
    assert.deepEqual(missingRequiredQuestionPrompts(questions, yesSafety), ['Describe what happened.']);
  });

  test('removes stale hidden answers before evaluating dependent conditionals', () => {
    const questions = [
      { id: 'first', stable_key: 'first', prompt: 'First', config_json: { show_when: { question_stable_key: 'toggle', operator: 'equals', value: 'yes' } } },
      { id: 'second', stable_key: 'second', prompt: 'Second', config_json: { show_when: { question_stable_key: 'first', operator: 'equals', value: 'yes' } } },
      { id: 'toggle', stable_key: 'toggle', prompt: 'Toggle', config_json: {} },
    ];
    assert.deepEqual(missingRequiredQuestionPrompts(questions, new Map([['toggle', 'no'], ['first', 'yes'], ['second', ''] ])), []);
  });
});

describe('Phase 3 chip display', () => {
  test('normalizes string and keyed options without losing labels or icons', () => {
    assert.deepEqual(normalizeFormOption('training'), { key: 'training', label: 'training' });
    assert.deepEqual(normalizeFormOption({ key: 'good', label: 'Good', icon: '👍' }), { key: 'good', label: 'Good', icon: '👍' });
    assert.deepEqual(normalizeFormOption({ value: 'hard', label: 'Hard' }), { key: 'hard', label: 'Hard', icon: undefined });
  });
});

describe('Coach Check-In migration contract', () => {
  test('keeps the shared response path and legacy history path present', () => {
    const component = readFileSync('client/src/components/CoachCheckin.tsx', 'utf8');
    const routes = readFileSync('server/routes.ts', 'utf8');
    const seed = readFileSync('scripts/seed-form-templates.ts', 'utf8');
    assert.match(component, /\/api\/coach-checkins\/\$\{employeeId\}/);
    assert.match(component, /<FormFiller/);
    assert.match(component, /Legacy check-in history/);
    assert.match(routes, /app\.get\("\/api\/coach-checkins\/:employeeId"/);
    assert.match(routes, /const legacyRows = await db\.select\(\)\.from\(coach_checkins\)/);
    assert.match(seed, /form_type: 'coach_checkin'/);
    assert.match(seed, /show_when: \{ question_stable_key: 'big_win'/);
    assert.match(seed, /show_when: \{ question_stable_key: 'safety_concern'/);
  });
});