/**
 * Chrome the HOST window draws over the page — the one inset a fixed overlay
 * must respect.
 *
 * The DSH desktop shell runs a frameless window on Windows and enables
 * Electron's `titleBarOverlay` (see the app's `createWindow`): the native
 * minimize/maximize/close buttons are painted ABOVE the web content in the
 * top-right ~138×40px strip. Anything a plugin pins to `top: 0` there is
 * covered by those buttons — a panel header loses its own close button, and
 * a click on that corner minimizes or closes the application.
 *
 * The shell publishes the reserved height on `<html>` (preload-windows):
 *
 *   html[data-windows-titlebar]  — the overlay exists (Windows shell only)
 *   --dsh-windows-titlebar-height: 40px — its height
 *   html[data-fullscreen]        — the overlay is gone (true fullscreen)
 *
 * This module turns those three markers into a top offset, and nothing else:
 * it never assumes a platform, never reads a user agent, and returns 0 when
 * the page is a plain browser tab (no markers at all).
 */

/** Marks a page hosted by the desktop shell with a native caption overlay. */
export const ANDROID_SHELL_TITLEBAR_ATTRIBUTE = 'data-windows-titlebar'
/** Marks a page whose window is in true fullscreen (no caption overlay). */
export const ANDROID_SHELL_FULLSCREEN_ATTRIBUTE = 'data-fullscreen'
/** Custom property carrying the overlay height in CSS px. */
export const ANDROID_SHELL_TITLEBAR_VAR = '--dsh-windows-titlebar-height'

/**
 * Px of the top edge the host window covers with native controls.
 *
 * @param root - usually `document.documentElement`; undefined in SSR, where
 *   no chrome exists and the answer is 0.
 */
export function androidShellTopInset(
  root?: { hasAttribute: (name: string) => boolean, style?: { getPropertyValue: (name: string) => string } } | null,
): number {
  if (root === undefined || root === null) return 0
  if (!root.hasAttribute(ANDROID_SHELL_TITLEBAR_ATTRIBUTE)) return 0
  if (root.hasAttribute(ANDROID_SHELL_FULLSCREEN_ATTRIBUTE)) return 0
  const raw = root.style?.getPropertyValue(ANDROID_SHELL_TITLEBAR_VAR) ?? ''
  const px = Number.parseFloat(raw)
  // A malformed or non-positive value means the shell drew no overlay we can
  // measure: falling back to 0 keeps the panel flush with the window rather
  // than floating away from it on a guess.
  return Number.isFinite(px) && px > 0 ? px : 0
}

/** Read the inset from the live document; safe outside a browser. */
export function androidDocumentShellTopInset(): number {
  if (typeof document === 'undefined') return 0
  return androidShellTopInset(document.documentElement)
}

/**
 * Watch the shell's own markers so a fullscreen toggle or a platform-driven
 * caption change re-measures the inset.
 *
 * @param listener - called whenever the markers may have changed.
 * @returns idempotent unsubscribe.
 */
export function watchAndroidShellTopInset(listener: () => void): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}
  const root = document.documentElement
  const observer = new MutationObserver(() => { listener() })
  observer.observe(root, {
    attributes: true,
    attributeFilter: [ANDROID_SHELL_TITLEBAR_ATTRIBUTE, ANDROID_SHELL_FULLSCREEN_ATTRIBUTE],
  })
  return () => { observer.disconnect() }
}
