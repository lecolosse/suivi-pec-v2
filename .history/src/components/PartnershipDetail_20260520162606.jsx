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

  // ── Gestion des mois ──
  var activeMonth = partnership.currentActiveMonth || '';
  var monthStatus = partnership.monthStatus || {};

  // Déterminer le mois éditable par le délégué
  function getEditableMonths() {
    var result = {};
    for (var i = 0; i < months.length; i++) {
      var m = months[i];
      var s = monthStatus[m] || 'locked';
      result[m] = { status: s, editable: isAdmin || (s === 'active' && isDm) };
    }
    return result;
  }
  var editableMonths = getEditableMonths();

  // Vérifier si un mois peut être activé (admin)
  function canActivateMonth(month) {
    if (!isAdmin) return false;
    return monthStatus[month] !== 'active' && monthStatus[month] !== 'closed';
  }

  // Vérifier si un mois peut être clôturé (dm sur actif, admin toujours)
  function canCloseMonth(month) {
    var s = monthStatus[month] || 'locked';
    if (s !== 'active') return false;
    if (isAdmin) return true;
    return isDm;
  }

  async function handleActivate(month) {
    try { await api.activateMonth(partnership.id, month); refreshPartnership(); } catch(e) { console.error(e); }
  }

  async function handleClose(month) {
    try { await api.closeMonth(partnership.id, month); refreshPartnership(); } catch(e) { console.error(e); }
  }

  async function handleUnlock(month) {
    try { await api.unlockMonth(partnership.id, month); refreshPartnership(); } catch(e) { console.error(e); }
  }

  async function refreshPartnership() {
    try { var p = await api.getPartenariat(partnership.id); onUpdate(p); } catch(e) { console.error(e); }
  }

  // ── Données ──
  function cell(phId, pName, month) {
    var k = phId + '|' + pName;
    return (partnership.tableData[k] && partnership.tableData[k][month]) || 0;
  }

  var upd = useCallback(function(phId, phName, pName, month, raw) {
    if (!canEdit) return;
    var em = editableMonths[month];
    if (!em || !em.editable) return;
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
  }, [partnership, onUpdate, canEdit, editableMonths]);

  function pt(ph,pn){return months.reduce(function(s,m){return s+cell(ph,pn,m);},0);}
  function pmt(ph,m){return products.reduce(function(s,p){return s+cell(ph,p.name,m);},0);}
  function pgt(ph){return months.reduce(function(s,m){return s+pmt(ph,m);},0);}
  function mt(m){return pharmacies.reduce(function(s,ph){return s+pmt(ph.id,m);},0);}
  function gt(){return months.reduce(function(s,m){return s+mt(m);},0);}
  function phN(id){var p=pharmacies.find(function(x){return x.id===id;});return p?p.name:id;}

  function tpm(productName, month) { return pharmacies.reduce(function(s, ph) { return s + cell(ph.id, productName, month); }, 0); }
  function tpmt(productName) { return months.reduce(function(s, m) { return s + tpm(productName, m); }, 0); }
  function tmg(month) { return products.reduce(function(s, prod) { return s + tpm(prod.name, month); }, 0); }
  function tgt() { return products.reduce(function(s, prod) { return s + tpmt(prod.name); }, 0); }

  function prescript(productName, month) {
    if (potential === 0) return 0;
    var total = tpm(productName, month);
    if (total === 0) return 0;
    return Math.round(((total / potential) * 100) * 100) / 100;
  }
  function prescriptTotal(productName) { return months.reduce(function(s, m) { return s + prescript(productName, m); }, 0); }
  function prescriptMonth(month) { return products.reduce(function(s, prod) { return s + prescript(prod.name, month); }, 0); }
  function prescriptGrand() { return products.reduce(function(s, prod) { return s + prescriptTotal(prod.name); }, 0); }

  function moyenneMensuelle(productName) {
    if (potential === 0) return 0;
    var nonZero = months.filter(function(m) { return prescript(productName, m) > 0; });
    if (nonZero.length === 0) return 0;
    return Math.round((nonZero.reduce(function(s, m) { return s + prescript(productName, m); }, 0) / nonZero.length) * 100) / 100;
  }
  function atteinteObjectif(productName) {
    var boxes = products.find(function(p) { return p.name === productName; })?.boxes || 0;
    if (boxes === 0) return 0;
    var mm = moyenneMensuelle(productName);
    if (mm === 0) return 0;
    return Math.round((mm / boxes) * 10000) / 100;
  }

  function exportCSV(){
    var csv = "Tableau de Suivi\nPharmacie;Produit";
    for (var i=0;i<months.length;i++) csv += ";"+formatMonth(months[i]); csv += ";Total\n";
    for (var i=0;i<pharmacies.length;i++){for(var j=0;j<products.length;j++){csv+=pharmacies[i].name+";"+products[j].name;for(var k=0;k<months.length;k++)csv+=";"+(cell(pharmacies[i].id,products[j].name,months[k])||"");csv+=";"+pt(pharmacies[i].id,products[j].name)+"\n";}}
    csv+="TOTAL MOIS;";for(var k=0;k<months.length;k++)csv+=";"+(mt(months[k])||"");csv+=";"+gt()+"\n\n";
    var blob=new Blob(["\uFEFF"+csv],{type:'text/csv;charset=utf-8;'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='partenariat_'+partnership.reference.replace(/[\/\s]/g,'_')+'.csv';a.click();
  }

  function thStyle(extra){return Object.assign({border:'1px solid rgba(99,102,241,.4)',color:'rgba(255,255,255,.9)',fontWeight:600,padding:'10px 6px',textAlign:'center',fontSize:10,whiteSpace:'nowrap',minWidth:75},extra||{});}
  function monthBg(m) { var s = editableMonths[m]; if (!s) return '#fff'; if (s.status === 'active') return '#dcfce7'; if (s.status === 'closed') return '#f1f5f9'; return '#fff'; }

  return (
    <div className="space-y-4">

      {/* HEADER */}
      <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',padding:'16px 20px'}}>
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

      {/* INFO GRID */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {[
          {l:'Référence',v:partnership.reference,i:'📄'},{l:'Type',v:partnership.typeManifestation,i:'🏷️'},{l:'Prospect',v:partnership.prospect||'—',i:'👤'},{l:'Créé par',v:partnership.createdByName||'—',i:'✍️'},
          {l:'Période',v:months.length>0?formatMonth(months[0])+' → '+formatMonth(months[months.length-1]):'—',i:'📅'},{l:'Superviseur',v:partnership.supervisor||'—',i:'👨‍💼'},{l:'Délégué(e)s',v:partnership.delegates||'—',i:'👥'},{l:'Budget',v:partnership.budget?partnership.budget.toLocaleString('fr-FR')+' TND':'—',i:'💰'},
        ].map(function(x){return <div key={x.l} style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',padding:'14px 16px'}}><p style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>{x.i} {x.l}</p><p style={{fontSize:13,fontWeight:600,color:'#1e293b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={x.v}>{x.v}</p></div>;})}
      </div>

      {/* PRODUITS AVEC BOITES + PHARMACIES */}
      <div style={{display:'flex',gap:12}}>
        <div style={{flex:1,background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',padding:'14px 16px'}}>
          <p style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:8}}>📦 Produits ({products.length})</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {products.map(function(p){return (
              <span key={p.id} style={{fontSize:11,fontWeight:600,padding:'4px 10px',borderRadius:6,background:'#faf5ff',color:'#7e22ce',border:'1px solid #e9d5ff',display:'inline-flex',alignItems:'center',gap:4}}>
                {p.name} <span style={{color:'#a855f7',fontWeight:500}}>({p.boxes} boîtes)</span>
              </span>
            );})}
          </div>
        </div>
        <div style={{flex:1,background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',padding:'14px 16px'}}>
          <p style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:8}}>🏥 Pharmacies ({pharmacies.length})</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {pharmacies.map(function(ph){return <span key={ph.id} style={{fontSize:11,fontWeight:600,padding:'3px 8px',borderRadius:6,background:'#f0fdfa',color:'#0f766e',border:'1px solid #99f6e4'}}>{ph.name}</span>;})}
          </div>
        </div>
      </div>

      {/* GESTION DES MOIS */}
      {months.length>0 && isAdmin && (
        <div className="flex flex-wrap items-center gap-3" style={{background:'#fefce8',border:'1px solid #fde68a',borderRadius:12,padding:'12px 16px',fontSize:12}}>
          <span style={{fontWeight:700,color:'#854d0e'}}>🔧 Gestion des mois :</span>
          {months.map(function(m){
            var s = monthStatus[m] || 'locked';
            return (
              <span key={'gm-'+m} style={{display:'flex',alignItems:'center',gap:6,background:'#fff',borderRadius:8,padding:'6px 10px',border:'1px solid #e2e8f0'}}>
                <span style={{fontWeight:600,color:s==='active'?'#16a34a':s==='closed'?'#64748b':'#94a3b8',fontSize:12}}>{formatMonth(m)}</span>
                <span style={{fontSize:10,fontWeight:500,padding:'2px 6px',borderRadius:4,background:s==='active'?'#dcfce7':s==='closed'?'#f1f5f9':'#fef3c7',color:s==='active'?'#16a34a':s==='closed'?'#64748b':'#b45309'}}>{s==='active'?'Actif':s==='closed'?'Clôturé':'Verrouillé'}</span>
                {canActivateMonth(m) && <button onClick={function(){handleActivate(m);}} style={{fontSize:10,padding:'3px 8px',borderRadius:4,border:'1px solid #16a34a',background:'#dcfce7',color:'#16a34a',cursor:'pointer',fontWeight:600}}>Activer</button>}
                {canCloseMonth(m) && <button onClick={function(){handleClose(m);}} style={{fontSize:10,padding:'3px 8px',borderRadius:4,border:'1px solid #f59e0b',background:'#fef3c7',color:'#b45309',cursor:'pointer',fontWeight:600}}>Clôturer</button>}
                {isAdmin && s==='closed' && <button onClick={function(){handleUnlock(m);}} style={{fontSize:10,padding:'3px 8px',borderRadius:4,border:'1px solid #6366f1',background:'#eef2ff',color:'#4f46e5',cursor:'pointer',fontWeight:600}}>Débloquer</button>}
              </span>
            );
          })}
        </div>
      )}

      {/* MESSAGE MOIS ACTIF POUR DM */}
      {isDm && activeMonth && (
        <div className="flex items-center justify-between" style={{background:'#dcfce7',border:'1px solid #86efac',borderRadius:12,padding:'10px 16px',fontSize:12}}>
          <span style={{fontWeight:600,color:'#16a34a'}}>📝 Mois en cours : <b>{formatMonth(activeMonth)}</b> — Saisie ouverte</span>
          <button onClick={function(){handleClose(activeMonth);}} style={{fontSize:11,fontWeight:600,padding:'5px 12px',borderRadius:6,border:'1px solid #f59e0b',background:'#fef3c7',color:'#b45309',cursor:'pointer'}}>Clôturer ce mois</button>
        </div>
      )}

      {!canEdit && <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:12,padding:'12px 16px',fontSize:13,fontWeight:500,color:'#1d4ed8'}}>🔒 Lecture seule</div>}

      {/* ═══════════ 1. TABLEAU DE SUIVI ═══════════ */}
      {months.length===0?<div style={{background:'#fefce8',border:'1px solid #fde68a',borderRadius:12,padding:20,textAlign:'center',fontWeight:600,color:'#854d0e',fontSize:13}}>⚠️ Période invalide</div>:(
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}><div><h3 style={{fontSize:14,fontWeight:700,color:'#1e293b'}}>📊 Tableau de Suivi</h3><p style={{fontSize:12,color:'#94a3b8',marginTop:1}}>{formatMonth(months[0])} → {formatMonth(months[months.length-1])} · {months.length} mois</p></div><button onClick={exportCSV} style={{padding:'6px 12px',borderRadius:6,fontSize:12,fontWeight:600,border:'1px solid #cbd5e1',background:'#fff',color:'#4f46e5',cursor:'pointer'}}>📥 CSV</button></div>
          <div style={{overflow:'auto',maxHeight:'45vh'}}>
            <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
              <thead><tr style={{background:'#4f46e5'}}>
                <th style={thStyle({textAlign:'left',position:'sticky',left:0,zIndex:20,background:'#4f46e5',minWidth:120})}>Pharmacie</th>
                <th style={thStyle({textAlign:'left',position:'sticky',left:120,zIndex:15,background:'#4f46e5',minWidth:90})}>Produit</th>
                {months.map(function(m){return <th key={m} style={thStyle({background:monthStatus[m]==='active'?'#16a34a':monthStatus[m]==='closed'?'#94a3b8':'#4f46e5'})}>{formatMonth(m)}{monthStatus[m]==='active'?' ✓':monthStatus[m]==='closed'?' 🔒':''}</th>;})}
                <th style={thStyle({background:'#4338ca',color:'#fff',minWidth:50})}>Σ</th>
              </tr></thead>
              <tbody>
                {pharmacies.map(function(ph,phi){var rs=products.length+1;var bg=phi%2===0?'#fff':'#f8fafc';return <Fragment key={ph.id}>
                  {products.map(function(prd,pri){var t=pt(ph.id,prd.name);return <tr key={ph.id+'-'+prd.id} style={{background:bg}}>
                    {pri===0&&<td rowSpan={rs} style={{position:'sticky',left:0,zIndex:10,background:bg,padding:'10px 10px',fontWeight:700,color:'#1e293b',verticalAlign:'top',border:'1px solid #e2e8f0',fontSize:12}}><div style={{display:'flex',alignItems:'center',gap:6}}><span>🏥</span><span style={{lineHeight:1.3}}>{ph.name}</span></div></td>}
                    <td style={{position:'sticky',left:120,zIndex:5,background:bg,padding:'6px 8px',border:'1px solid #e2e8f0'}}><span style={{fontSize:11,fontWeight:600,padding:'2px 6px',borderRadius:4,background:'#faf5ff',color:'#7e22ce'}}>{prd.name}</span></td>
                    {months.map(function(mo){var v=cell(ph.id,prd.name,mo);var em=editableMonths[mo];var editable=em?em.editable:false;var mbg=monthBg(mo);return <td key={mo} style={{border:'1px solid #e2e8f0',padding:0,textAlign:'center',background:mbg}}>{editable?<input type="number" min="0" value={v||''} onChange={function(e){upd(ph.id,phN(ph.id),prd.name,mo,e.target.value);}} placeholder="0" style={{width:'100%',textAlign:'center',border:'none',background:'transparent',outline:'none',fontSize:12,padding:'6px 2px',boxSizing:'border-box'}} />:<span style={{fontSize:12,color:editable?'#475569':'#94a3b8',padding:'6px 2px',display:'block'}}>{v||''}</span>}</td>;})}
                    <td style={{border:'1px solid #e2e8f0',padding:'6px',textAlign:'center',fontWeight:700,fontSize:12,color:t>0?'#4f46e5':'#cbd5e1',background:'#eef2ff'}}>{t||''}</td>
                  </tr>;})}
                  <tr style={{background:'#eef2ff'}}><td style={{position:'sticky',left:120,zIndex:5,background:'#eef2ff',padding:'6px 8px',fontWeight:700,fontSize:11,color:'#3730a3',border:'1px solid #e2e8f0'}}>Σ {ph.name.length>22?ph.name.substring(0,22)+'…':ph.name}</td>{months.map(function(m){return <td key={m} style={{border:'1px solid #e2e8f0',padding:'6px',textAlign:'center',fontWeight:700,fontSize:11,color:'#312e81'}}>{pmt(ph.id,m)||''}</td>;})}<td style={{background:'#e0e7ff',border:'1px solid #e2e8f0',padding:'6px',textAlign:'center',fontWeight:800,fontSize:11,color:'#312e81'}}>{pgt(ph.id)||''}</td></tr>
                </Fragment>;})}
                <tr style={{background:'#e2e8f0'}}><td colSpan="2" style={{position:'sticky',left:0,zIndex:10,background:'#e2e8f0',padding:'8px 12px',fontWeight:700,fontSize:11,color:'#475569',border:'1px solid #cbd5e1'}}>📅 Total par mois</td>{months.map(function(m){return <td key={'tm-'+m} style={{border:'1px solid #cbd5e1',padding:'8px 6px',textAlign:'center',fontWeight:700,fontSize:11,color:'#475569'}}>{mt(m)||''}</td>;})}<td style={{background:'#cbd5e1',border:'1px solid #cbd5e1',padding:'8px 6px',textAlign:'center',fontWeight:800,fontSize:11,color:'#475569'}}>{gt()||''}</td></tr>
                <tr style={{background:'#4f46e5'}}><td colSpan="2" style={{position:'sticky',left:0,zIndex:10,background:'#4f46e5',color:'#fff',fontWeight:800,fontSize:11,padding:'10px 12px',border:'1px solid rgba(99,102,241,.4)'}}>📊 Total Général</td>{months.map(function(m){return <td key={'gt-'+m} style={{border:'1px solid rgba(99,102,241,.4)',color:'#fff',fontWeight:800,fontSize:12,padding:'10px 6px',textAlign:'center'}}>{mt(m)||''}</td>;})}<td style={{background:'#4338ca',color:'#fff',fontWeight:800,fontSize:13,padding:'10px 8px',textAlign:'center',border:'1px solid rgba(99,102,241,.4)'}}>{gt()||''}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════ 2. TOTAL PRODUITS PAR MOIS ═══════════ */}
      {months.length>0 && (
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden'}}>
          <div style={{padding:'14px 20px',background:'#faf5ff',borderBottom:'1px solid #e9d5ff'}}><h3 style={{fontSize:14,fontWeight:700,color:'#7e22ce'}}>📦 Total des Produits par Mois</h3><p style={{fontSize:11,color:'#a855f7',marginTop:2}}>Quantité totale de chaque produit (toutes pharmacies)</p></div>
          <div style={{overflow:'auto',maxHeight:'35vh'}}>
            <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
              <thead><tr style={{background:'#9333ea'}}><th style={{position:'sticky',left:0,zIndex:10,background:'#9333ea',color:'#fff',fontWeight:600,padding:'10px 12px',textAlign:'left',minWidth:120,border:'1px solid #a855f7',fontSize:11}}>Produit</th>{months.map(function(m){return <th key={'tp-'+m} style={{background:'#9333ea',color:'#fff',fontWeight:600,padding:'10px 6px',textAlign:'center',minWidth:75,border:'1px solid #a855f7',fontSize:10,whiteSpace:'nowrap'}}>{formatMonth(m)}</th>;})}<th style={{background:'#7e22ce',color:'#fff',fontWeight:700,padding:'10px 8px',textAlign:'center',minWidth:50,border:'1px solid #a855f7'}}>Σ</th></tr></thead>
              <tbody>
                {products.map(function(prod,pri){var bg=pri%2===0?'#fff':'#f8fafc';return <tr key={'tpr-'+prod.id} style={{background:bg}}><td style={{position:'sticky',left:0,zIndex:5,background:bg,padding:'10px 12px',fontWeight:600,fontSize:12,color:'#1e293b',border:'1px solid #e2e8f0'}}>{prod.name}</td>{months.map(function(mo){var v=tpm(prod.name,mo);return <td key={'tp-'+prod.id+'-'+mo} style={{border:'1px solid #e2e8f0',padding:'8px 6px',textAlign:'center',background:bg,fontWeight:500,fontSize:12,color:v>0?'#7e22ce':'#94a3b8'}}>{v||''}</td>;})}<td style={{border:'1px solid #e2e8f0',padding:'8px 6px',textAlign:'center',fontWeight:700,fontSize:12,color:tpmt(prod.name)>0?'#7e22ce':'#cbd5e1',background:'#faf5ff'}}>{tpmt(prod.name)||''}</td></tr>;})}
                <tr style={{background:'#e9d5ff'}}><td style={{position:'sticky',left:0,zIndex:5,background:'#e9d5ff',padding:'8px 12px',fontWeight:700,fontSize:11,color:'#7e22ce',border:'1px solid #d8b4fe'}}>📅 Total par mois</td>{months.map(function(m){return <td key={'tpt-'+m} style={{border:'1px solid #d8b4fe',padding:'8px 6px',textAlign:'center',fontWeight:700,fontSize:11,color:'#7e22ce'}}>{tmg(m)||''}</td>;})}<td style={{background:'#d8b4fe',border:'1px solid #d8b4fe',padding:'8px 6px',textAlign:'center',fontWeight:800,fontSize:11,color:'#7e22ce'}}>{tgt()||''}</td></tr>
                <tr style={{background:'#9333ea'}}><td style={{position:'sticky',left:0,zIndex:10,background:'#9333ea',color:'#fff',fontWeight:800,fontSize:11,padding:'10px 12px',border:'1px solid #a855f7'}}>📦 Total Produits</td>{months.map(function(m){return <td key={'tpg-'+m} style={{border:'1px solid #a855f7',color:'#fff',fontWeight:800,fontSize:12,padding:'10px 6px',textAlign:'center'}}>{tmg(m)||''}</td>;})}<td style={{background:'#7e22ce',color:'#fff',fontWeight:800,fontSize:13,padding:'10px 8px',textAlign:'center',border:'1px solid #a855f7'}}>{tgt()||''}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════ 3. PRESCRIPTIONS RÉELLES ═══════════ */}
      {months.length>0 && (
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden'}}>
          <div style={{padding:'14px 20px',background:'#f0fdfa',borderBottom:'1px solid #ccfbf1',display:'flex',alignItems:'center',justifyContent:'space-between'}}><div><h3 style={{fontSize:14,fontWeight:700,color:'#0f766e'}}>💊 Prescriptions Réelles</h3><p style={{fontSize:11,color:'#5eead4',marginTop:2}}>Formule : si Potentiel=0 → 0 | si Total Produit/Mois=0 → 0 | sinon Total Produit/Mois / Potentiel × 100 ({potential}%)</p></div></div>
          <div style={{overflow:'auto',maxHeight:'35vh'}}>
            <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
              <thead><tr style={{background:'#0d9488'}}><th style={{position:'sticky',left:0,zIndex:10,background:'#0d9488',color:'#fff',fontWeight:600,padding:'10px 12px',textAlign:'left',minWidth:120,border:'1px solid #0f766e',fontSize:11}}>Produit</th>{months.map(function(m){return <th key={'pr'+m} style={{background:'#0d9488',color:'#fff',fontWeight:600,padding:'10px 6px',textAlign:'center',minWidth:75,border:'1px solid #0f766e',fontSize:10,whiteSpace:'nowrap'}}>{formatMonth(m)}</th>;})}<th style={{background:'#0f766e',color:'#fff',fontWeight:700,padding:'10px 8px',textAlign:'center',minWidth:50,border:'1px solid #0f766e'}}>Σ</th></tr></thead>
              <tbody>
                {products.map(function(prod,pri){var bg=pri%2===0?'#fff':'#f8fafc';return <tr key={'prr-'+prod.id} style={{background:bg}}><td style={{position:'sticky',left:0,zIndex:5,background:bg,padding:'10px 12px',fontWeight:600,fontSize:12,color:'#1e293b',border:'1px solid #e2e8f0'}}>{prod.name}</td>{months.map(function(mo){var v=prescript(prod.name,mo);return <td key={'prr-'+prod.id+'-'+mo} style={{border:'1px solid #e2e8f0',padding:'8px 6px',textAlign:'center',background:bg,fontWeight:500,fontSize:12,color:v>0?'#0f766e':'#94a3b8'}}>{v>0?v.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}):''}</td>;})}<td style={{border:'1px solid #e2e8f0',padding:'8px 6px',textAlign:'center',fontWeight:700,fontSize:12,color:prescriptTotal(prod.name)>0?'#0f766e':'#cbd5e1',background:'#f0fdfa'}}>{prescriptTotal(prod.name)>0?prescriptTotal(prod.name).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}):''}</td></tr>;})}
                <tr style={{background:'#ccfbf1'}}><td style={{position:'sticky',left:0,zIndex:5,background:'#ccfbf1',padding:'8px 12px',fontWeight:700,fontSize:11,color:'#0f766e',border:'1px solid #99f6e4'}}>📅 Total par mois</td>{months.map(function(m){return <td key={'prtm-'+m} style={{border:'1px solid #99f6e4',padding:'8px 6px',textAlign:'center',fontWeight:700,fontSize:11,color:'#0f766e'}}>{prescriptMonth(m)>0?prescriptMonth(m).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}):''}</td>;})}<td style={{border:'1px solid #99f6e4',padding:'8px 6px',textAlign:'center',fontWeight:800,fontSize:11,color:'#0f766e',background:'#99f6e4'}}>{prescriptGrand()>0?prescriptGrand().toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}):''}</td></tr>
                <tr style={{background:'#0d9488'}}><td style={{position:'sticky',left:0,zIndex:10,background:'#0d9488',color:'#fff',fontWeight:800,fontSize:11,padding:'10px 12px',border:'1px solid #0f766e'}}>💊 Total Prescriptions</td>{months.map(function(m){return <td key={'prgt-'+m} style={{border:'1px solid #0f766e',color:'#fff',fontWeight:800,fontSize:12,padding:'10px 6px',textAlign:'center'}}>{prescriptMonth(m)>0?prescriptMonth(m).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}):''}</td>;})}<td style={{background:'#0f766e',color:'#fff',fontWeight:800,fontSize:13,padding:'10px 8px',textAlign:'center',border:'1px solid #0f766e'}}>{prescriptGrand()>0?prescriptGrand().toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}):''}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════ 4. SYNTHÈSE (admin + sup seulement) ═══════════ */}
      {months.length>0 && canSeeSynth && (
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden'}}>
          <div style={{padding:'14px 20px',background:'#fef3c7',borderBottom:'1px solid #fde68a'}}><h3 style={{fontSize:14,fontWeight:700,color:'#b45309'}}>📈 Synthèse</h3><p style={{fontSize:11,color:'#d97706',marginTop:2}}>Moyenne Mensuelle et % d'atteinte des objectifs par produit</p></div>
          <div style={{overflow:'auto',maxHeight:'30vh'}}>
            <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
              <thead><tr style={{background:'#d97706'}}><th style={{position:'sticky',left:0,zIndex:10,background:'#d97706',color:'#fff',fontWeight:600,padding:'10px 12px',textAlign:'left',minWidth:150,border:'1px solid #b45309',fontSize:11}}>Produit</th><th style={{background:'#d97706',color:'#fff',fontWeight:600,padding:'10px 12px',textAlign:'center',width:100,border:'1px solid #b45309',fontSize:11}}>Boîtes</th><th style={{background:'#d97706',color:'#fff',fontWeight:600,padding:'10px 12px',textAlign:'center',width:180,border:'1px solid #b45309',fontSize:11}}>Moy. Mensuelle</th><th style={{background:'#b45309',color:'#fff',fontWeight:700,padding:'10px 12px',textAlign:'right',width:100,border:'1px solid #b45309',fontSize:11}}>% Objectif</th></tr></thead>
              <tbody>
                {products.map(function(prod,pri){var bg=pri%2===0?'#fff':'#f8fafc';var mm=moyenneMensuelle(prod.name);var ao=atteinteObjectif(prod.name);var boxes=prod.boxes||0;return <tr key={'synth-'+prod.id} style={{background:bg}}><td style={{position:'sticky',left:0,zIndex:5,background:bg,padding:'10px 12px',fontWeight:600,fontSize:12,color:'#1e293b',border:'1px solid #e2e8f0'}}>{prod.name}</td><td style={{border:'1px solid #e2e8f0',padding:'8px 12px',textAlign:'center',fontWeight:600,fontSize:12,color:'#475569'}}>{boxes}</td><td style={{border:'1px solid #e2e8f0',padding:'8px 12px',textAlign:'center',fontWeight:600,fontSize:12,color:mm>0?'#b45309':'#94a3b8'}}>{mm>0?mm.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}):''}</td><td style={{border:'1px solid #e2e8f0',padding:'8px 12px',textAlign:'right',fontWeight:700,fontSize:13,color:ao>=100?'#16a34a':ao>0?'#d97706':'#94a3b8',background:ao>=100?'#f0fdf4':bg}}>{ao>0?ao.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' %':''}</td></tr>;})}
              </tbody>
            </table>
          </div>
          <div style={{padding:'10px 20px',background:'#fef3c7',borderTop:'1px solid #fde68a',fontSize:11,color:'#b45309',display:'flex',flexWrap:'wrap',gap:16}}><span>Moyenne = MOYENNE.SI(Prescriptions≠0)</span><span>|</span><span>% Objectif = Moyenne / Boîtes</span></div>
        </div>
      )}

    </div>
  );
}
