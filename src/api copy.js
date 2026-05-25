const API_BASE = (import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:3001/api';

let _connected = false;
let _token = null;

export function getToken() { return _token; }
export function setToken(t) { _token = t; }
export function isBackendConnected() { return _connected; }

export async function checkConnection() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    _connected = !!data.success;
    return _connected;
  } catch {
    _connected = false;
    return false;
  }
}

async function apiCall(endpoint, options) {
  const headers = { 'Content-Type': 'application/json' };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { ...headers, ...(options && options.headers) },
  });
  if (res.status === 401) throw { unauthorized: true };
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Erreur API');
  _connected = true;
  return data.data;
}

export const api = {
  // Auth
  login: (login, pwd) =>
    apiCall('/auth/login', { method: 'POST', body: JSON.stringify({ login, pwd }) }),
  getMe: () => apiCall('/auth/me'),
  logout: () => apiCall('/auth/logout', { method: 'POST' }),

  // References
  searchReferences: (q) =>
    apiCall(`/references/search?q=${encodeURIComponent(q)}`),

  // Produits
  getProduits: () => apiCall('/produits'),

  // Prospects (Prospect + Pharmacies)
  getProspects: () => apiCall('/prospects'),
  searchProspects: (q) =>
    apiCall(`/prospects/search?q=${encodeURIComponent(q)}`),

  // Utilisateurs / Délégués
  getUtilisateurs: () => apiCall('/utilisateurs'),
  searchUtilisateurs: (q) =>
    apiCall(`/utilisateurs/search?q=${encodeURIComponent(q)}`),

  // Partenariats
  getPartenariats: () => apiCall('/partenariats'),
  getPartenariat: (id) => apiCall(`/partenariats/${id}`),
  createPartenariat: (data) =>
    apiCall('/partenariats', { method: 'POST', body: JSON.stringify(data) }),
  updateQuantity: (id, data) =>
    apiCall(`/partenariats/${id}/quantity`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePartenariat: (id) =>
    apiCall(`/partenariats/${id}`, { method: 'DELETE' }),
};
