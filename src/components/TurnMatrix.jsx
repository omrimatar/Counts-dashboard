import { useMemo } from 'react';

export default function TurnMatrix({ data, analytics, filters, pcuWeights }) {
  const { movements, arms, vehicleTypes } = data;
  const pcuMode = pcuWeights !== null;

  const matrix = useMemo(() => {
    const { fromArms = [], toArms = [], vehicleTypeIds = [], timeRange = null } = filters || {};
    const activeVtIds = vehicleTypeIds.length > 0
      ? new Set(vehicleTypeIds)
      : new Set(vehicleTypes.map(vt => vt.id));

    const getCount = (vehicles, vtId) => {
      const raw = vehicles[vtId] || 0;
      return pcuMode ? raw * ((pcuWeights || {})[vtId] ?? 1) : raw;
    };

    // collect volumes per from-to pair
    const volMap = {}; // [fromId][toId] = volume
    const fromIds = new Set();
    const toIds = new Set();

    for (const mov of movements) {
      if (mov.toArm === null) continue;
      if (fromArms.length > 0 && !fromArms.includes(mov.fromArm)) continue;
      if (toArms.length > 0 && !toArms.includes(mov.toArm)) continue;

      let vol = 0;
      for (const ts of mov.timeSeries) {
        if (timeRange && (ts.timeStart < timeRange[0] || ts.timeStart >= timeRange[1])) continue;
        activeVtIds.forEach(vtId => { vol += getCount(ts.vehicles, vtId); });
      }
      if (vol === 0) continue;

      fromIds.add(mov.fromArm);
      toIds.add(mov.toArm);
      if (!volMap[mov.fromArm]) volMap[mov.fromArm] = {};
      volMap[mov.fromArm][mov.toArm] = (volMap[mov.fromArm][mov.toArm] || 0) + vol;
    }

    const sortedFrom = Array.from(fromIds).sort((a, b) => a - b);
    const sortedTo = Array.from(toIds).sort((a, b) => a - b);

    // row and col totals
    const rowTotals = {};
    const colTotals = {};
    let grandTotal = 0;
    sortedFrom.forEach(f => {
      rowTotals[f] = 0;
      sortedTo.forEach(t => {
        const v = (volMap[f] || {})[t] || 0;
        rowTotals[f] += v;
        colTotals[t] = (colTotals[t] || 0) + v;
        grandTotal += v;
      });
    });

    // max for colour scaling
    const allVals = sortedFrom.flatMap(f => sortedTo.map(t => (volMap[f] || {})[t] || 0));
    const maxVal = Math.max(...allVals, 1);

    return { volMap, sortedFrom, sortedTo, rowTotals, colTotals, grandTotal, maxVal };
  }, [movements, vehicleTypes, filters, pcuWeights]);

  const { volMap, sortedFrom, sortedTo, rowTotals, colTotals, grandTotal, maxVal } = matrix;

  if (!sortedFrom.length || !sortedTo.length) {
    return (
      <div className="card">
        <h3 className="section-title">Turning Movement Matrix</h3>
        <p style={{ color: '#9ca3af', fontSize: 13 }}>No turning movement data for current filters.</p>
      </div>
    );
  }

  const armName = id => {
    const a = arms.find(a => a.id === id);
    return a ? a.name : `Arm ${id}`;
  };

  const cellBg = (val) => {
    if (!val) return 'transparent';
    const pct = val / maxVal;
    const h = Math.round(220 - pct * 220); // 220=blue → 0=red
    return `hsl(${h}, 80%, ${95 - pct * 30}%)`;
  };

  const fmt = n => pcuMode ? n.toFixed(1) : Math.round(n).toLocaleString();

  return (
    <div className="card">
      <h3 className="section-title">Turning Movement Matrix</h3>
      <div className="table-wrapper">
        <table className="mov-table turn-matrix-table">
          <thead>
            <tr>
              <th className="matrix-corner">From ↓ / To →</th>
              {sortedTo.map(t => (
                <th key={t}>{armName(t)}</th>
              ))}
              <th className="matrix-total-col">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedFrom.map(f => (
              <tr key={f}>
                <td className="matrix-row-header">{armName(f)}</td>
                {sortedTo.map(t => {
                  const val = (volMap[f] || {})[t] || 0;
                  return (
                    <td
                      key={t}
                      className="matrix-cell"
                      style={{ background: cellBg(val), textAlign: 'right' }}
                    >
                      {val ? fmt(val) : '—'}
                    </td>
                  );
                })}
                <td className="matrix-total-col" style={{ textAlign: 'right' }}>
                  {fmt(rowTotals[f])}
                </td>
              </tr>
            ))}
            <tr className="matrix-total-row">
              <td className="matrix-row-header">Total</td>
              {sortedTo.map(t => (
                <td key={t} className="matrix-total-col" style={{ textAlign: 'right' }}>
                  {fmt(colTotals[t] || 0)}
                </td>
              ))}
              <td className="matrix-total-col matrix-grand-total" style={{ textAlign: 'right' }}>
                {fmt(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
