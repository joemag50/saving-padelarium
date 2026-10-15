/** Debug tools are enabled with `?debug` in the URL. */
export const DEBUG_MODE = new URLSearchParams(window.location.search).has('debug');

/** Toggle collision-box overlays for tuning combat feel. */
export const DEBUG_HITBOXES = DEBUG_MODE;

/** Key that defeats every enemy on screen, for testing level flow quickly. */
export const DEBUG_DEFEAT_ALL_KEY = 'N';

/** Key that toggles invincibility for every player (stays on across levels and retries). */
export const DEBUG_INVINCIBLE_KEY = 'I';

/** Mutable debug switches, shared by the whole session. */
export const debugState = {
  invincible: false,
};
