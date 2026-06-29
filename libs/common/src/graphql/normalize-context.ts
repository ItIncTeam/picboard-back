import { Request, Response } from 'express';

function headerToString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export interface AuthContext {
  userId?: string;
  userRole?: string;
  sessionId?: string;
  isAuthenticated: boolean;
}

export interface GqlContext {
  req: Request;
  res?: Response;
  auth: AuthContext;
}

export function normalizeContext(req: Request, res?: Response): GqlContext {
  const userId = headerToString(req.headers['x-user-id']);
  const userRole = headerToString(req.headers['x-user-role']);
  const sessionId = headerToString(req.headers['x-session-id']);

  return {
    req,
    res,
    auth: {
      userId,
      userRole,
      sessionId,
      isAuthenticated: Boolean(userId),
    },
  };
}
