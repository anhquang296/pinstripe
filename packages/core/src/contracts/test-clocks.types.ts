import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

export enum TestClockStatusEnum {
  READY = 'ready',
  ADVANCING = 'advancing',
}
export type TestClockStatus = `${TestClockStatusEnum}`;

export const testClockSchema = Type.Object({
  object: Type.Literal('test_clock'),
  id: Type.String(),
  name: Type.String(),
  frozenTime: Type.String(),
  status: Type.Unsafe<TestClockStatus>(Type.Enum(TestClockStatusEnum)),
  createdAt: Type.String(),
});

export const testClockParamsSchema = Type.Object({
  testClockId: Type.String(),
});

export const createTestClockSchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    frozenTime: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);

export const advanceTestClockSchema = Type.Object(
  {
    frozenTime: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);

export const getTestClocksSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type TestClock = Static<typeof testClockSchema>;
export type CreateTestClockPayload = Static<typeof createTestClockSchema>;
export type AdvanceTestClockPayload = Static<typeof advanceTestClockSchema>;
export type GetTestClocksQuery = Static<typeof getTestClocksSchema>;
