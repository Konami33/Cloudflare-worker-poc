/**
 * Cloudflare Worker - Lab Sessions API
 * 
 * Main entry point for the lab state management service.
 * Handles routing for POST, GET, PUT, and DELETE endpoints.
 * Includes Cron Trigger for automatic lab session expiration.
 */

import { Env } from './types';
import { createLabSession, getLabSession, updateLabSession, deleteLabSession } from './handlers';
import { errorResponse, handleCORS, authenticateRequest, unauthorizedResponse } from './utils';
import { createLogger, initializeLogger } from './logger';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize logger with environment
    initializeLogger(env.ENVIRONMENT || 'production');
    const logger = createLogger('Router');

    // Handle CORS preflight requests
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;

    // Parse the request URL
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Log incoming request
    logger.logRequest(method, path);

    try {
      // Route: POST /api/v1/labs/sessions - Create new lab session
      if (path === '/api/v1/labs/sessions' && method === 'POST') {
        if (!authenticateRequest(request, env.CF_WORKER_TOKEN)) {
          logger.warn('Unauthorized POST request to create session');
          return unauthorizedResponse('Invalid or missing authentication token');
        }
        const response = await createLabSession(request, env);
        logger.logRequest(method, path, response.status);
        return response;
      }

      // Route: GET /api/v1/labs/sessions/user/:user_id - Get lab session by user ID
      const getUserMatch = path.match(/^\/api\/v1\/labs\/sessions\/user\/([^\/]+)$/);
      if (getUserMatch && method === 'GET') {
        if (!authenticateRequest(request, env.CF_WORKER_TOKEN)) {
          logger.warn('Unauthorized GET request to retrieve session');
          return unauthorizedResponse('Invalid or missing authentication token');
        }
        const userId = getUserMatch[1];
        return await getLabSession(userId, env);
      }

      // Route: PUT /api/v1/labs/sessions/:user_id - Update lab session
      const updateUserMatch = path.match(/^\/api\/v1\/labs\/sessions\/([^\/]+)$/);
      if (updateUserMatch && method === 'PUT') {
        if (!authenticateRequest(request, env.CF_WORKER_TOKEN)) {
          logger.warn('Unauthorized PUT request to update session');
          return unauthorizedResponse('Invalid or missing authentication token');
        }
        const userId = updateUserMatch[1];
        return await updateLabSession(userId, request, env);
      }

      // Route: DELETE /api/v1/labs/sessions/:user_id - Delete lab session (Protected)
      const deleteUserMatch = path.match(/^\/api\/v1\/labs\/sessions\/([^\/]+)$/);
      if (deleteUserMatch && method === 'DELETE') {
        if (!authenticateRequest(request, env.CF_WORKER_TOKEN)) {
          logger.warn('Unauthorized DELETE request to delete session');
          return unauthorizedResponse('Invalid or missing authentication token');
        }
        const userId = deleteUserMatch[1];
        return await deleteLabSession(userId, env); 
      }

      // Health check endpoint
      if (path === '/health' && method === 'GET') {
        return new Response(JSON.stringify({ 
          status: 'healthy', 
          service: 'lab-sessions-api',
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Root endpoint - API documentation
      if (path === '/' && method === 'GET') {
        return new Response(JSON.stringify({
          service: 'Cloudflare Worker - Lab Sessions API',
          version: '1.0.0',
          endpoints: [
            {
              method: 'POST',
              path: '/api/v1/labs/sessions',
              description: 'Create a new lab session'
            },
            {
              method: 'GET',
              path: '/api/v1/labs/sessions/user/:user_id',
              description: 'Get active lab session for a user'
            },
            {
              method: 'PUT',
              path: '/api/v1/labs/sessions/:user_id',
              description: 'Update an existing lab session'
            },
            {
              method: 'DELETE',
              path: '/api/v1/labs/sessions/:user_id',
              description: 'Delete (terminate) a lab session'
            },
            {
              method: 'GET',
              path: '/health',
              description: 'Health check endpoint'
            }
          ]
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // No matching route
      logger.warn('Route not found', { path, method });
      return errorResponse('Route not found', 404);
    } catch (error: any) {
      logger.error('Unhandled error in request handler', error);
      return errorResponse(`Internal server error: ${error.message}`, 500);
    }
  },

  /**
   * Scheduled handler - runs periodically via Cron Trigger
   * Checks for expired lab sessions and cleans them up
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    initializeLogger(env.ENVIRONMENT || 'production');
    const logger = createLogger('CronJob');
    logger.info('Starting scheduled cleanup check');
    ctx.waitUntil(cleanupExpiredSessions(env));
  }
};

/**
 * Clean up expired lab sessions
 * Called by cron trigger to check and delete expired sessions
 */
async function cleanupExpiredSessions(env: Env): Promise<void> {
  const logger = createLogger('CleanupService');
  const startTime = Date.now();
  
  try {
    logger.logOperationStart('Expired sessions cleanup');
    
    // Find expired sessions where created_at + duration < NOW
    const result = await env.DB.prepare(`
      SELECT 
        user_id, 
        lab_request_id, 
        duration, 
        created_at,
        worker_nodes
      FROM labs_sessions
      WHERE datetime(created_at, '+' || duration || ' minutes') < datetime('now')
    `).all();

    if (!result.results || result.results.length === 0) {
      logger.info('No expired sessions found');
      return;
    }

    logger.info(`Found ${result.results.length} expired session(s) to clean up`);

    let successCount = 0;
    let errorCount = 0;

    // Process each expired session
    for (const session of result.results) {
      try {
        const user_id = session.user_id as string;
        const master_lab_request_id = session.lab_request_id as string;
        const worker_nodes_json = session.worker_nodes as string | null;
        
        const sessionLogger = logger.child({ user_id, lab_request_id: master_lab_request_id });
        
        // Parse worker nodes to get all lab_request_ids
        const worker_lab_request_ids: string[] = [];
        if (worker_nodes_json) {
          try {
            const workerNodes = JSON.parse(worker_nodes_json);
            if (Array.isArray(workerNodes)) {
              workerNodes.forEach((node: any) => {
                if (node.worker_lab_request_id) {
                  worker_lab_request_ids.push(node.worker_lab_request_id);
                }
              });
            }
          } catch (parseError) {
            sessionLogger.warn('Failed to parse worker_nodes', parseError);
          }
        }

        sessionLogger.logSessionExpired(user_id, master_lab_request_id);
        
        // Call backend API to delete resources
        await callBackendCleanup(env, master_lab_request_id, worker_lab_request_ids, user_id, sessionLogger);
        
        // Delete from database
        await env.DB.prepare('DELETE FROM labs_sessions WHERE user_id = ?')
          .bind(user_id)
          .run();
        
        sessionLogger.logSessionDeleted(user_id, 'automatic');
        successCount++;
      } catch (error) {
        errorCount++;
        logger.child({ user_id: session.user_id as string }).error('Failed to cleanup session', error);
        // Continue with next session even if one fails
      }
    }

    const duration = Date.now() - startTime;
    logger.logCronExecution('Expired sessions cleanup', successCount + errorCount, errorCount);
    logger.logOperationSuccess('Expired sessions cleanup', duration, { successCount, errorCount });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logOperationFailure('Expired sessions cleanup', error, duration);
  }
}

/**
 * Call backend API to delete VM and exposed services
 * Handles both single VM and multi-node Kubernetes labs
 */
async function callBackendCleanup(
  env: Env,
  master_lab_request_id: string,
  worker_lab_request_ids: string[],
  user_id: string,
  logger: any
): Promise<void> {
  const backendUrl = env.BACKEND_API_URL;
  const authToken = env.BACKEND_API_TOKEN;

  if (!backendUrl) {
    throw new Error('BACKEND_API_URL not configured');
  }

  if (!authToken) {
    throw new Error('BACKEND_API_TOKEN not configured');
  }

  // Combine all lab_request_ids and remove duplicates using Set
  const allLabRequestIds = Array.from(new Set([master_lab_request_id, ...worker_lab_request_ids]));
  
  if (allLabRequestIds.length > 1) {
    logger.info(`Multi-node Kubernetes lab detected: ${allLabRequestIds.length} VMs to delete`);
  }

  // Step 1: Delete exposed services for master VM (best effort)
  try {
    const startTime = Date.now();
    logger.info(`Deleting exposed services for master lab`, { lab_request_id: master_lab_request_id });
    
    const servicesResponse = await fetch(`${backendUrl}/api/v1/expose/`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ lab_request_id: master_lab_request_id })
    });

    const duration = Date.now() - startTime;
    logger.logApiCall('DELETE', '/api/v1/expose/', servicesResponse.status, duration);

    if (servicesResponse.ok) {
      const servicesData = await servicesResponse.json();
      logger.info('Exposed services deleted successfully', servicesData);
    } else {
      logger.warn(`Failed to delete exposed services (${servicesResponse.status})`);
    }
  } catch (error) {
    logger.warn('Service deletion error (continuing with VM deletion)', error);
  }

  // Step 2: Delete all VMs (master + workers)
  const vmDeleteErrors: Array<{ lab_request_id: string; error: string }> = [];
  let successfulDeletions = 0;

  for (const lab_request_id of allLabRequestIds) {
    try {
      const startTime = Date.now();
      const vmType = lab_request_id === master_lab_request_id ? 'master' : 'worker';
      logger.info(`Deleting ${vmType} VM`, { lab_request_id });
      
      const vmResponse = await fetch(`${backendUrl}/api/v1/labs/delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lab_request_id, user_id })
      });

      const duration = Date.now() - startTime;
      logger.logApiCall('POST', '/api/v1/labs/delete', vmResponse.status, duration);

      if (!vmResponse.ok) {
        const errorText = await vmResponse.text();
        throw new Error(`Backend API returned ${vmResponse.status}: ${errorText}`);
      }

      successfulDeletions++;
      logger.info(`${vmType} VM deleted successfully`, { lab_request_id });
    } catch (error: any) {
      logger.error(`VM deletion failed`, { lab_request_id, error: error.message });
      vmDeleteErrors.push({ lab_request_id, error: error.toString() });
    }
  }

  // Report results
  if (vmDeleteErrors.length > 0) {
    logger.error(`Failed to delete ${vmDeleteErrors.length} out of ${allLabRequestIds.length} VMs`, {
      total_vms: allLabRequestIds.length,
      successful_deletions: successfulDeletions,
      failed_deletions: vmDeleteErrors.length,
      errors: vmDeleteErrors
    });
    throw new Error(`Failed to delete ${vmDeleteErrors.length} out of ${allLabRequestIds.length} VMs`);
  }

  logger.info(`All VMs deleted successfully (${successfulDeletions}/${allLabRequestIds.length})`);
}
