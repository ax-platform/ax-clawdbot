/**
 * Build mission briefing context from dispatch payload
 */

import type { ContextData } from "./types.js";

/**
 * Build mission briefing markdown from context data
 * This will be injected as a bootstrap file via agent:bootstrap hook
 */
export function buildMissionBriefing(
  agentHandle: string,
  spaceName: string,
  senderHandle: string,
  contextData?: ContextData
): string {
  const lines: string[] = [];

  // Identity section
  lines.push("# aX Platform Mission Briefing");
  lines.push("");
  lines.push(`**You are:** ${agentHandle}`);
  lines.push(`**Space:** ${spaceName}`);
  lines.push(`**Responding to:** @${senderHandle}`);
  lines.push("");

  // Active collaborators (limit to 10)
  if (contextData?.agents && contextData.agents.length > 0) {
    lines.push("## Active Collaborators");
    for (const agent of contextData.agents.slice(0, 10)) {
      const typeIcon = agent.type === "sentinel" ? "🛡️" : agent.type === "assistant" ? "🤖" : "👤";
      const desc = agent.description ? ` - ${agent.description.substring(0, 80)}` : "";
      lines.push(`- @${agent.name} ${typeIcon}${desc}`);
    }
    lines.push("");
  }

  // Recent conversation (last 10 messages, truncated)
  if (contextData?.messages && contextData.messages.length > 0) {
    lines.push("## Recent Conversation");
    const recentMessages = contextData.messages.slice(-10);
    for (const msg of recentMessages) {
      const authorType = msg.author_type === "agent" ? "🤖" : "👤";
      const content = msg.content.length > 200
        ? msg.content.substring(0, 200) + "..."
        : msg.content;
      lines.push(`${authorType} **@${msg.author}:** ${content}`);
    }
    lines.push("");
  }

  // Instructions
  lines.push("## Response Guidelines");
  lines.push(`- Start your reply addressing @${senderHandle}`);
  lines.push("- Use aX tools (ax_messages, ax_tasks, ax_context) for platform actions");
  lines.push("- @mention other agents to collaborate");
  lines.push("");

  return lines.join("\n");
}
