import { useCallback, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { formatMonth, generateMonths, getTableKey } from '../types';

const colors = {
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  text: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  indigo: '#4f46e5',
  indigoDark: '#4338ca',
  indigoLight: '#eef2ff',
  red: '#dc2626',
  teal: '#0f766e',
  tealLight: '#f0fdfa',
  purple: '#7e22ce',
  purpleLight: '#faf5ff',
  amber: '#d97706',
  amberLight: '#fffbeb',
};

function Button({ children, onClick, variant = 'secondary' }) {
  const danger = variant === 'danger';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: '#fff',
        color: danger ? colors.red : '#334155',
        border: `1px solid ${danger ? '#fecaca' : colors.border}`,
        borderRadius: 10,
        padding: '9px 14px',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function InfoCell({ label, value, accent }) {
  return (
    <div style={{ padding: '12px 14px', border: `1px solid ${colors.borderLight}`, borderRadius: 12, background: '#fff', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: accent || colors.indigo }} />
        <span style={{ fontSize: 11, color: colors.faint, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
      </div>
      <div title={String(value || '')} style={{ color: colors.text, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value || '—'}
      </div>
    </div>
  );
}

function Chip({ children, tone = 'indigo' }) {
  const palette = {
    indigo: [colors.indigoLight, colors.indigo],
    teal: [colors.tealLight, colors.teal],
    purple: [colors.purpleLight, colors.purple],
    amber: [colors.amberLight, colors.amber],
  }[tone];

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 999, background: palette[0], color: palette[1], fontSize: 11, fontWeight: 800 }}>
      {children}
    </span>
  );
}

export default function PartnershipDetail({ partnership, onUpdate, onDelete, onBack, userRole }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activePharmacyId, setActivePharmacyId] = useState('all');
  const saveTimer = useRef(undefined);

  const canEdit = userRole === 'admin' || userRole === 'dm';
  const canDelete = userRole === 'admin';
  const endPeriod = partnership.followUpEndMonth || partnership.endMonth;
  const months = useMemo(() => generateMonths(partnership.startMonth, endPeriod), [partnership.startMonth, endPeriod]);
  const products = partnership.products || [];
  const pharmacies = partnership.pharmacies || [];
  const visiblePharmacies = activePharmacyId === 'all' ? pharmacies : pharmacies.filter((pharmacy) => pharmacy.id === activePharmacyId);

  function getValue(pharmacyId, productName, month) {
    const key = getTableKey(pharmacyId, productName);
    return partnership.tableData[key]?.[month] || 0;
  }

  const updateValue = useCallback((pharmacyId, pharmacyName, productName, month, raw) => {
    if (!canEdit) return;
    const quantity = parseInt(raw, 10) || 0;
    const key = getTableKey(pharmacyId, productName);
    const tableData = { ...partnership.tableData, [key]: { ...(partnership.tableData[key] || {}) } };
    tableData[key][month] = quantity;
    onUpdate({ ...partnership, tableData });

    clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        await api.updateQuantity(partnership.id, { pharmacyName, productName, month, quantity });
      } catch (error) {
        console.error('Save failed:', error);
      } finally {
        setSaving(false);
      }
    }, 450);
  }, [canEdit, onUpdate, partnership]);

  function productTotal(pharmacyId, productName) {
    return months.reduce((sum, month) => sum + getValue(pharmacyId, productName, month), 0);
  }

  function pharmacyMonthTotal(pharmacyId, month) {
    return products.reduce((sum, product) => sum + getValue(pharmacyId, product.name, month), 0);
  }

  function pharmacyTotal(pharmacyId) {
    return months.reduce((sum, month) => sum + pharmacyMonthTotal(pharmacyId, month), 0);
  }

  function monthTotal(month) {
    return pharmacies.reduce((sum, pharmacy) => sum + pharmacyMonthTotal(pharmacy.id, month), 0);
  }

  function grandTotal() {
    return months.reduce((sum, month) => sum + monthTotal(month), 0);
  }

  const summaryItems = [
    { label: 'Référence', value: partnership.reference, accent: colors.indigo },
    { label: 'Prospect', value: partnership.prospect, accent: colors.teal },
    { label: 'Créé par', value: partnership.createdByName, accent: colors.purple },
    { label: 'Type', value: partnership.typeManifestation, accent: colors.indigo },
    { label: 'Début', value: partnership.startMonth ? formatMonth(partnership.startMonth) : '—', accent: colors.teal },
    { label: 'Échéance', value: partnership.endMonth ? formatMonth(partnership.endMonth) : '—', accent: colors.amber },
    { label: 'Fin suivi', value: partnership.followUpEndMonth ? formatMonth(partnership.followUpEndMonth) : '—', accent: colors.amber },
    { label: 'Budget', value: partnership.budget ? `${partnership.budget.toLocaleString('fr-FR')} TND` : '—', accent: colors.amber },
    { label: 'Superviseur', value: partnership.supervisor, accent: colors.indigo },
    { label: 'Délégué(e)s', value: partnership.delegates, accent: colors.purple },
  ];

  const inputStyle = { width: '100%', minWidth: 58, textAlign: 'center', border: '1px solid transparent', background: 'transparent', outline: 'none', padding: '6px 4px', borderRadius: 8, fontSize: 13, fontWeight: 700, color: colors.text };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', borderBottom: `1px solid ${colors.borderLight}` }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: colors.text }}>{partnership.reference}</h2>
              <Chip tone={canEdit ? 'indigo' : 'amber'}>{canEdit ? 'Modification active' : 'Lecture seule'}</Chip>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: colors.muted }}>
              Créé le {new Date(partnership.createdAt).toLocaleDateString('fr-FR')}
              {partnership.createdByName ? <span> par <strong>{partnership.createdByName}</strong></span> : null}
              {saving ? <span style={{ color: colors.amber, marginLeft: 10, fontWeight: 700 }}>Sauvegarde...</span> : null}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button onClick={onBack}>Retour</Button>
            {canDelete ? <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>Supprimer</Button> : null}
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
            {summaryItems.map((item) => <InfoCell key={item.label} {...item} />)}
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><strong>Produits</strong><Chip tone="purple">{products.length}</Chip></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{products.map((product) => <Chip key={product.id} tone="purple">{product.name} · {product.boxes}</Chip>)}</div>
        </div>
        <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><strong>Pharmacies</strong><Chip tone="teal">{pharmacies.length}</Chip></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{pharmacies.map((pharmacy) => <Chip key={pharmacy.id} tone="teal">{pharmacy.name}</Chip>)}</div>
        </div>
      </section>

      <section style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: `1px solid ${colors.border}`, background: colors.indigoLight }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: colors.text }}>Tableau de suivi des quantités</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.muted }}>{months.length ? `${formatMonth(months[0])} → ${formatMonth(months[months.length - 1])}` : 'Période invalide'} · {months.length} mois</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Chip tone="indigo">Total: {grandTotal()} boîtes</Chip><Chip tone="teal">{pharmacies.length} pharmacies</Chip><Chip tone="purple">{products.length} produits</Chip></div>
        </div>

        {!canEdit ? <div style={{ padding: '12px 18px', background: '#eff6ff', color: colors.indigoDark, fontSize: 13, fontWeight: 700, borderBottom: `1px solid ${colors.border}` }}>Mode lecture seule. Vous pouvez consulter les tableaux sans modifier les quantités.</div> : null}

        {months.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: colors.amber, fontWeight: 700 }}>Période invalide.</div>
        ) : (
          <div style={{ padding: 16, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              <button type="button" onClick={() => setActivePharmacyId('all')} style={filterButtonStyle(activePharmacyId === 'all', colors.indigo)}>Toutes les pharmacies</button>
              {pharmacies.map((pharmacy) => <button key={pharmacy.id} type="button" onClick={() => setActivePharmacyId(pharmacy.id)} style={filterButtonStyle(activePharmacyId === pharmacy.id, colors.teal)}>{pharmacy.name} · {pharmacyTotal(pharmacy.id)}</button>)}
            </div>

            {visiblePharmacies.map((pharmacy) => (
              <div key={pharmacy.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: colors.tealLight, borderBottom: `1px solid ${colors.border}` }}>
                  <div><strong>{pharmacy.name}</strong><div style={{ color: colors.muted, fontSize: 12 }}>Total pharmacie: {pharmacyTotal(pharmacy.id)} boîtes</div></div>
                  <Chip tone="teal">{products.length} produits</Chip>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: Math.max(620, months.length * 82 + 210) }}>
                    <thead><tr><th style={headLeftStyle}>Produit</th>{months.map((month) => <th key={month} style={headStyle}>{formatMonth(month)}</th>)}<th style={{ ...headStyle, background: colors.indigoDark }}>Total</th></tr></thead>
                    <tbody>
                      {products.map((product, index) => {
                        const rowBg = index % 2 === 0 ? '#fff' : '#f8fafc';
                        return <tr key={product.id} style={{ background: rowBg }}><td style={productCellStyle}><span style={{ color: colors.purple, fontWeight: 800 }}>{product.name}</span></td>{months.map((month) => <td key={month} style={cellStyle}>{canEdit ? <input type="number" min="0" value={getValue(pharmacy.id, product.name, month) || ''} onChange={(event) => updateValue(pharmacy.id, pharmacy.name, product.name, month, event.target.value)} placeholder="0" style={inputStyle} onFocus={(event) => { event.currentTarget.style.background = colors.indigoLight; event.currentTarget.style.borderColor = '#c7d2fe'; }} onBlur={(event) => { event.currentTarget.style.background = 'transparent'; event.currentTarget.style.borderColor = 'transparent'; }} /> : <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>{getValue(pharmacy.id, product.name, month) || ''}</span>}</td>)}<td style={totalCellStyle}>{productTotal(pharmacy.id, product.name) || ''}</td></tr>;
                      })}
                      <tr style={{ background: colors.indigoLight }}><td style={{ ...productCellStyle, color: colors.indigoDark, fontWeight: 900 }}>Total mois</td>{months.map((month) => <td key={month} style={subtotalCellStyle}>{pharmacyMonthTotal(pharmacy.id, month) || ''}</td>)}<td style={{ ...subtotalCellStyle, background: '#e0e7ff', fontWeight: 900 }}>{pharmacyTotal(pharmacy.id) || ''}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <div style={{ border: `1px solid ${colors.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', background: colors.indigo, color: '#fff', fontWeight: 900 }}>Synthèse générale</div>
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: Math.max(620, months.length * 82 + 210) }}><thead><tr><th style={headLeftStyle}>Indicateur</th>{months.map((month) => <th key={month} style={headStyle}>{formatMonth(month)}</th>)}<th style={{ ...headStyle, background: colors.indigoDark }}>Total</th></tr></thead><tbody><tr><td style={productCellStyle}>Toutes pharmacies</td>{months.map((month) => <td key={month} style={subtotalCellStyle}>{monthTotal(month) || ''}</td>)}<td style={{ ...totalCellStyle, background: colors.indigoLight }}>{grandTotal() || ''}</td></tr></tbody></table></div>
            </div>
          </div>
        )}
      </section>

      {showDeleteConfirm ? <div className="backdrop" onClick={() => setShowDeleteConfirm(false)}><div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 420 }} onClick={(event) => event.stopPropagation()}><h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: colors.text }}>Confirmer la suppression</h3><p style={{ color: colors.muted, fontSize: 14 }}>Supprimer le partenariat <strong>{partnership.reference}</strong> ?</p><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><Button onClick={() => setShowDeleteConfirm(false)}>Annuler</Button><Button variant="danger" onClick={() => onDelete(partnership.id)}>Supprimer</Button></div></div></div> : null}
    </div>
  );
}

function filterButtonStyle(active, color) {
  return { whiteSpace: 'nowrap', border: `1px solid ${active ? color : colors.border}`, background: active ? color : '#fff', color: active ? '#fff' : colors.muted, borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 800 };
}

const headStyle = { background: colors.indigo, color: 'rgba(255,255,255,.95)', padding: '11px 8px', border: '1px solid rgba(255,255,255,.16)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', whiteSpace: 'nowrap', textAlign: 'center' };
const headLeftStyle = { ...headStyle, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2, minWidth: 170 };
const productCellStyle = { position: 'sticky', left: 0, background: 'inherit', zIndex: 1, padding: '10px 12px', border: `1px solid ${colors.border}`, minWidth: 170, fontSize: 13, color: colors.text, fontWeight: 800 };
const cellStyle = { padding: '4px 5px', border: `1px solid ${colors.border}`, textAlign: 'center', minWidth: 82 };
const totalCellStyle = { ...cellStyle, color: colors.indigoDark, background: '#f8fafc', fontWeight: 900, fontSize: 13 };
const subtotalCellStyle = { ...cellStyle, color: colors.indigoDark, fontWeight: 900, fontSize: 13 };