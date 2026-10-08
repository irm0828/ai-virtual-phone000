import { getIdentityGeneration } from "./settings-storage";
import { getCurrentGlobalIdentityId } from "./user-world";
import { assertIdentityWritable } from "./identity-operation-state";

/** 异步任务启动时固定身份；切走再切回也不能复用旧任务。 */
export function captureIdentityTask() {
    assertIdentityWritable();
    const identityId = getCurrentGlobalIdentityId();
    const generation = getIdentityGeneration();
    return {
        identityId,
        assertCurrent() {
            assertIdentityWritable();
            if (generation !== getIdentityGeneration() || identityId !== getCurrentGlobalIdentityId()) {
                throw new Error("身份已切换，旧任务已取消，请在当前身份重新操作");
            }
        },
    };
}
