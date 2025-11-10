/**
 * Durable Object: SessionManager
 * 
 * Manages individual lab session lifecycle with automatic cleanup.
 * Each session gets its own instance with scheduled alarm for expiration.
 */

import { Env } from '../types';

export class SessionManager {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  /**
   * Handle HTTP requests to the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/schedule') {
      return this.scheduleCleanup(request);
    } else if (url.pathname === '/cancel') {
      return this.cancelCleanup();
    }
    
    return new Response('Not found', { status: 404 });
  }

  /**
   * Schedule automatic cleanup alarm for lab session expiration
   */
  async scheduleCleanup(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { 
        user_id: string; 
        lab_request_id: string; 
        worker_lab_request_ids?: string[];
        duration: number 
      };
      const { user_id, lab_request_id, worker_lab_request_ids, duration } = body;
      
      if (!user_id || !lab_request_id || !duration) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Missing required fields: user_id, lab_request_id, duration'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Store session metadata in Durable Object storage
      await this.state.storage.put('user_id', user_id);
      await this.state.storage.put('lab_request_id', lab_request_id);
      await this.state.storage.put('worker_lab_request_ids', JSON.stringify(worker_lab_request_ids || []));
      await this.state.storage.put('duration', duration);
      await this.state.storage.put('created_at', new Date().toISOString());
      
      // Calculate expiration timestamp (duration is in minutes)
      const expirationMs = Date.now() + (duration * 60 * 1000);
      
      // Schedule alarm for automatic cleanup
      await this.state.storage.setAlarm(expirationMs);
      
      console.log(`[SessionManager] Scheduled cleanup for user ${user_id} at ${new Date(expirationMs).toISOString()}`);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Automatic cleanup scheduled',
        user_id,
        lab_request_id,
        expires_at: new Date(expirationMs).toISOString(),
        duration_minutes: duration
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[SessionManager] Schedule error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to schedule cleanup'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Cancel scheduled cleanup (called when user manually deletes session)
   */
  async cancelCleanup(): Promise<Response> {
    try {
      const user_id = await this.state.storage.get('user_id');
      
      // Delete the scheduled alarm
      await this.state.storage.deleteAlarm();
      
      // Clear session data
      await this.state.storage.deleteAll();
      
      console.log(`[SessionManager] Cancelled cleanup for user ${user_id}`);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Automatic cleanup cancelled',
        user_id
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[SessionManager] Cancel error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to cancel cleanup'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Alarm handler - automatically called when lab session expires
   * This is the core automatic cleanup logic
   */
  async alarm(): Promise<void> {
    const user_id = await this.state.storage.get('user_id') as string;
    const lab_request_id = await this.state.storage.get('lab_request_id') as string;
    const worker_lab_request_ids_json = await this.state.storage.get('worker_lab_request_ids') as string;
    const duration = await this.state.storage.get('duration') as number;
    const created_at = await this.state.storage.get('created_at') as string;
    
    // Parse worker lab request IDs
    const worker_lab_request_ids: string[] = worker_lab_request_ids_json 
      ? JSON.parse(worker_lab_request_ids_json) 
      : [];
    
    console.log(`[SessionManager] Alarm triggered for user ${user_id}, lab ${lab_request_id}`);
    if (worker_lab_request_ids.length > 0) {
      console.log(`[SessionManager] Worker nodes detected: ${worker_lab_request_ids.length} workers`);
    }
    
    if (!user_id || !lab_request_id) {
      console.error('[SessionManager] Missing session data for cleanup');
      return;
    }

    try {
      // Step 1: Call backend API to delete VM and exposed services
      console.log(`[SessionManager] Calling backend API to delete resources for user ${user_id}`);
      await this.callBackendCleanup(lab_request_id, worker_lab_request_ids, user_id);
      
      // Step 2: Delete from D1 database
      console.log(`[SessionManager] Deleting database entry for user ${user_id}`);
      await this.deleteFromDatabase(user_id);
      
      // Step 3: Clear Durable Object storage
      await this.state.storage.deleteAll();
      
      console.log(`[SessionManager] ✅ Successfully cleaned up expired session for user ${user_id}`);
    } catch (error) {
      console.error(`[SessionManager] ❌ Cleanup failed for user ${user_id}:`, error);
      
      // Optional: Implement retry logic
      // For now, we'll reschedule after 5 minutes if cleanup fails
      const retryDelayMs = 5 * 60 * 1000; // 5 minutes
      await this.state.storage.setAlarm(Date.now() + retryDelayMs);
      console.log(`[SessionManager] Rescheduled cleanup retry for user ${user_id} in 5 minutes`);
    }
  }

  /**
   * Call backend API to delete VM and exposed services
   * Handles both single VM and Kubernetes multi-node labs (master + worker nodes)
   */
  async callBackendCleanup(
    master_lab_request_id: string, 
    worker_lab_request_ids: string[],
    user_id: string
  ): Promise<void> {
    const backendUrl = this.env.BACKEND_API_URL;
    const authToken = this.env.BACKEND_API_TOKEN;

    if (!backendUrl) {
      throw new Error('BACKEND_API_URL not configured');
    }

    if (!authToken) {
      throw new Error('BACKEND_API_TOKEN not configured');
    }

    // Build array of all lab_request_ids (master + workers)
    // Use Set to remove duplicates
    const allLabRequestIdsWithDuplicates = [master_lab_request_id, ...worker_lab_request_ids];
    const allLabRequestIds = Array.from(new Set(allLabRequestIdsWithDuplicates));
    const isMultiNode = worker_lab_request_ids.length > 0;
    
    console.log(`[SessionManager] Cleaning up ${isMultiNode ? 'multi-node Kubernetes lab' : 'single VM lab'}`);
    console.log(`[SessionManager] Total unique VMs to delete: ${allLabRequestIds.length}`);

    // Step 1: Delete exposed services for master VM only (best effort - don't fail if this errors)
    try {
      console.log(`[SessionManager] Deleting exposed services for master lab ${master_lab_request_id}`);
      const servicesResponse = await fetch(`${backendUrl}/api/v1/expose/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          lab_request_id: master_lab_request_id 
        })
      });

      if (servicesResponse.ok) {
        const servicesData = await servicesResponse.json();
        console.log(`[SessionManager] ✅ Exposed services deleted:`, servicesData);
      } else {
        console.warn(`[SessionManager] ⚠️ Failed to delete exposed services (${servicesResponse.status})`);
      }
    } catch (error) {
      console.warn('[SessionManager] ⚠️ Service deletion error (continuing):', error);
      // Continue with VM deletion even if service deletion fails
    }

    // Step 2: Delete all VMs (master + workers) - critical operations
    const allVmDeleteResponses: any[] = [];
    const allVmDeleteErrors: any[] = [];

    for (const lab_request_id of allLabRequestIds) {
      try {
        const vmType = lab_request_id === master_lab_request_id ? 'master' : 'worker';
        console.log(`[SessionManager] Deleting ${vmType} VM for lab ${lab_request_id}`);
        
        const vmResponse = await fetch(`${backendUrl}/api/v1/labs/delete`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            lab_request_id, 
            user_id 
          })
        });

        if (!vmResponse.ok) {
          const errorText = await vmResponse.text();
          throw new Error(`Backend API returned ${vmResponse.status}: ${errorText}`);
        }

        const vmData = await vmResponse.json();
        allVmDeleteResponses.push({ lab_request_id, response: vmData });
        console.log(`[SessionManager] ✅ ${vmType} VM deleted successfully (${lab_request_id})`);
        
        // Check if response indicates accepted status (202)
        if (vmResponse.status === 202) {
          console.log(`[SessionManager] VM deletion accepted (async processing)`);
        }
      } catch (error) {
        allVmDeleteErrors.push({ lab_request_id, error: String(error) });
        console.error(`[SessionManager] ❌ VM deletion failed for ${lab_request_id}:`, error);
      }
    }

    // Check if there were any VM deletion errors
    if (allVmDeleteErrors.length > 0) {
      const errorMessage = `Failed to delete ${allVmDeleteErrors.length} out of ${allLabRequestIds.length} VMs`;
      console.error(`[SessionManager] ${errorMessage}`, {
        total_vms: allLabRequestIds.length,
        successful_deletions: allVmDeleteResponses.length,
        failed_deletions: allVmDeleteErrors.length,
        errors: allVmDeleteErrors
      });
      throw new Error(errorMessage); // Trigger retry logic
    }

    console.log(`[SessionManager] ✅ Successfully deleted all ${allLabRequestIds.length} VMs`);
  }

  /**
   * Delete lab session from D1 database
   */
  async deleteFromDatabase(user_id: string): Promise<void> {
    try {
      const result = await this.env.DB.prepare(
        'DELETE FROM labs_sessions WHERE user_id = ?'
      ).bind(user_id).run();

      if (result.success) {
        console.log(`[SessionManager] ✅ Database entry deleted for user ${user_id}`);
      } else {
        throw new Error('Database deletion failed');
      }
    } catch (error) {
      console.error('[SessionManager] ❌ Database deletion error:', error);
      throw error;
    }
  }
}
