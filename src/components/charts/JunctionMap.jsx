import { useState, useMemo } from 'react';

// ── Canvas & layout ─────────────────────────────────────────────────────────
const W  = 1000, H  = 880;  // SVG viewBox size
const CX = 500,  CY = 440;  // Intersection center
const RW = 80;               // Road width (px) — unchanged
const LO = 20;               // Lane offset from road centre — unchanged
const HB = 165;              // Half-size of intersection box (box = 330×330)
const MG = 85;               // Outer margin reserved for arm labels

// Intersection box corners
const BL = CX - HB, BR = CX + HB;  // 335, 665
const BT = CY - HB, BB = CY + HB;  // 275, 605

// Road rectangles (extend from margin to box edge)
const ROADS = {
  top:    { x: CX - RW/2, y: MG,     w: RW,       h: BT - MG    },
  right:  { x: BR,        y: CY-RW/2, w: W-MG-BR,  h: RW         },
  bottom: { x: CX - RW/2, y: BB,      w: RW,       h: H-MG-BB    },
  left:   { x: MG,        y: CY-RW/2, w: BL-MG,    h: RW         },
};

// Point where incoming traffic meets the intersection box
const ENTRY = {
  top:    { x: CX + LO, y: BT },
  right:  { x: BR,      y: CY + LO },
  bottom: { x: CX - LO, y: BB },
  left:   { x: BL,      y: CY - LO },
};

// Point where outgoing traffic leaves the intersection box
const EXIT = {
  top:    { x: CX - LO, y: BT },
  right:  { x: BR,      y: CY - LO },
  bottom: { x: CX + LO, y: BB },
  left:   { x: BL,      y: CY + LO },
};

// Label-box centres (in outer margin areas, clamped to avoid overflow)
const LABEL_POS = {
  top:    { x: CX,       y: 43      },
  right:  { x: W - 72,   y: CY      },
  bottom: { x: CX,       y: H - 43  },
  left:   { x: 72,       y: CY      },
};

// Brand colours per slot
const COLORS = {
  top:    '#3b82f6',   // blue
  right:  '#10b981',   // emerald
  bottom: '#f59e0b',   // amber
  left:   '#8b5cf6',   // violet
};

const SLOT_ORDER = ['top', 'right', 'bottom', 'left'];

// ── Geometry helpers ─────────────────────────────────────────────────────────
function makeArc(from, to) {
  if (from === to) {
    // U-turn: small loop outside the intersection box
    const en = ENTRY[from], ex = EXIT[from];
    const loop = { top: [0,-92], right: [92,0], bottom: [0,92], left: [-92,0] }[from];
    return `M${en.x} ${en.y} C${en.x+loop[0]} ${en.y+loop[1]} ${ex.x+loop[0]} ${ex.y+loop[1]} ${ex.x} ${ex.y}`;
  }
  const s = ENTRY[from], e = EXIT[to], T = 0.5;
  const cp1 = { x: s.x + (CX - s.x) * T, y: s.y + (CY - s.y) * T };
  const cp2 = { x: e.x + (CX - e.x) * T, y: e.y + (CY - e.y) * T };
  return `M${s.x} ${s.y} C${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${e.x} ${e.y}`;
}

function arcMidpoint(from, to) {
  if (from === to) {
    const en = ENTRY[from], ex = EXIT[from];
    const loop = { top: [0,-92], right: [92,0], bottom: [0,92], left: [-92,0] }[from];
    return { x: (en.x + ex.x) / 2 + loop[0], y: (en.y + ex.y) / 2 + loop[1] };
  }
  const s = ENTRY[from], e = EXIT[to], T = 0.5;
  const cp1 = { x: s.x + (CX - s.x) * T, y: s.y + (CY - s.y) * T };
  const cp2 = { x: e.x + (CX - e.x) * T, y: e.y + (CY - e.y) * T };
  const u = 0.5, v = 0.5;
  return {
    x: v**3*s.x + 3*v**2*u*cp1.x + 3*v*u**2*cp2.x + u**3*e.x,
    y: v**3*s.y + 3*v**2*u*cp1.y + 3*v*u**2*cp2.y + u**3*e.y,
  };
}

function fmtVol(n) {
  if (n >= 10000) return `${(n/1000).toFixed(0)}k`;
  if (n >= 1000)  return `${(n/1000).toFixed(1)}k`;
  return String(n);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function JunctionMap({ data, analytics }) {
  const [hovered, setHovered] = useState(null);   // movement id string
  const [tip, setTip] = useState({ x: 0, y: 0 });

  const { arms, movements, vehicleTypes } = data;
  const pcuOnly = vehicleTypes?.length === 1 && vehicleTypes[0].pcuOnly;

  // ── Assign arms to compass slots ──────────────────────────────────────────
  const slotMap = useMemo(() => {
    const dir2slot = { North: 'top', East: 'right', South: 'bottom', West: 'left' };
    const slots = {};
    const leftover = [];
    arms.forEach(a => {
      const s = a.direction ? dir2slot[a.direction] : null;
      if (s && !slots[s]) slots[s] = a;
      else leftover.push(a);
    });
    let i = 0;
    for (const a of leftover) {
      while (i < SLOT_ORDER.length && slots[SLOT_ORDER[i]]) i++;
      if (i < SLOT_ORDER.length) { slots[SLOT_ORDER[i]] = a; i++; }
    }
    return slots;
  }, [arms]);

  const arm2slot = useMemo(() => {
    const m = {};
    Object.entries(slotMap).forEach(([s, a]) => { if (a) m[a.id] = s; });
    return m;
  }, [slotMap]);

  // ── Compute movement data ────────────────────────────────────────────────
  const movData = useMemo(() => {
    const arr = [];
    for (const mov of movements) {
      const fs = arm2slot[mov.fromArm];
      if (!fs) continue;
      const ts = mov.toArm !== null ? arm2slot[mov.toArm] : null;

      let total = 0, heavy = 0;
      mov.timeSeries.forEach(interval => {
        vehicleTypes.forEach(vt => {
          const c = interval.vehicles[vt.id] || 0;
          total += c;
          if (vt.heavy) heavy += c;
        });
      });
      if (total === 0) continue;

      arr.push({
        id:      `${mov.fromArm}-${mov.toArm}-${mov.turnType}`,
        fs, ts,
        fromArm: arms.find(a => a.id === mov.fromArm),
        toArm:   arms.find(a => a.id === mov.toArm),
        turn:    mov.turnTypeEn || mov.turnType || '?',
        total, heavy,
        heavyPct: total > 0 ? ((heavy / total) * 100).toFixed(1) : '0',
      });
    }
    // Sort heaviest first (drawn first = rendered behind lighter arcs)
    return arr.sort((a, b) => b.total - a.total);
  }, [movements, arm2slot, arms, vehicleTypes]);

  const maxVol   = useMemo(() => Math.max(...movData.map(m => m.total), 1), [movData]);
  const armTotals = useMemo(() => {
    const t = {};
    movData.forEach(m => { t[m.fs] = (t[m.fs] || 0) + m.total; });
    return t;
  }, [movData]);

  const hasArcs = movData.some(m => m.ts !== null);

  const strokeW = vol => Math.max(2.5, 2.5 + (vol / maxVol) * 11.5);

  if (!arms.length) return null;

  const hoveredMov = movData.find(m => m.id === hovered);

  return (
    <div className="card">
      <h3 className="section-title">Junction Flow Map</h3>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block', borderRadius: 8, background: '#f1f5f9' }}
        aria-label="Junction flow diagram"
      >
        <defs>
          {/* Per-colour arrowhead markers */}
          {Object.entries(COLORS).map(([slot, fill]) => (
            <marker key={slot} id={`arr-${slot}`}
              markerUnits="userSpaceOnUse"
              markerWidth="16" markerHeight="12"
              refX="15" refY="6" orient="auto"
            >
              <polygon points="0 1 15 6 0 11" fill={fill} />
            </marker>
          ))}
          {/* Hover arrowhead (dark) */}
          <marker id="arr-hover"
            markerUnits="userSpaceOnUse"
            markerWidth="16" markerHeight="12"
            refX="15" refY="6" orient="auto"
          >
            <polygon points="0 1 15 6 0 11" fill="#0f172a" />
          </marker>

          {/* Subtle intersection crosshatch */}
          <pattern id="crosshatch" x={0} y={0} width={16} height={16} patternUnits="userSpaceOnUse">
            <path d="M16 0L0 16M0 0L16 16" stroke="#64748b" strokeWidth={0.5} opacity={0.35} />
          </pattern>

          {/* Drop shadow for road surfaces */}
          <filter id="road-shadow">
            <feDropShadow dx={0} dy={2} stdDeviation={3} floodOpacity={0.15} />
          </filter>
        </defs>

        {/* ── Background ──────────────────────────────────────────────────── */}
        <rect x={0} y={0} width={W} height={H} fill="#f1f5f9" />

        {/* ── Road surfaces ───────────────────────────────────────────────── */}
        {SLOT_ORDER.map(slot => {
          if (!slotMap[slot]) return null;
          const r = ROADS[slot];
          return (
            <rect key={`road-${slot}`}
              x={r.x} y={r.y} width={r.w} height={r.h}
              fill="#cbd5e1" filter="url(#road-shadow)"
            />
          );
        })}

        {/* ── Intersection box ────────────────────────────────────────────── */}
        <rect x={BL} y={BT} width={2*HB} height={2*HB} fill="#cbd5e1" />
        <rect x={BL} y={BT} width={2*HB} height={2*HB} fill="url(#crosshatch)" />

        {/* ── Road edge lines ─────────────────────────────────────────────── */}
        {SLOT_ORDER.map(slot => {
          if (!slotMap[slot]) return null;
          const r = ROADS[slot];
          const vert = slot === 'top' || slot === 'bottom';
          const s = '#94a3b8', sw = 2;
          return vert ? (
            <g key={`edge-${slot}`}>
              <line x1={r.x}     y1={r.y} x2={r.x}     y2={r.y+r.h} stroke={s} strokeWidth={sw} />
              <line x1={r.x+r.w} y1={r.y} x2={r.x+r.w} y2={r.y+r.h} stroke={s} strokeWidth={sw} />
            </g>
          ) : (
            <g key={`edge-${slot}`}>
              <line x1={r.x} y1={r.y}     x2={r.x+r.w} y2={r.y}     stroke={s} strokeWidth={sw} />
              <line x1={r.x} y1={r.y+r.h} x2={r.x+r.w} y2={r.y+r.h} stroke={s} strokeWidth={sw} />
            </g>
          );
        })}

        {/* ── Yellow centre-line dashes ────────────────────────────────────── */}
        {SLOT_ORDER.map(slot => {
          if (!slotMap[slot]) return null;
          const r = ROADS[slot];
          const vert = slot === 'top' || slot === 'bottom';
          return vert ? (
            <line key={`cl-${slot}`}
              x1={CX} y1={r.y+6} x2={CX} y2={r.y+r.h-6}
              stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="12 8"
            />
          ) : (
            <line key={`cl-${slot}`}
              x1={r.x+6} y1={CY} x2={r.x+r.w-6} y2={CY}
              stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="12 8"
            />
          );
        })}

        {/* ── White stop lines at box edges ───────────────────────────────── */}
        {SLOT_ORDER.map(slot => {
          if (!slotMap[slot]) return null;
          const vert = slot === 'top' || slot === 'bottom';
          const en = ENTRY[slot];
          return vert ? (
            <line key={`stop-${slot}`}
              x1={CX - RW/2 + 4} y1={en.y} x2={CX + RW/2 - 4} y2={en.y}
              stroke="white" strokeWidth={3.5} opacity={0.9}
            />
          ) : (
            <line key={`stop-${slot}`}
              x1={en.x} y1={CY - RW/2 + 4} x2={en.x} y2={CY + RW/2 - 4}
              stroke="white" strokeWidth={3.5} opacity={0.9}
            />
          );
        })}

        {/* ── Subtle intersection axis lines ───────────────────────────────── */}
        <line x1={CX} y1={BT} x2={CX} y2={BB} stroke="#94a3b8" strokeWidth={1} opacity={0.5} />
        <line x1={BL} y1={CY} x2={BR} y2={CY} stroke="#94a3b8" strokeWidth={1} opacity={0.5} />

        {/* ── Direction arrows on roads (shows traffic flow direction) ──────── */}
        {SLOT_ORDER.map(slot => {
          if (!slotMap[slot]) return null;
          const r = ROADS[slot];
          const vert = slot === 'top' || slot === 'bottom';
          // Outgoing lane arrow (pointing away from intersection)
          const col = COLORS[slot];
          if (vert) {
            const mx = slot === 'top' ? CX - LO : CX + LO;
            const my = r.y + r.h / 2;
            const dy = slot === 'top' ? -8 : 8;
            return (
              <g key={`flow-${slot}`} opacity={0.45}>
                {/* Incoming arrow (toward intersection) */}
                <polygon points={`${CX+LO-5},${my-dy} ${CX+LO+5},${my-dy} ${CX+LO},${my+dy}`}
                  fill={col} />
                {/* Outgoing arrow (away from intersection) */}
                <polygon points={`${mx-5},${my+dy} ${mx+5},${my+dy} ${mx},${my-dy}`}
                  fill="#64748b" />
              </g>
            );
          } else {
            const my = slot === 'left' ? CY - LO : CY + LO;
            const mx = r.x + r.w / 2;
            const dx = slot === 'left' ? -8 : 8;
            return (
              <g key={`flow-${slot}`} opacity={0.45}>
                <polygon points={`${mx-dx},${CY+LO-5} ${mx-dx},${CY+LO+5} ${mx+dx},${CY+LO}`}
                  fill={col} />
                <polygon points={`${mx+dx},${my-5} ${mx+dx},${my+5} ${mx-dx},${my}`}
                  fill="#64748b" />
              </g>
            );
          }
        })}

        {/* ═══════════════════════════════════════════════════════════════════
            MOVEMENT ARCS  –  drawn heavy → light so thin arcs appear on top
            ══════════════════════════════════════════════════════════════════ */}
        {hasArcs && movData.map(m => {
          if (!m.ts) return null;
          const isH  = hovered === m.id;
          const col  = isH ? '#0f172a' : COLORS[m.fs];
          const sw   = strokeW(m.total);
          const d    = makeArc(m.fs, m.ts);
          const mid  = arcMidpoint(m.fs, m.ts);
          const badgeW = Math.max(36, fmtVol(m.total).length * 7 + 12);

          return (
            <g key={m.id}>
              {/* Invisible wide hit-zone (on top) drawn as a separate layer below */}
              <path d={d} fill="none" stroke="transparent" strokeWidth={sw + 14}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => { setHovered(m.id); setTip({ x: e.clientX, y: e.clientY }); }}
                onMouseLeave={() => setHovered(null)}
              />
              {/* Coloured arc */}
              <path d={d} fill="none"
                stroke={col}
                strokeWidth={sw}
                strokeOpacity={isH ? 1 : 0.78}
                strokeLinecap="round"
                markerEnd={`url(#arr-${isH ? 'hover' : m.fs})`}
                style={{ pointerEvents: 'none', transition: 'stroke-opacity 0.15s, stroke 0.15s' }}
              />
              {/* Volume badge */}
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={mid.x - badgeW/2} y={mid.y - 11}
                  width={badgeW} height={22} rx={6}
                  fill={isH ? '#0f172a' : col}
                  opacity={0.93}
                />
                <text x={mid.x} y={mid.y + 5}
                  textAnchor="middle" fontSize={11} fontWeight={700} fill="white"
                >
                  {fmtVol(m.total)}
                </text>
              </g>
            </g>
          );
        })}

        {/* PCU-only: no arm-to-arm data — show per-arm turn bars */}
        {!hasArcs && !pcuOnly && (
          <text x={CX} y={CY + 5} textAnchor="middle" fontSize={12} fill="#64748b">
            No movement data
          </text>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ARM LABELS  –  in the outer margin bands
            ══════════════════════════════════════════════════════════════════ */}
        {SLOT_ORDER.map(slot => {
          const arm = slotMap[slot];
          if (!arm) return null;
          const { x, y } = LABEL_POS[slot];
          const col   = COLORS[slot];
          const total = armTotals[slot] || 0;

          const lines = [];
          lines.push({ text: arm.name, bold: true, col });
          if (arm.direction) lines.push({ text: arm.direction, bold: false, col: '#64748b' });
          if (total > 0)     lines.push({ text: total.toLocaleString(), bold: true, col });

          const LH = 16, PX = 10, PY = 8;
          const bh = lines.length * LH + PY;
          const bw = 136;
          const bx = x - bw / 2;
          const by = y - bh / 2;

          return (
            <g key={`lbl-${slot}`}>
              {/* Label card */}
              <rect x={bx} y={by} width={bw} height={bh} rx={8}
                fill="white" opacity={0.96}
                stroke={col} strokeWidth={2}
              />
              {/* Coloured top accent strip */}
              <rect x={bx} y={by} width={bw} height={5} rx={8} fill={col} />
              <rect x={bx} y={by+3} width={bw} height={5} fill={col} />

              {/* Text lines */}
              {lines.map((line, i) => (
                <text key={i}
                  x={x} y={by + PY + 5 + (i + 1) * LH - 3}
                  textAnchor="middle"
                  fontSize={i === 0 ? 13 : 11}
                  fontWeight={line.bold ? 700 : 500}
                  fill={line.col}
                >
                  {line.text}
                </text>
              ))}
            </g>
          );
        })}

        {/* ── Centre JUNCTION label ────────────────────────────────────────── */}
        <text x={CX} y={CY + 4}
          textAnchor="middle" fontSize={9} letterSpacing={2.5}
          fill="#94a3b8" fontWeight={700}
        >
          JUNCTION
        </text>

        {/* ── PCU-only notice ──────────────────────────────────────────────── */}
        {pcuOnly && (
          <text x={CX} y={CY + 18} textAnchor="middle" fontSize={9} fill="#94a3b8">
            PCU totals
          </text>
        )}
      </svg>

      {/* ── Tooltip ─────────────────────────────────────────────────────────── */}
      {hoveredMov && (
        <div
          className="jmap-tooltip"
          style={{ position: 'fixed', left: tip.x + 14, top: tip.y - 78, pointerEvents: 'none', zIndex: 9999 }}
        >
          <div style={{
            fontWeight: 700, marginBottom: 6,
            paddingBottom: 6, borderBottom: '1px solid #334155',
            color: COLORS[hoveredMov.fs],
            fontSize: 13,
          }}>
            {hoveredMov.fromArm?.name} → {hoveredMov.toArm?.name || '?'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 12px', fontSize: 12 }}>
            <span style={{ color: '#94a3b8' }}>Turn</span>
            <strong>{hoveredMov.turn}</strong>
            <span style={{ color: '#94a3b8' }}>Volume</span>
            <strong>{hoveredMov.total.toLocaleString()}</strong>
            {hoveredMov.heavy > 0 && <>
              <span style={{ color: '#94a3b8' }}>Heavy %</span>
              <strong>{hoveredMov.heavyPct}%</strong>
            </>}
            <span style={{ color: '#94a3b8' }}>Share</span>
            <strong>{((hoveredMov.total / maxVol) * 100).toFixed(0)}% of peak</strong>
          </div>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        gap: '10px 20px', marginTop: 16,
        paddingTop: 14, borderTop: '1px solid #f1f5f9',
      }}>
        {SLOT_ORDER.map(slot => {
          const arm = slotMap[slot];
          if (!arm) return null;
          const col = COLORS[slot];
          const total = armTotals[slot] || 0;
          return (
            <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Mini arrow */}
              <svg width="36" height="10" style={{ flexShrink: 0 }}>
                <line x1={1} y1={5} x2={26} y2={5} stroke={col} strokeWidth={4} strokeLinecap="round" />
                <polygon points="23,1 36,5 23,9" fill={col} />
              </svg>
              <div style={{ lineHeight: 1.35 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: col }}>{arm.name}</div>
                {arm.direction && (
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{arm.direction} · {total.toLocaleString()} total</div>
                )}
                {!arm.direction && total > 0 && (
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{total.toLocaleString()} total</div>
                )}
              </div>
            </div>
          );
        })}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="50" height="10">
            <line x1={0} y1={5} x2={50} y2={5} stroke="#cbd5e1" strokeWidth={2} strokeLinecap="round" />
            <line x1={0} y1={5} x2={50} y2={5} stroke="#64748b" strokeWidth={8} strokeLinecap="round"
              strokeDasharray="2 48" />
          </svg>
          line width ∝ volume
        </div>
      </div>
    </div>
  );
}
