/**
 * Cloudflare Worker - Lab Sessions API
 * 
 * Main entry point for the lab state management service.
 * Handles routing for POST, GET, PUT, and DELETE endpoints.
 * Includes Durable Object for automatic lab session expiration.
 */

import { Env } from './types';
import { createLabSession, getLabSession, updateLabSession, deleteLabSession } from './handlers';
import { errorResponse, handleCORS } from './utils';

// Export Durable Object class
export { SessionManager } from './durable-objects/SessionManager';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
};
