/** Route Q consistently even when a building panel or inspection view is open. */
export function handleAirshipSummonShortcut(event, {
  activeElement = null, panels = [], restoreView = () => {}, summon,
}) {
  const typing = el => /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? "")
    || el?.isContentEditable || !!el?.closest?.('[contenteditable="true"]');
  if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey
    || event.shiftKey || typing(event.target) || typing(activeElement)) return false;
  if (event.code !== "KeyQ" && String(event.key).toLowerCase() !== "q") return false;
  event.preventDefault();
  for (const panel of panels) if (panel?.isOpen?.()) panel.close();
  restoreView();
  summon();
  return true;
}
