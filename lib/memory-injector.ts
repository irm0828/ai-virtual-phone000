// lib/memory-injector.ts
// Formats long-term memory entries into injectable prompt text.

import type { MemoryEntry } from "./memory-types";
import { loadUserIdentities } from "./settings-storage";

function formatMemoryEntry(entry: MemoryEntry): string {
    const owner = loadUserIdentities().find(identity => identity.id === entry.identityId);
    const attribution = entry.identityId
        ? `记忆所属人物：${owner?.name || "未知人物"}（ID=${entry.identityId}）。正文中的“用户/我”指该人物，不代表当前对话对象。`
        : "记忆人物归属未确认，不得据此认定当前对话对象的身份或关系。";
    return `- [${attribution}] ${entry.content}`;
}

/**
 * Format long-term memories for prompt injection.
 * The service layer already handles token-budget filtering,
 * so this just formats the selected entries.
 */
export function formatLongTermMemories(memories: MemoryEntry[]): string {
    if (memories.length === 0) return "";

    const lines: string[] = [];
    for (const entry of memories) {
        lines.push(formatMemoryEntry(entry));
    }
    return lines.join("\n");
}

export function formatCoreMemories(memories: MemoryEntry[]): string {
    if (memories.length === 0) return "";

    const lines: string[] = [];
    for (const entry of memories) {
        lines.push(formatMemoryEntry(entry));
    }
    return lines.join("\n");
}
