import { loadUserIdentities, resolveUserIdentity } from "./settings-storage";

export type UserIdentityWorldLink = { identityId: string; mode: "none" | "same_world"; relationToTarget?: string; relationToSource?: string };

export function getIdentityWorldLink(identityId: string): UserIdentityWorldLink | undefined {
    const identity = loadUserIdentities().find(item => item.id === identityId) as (ReturnType<typeof loadUserIdentities>[number] & { worldLink?: UserIdentityWorldLink }) | undefined;
    return identity?.worldLink;
}

export function getLinkedUserIdentities(identityId: string) {
    const identities = loadUserIdentities() as Array<ReturnType<typeof loadUserIdentities>[number] & { worldLink?: UserIdentityWorldLink }>;
    const current = identities.find(item => item.id === identityId);
    if (current?.worldId) return identities.filter(item => item.id !== identityId && item.worldId === current.worldId);
    if (!current || current.worldLink?.mode !== "same_world") return [];
    const targetId = current.worldLink.identityId;
    const target = identities.find(item => item.id === targetId);
    if (!target || target.worldLink?.mode !== "same_world" || target.worldLink.identityId !== identityId) return [];
    return [target];
}

export function getCurrentGlobalIdentityId(): string {
    return resolveUserIdentity()?.id || "identity-default";
}

export function getIdentityById(identityId: string) {
    return loadUserIdentities().find(item => item.id === identityId) || null;
}

export function areIdentitiesInSameWorld(firstId: string, secondId: string): boolean {
    if (!firstId || !secondId) return false;
    if (firstId === secondId) return true;
    const identities = loadUserIdentities();
    const firstIdentity = identities.find(item => item.id === firstId);
    const secondIdentity = identities.find(item => item.id === secondId);
    if (firstIdentity?.worldId || secondIdentity?.worldId) return Boolean(firstIdentity?.worldId && firstIdentity.worldId === secondIdentity?.worldId);
    const first = getIdentityWorldLink(firstId);
    const second = getIdentityWorldLink(secondId);
    return first?.mode === "same_world" && second?.mode === "same_world"
        && first.identityId === secondId && second.identityId === firstId;
}
