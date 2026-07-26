import type { WidgetSize } from "@tool-center/plugin-contract";

export type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export interface WidgetDimensions {
  readonly width: number;
  readonly height: number;
}

export interface WidgetRect extends WidgetDimensions {
  readonly left: number;
  readonly top: number;
}

export interface ResizeBounds {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly minimumWidth: number;
  readonly minimumHeight: number;
  readonly maximumWidth?: number;
  readonly maximumHeight?: number;
}

const presetDimensions: Record<WidgetSize, WidgetDimensions> = {
  small: { width: 260, height: 160 },
  medium: { width: 360, height: 220 },
  wide: { width: 520, height: 220 },
};

export function resizeWidgetRect(
  start: WidgetRect,
  direction: ResizeDirection,
  deltaX: number,
  deltaY: number,
  bounds: ResizeBounds,
): WidgetRect {
  const horizontal = resizeAxis({
    start: start.left,
    length: start.width,
    delta: deltaX,
    viewportLength: bounds.viewportWidth,
    minimumLength: bounds.minimumWidth,
    maximumLength: bounds.maximumWidth ?? bounds.viewportWidth,
    fromStart: direction.includes("w"),
    fromEnd: direction.includes("e"),
  });
  const vertical = resizeAxis({
    start: start.top,
    length: start.height,
    delta: deltaY,
    viewportLength: bounds.viewportHeight,
    minimumLength: bounds.minimumHeight,
    maximumLength: bounds.maximumHeight ?? bounds.viewportHeight,
    fromStart: direction.includes("n"),
    fromEnd: direction.includes("s"),
  });

  return {
    left: horizontal.start,
    top: vertical.start,
    width: horizontal.length,
    height: vertical.length,
  };
}

export function normalizedPositionForRect(
  rect: WidgetRect,
  viewportWidth: number,
  viewportHeight: number,
) {
  const availableWidth = viewportWidth - rect.width;
  const availableHeight = viewportHeight - rect.height;
  return {
    x: availableWidth > 0 ? clamp(rect.left / availableWidth, 0, 1) : 0,
    y: availableHeight > 0 ? clamp(rect.top / availableHeight, 0, 1) : 0,
  };
}

export function widgetSizeForDimensions(
  dimensions: WidgetDimensions,
  supportedSizes: readonly WidgetSize[],
  minimum: WidgetDimensions,
  fallback: WidgetSize,
): WidgetSize {
  const candidates = supportedSizes.length > 0 ? supportedSizes : [fallback];
  return candidates.reduce((closest, candidate) => {
    const closestDistance = presetDistance(dimensions, closest, minimum);
    const candidateDistance = presetDistance(dimensions, candidate, minimum);
    return candidateDistance < closestDistance ? candidate : closest;
  }, candidates[0] ?? fallback);
}

function resizeAxis({
  start,
  length,
  delta,
  viewportLength,
  minimumLength,
  maximumLength,
  fromStart,
  fromEnd,
}: {
  readonly start: number;
  readonly length: number;
  readonly delta: number;
  readonly viewportLength: number;
  readonly minimumLength: number;
  readonly maximumLength: number;
  readonly fromStart: boolean;
  readonly fromEnd: boolean;
}) {
  if (!fromStart && !fromEnd) {
    return { start: Math.round(start), length: Math.round(length) };
  }

  const fixedEdge = fromStart ? start + length : start;
  const availableLength = fromStart ? fixedEdge : viewportLength - fixedEdge;
  const effectiveMaximum = Math.max(1, Math.min(maximumLength, availableLength));
  const effectiveMinimum = Math.min(Math.max(1, minimumLength), effectiveMaximum);
  const requestedLength = fromStart ? length - delta : length + delta;
  const nextLength = Math.round(
    clamp(requestedLength, effectiveMinimum, effectiveMaximum),
  );

  return {
    start: Math.round(fromStart ? fixedEdge - nextLength : fixedEdge),
    length: nextLength,
  };
}

function presetDistance(
  dimensions: WidgetDimensions,
  size: WidgetSize,
  minimum: WidgetDimensions,
): number {
  const preset = presetDimensions[size];
  const width = Math.max(minimum.width, preset.width);
  const height = Math.max(minimum.height, preset.height);
  return (
    ((dimensions.width - width) / width) ** 2 +
    ((dimensions.height - height) / height) ** 2
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
