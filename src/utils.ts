/**
 * Utility functions for Cloudflare Worker
 */

import { ApiResponse, LabSession, LabSessionRow } from './types';

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Create a JSON response
 */
export function jsonResponse<T>(
  data: ApiResponse<T>,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...headers,
    },
  });
}

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): Response {
  return jsonResponse<T>(
    {
      success: true,
      data,
      message,
    },
    status
  );
}

/**
 * Create an error response
 */
export function errorResponse(
  error: string,
  status: number = 400
): Response {
  return jsonResponse(
    {
      success: false,
      error,
    },
    status
  );
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
  body: any,
  requiredFields: string[]
): { valid: boolean; missing: string[] } {
  const missing = requiredFields.filter((field) => !body[field]);
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Convert database row to LabSession object
 */
export function rowToLabSession(row: LabSessionRow): LabSession {
  return {
    id: row.id,
    labId: row.labId,
    labTitle: row.labTitle,
    labGroupID: row.labGroupID,
    moduleID: row.moduleID,
    duration: row.duration,
    activatedAt: row.activatedAt,
    counterID: row.counterID,
    configId: row.configId,
    workerConfigId: row.workerConfigId || undefined,
    lab_request_id: row.lab_request_id,
    user_id: row.user_id,
    terminal_url: row.terminal_url,
    validation: row.validation,
    vscode_domain: row.vscode_domain || undefined,
    puku_domain: row.puku_domain || undefined,
    vm: JSON.parse(row.vm),
    worker_nodes: row.worker_nodes ? JSON.parse(row.worker_nodes) : undefined,
    loadBalancers: row.loadBalancers ? JSON.parse(row.loadBalancers) : undefined,
  };
}

/**
 * Parse request body safely
 */
export async function parseRequestBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json();
  } catch (error) {
    return null;
  }
}

/**
 * Handle CORS preflight requests
 */
export function handleCORS(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  return null;
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Authenticate request using Bearer token
 * Returns true if authenticated, false otherwise
 */
export function authenticateRequest(request: Request, expectedToken: string | undefined): boolean {
  if (!expectedToken) {
    // If no token is configured, authentication is disabled (dev mode)
    return true;
  }

  const token = extractBearerToken(request);
  if (!token) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(token, expectedToken);
}

/**
 * Timing-safe string comparison
 * Prevents timing attacks by comparing all characters
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): Response {
  return errorResponse(message, 401);
}
