/**
 * Cloudflare Worker - Lab Sessions API
 * 
 * Main entry point for the lab state management service.
 * Handles routing for POST, GET, PUT, and DELETE endpoints.
 * Includes Cron Trigger for automatic lab session expiration.
 */

import { Env } from './types';
import { createLabSession, getLabSession, updateLabSession, deleteLabSession } from './handlers';
import { errorResponse, handleCORS } from './utils';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight requests
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;

    // Parse the request URL
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Route: POST /api/v1/labs/sessions - Create new lab session
      if (path === '/api/v1/labs/sessions' && method === 'POST') {
        return await createLabSession(request, env);
      }

      // Route: GET /api/v1/labs/sessions/user/:user_id - Get lab session by user ID
      const getUserMatch = path.match(/^\/api\/v1\/labs\/sessions\/user\/([^\/]+)$/);
      if (getUserMatch && method === 'GET') {
        const userId = getUserMatch[1];
        return await getLabSession(userId, env);
      }

      // Route: PUT /api/v1/labs/sessions/:user_id - Update lab session
      const updateUserMatch = path.match(/^\/api\/v1\/labs\/sessions\/([^\/]+)$/);
      if (updateUserMatch && method === 'PUT') {
        const userId = updateUserMatch[1];
        return await updateLabSession(userId, request, env);
      }

      // Route: DELETE /api/v1/labs/sessions/:user_id - Delete lab session
      const deleteUserMatch = path.match(/^\/api\/v1\/labs\/sessions\/([^\/]+)$/);
      if (deleteUserMatch && method === 'DELETE') {
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
      return errorResponse('Route not found', 404);
    } catch (error: any) {
      console.error('Unhandled error:', error);
      return errorResponse(`Internal server error: ${error.message}`, 500);
    }
  },

  /**
   * Scheduled handler - runs periodically via Cron Trigger
   * Checks for expired lab sessions and cleans them up
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[Cron] Starting scheduled cleanup check:', new Date().toISOString());
    ctx.waitUntil(cleanupExpiredSessions(env));
  }
};

/**
 * Clean up expired lab sessions
 * Called by cron trigger to check and delete expired sessions
 */
async function cleanupExpiredSessions(env: Env): Promise<void> {
  try {
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
      console.log('[Cron] No expired sessions found');
      return;
    }

    console.log(`[Cron] Found ${result.results.length} expired session(s)`);

    // Process each expired session
    for (const session of result.results) {
      try {
        const user_id = session.user_id as string;
        const master_lab_request_id = session.lab_request_id as string;
        const worker_nodes_json = session.worker_nodes as string | null;
        
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
            console.warn(`[Cron] Failed to parse worker_nodes for user ${user_id}:`, parseError);
          }
        }

        console.log(`[Cron] Processing expired session for user ${user_id}`);
        
        // Call backend API to delete resources
        await callBackendCleanup(env, master_lab_request_id, worker_lab_request_ids, user_id);
        
        // Delete from database
        await env.DB.prepare('DELETE FROM labs_sessions WHERE user_id = ?')
          .bind(user_id)
          .run();
        
        console.log(`[Cron] ✅ Successfully cleaned up expired session for user ${user_id}`);
      } catch (error) {
        console.error(`[Cron] ❌ Failed to cleanup session ${session.user_id}:`, error);
        // Continue with next session even if one fails
      }
    }
  } catch (error) {
    console.error('[Cron] Scheduled cleanup failed:', error);
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
  user_id: string
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
  
  // console.log(`[Cron] Total unique VMs to delete: ${allLabRequestIds.length}`);

  // Step 1: Delete exposed services for master VM (best effort)
  try {
    console.log(`[Cron] Deleting exposed services for master lab ${master_lab_request_id}`);
    const servicesResponse = await fetch(`${backendUrl}/api/v1/expose/`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ lab_request_id: master_lab_request_id })
    });

    if (servicesResponse.ok) {
      const servicesData = await servicesResponse.json();
      console.log(`[Cron] ✅ Exposed services deleted:`, servicesData);
    } else {
      console.warn(`[Cron] ⚠️ Failed to delete exposed services (${servicesResponse.status})`);
    }
  } catch (error) {
    console.warn('[Cron] ⚠️ Service deletion error (continuing):', error);
  }

  // Step 2: Delete all VMs (master + workers)
  const vmDeleteErrors: Array<{ lab_request_id: string; error: string }> = [];
  let successfulDeletions = 0;

  for (const lab_request_id of allLabRequestIds) {
    try {
      console.log(`[Cron] Deleting VM for lab ${lab_request_id}`);
      const vmResponse = await fetch(`${backendUrl}/api/v1/labs/delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lab_request_id, user_id })
      });

      if (!vmResponse.ok) {
        const errorText = await vmResponse.text();
        throw new Error(`Backend API returned ${vmResponse.status}: ${errorText}`);
      }

      successfulDeletions++;
      console.log(`[Cron] ✅ VM deleted successfully (${lab_request_id})`);
    } catch (error: any) {
      console.error(`[Cron] ❌ VM deletion failed for ${lab_request_id}:`, error);
      vmDeleteErrors.push({ lab_request_id, error: error.toString() });
    }
  }

  // Report results
  if (vmDeleteErrors.length > 0) {
    console.error(`[Cron] Failed to delete ${vmDeleteErrors.length} out of ${allLabRequestIds.length} VMs`, {
      total_vms: allLabRequestIds.length,
      successful_deletions: successfulDeletions,
      failed_deletions: vmDeleteErrors.length,
      errors: vmDeleteErrors
    });
    throw new Error(`Failed to delete ${vmDeleteErrors.length} out of ${allLabRequestIds.length} VMs`);
  }

  console.log(`[Cron] ✅ All VMs deleted successfully (${successfulDeletions}/${allLabRequestIds.length})`);
}
