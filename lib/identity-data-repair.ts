import { chatDb } from "./chat-db";
import { kvEntries, kvSetAsync, kvRemoveAsync, kvGet, isKvHydrated } from "./kv-db";
import { loadUserIdentities, getIdentityGeneration } from "./settings-storage";
import { loadAllMemoryEntriesForRepair, writeMemoryEntriesForRepair } from "./memory-storage";
import { resetChatStorageForIdentity } from "./chat-storage";
import { setIdentityRepairInProgress } from "./identity-operation-state";

export const IDENTITY_DATA_REPAIRED_EVENT = "identity-data-repaired";
let repairing = false;
export function isIdentityDataRepairing(): boolean { return repairing; }
export type IdentityRepairPreview = Awaited<ReturnType<typeof previewIdentityRepair>>;

async function snapshot() {
    if (!isKvHydrated()) throw new Error("存储尚未加载完成，请稍后再预览");
    const [sessions, contacts, messages, memories] = await Promise.all([
        chatDb.sessions.toArray(), chatDb.contacts.toArray(), chatDb.messages.toArray(), loadAllMemoryEntriesForRepair(),
    ]);
    return { sessions, contacts, messages, memories, kv: kvEntries(), identities: loadUserIdentities() };
}
export async function previewIdentityRepair(ownerId: string) {
    if (!loadUserIdentities().some(user => user.id === ownerId)) throw new Error("请明确选择千羽青的身份卡");
    if (kvGet("ai_phone_identity_repair_v2")) throw new Error("历史归属已修复，不可重复执行");
    const data = await snapshot();
    const sessionIds = new Set(data.sessions.map(session => session.id));
    const missingSessions = data.messages.filter(message => !sessionIds.has(message.sessionId)).length;
    // 用户已明确：本机此前全部聊天和记忆属于千羽青，不按名字、来源或日期推断。
    return { ownerId, generation: getIdentityGeneration(), data,
        counts: { sessions: data.sessions.length, messages: data.messages.length, memories: data.memories.length, contacts: data.contacts.length, missingSessions },
    };
}

/** 将预览确认的全部历史归属改回千羽青；保留会话和消息 ID，线下记录无需搬动。 */
export async function applyIdentityRepair(preview: IdentityRepairPreview): Promise<string> {
    if (repairing) throw new Error("修复正在进行");
    if (kvGet("ai_phone_identity_repair_v2")) throw new Error("旧数据修复已执行，请先查看备份记录，不可重复迁移");
    if (!loadUserIdentities().some(user => user.id === preview.ownerId)) throw new Error("目标身份已不存在，请重新预览");
    if (preview.generation !== getIdentityGeneration()) throw new Error("身份已切换，请重新预览");
    if (preview.counts.missingSessions) throw new Error("发现孤立消息，请先恢复缺失会话；为避免遗漏，本次修复已取消");
    repairing = true;
    setIdentityRepairInProgress(true);
    let backupKey = "";
    let original: Awaited<ReturnType<typeof snapshot>> | null = null;
    const touchedKv = new Set<string>();
    let writesStarted = false;
    let rollbackFailed = false;
    try {
        const current = await snapshot();
        original = current;
        const unchanged = JSON.stringify([current.sessions, current.contacts, current.messages, current.memories, current.kv, current.identities]) === JSON.stringify([preview.data.sessions, preview.data.contacts, preview.data.messages, preview.data.memories, preview.data.kv, preview.data.identities]);
        if (!unchanged) throw new Error("预览后数据发生变化，请停止生成任务并重新预览");
        if (preview.generation !== getIdentityGeneration()) throw new Error("身份已切换，请重新预览");
        const { ownerId } = preview;
        backupKey = `ai_phone_identity_repair_backup_v2:${Date.now()}`;
        // 必须先完成备份持久化；不是截图，也不是无效的下载提示。
        await kvSetAsync(backupKey, JSON.stringify({ version: 2, ownerId, status: "prepared", data: current }));
        const patchedSessions = current.sessions.map(session => ({ ...session, identityId: ownerId }));
        const patchedContacts = current.contacts.map(contact => ({ ...contact, identityId: ownerId }));
        const patchedMemories = current.memories.map(entry => ({ ...entry, identityId: ownerId }));
        // 消息和线下记录通过原会话 ID 关联；只修正归属，不拆分、不清零状态。
        writesStarted = true;
        await chatDb.transaction("rw", chatDb.sessions, chatDb.contacts, async () => {
            await chatDb.sessions.bulkPut(patchedSessions);
            await chatDb.contacts.bulkPut(patchedContacts);
        });
        await writeMemoryEntriesForRepair(patchedMemories);
        touchedKv.add("ai_phone_identity_repair_v2");
        await kvSetAsync("ai_phone_identity_repair_v2", JSON.stringify({ ownerId, counts: preview.counts, backupKey, completedAt: new Date().toISOString() }));
        resetChatStorageForIdentity();
        window.dispatchEvent(new CustomEvent(IDENTITY_DATA_REPAIRED_EVENT));
        return backupKey;
    } catch (error) {
        let rollbackError = "";
        if (writesStarted && original) {
            try {
                await chatDb.transaction("rw", chatDb.sessions, chatDb.contacts, async () => {
                    await chatDb.sessions.bulkPut(original!.sessions);
                    await chatDb.contacts.bulkPut(original!.contacts);
                });
                await writeMemoryEntriesForRepair(original.memories);
                for (const key of touchedKv) {
                    const previous = original.kv.find(entry => entry.key === key);
                    if (previous) await kvSetAsync(key, previous.value); else await kvRemoveAsync(key);
                }
                resetChatStorageForIdentity();
            } catch (reason) { rollbackError = reason instanceof Error ? reason.message : String(reason); }
        }
        rollbackFailed = !!rollbackError;
        if (backupKey) await kvSetAsync("ai_phone_identity_repair_failed_v2", JSON.stringify({ backupKey, rollbackError, error: error instanceof Error ? error.message : String(error) }));
        if (rollbackError) throw new Error(`修复失败且自动回滚未完成。备份键：${backupKey}；请勿继续聊天。${rollbackError}`);
        throw error;
    } finally {
        repairing = false;
        // 回滚失败时保持写锁，避免继续写入破坏恢复依据。
        if (!rollbackFailed) setIdentityRepairInProgress(false);
    }
}
