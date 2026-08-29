import express from 'express';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { eq, inArray } from 'drizzle-orm';
import { registerRoutes } from '../server/routes';
import { db, pool } from '../server/db';
import { generateToken, type AuthUser } from '../server/auth';
import {
  coach_assignments,
  coach_checkins,
  coach_notes,
  employees,
  guardian_notes,
  guardian_relationships,
  profile_notes,
} from '../shared/schema';
import {
  buildNotesFeed,
  isNotesWriterRole,
  plainTextFromRichContent,
} from '../shared/notesFeed';

const fixtureId = `notes-feed-test-${randomUUID()}`;
const ids = {
  target: `${fixtureId}-target`,
  nonScooper: `${fixtureId}-non-scooper`,
  linkedGuardian: `${fixtureId}-linked-guardian`,
  unrelatedGuardian: `${fixtureId}-unrelated-guardian`,
  assignedCoach: `${fixtureId}-assigned-coach`,
  unrelatedCoach: `${fixtureId}-unrelated-coach`,
  administrator: `${fixtureId}-administrator`,
  guardianNote: `${fixtureId}-guardian-note`,
  coachNote: `${fixtureId}-coach-note`,
  guardianAuthorNote: `${fixtureId}-guardian-author-note`,
  guardianAdminNote: `${fixtureId}-guardian-admin-note`,
  coachAuthorNote: `${fixtureId}-coach-author-note`,
  coachAdminNote: `${fixtureId}-coach-admin-note`,
  checkin: `${fixtureId}-checkin`,
  profileNote: `${fixtureId}-profile-note`,
};

const identities = {
  linkedGuardian: {
    id: ids.linkedGuardian,
    email: `${ids.linkedGuardian}@example.test`,
    name: 'Linked Guardian',
    role: 'Guardian',
    userType: 'employee',
  },
  unrelatedGuardian: {
    id: ids.unrelatedGuardian,
    email: `${ids.unrelatedGuardian}@example.test`,
    name: 'Unrelated Guardian',
    role: 'Guardian',
    userType: 'employee',
  },
  assignedCoach: {
    id: ids.assignedCoach,
    email: `${ids.assignedCoach}@example.test`,
    name: 'Assigned Coach',
    role: 'Job Coach',
    userType: 'employee',
  },
  unrelatedCoach: {
    id: ids.unrelatedCoach,
    email: `${ids.unrelatedCoach}@example.test`,
    name: 'Unrelated Coach',
    role: 'Job Coach',
    userType: 'employee',
  },
  administrator: {
    id: ids.administrator,
    email: `${ids.administrator}@example.test`,
    name: 'Administrator',
    role: 'Administrator',
    userType: 'employee',
  },
  superScooper: {
    id: ids.target,
    email: `${ids.target}@example.test`,
    name: 'Super Scooper',
    role: 'Super Scooper',
    userType: 'employee',
  },
} satisfies Record<string, AuthUser>;

let httpServer: Awaited<ReturnType<typeof registerRoutes>>;
let baseUrl = '';

async function request(
  method: string,
  path: string,
  user: AuthUser,
  body?: Record<string, unknown>,
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${generateToken(user)}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json() as Record<string, any>;
  return { status: response.status, data };
}

async function seedNotesFeedFixtures() {
  await db.insert(employees).values([
    {
      id: ids.target,
      name: 'Super Scooper',
      email: identities.superScooper.email,
      role: 'Super Scooper',
      is_active: true,
      has_system_access: true,
    },
    {
      id: ids.nonScooper,
      name: 'Not a Super Scooper',
      email: `${ids.nonScooper}@example.test`,
      role: 'Job Coach',
      is_active: true,
      has_system_access: true,
    },
    ...[
      identities.linkedGuardian,
      identities.unrelatedGuardian,
      identities.assignedCoach,
      identities.unrelatedCoach,
      identities.administrator,
    ].map(user => ({
      id: user.id,
      name: user.name!,
      email: user.email,
      role: user.role,
      is_active: true,
      has_system_access: true,
    })),
  ]);

  await db.insert(guardian_relationships).values({
    guardian_id: ids.linkedGuardian,
    scooper_id: ids.target,
    assigned_by: ids.administrator,
  });
  await db.insert(coach_assignments).values({
    coach_id: ids.assignedCoach,
    scooper_id: ids.target,
    assigned_by: ids.administrator,
  });
  await db.insert(guardian_notes).values({
    id: ids.guardianNote,
    guardian_id: ids.linkedGuardian,
    scooper_id: ids.target,
    note: 'Family note before authorization test',
  });
  await db.insert(guardian_notes).values([
    {
      id: ids.guardianAuthorNote,
      guardian_id: ids.linkedGuardian,
      scooper_id: ids.target,
      note: 'Guardian-authored compatibility note',
    },
    {
      id: ids.guardianAdminNote,
      guardian_id: ids.linkedGuardian,
      scooper_id: ids.target,
      note: 'Administrator-managed guardian compatibility note',
    },
  ]);
  await db.insert(coach_notes).values({
    id: ids.coachNote,
    employee_id: ids.target,
    coach_id: ids.assignedCoach,
    title: 'Support note',
    content: 'Coach note before authorization test',
  });
  await db.insert(coach_notes).values([
    {
      id: ids.coachAuthorNote,
      employee_id: ids.target,
      coach_id: ids.assignedCoach,
      title: 'Coach-authored compatibility note',
      content: 'Coach-authored compatibility content',
    },
    {
      id: ids.coachAdminNote,
      employee_id: ids.target,
      coach_id: ids.assignedCoach,
      title: 'Administrator-managed coach compatibility note',
      content: 'Administrator-managed coach compatibility content',
    },
  ]);
  await db.insert(coach_checkins).values({
    id: ids.checkin,
    employee_id: ids.target,
    coach_id: ids.assignedCoach,
    setting: 'Work site',
    how_was_today: 'Good',
    independence: 'Independent',
    engagement: 'Engaged',
    big_win: true,
    big_win_type: 'Communication',
    challenge: 'None',
    safety_concern: false,
    compared_to_last: 'Same',
    support_helped: 'Prompting',
    notes: 'Linked check-in note that cannot be edited as a feed item',
  });
  await db.insert(profile_notes).values({
    id: ids.profileNote,
    scooper_id: ids.target,
    author_id: ids.assignedCoach,
    author_role_snapshot: 'Job Coach',
    body: 'Durable profile update before authorization test',
    source_type: 'support_update',
  });
}

async function cleanupNotesFeedFixtures() {
  await db.delete(profile_notes).where(eq(profile_notes.scooper_id, ids.target));
  await db.delete(guardian_notes).where(eq(guardian_notes.scooper_id, ids.target));
  await db.delete(coach_notes).where(eq(coach_notes.employee_id, ids.target));
  await db.delete(coach_checkins).where(inArray(coach_checkins.id, [ids.checkin]));
  await db.delete(guardian_relationships).where(eq(guardian_relationships.scooper_id, ids.target));
  await db.delete(coach_assignments).where(eq(coach_assignments.scooper_id, ids.target));
  await db.delete(employees).where(inArray(
    employees.id,
    Object.values(ids).filter(id => ![ids.guardianNote, ids.coachNote, ids.checkin, ids.profileNote].includes(id)),
  ));
}

before(async () => {
  await seedNotesFeedFixtures();

  const app = express();
  app.use(express.json());
  httpServer = await registerRoutes(app);
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(0, '127.0.0.1', () => resolve());
    httpServer.once('error', reject);
  });
  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Notes feed test server did not expose a TCP address');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});


after(async () => {
  if (httpServer) {
    await new Promise<void>((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve()));
  }
  await cleanupNotesFeedFixtures();
  await pool.end();
});

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
    assert.match(schema, /export const profile_notes = pgTable\("profile_notes"/);
    assert.doesNotMatch(schema, /uniqueGuardianScooperNote/);
  });
});

describe('Unified notes feed authenticated authorization', () => {
  test('allows linked guardians, assigned staff, administrators, and a scooper to view only valid scooper profiles', async () => {
    const linkedGuardianResponse = await request(
      'GET',
      `/api/scoopers/${ids.target}/notes-feed`,
      identities.linkedGuardian,
    );
    assert.equal(linkedGuardianResponse.status, 200);
    assert.equal(linkedGuardianResponse.data.permissions.can_write, true);
    assert.ok(linkedGuardianResponse.data.notes.some((note: any) => note.sourceId === ids.guardianNote));
    assert.ok(linkedGuardianResponse.data.notes.some((note: any) => (
      note.sourceType === 'profile'
      && note.sourceId === ids.profileNote
      && note.noteType === 'support_update'
    )));

    const assignedCoachResponse = await request(
      'GET',
      `/api/scoopers/${ids.target}/notes-feed`,
      identities.assignedCoach,
    );
    assert.equal(assignedCoachResponse.status, 200);
    assert.equal(assignedCoachResponse.data.permissions.can_write, true);

    const administratorResponse = await request(
      'GET',
      `/api/scoopers/${ids.target}/notes-feed`,
      identities.administrator,
    );
    assert.equal(administratorResponse.status, 200);
    assert.equal(administratorResponse.data.permissions.can_delete_any, true);

    const superScooperResponse = await request(
      'GET',
      `/api/scoopers/${ids.target}/notes-feed`,
      identities.superScooper,
    );
    assert.equal(superScooperResponse.status, 200);
    assert.equal(superScooperResponse.data.permissions.can_write, false);

    for (const user of [identities.unrelatedGuardian, identities.unrelatedCoach]) {
      const response = await request('GET', `/api/scoopers/${ids.target}/notes-feed`, user);
      assert.equal(response.status, 403);
      assert.equal(response.data.error, 'You do not have access to this profile');
    }
  });

  test('allows authors to edit their own notes, lets administrators delete notes, and rejects check-in mutations', async () => {
    const guardianUpdate = await request(
      'PUT',
      `/api/scoopers/${ids.target}/notes-feed/guardian/${ids.guardianNote}`,
      identities.linkedGuardian,
      { body: 'Updated family note' },
    );
    assert.equal(guardianUpdate.status, 200);
    assert.equal(guardianUpdate.data.body, 'Updated family note');

    const coachUpdate = await request(
      'PUT',
      `/api/scoopers/${ids.target}/notes-feed/coach/${ids.coachNote}`,
      identities.assignedCoach,
      { body: 'Updated coach note' },
    );
    assert.equal(coachUpdate.status, 200);
    assert.equal(coachUpdate.data.body, 'Updated coach note');

    const coachNotesBeforeCreate = await db.select({ id: coach_notes.id })
      .from(coach_notes)
      .where(eq(coach_notes.employee_id, ids.target));
    const profileCreate = await request(
      'POST',
      `/api/scoopers/${ids.target}/notes-feed`,
      identities.assignedCoach,
      { body: 'New shared profile update' },
    );
    assert.equal(profileCreate.status, 201);
    assert.equal(profileCreate.data.sourceType, 'profile');
    assert.equal(profileCreate.data.noteType, 'manual');
    assert.equal(profileCreate.data.body, 'New shared profile update');

    const [storedProfileNote] = await db.select().from(profile_notes)
      .where(eq(profile_notes.id, profileCreate.data.sourceId));
    assert.equal(storedProfileNote.scooper_id, ids.target);
    assert.equal(storedProfileNote.author_id, ids.assignedCoach);
    assert.equal(storedProfileNote.author_role_snapshot, 'Job Coach');
    assert.equal(storedProfileNote.status, 'active');

    const coachNotesAfterCreate = await db.select({ id: coach_notes.id })
      .from(coach_notes)
      .where(eq(coach_notes.employee_id, ids.target));
    assert.equal(coachNotesAfterCreate.length, coachNotesBeforeCreate.length);

    const profileUpdate = await request(
      'PUT',
      `/api/scoopers/${ids.target}/notes-feed/profile/${profileCreate.data.sourceId}`,
      identities.assignedCoach,
      { body: 'Updated shared profile update' },
    );
    assert.equal(profileUpdate.status, 200);
    assert.equal(profileUpdate.data.body, 'Updated shared profile update');

    const profileUpdateByAnotherAuthor = await request(
      'PUT',
      `/api/scoopers/${ids.target}/notes-feed/profile/${profileCreate.data.sourceId}`,
      identities.linkedGuardian,
      { body: 'Must not replace another author’s profile update' },
    );
    assert.equal(profileUpdateByAnotherAuthor.status, 403);
    assert.equal(profileUpdateByAnotherAuthor.data.error, 'You can only edit your own notes');

    const checkinUpdate = await request(
      'PUT',
      `/api/scoopers/${ids.target}/notes-feed/checkin/${ids.checkin}`,
      identities.assignedCoach,
      { body: 'Must not update a check-in' },
    );
    assert.equal(checkinUpdate.status, 400);
    assert.equal(checkinUpdate.data.error, 'This feed item cannot be edited');

    const checkinDelete = await request(
      'DELETE',
      `/api/scoopers/${ids.target}/notes-feed/checkin/${ids.checkin}`,
      identities.administrator,
    );
    assert.equal(checkinDelete.status, 400);
    assert.equal(checkinDelete.data.error, 'This feed item cannot be deleted');

    const profileDelete = await request(
      'DELETE',
      `/api/scoopers/${ids.target}/notes-feed/profile/${profileCreate.data.sourceId}`,
      identities.administrator,
    );
    assert.equal(profileDelete.status, 200);
    assert.deepEqual(profileDelete.data, { success: true });
    const [deletedProfileNote] = await db.select().from(profile_notes)
      .where(eq(profile_notes.id, profileCreate.data.sourceId));
    assert.equal(deletedProfileNote.status, 'deleted');

    const administratorDelete = await request(
      'DELETE',
      `/api/scoopers/${ids.target}/notes-feed/guardian/${ids.guardianNote}`,
      identities.administrator,
    );
    assert.equal(administratorDelete.status, 200);
    assert.deepEqual(administratorDelete.data, { success: true });
  });

  test('rejects feed mutations for non-Super-Scooper targets before touching note data', async () => {
    const createResponse = await request(
      'POST',
      `/api/scoopers/${ids.nonScooper}/notes-feed`,
      identities.linkedGuardian,
      { body: 'Must not be created' },
    );
    assert.equal(createResponse.status, 404);
    assert.equal(createResponse.data.error, 'Scooper profile not found');

    const updateResponse = await request(
      'PUT',
      `/api/scoopers/${ids.nonScooper}/notes-feed/coach/${ids.coachNote}`,
      identities.assignedCoach,
      { body: 'Must not be updated' },
    );
    assert.equal(updateResponse.status, 404);
    assert.equal(updateResponse.data.error, 'Scooper profile not found');

    const deleteResponse = await request(
      'DELETE',
      `/api/scoopers/${ids.nonScooper}/notes-feed/guardian/${ids.guardianNote}`,
      identities.administrator,
    );
    assert.equal(deleteResponse.status, 404);
    assert.equal(deleteResponse.data.error, 'Scooper profile not found');
  });
});

describe('Legacy note endpoint authenticated authorization', () => {
  test('limits compatibility reads and creates to linked guardians and assigned Job Coaches', async () => {
    const guardianRead = await request(
      'GET',
      `/api/guardian-notes/scooper/${ids.target}`,
      identities.linkedGuardian,
    );
    assert.equal(guardianRead.status, 200);
    assert.ok(guardianRead.data.some((note: any) => note.id === ids.guardianAuthorNote));

    const guardianByAuthorRead = await request(
      'GET',
      `/api/guardian-notes/guardian/${ids.linkedGuardian}`,
      identities.assignedCoach,
    );
    assert.equal(guardianByAuthorRead.status, 200);
    assert.ok(guardianByAuthorRead.data.some((note: any) => note.id === ids.guardianAdminNote));

    const coachRead = await request(
      'GET',
      `/api/coach-notes/${ids.target}`,
      identities.assignedCoach,
    );
    assert.equal(coachRead.status, 200);
    assert.ok(coachRead.data.some((note: any) => note.id === ids.coachAuthorNote));

    const guardianCreate = await request(
      'POST',
      '/api/guardian-notes',
      identities.linkedGuardian,
      {
        guardian_id: ids.linkedGuardian,
        scooper_id: ids.target,
        note: 'Authorized legacy guardian creation',
      },
    );
    assert.equal(guardianCreate.status, 200);

    const coachCreate = await request(
      'POST',
      '/api/coach-notes',
      identities.assignedCoach,
      {
        employee_id: ids.target,
        title: 'Authorized legacy coach creation',
        content: 'Assigned coach compatibility route',
      },
    );
    assert.equal(coachCreate.status, 200);

    const deniedRequests = [
      request('GET', `/api/guardian-notes/scooper/${ids.target}`, identities.unrelatedGuardian),
      request('GET', `/api/guardian-notes/guardian/${ids.linkedGuardian}`, identities.unrelatedCoach),
      request('GET', `/api/coach-notes/${ids.target}`, identities.unrelatedCoach),
      request('POST', '/api/guardian-notes', identities.unrelatedGuardian, {
        guardian_id: ids.unrelatedGuardian,
        scooper_id: ids.target,
        note: 'Must not be created',
      }),
      request('POST', '/api/coach-notes', identities.unrelatedCoach, {
        employee_id: ids.target,
        title: 'Must not be created',
        content: 'Must not be created',
      }),
    ];
    for (const response of await Promise.all(deniedRequests)) {
      assert.equal(response.status, 403);
    }
  });

  test('checks profile access before allowing original-author or Administrator mutations', async () => {
    const deniedGuardianUpdate = await request(
      'PUT',
      `/api/guardian-notes/${ids.guardianAdminNote}`,
      identities.unrelatedGuardian,
      { note: 'Must not replace guardian note' },
    );
    assert.equal(deniedGuardianUpdate.status, 403);
    assert.equal(deniedGuardianUpdate.data.error, 'You do not have access to this profile');

    const deniedCoachDelete = await request(
      'DELETE',
      `/api/coach-notes/${ids.coachAdminNote}`,
      identities.unrelatedCoach,
    );
    assert.equal(deniedCoachDelete.status, 403);
    assert.equal(deniedCoachDelete.data.error, 'You do not have access to this profile');

    const guardianAuthorUpdate = await request(
      'PUT',
      `/api/guardian-notes/${ids.guardianAuthorNote}`,
      identities.linkedGuardian,
      { note: 'Guardian author updated compatibility note' },
    );
    assert.equal(guardianAuthorUpdate.status, 200);
    assert.equal(guardianAuthorUpdate.data.note, 'Guardian author updated compatibility note');

    const coachAuthorUpdate = await request(
      'PUT',
      `/api/coach-notes/${ids.coachAuthorNote}`,
      identities.assignedCoach,
      { content: 'Coach author updated compatibility note' },
    );
    assert.equal(coachAuthorUpdate.status, 200);
    assert.equal(coachAuthorUpdate.data.content, 'Coach author updated compatibility note');

    const guardianAdminUpdate = await request(
      'PUT',
      `/api/guardian-notes/${ids.guardianAdminNote}`,
      identities.administrator,
      { note: 'Administrator updated guardian compatibility note' },
    );
    assert.equal(guardianAdminUpdate.status, 200);

    const coachAdminUpdate = await request(
      'PUT',
      `/api/coach-notes/${ids.coachAdminNote}`,
      identities.administrator,
      { content: 'Administrator updated coach compatibility note' },
    );
    assert.equal(coachAdminUpdate.status, 200);

    const coachAuthorDelete = await request(
      'DELETE',
      `/api/coach-notes/${ids.coachAuthorNote}`,
      identities.assignedCoach,
    );
    assert.equal(coachAuthorDelete.status, 200);

    const guardianAdminDelete = await request(
      'DELETE',
      `/api/guardian-notes/${ids.guardianAuthorNote}`,
      identities.administrator,
    );
    assert.equal(guardianAdminDelete.status, 200);

    const secondGuardianAdminDelete = await request(
      'DELETE',
      `/api/guardian-notes/${ids.guardianAdminNote}`,
      identities.administrator,
    );
    assert.equal(secondGuardianAdminDelete.status, 200);

    const coachAdminDelete = await request(
      'DELETE',
      `/api/coach-notes/${ids.coachAdminNote}`,
      identities.administrator,
    );
    assert.equal(coachAdminDelete.status, 200);
  });
});
