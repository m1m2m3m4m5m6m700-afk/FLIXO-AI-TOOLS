import { createMiddleware } from '@tanstack/react-start';
import { readCsrfCookie } from '../server/security/csrf';
import { getClientIp, getCountry, getDevice, getReferrer } from '../server/security/request';

export interface SecurityRequestContext {
  csrfCookie: string | null;
  clientIp: string | null;
  country: string | null;
  device: string | null;
  referrer: string | null;
}

export const securityRequestMiddleware = createMiddleware().server(({ request, next }) =>
  next({
    context: {
      csrfCookie: readCsrfCookie(request),
      clientIp: getClientIp(request),
      country: getCountry(request),
      device: getDevice(request),
      referrer: getReferrer(request),
    },
  }),
);
