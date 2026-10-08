// lib/memory-injector.ts
// Formats long-term memory entries into injectable prompt text.

import type { MemoryEntry } from "./memory-types";
function formatMemoryGroups(memories: MemoryEntry[]): string {
    return memories.map(entry => `- ${entry.content}`).join("\n");
}

export function formatLongTermMemories(memories: MemoryEntry[]): string {
    return memories.length > 0 ? formatMemoryGroups(memories) : "";
}

export function formatCoreMemories(memories: MemoryEntry[]): string {
    return memories.length > 0 ? formatMemoryGroups(memories) : "";
}
