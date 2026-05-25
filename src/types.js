// ── Constantes ────────────────────────────────────────────

export const TYPE_MANIFESTATIONS = [
  'PEC ETRANGER EN INDIVIDUELLE',
  'PEC ETRANGER EN GROUPE',
  'MEDIS INTERNATIONAL MEETING',
  'SUBVENTION ET CADEAUX',
  'AUTRES_MKT',
  'AUTRES',
];

export const FALLBACK_PRODUCTS = [
  'ATOR', 'IPPROTON', 'ESORAL', 'AMOXIL', 'AUGMENTIN',
  'AZITHROMYCINE', 'CEFIXIME', 'OMEPRAZOLE', 'PARACETAMOL',
  'RANITIDINE', 'METFORMINE', 'IBUPROFENE', 'LEVOTHYROX',
  'CLOPIDOGREL', 'DOMPERIDONE', 'FLUCONAZOLE',
];

export const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// ── Utilitaires ───────────────────────────────────────────

export function generateId() {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function generateMonths(startMonth, endMonth) {
  const months = [];
  if (!startMonth || !endMonth) return months;
  const [startYear, startM] = startMonth.split('-').map(Number);
  const [endYear, endM] = endMonth.split('-').map(Number);
  let cY = startYear;
  let cM = startM;
  while (cY < endYear || (cY === endYear && cM <= endM)) {
    months.push(`${cY}-${String(cM).padStart(2, '0')}`);
    cM++;
    if (cM > 12) { cM = 1; cY++; }
  }
  return months;
}

export function formatMonth(ym) {
  const [year, month] = ym.split('-');
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
}

export function getTableKey(pharmacyId, productName) {
  return `${pharmacyId}|${productName}`;
}

export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + m - 1 + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}
