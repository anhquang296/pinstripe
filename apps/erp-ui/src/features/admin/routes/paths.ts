export const adminPaths = {
  SETTINGS_ACCOUNT: '/settings/account',
  SETTINGS_SECURITY: '/settings/security',

  WEBHOOKS: '/webhooks',
  WEBHOOKS_ENDPOINTS: '/webhooks/endpoints',
  WEBHOOKS_ENDPOINT: '/webhooks/endpoints/:webhookEndpointId',
  WEBHOOKS_DELIVERIES: '/webhooks/deliveries',

  API_KEYS: '/api-keys',

  ADMIN_USERS: '/admin/users',
  ADMIN_USER: '/admin/users/:userId',
  ADMIN_ROLES: '/admin/roles',
} as const;
