import { useState } from 'react';
import { api, setToken } from '../api';

export default function Login({ onLogin }) {
  const [login, setLogin] = useState('');
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!login.trim() || !pwd.trim()) { setError('Veuillez saisir vos identifiants'); return; }
    setLoading(true); setError('');
    try {
      const data = await api.login(login.trim(), pwd);
      setToken(data.token);
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err.unauthorized ? 'Identifiants incorrects' : 'Serveur indisponible. Lancez: cd server && npm start');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full" style={{maxWidth:'420px'}}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-indigo-600 text-white mb-4" style={{width:64,height:64,borderRadius:16,fontSize:28}}>📋</div>
          <h1 className="text-2xl font-bold text-slate-900">Gestion des Partenariats</h1>
          <p className="text-slate-500 mt-1 text-sm">Connectez-vous pour continuer</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-8" style={{borderColor:'#e2e8f0'}}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Identifiant</label>
              <input type="text" value={login} onChange={e => setLogin(e.target.value)} placeholder="votre.identifiant" autoFocus className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
              <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••" className="w-full" />
            </div>
            {error && <div className="text-sm text-red-700 bg-red-50 rounded-lg p-3 border" style={{borderColor:'#fecaca'}}>⚠️ {error}</div>}
            <button type="submit" disabled={loading} className="w-full text-white font-medium rounded-lg py-3 bg-indigo-600" style={{border:'none',fontSize:'14px'}}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">Partenariats Pharmaceutiques v2.0</p>
      </div>
    </div>
  );
}
