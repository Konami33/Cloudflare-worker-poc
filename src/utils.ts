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
      'Access-Control-Allow-Headers': 'Content-Type',
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
    workerConfigId: row.workerConfigId,
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
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  return null;
}
