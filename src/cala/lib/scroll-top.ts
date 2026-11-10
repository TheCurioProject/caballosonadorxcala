/** Brings every page-level scroll container back to the top. Used when the
 *  section changes and when a panel/dialog opens, on every device. */
export function scrollWorkspaceToTop() {
  if (typeof window === "undefined") return;
  const reset = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    document.scrollingElement?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    document
      .querySelectorAll<HTMLElement>(".main-content, .workspace, .m-app-main")
      .forEach((el) => {
        el.scrollTop = 0;
      });
  };
  reset();
  // Again after layout settles (lazy screens, fonts, images).
  requestAnimationFrame(() => requestAnimationFrame(reset));
}
