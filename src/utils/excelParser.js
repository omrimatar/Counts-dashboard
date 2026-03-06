import * as XLSX from 'xlsx';

// ── Constants ────────────────────────────────────────────────────────────────

const TURN_NAMES = {
  'ימינה': 'Right',
  'ישר':   'Straight',
  'שמאלה': 'Left',
  'פרסה':  'U-turn',
};

const DIRECTION_MAP = {
  'צפון': 'North',
  'דרום': 'South',
  'מזרח': 'East',
  'מערב': 'West',
};

const TURN_SYMBOL_MAP = {
  '<': 'Left',
  '^': 'Straight',
  '>': 'Right',
};

const DEFAULT_VEHICLE_TYPES = [
  { id: 1, name: 'Motorcycle',  nameHe: 'דו גלגלי',      heavy: false },
  { id: 2, name: 'Car/Van',     nameHe: 'פרטי+מסחרי',    heavy: false },
  { id: 3, name: 'Taxi',        nameHe: 'מונית',          heavy: false },
  { id: 4, name: 'Public Bus',  nameHe: 'אוטובוס קווי',  heavy: true  },
  { id: 5, name: 'Private Bus', nameHe: 'אוטובוס פרטי',  heavy: true  },
  { id: 6, name: 'Truck',       nameHe: 'משאית',          heavy: true  },
];

const VT_EN_MAP = {
  'דו גלגלי':     'Motorcycle',
  'פרטי+מסחרי':  'Car/Van',
  'מונית':        'Taxi',
  'אוטובוס קווי':'Public Bus',
  'אוטובוס פרטי':'Private Bus',
  'משאית':        'Truck',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeToStr(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date) {
    const h = val.getUTCHours();
    const m = val.getUTCMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (typeof val === 'number') {
    if (val >= 1) val = val - Math.floor(val);
    const totalMin = Math.round(val * 24 * 60);
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (typeof val === 'string' && /^\d{1,2}:\d{2}/.test(val)) return val.slice(0, 5);
  return null;
}

function snapToInterval(timeStr, intervalMins) {
  if (!timeStr || !intervalMins || intervalMins <= 0) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  const snapped = Math.round((h * 60 + m) / intervalMins) * intervalMins;
  const sh = Math.floor(snapped / 60) % 24;
  const sm = snapped % 60;
  return `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
}

function addMinutes(timeStr, mins) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function dateToStr(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return String(val);
}

function isTimeCell(val) {
  if (val instanceof Date) return true;
  if (typeof val === 'number' && val >= 0 && val < 1) return true;
  return false;
}

function str(val) {
  return val !== null && val !== undefined ? String(val).trim() : '';
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetNames = wb.SheetNames;

  // ── Priority 1: 'data' sheet (full raw counts) ──
  const dataSheetName = sheetNames.find(n => n.toLowerCase() === 'data');
  if (dataSheetName) {
    const ws = wb.Sheets[dataSheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const result = extractData(rows, file.name);
    result.meta.fileType    = 'full';
    result.meta.fileTypeLabel = 'Full intersection count';
    result.meta.fileTypeNote  = 'Raw vehicle counts by type · All analytics available';
    return result;
  }

  // ── Priority 2: 'לוח 5' sheet (PCU summary) ──
  const luach5Name = sheetNames.find(n => n === 'לוח 5');
  if (luach5Name) {
    const ws = wb.Sheets[luach5Name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const result = extractLuach5(rows, file.name);
    result.meta.fileType      = 'summary';
    result.meta.fileTypeLabel = 'Summary count (לוח 5)';
    result.meta.fileTypeNote  = 'PCU-weighted totals · Direction & turn breakdown · No vehicle type breakdown';
    return result;
  }

  // ── No parseable sheet found — build a descriptive error ──
  const suggestions = buildSheetSuggestions(sheetNames);
  throw new SheetNotFoundError(sheetNames, suggestions);
}

// ── Format A: 'data' sheet ────────────────────────────────────────────────────

function extractData(rows, fileName) {
  const meta = { fileName };
  const arms = [];
  const vehicleTypes = [];
  const movements = [];

  let state = 'meta';
  let i = 0;

  while (i < rows.length) {
    const row = rows[i];
    if (!row || !row.some(v => v !== null)) { i++; continue; }

    const c0  = row[0];
    const c0s = str(c0);

    if      (c0s === 'שם צומת')       { meta.name        = str(row[1]); state = 'meta'; }
    else if (c0s === 'תאריך')          { meta.date        = dateToStr(row[1]); }
    else if (c0s === 'תקופה')          { meta.intervalMinutes = Number(row[1]) || 15; }
    else if (c0s === 'התחלה')          { meta.startTime   = timeToStr(row[1]); }
    else if (c0s === 'סיום')           { meta.endTime     = timeToStr(row[1]); }
    else if (c0s === 'מבצע')           { meta.surveyor    = str(row[1]); }
    else if (c0s === 'מזמין')          { meta.client      = str(row[1]); }
    else if (c0s === 'סוג ספירה')      { meta.countType   = str(row[1]); }
    else if (c0s === 'אופן ביצוע')     { meta.method      = str(row[1]); }
    else if (c0s === 'שלמות')          { meta.completeness= str(row[1]); }
    else if (c0s === 'זרועות')         { meta.armCount    = Number(row[1]); state = 'arms'; }
    else if (c0s === 'סוגי רכב')       { meta.vehicleTypeCount = Number(row[1]); state = 'vehicles'; }

    else if (state === 'arms' && typeof c0 === 'number' && Number.isInteger(c0) && c0 >= 1 && c0 <= 20 && row[1]) {
      arms.push({ id: c0, name: str(row[1]), direction: str(row[2]) });
      if (meta.armCount && arms.length >= meta.armCount) state = 'meta';
    }

    else if (state === 'vehicles' && typeof c0 === 'number' && Number.isInteger(c0) && c0 >= 1 && c0 <= 20 && row[1]) {
      const heName = str(row[1]);
      vehicleTypes.push({ id: c0, name: VT_EN_MAP[heName] || heName, nameHe: heName, heavy: c0 >= 4 });
      if (meta.vehicleTypeCount && vehicleTypes.length >= meta.vehicleTypeCount) state = 'meta';
    }

    else if (c0s === 'מזרוע') {
      state = 'meta';
      const vtCount  = vehicleTypes.length || 6;
      const fromArm  = row[1];
      const movDefs  = [];

      for (let col = 2; col < row.length; col += vtCount) {
        const toArm = row[col];
        const turn  = row[col + 1];
        if (toArm !== null && toArm !== undefined) {
          movDefs.push({
            fromArm,
            toArm,
            turnType:   str(turn),
            turnTypeEn: TURN_NAMES[str(turn)] || str(turn),
          });
        }
      }

      i++;

      // Skip סוג רכב header
      while (i < rows.length) {
        const r = rows[i];
        if (!r || !r.some(v => v !== null)) { i++; continue; }
        if (str(r[0]) === 'סוג רכב') { i++; break; }
        break;
      }

      // Time-series rows
      const timeSeries = [];
      while (i < rows.length) {
        const r = rows[i];
        if (!r || !r.some(v => v !== null)) { i++; continue; }
        if (!isTimeCell(r[0])) break;

        const snap      = meta.intervalMinutes || 15;
        const timeStart = snapToInterval(timeToStr(r[0]), snap);
        const rawEnd    = timeToStr(r[1]);
        const timeEnd   = rawEnd ? snapToInterval(rawEnd, snap) : addMinutes(timeStart, snap);
        if (!timeStart) { i++; continue; }

        const movCounts = movDefs.map((_, idx) => {
          const startCol = 2 + idx * vtCount;
          const vc = {};
          for (let v = 0; v < vtCount; v++) vc[v + 1] = Number(r[startCol + v]) || 0;
          return vc;
        });

        timeSeries.push({ timeStart, timeEnd, movCounts });
        i++;
      }

      movDefs.forEach((md, idx) => {
        movements.push({
          fromArm:    md.fromArm,
          toArm:      md.toArm,
          turnType:   md.turnType,
          turnTypeEn: md.turnTypeEn,
          timeSeries: timeSeries.map(ts => ({
            timeStart: ts.timeStart,
            timeEnd:   ts.timeEnd,
            vehicles:  ts.movCounts[idx] || {},
          })),
        });
      });

      continue;
    }

    i++;
  }

  // Use actual data time range (more reliable than metadata header rows)
  const allTimes = movements.flatMap(m => m.timeSeries.map(t => t.timeStart)).sort();
  if (allTimes.length) {
    meta.startTime = allTimes[0];
    meta.endTime   = allTimes[allTimes.length - 1];
  }

  const vt = vehicleTypes.length > 0 ? vehicleTypes : DEFAULT_VEHICLE_TYPES;
  return { meta, arms, vehicleTypes: vt, movements };
}

// ── Format B: 'לוח 5' sheet ───────────────────────────────────────────────────

function extractLuach5(rows, fileName) {
  const meta    = { fileName };
  const arms    = [];
  // Single synthetic vehicle type — represents PCU totals
  const vehicleTypes = [{ id: 1, name: 'Total (PCU)', nameHe: 'סה"כ', heavy: false, pcuOnly: true }];
  const movements = [];

  // ── Extract header metadata ──
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i];
    if (!row) continue;
    // Row 1: surveyor company in col 0; date in col 17
    if (i === 1 && row[17] instanceof Date) meta.reportDate = dateToStr(row[17]);

    // Row 7: שם הצומת, תאריך הספירה, יום ספירה
    for (let j = 0; j < row.length; j++) {
      const s = str(row[j]);
      if (s === 'שם הצומת:' && row[j + 2])          meta.name       = str(row[j + 2]);
      if (s === 'תאריך הספירה:' && row[j + 3])       meta.date       = dateToStr(row[j + 3]);
      if (s === 'יום ספירה:' && row[j + 2])           meta.dayOfWeek  = str(row[j + 2]);
    }
  }

  // ── Find the direction header row (starts with 'זמן') ──
  let dirRow       = null;
  let turnHeaderIdx = -1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    if (str(row[0]) === 'זמן') { dirRow = row; }
    // Turn header row: [null, 'סה"כ', '<', '^', '>', 'סה"כ', ...]
    if (str(row[1]) === 'סה"כ' && str(row[2]) === '<') {
      turnHeaderIdx = i;
      break;
    }
  }

  if (!dirRow || turnHeaderIdx === -1) {
    throw new Error('לוח 5 format not recognised — could not find direction headers.');
  }

  // ── Parse arm/direction names from dirRow ──
  // Structure: ['זמן', 'NorthDir', 'StreetName', null, null, 'SouthDir', ...]
  let armId = 1;
  for (let col = 1; col + 3 < dirRow.length; col += 4) {
    const dirHe  = str(dirRow[col]);
    const street = str(dirRow[col + 1]);
    const dirEn  = DIRECTION_MAP[dirHe] || dirHe;
    if (!dirHe || dirHe === 'סה"כ') break;
    arms.push({ id: armId, name: street || dirHe, direction: dirEn });
    armId++;
  }

  meta.armCount = arms.length;

  // ── Parse time-series data rows ──
  // Each direction block: col baseCol+0 = total, +1 = left(<), +2 = straight(^), +3 = right(>)
  // We create one movement per (arm × turn_type), skipping the "total" column.
  const interval = 15; // standard

  for (let armIdx = 0; armIdx < arms.length; armIdx++) {
    const arm     = arms[armIdx];
    const baseCol = 1 + armIdx * 4;

    // turns: offset 1=Left, 2=Straight, 3=Right within the 4-col block
    for (const [offset, symbol] of [[1, '<'], [2, '^'], [3, '>']]) {
      const col      = baseCol + offset;
      const turnEn   = TURN_SYMBOL_MAP[symbol] || symbol;
      const ts       = [];

      for (let r = turnHeaderIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        if (!isTimeCell(row[0])) continue; // skip totals row or empty
        const timeStart = snapToInterval(timeToStr(row[0]), interval);
        if (!timeStart) continue;
        const timeEnd = addMinutes(timeStart, interval);
        const val     = Number(row[col]) || 0;
        ts.push({ timeStart, timeEnd, vehicles: { 1: val } });
      }

      // Only add movement if it has any non-zero data
      if (ts.some(t => t.vehicles[1] > 0)) {
        movements.push({
          fromArm:    arm.id,
          toArm:      null,
          turnType:   symbol,
          turnTypeEn: turnEn,
          timeSeries: ts,
        });
      }
    }
  }

  // Infer time range from data
  const allTimes = movements.flatMap(m => m.timeSeries.map(t => t.timeStart)).sort();
  if (allTimes.length) {
    meta.startTime = allTimes[0];
    meta.endTime   = allTimes[allTimes.length - 1];
    meta.intervalMinutes = interval;
  }

  return { meta, arms, vehicleTypes, movements };
}

// ── Sheet suggestions ─────────────────────────────────────────────────────────

const KNOWN_SHEET_HINTS = {
  'מפה':           'Map/layout diagram — no count data',
  'צילום':         'Photo sheet — no count data',
  'מקדמים':        'Parameters/coefficients — no count data',
  'שרטוט סכמטי':  'Schematic diagram — no count data',
  'שרטוט נתיבים': 'Lane diagram — no count data',
  'גרף 1':         'Chart — no raw data',
  'גרף 2':         'Chart — no raw data',
  'לוח 1.1':       'Directional volumes (raw) — not yet supported',
  'לוח 1.2':       'Directional volumes (raw) — not yet supported',
  'לוח 1.3':       'Directional volumes (raw) — not yet supported',
  'לוח 2.1-2.2':   'Peak hour summary — not yet supported',
  'לוח 2.3-2.4':   'Peak hour summary — not yet supported',
  'לוח 3.1-3.2':   'Hourly totals — not yet supported',
  'לוח 4.2':       'Volume ratios — not yet supported',
  'לוח 5':         'PCU summary by direction ✓ (supported)',
  'אורך תור':      'Queue length survey — no turning count data',
  'צפון':          'North arm totals sheet',
  'דרום':          'South arm totals sheet',
  'מזרח':          'East arm totals sheet',
  'מערב':          'West arm totals sheet',
  'data':          'Full count data ✓ (supported)',
};

function buildSheetSuggestions(sheetNames) {
  return sheetNames.map(name => ({
    name,
    hint: KNOWN_SHEET_HINTS[name] || KNOWN_SHEET_HINTS[name.toLowerCase()] || 'Unknown sheet',
  }));
}

export class SheetNotFoundError extends Error {
  constructor(sheetNames, suggestions) {
    super('No supported sheet found');
    this.sheetNames  = sheetNames;
    this.suggestions = suggestions;
  }
}
