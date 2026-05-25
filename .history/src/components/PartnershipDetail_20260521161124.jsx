import { Fragment, useState, useRef, useCallback } from 'react';
import { generateMonths, formatMonth } from '../types';
import { api } from '../api';

export default function PartnershipDetail({ partnership, onUpdate, onDelete, onBack, userRole }) {
  var [showDel, setShowDel] = useState(false);
  var [saving, setSaving] = useState(false);
  var timer = useRef(undefined);

  var endPeriod = partnership.followUpEndMonth || partnership.endMonth;
  var months = generateMonths(partnership.startMonth, endPeriod);
  var products = partnership.products;
  var pharmacies = partnership.pharmacies;
  var canEdit = userRole === 'admin' || userRole === 'dm';
  var canDelete = userRole === 'admin';
  var budget = partnership.budget || 0;
  var potential = partnership.potentialPharmacies || 0;
  var isAdmin = userRole === 'admin';
  var isDm = userRole === 'dm';
  var isSup = userRole === 'sup';
  var canSeeSynth = isAdmin || isSup;

  var activeMonth = partnership.currentActiveMonth || '';
  var monthStatus = partnership.monthStatus || {};
  var manualClose = partnership.manualClose || {};

  function getEditableMonths() {
    var r = {};
    for (var i = 0; i < months.length; i++) {
      var m = months[i];
      var s = monthStatus[m] || 'inactive';
      r[m] = { status: s, editable: isAdmin || (s === 'active' && isDm) };
    }
    return r;
  }
  var editableMonths = getEditableMonths();

  // Admin : configurer un mois
  async function configMonth(month, status, mc) {
    try {
      await api.configureMonth(partnership.id, month, status, mc);
      refresh();
    } catch (e) { console.error(e); }
  }

  async function closeMonth(month) {
    try { await api.closeMonth(partnership.id, month); refresh(); } catch (e) { console.error(e); }
  }

  async function refresh() { try { var p = await api.getPartenariat(partnership.id); onUpdate(p); } catch (e) { console.error(e); } }

  function cell(phId, pName, month) { var k = phId + '|' + pName; return (partnership.tableData[k] && partnership.tableData[k][month]) || 0; }

  var upd = useCallback(function(phId, phName, pName, month, raw) {
    if (!canEdit) return;
    var em = editableMonths[month]; if (!em || !em.editable) return;
    var qty = parseInt(raw) || 0;
    var k = phId + '|' + pName;
    var nd = JSON.parse(JSON.stringify(partnership.tableData));
    if (!nd[k]) nd[k] = {}; nd[k][month] = qty;
    onUpdate(Object.assign({}, partnership, { tableData: nd }));
    clearTimeout(timer.current); setSaving(true);
    timer.current = setTimeout(async function() { try { await api.updateQuantity(partnership.id, { pharmacyName: phName, productName: pName, month: month, quantity: qty }); } catch (e) { console.error(e); } finally { setSaving(false); } }, 500);
  }, [partnership, onUpdate, canEdit, editableMonths]);

  function pt(ph, pn) { return months.reduce(function(s, m) { return s + cell(ph, pn, m); }, 0); }
  function pmt(ph, m) { return products.reduce(function(s, p) { return s + cell(ph, p.name, m); }, 0); }
  function pgt(ph) { return months.reduce(function(s, m) { return s + pmt(ph, m); }, 0); }
  function mt(m) { return pharmacies.reduce(function(s, ph) { return s + pmt(ph.id, m); }, 0); }
  function gt() { return months.reduce(function(s, m) { return s + mt(m); }, 0); }
  function phN(id) { var p = pharmacies.find(function(x) { return x.id === id; }); return p ? p.name : id; }

  function tpm(pn, m) { return pharmacies.reduce(function(s, ph) { return s + cell(ph.id, pn, m); }, 0); }
  function tpmt(pn) { return months.reduce(function(s, m) { return s + tpm(pn, m); }, 0); }
  function tmg(m) { return products.reduce(function(s, pr) { return s + tpm(pr.name, m); }, 0); }
  function tgt() { return products.reduce(function(s, pr) { return s + tpmt(pr.name); }, 0); }

  function prescript(pn, m) { if (potential === 0) return 0; var t = tpm(pn, m); if (t === 0) return 0; return Math.round(((t / potential) * 100) * 100) / 100; }
  function psT(pn) { return months.reduce(function(s, m) { return s + prescript(pn, m); }, 0); }
  function psM(m) { return products.reduce(function(s, pr) { return s + prescript(pr.name, m); }, 0); }
  function psG() { return products.reduce(function(s, pr) { return s + psT(pr.name); }, 0); }

  function moyenneMensuelle(pn) { if (potential === 0) return 0; var nz = months.filter(function(m) { return prescript(pn, m) > 0; }); if (nz.length === 0) return 0; return Math.round((nz.reduce(function(s, m) { return s + prescript(pn, m); }, 0) / nz.length) * 100) / 100; }
  function atteinteObjectif(pn) { var b = products.find(function(p) { return p.name === pn; })?.boxes || 0; if (b === 0) return 0; var mm = moyenneMensuelle(pn); if (mm === 0) return 0; return Math.round((mm / b) * 10000) / 100; }

  function thStyle(extra) { return Object.assign({ border: '1px solid rgba(99,102,241,.4)', color: 'rgba(255,255,255,.9)', fontWeight: 600, padding: '10px 6px', textAlign: 'center', fontSize: 10, whiteSpace: 'nowrap', minWidth: 75 }, extra || {}); }

  return (
    <div className="space-y-4">

      {/* HEADER */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
        <table style={{ width: '100%', border: 'none' }}><tbody><tr>
          <td style={{ width: '100%', padding: 0, border: 'none', verticalAlign: 'middle' }}>
            <h2 className="text-lg font-bold text-slate-900">{partnership.reference}</h2>
            <p className="text-xs text-slate-400" style={{ marginTop: 2 }}>
              {new Date(partnership.createdAt).toLocaleDateString('fr-FR')}
              {partnership.createdByName && <span> par <b style={{ color: '#475569' }}>{partnership.createdByName}</b></span>}
              {saving && <span style={{ color: '#d97706', marginLeft: 8 }}>⏳ Sauvegarde...</span>}
            </p>
          </td>
          <td style={{ padding: 0, border: 'none', whiteSpace: 'nowrap' }}>
            <button onClick={onBack} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', cursor: 'pointer' }}>← Retour</button>
            {canDelete && <button onClick={function() { setShowDel(true); }} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', cursor: 'pointer', marginLeft: 8 }}>🗑 Supprimer</button>}
          </td>
        </tr></tbody></table>
      </div>

      {showDel && (
        <div className="backdrop" onClick={function() { setShowDel(false); }}>
          <div className="bg-white rounded-xl p-6 shadow-xl" style={{ maxWidth: 400, width: '90%' }} onClick={function(e) { e.stopPropagation(); }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Supprimer ?</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Supprimer <b>{partnership.reference}</b> ?</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={function() { setShowDel(false); }} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', cursor: 'pointer' }}>Annuler</button>
              <button onClick={function() { onDelete(partnership.id); }} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* INFO GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[{ l: 'Référence', v: partnership.reference, i: '📄' }, { l: 'Type', v: partnership.typeManifestation, i: '🏷️' }, { l: 'Prospect', v: partnership.prospect || '—', i: '👤' }, { l: 'Créé par', v: partnership.createdByName || '—', i: '✍️' }, { l: 'Période', v: months.length > 0 ? formatMonth(months[0]) + ' → ' + formatMonth(months[months.length - 1]) : '—', i: '📅' }, { l: 'Superviseur', v: partnership.supervisor || '—', i: '👨‍💼' }, { l: 'Délégué(e)s', v: partnership.delegates || '—', i: '👥' }, { l: 'Budget', v: partnership.budget ? partnership.budget.toLocaleString('fr-FR') + ' TND' : '—', i: '💰' }].map(function(x) { return <div key={x.l} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}><p style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{x.i} {x.l}</p><p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.v}>{x.v}</p></div>; })}
      </div>

      {/* PRODUITS + PHARMACIES */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}><p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>📦 Produits ({products.length})</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{products.map(function(p) { return <span key={p.id} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{p.name} <span style={{ color: '#a855f7', fontWeight: 500 }}>({p.boxes} boîtes)</span></span>; })}</div></div>
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}><p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>🏥 Pharmacies ({pharmacies.length})</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{pharmacies.map(function(ph) { return <span key={ph.id} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4' }}>{ph.name}</span>; })}</div></div>
      </div>

      {/* ═══════════ CONFIG MOIS (ADMIN UNIQUEMENT) ═══════════ */}
      {isAdmin && months.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>⚙️ Configuration des mois</h3>
          <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
            ⬤ Sélectionnez le mois de saisie · 🔘 Clôture manuelle (pas de clôture automatique)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {months.map(function(m) {
              var s = monthStatus[m] || 'inactive';
              var mc = manualClose[m] || false;
              var isActive = s === 'active';
              var isClosed = s === 'closed';
              return (
                <div key={'cfg-' + m} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 8,
                  background: isActive ? '#dcfce7' : isClosed ? '#f1f5f9' : '#fff',
                  border: '1px solid ' + (isActive ? '#86efac' : isClosed ? '#e2e8f0' : '#e2e8f0')
                }}>
                  {/* ⬤ Radio : sélectionner le mois actif */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                    <input
                      type="radio"
                      name="activeMonth"
                      checked={isActive}
                      onChange={function() { configMonth(m, 'active', mc); }}
                      style={{ accentColor: '#16a34a', width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 600, fontSize: 13, color: isActive ? '#16a34a' : isClosed ? '#94a3b8' : '#475569' }}>
                      {formatMonth(m)}
                    </span>
                    {isActive && <span style={{ fontSize: 10, background: '#16a34a', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>ACTIF</span>}
                    {isClosed && <span style={{ fontSize: 10, background: '#e2e8f0', color: '#64748b', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>CLÔTURÉ</span>}
                  </label>

                  {/* 🔘 Switch : clôture manuelle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Manuel</span>
                    <div
                      onClick={function() { configMonth(m, s, !mc); }}
                      style={{
                        width: 40, height: 22, borderRadius: 11,
                        background: mc ? '#16a34a' : '#cbd5e1',
                        position: 'relative', cursor: 'pointer',
                        transition: 'background .2s'
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 2, left: mc ? 20 : 2,
                        width: 18, height: 18, borderRadius: '50%',
                        background: '#fff', transition: 'left .2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,.2)'
                      }} />
                    </div>
                  </label>

                  {/* Bouton clôturer (admin peut clôturer n'importe quand le mois actif) */}
                  {isActive && (
                    <button onClick={function() { closeMonth(m); }} style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 6, border: '1px solid #f59e0b', background: '#fef3c7', color: '#b45309', cursor: 'pointer', flexShrink: 0 }}>
                      Clôturer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MESSAGE DM */}
      {isDm && activeMonth && (
        <div className="flex items-center justify-between" style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 12, padding: '10px 16px', fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: '#16a34a' }}>📝 Mois de saisie : <b>{formatMonth(activeMonth)}</b></span>
          <button onClick={function() { closeMonth(activeMonth); }} style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6, border: '1px solid #f59e0b', background: '#fef3c7', color: '#b45309', cursor: 'pointer' }}>Clôturer ce mois</button>
        </div>
      )}
      {isDm && !activeMonth && <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#64748b' }}>⏳ Aucun mois ouvert pour la saisie</div>}
      {isSup && <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: '#1d4ed8' }}>🔒 Consultation uniquement</div>}

      {/* TABLEAU DE SUIVI */}
      {months.length === 0 ? <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 12, padding: 20, textAlign: 'center', fontWeight: 600, color: '#854d0e', fontSize: 13 }}>⚠️ Période invalide</div> : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}><div><h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>📊 Tableau de Suivi</h3><p style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{formatMonth(months[0])} → {formatMonth(months[months.length - 1])} · {months.length} mois</p></div></div>
          <div style={{ overflow: 'auto', maxHeight: '45vh' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead><tr style={{ background: '#4f46e5' }}>
                <th style={thStyle({ textAlign: 'left', position: 'sticky', left: 0, zIndex: 20, background: '#4f46e5', minWidth: 120 })}>Pharmacie</th>
                <th style={thStyle({ textAlign: 'left', position: 'sticky', left: 120, zIndex: 15, background: '#4f46e5', minWidth: 90 })}>Produit</th>
                {months.map(function(m) { var s = monthStatus[m] || 'inactive'; return <th key={m} style={thStyle({ background: s === 'active' ? '#16a34a' : s === 'closed' ? '#94a3b8' : '#4f46e5' })}>{formatMonth(m)}{s === 'active' ? ' ●' : s === 'closed' ? ' 🔒' : ''}</th>; })}
                <th style={thStyle({ background: '#4338ca', color: '#fff', minWidth: 50 })}>Σ</th>
              </tr></thead>
              <tbody>
                {pharmacies.map(function(ph, phi) { var rs = products.length + 1; var bg = phi % 2 === 0 ? '#fff' : '#f8fafc'; return <Fragment key={ph.id}>
                  {products.map(function(prd, pri) { var t = pt(ph.id, prd.name); return <tr key={ph.id + '-' + prd.id} style={{ background: bg }}>
                    {pri === 0 && <td rowSpan={rs} style={{ position: 'sticky', left: 0, zIndex: 10, background: bg, padding: '10px 10px', fontWeight: 700, color: '#1e293b', verticalAlign: 'top', border: '1px solid #e2e8f0', fontSize: 12 }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span>🏥</span><span style={{ lineHeight: 1.3 }}>{ph.name}</span></div></td>}
                    <td style={{ position: 'sticky', left: 120, zIndex: 5, background: bg, padding: '6px 8px', border: '1px solid #e2e8f0' }}><span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#faf5ff', color: '#7e22ce' }}>{prd.name}</span></td>
                    {months.map(function(mo) { var v = cell(ph.id, prd.name, mo); var em = editableMonths[mo]; var editable = em ? em.editable : false; var mbg = (monthStatus[mo] || 'inactive') === 'active' ? '#f0fdf4' : '#fff'; return <td key={mo} style={{ border: '1px solid #e2e8f0', padding: 0, textAlign: 'center', background: mbg }}>{editable ? <input type="number" min="0" value={v || ''} onChange={function(e) { upd(ph.id, phN(ph.id), prd.name, mo, e.target.value); }} placeholder="0" style={{ width: '100%', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: 12, padding: '6px 2px', boxSizing: 'border-box' }} /> : <span style={{ fontSize: 12, color: '#94a3b8', padding: '6px 2px', display: 'block' }}>{v || ''}</span>}</td>; })}
                    <td style={{ border: '1px solid #e2e8f0', padding: '6px', textAlign: 'center', fontWeight: 700, fontSize: 12, color: t > 0 ? '#4f46e5' : '#cbd5e1', background: '#eef2ff' }}>{t || ''}</td>
                  </tr>; })}
                  <tr style={{ background: '#eef2ff' }}><td style={{ position: 'sticky', left: 120, zIndex: 5, background: '#eef2ff', padding: '6px 8px', fontWeight: 700, fontSize: 11, color: '#3730a3', border: '1px solid #e2e8f0' }}>Σ {ph.name.length > 22 ? ph.name.substring(0, 22) + '…' : ph.name}</td>{months.map(function(m) { return <td key={m} style={{ border: '1px solid #e2e8f0', padding: '6px', textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#312e81' }}>{pmt(ph.id, m) || ''}</td>; })}<td style={{ background: '#e0e7ff', border: '1px solid #e2e8f0', padding: '6px', textAlign: 'center', fontWeight: 800, fontSize: 11, color: '#312e81' }}>{pgt(ph.id) || ''}</td></tr>
                </Fragment>; })}
                <tr style={{ background: '#e2e8f0' }}><td colSpan="2" style={{ position: 'sticky', left: 0, zIndex: 10, background: '#e2e8f0', padding: '8px 12px', fontWeight: 700, fontSize: 11, color: '#475569', border: '1px solid #cbd5e1' }}>📅 Total par mois</td>{months.map(function(m) { return <td key={'tm-' + m} style={{ border: '1px solid #cbd5e1', padding: '8px 6px', textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#475569' }}>{mt(m) || ''}</td>; })}<td style={{ background: '#cbd5e1', border: '1px solid #cbd5e1', padding: '8px 6px', textAlign: 'center', fontWeight: 800, fontSize: 11, color: '#475569' }}>{gt() || ''}</td></tr>
                <tr style={{ background: '#4f46e5' }}><td colSpan="2" style={{ position: 'sticky', left: 0, zIndex: 10, background: '#4f46e5', color: '#fff', fontWeight: 800, fontSize: 11, padding: '10px 12px', border: '1px solid rgba(99,102,241,.4)' }}>📊 Total Général</td>{months.map(function(m) { return <td key={'gt-' + m} style={{ border: '1px solid rgba(99,102,241,.4)', color: '#fff', fontWeight: 800, fontSize: 12, padding: '10px 6px', textAlign: 'center' }}>{mt(m) || ''}</td>; })}<td style={{ background: '#4338ca', color: '#fff', fontWeight: 800, fontSize: 13, padding: '10px 8px', textAlign: 'center', border: '1px solid rgba(99,102,241,.4)' }}>{gt() || ''}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TOTAL PRODUITS PAR MOIS */}
      {months.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: '#faf5ff', borderBottom: '1px solid #e9d5ff' }}><h3 style={{ fontSize: 14, fontWeight: 700, color: '#7e22ce' }}>📦 Total des Produits par Mois</h3></div>
          <div style={{ overflow: 'auto', maxHeight: '35vh' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead><tr style={{ background: '#9333ea' }}><th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#9333ea', color: '#fff', fontWeight: 600, padding: '10px 12px', textAlign: 'left', minWidth: 120, border: '1px solid #a855f7', fontSize: 11 }}>Produit</th>{months.map(function(m) { return <th key={'tp-' + m} style={{ background: '#9333ea', color: '#fff', fontWeight: 600, padding: '10px 6px', textAlign: 'center', minWidth: 75, border: '1px solid #a855f7', fontSize: 10, whiteSpace: 'nowrap' }}>{formatMonth(m)}</th>; })}<th style={{ background: '#7e22ce', color: '#fff', fontWeight: 700, padding: '10px 8px', textAlign: 'center', minWidth: 50, border: '1px solid #a855f7' }}>Σ</th></tr></thead>
              <tbody>
                {products.map(function(prod, pri) { var bg = pri % 2 === 0 ? '#fff' : '#f8fafc'; return <tr key={'tpr-' + prod.id} style={{ background: bg }}><td style={{ position: 'sticky', left: 0, zIndex: 5, background: bg, padding: '10px 12px', fontWeight: 600, fontSize: 12, color: '#1e293b', border: '1px solid #e2e8f0' }}>{prod.name}</td>{months.map(function(mo) { var v = tpm(prod.name, mo); return <td key={'tp-' + prod.id + '-' + mo} style={{ border: '1px solid #e2e8f0', padding: '8px 6px', textAlign: 'center', background: bg, fontWeight: 500, fontSize: 12, color: v > 0 ? '#7e22ce' : '#94a3b8' }}>{v || ''}</td>; })}<td style={{ border: '1px solid #e2e8f0', padding: '8px 6px', textAlign: 'center', fontWeight: 700, fontSize: 12, color: tpmt(prod.name) > 0 ? '#7e22ce' : '#cbd5e1', background: '#faf5ff' }}>{tpmt(prod.name) || ''}</td></tr>; })}
                <tr style={{ background: '#e9d5ff' }}><td style={{ position: 'sticky', left: 0, zIndex: 5, background: '#e9d5ff', padding: '8px 12px', fontWeight: 700, fontSize: 11, color: '#7e22ce', border: '1px solid #d8b4fe' }}>📅 Total par mois</td>{months.map(function(m) { return <td key={'tpt-' + m} style={{ border: '1px solid #d8b4fe', padding: '8px 6px', textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#7e22ce' }}>{tmg(m) || ''}</td>; })}<td style={{ background: '#d8b4fe', border: '1px solid #d8b4fe', padding: '8px 6px', textAlign: 'center', fontWeight: 800, fontSize: 11, color: '#7e22ce' }}>{tgt() || ''}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRESCRIPTIONS RÉELLES */}
      {months.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: '#f0fdfa', borderBottom: '1px solid #ccfbf1' }}><h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f766e' }}>💊 Prescriptions Réelles</h3><p style={{ fontSize: 11, color: '#5eead4', marginTop: 2 }}>{potential}% · Total/Mois / Potentiel × 100</p></div>
          <div style={{ overflow: 'auto', maxHeight: '35vh' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead><tr style={{ background: '#0d9488' }}><th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#0d9488', color: '#fff', fontWeight: 600, padding: '10px 12px', textAlign: 'left', minWidth: 120, border: '1px solid #0f766e', fontSize: 11 }}>Produit</th>{months.map(function(m) { return <th key={'pr' + m} style={{ background: '#0d9488', color: '#fff', fontWeight: 600, padding: '10px 6px', textAlign: 'center', minWidth: 75, border: '1px solid #0f766e', fontSize: 10, whiteSpace: 'nowrap' }}>{formatMonth(m)}</th>; })}<th style={{ background: '#0f766e', color: '#fff', fontWeight: 700, padding: '10px 8px', textAlign: 'center', minWidth: 50, border: '1px solid #0f766e' }}>Σ</th></tr></thead>
              <tbody>
                {products.map(function(prod, pri) { var bg = pri % 2 === 0 ? '#fff' : '#f8fafc'; return <tr key={'prr-' + prod.id} style={{ background: bg }}><td style={{ position: 'sticky', left: 0, zIndex: 5, background: bg, padding: '10px 12px', fontWeight: 600, fontSize: 12, color: '#1e293b', border: '1px solid #e2e8f0' }}>{prod.name}</td>{months.map(function(mo) { var v = prescript(prod.name, mo); return <td key={'prr-' + prod.id + '-' + mo} style={{ border: '1px solid #e2e8f0', padding: '8px 6px', textAlign: 'center', background: bg, fontWeight: 500, fontSize: 12, color: v > 0 ? '#0f766e' : '#94a3b8' }}>{v > 0 ? v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>; })}<td style={{ border: '1px solid #e2e8f0', padding: '8px 6px', textAlign: 'center', fontWeight: 700, fontSize: 12, color: psT(prod.name) > 0 ? '#0f766e' : '#cbd5e1', background: '#f0fdfa' }}>{psT(prod.name) > 0 ? psT(prod.name).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td></tr>; })}
                <tr style={{ background: '#ccfbf1' }}><td style={{ position: 'sticky', left: 0, zIndex: 5, background: '#ccfbf1', padding: '8px 12px', fontWeight: 700, fontSize: 11, color: '#0f766e', border: '1px solid #99f6e4' }}>📅 Total par mois</td>{months.map(function(m) { return <td key={'prtm-' + m} style={{ border: '1px solid #99f6e4', padding: '8px 6px', textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#0f766e' }}>{psM(m) > 0 ? psM(m).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>; })}<td style={{ border: '1px solid #99f6e4', padding: '8px 6px', textAlign: 'center', fontWeight: 800, fontSize: 11, color: '#0f766e', background: '#99f6e4' }}>{psG() > 0 ? psG().toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SYNTHESE - admin + sup */}
      {months.length > 0 && canSeeSynth && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: '#fef3c7', borderBottom: '1px solid #fde68a' }}><h3 style={{ fontSize: 14, fontWeight: 700, color: '#b45309' }}>📈 Synthèse</h3></div>
          <div style={{ overflow: 'auto', maxHeight: '30vh' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead><tr style={{ background: '#d97706' }}><th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#d97706', color: '#fff', fontWeight: 600, padding: '10px 12px', textAlign: 'left', minWidth: 150, border: '1px solid #b45309', fontSize: 11 }}>Produit</th><th style={{ background: '#d97706', color: '#fff', fontWeight: 600, padding: '10px 12px', textAlign: 'center', width: 100, border: '1px solid #b45309', fontSize: 11 }}>Boîtes</th><th style={{ background: '#d97706', color: '#fff', fontWeight: 600, padding: '10px 12px', textAlign: 'center', width: 180, border: '1px solid #b45309', fontSize: 11 }}>Moy. Mensuelle</th><th style={{ background: '#b45309', color: '#fff', fontWeight: 700, padding: '10px 12px', textAlign: 'right', width: 100, border: '1px solid #b45309', fontSize: 11 }}>% Objectif</th></tr></thead>
              <tbody>
                {products.map(function(prod, pri) { var bg = pri % 2 === 0 ? '#fff' : '#f8fafc'; var mm = moyenneMensuelle(prod.name); var ao = atteinteObjectif(prod.name); return <tr key={'synth-' + prod.id} style={{ background: bg }}><td style={{ position: 'sticky', left: 0, zIndex: 5, background: bg, padding: '10px 12px', fontWeight: 600, fontSize: 12, color: '#1e293b', border: '1px solid #e2e8f0' }}>{prod.name}</td><td style={{ border: '1px solid #e2e8f0', padding: '8px 12px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: '#475569' }}>{prod.boxes || 0}</td><td style={{ border: '1px solid #e2e8f0', padding: '8px 12px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: mm > 0 ? '#b45309' : '#94a3b8' }}>{mm > 0 ? mm.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td><td style={{ border: '1px solid #e2e8f0', padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: ao >= 100 ? '#16a34a' : ao > 0 ? '#d97706' : '#94a3b8', background: ao >= 100 ? '#f0fdf4' : bg }}>{ao > 0 ? ao.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %' : ''}</td></tr>; })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
