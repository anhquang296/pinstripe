import type { UserRole } from '@contracts/users.types';
import { UserRoleEnum, UserStatusEnum } from '@contracts/users.types';
import { ConflictError } from '@errors/app.error';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';

const PASSWORD = 'correct horse battery staple';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeUser(
  role: UserRole = UserRoleEnum.MEMBER,
  password: string | undefined = PASSWORD,
) {
  return fastify.userService.createUser({
    email: `${generateGid(ObjectPrefixEnum.USER)}@users.test`,
    name: 'Dashboard Tester',
    role,
    password,
  });
}

function callAuth(path: string, body: Record<string, unknown>): Promise<Response> {
  const { ADMIN_UI_ORIGIN } = fastify.config;

  return fastify.betterAuth.handler(
    new Request(`${ADMIN_UI_ORIGIN}/api/v1/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ADMIN_UI_ORIGIN },
      body: JSON.stringify(body),
    }),
  );
}

async function signIn(email: string, password = PASSWORD): Promise<Headers> {
  const response = await callAuth('/sign-in/email', { email, password });
  const [sessionCookie] = response.headers.getSetCookie();

  if (!sessionCookie) {
    throw new Error(`test fixture could not sign in, status ${response.status}`);
  }

  return new Headers({ cookie: sessionCookie.split(';')[0] ?? '' });
}

describe('UserService.createUser', () => {
  it('stores the email lowercased and trimmed', async () => {
    const email = `${generateGid(ObjectPrefixEnum.USER)}@USERS.test`;

    const user = await fastify.userService.createUser({
      email: `  ${email}  `,
      name: 'Casing',
      role: UserRoleEnum.MEMBER,
    });

    expect(user.email).toBe(email.toLowerCase());
    expect(user.status).toBe(UserStatusEnum.ACTIVE);
  });

  it('throws ConflictError when the email is already taken', async () => {
    const user = await makeUser();

    await expect(
      fastify.userService.createUser({
        email: user.email.toUpperCase(),
        name: 'Duplicate',
        role: UserRoleEnum.MEMBER,
      }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('better-auth email sign-in', () => {
  it('issues a session that resolves to the user and its role', async () => {
    const user = await makeUser(UserRoleEnum.MODERATOR);
    const headers = await signIn(user.email);

    const session = await fastify.betterAuth.getSession(headers);

    expect(session?.user.id).toBe(user.id);
    expect(session?.user.role).toBe(UserRoleEnum.MODERATOR);
  });

  it('prefixes the ids it generates like every other table', async () => {
    const user = await makeUser();
    const headers = await signIn(user.email);

    const session = await fastify.betterAuth.getSession(headers);

    expect(user.id).toMatch(/^usr_/);
    expect(session?.session.id).toMatch(/^ases_/);
  });

  it('answers a wrong password and an unknown email with the same 401', async () => {
    const user = await makeUser();

    const wrongPassword = await callAuth('/sign-in/email', {
      email: user.email,
      password: 'wrong password entirely',
    });
    const unknownEmail = await callAuth('/sign-in/email', {
      email: 'nobody@users.test',
      password: PASSWORD,
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
  });

  it('refuses self sign-up, because every user is invited', async () => {
    const response = await callAuth('/sign-up/email', {
      email: `${generateGid(ObjectPrefixEnum.USER)}@users.test`,
      password: PASSWORD,
      name: 'Walk In',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'EMAIL_PASSWORD_SIGN_UP_DISABLED' });
  });

  it('refuses a disabled user with the right password', async () => {
    const user = await makeUser();
    await fastify.userService.updateUser(user.id, { status: UserStatusEnum.DISABLED });

    const response = await callAuth('/sign-in/email', { email: user.email, password: PASSWORD });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'BANNED_USER' });
  });

  it('lets a user invited without a password sign in once an admin sets one', async () => {
    const user = await makeUser(UserRoleEnum.MEMBER, undefined);
    await fastify.userService.updateUser(user.id, { password: PASSWORD });

    const headers = await signIn(user.email);
    const session = await fastify.betterAuth.getSession(headers);

    expect(session?.user.id).toBe(user.id);
  });
});

describe('UserService.updateUser', () => {
  it('revokes live sessions when the role changes, so the old permissions die with them', async () => {
    const user = await makeUser(UserRoleEnum.MODERATOR);
    const headers = await signIn(user.email);
    await fastify.userService.updateUser(user.id, { role: UserRoleEnum.MEMBER });

    const session = await fastify.betterAuth.getSession(headers);

    expect(session).toBeNull();
  });

  it('keeps live sessions when only the name changes', async () => {
    const user = await makeUser();
    const headers = await signIn(user.email);
    await fastify.userService.updateUser(user.id, { name: 'Renamed' });

    const session = await fastify.betterAuth.getSession(headers);

    expect(session?.user.name).toBe('Renamed');
  });

  it('throws ConflictError when demoting the last active admin', async () => {
    const user = await makeUser(UserRoleEnum.ADMIN);
    const activeAdmins = await fastify.userRepository.findUsers(
      { role: UserRoleEnum.ADMIN, banned: false },
      100,
    );

    for (const activeAdmin of activeAdmins) {
      if (activeAdmin.id !== user.id) {
        await fastify.betterAuth.updateUser(activeAdmin.id, { banned: true });
      }
    }

    await expect(
      fastify.userService.updateUser(user.id, { role: UserRoleEnum.MEMBER }),
    ).rejects.toThrow(ConflictError);
  });

  it('lets an admin be demoted while another active admin remains', async () => {
    await makeUser(UserRoleEnum.ADMIN);
    const user = await makeUser(UserRoleEnum.ADMIN);

    const updatedUser = await fastify.userService.updateUser(user.id, {
      role: UserRoleEnum.MODERATOR,
    });

    expect(updatedUser.role).toBe(UserRoleEnum.MODERATOR);
  });
});
