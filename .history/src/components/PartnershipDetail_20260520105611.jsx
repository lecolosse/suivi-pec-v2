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
    var k = phId + '|' + pName;
    return (partnership.tableData[k] && partnership.tableData[k][month]) || 0;
  }

  var upd = useCallback(function(phId, phName, pName, month, raw) {
    if (!canEdit) return;
    var qty = parseInt(raw) || 0;
    var k = phId + '|' + pName;
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

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="bg-white rounded-xl border d-flex" style={{borderColor:'#e2e8f0',padding:'16px 20px'}}>
        <table style={{width:'100%',border:'none'}}><tbody><tr>
          <td style={{width:'100%',padding:0,border:'none',verticalAlign:'middle'}}>
            <h2 className="text-lg font-bold text-slate-900">{partnership.reference}</h2>
            <p className="text-xs text-slate-400" style={{marginTop:2}}>
              {new Date(partnership.createdAt).toLocaleDateString('fr-FR')}
              {partnership.createdByName && <span> par <b style={{color:'#475569'}}>{partnership.createdByName}</b></span>}
              {saving && <span style={{color:'#d97706',marginLeft:8}}>⏳ Sauvegarde...</span>}
            </p>
          </td>
          <td style={{padding:0,border:'none',whiteSpace:'nowrap'}}>
            <button onClick={onBack} style={{padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:500,border:'1px solid #cbd5e1',background:'#fff',color:'#475569',cursor:'pointer'}}>← Retour</button>
            {canDelete && <button onClick={function(){setShowDel(true);}} style={{padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:500,border:'1px solid #fca5a5',background:'#fff',color:'#dc2626',cursor:'pointer',marginLeft:8}}>🗑 Supprimer</button>}
          </td>
        </tr></tbody></table>
      </div>

      {/* DELETE MODAL */}
      {showDel && (
        <div className="backdrop" onClick={function(){setShowDel(false);}}>
          <div className="bg-white rounded-xl p-6 shadow-xl" style={{maxWidth:400,width:'90%'}} onClick={function(e){e.stopPropagation();}}>
            <h3 style={{fontSize:16,fontWeight:700,color:'#1e293b',marginBottom:8}}>Supprimer ?</h3>
            <p style={{fontSize:13,color:'#64748b',marginBottom:24}}>Supprimer <b>{partnership.reference}</b> ?</p>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <button onClick={function(){setShowDel(false);}} style={{padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:500,border:'1px solid #cbd5e1',background:'#fff',color:'#475569',cursor:'pointer'}}>Annuler</button>
              <button onClick={function(){onDelete(partnership.id);}} style={{padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:500,background:'#dc2626',color:'#fff',border:'none',cursor:'pointer'}}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* INFO : 4 colonnes, 2 lignes */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {[
          {l:'Référence',v:partnership.reference,i:'📄'},
          {l:'Type',v:partnership.typeManifestation,i:'🏷️'},
          {l:'Prospect',v:partnership.prospect||'—',i:'👤'},
          {l:'Créé par',v:partnership.createdByName||'—',i:'✍️'},
          {l:'Période',v:months.length>0?formatMonth(months[0])+' → '+formatMonth(months[months.length-1]):'—',i:'📅'},
          {l:'Superviseur',v:partnership.supervisor||'—',i:'👨‍💼'},
          {l:'Délégué(e)s',v:partnership.delegates||'—',i:'👥'},
          {l:'Budget',v:partnership.budget?partnership.budget.toLocaleString('fr-FR')+' TND':'—',i:'💰'},
        ].map(function(x){
          return <div key={x.l} style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',padding:'14px 16px'}}>
            <p style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>{x.i} {x.l}</p>
            <p style={{fontSize:13,fontWeight:600,color:'#1e293b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={x.v}>{x.v}</p>
          </div>;
        })}
      </div>

      {/* Produits & Pharmacies inline */}
      <div style={{display:'flex',gap:12}}>
        <div style={{flex:1,background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',padding:'14px 16px'}}>
          <p style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:8}}>📦 Produits ({products.length})</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {products.map(function(p){return <span key={p.id} style={{fontSize:11,fontWeight:600,padding:'3px 8px',borderRadius:6,background:'#faf5ff',color:'#7e22ce',border:'1px solid #e9d5ff'}}>{p.name}</span>;})}
          </div>
        </div>
        <div style={{flex:1,background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',padding:'14px 16px'}}>
          <p style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:8}}>🏥 Pharmacies ({pharmacies.length})</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {pharmacies.map(function(ph){return <span key={ph.id} style={{fontSize:11,fontWeight:600,padding:'3px 8px',borderRadius:6,background:'#f0fdfa',color:'#0f766e',border:'1px solid #99f6e4'}}>{ph.name}</span>;})}
          </div>
        </div>
      </div>

      {!canEdit && <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:12,padding:'12px 16px',fontSize:13,fontWeight:500,color:'#1d4ed8'}}>🔒 Lecture seule - consultation uniquement</div>}

      {/* TABLE */}
      {months.length===0?(
        <div style={{background:'#fefce8',border:'1px solid #fde68a',borderRadius:12,padding:'20px',textAlign:'center',fontWeight:600,color:'#854d0e',fontSize:13}}>⚠️ Période invalide</div>
      ):(
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden'}}>
          {/* Table top bar */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
            <div>
              <h3 style={{fontSize:14,fontWeight:700,color:'#1e293b'}}>📊 Tableau de Suivi</h3>
              <p style={{fontSize:12,color:'#94a3b8',marginTop:1}}>{formatMonth(months[0])} → {formatMonth(months[months.length-1])} · {months.length} mois</p>
            </div>
            <div style={{fontSize:12,color:'#94a3b8'}}>
              <button onClick={function(){
                var csv = "Pharmacie;Produit";
                for(var i=0;i<months.length;i++) csv += ";"+formatMonth(months[i]);
                csv += ";Total\n";
                for(var i=0;i<pharmacies.length;i++){
                  for(var j=0;j<products.length;j++){
                    csv += pharmacies[i].name + ";" + products[j].name;
                    for(var k=0;k<months.length;k++) csv += ";"+(val(pharmacies[i].id,products[j].name,months[k])||"");
                    csv += ";"+pT(pharmacies[i].id,products[j].name)+"\n";
                  }
                }
                var blob = new Blob(["\uFEFF"+csv],{type:'text/csv;charset=utf-8;'});
                var a = document.createElement('a');a.href=URL.createObjectURL(blob);a.download='partenariat_'+partnership.reference.replace(/[\/\s]/g,'_')+'.csv';a.click();
              }} style={{padding:'6px 12px',borderRadius:6,fontSize:12,fontWeight:600,border:'1px solid #cbd5e1',background:'#fff',color:'#4f46e5',cursor:'pointer'}}>📥 CSV</button>
            </div>
          </div>

          {/* Table */}
          <div style={{overflow:'auto',maxHeight:'65vh'}}>
            <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
              <thead>
                <tr style={{background:'#4f46e5'}}>
                  <th style={{position:'sticky',left:0,zIndex:20,background:'#4f46e5',color:'rgba(255,255,255,.9)',fontWeight:600,padding:'10px 12px',textAlign:'left',whiteSpace:'nowrap',minWidth:120,border:'1px solid rgba(99,102,241,.4)',fontSize:11}}>Pharmacie</th>
                  <th style={{position:'sticky',left:120,zIndex:15,background:'#4f46e5',color:'rgba(255,255,255,.9)',fontWeight:600,padding:'10px 12px',textAlign:'left',whiteSpace:'nowrap',minWidth:90,border:'1px solid rgba(99,102,241,.4)',fontSize:11}}>Produit</th>
                  {months.map(function(m){return <th key={m} style={{color:'rgba(255,255,255,.9)',fontWeight:600,padding:'10px 6px',textAlign:'center',whiteSpace:'nowrap',minWidth:75,border:'1px solid rgba(99,102,241,.4)',fontSize:10}}>{formatMonth(m)}</th>;})}
                  <th style={{background:'#4338ca',color:'#fff',fontWeight:700,padding:'10px 8px',textAlign:'center',minWidth:50,border:'1px solid rgba(99,102,241,.4)'}}>Σ</th>
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
                          <tr key={ph.id+'-'+pr.id} style={{background:bg}}>
                            {pri===0&&(
                              <td rowSpan={rs} style={{position:'sticky',left:0,zIndex:10,background:bg,padding:'10px 10px',fontWeight:700,color:'#1e293b',verticalAlign:'top',border:'1px solid #e2e8f0',fontSize:12}}>
                                <div style={{display:'flex',alignItems:'center',gap:6}}>
                                  <span>🏥</span>
                                  <span style={{lineHeight:1.3}}>{ph.name}</span>
                                </div>
                              </td>
                            )}
                            <td style={{position:'sticky',left:120,zIndex:5,background:bg,padding:'6px 8px',border:'1px solid #e2e8f0'}}>
                              <span style={{fontSize:11,fontWeight:600,padding:'2px 6px',borderRadius:4,background:'#faf5ff',color:'#7e22ce'}}>{pr.name}</span>
                            </td>
                            {months.map(function(month){
                              var v=val(ph.id,pr.name,month);
                              return (
                                <td key={month} style={{border:'1px solid #e2e8f0',padding:0,textAlign:'center',background:bg}}>
                                  {canEdit?(
                                    <input type="number" min="0" value={v||''} onChange={function(e){upd(ph.id,phN(ph.id),pr.name,month,e.target.value);}} placeholder="0"
                                      style={{width:'100%',textAlign:'center',border:'none',background:'transparent',outline:'none',fontSize:12,padding:'6px 2px',boxSizing:'border-box'}} />
                                  ):(
                                    <span style={{fontSize:12,color:'#475569',padding:'6px 2px',display:'block'}}>{v||''}</span>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{border:'1px solid #e2e8f0',padding:'6px 6px',textAlign:'center',fontWeight:700,fontSize:12,color:t>0?'#4f46e5':'#cbd5e1',background:'#eef2ff'}}>{t||''}</td>
                          </tr>
                        );
                      })}
                      {/* Subtotal */}
                      <tr style={{background:'#eef2ff'}}>
                        <td style={{position:'sticky',left:120,zIndex:5,background:'#eef2ff',padding:'6px 8px',fontWeight:700,fontSize:11,color:'#3730a3',border:'1px solid #e2e8f0'}}>
                          Σ {ph.name.length>22?ph.name.substring(0,22)+'…':ph.name}
                        </td>
                        {months.map(function(m){return <td key={m} style={{border:'1px solid #e2e8f0',padding:'6px 6px',textAlign:'center',fontWeight:700,fontSize:11,color:'#312e81'}}>{pmT(ph.id,m)||''}</td>;})}
                        <td style={{border:'1px solid #e2e8f0',padding:'6px 6px',textAlign:'center',fontWeight:800,fontSize:11,color:'#312e81',background:'#e0e7ff'}}>{pgT(ph.id)||''}</td>
                      </tr>
                    </Fragment>
                  );
                })}
                {/* GRAND TOTAL */}
                <tr style={{background:'#4f46e5'}}>
                  <td colSpan="2" style={{position:'sticky',left:0,zIndex:10,background:'#4f46e5',color:'#fff',fontWeight:800,fontSize:11,padding:'10px 12px',border:'1px solid rgba(99,102,241,.4)'}}>📊 Total Général</td>
                  {months.map(function(m){return <td key={m} style={{border:'1px solid rgba(99,102,241,.4)',color:'#fff',fontWeight:800,fontSize:12,padding:'10px 6px',textAlign:'center'}}>{mT(m)||''}</td>;})}
                  <td style={{background:'#4338ca',color:'#fff',fontWeight:800,fontSize:13,padding:'10px 8px',textAlign:'center',border:'1px solid rgba(99,102,241,.4)'}}>{gT()||''}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div style={{display:'flex',flexWrap:'wrap',gap:20,padding:'10px 20px',background:'#f8fafc',borderTop:'1px solid #e2e8f0',fontSize:12,color:'#64748b'}}>
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
