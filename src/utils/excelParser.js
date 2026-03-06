import * as XLSX from 'xlsx';

const TURN_NAMES = {
  'ימינה': 'Right',
  'ישר': 'Straight',
  'שמאלה': 'Left',
  'פרסה': 'U-turn',
};

const DEFAULT_VEHICLE_TYPES = [
  { id: 1, name: 'Motorcycle', nameHe: 'דו גלגלי', heavy: false },
  { id: 2, name: 'Car/Van',    nameHe: 'פרטי+מסחרי', heavy: false },
  { id: 3, name: 'Taxi',       nameHe: 'מונית', heavy: false },
  { id: 4, name: 'Public Bus', nameHe: 'אוטובוס קווי', heavy: true },
  { id: 5, name: 'Private Bus',nameHe: 'אוטובוס פרטי', heavy: true },
  { id: 6, name: 'Truck',      nameHe: 'משאית', heavy: true },
];

const VT_EN_MAP = {
  'דו גלגלי': 'Motorcycle',
  'פרטי+מסחרי': 'Car/Van',
  'מונית': 'Taxi',
  'אוטובוס קווי': 'Public Bus',
  'אוטובוס פרטי': 'Private Bus',
  'משאית': 'Truck',
};

function timeToStr(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date) {
    const h = val.getUTCHours();
    const m = val.getUTCMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (typeof val === 'number') {
    if (val >= 1) val = val - Math.floor(val); // strip date part
    const totalMin = Math.round(val * 24 * 60);
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  // Already a string like "06:00"
  if (typeof val === 'string' && /^\d{1,2}:\d{2}/.test(val)) return val.slice(0, 5);
  return null;
}

function dateToStr(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'number') {
    // Excel serial date
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

export async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  // Find the data sheet (case-insensitive)
  const dataSheetName = wb.SheetNames.find(n => n.toLowerCase() === 'data');
  if (!dataSheetName) {
    throw new Error(
      `No "data" sheet found.\nSheets in this file: ${wb.SheetNames.join(', ')}`
    );
  }

  const ws = wb.Sheets[dataSheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  return extractData(rows, file.name);
}

function extractData(rows, fileName) {
  const meta = { fileName };
  const arms = [];
  const vehicleTypes = [];
  const movements = [];

  let state = 'meta'; // 'meta' | 'arms' | 'vehicles'
  let i = 0;

  while (i < rows.length) {
    const row = rows[i];
    if (!row || !row.some(v => v !== null)) { i++; continue; }

    const c0 = row[0];
    const c0s = str(c0);

    // ── Metadata key-value rows ──
    if (c0s === 'שם צומת')       { meta.name = str(row[1]); state = 'meta'; }
    else if (c0s === 'תאריך')    { meta.date = dateToStr(row[1]); }
    else if (c0s === 'תקופה')    { meta.intervalMinutes = Number(row[1]) || 15; }
    else if (c0s === 'התחלה')    { meta.startTime = timeToStr(row[1]); }
    else if (c0s === 'סיום')     { meta.endTime = timeToStr(row[1]); }
    else if (c0s === 'מבצע')     { meta.surveyor = str(row[1]); }
    else if (c0s === 'מזמין')    { meta.client = str(row[1]); }
    else if (c0s === 'סוג ספירה'){ meta.countType = str(row[1]); }
    else if (c0s === 'אופן ביצוע'){ meta.method = str(row[1]); }
    else if (c0s === 'שלמות')    { meta.completeness = str(row[1]); }
    else if (c0s === 'זרועות')   { meta.armCount = Number(row[1]); state = 'arms'; }
    else if (c0s === 'סוגי רכב') { meta.vehicleTypeCount = Number(row[1]); state = 'vehicles'; }

    // ── Arm definitions ──
    else if (state === 'arms' && typeof c0 === 'number' && Number.isInteger(c0) && c0 >= 1 && c0 <= 20 && row[1]) {
      arms.push({ id: c0, name: str(row[1]), direction: str(row[2]) });
      if (meta.armCount && arms.length >= meta.armCount) state = 'meta';
    }

    // ── Vehicle type definitions ──
    else if (state === 'vehicles' && typeof c0 === 'number' && Number.isInteger(c0) && c0 >= 1 && c0 <= 20 && row[1]) {
      const heName = str(row[1]);
      vehicleTypes.push({
        id: c0,
        name: VT_EN_MAP[heName] || heName,
        nameHe: heName,
        heavy: c0 >= 4,
      });
      if (meta.vehicleTypeCount && vehicleTypes.length >= meta.vehicleTypeCount) state = 'meta';
    }

    // ── Data block: מזרוע ──
    else if (c0s === 'מזרוע') {
      state = 'meta';
      const vtCount = vehicleTypes.length || 6;
      const fromArm = row[1];

      // Parse turn definitions from the מזרוע header row
      // Structure: [מזרוע, fromArm, toArm, turnType, null×4, toArm, turnType, null×4, ...]
      const movDefs = [];
      for (let col = 2; col < row.length; col += vtCount) {
        const toArm = row[col];
        const turn = row[col + 1];
        if (toArm !== null && toArm !== undefined) {
          movDefs.push({
            fromArm,
            toArm,
            turnType: str(turn),
            turnTypeEn: TURN_NAMES[str(turn)] || str(turn),
          });
        }
      }

      i++; // advance past מזרוע row

      // Skip סוג רכב header row
      while (i < rows.length) {
        const r = rows[i];
        if (!r || !r.some(v => v !== null)) { i++; continue; }
        if (str(r[0]) === 'סוג רכב') { i++; break; }
        break;
      }

      // Parse time-series rows
      const timeSeries = [];
      while (i < rows.length) {
        const r = rows[i];
        if (!r || !r.some(v => v !== null)) { i++; continue; }

        if (!isTimeCell(r[0])) break; // new section or end

        const timeStart = timeToStr(r[0]);
        const timeEnd   = timeToStr(r[1]);
        if (!timeStart) { i++; continue; }

        const movCounts = movDefs.map((_, idx) => {
          const startCol = 2 + idx * vtCount;
          const vc = {};
          for (let v = 0; v < vtCount; v++) {
            vc[v + 1] = Number(r[startCol + v]) || 0;
          }
          return vc;
        });

        timeSeries.push({ timeStart, timeEnd, movCounts });
        i++;
      }

      // Push one movement entry per turn
      movDefs.forEach((md, idx) => {
        movements.push({
          fromArm: md.fromArm,
          toArm: md.toArm,
          turnType: md.turnType,
          turnTypeEn: md.turnTypeEn,
          timeSeries: timeSeries.map(ts => ({
            timeStart: ts.timeStart,
            timeEnd: ts.timeEnd,
            vehicles: ts.movCounts[idx] || {},
          })),
        });
      });

      continue; // skip the i++ at the bottom
    }

    i++;
  }

  // Fallback vehicle types
  const vt = vehicleTypes.length > 0 ? vehicleTypes : DEFAULT_VEHICLE_TYPES;

  return { meta, arms, vehicleTypes: vt, movements };
}
