import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { UserRole } from '@contracts/users.types';
import type { DatabaseClient } from '@database/database.client';
import type { User } from '@database/schemas';
import { users } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface UserFilters {
  email?: string;
  role?: UserRole;
  banned?: boolean;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class UserRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getUser(id: string): Promise<User> {
    const user = await this.findUser(id);

    if (user) {
      return user;
    }

    throw new NotFoundError(`No such user: ${id}`);
  }

  async findUser(id: string): Promise<User | null> {
    const [user] = await this._db.master.select().from(users).where(eq(users.id, id)).limit(1);

    return user ?? null;
  }

  async findUsers(filters: UserFilters = {}, limit = DEFAULT_QUERY_LIMIT): Promise<User[]> {
    return this._db.master
      .select()
      .from(users)
      .where(UserRepository.buildWhere(filters))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(limit);
  }

  async countUsers(filters: UserFilters = {}): Promise<number> {
    const [row] = await this._db.master
      .select({ total: count() })
      .from(users)
      .where(UserRepository.buildWhere(filters));

    return _.get(row, 'total', 0);
  }

  private static buildWhere(filters: UserFilters) {
    return and(
      filters.email ? eq(users.email, filters.email) : undefined,
      filters.role ? eq(users.role, filters.role) : undefined,
      _.isBoolean(filters.banned) ? eq(users.banned, filters.banned) : undefined,
      filters.beforeAt
        ? sql`(${users.createdAt}, ${users.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${users.createdAt}, ${users.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );
  }
}
