export function shouldBeginWidgetDrag(
  locked: boolean,
  button: number,
  target: EventTarget | null,
): boolean {
  if (locked || button !== 0) {
    return false;
  }
  return !(
    target instanceof Element &&
    target.closest("[data-widget-host-action]") !== null
  );
}
