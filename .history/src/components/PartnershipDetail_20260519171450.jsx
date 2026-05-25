import { Fragment, useState, useRef, useCallback } from 'react';
import { generateMonths, formatMonth, getTableKey } from '../types';
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

  function val(phId, pName, month) {
    var k = getTableKey(phId, pName);
    return (partnership.tableData[k] && partnership.tableData[k][month]) || 0;
  }

  var upd = useCallback(function(phId, phName, pName, month, raw) {
    if (!canEdit) return;
    var qty = parseInt(raw) || 0;
    var k = getTableKey(phId, pName);
    var nd = JSON.parse(JSON.stringify(partnership.tableData));
    if (!nd[k]) nd[k] = {};
    nd[k][month] = qty;
    onUpdate(Object.assign({}, partnership, { tableData: nd }));
    clearTimeout(timer.current);
    setSaving(true);
    timer.current = setTimeout(async function() {
      try { await api.updateQuantity(partnership.id, { pharmacyName: phName, productName: pName, month: month, quantity: qty }); }
      catch(e) { console.error(e); }
      finally { setSaving(false); }
    }, 500);
  }, [partnership, onUpdate, canEdit]);

  function pT(ph,pn){return months.reduce(function(s,m){return s+val(ph,pn,m);},0);}
  function pmT(ph,m){return products.reduce(function(s,p){return s+val(ph,p.name,m);},0);}
  function pgT(ph){return months.reduce(function(s,m){return s+pmT(ph,m);},0);}
  function mT(m){return pharmacies.reduce(function(s,ph){return s+pmT(ph.id,m);},0);}
  function gT(){return months.reduce(function(s,m){return s+mT(m);},0);}
  function phN(id){var p=pharmacies.find(function(x){return x.id===id;});return p?p.name:id;}

  // Row data for info display
  var rows = [
    [{l:'Référence',v:partnership.reference},{l:'Type',v:partnership.typeManifestation},{l:'Créé par',v:partnership.createdByName||'—'}],
    [{l:'Prospect',v:partnership.prospect||'—'},{l:'Superviseur',v:partnership.supervisor||'—'},{l:'Délégué(e)s',v:partnership.delegates||'—'}],
    [{l:'Début',v:partnership.startMonth?formatMonth(partnership.startMonth):'—'},{l:'Échéance',v:partnership.endMonth?formatMonth(partnership.endMonth):'—'},{l:'Fin Suivi',v:partnership.followUpEndMonth?formatMonth(partnership.followUpEndMonth):'—'}],
    [{l:'Budget',v:partnership.budget?partnership.budget.toLocaleString('fr-FR')+' TND':'—'},{l:'Potentiel',v:partnership.potentialPharmacies?partnership.potentialPharmacies+'%':'—'},{l:'Manifestation',v:partnership.manifestation||'—'}],
  ];

  return (
    <div className="space-y-4">
      {/* HEADER BAR */}
      <div className="bg-white rounded-xl border flex items-center justify-between" style={{borderColor:'#e2e8f0',padding:'12px 20px'}}>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{partnership.reference}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Créé le {new Date(partnership.createdAt).toLocaleDateString('fr-FR')}
            {partnership.createdByName && <span> par <b style={{color:'#475569'}}>{partnership.createdByName}</b></span>}
            {saving && <span style={{color:'#d97706',marginLeft:8}}>⏳ Sauvegarde...</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} style={{padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:500,border:'1px solid #cbd5e1',background:'#fff',color:'#475569',cursor:'pointer'}}>← Retour</button>
          {canDelete && <button onClick={function(){setShowDel(true);}} style={{padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:500,border:'1px solid #fca5a5',background:'#fff',color:'#dc2626',cursor:'pointer'}}>🗑 Supprimer</button>}
        </div>
      </div>

      {/* DELETE MODAL */}
      {showDel && (
        <div className="backdrop" onClick={function(){setShowDel(false);}}>
          <div className="bg-white rounded-xl p-6 shadow-xl" style={{maxWidth:400,width:'90%'}} onClick={function(e){e.stopPropagation();}}>
            <h3 className="text-base font-bold text-slate-900 mb-2">Supprimer ?</h3>
            <p className="text-sm text-slate-500 mb-6">Supprimer <b>{partnership.reference}</b> ?</p>
            <div className="flex justify-end gap-2">
              <button onClick={function(){setShowDel(false);}} style={{padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:500,border:'1px solid #cbd5e1',background:'#fff',color:'#475569',cursor:'pointer'}}>Annuler</button>
              <button onClick={function(){onDelete(partnership.id);}} style={{padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:500,background:'#dc2626',color:'#fff',border:'none',cursor:'pointer'}}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* INFO TABLE - organized in rows/columns */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{borderColor:'#e2e8f0'}}>
        <table style={{border:'none',width:'100%'}}>
          <tbody>
            {rows.map(function(row, ri) {
              return (
                <tr key={ri} style={{background: ri%2===0?'#fff':'#f8fafc'}}>
                  {row.map(function(cell, ci) {
                    return (
                      <Fragment key={ci}>
                        <td style={{padding:'8px 12px',fontSize:11,fontWeight:600,color:'#94a3b8',whiteSpace:'nowrap',borderRight:'1px solid #f1f5f9',width:120,borderBottom:ri===rows.length-1?'none':'1px solid #f1f5f9',textTransform:'uppercase',letterSpacing:'.03em'}}>{cell.l}</td>
                        <td style={{padding:'8px 12px',fontSize:13,fontWeight:600,color:'#1e293b',borderRight:ci<2?'none':'none',borderBottom:ri===rows.length-1?'none':'1px solid #f1f5f9',width:ri===0?'auto':'auto',borderRightWidth:ci<2?1:0,borderRightStyle:ci<2?'solid':'none',borderRightColor:'#f1f5f9'}}>{cell.v}</td>
                      </Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* PRODUCTS & PHARMACIES side by side */}
      <div className="grid grid-2 gap-4">
        <div className="bg-white rounded-xl border p-4" style={{borderColor:'#e2e8f0'}}>
          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Produits ({products.length})</p>
          <div className="flex flex-wrap gap-1">
            {products.map(function(p){return <span key={p.id} className="text-xs font-medium rounded px-2 py-1" style={{background:'#faf5ff',color:'#7e22ce',border:'1px solid #e9d5ff'}}>{p.name}</span>;})}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4" style={{borderColor:'#e2e8f0'}}>
          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Pharmacies ({pharmacies.length})</p>
          <div className="flex flex-wrap gap-1">
            {pharmacies.map(function(ph){return <span key={ph.id} className="text-xs font-medium rounded px-2 py-1" style={{background:'#f0fdfa',color:'#0f766e',border:'1px solid #99f6e4'}}>{ph.name}</span>;})}
          </div>
        </div>
      </div>

      {!canEdit && <div className="rounded-lg px-4 py-3 text-sm font-medium" style={{background:'#eff6ff',border:'1px solid #bfdbfe',color:'#1d4ed8'}}>🔒 Lecture seule</div>}

      {/* TABLE */}
      {months.length===0?(
        <div className="rounded-lg px-4 py-6 text-center font-medium" style={{background:'#fefce8',border:'1px solid #fde68a',color:'#854d0e'}}>⚠️ Période invalide</div>
      ):(
        <div className="bg-white rounded-xl border overflow-hidden" style={{borderColor:'#e2e8f0'}}>
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-3" style={{borderBottom:'1px solid #e2e8f0',background:'#f8fafc'}}>
            <div>
              <h3 className="text-sm font-bold text-slate-900">📊 Tableau de Suivi</h3>
              <p className="text-xs text-slate-400">{formatMonth(months[0])} → {formatMonth(months[months.length-1])} · {months.length} mois</p>
            </div>
            <div className="text-xs text-slate-400"><b style={{color:'#4f46e5'}}>{gT()}</b> boîtes total</div>
          </div>

          {/* Scrollable table */}
          <div className="overflow-auto" style={{maxHeight:'65vh'}}>
            <table style={{borderCollapse:'collapse',width:'100%'}}>
              <thead>
                <tr style={{background:'#4f46e5'}}>
                  <th style={{position:'sticky',left:0,zIndex:20,background:'#4f46e5',color:'rgba(255,255,255,.9)',fontSize:11,fontWeight:600,padding:'10px 12px',textAlign:'left',whiteSpace:'nowrap',minWidth:130,border:'1px solid rgba(99,102,241,.4)',letterSpacing:'.04em',textTransform:'uppercase'}}>Pharmacie</th>
                  <th style={{position:'sticky',left:130,zIndex:15,background:'#4f46e5',color:'rgba(255,255,255,.9)',fontSize:11,fontWeight:600,padding:'10px 12px',textAlign:'left',whiteSpace:'nowrap',minWidth:100,border:'1px solid rgba(99,102,241,.4)',letterSpacing:'.04em',textTransform:'uppercase'}}>Produit</th>
                  {months.map(function(m){return <th key={m} style={{color:'rgba(255,255,255,.9)',fontSize:11,fontWeight:600,padding:'10px 6px',textAlign:'center',whiteSpace:'nowrap',minWidth:78,border:'1px solid rgba(99,102,241,.4)',letterSpacing:'.03em',textTransform:'uppercase'}}>{formatMonth(m)}</th>;})}
                  <th style={{background:'#4338ca',color:'#fff',fontSize:11,fontWeight:700,padding:'10px 10px',textAlign:'center',minWidth:55,border:'1px solid rgba(99,102,241,.4)'}}>Σ</th>
                </tr>
              </thead>
              <tbody>
                {pharmacies.map(function(ph,phi){
                  var rs=products.length+1;
                  var bg=phi%2===0?'#fff':'#f8fafc';
                  return (
                    <Fragment key={ph.id}>
                      {products.map(function(pr,pri){
                        var t=pT(ph.id,pr.name);
                        return (
                          <tr key={ph.id+'-'+pr.id} style={{background:bg}} onMouseEnter={function(e){e.currentTarget.style.background='#eef2ff';}} onMouseLeave={function(e){e.currentTarget.style.background=bg;}}>
                            {pri===0&&(
                              <td rowSpan={rs} style={{position:'sticky',left:0,zIndex:10,background:bg,padding:'8px 10px',fontSize:12,fontWeight:700,color:'#1e293b',verticalAlign:'top',border:'1px solid #e2e8f0',borderBottom:pri===products.length-1?'1px solid #e2e8;0':'1px solid #e2e8f0'}}>
                                <span style={{fontSize:13}}>🏥</span> <span>{ph.name}</span>
                              </td>
                            )}
                            <td style={{position:'sticky',left:130,zIndex:5,background:bg,padding:'6px 8px',border:'1px solid #e2e8f0'}}>
                              <span style={{fontSize:11,fontWeight:600,padding:'2px 6px',borderRadius:4,background:'#faf5ff',color:'#7e22ce'}}>{pr.name}</span>
                            </td>
                            {months.map(function(month){
                              return (
                                <td key={month} style={{border:'1px solid #e2e8f0',padding:'2px 3px',textAlign:'center',background:bg}}>
                                  {canEdit?(
                                    <input type="number" min="0" value={val(ph.id,pr.name,month)||''} onChange={function(e){upd(ph.id,phN(ph.id),pr.name,month,e.target.value);}} placeholder="0" style={{width:'100%',textAlign:'center',border:'none',background:'transparent',outline:'none',fontSize:12,padding:'4px 0',borderRadius:4}} />
                                  ):(
                                    <span style={{fontSize:12,color:'#475569'}}>{val(ph.id,pr.name,month)||''}</span>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{border:'1px solid #e2e8f0',padding:'6px 8px',textAlign:'center',fontSize:12,fontWeight:700,color:t>0?'#4f46e5':'#cbd5e1',background:'#eef2ff'}}>{t||''}</td>
                          </tr>
                        );
                      })}
                      {/* Subtotal row */}
                      <tr style={{background:'#eef2ff'}}>
                        <td style={{position:'sticky',left:130,zIndex:5,background:'#eef2ff',padding:'6px 8px',fontSize:11,fontWeight:700,color:'#3730a3',border:'1px solid #e2e8f0'}}>Σ {ph.name.length>20?ph.name.substring(0,20)+'…':ph.name}</td>
                        {months.map(function(m){return <td key={m} style={{border:'1px solid #e2e8f0',padding:'6px 6px',textAlign:'center',fontSize:11,fontWeight:700,color:'#312e81'}}>{pmT(ph.id,m)||''}</td>;})}
                        <td style={{border:'1px solid #e2e8f0',padding:'6px 6px',textAlign:'center',fontSize:11,fontWeight:800,color:'#312e81',background:'#e0e7ff'}}>{pgT(ph.id)||''}</td>
                      </tr>
                    </Fragment>
                  );
                })}
                {/* GRAND TOTAL */}
                <tr style={{background:'#4f46e5'}}>
                  <td colSpan={2} style={{position:'sticky',left:0,zIndex:10,background:'#4f46e5',color:'#fff',fontSize:11,fontWeight:800,padding:'10px 12px',textTransform:'uppercase',letterSpacing:'.06em',border:'1px solid rgba(99,102,241,.4)'}}>📊 Total Général</td>
                  {months.map(function(m){return <td key={m} style={{border:'1px solid rgba(99,102,241,.4)',color:'#fff',fontSize:12,fontWeight:800,padding:'10px 6px',textAlign:'center'}}>{mT(m)||''}</td>;})}
                  <td style={{background:'#4338ca',color:'#fff',fontSize:13,fontWeight:800,padding:'10px 8px',textAlign:'center',border:'1px solid rgba(99,102,241,.4)' as any}>{gT()||''}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Table footer */}
          <div className="flex flex-wrap gap-5 px-5 py-3 bg-slate-50" style={{borderTop:'1px solid #e2e2e8',fontSize:12,color:'#64748b'}}>
            <span>Total : <b style={{color:'#4f46e5'}}>{gT()} boîtes</b></span>
            <span>Pharmacies : <b>{pharmacies.length}</b></span>
            <span>Produits : <b>{products.length}</b></span>
            <span>Mois : <b>{months.length}</b></span>
          </div>
        </div>
      )}
    </div>
  );
}
