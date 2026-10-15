/**
 * Touch mode: phones and tablets (a finger is the main pointer) get on-screen controls
 * and play solo. Laptops with a touchscreen keep the keyboard setup.
 * `?touch` in the URL forces it on, for testing on a computer.
 */
export function isTouchDevice() {
  if (new URLSearchParams(window.location.search).has('touch')) return true;
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}
