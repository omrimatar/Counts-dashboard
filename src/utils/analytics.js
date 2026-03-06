/**
 * Compute all analytics from parsed Excel data + active filters.
 * filters: { fromArm: number|null, toArm: number|null, vehicleGroup: 'all'|'light'|'heavy' }
 */
export function computeAnalytics(data, filters = {}) {
  const { movements, vehicleTypes, arms } = data;
  if (!movements?.length) return null;

  const { fromArm = null, toArm = null, vehicleGroup = 'all' } = filters;

  // Filter movements
  let filtered = movements;
  if (fromArm !== null) filtered = filtered.filter(m => m.fromArm === fromArm);
  if (toArm !== null)   filtered = filtered.filter(m => m.toArm === toArm);

  // Determine which vehicle type IDs to include
  const activeVtIds = new Set(
    vehicleTypes
      .filter(vt => vehicleGroup === 'all' || (vehicleGroup === 'heavy' ? vt.heavy : !vt.heavy))
      .map(vt => vt.id)
  );

  // Aggregate into time intervals
  const intervalMap = new Map();
  for (const mov of filtered) {
    for (const ts of mov.timeSeries) {
      if (!intervalMap.has(ts.timeStart)) {
        intervalMap.set(ts.timeStart, { timeStart: ts.timeStart, timeEnd: ts.timeEnd, vehicles: {} });
        vehicleTypes.forEach(vt => { intervalMap.get(ts.timeStart).vehicles[vt.id] = 0; });
      }
      const entry = intervalMap.get(ts.timeStart);
      vehicleTypes.forEach(vt => {
        entry.vehicles[vt.id] = (entry.vehicles[vt.id] || 0) + (ts.vehicles[vt.id] || 0);
      });
    }
  }

  const intervals = Array.from(intervalMap.values())
    .sort((a, b) => a.timeStart.localeCompare(b.timeStart));

  // Helper: total vehicles for one interval (respecting active filter)
  const intervalTotal = iv =>
    vehicleTypes
      .filter(vt => activeVtIds.has(vt.id))
      .reduce((s, vt) => s + (iv.vehicles[vt.id] || 0), 0);

  // Grand totals
  const totalByVehicle = {};
  vehicleTypes.forEach(vt => { totalByVehicle[vt.id] = 0; });
  intervals.forEach(iv => {
    vehicleTypes.forEach(vt => {
      totalByVehicle[vt.id] += iv.vehicles[vt.id] || 0;
    });
  });

  const grandTotal  = vehicleTypes.reduce((s, vt) => s + (totalByVehicle[vt.id] || 0), 0);
  // PCU-only files (לוח 5) have no vehicle type breakdown — heavy % is unavailable
  const isPcuOnly   = vehicleTypes.length === 1 && vehicleTypes[0].pcuOnly;
  const heavyTotal  = isPcuOnly ? null : vehicleTypes.filter(vt => vt.heavy).reduce((s, vt) => s + (totalByVehicle[vt.id] || 0), 0);
  const lightTotal  = isPcuOnly ? null : grandTotal - heavyTotal;
  const heavyPct    = isPcuOnly ? null : (grandTotal > 0 ? ((heavyTotal / grandTotal) * 100).toFixed(1) : '0.0');

  // Peak rolling 60-min window (4 × 15-min intervals)
  let peakHour = null, peakHourVolume = 0;
  const ivCount = intervals.length;
  for (let j = 0; j <= ivCount - 4; j++) {
    const vol = intervals.slice(j, j + 4).reduce((s, iv) => s + intervalTotal(iv), 0);
    if (vol > peakHourVolume) {
      peakHourVolume = vol;
      peakHour = `${intervals[j].timeStart}–${intervals[j + 3].timeEnd}`;
    }
  }
  // Fallback if < 4 intervals
  if (!peakHour && intervals.length > 0) {
    const best = intervals.reduce((a, b) => intervalTotal(a) > intervalTotal(b) ? a : b);
    peakHour = `${best.timeStart}–${best.timeEnd}`;
    peakHourVolume = intervalTotal(best);
  }

  // Peak 15-min
  let peak15 = null, peak15Volume = 0;
  intervals.forEach(iv => {
    const vol = intervalTotal(iv);
    if (vol > peak15Volume) { peak15Volume = vol; peak15 = `${iv.timeStart}–${iv.timeEnd}`; }
  });

  // AM (07:00–09:00) and PM (16:00–19:00) volumes
  const amVol = intervals
    .filter(iv => iv.timeStart >= '07:00' && iv.timeStart < '09:00')
    .reduce((s, iv) => s + intervalTotal(iv), 0);
  const pmVol = intervals
    .filter(iv => iv.timeStart >= '16:00' && iv.timeStart < '19:00')
    .reduce((s, iv) => s + intervalTotal(iv), 0);

  // Volume by from-arm
  const volumeByArm = {};
  for (const mov of filtered) {
    const id = mov.fromArm;
    if (!volumeByArm[id]) volumeByArm[id] = 0;
    mov.timeSeries.forEach(ts => {
      activeVtIds.forEach(vtId => { volumeByArm[id] += ts.vehicles[vtId] || 0; });
    });
  }

  // Hourly aggregation for chart
  const hourlyMap = new Map();
  intervals.forEach(iv => {
    const h = iv.timeStart.slice(0, 2) + ':00';
    hourlyMap.set(h, (hourlyMap.get(h) || 0) + intervalTotal(iv));
  });
  const hourlyData = Array.from(hourlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, vol]) => ({ time: hour, Volume: vol }));

  // Direction breakdown chart data
  const armLabel = id => {
    const arm = arms.find(a => a.id === id);
    return arm ? `${arm.name}` : `Arm ${id}`;
  };
  const directionData = Object.entries(volumeByArm).map(([id, vol]) => ({
    name: armLabel(Number(id)),
    Volume: vol,
  }));

  // Vehicle type chart data
  const vehicleData = vehicleTypes.map(vt => ({
    name: vt.name,
    value: totalByVehicle[vt.id] || 0,
    heavy: vt.heavy,
  })).filter(d => d.value > 0);

  // Turn type breakdown
  const turnBreakdown = {};
  for (const mov of filtered) {
    const key = mov.turnTypeEn || mov.turnType || 'Unknown';
    if (!turnBreakdown[key]) turnBreakdown[key] = 0;
    mov.timeSeries.forEach(ts => {
      activeVtIds.forEach(vtId => { turnBreakdown[key] += ts.vehicles[vtId] || 0; });
    });
  }

  return {
    grandTotal, heavyTotal, lightTotal, heavyPct,
    peakHour, peakHourVolume,
    peak15, peak15Volume,
    amVol, pmVol,
    peakDirection: amVol >= pmVol ? 'AM' : 'PM',
    intervals,     // raw 15-min intervals
    hourlyData,    // for time series chart
    vehicleData,   // for pie chart
    directionData, // for direction bar chart
    turnBreakdown,
    totalByVehicle,
  };
}

export const CHART_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2',
  '#be185d', '#65a30d', '#ea580c', '#4338ca',
];
