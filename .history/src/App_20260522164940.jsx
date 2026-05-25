import { useState, useEffect, useCallback } from 'react';
import { formatMonth, generateMonths } from './types';
import { api, checkConnection, setToken } from './api';
import Login from './components/Login';
import PartnershipForm from './components/PartnershipForm';
import PartnershipDetail from './components/PartnershipDetail';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [partnerships, setPartnerships] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const role = currentUser ? currentUser.type : '';
  const canCreate = role === 'admin' || role === 'dm';

  useEffect(() => {
    (async () => {
      const connected = await checkConnection();
      if (!connected) { setLoading(false); return; }
      var t = localStorage.getItem('auth_token');
      if (t) {
        try {
          setToken(t);
          var me = await api.getMe();
          setCurrentUser(me);
          var d = await api.getPartenariats();
          setPartnerships(d);
        } catch (e) { setToken(null); localStorage.removeItem('auth_token'); }
      }
      setLoading(false);
    })();
  }, []);

  function handleLogin(user) {
    setCurrentUser(user); setLoading(true);
    api.getPartenariats()
      .then(function(d) { setPartnerships(d); setLoading(false); })
      .catch(function() { setPartnerships([]); setLoading(false); });
  }

  async function handleLogout() {
    try { await api.logout(); } catch(e) {}
    setToken(null); localStorage.removeItem('auth_token');
    setCurrentUser(null); setPartnerships([]); setView('dashboard');
  }

  var handleCreate = useCallback(async function(p) {
    try {
      var c = await api.createPartenariat({
        year: p.year, reference: p.reference, typeManifestation: p.typeManifestation,
        manifestation: p.manifestation, startMonth: p.startMonth, endMonth: p.endMonth,
        followUpEndMonth: p.followUpEndMonth, prospect: p.prospect, supervisor: p.supervisor,
        delegates: p.delegates, budget: p.budget, potentialPharmacies: p.potentialPharmacies,
        products: p.products.map(function(x) { return {name:x.name,boxes:x.boxes}; }),
        pharmacies: p.pharmacies.map(function(x) { return {name:x.name}; }),
      });
      setPartnerships(function(prev) { return prev.concat([c]); });
      setSelectedId(c.id); setView('detail');
    } catch(e) { console.error(e); }
  }, []);

  var handleUpdate = useCallback(function(u) {
    setPartnerships(function(prev) { return prev.map(function(p) { return p.id===u.id?u:p; }); });
  }, []);

  var handleDelete = useCallback(async function(id) {
    try { await api.deletePartenariat(id); } catch(e) {}
    setPartnerships(function(prev) { return prev.filter(function(p) { return p.id!==id; }); });
    setSelectedId(null); setView('dashboard');
  }, []);

  var selectedPartnership = partnerships.find(function(p) { return p.id === selectedId; });
  var filtered = partnerships.filter(function(p) {
    var q = searchTerm.toLowerCase();
    return p.reference.toLowerCase().indexOf(q)>=0 || p.prospect.toLowerCase().indexOf(q)>=0 || (p.createdByName||'').toLowerCase().indexOf(q)>=0 || p.typeManifestation.toLowerCase().indexOf(q)>=0;
  });

  var roleLabels = { admin:'Admin', dm:'Délégué', sup:'Superviseur' };
  var roleColors = { admin:'#fef2f2', dm:'#eff6ff', sup:'#f0fdf4' };
  var roleTextColors = { admin:'#b91c1c', dm:'#1d4ed8', sup:'#15803d' };

  if (!currentUser) {
    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><div className="animate-spin" style={{width:32,height:32,border:'3px solid #cbd5e1',borderTopColor:'#4f46e5',borderRadius:'50%'}}></div></div>;
    return <Login onLogin={handleLogin} />;
  }
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><div className="animate-spin" style={{width:32,height:32,border:'3px solid #cbd5e1',borderTopColor:'#4f46e5',borderRadius:'50%'}}></div></div>;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white" style={{borderBottom:'1px solid #e2e8f0',boxShadow:'0 1px 2px rgba(0,0,0,.05)'}}>
        <div className="mx-auto px-4 flex items-center justify-between" style={{maxWidth:1280,height:64}}>
          <button onClick={function(){setView('dashboard');}} className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white flex items-center justify-center rounded-lg" style={{width:36,height:36,fontSize:16}}>📋</div>
            <span className="font-bold text-slate-900 hidden sm-block">Partenariats</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{background:roleColors[role]||'#f1f5f9',color:roleTextColors[role]||'#475569'}}>{roleLabels[role]||role}</span>
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border" style={{borderColor:'#e2e8f0'}}>
              <div className="bg-indigo-600 text-white flex items-center justify-center rounded-md text-xs font-bold" style={{width:28,height:28}}>{currentUser.login.charAt(0).toUpperCase()}</div>
              <span className="text-sm font-medium text-slate-700 hidden sm-block">{currentUser.login}</span>
            </div>
            {canCreate && view==='dashboard' && (
              <button onClick={function(){setView('create');}} className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium" style={{border:'none'}}>+ Nouveau</button>
            )}
            {view!=='dashboard' && (
              <button onClick={function(){setView('dashboard');}} className="bg-white rounded-lg px-4 py-2 text-sm font-medium text-slate-700 border" style={{borderColor:'#cbd5e1'}}>← Retour</button>
            )}
            <button onClick={handleLogout} className="bg-white rounded-lg text-slate-400 border" style={{borderColor:'#e2e8f0',padding:'8px'}} title="Déconnexion">⏻</button>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <div className="mx-auto px-4 py-6" style={{maxWidth:1280}}>

        {/* DASHBOARD */}
        {view==='dashboard' && (
          <div className="space-y-5">
            <div className="grid grid-3 gap-4">
              <div className="bg-white rounded-xl border p-5" style={{borderColor:'#e2e8f0'}}>
                <p className="text-xs font-medium text-slate-400 uppercase mb-1">PARTENARIATS</p>
                <p className="text-3xl font-extrabold text-slate-900">{partnerships.length}</p>
              </div>
              <div className="bg-white rounded-xl border p-5" style={{borderColor:'#e2e8f0'}}>
                <p className="text-xs font-medium text-slate-400 uppercase mb-1">BUDGET TOTAL</p>
                <p className="text-2xl font-extrabold text-slate-900">{partnerships.reduce(function(s,p){return s+p.budget;},0).toLocaleString('fr-FR')} <span className="text-sm font-medium text-slate-400">TND</span></p>
              </div>
              <div className="bg-white rounded-xl border p-5" style={{borderColor:'#e2e8f0'}}>
                <p className="text-xs font-medium text-slate-400 uppercase mb-1">UTILISATEUR</p>
                <p className="text-lg font-bold text-slate-900">{currentUser.login}</p>
                <p className="text-sm text-slate-400">{roleLabels[role]}</p>
              </div>
            </div>

            {partnerships.length>0 && (
              <input type="text" value={searchTerm} onChange={function(e){setSearchTerm(e.target.value);}} placeholder="🔍 Rechercher..." className="w-full" style={{padding:'12px 16px'}} />
            )}

            {partnerships.length===0 ? (
              canCreate ? (
                <div className="text-center py-16">
                  <div className="mx-auto mb-4 flex items-center justify-center bg-slate-100 rounded-2xl" style={{width:64,height:64,fontSize:28}}>📋</div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Aucun partenariat</h3>
                  <p className="text-slate-400 mb-6 text-sm">Créez votre premier partenariat.</p>
                  <button onClick={function(){setView('create');}} className="bg-indigo-600 text-white rounded-lg px-6 py-3 text-sm font-medium" style={{border:'none'}}>+ Créer</button>
                </div>
              ) : (
                <div className="text-center py-16"><p className="text-slate-400">Aucun partenariat à afficher.</p></div>
              )
            ) : filtered.length===0 ? (
              <p className="text-center text-slate-400 py-12">Aucun résultat pour "{searchTerm}"</p>
            ) : (
              <div className="grid md-grid-3 xl-grid-3 gap-4">
                {filtered.map(function(p) {
                  var months = generateMonths(p.startMonth, p.followUpEndMonth || p.endMonth);
                  return (
                    <div key={p.id} onClick={function(){setSelectedId(p.id);setView('detail');}} className="bg-white rounded-xl overflow-hidden cursor-pointer border" style={{borderColor:'#e2e8f0',transition:'box-shadow .2s, border-color .2s'}}
                      onMouseEnter={function(e){e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.1)';e.currentTarget.style.borderColor='#a5b4fc';}}
                      onMouseLeave={function(e){e.currentTarget.style.boxShadow='';e.currentTarget.style.borderColor='#e2e8f0';}}>
                      <div className="px-5 py-4" style={{background:p.contratStatus==='Honnore'?'#16a34a':p.contratStatus==='NonHonnore'?'#dc2626':p.contratStatus==='Desistement'?'#ea580c':p.contratStatus==='Autre'?'#ca8a04':'#4f46e5'}}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-semibold uppercase" style={{color:'rgba(255,255,255,.6)',letterSpacing:'.05em'}}>Référence</p>
                            <p className="text-white font-bold mt-1">{p.reference}</p>
                          </div>
                          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                            <span className="text-xs font-medium px-2 py-1 rounded" style={{background:'rgba(255,255,255,.15)',color:'rgba(255,255,255,.8)'}}>{p.year}</span>
                            {p.contratStatus && <span className="text-xs font-semibold px-2 py-1 rounded" style={{background:'rgba(255,255,255,.25)',color:'#fff'}}>🔒 Clôturé</span>}
                          </div>
                        </div>
                        <p className="text-sm mt-2" style={{color:'rgba(255,255,255,.7)'}}>{p.typeManifestation}</p>
                      </div>
                      <div className="px-5 py-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <span style={{width:20,textAlign:'center'}}>👤</span>
                          <div><p className="text-xs text-slate-400">Prospect</p><p className="text-sm font-medium text-slate-800 truncate">{p.prospect||'—'}</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span style={{width:20,textAlign:'center'}}>📅</span>
                          <div><p className="text-xs text-slate-400">Période</p><p className="text-sm font-medium text-slate-800">{months.length>0?formatMonth(months[0])+' → '+formatMonth(months[months.length-1]):'—'}</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span style={{width:20,textAlign:'center'}}>✍️</span>
                          <div><p className="text-xs text-slate-400">Créé par</p><p className="text-sm font-medium text-slate-800">{p.createdByName||'—'}</p></div>
                        </div>
                      </div>
                      <div className="px-5 py-3 flex items-center justify-between bg-slate-50" style={{borderTop:'1px solid #f1f5f9'}}>
                        <div className="flex gap-2">
                          <span className="text-xs font-medium px-2 py-1 rounded bg-purple-50 text-purple-600">{p.products.length} prod.</span>
                          <span className="text-xs font-medium px-2 py-1 rounded bg-teal-50 text-teal-600">{p.pharmacies.length} phar.</span>
                        </div>
                        <span className="text-xs text-indigo-600 font-semibold">Voir →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CREATE */}
        {view==='create' && canCreate && (
          <div className="mx-auto" style={{maxWidth:768}}>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Nouveau Partenariat</h2>
              <p className="text-sm text-slate-500 mt-1">Remplissez les informations ci-dessous</p>
            </div>
            <PartnershipForm onSubmit={handleCreate} onCancel={function(){setView('dashboard');}} currentUser={currentUser} />
          </div>
        )}

        {/* DETAIL */}
        {view==='detail' && selectedPartnership && (
          <PartnershipDetail partnership={selectedPartnership} onUpdate={handleUpdate} onDelete={handleDelete} onBack={function(){setView('dashboard');}} userRole={role} />
        )}
        {view==='detail' && !selectedPartnership && (
          <div className="text-center py-16"><p className="text-slate-400 mb-4">Non trouvé</p><button onClick={function(){setView('dashboard');}} className="bg-indigo-600 text-white rounded-lg px-5 py-2 text-sm font-medium" style={{border:'none'}}>Retour</button></div>
        )}
      </div>
    </div>
  );
}
