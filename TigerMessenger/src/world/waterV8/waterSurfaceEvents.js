// Bounded, renderer-agnostic surface event stream.  Gameplay writes events
// here; a renderer may upload the active prefix to a ripple/wake atlas without
// rebuilding the water mesh or creating one Object3D per splash.

const DEFAULT_CAPACITY = 64;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function copyVector(value, size, fallback = 0) {
  const result = new Array(size).fill(fallback);
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) return result;
  for (let index = 0; index < size; index++) result[index] = finite(value[index], fallback);
  return result;
}

export function createWaterSurfaceEventBuffer({ capacity = DEFAULT_CAPACITY } = {}) {
  const maxEvents = Math.max(1, Math.floor(capacity));
  const events = new Array(maxEvents);
  let nextId = 1;
  let count = 0;
  let clock = 0;

  function add({
    type = "ripple",
    surfaceId = "water:ocean",
    position = [0, 0, 0],
    direction = [0, 1, 0],
    radius = 0.5,
    strength = 1,
    life = 1,
    width = 0.3,
  } = {}) {
    const event = {
      id: nextId++,
      type,
      surfaceId,
      position: copyVector(position, 3),
      direction: copyVector(direction, 3),
      radius: Math.max(0, finite(radius, 0.5)),
      strength: Math.max(0, finite(strength, 1)),
      width: Math.max(0, finite(width, 0.3)),
      age: 0,
      life: Math.max(0.001, finite(life, 1)),
      createdAt: clock,
    };
    if (count < maxEvents) {
      events[count++] = event;
    } else {
      let oldest = 0;
      for (let index = 1; index < count; index++) {
        if (events[index].createdAt < events[oldest].createdAt) oldest = index;
      }
      events[oldest] = event;
    }
    return { ...event, position: event.position.slice(), direction: event.direction.slice() };
  }

  function update(deltaSeconds = 0) {
    const delta = Math.max(0, finite(deltaSeconds));
    clock += delta;
    let write = 0;
    for (let read = 0; read < count; read++) {
      const event = events[read];
      event.age += delta;
      if (event.age < event.life) events[write++] = event;
    }
    for (let index = write; index < count; index++) events[index] = undefined;
    count = write;
    return count;
  }

  function active() {
    return events.slice(0, count).map((event) => ({
      ...event,
      position: event.position.slice(),
      direction: event.direction.slice(),
      normalizedAge: Math.min(1, event.age / event.life),
    }));
  }

  return {
    capacity: maxEvents,
    add,
    update,
    active,
    snapshot() { return { capacity: maxEvents, clock, events: active() }; },
    clear() {
      for (let index = 0; index < count; index++) events[index] = undefined;
      count = 0;
    },
    get size() { return count; },
  };
}

export function createWaterWakeRibbonBuffer({ capacity = 48 } = {}) {
  const maxSegments = Math.max(2, Math.floor(capacity));
  const segments = new Array(maxSegments);
  let count = 0;
  let nextId = 1;

  function push({ position = [0, 0, 0], tangent = [0, 0, 1], width = 0.4, age = 0, life = 2 } = {}) {
    const segment = {
      id: nextId++,
      position: copyVector(position, 3),
      tangent: copyVector(tangent, 3),
      width: Math.max(0, finite(width, 0.4)),
      age: Math.max(0, finite(age)),
      life: Math.max(0.001, finite(life, 2)),
    };
    if (count < maxSegments) segments[count++] = segment;
    else {
      for (let index = 1; index < count; index++) segments[index - 1] = segments[index];
      segments[count - 1] = segment;
    }
    return { ...segment, position: segment.position.slice(), tangent: segment.tangent.slice() };
  }

  function update(deltaSeconds = 0) {
    const delta = Math.max(0, finite(deltaSeconds));
    let write = 0;
    for (let read = 0; read < count; read++) {
      const segment = segments[read];
      segment.age += delta;
      if (segment.age < segment.life) segments[write++] = segment;
    }
    for (let index = write; index < count; index++) segments[index] = undefined;
    count = write;
    return count;
  }

  return {
    capacity: maxSegments,
    push,
    update,
    active() { return segments.slice(0, count).map((segment) => ({ ...segment, position: segment.position.slice(), tangent: segment.tangent.slice(), normalizedAge: Math.min(1, segment.age / segment.life) })); },
    clear() { for (let index = 0; index < count; index++) segments[index] = undefined; count = 0; },
    get size() { return count; },
  };
}
