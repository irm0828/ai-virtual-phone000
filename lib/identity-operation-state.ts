// 轻量锁，避免修复期间普通聊天/记忆写入与身份切换污染备份和回滚。
let repairInProgress = false;
export function setIdentityRepairInProgress(value: boolean): void { repairInProgress = value; }
export function assertIdentityWritable(): void {
    if (repairInProgress) throw new Error("身份数据修复中，请等待完成后再操作");
}
