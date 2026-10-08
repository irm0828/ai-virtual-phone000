"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { loadUserIdentities, setGlobalUserIdentity } from "@/lib/settings-storage";
import type { UserIdentity } from "@/components/settings/user-identity";
import { ChatFallbackAvatar } from "./chat-fallback-avatar";

export function IdentitySwitcher({ identity }: { identity: UserIdentity | null }) {
    const [open, setOpen] = useState(false);
    const [users, setUsers] = useState<UserIdentity[]>([]);
    const [error, setError] = useState("");
    const avatar = (user: UserIdentity | null, large = false) => (
        <span className={`${large ? "h-10 w-10" : "h-9 w-9"} rounded-full overflow-hidden bg-[var(--c-input)] flex items-center justify-center shrink-0`}>
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : <ChatFallbackAvatar />}
        </span>
    );
    return <>
        <button type="button" className="flex items-center gap-[10px] text-left" aria-label="切换全局用户身份" aria-haspopup="dialog" onClick={() => { setUsers(loadUserIdentities()); setError(""); setOpen(true); }}>
            {avatar(identity)}
            <span className="flex flex-col whitespace-nowrap">
                <span className="ts-16 font-bold text-[var(--c-text-title)] leading-tight flex items-center gap-1">{identity?.name || "用户"}<ChevronDown size={13} /></span>
                <span className="flex items-center gap-1 mt-1"><span className="w-2 h-2 rounded-full bg-[#2dd36f]" /><span className="ts-10 text-[var(--c-icon)]">在线</span></span>
            </span>
        </button>
        {open && <div className="modal-overlay modal-overlay-bottom" onClick={() => setOpen(false)}>
            <div className="modal-sheet" role="dialog" aria-modal="true" aria-label="切换用户" onClick={event => event.stopPropagation()}>
                <div className="modal-header"><span className="modal-header-title">切换用户</span><button type="button" className="modal-header-btn" aria-label="关闭" onClick={() => setOpen(false)}><X size={18} /></button></div>
                <div className="modal-body flex flex-col gap-2">
                    <p className="menu-desc">与全局配置同步。切换后加载该用户自己的好友、聊天和个人记录，不合并其他用户的聊天。</p>
                    {users.map(user => <button key={user.id} type="button" className="menu-item rounded-xl" onClick={() => {
                        try { setGlobalUserIdentity(user.id); setOpen(false); } catch (reason) { setError(reason instanceof Error ? reason.message : "切换失败"); }
                    }}>
                        {avatar(user, true)}<span className="menu-label-group"><span className="menu-label">{user.name || "未命名用户"}</span>{user.id === identity?.id && <span className="menu-desc">当前用户</span>}</span>{user.id === identity?.id && <Check size={18} />}
                    </button>)}
                    {!users.length && <p className="menu-desc">请先在设置中创建用户身份。</p>}
                    {error && <p role="alert" className="text-red-500 text-sm">{error}</p>}
                </div>
            </div>
        </div>}
    </>;
}
