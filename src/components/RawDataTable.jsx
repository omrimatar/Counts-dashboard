import { useState, useMemo } from 'react';

const PAGE_SIZE = 50;

export default function RawDataTable({ data, filters, pcuWeights }) {
  const [sortKey, setSortKey] = useState('time');
  const [sortDir, setSortDir] = useState(1);
  const [page, setPage] = useState(0);

  const { movements, arms, vehicleTypes } = data;
  const pcuMode = pcuWeights !== null;

  const armName = id => {
    const a = arms.find(a => a.id === id);
    return a ? `${a.id}. ${a.name}` : `Arm ${id}`;
  };

  const getCount = (vehicles, vtId) => {
    const raw = vehicles[vtId] || 0;
    return pcuMode ? raw * (pcuWeights[vtId] ?? 1) : raw;
  };

  const rows = useMemo(() => {
    const { fromArms = [], toArms = [], vehicleTypeIds = [], timeRange = null } = filters;

    const activeVtIds = vehicleTypeIds.length > 0
      ? vehicleTypeIds
      : vehicleTypes.map(vt => vt.id);

    const result = [];
    for (const mov of movements) {
      if (fromArms.length > 0 && !fromArms.includes(mov.fromArm)) continue;
      if (toArms.length > 0 && mov.toArm !== null && !toArms.includes(mov.toArm)) continue;

      for (const ts of mov.timeSeries) {
        if (timeRange && (ts.timeStart < timeRange[0] || ts.timeStart >= timeRange[1])) continue;

        let volume = 0;
        activeVtIds.forEach(vtId => { volume += getCount(ts.vehicles, vtId); });
        if (volume === 0) continue;

        result.push({
          time: ts.timeStart,
          fromArm: armName(mov.fromArm),
          toArm: mov.toArm !== null ? armName(mov.toArm) : '—',
          turn: mov.turnTypeEn || mov.turnType || '—',
          volume,
        });
      }
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movements, arms, vehicleTypes, filters, pcuWeights]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number') return (av - bv) * sortDir;
      return String(av).localeCompare(String(bv)) * sortDir;
    });
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(1); }
    setPage(0);
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span style={{ opacity: 0.3 }}> ↕</span>;
    return <span>{sortDir === 1 ? ' ↑' : ' ↓'}</span>;
  };

  const exportCSV = () => {
    const headers = ['Time', 'From Arm', 'To Arm', 'Turn', pcuMode ? 'Volume (PCU)' : 'Volume'];
    const csvRows = [headers.join(',')];
    sorted.forEach(r => {
      csvRows.push([
        r.time,
        `"${r.fromArm}"`,
        `"${r.toArm}"`,
        r.turn,
        pcuMode ? r.volume.toFixed(1) : r.volume,
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'counts_data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="section-title" style={{ margin: 0 }}>Raw Data</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="badge">{rows.length.toLocaleString()} rows</span>
          <button className="btn-ghost" onClick={exportCSV} title="Download as CSV">⬇ CSV</button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="mov-table">
          <thead>
            <tr>
              {[
                ['time', 'Time'],
                ['fromArm', 'From Arm'],
                ['toArm', 'To Arm'],
                ['turn', 'Turn'],
                ['volume', pcuMode ? 'Volume (PCU)' : 'Volume'],
              ].map(([key, label]) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  {label}<SortIcon col={key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={i}>
                <td>{r.time}</td>
                <td>{r.fromArm}</td>
                <td>{r.toArm}</td>
                <td><span className={`turn-badge turn-${r.turn?.toLowerCase()}`}>{r.turn}</span></td>
                <td>{pcuMode ? r.volume.toFixed(1) : r.volume.toLocaleString()}</td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>No data for current filters</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >← Prev</button>
          <span className="page-info">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length.toLocaleString()}
          </span>
          <button
            className="page-btn"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >Next →</button>
        </div>
      )}
    </div>
  );
}
