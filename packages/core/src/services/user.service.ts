import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  AccountResponse,
  CreateUserPayload,
  FindUsersQuery,
  UpdateUserPayload,
  UserResponse,
  UserRole,
} from '@contracts/users.types';
import { ROLE_PERMISSIONS, UserRoleEnum, UserStatusEnum } from '@contracts/users.types';
import type { User } from '@database/schemas';
import { ConflictError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class UserService {
  constructor(private readonly fastify: FastifyInstance) {}

  async findUsers(query: FindUsersQuery): Promise<ListResponse<UserResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT, role, status } = query;

    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);
    const banned = status ? status === UserStatusEnum.DISABLED : undefined;

    const rows = await this.fastify.userRepository.findUsers(
      { role, banned, beforeAt, afterAt },
      limit + 1,
    );

    return {
      url: '/api/v1/admin/users',
      hasMore: rows.length > limit,
      data: _(rows).take(limit).map(UserService.buildUser).value(),
    };
  }

  async getUser(id: string): Promise<UserResponse> {
    const user = await this.fastify.userRepository.getUser(id);

    return UserService.buildUser(user);
  }

  async getAccount(id: string): Promise<AccountResponse> {
    const user = await this.fastify.userRepository.getUser(id);

    return UserService.buildAccount(user);
  }

  async findUser({ email }: { email: string }): Promise<User | null> {
    const [user] = await this.fastify.userRepository.findUsers(
      { email: UserService.normalizeEmail(email) },
      1,
    );

    return user ?? null;
  }

  async createUser(payload: CreateUserPayload): Promise<UserResponse> {
    const email = UserService.normalizeEmail(payload.email);
    const user = await this.findUser({ email });

    if (user) {
      throw new ConflictError(`A user with email ${email} already exists`, { param: 'email' });
    }

    const userId = await this.fastify.betterAuth.createUser({
      email,
      name: payload.name,
      role: payload.role,
      password: payload.password,
    });

    this.fastify.log.info({ userId, role: payload.role }, '[UserService] createUser() success');

    return this.getUser(userId);
  }

  async ensureUser(payload: CreateUserPayload): Promise<UserResponse> {
    const user = await this.findUser({ email: payload.email });

    if (user) {
      return UserService.buildUser(user);
    }

    return this.createUser(payload);
  }

  async updateUser(id: string, payload: UpdateUserPayload): Promise<UserResponse> {
    const user = await this.fastify.userRepository.getUser(id);

    const { role = user.role, status } = payload;

    const banned = status ? status === UserStatusEnum.DISABLED : user.banned;

    await this.ensureAdminRemains(user, role, banned);

    await this.fastify.betterAuth.updateUser(id, { name: payload.name, role, banned });

    if (payload.password) {
      await this.fastify.betterAuth.setUserPassword(id, payload.password);
    }

    const shouldRevokeSessions = role !== user.role || banned || Boolean(payload.password);

    if (shouldRevokeSessions) {
      await this.fastify.betterAuth.revokeUserSessions(id);
    }

    this.fastify.log.info(
      { userId: id, role, banned, shouldRevokeSessions },
      '[UserService] updateUser() success',
    );

    return this.getUser(id);
  }

  private async ensureAdminRemains(user: User, role: UserRole, banned: boolean): Promise<void> {
    const isActiveAdmin = user.role === UserRoleEnum.ADMIN && !user.banned;
    const isLeavingAdmin = isActiveAdmin && (role !== UserRoleEnum.ADMIN || banned);

    if (isLeavingAdmin) {
      const activeAdminCount = await this.fastify.userRepository.countUsers({
        role: UserRoleEnum.ADMIN,
        banned: false,
      });

      if (activeAdminCount > 1) {
        return;
      }

      throw new ConflictError('The last active admin cannot be demoted or disabled');
    }
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const user = await this.fastify.userRepository.getUser(id);

      return { createdAt: user.createdAt.toISOString(), id: user.id };
    }

    return undefined;
  }

  static normalizeEmail(email: string): string {
    return _.toLower(_.trim(email));
  }

  static buildAccount(user: User): AccountResponse {
    return {
      user: UserService.buildUser(user),
      permissions: [...ROLE_PERMISSIONS[user.role]],
    };
  }

  static buildUser(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.banned ? UserStatusEnum.DISABLED : UserStatusEnum.ACTIVE,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
