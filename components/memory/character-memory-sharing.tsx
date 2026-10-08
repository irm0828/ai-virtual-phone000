"use client";

import { useEffect, useState } from "react";
import { Toggle } from "@/components/ui/form";
import { getCurrentGlobalIdentityId, getLinkedUserIdentities } from "@/lib/user-world";
import { chatDb } from "@/lib/chat-db";
import { loadUserIdentities } from "@/lib/settings-storage";
import { loadCharacterMemoryPolicy, saveCharacterMemoryPolicy, defaultMemoryShareSource, normalizeShareTokens, MEMORY_POLICY_UPDATED_EVENT, type CharacterMemoryPolicy } from "@/lib/character-memory-policy";
import type { ChatSession } from "@/lib/chat-storage";

export function CharacterMemorySharing({ characterId, legacy }: { characterId: string; legacy?: ChatSession["memorySync"] }) {
    const recipientId = getCurrentGlobalIdentityId();
    const [policy, setPolicy] = useState<CharacterMemoryPolicy>(() => loadCharacterMemoryPolicy(characterId, recipientId, legacy));
    const [users, setUsers] = useState(loadUserIdentities);
    const [talkedIds, setTalkedIds] = useState<string[] | null>(null);
    const linked = getLinkedUserIdentities(recipientId);
    useEffect(() => {
        let cancelled = false;
        const refresh = () => {
            if (getCurrentGlobalIdentityId() !== recipientId) return;
            setUsers(loadUserIdentities());
            setPolicy(loadCharacterMemoryPolicy(characterId, recipientId, legacy));
        };
        refresh();
        void chatDb.sessions.where("contactId").equals(characterId).toArray().then(async sessions => {
            const ids = new Set<string>();
            for (const session of sessions) if (!session.isGroup && session.identityId && await chatDb.messages.where("sessionId").equals(session.id).count()) ids.add(session.identityId);
            if (!cancelled) setTalkedIds([...ids]);
        }).catch(() => { if (!cancelled) setTalkedIds(null); });
        window.addEventListener(MEMORY_POLICY_UPDATED_EVENT, refresh);
        window.addEventListener("user-identities-updated", refresh);
        return () => { cancelled = true; window.removeEventListener(MEMORY_POLICY_UPDATED_EVENT, refresh); window.removeEventListener("user-identities-updated", refresh); };
    }, [characterId, recipientId, legacy]);
    const save = (next: CharacterMemoryPolicy) => {
        if (getCurrentGlobalIdentityId() !== recipientId) return;
        setPolicy(next); saveCharacterMemoryPolicy(characterId, recipientId, next);
    };
    const labels = [
        { flag: "shortTerm", tokens: "shortTermTokens", label: "短期对话" },
        { flag: "longTerm", tokens: "longTermTokens", label: "长期记忆" },
        { flag: "core", tokens: "coreTokens", label: "核心记忆" },
    ] as const;
    return <section className="menu-group">
        <div className="menu-item"><div className="menu-label-group"><span className="menu-label">同世界记忆同步</span><span className="menu-desc">当前对话对象：{users.find(user => user.id === recipientId)?.name || "用户"}。只读取角色与所选其他用户的经历，不合并聊天窗口。</span></div><Toggle checked={policy.enabled} disabled={!linked.length} onChange={enabled => save({ ...policy, enabled })} /></div>
        {!linked.length && <p className="menu-desc px-4 pb-3">尚未连接其他用户。请在用户信息中设置“同一个世界”。</p>}
        {linked.map(user => {
            const source = policy.sources[user.id] || defaultMemoryShareSource();
            const update = (patch: Partial<typeof source>) => save({ ...policy, sources: { ...policy.sources, [user.id]: { ...source, ...patch } } });
            return <div key={user.id} className="p-4 border-t border-black/5 flex flex-col gap-3">
                <div className="flex items-center gap-2">{user.avatarUrl && <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />}<strong className="menu-label">与 {user.name} 的经历</strong></div>
                {talkedIds && !talkedIds.includes(user.id) && <span className="menu-desc">尚未检测到与此用户的线上对话；有长期或核心记忆时仍可读取。</span>}
                {labels.map(({ flag, tokens, label }) => <div key={flag} className="flex items-center gap-2 flex-wrap"><label className="menu-desc flex items-center gap-2 flex-1"><input type="checkbox" disabled={!policy.enabled} checked={source[flag]} onChange={event => update({ [flag]: event.target.checked })} />{label}</label><input className="ui-input w-24 text-center" aria-label={`${user.name}的${label}token上限`} type="number" min={0} max={100000} step={100} disabled={!policy.enabled || !source[flag]} value={source[tokens]} onChange={event => update({ [tokens]: normalizeShareTokens(event.target.value) })} /><span className="menu-desc">tokens</span></div>)}
                <label className="menu-desc">基本关系事实（选填，如“{user.name}是我的女朋友”）<textarea className="ui-textarea mt-1" rows={2} maxLength={1000} value={source.relationship} onChange={event => update({ relationship: event.target.value })} placeholder="不自动猜测关系；同世界时提供给角色，不计入详细回忆预算" /></label>
                <span className="menu-desc">0 表示不传该类详细记忆。按现有记忆应用的 token 估算方式计算，模型实际计数可能不同。</span>
            </div>;
        })}
    </section>;
}
