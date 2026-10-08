import { kvGet, kvSet, registerDynamicPrefix } from "./kv-db";
import { loadMemoryConfig } from "./memory-storage";
import { getCurrentGlobalIdentityId } from "./user-world";
import type { ChatSession } from "./chat-storage";

export type MemoryShareSource = {
    shortTerm: boolean; longTerm: boolean; core: boolean;
    shortTermTokens: number; longTermTokens: number; coreTokens: number;
    /** 明确维护的基本关系，不从旧聊天猜测，不计入详细回忆预算。 */
    relationship: string;
};
export type CharacterMemoryPolicy = { version: 2; enabled: boolean; sources: Record<string, MemoryShareSource> };
const PREFIX = "ai_phone_character_memory_policy_v2:";
export const MEMORY_POLICY_UPDATED_EVENT = "character-memory-policy-updated";
registerDynamicPrefix(PREFIX);
export function normalizeShareTokens(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100000, Math.floor(n))) : fallback;
}
export function defaultMemoryShareSource(): MemoryShareSource {
    const config = loadMemoryConfig();
    return { shortTerm: false, longTerm: false, core: false,
        shortTermTokens: normalizeShareTokens(config.shortTermTokenBudget, 4000),
        longTermTokens: normalizeShareTokens(config.longTermTokenBudget, 2000),
        coreTokens: normalizeShareTokens(config.coreMemoryTokenBudget, 1000), relationship: "" };
}
function key(characterId: string, recipientId: string) { return PREFIX + encodeURIComponent(characterId) + ":" + encodeURIComponent(recipientId); }
export function loadCharacterMemoryPolicy(characterId: string, recipientId = getCurrentGlobalIdentityId(), legacy?: ChatSession["memorySync"]): CharacterMemoryPolicy {
    let stored: Partial<CharacterMemoryPolicy> | null = null;
    try { stored = JSON.parse(kvGet(key(characterId, recipientId)) || "null"); } catch { /* corrupt config defaults off */ }
    const sources: Record<string, MemoryShareSource> = {};
    const defaults = defaultMemoryShareSource();
    for (const [id, source] of Object.entries(stored?.sources || {})) {
        sources[id] = { ...defaults, shortTerm: source.shortTerm === true, longTerm: source.longTerm === true, core: source.core === true,
            shortTermTokens: normalizeShareTokens(source.shortTermTokens, defaults.shortTermTokens),
            longTermTokens: normalizeShareTokens(source.longTermTokens, defaults.longTermTokens),
            coreTokens: normalizeShareTokens(source.coreTokens, defaults.coreTokens), relationship: typeof source.relationship === "string" ? source.relationship : "" };
    }
    if (!stored && legacy) {
        // 升级旧布尔授权；不把消息条数冒充 token 数。
        for (const [id, source] of Object.entries(legacy.sources || {})) sources[id] = { ...defaults, shortTerm: source.shortTerm === true, longTerm: source.longTerm === true, core: source.core === true };
        const migrated: CharacterMemoryPolicy = { version: 2, enabled: legacy.enabled === true, sources };
        kvSet(key(characterId, recipientId), JSON.stringify(migrated));
        return migrated;
    }
    return { version: 2, enabled: stored?.enabled === true, sources };
}
export function saveCharacterMemoryPolicy(characterId: string, recipientId: string, policy: CharacterMemoryPolicy): void {
    kvSet(key(characterId, recipientId), JSON.stringify({ ...policy, version: 2 }));
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(MEMORY_POLICY_UPDATED_EVENT, { detail: { characterId, recipientId } }));
}
