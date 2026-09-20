import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreatePortalMembershipPayload,
  DeletedPortalMembershipResponse,
  FindPortalMembershipsQuery,
  PortalMembershipResponse,
  PortalRole,
  UpdatePortalMembershipPayload,
} from '@contracts/portal-memberships.types';
import { PortalRoleEnum } from '@contracts/portal-memberships.types';
import type { PortalMembership, PortalUser } from '@database/schemas';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '@errors/app.error';
import { isUniqueViolation } from '@errors/database.error';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export interface PortalLogin {
  portalUser: PortalUser;
  portalMembership: PortalMembership;
}

export interface PortalUserCustomer {
  customerId: string;
  customerName: string;
  role: PortalRole;
}

export interface PortalUserAccess {
  userEmail: string | null;
  memberships: PortalUserCustomer[];
}

export class PortalUserService {
  constructor(private readonly fastify: FastifyInstance) {}

  async resolvePortalLogin(email: string): Promise<PortalLogin | null> {
    await this.ensureBillingOwner(email);

    const portalUser = await this.fastify.portalUserRepository.findPortalUser(
      PortalUserService.normalizeEmail(email),
    );

    if (portalUser) {
      const [portalMembership] = await this.fastify.portalUserRepository.findPortalMemberships(
        { portalUserId: portalUser.id },
        1,
      );

      if (portalMembership) {
        return { portalUser, portalMembership };
      }
    }

    return null;
  }

  async getSessionMembership(portalUserId: string, customerId: string): Promise<PortalMembership> {
    const [portalMembership] = await this.fastify.portalUserRepository.findPortalMemberships(
      { portalUserId, customerId },
      1,
    );

    if (portalMembership) {
      return portalMembership;
    }

    throw new UnauthorizedError('This portal user no longer has access to this operator');
  }

  async findPortalUserAccess(portalUserId: string | null): Promise<PortalUserAccess> {
    if (portalUserId) {
      const portalUser = await this.getPortalUser(portalUserId);
      const memberships = await this.findPortalUserCustomers(portalUserId);

      return { userEmail: portalUser.email, memberships };
    }

    return { userEmail: null, memberships: [] };
  }

  async findPortalUserCustomers(portalUserId: string): Promise<PortalUserCustomer[]> {
    const MEMBERSHIP_LIMIT = 100;

    const portalMemberships = await this.fastify.portalUserRepository.findPortalMemberships(
      { portalUserId },
      MEMBERSHIP_LIMIT,
    );

    const customers = await this.fastify.customerRepository.findCustomers(
      { ids: _.map(portalMemberships, 'customerId') },
      MEMBERSHIP_LIMIT,
    );

    const customersById = _.keyBy(customers, 'id');

    return _.flatMap(portalMemberships, (portalMembership) => {
      const customer = customersById[portalMembership.customerId];

      if (customer) {
        return [
          {
            customerId: customer.id,
            customerName: customer.name,
            role: portalMembership.role,
          },
        ];
      }

      return [];
    });
  }

  async findPortalMemberships(
    query: FindPortalMembershipsQuery,
  ): Promise<ListResponse<PortalMembershipResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT, customerId } = query;

    const portalMemberships = await this.fastify.portalUserRepository.findPortalMemberships(
      { customerId },
      limit + 1,
    );

    const page = _.take(portalMemberships, limit);

    const portalUsers = await this.fastify.portalUserRepository.findPortalUsers(
      _.map(page, 'portalUserId'),
    );

    const portalUsersById = _.keyBy(portalUsers, 'id');

    return {
      url: '/v1/portal_memberships',
      hasMore: portalMemberships.length > limit,
      data: _.flatMap(page, (portalMembership) => {
        const portalUser = portalUsersById[portalMembership.portalUserId];

        if (portalUser) {
          return [PortalUserService.buildPortalMembership(portalMembership, portalUser)];
        }

        return [];
      }),
    };
  }

  async createPortalMembership(
    payload: CreatePortalMembershipPayload,
  ): Promise<PortalMembershipResponse> {
    const customer = await this.fastify.customerService.getCustomer(payload.customerId);

    const { name = '' } = payload;

    const portalUser = await this.ensurePortalUser(payload.email, name);
    const createdAt = this.fastify.clock.now().toISOString();

    try {
      const portalMembership = await this.fastify.portalUserRepository.createPortalMembership({
        id: generateGid(ObjectPrefixEnum.PORTAL_MEMBERSHIP),
        portalUserId: portalUser.id,
        customerId: customer.id,
        role: payload.role,
        createdAt,
        updatedAt: createdAt,
      });

      if (portalMembership) {
        return PortalUserService.buildPortalMembership(portalMembership, portalUser);
      }

      throw new NotFoundError('Portal membership could not be created');
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          `${portalUser.email} already has access to customer ${customer.id}`,
        );
      }

      throw error;
    }
  }

  async updatePortalMembership(
    id: string,
    payload: UpdatePortalMembershipPayload,
  ): Promise<PortalMembershipResponse> {
    const portalMembership = await this.fastify.portalUserRepository.getPortalMembership(id);
    const portalUser = await this.getPortalUser(portalMembership.portalUserId);
    const updatedAt = this.fastify.clock.now().toISOString();

    const updatedMembership = await this.fastify.portalUserRepository.updatePortalMembership(id, {
      role: payload.role,
      updatedAt,
    });

    if (updatedMembership) {
      return PortalUserService.buildPortalMembership(updatedMembership, portalUser);
    }

    throw new NotFoundError(`No such portal membership: ${id}`);
  }

  async deletePortalMembership(id: string): Promise<DeletedPortalMembershipResponse> {
    const portalMembership = await this.fastify.portalUserRepository.getPortalMembership(id);
    const portalUser = await this.getPortalUser(portalMembership.portalUserId);
    const customer = await this.fastify.customerService.getCustomer(portalMembership.customerId);
    const billingEmail = PortalUserService.normalizeEmail(_.toString(customer.email));
    const isRevocable = billingEmail !== portalUser.email;

    if (isRevocable) {
      await this.fastify.portalUserRepository.deletePortalMembership(id);

      return { id, deleted: true };
    }

    throw new BadRequestError(
      'The billing email of a customer always keeps portal access; change the customer email to revoke it',
    );
  }

  private async getPortalUser(id: string): Promise<PortalUser> {
    const [portalUser] = await this.fastify.portalUserRepository.findPortalUsers([id]);

    if (portalUser) {
      return portalUser;
    }

    throw new NotFoundError(`No such portal user: ${id}`);
  }

  private async ensureBillingOwner(email: string): Promise<void> {
    const [customer] = await this.fastify.customerRepository.findCustomers({ email }, 1);

    if (customer) {
      const portalUser = await this.ensurePortalUser(email, customer.name);
      const createdAt = this.fastify.clock.now().toISOString();

      await this.fastify.portalUserRepository.ensurePortalMembership({
        id: generateGid(ObjectPrefixEnum.PORTAL_MEMBERSHIP),
        portalUserId: portalUser.id,
        customerId: customer.id,
        role: PortalRoleEnum.OWNER,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  private async ensurePortalUser(email: string, name: string): Promise<PortalUser> {
    const createdAt = this.fastify.clock.now().toISOString();

    return this.fastify.portalUserRepository.upsertPortalUser({
      id: generateGid(ObjectPrefixEnum.PORTAL_USER),
      email: PortalUserService.normalizeEmail(email),
      name,
      createdAt,
      updatedAt: createdAt,
    });
  }

  private static normalizeEmail(email: string): string {
    return _.toLower(_.trim(email));
  }

  private static buildPortalMembership(
    portalMembership: PortalMembership,
    portalUser: PortalUser,
  ): PortalMembershipResponse {
    return {
      id: portalMembership.id,
      customerId: portalMembership.customerId,
      portalUserId: portalUser.id,
      email: portalUser.email,
      name: portalUser.name,
      role: portalMembership.role,
      createdAt: portalMembership.createdAt,
    };
  }
}
