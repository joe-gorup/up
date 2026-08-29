import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONTACT_RELATIONSHIP_OPTIONS,
  DEFAULT_PROFILE_FIELDS,
  cleanProfileFieldValues,
  isCatalogRoleMatch,
  normalizeCatalogKey,
} from '../shared/profileCatalog';

test('profile catalog seeds the legacy support fields and contact options', () => {
  assert.deepEqual(
    DEFAULT_PROFILE_FIELDS.map(field => field.key),
    ['interests_motivators', 'challenges', 'regulation_strategies', 'accommodations', 'allergies'],
  );
  assert.equal(DEFAULT_CONTACT_RELATIONSHIP_OPTIONS[0].label, 'Parent/Guardian');
  assert.equal(DEFAULT_CONTACT_RELATIONSHIP_OPTIONS.length, 7);
});

test('profile catalog keys are normalized into stable storage keys', () => {
  assert.equal(normalizeCatalogKey('  Sensory Supports! '), 'sensory_supports');
  assert.equal(normalizeCatalogKey('Already_valid_2'), 'already_valid_2');
  assert.equal(normalizeCatalogKey('!!!'), '');
});

test('profile catalog values only accept bounded string lists', () => {
  assert.deepEqual(
    cleanProfileFieldValues({ sensory_supports: ['  Headphones ', '', 'Quiet room'] }),
    { sensory_supports: ['Headphones', 'Quiet room'] },
  );
  assert.equal(cleanProfileFieldValues({ sensory_supports: 'headphones' }), null);
  assert.equal(cleanProfileFieldValues({ 'Invalid Key': ['value'] }), null);
  assert.equal(cleanProfileFieldValues({ sensory_supports: ['ok', 42] }), null);
});

test('profile catalog role filters default to an explicit role list', () => {
  assert.equal(isCatalogRoleMatch(['Super Scooper'], 'Super Scooper'), true);
  assert.equal(isCatalogRoleMatch(['Super Scooper'], 'Job Coach'), false);
  assert.equal(isCatalogRoleMatch([], 'Job Coach'), true);
  assert.equal(isCatalogRoleMatch(undefined, 'Guardian'), true);
});