const ADMIN_PATH = '/admin';

export const adminPaths = {
  SETTINGS: `${ADMIN_PATH}/settings`,
  SETTINGS_ACCOUNT: `${ADMIN_PATH}/settings/account`,
  SETTINGS_SECURITY: `${ADMIN_PATH}/settings/security`,

  USERS: `${ADMIN_PATH}/users`,
  USER: `${ADMIN_PATH}/users/:userId`,
  ROLES: `${ADMIN_PATH}/roles`,
} as const;
