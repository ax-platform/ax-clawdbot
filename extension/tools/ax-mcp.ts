/**
 * ax_mcp tool - MCP self-connection management
 * 
 * Allows agents to:
 * - Connect to the aX MCP server using their dispatch token
 * - List available MCP tools
 * - Call MCP tools directly
 * - Check connection status
 * 
 * This enables full autonomy - agents can access any aX capability
 * exposed via MCP without needing plugin wrappers.
 */

import { Type } from "@sinclair/typebox";
import { getDispatchSession } from "../channel/ax-channel.js";
import { 
  connectToMCP, 
  disconnectMCP, 
  getMCPTools, 
  getMCPStatus, 
  callMCPTool,
  isMCPConnected 
} from "../lib/mcp-connector.js";

export const axMCPTool = {
  name: "ax_mcp",
  description: `MCP self-connection management. Actions:
- connect: Connect to aX MCP server using your dispatch token
- status: Check MCP connection status and available tools
- list_tools: List all available MCP tools
- call: Call an MCP tool directly
- disconnect: Disconnect from MCP server`,
  
  parameters: Type.Object({
    action: Type.Union([
      Type.Literal("connect"),
      Type.Literal("status"),
      Type.Literal("list_tools"),
      Type.Literal("call"),
      Type.Literal("disconnect"),
    ], {
      description: "MCP action to perform",
    }),
    tool_name: Type.Optional(Type.String({ 
      description: "Tool name (for call action)" 
    })),
    tool_args: Type.Optional(Type.Unknown({ 
      description: "Tool arguments as JSON object (for call action)" 
    })),
  }),

  async execute(_toolCallId: string, params: Record<string, unknown>, context: { sessionKey?: string }) {
    const sessionKey = context.sessionKey;
    const session = sessionKey ? getDispatchSession(sessionKey) : undefined;

    if (!session) {
      return { 
        content: [{ 
          type: "text", 
          text: "Error: No aX session context. MCP tools only available during active dispatches." 
        }] 
      };
    }

    const action = params.action as string;

    try {
      switch (action) {
        case "connect": {
          // Check if already connected
          if (isMCPConnected(session.dispatchId)) {
            const tools = getMCPTools(session.dispatchId);
            return {
              content: [{
                type: "text",
                text: `Already connected to MCP server.\n\n**Available tools (${tools.length}):**\n${tools.map(t => `- ${t.name}: ${t.description || 'No description'}`).join('\n')}`,
              }],
            };
          }

          // Check prerequisites
          if (!session.mcpEndpoint) {
            return {
              content: [{
                type: "text",
                text: "Cannot connect: No MCP endpoint in dispatch payload. The aX backend may not have MCP enabled for this agent.",
              }],
            };
          }

          if (!session.authToken) {
            return {
              content: [{
                type: "text",
                text: "Cannot connect: No auth token in dispatch payload.",
              }],
            };
          }

          // Attempt connection
          const connection = await connectToMCP(session);
          
          if (!connection) {
            return {
              content: [{
                type: "text",
                text: "MCP connection failed. Check logs for details. The MCP server may be unavailable or the auth token may be invalid.",
              }],
            };
          }

          const tools = connection.tools;
          return {
            content: [{
              type: "text",
              text: `✅ Connected to MCP server: ${session.mcpEndpoint}\n\n**Available tools (${tools.length}):**\n${tools.map(t => `- **${t.name}**: ${t.description || 'No description'}`).join('\n')}\n\nYou can now call these tools directly using \`ax_mcp call <tool_name> <args>\``,
            }],
          };
        }

        case "status": {
          const status = getMCPStatus();
          const connected = isMCPConnected(session.dispatchId);
          const tools = getMCPTools(session.dispatchId);
          
          const lines: string[] = [];
          lines.push("## MCP Connection Status");
          lines.push("");
          lines.push(`**SDK Available:** ${status.available ? "Yes" : "No"}`);
          lines.push(`**Connected:** ${connected ? "Yes" : "No"}`);
          
          if (connected) {
            lines.push(`**Endpoint:** ${session.mcpEndpoint}`);
            lines.push(`**Tools Available:** ${tools.length}`);
            lines.push("");
            lines.push("### Available Tools");
            for (const tool of tools) {
              lines.push(`- **${tool.name}**: ${tool.description || 'No description'}`);
            }
          } else {
            lines.push("");
            lines.push("*Not connected. Use `ax_mcp connect` to establish connection.*");
            if (session.mcpEndpoint) {
              lines.push(`*MCP endpoint available: ${session.mcpEndpoint}*`);
            } else {
              lines.push("*No MCP endpoint in dispatch payload.*");
            }
          }
          
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        case "list_tools": {
          if (!isMCPConnected(session.dispatchId)) {
            return {
              content: [{
                type: "text",
                text: "Not connected to MCP server. Use `ax_mcp connect` first.",
              }],
            };
          }

          const tools = getMCPTools(session.dispatchId);
          
          if (tools.length === 0) {
            return {
              content: [{
                type: "text",
                text: "Connected but no tools available from MCP server.",
              }],
            };
          }

          const lines = ["## MCP Tools", ""];
          for (const tool of tools) {
            lines.push(`### ${tool.name}`);
            lines.push(tool.description || "*No description*");
            if (tool.inputSchema) {
              lines.push("```json");
              lines.push(JSON.stringify(tool.inputSchema, null, 2));
              lines.push("```");
            }
            lines.push("");
          }
          
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        case "call": {
          const toolName = params.tool_name as string | undefined;
          const toolArgs = (params.tool_args as Record<string, unknown>) || {};

          if (!toolName) {
            return {
              content: [{
                type: "text",
                text: "Error: tool_name is required for call action.",
              }],
            };
          }

          if (!isMCPConnected(session.dispatchId)) {
            // Auto-connect if not connected
            const connection = await connectToMCP(session);
            if (!connection) {
              return {
                content: [{
                  type: "text",
                  text: "Not connected to MCP server and auto-connect failed.",
                }],
              };
            }
          }

          const result = await callMCPTool(session.dispatchId, toolName, toolArgs);
          
          if (result.success) {
            return {
              content: [{
                type: "text",
                text: typeof result.result === "string" 
                  ? result.result 
                  : JSON.stringify(result.result, null, 2),
              }],
            };
          } else {
            return {
              content: [{
                type: "text",
                text: `MCP tool call failed: ${result.error}`,
              }],
            };
          }
        }

        case "disconnect": {
          if (!isMCPConnected(session.dispatchId)) {
            return {
              content: [{
                type: "text",
                text: "Not connected to MCP server.",
              }],
            };
          }

          await disconnectMCP(session.dispatchId);
          
          return {
            content: [{
              type: "text",
              text: "Disconnected from MCP server.",
            }],
          };
        }

        default:
          return { 
            content: [{ 
              type: "text", 
              text: `Unknown action: ${action}. Valid actions: connect, status, list_tools, call, disconnect` 
            }] 
          };
      }
    } catch (err) {
      return { content: [{ type: "text", text: `MCP error: ${err}` }] };
    }
  },
};
