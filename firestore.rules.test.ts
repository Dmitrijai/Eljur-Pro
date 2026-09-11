import { describe, it, before, after, beforeEach } from 'node:test';
import fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

/**
 * Real Firestore Emulator Security Rules Tests
 * Verifies strict ABAC rules using the /authUidMap/{uid} mapping table.
 * All tests run against the single active firestore.rules file (zero bypasses).
 */

describe('Firestore Rules Security Invariants (Unified Test Suite)', () => {
  let testEnv: RulesTestEnvironment;

  before(async () => {
    const hostPort = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8089';
    const [host, portStr] = hostPort.split(':');
    const port = parseInt(portStr, 10);
    const rules = fs.readFileSync('firestore.rules', 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: 'eljur-strict-rbac',
      firestore: { host, port, rules }
    });
  });

  after(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Seed test users in /authUidMap via admin context
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      // Teacher of School A
      await db.doc('authUidMap/teacher_A').set({
        schoolId: 'school_A',
        role: 'teacher',
        userId: 't_A'
      });
      await db.doc('schools/school_A/users/t_A').set({
        id: 't_A',
        schoolId: 'school_A',
        role: 'teacher',
        authUid: 'teacher_A'
      });

      // Student of School A
      await db.doc('authUidMap/student_A').set({
        schoolId: 'school_A',
        role: 'student',
        userId: 's_A'
      });
      await db.doc('schools/school_A/users/s_A').set({
        id: 's_A',
        schoolId: 'school_A',
        role: 'student',
        authUid: 'student_A'
      });

      // Director of School A
      await db.doc('authUidMap/dir_A').set({
        schoolId: 'school_A',
        role: 'director',
        userId: 'd_A'
      });
      await db.doc('schools/school_A/users/d_A').set({
        id: 'd_A',
        schoolId: 'school_A',
        role: 'director',
        authUid: 'dir_A'
      });

      // Teacher of School B
      await db.doc('authUidMap/teacher_B').set({
        schoolId: 'school_B',
        role: 'teacher',
        userId: 't_B'
      });
      await db.doc('schools/school_B/users/t_B').set({
        id: 't_B',
        schoolId: 'school_B',
        role: 'teacher',
        authUid: 'teacher_B'
      });

      // System Creator
      await db.doc('authUidMap/creator_1').set({
        schoolId: 'system',
        role: 'creator',
        userId: 'c_1'
      });
    });
  });

  it('Anonymous Access Denied: Unauthenticated read of users is strictly BLOCKED', async () => {
    const anon = testEnv.unauthenticatedContext();
    await assertFails(anon.firestore().collection('schools/school_A/users').get());
  });

  it('Anonymous Access Denied: Unauthenticated write to grades is strictly BLOCKED', async () => {
    const anon = testEnv.unauthenticatedContext();
    await assertFails(anon.firestore().doc('schools/school_A/grades/math').set({ value: 5 }));
  });

  it('Tenant Isolation: Teacher of School A is BLOCKED from reading School B data', async () => {
    const teacherA = testEnv.authenticatedContext('teacher_A');
    await assertFails(teacherA.firestore().collection('schools/school_B/users').get());
  });

  it('Tenant Isolation: Teacher of School A is BLOCKED from writing School B grades', async () => {
    const teacherA = testEnv.authenticatedContext('teacher_A');
    await assertFails(teacherA.firestore().doc('schools/school_B/grades/math').set({ value: 5 }));
  });

  it('Role Permissions: Student of School A is BLOCKED from writing grades', async () => {
    const studentA = testEnv.authenticatedContext('student_A');
    await assertFails(studentA.firestore().doc('schools/school_A/grades/math').set({ value: 5 }));
  });

  it('Role Permissions: Teacher of School A CAN write grades in own school', async () => {
    const teacherA = testEnv.authenticatedContext('teacher_A');
    await assertSucceeds(teacherA.firestore().doc('schools/school_A/grades/math').set({ value: 5, studentId: 's_A' }));
  });

  it('Role Permissions: Director of School A CAN manage users in own school', async () => {
    const directorA = testEnv.authenticatedContext('dir_A');
    await assertSucceeds(directorA.firestore().doc('schools/school_A/users/new_user').set({ name: 'New Student', role: 'student' }));
  });

  it('Super-Admin: Creator has multi-school read access', async () => {
    const creator = testEnv.authenticatedContext('creator_1');
    await assertSucceeds(creator.firestore().doc('schools/school_A').get());
    await assertSucceeds(creator.firestore().doc('schools/school_B').get());
  });

  it('authUidMap Security: Users can read only their own authUidMap document', async () => {
    const studentA = testEnv.authenticatedContext('student_A');
    await assertSucceeds(studentA.firestore().doc('authUidMap/student_A').get());
    await assertFails(studentA.firestore().doc('authUidMap/teacher_A').get());
  });

  it('DENIES self-escalation: newly registered user cannot assign themselves role creator without a matching users/ record', async () => {
    const freshUser = testEnv.authenticatedContext('brand_new_uid', {});
    await assertFails(
      freshUser.firestore().doc('authUidMap/brand_new_uid').set({
        role: 'creator', schoolId: 'global', userId: 'brand_new_uid'
      })
    );
  });

  it('DENIES self-escalation: user cannot assign mismatched role differing from users/ record', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('schools/school_A/users/student_bob').set({
        id: 'student_bob',
        role: 'student',
        schoolId: 'school_A'
      });
    });

    const studentUser = testEnv.authenticatedContext('bob_uid', {});
    await assertFails(
      studentUser.firestore().doc('authUidMap/bob_uid').set({
        role: 'director',
        schoolId: 'school_A',
        userId: 'student_bob'
      })
    );
  });

  it('ALLOWS legitimate user mapping when matching users/ record exists with matching authUid and role', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('schools/school_A/users/student_alice').set({
        id: 'student_alice',
        role: 'student',
        schoolId: 'school_A',
        authUid: 'alice_uid'
      });
    });

    const aliceUser = testEnv.authenticatedContext('alice_uid', {});
    await assertSucceeds(
      aliceUser.firestore().doc('authUidMap/alice_uid').set({
        role: 'student',
        schoolId: 'school_A',
        userId: 'student_alice'
      })
    );
  });

  it('P0-1 SECURITY: DENIES attacker from self-binding to existing user with mismatched authUid', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('schools/school_A/users/teacher_victim').set({
        id: 'teacher_victim',
        role: 'teacher',
        schoolId: 'school_A',
        authUid: 'legit_teacher_uid'
      });
    });

    // Attacker eve has their own UID, tries to claim teacher_victim's profile
    const attackerEve = testEnv.authenticatedContext('eve_attacker_uid', {});
    await assertFails(
      attackerEve.firestore().doc('authUidMap/eve_attacker_uid').set({
        role: 'teacher',
        schoolId: 'school_A',
        userId: 'teacher_victim'
      })
    );
  });

  it('P0-1 SECURITY: DENIES binding to user record with unassigned authUid', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('schools/school_A/users/unassigned_user').set({
        id: 'unassigned_user',
        role: 'student',
        schoolId: 'school_A'
      });
    });

    const attacker = testEnv.authenticatedContext('random_attacker_uid', {});
    await assertFails(
      attacker.firestore().doc('authUidMap/random_attacker_uid').set({
        role: 'student',
        schoolId: 'school_A',
        userId: 'unassigned_user'
      })
    );
  });

  it('P0-8 SECURITY: User CANNOT tamper with own role via self-update', async () => {
    const studentUser = testEnv.authenticatedContext('student_A', {});
    await assertFails(
      studentUser.firestore().doc('schools/school_A/users/s_A').update({
        role: 'director'
      })
    );
  });

  it('P0-8 SECURITY: User CANNOT tamper with own schoolId via self-update', async () => {
    const studentUser = testEnv.authenticatedContext('student_A', {});
    await assertFails(
      studentUser.firestore().doc('schools/school_A/users/s_A').update({
        schoolId: 'school_B'
      })
    );
  });

  it('P0-8 SECURITY: User CANNOT tamper with own authUid via self-update', async () => {
    const studentUser = testEnv.authenticatedContext('student_A', {});
    await assertFails(
      studentUser.firestore().doc('schools/school_A/users/s_A').update({
        authUid: 'new_uid_bypass'
      })
    );
  });

  it('P0-8 SECURITY: User CANNOT self-grant privileged permissions or teacherClasses', async () => {
    const studentUser = testEnv.authenticatedContext('student_A', {});
    await assertFails(
      studentUser.firestore().doc('schools/school_A/users/s_A').update({
        isAdministration: true,
        teacherClasses: ['10_A']
      })
    );
  });

  it('P0-8 SECURITY: User CAN update allowed profile settings (e.g. phone, language, theme)', async () => {
    const studentUser = testEnv.authenticatedContext('student_A', {});
    await assertSucceeds(
      studentUser.firestore().doc('schools/school_A/users/s_A').update({
        phone: '+79991234567',
        theme: 'dark'
      })
    );
  });

  it('ALLOWS unauthenticated read of schools/{schoolId}/publicConfig/creatorGate', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('schools/school_A/publicConfig/creatorGate').set({
        secretKey: 'Space',
        secretCount: 4
      });
    });

    const anon = testEnv.unauthenticatedContext();
    await assertSucceeds(anon.firestore().doc('schools/school_A/publicConfig/creatorGate').get());
  });

  it('DENIES creator privileges via email pattern match — self-registered "creatorXXX@..." must NOT become creator', async () => {
    const fakeCreator = testEnv.authenticatedContext('random_new_uid', { email: 'creator_totally_fake@evil.com' });
    await assertFails(
      fakeCreator.firestore().collection('schools/school_A/users').get()
    );
  });

  it('DENIES director from granting themselves or others the creator role', async () => {
    const director = testEnv.authenticatedContext('dir_A', {});
    await assertSucceeds(
      director.firestore().doc('schools/school_A/users/legit_student').set({
        role: 'student', name: 'Legit Student', schoolId: 'school_A', id: 'legit_student'
      })
    );
    await assertFails(
      director.firestore().doc('schools/school_A/users/backdoor_user').set({
        role: 'creator', name: 'Backdoor', schoolId: 'school_A', id: 'backdoor_user'
      })
    );
  });

  it('DENIES director of School A from modifying School B users', async () => {
    const directorA = testEnv.authenticatedContext('dir_A', {});
    await assertFails(
      directorA.firestore().doc('schools/school_B/users/target_user').set({
        role: 'student', name: 'Attacked User', schoolId: 'school_B', id: 'target_user'
      })
    );
  });
});


