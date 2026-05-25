var API_BASE = (import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:3001/api';

var _connected = false;
var _token = null;

export function getToken() { return _token; }
export function setToken(t) { _token = t; }
export function isBackendConnected() { return _connected; }

export async function checkConnection() {
  try {
    var res = await fetch(API_BASE + '/health', { signal: AbortSignal.timeout(3000) });
    var data = await res.json();
    _connected = !!data.success;
    return _connected;
  } catch { _connected = false; return false; }
}

async function apiCall(endpoint, options) {
  var headers = { 'Content-Type': 'application/json' };
  if (_token) headers['Authorization'] = 'Bearer ' + _token;
  var res = await fetch(API_BASE + endpoint, Object.assign({}, options, { headers: Object.assign({}, headers, (options && options.headers)) }));
  if (res.status === 401) throw { unauthorized: true };
  var data = await res.json();
  if (!data.success) throw new Error(data.error || 'Erreur API');
  _connected = true;
  return data.data;
}

export var api = {
  login: function(l, p) { return apiCall('/auth/login', { method: 'POST', body: JSON.stringify({ login: l, pwd: p }) }); },
  getMe: function() { return apiCall('/auth/me'); },
  logout: function() { return apiCall('/auth/logout', { method: 'POST' }); },
  searchReferences: function(q) { return apiCall('/references/search?q=' + encodeURIComponent(q)); },
  getProduits: function() { return apiCall('/produits'); },
  getProspects: function() { return apiCall('/prospects'); },
  searchProspects: function(q) { return apiCall('/prospects/search?q=' + encodeURIComponent(q)); },
  getUtilisateurs: function() { return apiCall('/utilisateurs'); },
  searchUtilisateurs: function(q) { return apiCall('/utilisateurs/search?q=' + encodeURIComponent(q)); },
  getPartenariats: function() { return apiCall('/partenariats'); },
  getPartenariat: function(id) { return apiCall('/partenariats/' + id); },
  createPartenariat: function(data) { return apiCall('/partenariats', { method: 'POST', body: JSON.stringify(data) }); },
  updateQuantity: function(id, data) { return apiCall('/partenariats/' + id + '/quantity', { method: 'PUT', body: JSON.stringify(data) }); },
  deletePartenariat: function(id) { return apiCall('/partenariats/' + id, { method: 'DELETE' }); },
  activateMonth: function(id, month) { return apiCall('/partenariats/' + id + '/activate-month', { method: 'POST', body: JSON.stringify({ month: month }) }); },
  unlockMonth: function(id, month) { return apiCall('/partenariats/' + id + '/unlock-month', { method: 'POST', body: JSON.stringify({ month: month }) }); },
  closeMonth: function(id, month) { return apiCall('/partenariats/' + id + '/close-month', { method: 'POST', body: JSON.stringify({ month: month }) }); },
  configureMonth: function(id, month, status, autoActivate) { return apiCall('/partenariats/' + id + '/month-config', { method: 'PUT', body: JSON.stringify({ month: month, status: status, autoActivate: autoActivate }) }); },
};
