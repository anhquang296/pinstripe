import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export enum AuditActorTypeEnum {
  USER = 'user',
  API_KEY = 'api_key',
}
export type AuditActorType = `${AuditActorTypeEnum}`;

export enum AuditActionEnum {
  LOGIN = 'auth.login',
  LOGIN_FAILED = 'auth.login_failed',
  LOGOUT = 'auth.logout',
  REQUEST = 'request',
}
export type AuditAction = `${AuditActionEnum}`;

export const auditLogSchema = Type.Object({
  id: Type.String(),
  actorType: Type.Unsafe<AuditActorType>(Type.Enum(AuditActorTypeEnum)),
  actorId: Type.Union([Type.String(), Type.Null()]),
  action: Type.Unsafe<AuditAction>(Type.Enum(AuditActionEnum)),
  permission: Type.Union([Type.String(), Type.Null()]),
  method: Type.String(),
  route: Type.String(),
  resourceId: Type.Union([Type.String(), Type.Null()]),
  statusCode: Type.Integer(),
  requestId: Type.String(),
  ip: Type.String(),
  occurredAt: Type.String(),
});

export const findAuditLogsSchema = Type.Object(
  {
    actorId: Type.Optional(Type.String()),
    action: Type.Optional(Type.Unsafe<AuditAction>(Type.Enum(AuditActionEnum))),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type AuditLogResponse = Static<typeof auditLogSchema>;
export type FindAuditLogsQuery = Static<typeof findAuditLogsSchema>;
