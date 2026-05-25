import { useState, useEffect } from 'react';
import { FALLBACK_PRODUCTS } from '../types';
import { api } from '../api';

export default function ProductSelector({ products, onAdd, onRemove }) {
  var [db, setDb] = useState([]);
  var [sel, setSel] = useState('');
  var [boxes, setBoxes] = useState(0);

  useEffect(function() {
    api.getProduits()
      .then(function(r) { setDb(r.length > 0 ? r.map(function(x) { return x.PRODUIT; }) : FALLBACK_PRODUCTS); })
      .catch(function() { setDb(FALLBACK_PRODUCTS); });
  }, []);

  function add() {
    if (!sel.trim()) return;
    for (var i = 0; i < products.length; i++) { if (products[i].name.toLowerCase() === sel.toLowerCase()) return; }
    onAdd({ id: Math.random().toString(36).substring(2,9)+Date.now().toString(36), name: sel, boxes: boxes || 0 });
    setSel(''); setBoxes(0);
  }

  var avail = db.filter(function(n) { return !products.find(function(p) { return p.name.toLowerCase() === n.toLowerCase(); }); });

  return (
    <div className="bg-white rounded-xl border p-5" style={{borderColor:'#e2e8f0'}}>
      <h3 className="text-sm font-bold text-slate-900 mb-4">6. Produits <span className="text-xs text-slate-400 ml-1">({products.length})</span></h3>
      <div className="flex flex-wrap items-end gap-3 mb-4 bg-slate-50 rounded-lg p-3">
        <div className="flex-1" style={{minWidth:180}}>
          <label className="block text-xs font-medium text-slate-500 mb-1">Produit</label>
          <select value={sel} onChange={function(e){setSel(e.target.value);}} className="w-full">
            <option value="">-- Choisir --</option>
            {avail.map(function(n){return <option key={n} value={n}>{n}</option>;})}
          </select>
        </div>
        <div style={{width:100}}>
          <label className="block text-xs font-medium text-slate-500 mb-1">Boîtes</label>
          <input type="number" min="0" value={boxes||''} onChange={function(e){setBoxes(parseInt(e.target.value)||0);}} placeholder="0" className="w-full" />
        </div>
        <button type="button" onClick={add} disabled={!sel.trim()} className="bg-purple-600 text-white rounded-lg px-4 py-3 text-sm font-medium" style={{border:'none'}}>+ Ajouter</button>
      </div>
      {products.length===0?<p className="text-sm text-slate-300 text-center" style={{padding:'12px 0'}}>Aucun produit</p>:(
        <div className="flex flex-wrap gap-2">
          {products.map(function(p){return (
            <span key={p.id} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{background:'#faf5ff',border:'1px solid #e9d5ff'}}>
              <span className="font-medium" style={{color:'#7e22ce'}}>{p.name}</span>
              <span className="text-xs" style={{color:'#a855f7'}}>({p.boxes})</span>
              <button type="button" onClick={function(){onRemove(p.id);}} style={{background:'none',border:'none',color:'#cbd5e1',cursor:'pointer',marginLeft:2}}>✕</button>
            </span>
          );})}
        </div>
      )}
    </div>
  );
}
