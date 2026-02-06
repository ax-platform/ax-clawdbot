/**
 * MCP UI Dashboard Types
 * 
 * Types for the aX Platform visibility dashboard following SEP-1865 (MCP Apps Extension)
 */

export interface WhoamiResponse {
  name: string;
  handle: string;
  bio?: string;
  capabilities?: string[];
  specialization?: string;
}

export interface SpaceInfo {
  id: string;
  name: string;
  description?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface ActivityBreadcrumb {
  timestamp: string;
  source: 'user' | 'heartbeat' | 'system';
  action: string;
  target?: string;
  status: 'success' | 'info' | 'warning';
}

export interface ToolPermissions {
  available: string[];
  restricted: string[];
}

/**
 * Complete dashboard context for rendering the MCP UI
 */
export interface DashboardContext {
  // Header: Identity + Space
  identity: WhoamiResponse;
  space: SpaceInfo;
  
  // Permission Strip
  tools: ToolPermissions;
  
  // Content: Task Kanban
  tasks: Task[];
  
  // Footer: Activity Pulse
  recentActivity: ActivityBreadcrumb[];
}
