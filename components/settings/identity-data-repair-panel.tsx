"use client";

import { useState } from "react";
import { loadUserIdentities } from "@/lib/settings-storage";
import { previewIdentityRepair, applyIdentityRepair, type IdentityRepairPreview } from "@/lib/identity-data-repair";

export function IdentityDataRepairPanel() {
    const [users] = useState(loadUserIdentities);
    const [ownerId, setOwnerId] = useState("");
    const [preview, setPreview] = useState<IdentityRepairPreview | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [done, setDone] = useState(false);
    const run = async (apply: boolean) => {
        setBusy(true); setMessage("");
        try {
            if (apply && preview) {
                const backupKey = await applyIdentityRepair(preview);
                setDone(true); setPreview(null);
                setMessage(`修复完成。全部已有会话、好友和记忆归属已改为所选千羽青身份。备份编号：${backupKey}。请刷新页面，再切换身份核对。`);
            } else {
                setPreview(await previewIdentityRepair(ownerId));
            }
        } catch (error) {
            setPreview(null);
            setMessage(error instanceof Error ? error.message : "修复失败");
        } finally { setBusy(false); }
    };
    return <section className="menu-group p-4 flex flex-col gap-3">
        <strong className="menu-label">修正千羽青历史数据归属</strong>
        <p className="menu-desc">此前本机全部聊天和记忆属于千羽青。此操作将预览中的全部已有会话、好友和记忆改回千羽青，保留消息、线下记录、置顶和未读状态。先自动备份，只执行一次。</p>
        <label className="menu-desc">千羽青的身份卡
            <select className="ui-input mt-2 w-full" value={ownerId} disabled={busy || done} onChange={event => { setOwnerId(event.target.value); setPreview(null); setMessage(""); }}>
                <option value="">请选择千羽青身份</option>
                {users.map(user => <option key={user.id} value={user.id}>{user.name || "未命名"} · {user.id}</option>)}
            </select>
        </label>
        {!done && <button type="button" className="ui-btn" disabled={busy || !ownerId} onClick={() => void run(false)}>{busy ? "处理中…" : "预览全部历史归属修复"}</button>}
        {preview && <>
            <p className="menu-desc">目标：{users.find(user => user.id === preview.ownerId)?.name}（{preview.ownerId}）<br />会话 {preview.counts.sessions} 个，消息 {preview.counts.messages} 条，好友 {preview.counts.contacts} 个，记忆 {preview.counts.memories} 条。</p>
            <p className="menu-desc">确认这批已有数据全部属于千羽青后执行。预览后如有新数据写入，会要求重新预览。</p>
            <button type="button" className="ui-btn" disabled={busy || !!preview.counts.missingSessions} onClick={() => void run(true)}>备份并确认全部归千羽青</button>
            {!!preview.counts.missingSessions && <p role="alert">发现 {preview.counts.missingSessions} 条缺少会话关联的消息。为确保全部历史不遗漏，暂不执行修复。</p>}
        </>}
        {message && <p role="status" className="menu-desc break-all">{message}</p>}
    </section>;
}
