import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildNotesFeed,
  isNotesWriterRole,
  plainTextFromRichContent,
} from '../shared/notesFeed';

describe('Unified notes feed helpers', () => {
  test('orders all sources newest first without dropping same-author entries', () => {
    const feed = buildNotesFeed([
      {
        id: 'guardian:older',
        sourceType: 'guardian',
        sourceId: 'older',
        body: 'Older family update',
        authorId: 'guardian-1',
        authorName: 'Taylor Guardian',
        authorRole: 'Guardian',
        createdAt: '2026-08-25T10:00:00.000Z',
      },
      {
        id: 'guardian:newer',
        sourceType: 'guardian',
        sourceId: 'newer',
        body: 'Newer family update',
        authorId: 'guardian-1',
        authorName: 'Taylor Guardian',
        authorRole: 'Guardian',
        createdAt: '2026-08-28T10:00:00.000Z',
      },
      {
        id: 'coach:middle',
        sourceType: 'coach',
        sourceId: 'middle',
        body: 'Coach update',
        authorId: 'coach-1',
        authorName: 'Jordan Coach',
        authorRole: 'Job Coach',
        createdAt: '2026-08-27T10:00:00.000Z',
      },
    ]);

    assert.deepEqual(feed.map(entry => entry.id), [
      'guardian:newer',
      'coach:middle',
      'guardian:older',
    ]);
  });

  test('turns TipTap JSON into readable plain text and preserves plain notes', () => {
    const richContent = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First line' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second line' }] },
      ],
    });

    assert.equal(plainTextFromRichContent(richContent), 'First line\nSecond line');
    assert.equal(plainTextFromRichContent('A legacy plain-text note'), 'A legacy plain-text note');
    assert.equal(plainTextFromRichContent('<p>Legacy HTML note</p>'), 'Legacy HTML note');
  });

  test('limits writing to the roles locked for T5', () => {
    assert.equal(isNotesWriterRole('Guardian'), true);
    assert.equal(isNotesWriterRole('Job Coach'), true);
    assert.equal(isNotesWriterRole('Shift Lead'), true);
    assert.equal(isNotesWriterRole('Administrator'), true);
    assert.equal(isNotesWriterRole('Assistant Manager'), false);
    assert.equal(isNotesWriterRole('Super Scooper'), false);
  });
});

describe('Unified notes feed integration contract', () => {
  test('keeps legacy note routes while exposing source-aware feed operations', () => {
    const routes = readFileSync('server/routes.ts', 'utf8');
    const schema = readFileSync('shared/schema.ts', 'utf8');

    assert.match(routes, /app\.get\("\/api\/scoopers\/:scooperId\/notes-feed"/);
    assert.match(routes, /app\.post\("\/api\/scoopers\/:scooperId\/notes-feed"/);
    assert.match(routes, /app\.put\("\/api\/scoopers\/:scooperId\/notes-feed\/:sourceType\/:sourceId"/);
    assert.match(routes, /app\.delete\("\/api\/scoopers\/:scooperId\/notes-feed\/:sourceType\/:sourceId"/);
    assert.match(routes, /app\.get\("\/api\/guardian-notes\/scooper\/:scooperId"/);
    assert.match(routes, /app\.get\("\/api\/coach-notes\/:employeeId"/);
    assert.doesNotMatch(schema, /uniqueGuardianScooperNote/);
  });
});