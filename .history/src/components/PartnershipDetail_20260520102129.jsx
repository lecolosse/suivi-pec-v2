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
    clearTimeout(timer.current); 
    setSaving(true);
    timer.current = setTimeout(async () => {
      try { 
        await api.updateQuantity(partnership.id, { pharmacyName: phName, productName: pName, month, quantity: qty }); 
      } catch (e) { 
        console.error(e); 
      } finally { 
        setSaving(false); 
      }
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
    <div className="space-y-6 pb-10">
      {/* Hide number input spinners globally for this component */}
      <style>{`input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; } input[type=number] { -moz-appearance: textfield; }`}</style>

      {/* Header bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{partnership.reference}</h2>
            {saving && (
              <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                Sauvegarde...
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Créé le {new Date(partnership.createdAt).toLocaleDateString('fr-FR')}
            {partnership.createdByName && <> par <span className="font-semibold text-slate-700">{partnership.createdByName}</span></>}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onBack} className="border border-slate-300 bg-white rounded-xl px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm">
            ← Retour
          </button>
          {canDelete && (
            <button onClick={() => setShowDel(true)} className="border border-red-200 bg-white rounded-xl px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition shadow-sm">
              🗑 Supprimer
            </button>
          )}
        </div>
      </div>

      {/* Delete modal */}
      {showDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDel(false)}>
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4 border border-slate-200" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl mb-4">⚠️</div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-slate-500 mb-8">Vous êtes sur le point de supprimer définitivement le partenariat <b className="text-slate-800">{partnership.reference}</b>. Cette action est irréversible.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDel(false)} className="border border-slate-300 rounded-xl px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Annuler</button>
              <button onClick={() => onDelete(partnership.id)} className="bg-red-600 rounded-xl px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition shadow-sm">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* NOUVEAU : Info grid - Dashboard Ergonomic Style */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {infos.map(x => (
          <div key={x.l} className="relative bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
            {/* Barre de couleur animée au survol */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-sm">{x.i}</span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{x.l}</span>
            </div>
            
            <p className="text-sm font-bold text-slate-900 truncate pl-1" title={x.v}>
              {x.v}
            </p>
          </div>
        ))}
      </div>

      {/* Products & pharmacies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">💊 Produits ({products.length})</p>
          <div className="flex flex-wrap gap-2">
            {products.length > 0 ? products.map(p => (
              <span key={p.id} className="text-sm font-medium px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-100">{p.name}</span>
            )) : <span className="text-sm text-slate-400 italic">Aucun produit</span>}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">🏥 Pharmacies ({pharmacies.length})</p>
          <div className="flex flex-wrap gap-2">
            {pharmacies.length > 0 ? pharmacies.map(ph => (
              <span key={ph.id} className="text-sm font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">{ph.name}</span>
            )) : <span className="text-sm text-slate-400 italic">Aucune pharmacie</span>}
          </div>
        </div>
      </div>

      {!canEdit && (
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 font-medium flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          Mode lecture seule — consultation uniquement
        </div>
      )}

      {/* TABLE */}
      {months.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center text-amber-800 font-medium flex flex-col items-center gap-2">
          <span className="text-3xl">⚠️</span>
          Période invalide ou non définie
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">📊 Tableau de Suivi</h3>
              <p className="text-sm text-slate-500 mt-0.5">{formatMonth(months[0])} → {formatMonth(months[months.length - 1])} <span className="text-slate-400">•</span> {months.length} mois</p>
            </div>
            <div className="text-sm font-bold text-white bg-indigo-600 px-3 py-1.5 rounded-lg shadow-sm">
              {gT()} boîtes
            </div>
          </div>
          
          <div className="overflow-auto" style={{ maxHeight: '65vh' }}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider sticky left-0 z-30 bg-slate-100 border-b border-r border-slate-200 min-w-[160px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Pharmacie</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider sticky left-[160px] z-20 bg-slate-100 border-b border-slate-200 min-w-[120px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Produit</th>
                  {months.map(m => <th key={m} className="px-2 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 min-w-[85px] whitespace-nowrap bg-slate-100">{formatMonth(m)}</th>)}
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 bg-slate-100 min-w-[70px] sticky right-0 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">Total</th>
                </tr>
              </thead>
              <tbody>
                {pharmacies.map((ph, phi) => {
                  const isEven = phi % 2 === 0;
                  const bgBase = isEven ? 'bg-white' : 'bg-slate-50/40';
                  
                  return (
                    <Fragment key={ph.id}>
                      {products.map((pr, pri) => {
                        const t = pT(ph.id, pr.name);
                        const isFirst = pri === 0;
                        
                        return (
                          <tr key={ph.id + pr.id} className={`${bgBase} hover:bg-indigo-50/40 group transition-colors`}>
                            <td className={`px-4 py-2 font-semibold text-slate-800 align-middle sticky left-0 z-10 border-r border-slate-200 ${bgBase} group-hover:bg-indigo-50/40 transition-colors ${isFirst ? 'border-t-2 border-t-slate-300' : ''}`}>
                              {isFirst && <span className="text-sm">{ph.name}</span>}
                            </td>
                            <td className={`px-4 py-2 sticky left-[160px] z-5 border-r border-slate-200 ${bgBase} group-hover:bg-indigo-50/40 transition-colors ${isFirst ? 'border-t-2 border-t-slate-300' : ''}`}>
                              <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-violet-50 text-violet-700 border border-violet-100">{pr.name}</span>
                            </td>
                            {months.map(m => (
                              <td key={m} className={`px-1 py-1 text-center border-b border-slate-100 ${isFirst ? 'border-t-2 border-t-slate-300' : ''}`}>
                                {canEdit ? (
                                  <input
                                    type="number" min="0"
                                    value={val(ph.id, pr.name, m) || ''}
                                    onChange={e => upd(ph.id, phName(ph.id), pr.name, m, e.target.value)}
                                    placeholder="0"
                                    className="w-full text-center text-sm py-1.5 bg-transparent border border-transparent rounded-md focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                  />
                                ) : (
                                  <span className="text-sm text-slate-600">{val(ph.id, pr.name, m) || '-'}</span>
                                )}
                              </td>
                            ))}
                            <td className={`px-4 py-2 text-center text-sm font-bold border-b border-slate-100 sticky right-0 z-10 ${bgBase} group-hover:bg-indigo-50/40 ${isFirst ? 'border-t-2 border-t-slate-300' : ''} ${t > 0 ? 'text-indigo-700 bg-indigo-50/50 group-hover:bg-indigo-50/80' : 'text-slate-300'}`}>
                              {t || ''}
                            </td>
                          </tr>
                        );
                      })}
                      
                      {/* Pharmacy subtotal */}
                      <tr className="bg-indigo-50/60">
                        <td className="px-4 py-2.5 sticky left-0 z-10 border-r border-slate-200 bg-indigo-50/60"></td>
                        <td className="px-4 py-2.5 text-xs font-extrabold text-indigo-900 uppercase tracking-wider sticky left-[160px] z-5 border-r border-slate-200 bg-indigo-50/60">
                          Σ {ph.name.length > 14 ? ph.name.substring(0, 14) + '…' : ph.name}
                        </td>
                        {months.map(m => <td key={m} className="px-2 py-2.5 text-center text-xs font-bold text-indigo-800 border-b border-indigo-100">{pmT(ph.id, m) || ''}</td>)}
                        <td className="px-4 py-2.5 text-center text-sm font-extrabold text-indigo-900 bg-indigo-100/80 border-b border-indigo-200 sticky right-0 z-10">
                          {pgT(ph.id) || ''}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
                
                {/* Grand total */}
                <tr className="bg-slate-800 text-white">
                  <td className="px-4 py-4 text-xs font-extrabold uppercase tracking-widest sticky left-0 z-20 bg-slate-800 border-r border-slate-700" colSpan={2}>Total Général</td>
                  {months.map(m => <td key={m} className="px-2 py-4 text-center text-xs font-extrabold bg-slate-800 border-b border-slate-700">{mT(m) || ''}</td>)}
                  <td className="px-4 py-4 text-center text-base font-extrabold bg-slate-900 border-b border-slate-700 sticky right-0 z-20">{gT() || ''}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}