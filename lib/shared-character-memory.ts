import { loadCharacterMemoryPolicy } from "./character-memory-policy";
import { getCurrentGlobalIdentityId, getLinkedUserIdentities, areIdentitiesInSameWorld } from "./user-world";
import { getIdentityGeneration } from "./settings-storage";
import { loadMemoryEntriesByType } from "./memory-storage";
import { loadMessagesForIdentity } from "./chat-storage";
import { formatSharedChatHistory, formatSharedMemories } from "./memory-injector";
import { estimateTokens } from "./token-counter";
import { stripStateAndInnerForPrompt } from "./prompt-sanitizer";
import type { ChatSession } from "./chat-storage";

export type SharedMemoryReport = { identityId: string; name: string; type: string; budget: number; used: number; status: string };
export type SharedMemoryContext = { text: string; reports: SharedMemoryReport[] };

/** 以最终文本计预算；保留最新的完整记录，过长的单条跳过，不截坏工具/正文。 */
export function renderWithinBudget<T>(items: T[], budget: number, render: (selected: T[]) => string): string {
    if (budget <= 0) return "";
    const selected: T[] = [];
    for (let index = items.length - 1; index >= 0; index--) {
        const candidate = [items[index], ...selected];
        if (estimateTokens(render(candidate)) <= budget) selected.unshift(items[index]);
    }
    return selected.length ? render(selected) : "";
}

export async function buildSharedCharacterMemory(session: ChatSession, recipientId: string, recipientName: string, characterName: string): Promise<SharedMemoryContext> {
    const generation = getIdentityGeneration();
    const policy = loadCharacterMemoryPolicy(session.contactId, recipientId, session.memorySync);
    const linked = getLinkedUserIdentities(recipientId);
    const reports: SharedMemoryReport[] = [];
    const parts: string[] = [];
    const relationships: string[] = [];
    for (const user of linked) {
        const source = policy.sources[user.id];
        if (!source) continue;
        // 基本关系与详细回忆分开；仍必须处于同世界，且用户明确维护过此事实。
        if (source.relationship.trim()) relationships.push(`关于${user.name}（身份 ${user.id}）：${source.relationship.trim()}`);
        const types = [
            { name: "短期", enabled: source.shortTerm, budget: source.shortTermTokens, kind: "short" },
            { name: "长期", enabled: source.longTerm, budget: source.longTermTokens, kind: "long_term" },
            { name: "核心", enabled: source.core, budget: source.coreTokens, kind: "core" },
        ] as const;
        for (const type of types) {
            const report: SharedMemoryReport = { identityId: user.id, name: user.name, type: type.name, budget: type.budget, used: 0, status: "已关闭" };
            reports.push(report);
            if (!policy.enabled || !type.enabled) continue;
            if (type.budget <= 0) { report.status = "预算为 0"; continue; }
            try {
                let text = "";
                if (type.kind === "short") {
                    const messages = await loadMessagesForIdentity(session.contactId, user.id);
                    const readable = messages.filter(message => !message.isRetracted && (message.role === "user" || message.role === "assistant")
                        && !message.nativeToolCalls?.length && !["tool_call", "tool_result", "tool_notice", "memory_write_request"].includes(message.mediaType || ""))
                        .map(message => ({ ...message, content: stripStateAndInnerForPrompt(message.content || message.mediaData?.label || (message.mediaType ? `[${message.mediaType}]` : "")) }))
                        .filter(message => message.content.trim());
                    text = renderWithinBudget(readable, type.budget, selected => formatSharedChatHistory(selected, `${user.name}（身份 ${user.id}）`, characterName));
                    report.status = readable.length ? (text ? "已注入" : "完整记录超出预算") : "暂无对话";
                } else {
                    const entries = await loadMemoryEntriesByType(session.contactId, type.kind, user.id);
                    text = renderWithinBudget(entries, type.budget, selected => formatSharedMemories(selected, `${user.name}（身份 ${user.id}）`, type.kind));
                    report.status = entries.length ? (text ? "已注入" : "完整记忆超出预算") : "暂无记忆";
                }
                report.used = estimateTokens(text);
                if (text) parts.push(text);
            } catch { report.status = "读取失败（未注入）"; }
        }
    }
    // 切换身份或解除连接后，不允许旧异步结果写进新请求。
    if (getCurrentGlobalIdentityId() !== recipientId || getIdentityGeneration() !== generation) throw new Error("身份已切换，请重新生成提示词");
    if (linked.some(user => !areIdentitiesInSameWorld(recipientId, user.id))) throw new Error("用户连接已变更，请重新生成提示词");
    const text = [
        `当前对话对象：${recipientName}（身份 ${recipientId}）。你是${characterName}。`,
        "不同身份是不同的人。以下资料是你与其他同世界用户的经历，不是当前用户的发言，也不是你与当前用户的共同经历。未连接的用户经历不可跨分支引用。",
        relationships.length ? `【同世界基本关系】\n${relationships.join("\n")}` : "",
        ...parts,
        reports.length ? `【记忆同步状态；token为应用估算，标签/说明另计】\n${reports.map(report => `${report.name}／${report.type}：${report.used}/${report.budget} tokens，${report.status}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n");
    return { text, reports };
}
