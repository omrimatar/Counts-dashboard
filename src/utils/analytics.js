/**
 * Compute all analytics from parsed Excel data + active filters.
 * filters: {
 *   fromArms: number[],   toArms: number[],
 *   vehicleTypeIds: number[],  timeRange: ['HH:MM','HH:MM']|null,
 *   chartView: 'hourly'|'15min'
 * }
 * pcuWeights: { [vtId]: number } | null
 */
function addMins(timeStr, m) {
  const [h, mm] = timeStr.split(':').map(Number);
  const t = h * 60 + mm + m;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function computeAnalytics(data, filters = {}, pcuWeights = null) {
  const { movements, vehicleTypes, arms } = data;
  if (!movements?.length) return null;

  const {
    fromArms = [],
    toArms = [],
    vehicleTypeIds = [],
    timeRange = null,
    // legacy compat
    fromArm = null,
    toArm = null,
    vehicleGroup = 'all',
  } = filters;

  const pcuMode = pcuWeights !== null;

  // Resolve effective arm filters (support both old scalar and new array shapes)
  const effectiveFromArms = fromArms.length > 0 ? fromArms
    : (fromArm !== null ? [fromArm] : []);
  const effectiveToArms = toArms.length > 0 ? toArms
    : (toArm !== null ? [toArm] : []);

  // Filter movements
  let filtered = movements;
  if (effectiveFromArms.length > 0)
    filtered = filtered.filter(m => effectiveFromArms.includes(m.fromArm));
  if (effectiveToArms.length > 0)
    filtered = filtered.filter(m => m.toArm !== null && effectiveToArms.includes(m.toArm));

  // Active vehicle type IDs
  let activeVtIds;
  if (vehicleTypeIds.length > 0) {
    activeVtIds = new Set(vehicleTypeIds);
  } else if (vehicleGroup !== 'all') {
    activeVtIds = new Set(
      vehicleTypes
        .filter(vt => vehicleGroup === 'heavy' ? vt.heavy : !vt.heavy)
        .map(vt => vt.id)
    );
  } else {
    activeVtIds = new Set(vehicleTypes.map(vt => vt.id));
  }

  const heavyVts = vehicleTypes.filter(vt => vt.heavy && activeVtIds.has(vt.id));

  // Helper: weighted count for a single vehicle type in a vehicles map
  const getCount = (vehicles, vtId) => {
    const raw = vehicles[vtId] || 0;
    return pcuMode ? raw * (pcuWeights[vtId] ?? 1) : raw;
  };

  // Aggregate raw vehicle counts into time intervals (unweighted storage)
  const intervalMap = new Map();
  for (const mov of filtered) {
    for (const ts of mov.timeSeries) {
      if (timeRange !== null) {
        if (ts.timeStart < timeRange[0] || ts.timeStart >= timeRange[1]) continue;
      }
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

  // Weighted total for one interval (respects active types + PCU weights)
  const intervalTotal = iv =>
    vehicleTypes
      .filter(vt => activeVtIds.has(vt.id))
      .reduce((s, vt) => s + getCount(iv.vehicles, vt.id), 0);

  // Attach weighted total to each interval (used by charts)
  intervals.forEach(iv => { iv.total = intervalTotal(iv); });

  // Grand totals
  const totalByVehicle = {};
  vehicleTypes.forEach(vt => { totalByVehicle[vt.id] = 0; });
  intervals.forEach(iv => {
    vehicleTypes.forEach(vt => { totalByVehicle[vt.id] += iv.vehicles[vt.id] || 0; });
  });

  const grandTotal = vehicleTypes.reduce((s, vt) =>
    activeVtIds.has(vt.id) ? s + getCount({ [vt.id]: totalByVehicle[vt.id] }, vt.id) : s, 0);

  const isPcuOnly = vehicleTypes.length === 1 && vehicleTypes[0].pcuOnly;

  // Heavy % always uses raw vehicle counts — unaffected by PCU weighting
  const heavyTotal = isPcuOnly ? null
    : heavyVts.reduce((s, vt) => s + (totalByVehicle[vt.id] || 0), 0);
  const rawActiveTotal = isPcuOnly ? null
    : vehicleTypes.reduce((s, vt) => activeVtIds.has(vt.id) ? s + (totalByVehicle[vt.id] || 0) : s, 0);
  const lightTotal = isPcuOnly ? null : (rawActiveTotal - heavyTotal);
  const heavyPct = isPcuOnly ? null
    : (rawActiveTotal > 0 ? ((heavyTotal / rawActiveTotal) * 100).toFixed(1) : '0.0');

  // Infer interval length and how many intervals make one hour
  const inferredInterval = intervals.length >= 2
    ? (() => {
        const [h1, m1] = intervals[0].timeStart.split(':').map(Number);
        const [h2, m2] = intervals[1].timeStart.split(':').map(Number);
        return Math.max(1, (h2 * 60 + m2) - (h1 * 60 + m1));
      })()
    : 15;
  const ivPerHour = Math.max(1, Math.round(60 / inferredInterval));

  // Peak rolling 60-min window
  let peakHour = null, peakHourVolume = 0;
  const ivCount = intervals.length;
  for (let j = 0; j <= ivCount - ivPerHour; j++) {
    const vol = intervals.slice(j, j + ivPerHour).reduce((s, iv) => s + iv.total, 0);
    if (vol > peakHourVolume) {
      peakHourVolume = vol;
      peakHour = `${intervals[j].timeStart}–${addMins(intervals[j].timeStart, 60)}`;
    }
  }
  if (!peakHour && intervals.length > 0) {
    const best = intervals.reduce((a, b) => a.total > b.total ? a : b);
    peakHour = `${best.timeStart}–${best.timeEnd}`;
    peakHourVolume = best.total;
  }

  // Peak 15-min (or inferred interval)
  let peak15 = null, peak15Volume = 0;
  intervals.forEach(iv => {
    if (iv.total > peak15Volume) {
      peak15Volume = iv.total;
      peak15 = `${iv.timeStart}–${iv.timeEnd ?? addMins(iv.timeStart, inferredInterval)}`;
    }
  });

  // Peak Hour Factor
  const phf = (peakHourVolume > 0 && peak15Volume > 0)
    ? +(peakHourVolume / (ivPerHour * peak15Volume)).toFixed(2)
    : null;

  // AM / PM volumes
  const amVol = intervals
    .filter(iv => iv.timeStart >= '07:00' && iv.timeStart < '09:00')
    .reduce((s, iv) => s + iv.total, 0);
  const pmVol = intervals
    .filter(iv => iv.timeStart >= '16:00' && iv.timeStart < '19:00')
    .reduce((s, iv) => s + iv.total, 0);

  // Volume by from-arm
  const volumeByArm = {};
  for (const mov of filtered) {
    const id = mov.fromArm;
    if (!volumeByArm[id]) volumeByArm[id] = 0;
    mov.timeSeries.forEach(ts => {
      if (timeRange !== null && (ts.timeStart < timeRange[0] || ts.timeStart >= timeRange[1])) return;
      activeVtIds.forEach(vtId => { volumeByArm[id] += getCount(ts.vehicles, vtId); });
    });
  }

  // Hourly aggregation for chart
  const hourlyMap = new Map();
  intervals.forEach(iv => {
    const h = iv.timeStart.slice(0, 2) + ':00';
    hourlyMap.set(h, (hourlyMap.get(h) || 0) + iv.total);
  });
  const hourlyData = Array.from(hourlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, vol]) => ({ time: hour, Volume: vol }));

  // Direction breakdown chart data
  const armLabel = id => {
    const arm = arms.find(a => a.id === id);
    return arm ? arm.name : `Arm ${id}`;
  };
  const directionData = Object.entries(volumeByArm).map(([id, vol]) => ({
    name: armLabel(Number(id)),
    armId: Number(id),
    Volume: vol,
  }));

  // Vehicle type chart data
  const vehicleData = vehicleTypes
    .filter(vt => activeVtIds.has(vt.id))
    .map(vt => ({
      name: vt.name,
      value: getCount({ [vt.id]: totalByVehicle[vt.id] }, vt.id),
      heavy: vt.heavy,
    })).filter(d => d.value > 0);

  // Turn type breakdown
  const turnBreakdown = {};
  for (const mov of filtered) {
    const key = mov.turnTypeEn || mov.turnType || 'Unknown';
    if (!turnBreakdown[key]) turnBreakdown[key] = 0;
    mov.timeSeries.forEach(ts => {
      if (timeRange !== null && (ts.timeStart < timeRange[0] || ts.timeStart >= timeRange[1])) return;
      activeVtIds.forEach(vtId => { turnBreakdown[key] += getCount(ts.vehicles, vtId); });
    });
  }

  // Per-arm AM vs PM (for Advanced tab)
  const perArmAMPM = arms.map(arm => {
    const armMovs = filtered.filter(m => m.fromArm === arm.id);
    const computePeriod = (start, end) => {
      let vol = 0, heavy = 0;
      armMovs.forEach(m => {
        m.timeSeries
          .filter(ts => ts.timeStart >= start && ts.timeStart < end)
          .forEach(ts => {
            activeVtIds.forEach(vtId => { vol += getCount(ts.vehicles, vtId); });
            heavyVts.forEach(vt => { heavy += getCount(ts.vehicles, vt.id); });
          });
      });
      return { vol, heavy };
    };
    const am = computePeriod('07:00', '09:00');
    const pm = computePeriod('16:00', '19:00');
    return {
      armId: arm.id,
      armName: arm.name,
      amVol: am.vol,
      pmVol: pm.vol,
      heavyPctAM: am.vol > 0 ? ((am.heavy / am.vol) * 100).toFixed(1) : '0.0',
      heavyPctPM: pm.vol > 0 ? ((pm.heavy / pm.vol) * 100).toFixed(1) : '0.0',
    };
  }).filter(a => a.amVol > 0 || a.pmVol > 0);

  // Per-arm heavy % (for Advanced tab)
  const perArmHeavy = arms.map(arm => {
    const armMovs = filtered.filter(m => m.fromArm === arm.id);
    let total = 0, heavy = 0;
    armMovs.forEach(m => {
      m.timeSeries.forEach(ts => {
        if (timeRange !== null && (ts.timeStart < timeRange[0] || ts.timeStart >= timeRange[1])) return;
        activeVtIds.forEach(vtId => { total += getCount(ts.vehicles, vtId); });
        heavyVts.forEach(vt => { heavy += getCount(ts.vehicles, vt.id); });
      });
    });
    return {
      armId: arm.id,
      armName: arm.name,
      total,
      heavy,
      heavyPct: total > 0 ? ((heavy / total) * 100).toFixed(1) : '0.0',
    };
  }).filter(a => a.total > 0);

  // Heavy % per hour (for Advanced tab)
  const hourlyHeavyMap = new Map();
  intervals.forEach(iv => {
    const h = iv.timeStart.slice(0, 2) + ':00';
    if (!hourlyHeavyMap.has(h)) hourlyHeavyMap.set(h, { total: 0, heavy: 0 });
    const entry = hourlyHeavyMap.get(h);
    activeVtIds.forEach(vtId => { entry.total += getCount(iv.vehicles, vtId); });
    heavyVts.forEach(vt => { entry.heavy += getCount(iv.vehicles, vt.id); });
  });
  const hourlyHeavyData = Array.from(hourlyHeavyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, { total, heavy }]) => ({
      time: hour,
      heavyPct: total > 0 ? +((heavy / total) * 100).toFixed(1) : 0,
    }));

  // Per-arm hourly breakdown (for heatmap)
  const allHours = Array.from(new Set(intervals.map(iv => iv.timeStart.slice(0, 2) + ':00'))).sort();
  const armHourlyData = arms.map(arm => {
    const armMovs = filtered.filter(m => m.fromArm === arm.id);
    const hourMap = {};
    allHours.forEach(h => { hourMap[h] = 0; });
    armMovs.forEach(m => {
      m.timeSeries.forEach(ts => {
        if (timeRange !== null && (ts.timeStart < timeRange[0] || ts.timeStart >= timeRange[1])) return;
        const h = ts.timeStart.slice(0, 2) + ':00';
        activeVtIds.forEach(vtId => { hourMap[h] = (hourMap[h] || 0) + getCount(ts.vehicles, vtId); });
      });
    });
    return { armId: arm.id, armName: arm.name, hours: allHours, hourlyVols: hourMap };
  }).filter(a => Object.values(a.hourlyVols).some(v => v > 0));

  return {
    pcuMode,
    grandTotal, heavyTotal, lightTotal, heavyPct,
    phf,
    peakHour, peakHourVolume,
    peak15, peak15Volume,
    amVol, pmVol,
    peakDirection: amVol >= pmVol ? 'AM' : 'PM',
    intervals,
    hourlyData,
    vehicleData,
    directionData,
    turnBreakdown,
    totalByVehicle,
    perArmAMPM,
    perArmHeavy,
    hourlyHeavyData,
    armHourlyData,
  };
}

export const CHART_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2',
  '#be185d', '#65a30d', '#ea580c', '#4338ca',
];
