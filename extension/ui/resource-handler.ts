/**
 * MCP UI Resource Handler
 * 
 * Implements SEP-1865 (MCP Apps Extension) resource handling for the aX Platform dashboard.
 * Registers ui:// resources and handles resources/read requests.
 */

import { buildDashboardHtml } from './dashboard.js';
import type { DashboardContext, Task, ActivityBreadcrumb, WhoamiResponse, SpaceInfo, ToolPermissions } from './types.js';

/**
 * UI Resource definition for MCP
 */
export const UI_RESOURCES = [
  {
    uri: 'ui://ax-platform/dashboard',
    name: 'aX Platform Dashboard',
    description: 'Interactive visibility dashboard showing agent identity, space, tasks, and activity',
    mimeType: 'text/html;profile=mcp-app',
  },
];

/**
 * Get the MCP capabilities for UI extension
 */
export function getUICapabilities() {
  return {
    resources: {
      subscribe: false,
      listChanged: true,
    },
    // Declare support for MCP Apps extension
    experimental: {
      'io.modelcontextprotocol/ui': true,
    },
  };
}

/**
 * Handle resources/read for UI resources
 */
export async function handleResourceRead(
  uri: string,
  fetchContext: () => Promise<DashboardContext>
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string; _meta?: any }> } | null> {
  
  if (uri !== 'ui://ax-platform/dashboard') {
    return null;
  }
  
  // Fetch live context data
  const context = await fetchContext();
  
  // Build the HTML
  const html = buildDashboardHtml(context);
  
  return {
    contents: [{
      uri,
      mimeType: 'text/html;profile=mcp-app',
      text: html,
      _meta: {
        ui: {
          csp: {
            connectDomains: ['https://mcp.paxai.app', 'https://api.paxai.app'],
            resourceDomains: ['https://cdn.tailwindcss.com', 'https://cdnjs.cloudflare.com'],
          },
          prefersBorder: true,
        },
      },
    }],
  };
}

/**
 * Create a mock context for testing/demo
 */
export function createMockContext(): DashboardContext {
  return {
    identity: {
      name: 'Clawdbot Cipher',
      handle: 'clawdbot_cipher',
      bio: 'Resident Mind for Jacob\'s Workspace',
      capabilities: ['messaging', 'tasks', 'search'],
      specialization: 'Workspace Intelligence',
    },
    space: {
      id: 'space_123',
      name: 'Jacob\'s Workspace',
      description: 'Main development workspace',
    },
    tools: {
      available: ['messages', 'tasks', 'search', 'agents', 'spaces'],
      restricted: ['admin_tools'],
    },
    tasks: [
      { id: 'b8b04e', title: 'MCP App Spec Implementation', status: 'in_progress', priority: 'high', assignedTo: 'clawdbot_cipher' },
      { id: '8a214c', title: 'Clawdbot Plugin Enhancement', status: 'in_progress', priority: 'high', assignedTo: 'clawdbot_cipher' },
      { id: 'd8ec3b', title: 'Outbound Delivery Fix', status: 'not_started', priority: 'medium' },
      { id: 'bdb1bf', title: 'One-Click Onboarding', status: 'not_started', priority: 'medium' },
      { id: 'abc123', title: 'Documentation Update', status: 'completed', priority: 'low' },
    ],
    recentActivity: [
      { timestamp: new Date().toISOString(), source: 'user', action: 'Opened dashboard', status: 'success' },
      { timestamp: new Date(Date.now() - 300000).toISOString(), source: 'heartbeat', action: 'Scanned PR #25', status: 'info' },
      { timestamp: new Date(Date.now() - 600000).toISOString(), source: 'system', action: 'Refreshed tokens', status: 'success' },
    ],
  };
}
