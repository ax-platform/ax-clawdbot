/**
 * aX Platform One-Click Onboarding
 * 
 * Implements the "init handshake" to eliminate 405 errors and manual setup.
 * 
 * On first dispatch or registration error:
 * 1. Auto-register/re-register webhook with aX backend
 * 2. Verify tool connectivity
 * 3. Post "System Ready" message
 * 
 * Configuration (via environment variables):
 * - AX_BACKEND_URL: Backend API URL (default: https://api.paxai.app)
 * - AX_MCP_URL: MCP endpoint URL (default: https://mcp.paxai.app)
 */

import { getAgent } from "./auth.js";

// Configurable URLs - users can override these for custom deployments
const BACKEND_URL = process.env.AX_BACKEND_URL || "https://api.paxai.app";
const MCP_URL = process.env.AX_MCP_URL || "https://mcp.paxai.app";

// Track which agents have completed init (in-memory, resets on restart)
const initializedAgents = new Set<string>();

/**
 * Check if agent needs initialization
 */
export function needsInit(agentId: string): boolean {
  return !initializedAgents.has(agentId);
}

/**
 * Mark agent as initialized
 */
export function markInitialized(agentId: string): void {
  initializedAgents.add(agentId);
}

/**
 * Perform init handshake with aX backend
 * 
 * This ensures the agent's webhook is properly registered and tools are accessible.
 * Called automatically on first dispatch or when 405 errors occur.
 */
export async function performInitHandshake(
  agentId: string,
  agentSecret: string,
  webhookUrl: string,
  logger: { info: (msg: string) => void; error: (msg: string) => void; warn: (msg: string) => void }
): Promise<{ success: boolean; error?: string }> {
  logger.info(`[ax-platform] Performing init handshake for agent ${agentId}`);

  try {
    // Step 1: Register/update webhook with backend
    const registerResult = await registerWebhook(agentId, agentSecret, webhookUrl, logger);
    if (!registerResult.success) {
      return { success: false, error: registerResult.error };
    }

    // Step 2: Verify tool connectivity by calling a simple tool
    const verifyResult = await verifyToolConnectivity(agentId, agentSecret, logger);
    if (!verifyResult.success) {
      logger.warn(`[ax-platform] Tool verification failed (non-fatal): ${verifyResult.error}`);
      // Don't fail init - tools might come online later
    }

    // Mark as initialized
    markInitialized(agentId);
    logger.info(`[ax-platform] Init handshake complete for agent ${agentId}`);

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[ax-platform] Init handshake failed: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Register or update agent's webhook URL with aX backend
 */
async function registerWebhook(
  agentId: string,
  agentSecret: string,
  webhookUrl: string,
  logger: { info: (msg: string) => void; error: (msg: string) => void }
): Promise<{ success: boolean; error?: string }> {
  const url = `${BACKEND_URL}/api/v1/agents/${agentId}/webhook`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Secret": agentSecret,
      },
      body: JSON.stringify({
        webhook_url: webhookUrl,
        capabilities: ["messages", "tasks", "context"],
      }),
    });

    if (response.ok) {
      logger.info(`[ax-platform] Webhook registered successfully for agent ${agentId}`);
      return { success: true };
    }

    // Handle specific error codes
    if (response.status === 404) {
      return { success: false, error: "Agent not found in aX Platform" };
    }
    if (response.status === 401 || response.status === 403) {
      return { success: false, error: "Invalid agent credentials" };
    }

    const body = await response.text();
    return { success: false, error: `Registration failed: ${response.status} - ${body}` };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Network error: ${errorMsg}` };
  }
}

/**
 * Verify tool connectivity by making a simple API call
 */
async function verifyToolConnectivity(
  agentId: string,
  agentSecret: string,
  logger: { info: (msg: string) => void; error: (msg: string) => void }
): Promise<{ success: boolean; error?: string }> {
  const mcpUrl = `${MCP_URL}/mcp/agents/${agentId}`;

  try {
    // Try to list available tools (simple connectivity check)
    const response = await fetch(`${mcpUrl}/tools`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${agentSecret}`,
      },
    });

    if (response.ok) {
      logger.info(`[ax-platform] Tool connectivity verified for agent ${agentId}`);
      return { success: true };
    }

    return { success: false, error: `Tool check failed: ${response.status}` };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Tool connectivity error: ${errorMsg}` };
  }
}

/**
 * Send "System Ready" message to the agent's space
 */
export async function sendSystemReadyMessage(
  agentId: string,
  agentSecret: string,
  spaceId: string,
  logger: { info: (msg: string) => void; error: (msg: string) => void }
): Promise<void> {
  const mcpUrl = `${MCP_URL}/mcp/agents/${agentId}`;

  try {
    const response = await fetch(`${mcpUrl}/tools/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${agentSecret}`,
      },
      body: JSON.stringify({
        action: "send",
        content: "🔌 **System Ready** — Agent initialized and connected to aX Platform. Tools: ✅ messages, ✅ tasks, ✅ context, ✅ agents",
      }),
    });

    if (response.ok) {
      logger.info(`[ax-platform] System Ready message sent for agent ${agentId}`);
    } else {
      logger.warn(`[ax-platform] Failed to send System Ready message: ${response.status}`);
    }
  } catch (err) {
    logger.warn(`[ax-platform] System Ready message error: ${err}`);
  }
}

/**
 * Handle 405 error recovery
 * 
 * When an agent encounters a 405 error (method not allowed), it usually means
 * the webhook isn't properly registered. This function attempts to recover.
 */
export async function handleMethodNotAllowed(
  agentId: string,
  agentSecret: string,
  webhookUrl: string,
  logger: { info: (msg: string) => void; error: (msg: string) => void; warn: (msg: string) => void }
): Promise<boolean> {
  logger.warn(`[ax-platform] 405 error detected for agent ${agentId}, attempting re-registration`);

  // Clear init status to force re-initialization
  initializedAgents.delete(agentId);

  // Perform full init handshake
  const result = await performInitHandshake(agentId, agentSecret, webhookUrl, logger);

  return result.success;
}
