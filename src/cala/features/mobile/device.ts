"use client";
import { useSyncExternalStore } from "react";
const mobileQuery = "(max-width: 760px)";
function subscribeMobile(notify: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", notify);
  window.addEventListener("resize", notify);
  window.addEventListener("orientationchange", notify);
  return () => {
    query.removeEventListener("change", notify);
    window.removeEventListener("resize", notify);
    window.removeEventListener("orientationchange", notify);
  };
}
function mobileSnapshot() {
  return (
    window.matchMedia(mobileQuery).matches ||
    ((navigator.maxTouchPoints > 0 ||
      window.matchMedia("(pointer: coarse)").matches) &&
      Math.min(window.innerWidth, window.innerHeight) <= 600 &&
      window.matchMedia("(max-width: 1100px)").matches)
  );
}
export function useMobileLayout() {
  return useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
}
function subscribeKeyboard(notify: () => void) {
  window.visualViewport?.addEventListener("resize", notify);
  window.addEventListener("focusin", notify);
  window.addEventListener("focusout", notify);
  return () => {
    window.visualViewport?.removeEventListener("resize", notify);
    window.removeEventListener("focusin", notify);
    window.removeEventListener("focusout", notify);
  };
}
export function useVirtualKeyboard() {
  return useSyncExternalStore(
    subscribeKeyboard,
    () =>
      Boolean(
        window.visualViewport &&
        window.innerHeight - window.visualViewport.height > 120 &&
        document.activeElement?.matches(
          "input,textarea,[contenteditable=true]",
        ),
      ),
    () => false,
  );
}
function subscribeConnectivity(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}
export function useOnline() {
  return useSyncExternalStore(
    subscribeConnectivity,
    () => navigator.onLine,
    () => true,
  );
}
