// lib/memory-injector.ts
// Formats long-term memory entries into injectable prompt text.

import type { MemoryEntry } from "./memory-types";

/**
 * Format long-term memories for prompt injection.
 * The service layer already handles token-budget filtering,
 * so this just formats the selected entries.
 */
export function formatLongTermMemories(memories: MemoryEntry[]): string {
    if (memories.length === 0) return "";

    const lines: string[] = [];
    for (const entry of memories) {
        lines.push(`- ${entry.content}`);
    }
    return lines.join("\n");
}

export function formatCoreMemories(memories: MemoryEntry[]): string {
    if (memories.length === 0) return "";

    const lines: string[] = [];
    for (const entry of memories) {
        lines.push(`- ${entry.content}`);
    }
    return lines.join("\n");
}

export function formatSharedMemories(memories: Array<Pick<MemoryEntry, "content">>, sourceName: string, kind: "long_term" | "core"): string {
    if (memories.length === 0) return "";
    const title = kind === "core" ? "核心记忆" : "长期记忆";
    return [`【你与${sourceName}的${title}】`, ...memories.map(entry => `- 关于${sourceName}：${entry.content}`)].join("\n");
}

export function formatSharedChatHistory(messages: Array<{ role: string; content: string; createdAt: string }>, sourceName: string, characterName: string): string {
    if (messages.length === 0) return "";
    const lines = [`【你与${sourceName}的历史对话】`];
    for (const message of messages) {
        const speaker = message.role === "assistant" ? `你（${characterName}）` : message.role === "user" ? sourceName : "系统";
        lines.push(`${speaker}：${message.content}`);
    }
    return lines.join("\n");
}
