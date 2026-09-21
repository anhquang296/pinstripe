const ADMIN_PATH = '/admin';

export const adminPaths = {
  SETTINGS: `${ADMIN_PATH}/settings`,
  SETTINGS_ACCOUNT: `${ADMIN_PATH}/settings/account`,
  SETTINGS_SECURITY: `${ADMIN_PATH}/settings/security`,

  WEBHOOKS: `${ADMIN_PATH}/webhooks`,
  WEBHOOKS_ENDPOINTS: `${ADMIN_PATH}/webhooks/endpoints`,
  WEBHOOKS_ENDPOINT: `${ADMIN_PATH}/webhooks/endpoints/:webhookEndpointId`,
  WEBHOOKS_DELIVERIES: `${ADMIN_PATH}/webhooks/deliveries`,

  API_KEYS: `${ADMIN_PATH}/api-keys`,

  USERS: `${ADMIN_PATH}/users`,
  USER: `${ADMIN_PATH}/users/:userId`,
  ROLES: `${ADMIN_PATH}/roles`,
} as const;
