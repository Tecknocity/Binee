'use client';

// ---------------------------------------------------------------------------
// B-045: Action trust preferences (client-side, localStorage-backed)
//
// Stores per-operation-type preferences for "Always Allow" / "Always Ask".
// Only low and medium risk operations are eligible for "Always Allow".
// High risk operations always require confirmation.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'binee_action_preferences';

export type ActionPreference = 'always_allow' | 'always_ask';

type PreferenceMap = Record<string, ActionPreference>;

/**
 * Reads all action preferences from localStorage.
 */
export function getActionPreferences(): PreferenceMap {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PreferenceMap;
  } catch {
    return {};
  }
}

/**
 * Returns the preference for a specific operation type.
 * Defaults to 'always_ask' if not set.
 */
export function getActionPreference(operationType: string): ActionPreference {
  const prefs = getActionPreferences();
  return prefs[operationType] ?? 'always_ask';
}

/**
 * Sets the preference for a specific operation type.
 */
export function setActionPreference(
  operationType: string,
  preference: ActionPreference,
): void {
  if (typeof window === 'undefined') return;

  const prefs = getActionPreferences();
  prefs[operationType] = preference;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage may be full or unavailable — silently ignore
  }
}

/**
 * Resets preferences for a specific operation type or all preferences.
 * Callable from the settings page.
 */
export function resetActionPreferences(operationType?: string): void {
  if (typeof window === 'undefined') return;

  if (operationType) {
    const prefs = getActionPreferences();
    delete prefs[operationType];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // silently ignore
    }
  } else {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // silently ignore
    }
  }
}

/**
 * Returns true if the user has set "always_allow" for this operation type
 * AND the operation is eligible (low or medium risk, not high risk).
 *
 * @param operationType - The tool name (e.g., 'create_task')
 * @param trustTier - The trust tier from the server response
 */
export function shouldAutoApprove(
  operationType: string,
  trustTier: 'low' | 'medium' | 'high',
): boolean {
  // High risk operations can never be auto-approved
  if (trustTier === 'high') return false;

  return getActionPreference(operationType) === 'always_allow';
}
