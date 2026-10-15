/**
 * Adding the game to the phone's home screen (PWA). Android/Chrome offers its own install
 * dialog, which we can open from a button; iPhone has no such dialog, so we explain the
 * Share → "Agregar a inicio" steps instead.
 */

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let installPrompt: InstallPromptEvent | null = null;

/** Call once at startup: Chrome fires the event early and only once per page load. */
export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
  });
}

/** Opened from the home screen icon (no browser bars). */
export function isInstalledApp() {
  return (
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone or iPad (iPadOS reports itself as a Mac with touch). */
export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** How this browser can install the game right now, if it can. */
export function installMethod(): 'prompt' | 'ios-steps' | null {
  if (isInstalledApp()) return null;
  if (installPrompt) return 'prompt';
  if (isIos()) return 'ios-steps';
  return null;
}

/** Opens Android's install dialog. Resolves true if the player accepted. */
export async function promptInstall() {
  const prompt = installPrompt;
  if (!prompt) return false;
  installPrompt = null;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  return outcome === 'accepted';
}
