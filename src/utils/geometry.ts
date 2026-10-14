import {
  AnchorPort,
  BoardObject,
  ConnectorObject,
  Point,
} from '../types/board';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function screenToWorld(
  clientX: number,
  clientY: number,
  viewport: { x: number; y: number; zoom: number },
  rect: DOMRect
): Point {
  return {
    x: (clientX - rect.left - viewport.x) / viewport.zoom,
    y: (clientY - rect.top - viewport.y) / viewport.zoom,
  };
}

export function getObjectBounds(obj: BoardObject): BoundingBox {
  switch (obj.type) {
    case 'sticky':
    case 'shape':
    case 'section':
    case 'text':
    case 'attachment':
      return {
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
      };
    case 'stamp':
      return {
        x: obj.x - 28 * obj.scale,
        y: obj.y - 28 * obj.scale,
        width: 56 * obj.scale,
        height: 56 * obj.scale,
      };
    case 'path': {
      if (obj.points.length === 0) {
        return { x: 0, y: 0, width: 10, height: 10 };
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of obj.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const pad = obj.strokeWidth || 4;
      return {
        x: minX - pad,
        y: minY - pad,
        width: Math.max(12, maxX - minX + pad * 2),
        height: Math.max(12, maxY - minY + pad * 2),
      };
    }
    case 'connector': {
      const minX = Math.min(obj.fromPoint.x, obj.toPoint.x);
      const minY = Math.min(obj.fromPoint.y, obj.toPoint.y);
      const maxX = Math.max(obj.fromPoint.x, obj.toPoint.x);
      const maxY = Math.max(obj.fromPoint.y, obj.toPoint.y);
      return {
        x: minX - 10,
        y: minY - 10,
        width: Math.max(20, maxX - minX + 20),
        height: Math.max(20, maxY - minY + 20),
      };
    }
  }
}

export function getAnchorPoint(obj: BoardObject, port: AnchorPort): Point {
  const b = getObjectBounds(obj);
  switch (port) {
    case 'top':
      return { x: b.x + b.width / 2, y: b.y };
    case 'right':
      return { x: b.x + b.width, y: b.y + b.height / 2 };
    case 'bottom':
      return { x: b.x + b.width / 2, y: b.y + b.height };
    case 'left':
      return { x: b.x, y: b.y + b.height / 2 };
  }
}

export function resolveConnectorEndpoints(
  conn: ConnectorObject,
  objectsMap: Map<string, BoardObject>
): { from: Point; to: Point } {
  let from = conn.fromPoint;
  let to = conn.toPoint;

  if (conn.fromId) {
    const sourceObj = objectsMap.get(conn.fromId);
    if (sourceObj) {
      from = getAnchorPoint(sourceObj, conn.fromPort);
    }
  }
  if (conn.toId) {
    const targetObj = objectsMap.get(conn.toId);
    if (targetObj) {
      to = getAnchorPoint(targetObj, conn.toPort);
    }
  }

  return { from, to };
}

export function findNearestAnchor(
  worldPoint: Point,
  objects: BoardObject[],
  excludeId?: string,
  maxDistance = 36
): { objectId: string; port: AnchorPort; point: Point } | null {
  let best: { objectId: string; port: AnchorPort; point: Point; dist: number } | null = null;
  const ports: AnchorPort[] = ['top', 'right', 'bottom', 'left'];

  for (const obj of objects) {
    if (obj.id === excludeId) continue;
    if (obj.type !== 'sticky' && obj.type !== 'shape' && obj.type !== 'text' && obj.type !== 'attachment') {
      continue;
    }
    for (const port of ports) {
      const pt = getAnchorPoint(obj, port);
      const dist = Math.hypot(pt.x - worldPoint.x, pt.y - worldPoint.y);
      if (dist <= maxDistance && (!best || dist < best.dist)) {
        best = { objectId: obj.id, port, point: pt, dist };
      }
    }
  }

  return best
    ? { objectId: best.objectId, port: best.port, point: best.point }
    : null;
}

function getPortNormal(port: AnchorPort): Point {
  switch (port) {
    case 'top':
      return { x: 0, y: -1 };
    case 'right':
      return { x: 1, y: 0 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
  }
}

export function buildConnectorGeometry(
  from: Point,
  fromPort: AnchorPort,
  to: Point,
  toPort: AnchorPort,
  curveStyle: 'curved' | 'straight' | 'elbow' = 'curved'
): {
  pathD: string;
  midPoint: Point;
  endAngleDeg: number;
} {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);

  if (curveStyle === 'straight' || dist < 24) {
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return {
      pathD: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      midPoint: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
      endAngleDeg: angle,
    };
  }

  if (curveStyle === 'elbow') {
    const midX = (from.x + to.x) / 2;
    const pathD = `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
    const angle = to.x >= midX ? 0 : 180;
    return {
      pathD,
      midPoint: { x: midX, y: (from.y + to.y) / 2 },
      endAngleDeg: angle,
    };
  }

  const offset = Math.min(160, Math.max(48, dist * 0.42));
  const n1 = getPortNormal(fromPort);
  const n2 = getPortNormal(toPort);

  const c1 = {
    x: from.x + n1.x * offset,
    y: from.y + n1.y * offset,
  };
  const c2 = {
    x: to.x + n2.x * offset,
    y: to.y + n2.y * offset,
  };

  // Cubic bezier midpoint at t = 0.5
  const midPoint = {
    x: 0.125 * from.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * to.x,
    y: 0.125 * from.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * to.y,
  };

  // Tangent near t = 1 (from c2 to to)
  let tx = to.x - c2.x;
  let ty = to.y - c2.y;
  if (Math.hypot(tx, ty) < 1) {
    tx = dx;
    ty = dy;
  }
  const endAngleDeg = (Math.atan2(ty, tx) * 180) / Math.PI;

  return {
    pathD: `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`,
    midPoint,
    endAngleDeg,
  };
}

export function buildSmoothSvgPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.5} ${p.y + 0.5}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}
