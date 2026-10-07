// lib/user-identity-context.ts
// Global context for tracking current user identity

let currentUserIdentityId: string | null = null;

/**
 * Get the current user identity ID.
 * Returns null if no identity is set or identities are not configured.
 */
export function getCurrentUserIdentityId(): string | null {
    return currentUserIdentityId;
}

/**
 * Set the current user identity ID.
 * Called when user switches identity in settings or when entering a chat session.
 */
export function setCurrentUserIdentityId(id: string | null): void {
    currentUserIdentityId = id;
}

/**
 * Initialize the current user identity from a chat session.
 * If the session has a userIdentityId, use it; otherwise keep the current context.
 */
export function initializeFromSession(sessionUserIdentityId?: string): void {
    if (sessionUserIdentityId) {
        currentUserIdentityId = sessionUserIdentityId;
    }
}
