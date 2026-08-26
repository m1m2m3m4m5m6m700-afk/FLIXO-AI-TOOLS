import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getAdminSessionStatusServer, loginAdminServer, logoutAdminServer } from './auth.server';

const loginSchema = z.object({ password: z.string().min(1).max(256) });

export const getAdminSessionStatus = createServerFn({ method: 'GET' }).handler(async () => getAdminSessionStatusServer());
export const loginAdmin = createServerFn({ method: 'POST' }).validator(loginSchema).handler(async ({ data }) => loginAdminServer(data.password));
export const logoutAdmin = createServerFn({ method: 'POST' }).handler(async () => logoutAdminServer());
