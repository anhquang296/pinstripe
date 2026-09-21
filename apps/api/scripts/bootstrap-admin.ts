import { parseArgs } from 'node:util';

import { UserRoleEnum } from '@vxrerp/core/contracts';
import { corePlugin } from '@vxrerp/core/plugins';
import Fastify from 'fastify';

const USAGE = 'usage: bootstrap-admin --email <email> --name <name> [--password <password>]';

function readCommandArgs(): string[] {
  const commandArgs = process.argv.slice(2);

  if (commandArgs[0] === '--') {
    return commandArgs.slice(1);
  }

  return commandArgs;
}

async function runScript(): Promise<void> {
  const { values } = parseArgs({
    args: readCommandArgs(),
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      password: { type: 'string' },
    },
  });

  const { email, name, password } = values;

  if (!email || !name) {
    throw new Error(USAGE);
  }

  const fastify = Fastify({ logger: { level: 'warn' } });

  await fastify.register(corePlugin);
  await fastify.ready();

  try {
    const user = await fastify.userService.ensureUser({
      email,
      name,
      password,
      role: UserRoleEnum.ADMIN,
    });

    fastify.log.info({ userId: user.id, email: user.email }, 'runScript() completed');

    process.stdout.write(`${JSON.stringify(user, null, 2)}\n`);
  } finally {
    await fastify.close();
  }
}

try {
  await runScript();
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
}
