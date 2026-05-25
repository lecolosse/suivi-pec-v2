import { Fragment, useState, useRef, useCallback } from 'react';
import { generateMonths, formatMonth, getTableKey } from '../types';
import { api } from '../api';

export default function PartnershipDetail({ partnership, onUpdate, onDelete, onBack, userRole }) {
  const [showDel, setShowDel] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef(undefined);

  const endPeriod = partnership.followUpEndMonth || partnership.endMonth;
  const months = generateMonths(partnership.startMonth, endPeriod);
  const { products, pharmacies } = partnership;
  const canEdit = userRole === 'admin' || userRole === 'dm';
  const canDelete = userRole === 'admin';

  function val(phId, pName, month) {
    const k = getTableKey(phId, pName);
    return (partnership.tableData[k] && partnership.tableData[k][month]) || 0;
  }

  const upd = useCallback((phId, phName, pName, month, raw) => {
    if (!canEdit) return;
    const qty = parseInt(raw) || 0;
    const k = getTableKey(phId, pName);
    const nd = { ...partnership.tableData };
    nd[k] = { ...(nd[k] || {}) };
    nd[k][month] = qty;
    onUpdate({ ...partnership, tableData: nd });
    clearTimeout(timer.current); setSaving(true);
    timer.current = setTimeout(async () => {
      try { await api.updateQuantity(partnership.id, { pharmacyName: phName, productName: pName, month, quantity: qty }); }
      catch (e) { console.error(e); } finally { setSaving(false); }
    }, 500);
  }, [partnership, onUpdate, canEdit]);

  function pT(ph, pn) { return months.reduce((s, m) => s + val(ph, pn, m), 0); }
  function pmT(ph, m) { return products.reduce((s, p) => s + val(ph, p.name, m), 0); }
  function pgT(ph) { return months.reduce((s, m) => s + pmT(ph, m), 0); }
  function mT(m) { return pharmacies.reduce((s, ph) => s + pmT(ph.id, m), 0); }
  function gT() { return months.reduce((s, m) => s + mT(m), 0); }
  function phName(id) { return pharmacies.find(p => p.id === id)?.name || id; }

  const infos = [
    { l: 'Référence', v: partnership.reference, i: '📄' },
    { l: 'Type', v: partnership.typeManifestation, i: '🏷️' },
    { l: 'Manifestation', v: partnership.manifestation || '—', i: '🎪' },
    { l: 'Prospect', v: partnership.prospect || '—', i: '👤' },
    { l: 'Créé par', v: partnership.createdByName || '—', i: '✍️' },
    { l: 'Superviseur', v: partnership.supervisor || '—', i: '👨‍💼' },
    { l: 'Délégué(e)s', v: partnership.delegates || '—', i: '👥' },
    { l: 'Début', v: partnership.startMonth ? formatMonth(partnership.startMonth) : '—', i: '📅' },
    { l: 'Échéance', v: partnership.endMonth ? formatMonth(partnership.endMonth) : '—', i: '📆' },
    { l: 'Fin Suivi', v: partnership.followUpEndMonth ? formatMonth(partnership.followUpEndMonth) : '—', i: '🏁' },
    { l: 'Budget', v: partnership.budget ? `${partnership.budget.toLocaleString('fr-FR')} TND` : '—', i: '💰' },
    { l: 'Potentiel', v: partnership.potentialPharmacies ? `${partnership.potentialPharmacies}%` : '—', i: '📊' },
  ];

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{partnership.reference}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Créé le {new Date(partnership.createdAt).toLocaleDateString('fr-FR')}
            {partnership.createdByName && <> par <b className="text-slate-600">{partnership.createdByName}</b></>}
            {saving && <span className="ml-2 text-amber-600 animate-pulse">⏳ Sauvegarde...</span>}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onBack} className="border border-slate-300 bg-white rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">← Retour</button>
          {canDelete && <button onClick={() => setShowDel(true)} className="border border-red-300 bg-white rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition">🗑 Supprimer</button>}
        </div>
      </div>

      {/* Delete modal */}
      {showDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowDel(false)}>
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 mb-2">Supprimer ?</h3>
            <p className="text-sm text-slate-500 mb-6">Supprimer <b>{partnership.reference}</b> ?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDel(false)} className="border border-slate-300 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuler</button>
              <button onClick={() => onDelete(partnership.id)} className="bg-red-600 rounded-lg px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {infos.map(x => (
          <div key={x.l} className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="text-[10px] font-medium text-slate-400 uppercase mb-0.5">{x.i} {x.l}</p>
            <p className="text-xs font-semibold text-slate-800 truncate" title={x.v}>{x.v}</p>
          </div>
        ))}
      </div>

      {/* Products & pharmacies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Produits ({products.length})</p>
          <div className="flex flex-wrap gap-1">{products.map(p => <span key={p.id} className="text-[11px] font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100">{p.name}</span>)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Pharmacies ({pharmacies.length})</p>
          <div className="flex flex-wrap gap-1">{pharmacies.map(ph => <span key={ph.id} className="text-[11px] font-medium px-2 py-0.5 rounded bg-teal-50 text-teal-600 border border-teal-100">{ph.name}</span>)}</div>
        </div>
      </div>

      {!canEdit && <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700 font-medium">🔒 Lecture seule — consultation uniquement</div>}

      {/* TABLE */}
      {months.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-yellow-800 font-medium">⚠️ Période invalide</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">📊 Tableau de Suivi</h3>
              <p className="text-xs text-slate-400">{formatMonth(months[0])} → {formatMonth(months[months.length - 1])} · {months.length} mois</p>
            </div>
            <div className="text-xs text-slate-400">{gT()} boîtes total</div>
          </div>
          <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
            <table className="border-collapse min-w-full text-sm">
              <thead>
                <tr className="bg-indigo-600 text-white text-xs">
                  <th className="border border-indigo-500/50 px-3 py-2 text-left font-semibold sticky left-0 z-20 bg-indigo-600 min-w-[140px]">Pharmacie</th>
                  <th className="border border-indigo-500/50 px-3 py-2 text-left font-semibold min-w-[110px]" style={{ position: 'sticky', left: 140, zIndex: 15, backgroundColor: '#4f46e5' }}>Produit</th>
                  {months.map(m => <th key={m} className="border border-indigo-500/50 px-2 py-2 text-center font-semibold min-w-[80px] whitespace-nowrap">{formatMonth(m)}</th>)}
                  <th className="border border-indigo-500/50 px-3 py-2 text-center font-semibold bg-indigo-700 min-w-[60px]">Σ</th>
                </tr>
              </thead>
              <tbody>
                {pharmacies.map((ph, phi) => {
                  const rs = products.length + 1;
                  const bg = phi % 2 === 0 ? '#fff' : '#f8fafc';
                  return (
                    <Fragment key={ph.id}>
                      {products.map((pr, pri) => {
                        const t = pT(ph.id, pr.name);
                        return (
                          <tr key={ph.id + pr.id} className="hover:bg-indigo-50/50">
                            {pri === 0 && (
                              <td rowSpan={rs} className="border border-slate-200 px-3 py-2 font-semibold text-slate-800 align-top bg-white sticky left-0 z-10" style={{ backgroundColor: bg }}>
                                <span className="text-xs">🏥</span> <span className="text-xs">{ph.name}</span>
                              </td>
                            )}
                            <td className="border border-slate-200 px-2 py-1.5" style={{ position: 'sticky', left: 140, zIndex: 5, backgroundColor: bg }}>
                              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">{pr.name}</span>
                            </td>
                            {months.map(m => (
                              <td key={m} className="border border-slate-200 px-1 py-1 text-center" style={{ backgroundColor: bg }}>
                                {canEdit ? (
                                  <input
                                    type="number" min="0"
                                    value={val(ph.id, pr.name, m) || ''}
                                    onChange={e => upd(ph.id, phName(ph.id), pr.name, m, e.target.value)}
                                    placeholder="0"
                                    className="w-full text-center border-0 bg-transparent outline-none text-xs py-0.5 focus:bg-indigo-50 rounded"
                                  />
                                ) : (
                                  <span className="text-xs text-slate-600">{val(ph.id, pr.name, m) || ''}</span>
                                )}
                              </td>
                            ))}
                            <td className={`border border-slate-200 px-2 py-1 text-center text-xs font-bold ${t > 0 ? 'text-indigo-700 bg-indigo-50' : 'text-slate-300'}`}>{t || ''}</td>
                          </tr>
                        );
                      })}
                      {/* Pharmacy subtotal */}
                      <tr className="bg-indigo-50/70">
                        <td className="border border-slate-200 px-2 py-1.5 text-xs font-bold text-indigo-800" style={{ position: 'sticky', left: 140, zIndex: 5, backgroundColor: '#eef2ff' }}>
                          Σ {ph.name.length > 16 ? ph.name.substring(0, 16) + '…' : ph.name}
                        </td>
                        {months.map(m => <td key={m} className="border border-slate-200 px-2 py-1.5 text-center text-xs font-bold text-indigo-800">{pmT(ph.id, m) || ''}</td>)}
                        <td className="border border-slate-200 px-2 py-1.5 text-center text-xs font-extrabold text-indigo-900 bg-indigo-100">{pgT(ph.id) || ''}</td>
                      </tr>
                    </Fragment>
                  );
                })}
                {/* Grand total */}
                <tr className="bg-indigo-600 text-white">
                  <td className="border border-indigo-500/50 px-3 py-2 text-xs font-extrabold uppercase sticky left-0 z-10 bg-indigo-600" colSpan={2}>Total Général</td>
                  {months.map(m => <td key={m} className="border border-indigo-500/50 px-2 py-2 text-center text-xs font-extrabold">{mT(m) || ''}</td>)}
                  <td className="border border-indigo-500/50 px-3 py-2 text-center text-sm font-extrabold bg-indigo-700">{gT() || ''}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
