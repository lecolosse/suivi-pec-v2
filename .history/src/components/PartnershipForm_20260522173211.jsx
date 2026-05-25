import { useState, useEffect, useRef } from 'react';
import { TYPE_MANIFESTATIONS, generateId, addMonths } from '../types';
import { api } from '../api';
import ProductSelector from './ProductSelector';

export default function PartnershipForm({ onSubmit, onCancel, currentUser }) {
  var creator = currentUser ? currentUser.login : '';

  var [year,setYear] = useState(new Date().getFullYear().toString());
  var [reference,setReference] = useState('');
  var [typeM,setTypeM] = useState('');
  var [manifestation,setManifestation] = useState('');
  var [startMonth,setStartMonth] = useState('');
  var [endMonth,setEndMonth] = useState('');
  var [followUp,setFollowUp] = useState('');
  var [prospect,setProspect] = useState('');
  var [supervisor,setSupervisor] = useState('');
  var [delegates,setDelegates] = useState([creator]);
  var [budget,setBudget] = useState(0);
  var [potential,setPotential] = useState(0);
  var [products,setProducts] = useState([]);
  var [pharmacies,setPharmacies] = useState([]);
  var [errors,setErrors] = useState([]);

  var [refQ,setRefQ]=useState('');var [refR,setRefR]=useState([]);var [refD,setRefD]=useState(false);var [refL,setRefL]=useState(false);var refT=useRef();
  var [prQ,setPrQ]=useState('');var [prR,setPrR]=useState([]);var [prD,setPrD]=useState(false);var [prL,setPrL]=useState(false);var prT=useRef();
  var [dlQ,setDlQ]=useState('');var [dlR,setDlR]=useState([]);var [dlD,setDlD]=useState(false);var [dlL,setDlL]=useState(false);var dlT=useRef();
  var [phQ,setPhQ]=useState('');var [phR,setPhR]=useState([]);var [phD,setPhD]=useState(false);var [phL,setPhL]=useState(false);var phT=useRef();

  useEffect(function(){
    var q=refQ.trim();if(q.length<1){setRefR([]);setRefD(false);return;}
    setRefL(true);clearTimeout(refT.current);
    refT.current=setTimeout(async function(){try{var r=await api.searchReferences(q);setRefR(r);setRefD(r.length>0);}catch(e){setRefR([]);setRefD(false);}finally{setRefL(false);}},400);
    return function(){clearTimeout(refT.current);};
  },[refQ]);

  useEffect(function(){
    var q=prQ.trim();if(q.length<1){setPrR([]);setPrD(false);return;}
    setPrL(true);clearTimeout(prT.current);
    prT.current=setTimeout(async function(){try{var r=await api.searchProspects(q);setPrR(r);setPrD(r.length>0);}catch(e){setPrR([]);setPrD(false);}finally{setPrL(false);}},400);
    return function(){clearTimeout(prT.current);};
  },[prQ]);

  useEffect(function(){
    var q=dlQ.trim();if(q.length<1){setDlR([]);setDlD(false);return;}
    setDlL(true);clearTimeout(dlT.current);
    dlT.current=setTimeout(async function(){try{var r=await api.searchUtilisateurs(q);setDlR(r);setDlD(r.length>0);}catch(e){setDlR([]);setDlD(false);}finally{setDlL(false);}},400);
    return function(){clearTimeout(dlT.current);};
  },[dlQ]);

  useEffect(function(){
    var q=phQ.trim();if(q.length<1){setPhR([]);setPhD(false);return;}
    setPhL(true);clearTimeout(phT.current);
    phT.current=setTimeout(async function(){try{var r=await api.searchProspects(q);setPhR(r);setPhD(r.length>0);}catch(e){setPhR([]);setPhD(false);}finally{setPhL(false);}},400);
    return function(){clearTimeout(phT.current);};
  },[phQ]);

  function selectRef(ref){
    setReference(ref.Reference||'');setTypeM(ref.Type||'');setManifestation(ref.Manifestation||'');setProspect(ref.Prospect||'');setSupervisor(ref.sup||'');setRefD(false);setRefQ('');
    if(ref.DateDemande){var d=new Date(ref.DateDemande);var ym=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');setStartMonth(ym);setFollowUp(addMonths(ym,9));setYear(String(d.getFullYear()));}
  }

  function toggleDel(name){if(name===creator)return;setDelegates(delegates.indexOf(name)>=0?delegates.filter(function(d){return d!==name;}):delegates.concat([name]));}
  function removeDel(name){if(name===creator)return;setDelegates(delegates.filter(function(d){return d!==name;}));}
  function addPh(p){var n=p.NOMPRENOM;if(!n||pharmacies.find(function(x){return x.name.toLowerCase()===n.toLowerCase();}))return;setPharmacies(pharmacies.concat([{id:generateId(),name:n,specialite:p.SPECIALITE,secteur:p.SECTEUR}]));setPhQ('');setPhD(false);}
  function addPhM(){var n=phQ.trim();if(!n||pharmacies.find(function(x){return x.name.toLowerCase()===n.toLowerCase();}))return;setPharmacies(pharmacies.concat([{id:generateId(),name:n}]));setPhQ('');}
  function remPh(id){setPharmacies(pharmacies.filter(function(p){return p.id!==id;}));}

  function validate(){
    var e=[];
    if(!year)e.push("Année requise");if(!reference.trim())e.push("Référence requise");if(!typeM)e.push("Type requis");if(!startMonth)e.push("Début requis");if(!endMonth)e.push("Échéance requise");
    if(startMonth&&endMonth&&startMonth>endMonth)e.push("Début > Échéance");if(products.length===0)e.push("Au moins un produit");if(pharmacies.length===0)e.push("Au moins une pharmacie");
    setErrors(e);return e.length===0;
  }

  var [submitting, setSubmitting] = useState(false);

  async function handleSubmit(ev){
    ev.preventDefault();if(!validate())return;
    setSubmitting(true);
    var td={};pharmacies.forEach(function(ph){products.forEach(function(pr){td[ph.id+'|'+pr.name]={};});});
    try {
      await onSubmit({id:generateId(),year:year,reference:reference.trim(),typeManifestation:typeM,manifestation:manifestation.trim(),startMonth:startMonth,endMonth:endMonth,followUpEndMonth:followUp,prospect:prospect.trim(),supervisor:supervisor.trim(),delegates:delegates.join(', '),budget:budget,potentialPharmacies:potential,products:products.slice(),pharmacies:pharmacies.slice(),tableData:td,createdAt:new Date().toISOString(),createdByName:creator});
    } catch(e) {
      setErrors([e.message || 'Erreur lors de la création']);
      console.error(e);
    }
    finally { setSubmitting(false); }
  }

  var S='bg-white rounded-xl border p-5';
  var B='border-color:#e2e8f0';

  function Drop(props){
    if(!props.show)return null;
    return <div className="absolute z-30 bg-white rounded-lg shadow-xl border overflow-auto" style={{left:0,right:0,top:'100%',marginTop:4,maxHeight:220,borderColor:'#e2e8f0'}}>{props.items.map(props.render)}</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.length>0&&<div className="bg-red-50 rounded-xl p-4 border" style={{borderColor:'#fecaca'}}><p className="text-sm font-semibold text-red-800 mb-1">⚠️ Corrigez :</p><ul className="list-disc list-inside text-sm text-red-600">{errors.map(function(e,i){return <li key={i}>{e}</li>;})}</ul></div>}

      <div className={S} style={{borderColor:'#e2e8f0'}}>
        <h3 className="text-sm font-bold text-slate-900 mb-1">🔍 Recherche Référence</h3>
        <p className="text-xs text-slate-400 mb-3">Tapez le numéro (ex: 832)</p>
        <div className="relative">
          <input type="text" value={refQ} onChange={function(e){setRefQ(e.target.value);}} placeholder="Ex: 832..." className="w-full" />
          {refL&&<span className="absolute animate-spin" style={{right:12,top:10}}>⏳</span>}
          <Drop items={refR} show={refD} render={function(ref){return <button key={ref.id} type="button" onClick={function(){selectRef(ref);}} className="w-full text-left px-4 py-3 border-b" style={{borderColor:'#f1f5f9',background:'transparent',borderWidth:0,borderBottomWidth:1,display:'block',width:'100%',textAlign:'left',padding:'12px 16px'}}><span className="font-semibold text-indigo-700">{ref.Reference}</span>{ref.Type&&<span className="text-xs bg-slate-100 px-2 py-1 rounded ml-2">{ref.Type}</span>}<div className="text-xs text-slate-400 mt-1">{ref.Prospect}{ref.sup?' · '+ref.sup:''}</div></button>;}} />
        </div>
      </div>

      <div className={S} style={{borderColor:'#e2e8f0'}}>
        <h3 className="text-sm font-bold text-slate-900 mb-4">1. Informations Générales</h3>
        <div className="grid grid-2 gap-4">
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Année *</label><input type="number" min="2000" max="2100" value={year} onChange={function(e){setYear(e.target.value);}} className="w-full" /></div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Référence *</label><input type="text" value={reference} onChange={function(e){setReference(e.target.value);}} className="w-full" placeholder="2024/DV/S1/000000832" /></div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Type *</label><select value={typeM} onChange={function(e){setTypeM(e.target.value);}} className="w-full"><option value="">-- Choisir --</option>{TYPE_MANIFESTATIONS.map(function(t){return <option key={t} value={t}>{t}</option>;})}</select></div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Manifestation</label><input type="text" value={manifestation} onChange={function(e){setManifestation(e.target.value);}} className="w-full" /></div>
        </div>
      </div>

      <div className={S} style={{borderColor:'#e2e8f0'}}>
        <h3 className="text-sm font-bold text-slate-900 mb-4">2. Période</h3>
        <div className="grid grid-3 gap-4">
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Début *</label><input type="month" value={startMonth} onChange={function(e){setStartMonth(e.target.value);}} className="w-full" /></div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Échéance *</label><input type="month" value={endMonth} onChange={function(e){setEndMonth(e.target.value);}} className="w-full" /></div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Fin de Suivi</label><input type="month" value={followUp} onChange={function(e){setFollowUp(e.target.value);}} className="w-full" />{startMonth&&<p className="text-xs text-slate-400 mt-1">Auto: {addMonths(startMonth,9)}</p>}</div>
        </div>
      </div>

      <div className={S} style={{borderColor:'#e2e8f0'}}>
        <h3 className="text-sm font-bold text-slate-900 mb-4">3. Prospect & Superviseur</h3>
        <div className="grid grid-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Prospect</label>
            <div className="relative">
              <input type="text" value={prQ||prospect} onChange={function(e){setPrQ(e.target.value);setProspect('');}} placeholder="Rechercher..." className="w-full" />
              {prL&&<span className="absolute animate-spin" style={{right:12,top:10}}>⏳</span>}
              <Drop items={prR} show={prD} render={function(p){return <button key={p.ID} type="button" onClick={function(){setProspect(p.NOMPRENOM);setPrQ('');setPrD(false);}} style={{display:'block',width:'100%',textAlign:'left',padding:'12px 16px',background:'transparent',border:'none',borderBottom:'1px solid #f1f5f9'}}><span className="font-medium">{p.NOMPRENOM}</span><span className="text-xs text-slate-400 ml-2">{p.SPECIALITE} · {p.SECTEUR}</span></button>;}} />
            </div>
            {prospect&&<p className="mt-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg inline-block font-medium">✓ {prospect}</p>}
          </div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Superviseur</label><input type="text" value={supervisor} onChange={function(e){setSupervisor(e.target.value);}} className="w-full" /></div>
        </div>
      </div>

      <div className={S} style={{borderColor:'#e2e8f0'}}>
        <h3 className="text-sm font-bold text-slate-900 mb-4">4. Délégué(e)s <span className="text-xs text-slate-400 ml-1">({delegates.length})</span></h3>
        <div className="relative mb-4">
          <input type="text" value={dlQ} onChange={function(e){setDlQ(e.target.value);}} placeholder="Rechercher un délégué..." className="w-full" />
          {dlL&&<span className="absolute animate-spin" style={{right:12,top:10}}>⏳</span>}
          <Drop items={dlR} show={dlD} render={function(u){var sel=delegates.indexOf(u.UTILISATEUR)>=0;return <button key={u.ID} type="button" onClick={function(){toggleDel(u.UTILISATEUR);}} style={{display:'flex',width:'100%',textAlign:'left',padding:'12px 16px',background:sel?'#fff7ed':'transparent',border:'none',borderBottom:'1px solid #f1f5f9',alignItems:'center',gap:12}}>
            <div style={{width:20,height:20,borderRadius:4,border:'2px solid '+(sel?'#ea580c':'#cbd5e1'),background:sel?'#ea580c':'transparent',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,flexShrink:0}}>{sel?'✓':''}</div>
            <div><span className="font-medium">{u.UTILISATEUR}</span><span className="text-xs text-slate-400 ml-2">{u.SUPERVISEUR}</span></div>
          </button>;}} />
        </div>
        <div className="flex flex-wrap gap-2">
          {delegates.map(function(name){return <span key={name} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium" style={{background:name===creator?'#eef2ff':'#f1f5f9',color:name===creator?'#4338ca':'#475569',border:name===creator?'1px solid #c7d2fe':'1px solid #e2e8f0'}}>{name===creator?'✍️':'👤'} {name}{name!==creator&&<button type="button" onClick={function(){removeDel(name);}} style={{background:'none',border:'none',color:'#94a3b8',cursor:'pointer',marginLeft:4,fontSize:12}}>✕</button>}</span>;})}
        </div>
      </div>

      <div className={S} style={{borderColor:'#e2e8f0'}}>
        <h3 className="text-sm font-bold text-slate-900 mb-4">5. Budget</h3>
        <div className="grid grid-2 gap-4">
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Budget (TND)</label><input type="number" min="0" step="0.01" value={budget||''} onChange={function(e){setBudget(parseFloat(e.target.value)||0);}} className="w-full" placeholder="0.00" /></div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Potentiel (%)</label><input type="number" min="0" max="100" value={potential||''} onChange={function(e){setPotential(parseFloat(e.target.value)||0);}} className="w-full" placeholder="0" /></div>
        </div>
      </div>

      <ProductSelector products={products} onAdd={function(p){setProducts(products.concat([p]));}} onRemove={function(id){setProducts(products.filter(function(p){return p.id!==id;}));}} />

      <div className={S} style={{borderColor:'#e2e8f0'}}>
        <h3 className="text-sm font-bold text-slate-900 mb-1">7. Pharmacies <span className="text-xs text-slate-400 ml-1">({pharmacies.length})</span></h3>
        <p className="text-xs text-slate-400 mb-3">Recherche par <b>NOMPRENOM</b> ou <b>CODEPROSPECT</b></p>
        <div className="relative mb-3">
          <input type="text" value={phQ} onChange={function(e){setPhQ(e.target.value);}} onKeyDown={function(e){if(e.key==='Enter'){e.preventDefault();addPhM();}}} placeholder="Nom ou code..." className="w-full" />
          {phL&&<span className="absolute animate-spin" style={{right:12,top:10}}>⏳</span>}
          <Drop items={phR} show={phD} render={function(p){return <button key={p.ID} type="button" onClick={function(){addPh(p);}} style={{display:'block',width:'100%',textAlign:'left',padding:'12px 16px',background:'transparent',border:'none',borderBottom:'1px solid #f1f5f9'}}><span className="font-medium">🏥 {p.NOMPRENOM}</span><span className="text-xs text-slate-400 ml-2">{p.SPECIALITE} · {p.SECTEUR} · Code: {p.CODEPROSPECT}</span></button>;}} />
        </div>
        <button type="button" onClick={addPhM} disabled={!phQ.trim()} className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm font-medium mb-4" style={{border:'none'}}>+ Ajouter</button>
        {pharmacies.length===0?<p className="text-sm text-slate-300 text-center" style={{padding:'12px 0'}}>Aucune pharmacie</p>:(
          <div className="grid grid-2 gap-2">
            {pharmacies.map(function(p){return <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border" style={{borderColor:'#e2e8f0'}}><div><p className="text-sm font-medium text-slate-800">🏥 {p.name}</p>{(p.specialite||p.secteur)&&<p className="text-xs text-slate-400">{p.specialite}{p.specialite&&p.secteur?' · ':''}{p.secteur}</p>}</div><button type="button" onClick={function(){remPh(p.id);}} style={{background:'none',border:'none',color:'#94a3b8',cursor:'pointer'}}>✕</button></div>;})}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2" style={{paddingBottom:24}}>
        <button type="button" onClick={onCancel} className="bg-white rounded-lg px-5 py-3 text-sm font-medium text-slate-600 border" style={{borderColor:'#cbd5e1'}}>Annuler</button>
        <button type="submit" disabled={submitting} className="bg-indigo-600 text-white rounded-lg px-5 py-3 text-sm font-medium" style={{border:'none',opacity:submitting?0.6:1,cursor:submitting?'not-allowed':'pointer'}}>{submitting ? <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> Création...</span> : '✅ Créer'}</button>
      </div>
    </form>
  );
}
