/**
 * API Handlers for Lab Sessions
 */

import { Env, LabSession, UpdateLabSessionPayload } from './types';
import {
  generateUUID,
  successResponse,
  errorResponse,
  validateRequiredFields,
  rowToLabSession,
  parseRequestBody,
} from './utils';

/**
 * POST /api/v1/labs/sessions
 * Create a new lab session
 * Business logic: Each user can have only one active lab at a time
 */
export async function createLabSession(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Parse request body
    const body = await parseRequestBody<LabSession>(request);
    
    if (!body) {
      return errorResponse('Invalid JSON in request body', 400);
    }

    // Validate required fields
    const requiredFields = [
      'labId',
      'labTitle',
      'labGroupID',
      'moduleID',
      'duration',
      'activatedAt',
      'counterID',
      'configId',
      'workerConfigId',
      'lab_request_id',
      'user_id',
      'terminal_url',
      'validation',
      'vm',
    ];

    const validation = validateRequiredFields(body, requiredFields);
    if (!validation.valid) {
      return errorResponse(
        `Missing required fields: ${validation.missing.join(', ')}`,
        400
      );
    }

    // Generate UUID if not provided
    const sessionId = body.id || generateUUID();

    // Check if user already has an active lab
    const existingSession = await env.DB.prepare(
      'SELECT id FROM labs_sessions WHERE user_id = ?'
    )
      .bind(body.user_id)
      .first();

    if (existingSession) {
      return errorResponse(
        'User already has an active lab session. Only one active lab per user is allowed.',
        409
      );
    }

    // Prepare JSON fields
    const vmJson = JSON.stringify(body.vm);
    const workerNodesJson = body.worker_nodes
      ? JSON.stringify(body.worker_nodes)
      : null;
    const loadBalancersJson = body.loadBalancers
      ? JSON.stringify(body.loadBalancers)
      : null;

    // Insert new lab session
    await env.DB.prepare(
      `INSERT INTO labs_sessions (
        id, labId, labTitle, labGroupID, moduleID, duration, activatedAt,
        counterID, configId, workerConfigId, lab_request_id, user_id,
        terminal_url, validation, vscode_domain, puku_domain, vm,
        worker_nodes, loadBalancers, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
      .bind(
        sessionId,
        body.labId,
        body.labTitle,
        body.labGroupID,
        body.moduleID,
        body.duration,
        body.activatedAt,
        body.counterID,
        body.configId,
        body.workerConfigId,
        body.lab_request_id,
        body.user_id,
        body.terminal_url,
        body.validation,
        body.vscode_domain || null,
        body.puku_domain || null,
        vmJson,
        workerNodesJson,
        loadBalancersJson
      )
      .run();

    // Return created session
    return successResponse(
      {
        id: sessionId,
        ...body,
      },
      'Lab session created successfully',
      201
    );
  } catch (error: any) {
    console.error('Error creating lab session:', error);
    return errorResponse(`Failed to create lab session: ${error.message}`, 500);
  }
}

/**
 * GET /api/v1/labs/sessions/user/:user_id
 * Retrieve the active lab session for a given user
 */
export async function getLabSession(
  userId: string,
  env: Env
): Promise<Response> {
  try {
    if (!userId) {
      return errorResponse('User ID is required', 400);
    }

    // Query the database
    const result = await env.DB.prepare(
      'SELECT * FROM labs_sessions WHERE user_id = ? LIMIT 1'
    )
      .bind(userId)
      .first();

    if (!result) {
      return errorResponse('No active lab session found for this user', 404);
    }

    // Convert row to LabSession object
    const labSession = rowToLabSession(result as any);

    return successResponse(
      labSession,
      'Lab session retrieved successfully'
    );
  } catch (error: any) {
    console.error('Error retrieving lab session:', error);
    return errorResponse(`Failed to retrieve lab session: ${error.message}`, 500);
  }
}

/**
 * PUT /api/v1/labs/sessions/:user_id
 * Update an existing lab session (e.g., add new services, domains)
 */
export async function updateLabSession(
  userId: string,
  request: Request,
  env: Env
): Promise<Response> {
  try {
    if (!userId) {
      return errorResponse('User ID is required', 400);
    }

    // Parse request body
    const body = await parseRequestBody<UpdateLabSessionPayload>(request);
    
    if (!body || Object.keys(body).length === 0) {
      return errorResponse('Request body cannot be empty', 400);
    }

    // Check if session exists
    const existingSession = await env.DB.prepare(
      'SELECT * FROM labs_sessions WHERE user_id = ?'
    )
      .bind(userId)
      .first();

    if (!existingSession) {
      return errorResponse('No active lab session found for this user', 404);
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // Handle JSON fields
    if (body.worker_nodes !== undefined) {
      updateFields.push('worker_nodes = ?');
      updateValues.push(JSON.stringify(body.worker_nodes));
    }

    if (body.loadBalancers !== undefined) {
      updateFields.push('loadBalancers = ?');
      updateValues.push(JSON.stringify(body.loadBalancers));
    }

    // Handle simple fields
    const simpleFields = [
      'vscode_domain',
      'puku_domain',
      'terminal_url',
      'duration',
    ];

    for (const field of simpleFields) {
      if (body[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(body[field]);
      }
    }

    if (updateFields.length === 0) {
      return errorResponse('No valid fields to update', 400);
    }

    // Add updated_at timestamp
    updateFields.push("updated_at = datetime('now')");

    // Add user_id to bind values
    updateValues.push(userId);

    // Execute update
    const updateQuery = `UPDATE labs_sessions SET ${updateFields.join(', ')} WHERE user_id = ?`;
    
    await env.DB.prepare(updateQuery)
      .bind(...updateValues)
      .run();

    // Fetch and return updated session
    const updatedSession = await env.DB.prepare(
      'SELECT * FROM labs_sessions WHERE user_id = ?'
    )
      .bind(userId)
      .first();

    const labSession = rowToLabSession(updatedSession as any);

    return successResponse(
      labSession,
      'Lab session updated successfully'
    );
  } catch (error: any) {
    console.error('Error updating lab session:', error);
    return errorResponse(`Failed to update lab session: ${error.message}`, 500);
  }
}
