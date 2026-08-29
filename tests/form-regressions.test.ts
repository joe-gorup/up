import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  evaluateConditional,
  isQuestionRequired,
  isQuestionVisible,
} from '../shared/formLogic';
import { AnswerControl, optionParts } from '../client/src/components/FormsAndReviews';
import { normalizeCoachCheckinPayload } from '../client/src/components/CoachCheckin';
import { buildCoachCheckinPayload } from '../server/routes';

const question = (config_json: Record<string, unknown>) => ({ config_json });

describe('conditional form regressions', () => {
  test('evaluates visibility for raw and structured answers', () => {
    const visibilityRule = {
      question_stable_key: 'setting',
      operator: 'equals' as const,
      value: 'training',
    };

    assert.equal(evaluateConditional(visibilityRule, { setting: 'training' }), true);
    assert.equal(evaluateConditional(visibilityRule, { setting: { selected: 'training' } }), true);
    assert.equal(isQuestionVisible(question({ show_when: visibilityRule }), { setting: 'work_shift' }), false);
    assert.equal(isQuestionVisible(question({ show_when: visibilityRule }), { setting: { selected: 'training' } }), true);
  });

  test('applies conditional required validation only when visible condition is met', () => {
    const requiredQuestion = question({
      required_when: {
        question_stable_key: 'safety_concern',
        operator: 'equals',
        value: true,
      },
    });

    assert.equal(isQuestionRequired(requiredQuestion, { safety_concern: 'yes' }), true);
    assert.equal(isQuestionRequired(requiredQuestion, { safety_concern: { bool: true } }), true);
    assert.equal(isQuestionRequired(requiredQuestion, { safety_concern: 'no' }), false);
  });

  test('supports empty checks and structured multi-value answers', () => {
    const preferences = {
      question_stable_key: 'support',
      operator: 'in' as const,
      value: ['visuals', 'coach_help'],
    };

    assert.equal(evaluateConditional(preferences, { support: { selected: ['visuals'] } }), false);
    assert.equal(evaluateConditional(preferences, { support: 'visuals' }), true);
    assert.equal(evaluateConditional({
      question_stable_key: 'notes',
      operator: 'is_empty',
    }, { notes: { text: '' } }), true);
  });
});

describe('chip option rendering', () => {
  test('normalizes raw and structured options without losing labels or icons', () => {
    assert.deepEqual(optionParts('training'), { key: 'training', label: 'training' });
    assert.deepEqual(optionParts({ key: 'training', label: 'Training', icon: '🎓' }), {
      key: 'training',
      label: 'Training',
      icon: '🎓',
    });
  });

  test('renders structured chip options and marks a structured answer selected', () => {
    const markup = renderToStaticMarkup(React.createElement(AnswerControl, {
      question: {
        stable_key: 'setting',
        prompt: 'Setting',
        question_type: 'single_select',
        config_json: {
          display: { style: 'chips', show_icons: true },
          options: [{ key: 'training', label: 'Training', icon: '🎓' }, 'Work shift'],
        },
        sort_order: 0,
      },
      value: { selected: 'training' },
      onChange: () => {},
    }));

    assert.match(markup, /Training/);
    assert.match(markup, /🎓/);
    assert.match(markup, /Work shift/);
    assert.match(markup, /border-amber-500/);
  });
});

describe('Coach Check-In dual-read response path', () => {
  test('keeps form responses and legacy coach_checkins rows readable together', () => {
    const legacyRow = {
      id: 'legacy-1',
      employee_id: 'employee-1',
      coach_id: 'coach-1',
      setting: 'training',
      how_was_today: 'good',
      checkin_date: '2026-08-28',
    };
    const formResponse = {
      id: 'response-1',
      status: 'submitted',
      answers: [{ question_id: 'setting', value_json: { selected: 'training' } }],
    };
    const serverPayload = buildCoachCheckinPayload({
      template: { id: 'coach-template' },
      responses: [formResponse, null],
      legacyRows: [legacyRow],
      coachMap: { 'coach-1': 'Coach One' },
    });

    assert.deepEqual(serverPayload.responses, [formResponse]);
    assert.equal(serverPayload.legacy[0].id, 'legacy-1');
    assert.equal(serverPayload.legacy[0].setting, 'training');
    assert.equal(serverPayload.legacy[0].coach_name, 'Coach One');

    const clientPayload = normalizeCoachCheckinPayload(serverPayload);
    assert.deepEqual(clientPayload.responses, [formResponse]);
    assert.deepEqual(clientPayload.legacy, [serverPayload.legacy[0]]);
    assert.equal(clientPayload.template?.id, 'coach-template');
  });

  test('handles a legacy-only payload when no active form template exists', () => {
    const legacyRow = {
      id: 'legacy-2',
      employee_id: 'employee-1',
      coach_id: 'coach-2',
      setting: 'event',
      checkin_date: '2025-11-03',
    };
    const payload = normalizeCoachCheckinPayload(buildCoachCheckinPayload({
      template: null,
      responses: [],
      legacyRows: [legacyRow],
      coachMap: {},
    }));

    assert.equal(payload.template, null);
    assert.deepEqual(payload.responses, []);
    assert.equal(payload.legacy[0].id, 'legacy-2');
    assert.equal(payload.legacy[0].setting, 'event');
    assert.equal(payload.legacy[0].coach_name, 'Unknown');
  });
});