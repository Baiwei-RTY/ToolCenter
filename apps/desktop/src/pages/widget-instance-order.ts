interface IdentifiedWidgetInstance {
  readonly instanceId: string;
}

export function reorderWidgetInstances<T extends IdentifiedWidgetInstance>(
  instances: readonly T[],
  sourceId: string,
  targetId: string,
  after = false,
): readonly T[] {
  if (sourceId === targetId) {
    return instances;
  }
  const sourceIndex = instances.findIndex((instance) => instance.instanceId === sourceId);
  const targetIndex = instances.findIndex((instance) => instance.instanceId === targetId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return instances;
  }

  const next = [...instances];
  const [moved] = next.splice(sourceIndex, 1);
  if (!moved) {
    return instances;
  }
  const adjustedTargetIndex = next.findIndex((instance) => instance.instanceId === targetId);
  next.splice(adjustedTargetIndex + (after ? 1 : 0), 0, moved);
  return next;
}

export function moveWidgetInstanceByOffset<T extends IdentifiedWidgetInstance>(
  instances: readonly T[],
  instanceId: string,
  offset: -1 | 1,
): readonly T[] {
  const index = instances.findIndex((instance) => instance.instanceId === instanceId);
  const targetIndex = Math.max(0, Math.min(instances.length - 1, index + offset));
  if (index < 0 || targetIndex === index) {
    return instances;
  }
  const target = instances[targetIndex];
  if (!target) {
    return instances;
  }
  return reorderWidgetInstances(instances, instanceId, target.instanceId, offset > 0);
}
