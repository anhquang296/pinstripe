import type { AppError, AppErrorOptions } from '@pinstripe/core/errors';
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from '@pinstripe/core/errors';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import _ from 'lodash';

type AuthErrorClass = new (message: string, options?: AppErrorOptions) => AppError;

const AUTH_PATHS = [
  '/sign-in/email',
  '/sign-in/social',
  '/callback/google',
  '/sign-out',
  '/get-session',
  '/change-password',
  '/list-accounts',
  '/revoke-other-sessions',
  '/update-user',
];

const GET_SESSION_PATH = '/get-session';
const UPDATE_USER_PATH = '/update-user';
const UPDATE_USER_FIELDS = ['name', 'image'];
const SESSION_TOKEN_PATHS = ['token', 'session.token'];
const DROPPED_HEADERS = ['host', 'connection', 'content-length', 'transfer-encoding'];
const JSON_CONTENT_TYPE = 'application/json';
const DEFAULT_AUTH_ERROR_MESSAGE = 'The authentication request failed';
const REDIRECT_STATUS_MIN = 300;
const REDIRECT_STATUS_MAX = 400;
const SERVER_ERROR_STATUS_MIN = 500;

const AUTH_ERROR_CLASSES: Record<number, AuthErrorClass> = {
  400: BadRequestError,
  401: UnauthorizedError,
  403: ForbiddenError,
  404: NotFoundError,
  422: BadRequestError,
  429: TooManyRequestsError,
};

function readAuthPath(request: FastifyRequest): string {
  const wildcard = _.get(request.params, '*', '');

  return `/${wildcard}`;
}

function assertAllowedPath(request: FastifyRequest, path: string): void {
  if (_.includes(AUTH_PATHS, path)) {
    return;
  }

  throw new NotFoundError(`Unrecognized request URL (${request.method}: ${request.url})`, {
    code: 'resource_missing',
  });
}

function assertTrustedOrigin(request: FastifyRequest, origin: string): void {
  const isReadRequest = request.method !== 'POST';

  if (isReadRequest || request.headers.origin === origin) {
    return;
  }

  throw new ForbiddenError('This request came from an origin the dashboard does not trust');
}

function assertUpdateUserFields(request: FastifyRequest, path: string): void {
  if (path !== UPDATE_USER_PATH) {
    return;
  }

  const rejectedFields = _.difference(_.keys(request.body), UPDATE_USER_FIELDS);

  if (_.isEmpty(rejectedFields)) {
    return;
  }

  throw new BadRequestError('Only the name and image of a user can be updated here', {
    param: _.head(rejectedFields),
  });
}

function buildForwardHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();

  _.forEach(request.headers, (value, name) => {
    const isDropped = _.includes(DROPPED_HEADERS, name) || _.isNil(value);

    if (isDropped) {
      return;
    }

    _.forEach(_.castArray(value), (entry) => {
      headers.append(name, String(entry));
    });
  });

  return headers;
}

function buildForwardRequest(request: FastifyRequest, baseUrl: string): Request {
  const hasBody = !_.isNil(request.body) && request.method !== 'GET';
  const body = hasBody ? JSON.stringify(request.body) : undefined;

  return new Request(`${baseUrl}${request.url}`, {
    method: request.method,
    headers: buildForwardHeaders(request),
    body,
  });
}

function readAuthError(text: string): { code?: string; message?: string } {
  const body = _.attempt(JSON.parse, text);
  const code = _.get(body, 'code');
  const message = _.get(body, 'message');

  return {
    code: _.isString(code) ? code : undefined,
    message: _.isString(message) ? message : undefined,
  };
}

function throwAuthError(statusCode: number, text: string): never {
  const { code, message = DEFAULT_AUTH_ERROR_MESSAGE } = readAuthError(text);

  const fallbackClass = statusCode < SERVER_ERROR_STATUS_MIN ? BadRequestError : InternalError;
  const AuthError = _.get(AUTH_ERROR_CLASSES, statusCode, fallbackClass);

  throw new AuthError(message, { code });
}

function stripSessionToken(text: string): string {
  const body = _.attempt(JSON.parse, text);

  if (_.isPlainObject(body)) {
    return JSON.stringify(_.omit(body, SESSION_TOKEN_PATHS));
  }

  return text;
}

function setAuthCookies(reply: FastifyReply, cookies: string[]): void {
  if (_.isEmpty(cookies)) {
    return;
  }

  reply.header('set-cookie', cookies);
}

function copyAuthCookies(reply: FastifyReply, response: Response): void {
  setAuthCookies(reply, response.headers.getSetCookie());
}

async function replyWithSession(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { authSession, cookies } = await fastify.betterAuth.findActiveSession(
    buildForwardHeaders(request),
  );

  const body = authSession ? _.omit(authSession, SESSION_TOKEN_PATHS) : null;

  setAuthCookies(reply, cookies);

  return reply.code(200).type(JSON_CONTENT_TYPE).send(JSON.stringify(body));
}

async function replyWithAuthResponse(
  reply: FastifyReply,
  response: Response,
): Promise<FastifyReply> {
  const isRedirect =
    response.status >= REDIRECT_STATUS_MIN && response.status < REDIRECT_STATUS_MAX;

  if (isRedirect) {
    const location = response.headers.get('location');

    copyAuthCookies(reply, response);

    if (location) {
      reply.header('location', location);
    }

    return reply.code(response.status).send();
  }

  const text = await response.text();

  if (response.ok) {
    copyAuthCookies(reply, response);

    return reply.code(response.status).type(JSON_CONTENT_TYPE).send(stripSessionToken(text));
  }

  throwAuthError(response.status, text);
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.all('/*', async (request, reply) => {
    const path = readAuthPath(request);

    const { baseUrl } = fastify.betterAuth;

    assertAllowedPath(request, path);
    assertTrustedOrigin(request, baseUrl);
    assertUpdateUserFields(request, path);

    if (path === GET_SESSION_PATH) {
      return replyWithSession(fastify, request, reply);
    }

    const response = await fastify.betterAuth.handler(buildForwardRequest(request, baseUrl));

    return replyWithAuthResponse(reply, response);
  });
}
