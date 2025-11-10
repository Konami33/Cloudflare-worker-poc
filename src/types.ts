/**
 * TypeScript interfaces for Cloud Lab State Management
 */

// VM information structure
export interface VM {
  name: string;
  network_id: string;
  netbird_ip: string;
}

// Worker node structure
export interface WorkerNode {
  name: string;
  worker_lab_request_id: string;
  network_id: string;
  netbird_ip: string;
}

// Load balancer structure
export interface LoadBalancer {
  id: string;
  domain: string;
  port: string;
}

// Main lab session interface
export interface LabSession {
  id?: string;  // UUID, generated if not provided
  labId: string;
  labTitle: string;
  labGroupID: string;
  moduleID: string;
  duration: number;
  activatedAt: string;  // ISO 8601 timestamp
  counterID: string;
  configId: string;
  workerConfigId?: string;
  lab_request_id: string;
  user_id: string;
  terminal_url: string;
  validation: number;
  vscode_domain?: string;
  puku_domain?: string;
  vm: VM;
  worker_nodes?: WorkerNode[];
  loadBalancers?: LoadBalancer[];
}

// Database row interface (with JSON fields as strings)
export interface LabSessionRow {
  id: string;
  labId: string;
  labTitle: string;
  labGroupID: string;
  moduleID: string;
  duration: number;
  activatedAt: string;
  counterID: string;
  configId: string;
  workerConfigId: string | null;
  lab_request_id: string;
  user_id: string;
  terminal_url: string;
  validation: number;
  vscode_domain: string | null;
  puku_domain: string | null;
  vm: string;  // JSON string
  worker_nodes: string | null;  // JSON string
  loadBalancers: string | null;  // JSON string
  created_at: string;
  updated_at: string;
}

// Cloudflare Worker environment bindings
export interface Env {
  DB: any;  // D1Database type will be available at runtime
  SESSION_MANAGER: DurableObjectNamespace;  // Durable Object for session management
  ENVIRONMENT?: string;
  BACKEND_API_URL?: string;  // Backend API base URL
  BACKEND_API_TOKEN?: string;  // Backend API authentication token
}

// API Response structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Update lab session payload (for PUT endpoint)
export interface UpdateLabSessionPayload {
  worker_nodes?: WorkerNode[];
  loadBalancers?: LoadBalancer[];
  vscode_domain?: string;
  puku_domain?: string;
  terminal_url?: string;
  duration?: number;
  [key: string]: any;  // Allow other fields to be updated
}
