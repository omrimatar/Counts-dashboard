import { useState, useMemo } from 'react';

const CX = 300, CY = 250;
const BOX_W = 130, BOX_H = 120;
const BOX_L = CX - BOX_W / 2, BOX_T = CY - BOX_H / 2;
const BOX_R = BOX_L + BOX_W, BOX_B = BOX_T + BOX_H;

const SLOT_DEFS = {
  top:    { x: CX,   y: BOX_T, roadTo: { x: CX,   y: 0   }, laneW: 48 },
  right:  { x: BOX_R, y: CY,   roadTo: { x: 600,  y: CY  }, laneW: 48 },
  bottom: { x: CX,   y: BOX_B, roadTo: { x: CX,   y: 500 }, laneW: 48 },
  left:   { x: BOX_L, y: CY,   roadTo: { x: 0,    y: CY  }, laneW: 48 },
};

const SLOT_ORDER = ['top', 'right', 'bottom', 'left'];

function assignSlots(arms) {
  const dirToSlot = { North: 'top', East: 'right', South: 'bottom', West: 'left' };
  const slots = {};
  const unassigned = [];

  arms.forEach(arm => {
    const slot = arm.direction ? dirToSlot[arm.direction] : null;
    if (slot && !slots[slot]) slots[slot] = arm;
    else unassigned.push(arm);
  });

  let si = 0;
  for (const arm of unassigned) {
    while (si < SLOT_ORDER.length && slots[SLOT_ORDER[si]]) si++;
    if (si < SLOT_ORDER.length) slots[SLOT_ORDER[si]] = arm;
    si++;
  }
  return slots; // { top: arm, right: arm, ... }
}

function arcPath(fromSlot, toSlot) {
  const from = SLOT_DEFS[fromSlot];
  const to   = SLOT_DEFS[toSlot];
  if (!from || !to) return '';
  // Cubic bezier through center with perpendicular control points
  const cp1x = from.x * 0.4 + CX * 0.6;
  const cp1y = from.y * 0.4 + CY * 0.6;
  const cp2x = to.x * 0.4 + CX * 0.6;
  const cp2y = to.y * 0.4 + CY * 0.6;
  return `M ${from.x} ${from.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${to.x} ${to.y}`;
}

function volColor(ratio) {
  // green → yellow → red
  if (ratio < 0.33) {
    const t = ratio / 0.33;
    const r = Math.round(t * 234);
    const g = Math.round(163 + t * (179 - 163));
    return `rgb(${r},${g},0)`;
  }
  if (ratio < 0.66) {
    const t = (ratio - 0.33) / 0.33;
    return `rgb(${Math.round(234 + t * 20)},${Math.round(179 - t * 100)},0)`;
  }
  return `rgb(220,38,38)`;
}

function RoadSegment({ slot }) {
  const def = SLOT_DEFS[slot];
  const road = def.roadTo;
  const hw = def.laneW / 2;
  let pts;
  if (slot === 'top' || slot === 'bottom') {
    pts = `${def.x - hw},${def.y} ${def.x + hw},${def.y} ${road.x + hw},${road.y} ${road.x - hw},${road.y}`;
  } else {
    pts = `${def.x},${def.y - hw} ${def.x},${def.y + hw} ${road.x},${road.y + hw} ${road.x},${road.y - hw}`;
  }
  return <polygon points={pts} fill="#cbd5e1" opacity={0.6} />;
}

function ArmLabel({ slot, arm, volume }) {
  const road = SLOT_DEFS[slot].roadTo;
  const offs = { top: [0, 16], right: [-8, 0], bottom: [0, -8], left: [8, 0] };
  const [dx, dy] = offs[slot] || [0, 0];
  const anchor = slot === 'right' ? 'end' : slot === 'left' ? 'start' : 'middle';
  const labelY = slot === 'top' ? road.y + 14 : slot === 'bottom' ? road.y - 6 : road.y + dy;
  const labelX = road.x + dx;
  return (
    <g>
      <text x={labelX} y={labelY} textAnchor={anchor} fontSize={12} fontWeight={600} fill="#1e293b">{arm.name}</text>
      {arm.direction && (
        <text x={labelX} y={labelY + 14} textAnchor={anchor} fontSize={10} fill="#6b7280">{arm.direction}</text>
      )}
      {volume > 0 && (
        <text x={labelX} y={labelY + 28} textAnchor={anchor} fontSize={11} fill="#2563eb" fontWeight={600}>
          {volume.toLocaleString()}
        </text>
      )}
    </g>
  );
}

export default function JunctionMap({ data, analytics }) {
  const [tooltip, setTooltip] = useState(null);

  const { arms, movements } = data;
  const isPcuOnly = data.vehicleTypes?.length === 1 && data.vehicleTypes[0].pcuOnly;

  const slots = useMemo(() => assignSlots(arms), [arms]);
  const armToSlot = useMemo(() => {
    const m = {};
    Object.entries(slots).forEach(([slot, arm]) => { if (arm) m[arm.id] = slot; });
    return m;
  }, [slots]);

  // Compute per-movement totals from analytics
  const movTotals = useMemo(() => {
    if (!analytics) return [];
    const result = [];
    const { vehicleTypes } = data;

    for (const mov of movements) {
      const fromSlot = armToSlot[mov.fromArm];
      const toSlot   = armToSlot[mov.toArm];
      if (!fromSlot) continue;

      let total = 0, heavy = 0;
      mov.timeSeries.forEach(ts => {
        vehicleTypes.forEach(vt => {
          const c = ts.vehicles[vt.id] || 0;
          total += c;
          if (vt.heavy) heavy += c;
        });
      });

      const fromArm = arms.find(a => a.id === mov.fromArm);
      const toArm   = arms.find(a => a.id === mov.toArm);

      result.push({
        fromSlot,
        toSlot,
        turn: mov.turnTypeEn || mov.turnType,
        total,
        heavy,
        heavyPct: total > 0 ? ((heavy / total) * 100).toFixed(1) : '0',
        fromName: fromArm?.name || `Arm ${mov.fromArm}`,
        toName:   toArm?.name   || (mov.toArm !== null ? `Arm ${mov.toArm}` : null),
      });
    }
    return result;
  }, [movements, armToSlot, arms, analytics, data]);

  const maxVol = useMemo(() => Math.max(...movTotals.map(m => m.total), 1), [movTotals]);

  // Arm totals for labels
  const armTotals = useMemo(() => {
    const t = {};
    movTotals.forEach(m => { t[m.fromSlot] = (t[m.fromSlot] || 0) + m.total; });
    return t;
  }, [movTotals]);

  if (!arms.length) return null;

  const hasConnections = movTotals.some(m => m.toSlot);

  return (
    <div className="card">
      <h3 className="section-title">Junction Map</h3>
      <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
        <svg
          viewBox="0 0 600 500"
          style={{ width: '100%', maxWidth: 600, display: 'block', margin: '0 auto' }}
        >
          {/* Road segments */}
          {Object.keys(slots).map(slot => slots[slot] && <RoadSegment key={slot} slot={slot} />)}

          {/* Intersection box */}
          <rect
            x={BOX_L} y={BOX_T}
            width={BOX_W} height={BOX_H}
            fill="#94a3b8" rx={6}
          />
          <text x={CX} y={CY + 5} textAnchor="middle" fontSize={11} fill="#f1f5f9" fontWeight={600}>
            Junction
          </text>

          {/* Movement arcs */}
          {hasConnections && movTotals.map((m, i) => {
            if (!m.toSlot) return null;
            const ratio = m.total / maxVol;
            const sw = 2 + ratio * 10;
            const color = volColor(ratio);
            const d = arcPath(m.fromSlot, m.toSlot);
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={sw}
                strokeOpacity={0.75}
                strokeLinecap="round"
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, mov: m })}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}

          {/* For לוח 5 (no toArm): show turn bars per arm */}
          {!hasConnections && movTotals.map((m, i) => {
            const slot = m.fromSlot;
            const def = SLOT_DEFS[slot];
            if (!def) return null;
            const ratio = m.total / maxVol;
            const barLen = ratio * 40;
            const color = volColor(ratio);
            // small bar near arm label area
            const vert = slot === 'top' || slot === 'bottom';
            return (
              <g key={i}>
                {vert
                  ? <rect x={def.roadTo.x - 8 + i * 18} y={def.roadTo.y + (slot === 'top' ? 40 : -50 - barLen)} width={14} height={barLen} fill={color} rx={2} />
                  : <rect x={def.roadTo.x + (slot === 'left' ? 40 : -50 - barLen)} y={def.roadTo.y - 8 + i * 18} width={barLen} height={14} fill={color} rx={2} />
                }
              </g>
            );
          })}

          {/* Arm labels */}
          {Object.entries(slots).map(([slot, arm]) =>
            arm ? (
              <ArmLabel key={slot} slot={slot} arm={arm} volume={armTotals[slot] || 0} />
            ) : null
          )}

          {/* PCU-only indicator */}
          {isPcuOnly && (
            <text x={CX} y={CY + 22} textAnchor="middle" fontSize={9} fill="#f1f5f9" opacity={0.8}>
              PCU totals
            </text>
          )}
        </svg>

        {/* Hover tooltip */}
        {tooltip && (
          <div
            className="jmap-tooltip"
            style={{ position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 40, pointerEvents: 'none' }}
          >
            <strong>{tooltip.mov.fromName} → {tooltip.mov.toName}</strong>
            <div>Turn: {tooltip.mov.turn}</div>
            <div>Volume: {tooltip.mov.total.toLocaleString()}</div>
            {tooltip.mov.heavy > 0 && <div>Heavy: {tooltip.mov.heavyPct}%</div>}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="jmap-legend">
        <span>Low volume</span>
        <div className="jmap-legend-bar">
          <div className="jmap-legend-gradient" />
        </div>
        <span>High volume</span>
      </div>
    </div>
  );
}
