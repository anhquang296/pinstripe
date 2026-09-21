import type {
  NewPortalMembership,
  NewPortalUser,
  PortalMembership,
  PortalUser,
} from '@database/schemas';
import { portalMemberships, portalUsers } from '@database/schemas';
import { DEFAULT_QUERY_LIMIT } from '@vxrerp/platform/constants';
import type { DatabaseClient } from '@vxrerp/platform/database';
import { NotFoundError } from '@vxrerp/platform/errors';
import { and, asc, eq, inArray } from 'drizzle-orm';
import _ from 'lodash';

export interface PortalMembershipFilters {
  portalUserId?: string;
  customerId?: string;
}

export class PortalUserRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findPortalUser(email: string): Promise<PortalUser | null> {
    const [portalUser] = await this._db.master
      .select()
      .from(portalUsers)
      .where(eq(portalUsers.email, email))
      .limit(1);

    return portalUser ?? null;
  }

  async findPortalUsers(ids: readonly string[]): Promise<PortalUser[]> {
    if (_.isEmpty(ids)) {
      return [];
    }

    return this._db.master
      .select()
      .from(portalUsers)
      .where(inArray(portalUsers.id, [...ids]));
  }

  async upsertPortalUser(payload: NewPortalUser): Promise<PortalUser> {
    const [portalUser] = await this._db.master
      .insert(portalUsers)
      .values(payload)
      .onConflictDoNothing({ target: portalUsers.email })
      .returning();

    if (portalUser) {
      return portalUser;
    }

    const existingPortalUser = await this.findPortalUser(payload.email);

    if (existingPortalUser) {
      return existingPortalUser;
    }

    throw new NotFoundError(`No such portal user: ${payload.email}`);
  }

  async getPortalMembership(id: string): Promise<PortalMembership> {
    const [portalMembership] = await this._db.master
      .select()
      .from(portalMemberships)
      .where(eq(portalMemberships.id, id))
      .limit(1);

    if (portalMembership) {
      return portalMembership;
    }

    throw new NotFoundError(`No such portal membership: ${id}`);
  }

  async findPortalMemberships(
    filters: PortalMembershipFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<PortalMembership[]> {
    const where = and(
      filters.portalUserId ? eq(portalMemberships.portalUserId, filters.portalUserId) : undefined,
      filters.customerId ? eq(portalMemberships.customerId, filters.customerId) : undefined,
    );

    return this._db.master
      .select()
      .from(portalMemberships)
      .where(where)
      .orderBy(asc(portalMemberships.createdAt), asc(portalMemberships.id))
      .limit(limit);
  }

  async createPortalMembership(payload: NewPortalMembership): Promise<PortalMembership | null> {
    const [portalMembership] = await this._db.master
      .insert(portalMemberships)
      .values(payload)
      .returning();

    return portalMembership ?? null;
  }

  async ensurePortalMembership(payload: NewPortalMembership): Promise<void> {
    await this._db.master
      .insert(portalMemberships)
      .values(payload)
      .onConflictDoNothing({
        target: [portalMemberships.portalUserId, portalMemberships.customerId],
      });
  }

  async updatePortalMembership(
    id: string,
    payload: Partial<NewPortalMembership>,
  ): Promise<PortalMembership | null> {
    const [portalMembership] = await this._db.master
      .update(portalMemberships)
      .set(payload)
      .where(eq(portalMemberships.id, id))
      .returning();

    return portalMembership ?? null;
  }

  async deletePortalMembership(id: string): Promise<void> {
    await this._db.master.delete(portalMemberships).where(eq(portalMemberships.id, id));
  }
}
