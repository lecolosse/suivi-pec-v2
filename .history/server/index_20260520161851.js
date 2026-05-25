require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const sessions = new Map();

function generateToken() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var t = ''; for (var i = 0; i < 64; i++) t += c.charAt(Math.floor(Math.random() * c.length));
  return t;
}

function authMiddleware(req, res, next) {
  var auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Non autorisé' });
  var session = sessions.get(auth.substring(7));
  if (!session) return res.status(401).json({ success: false, error: 'Session expirée' });
  req.user = session;
  next();
}

app.get('/api/health', async (_req, res) => {
  try { await db.query('SELECT 1'); res.json({ success: true, message: 'OK' }); }
  catch { res.json({ success: true, message: 'DB unreachable' }); }
});

// ═══════════ AUTH ════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
  try {
    var login = req.body.login, pwd = req.body.pwd;
    if (!login || !pwd) return res.status(400).json({ success: false, error: 'Login et mot de passe requis' });
    var [rows] = await db.query('SELECT ID, login, pwd, type, email FROM users WHERE login = ?', [login]);
    if (rows.length === 0) return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    var user = rows[0];
    if (!await bcrypt.compare(pwd, user.pwd)) return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    var token = generateToken();
    sessions.set(token, { userId: user.ID, login: user.login, type: user.type, email: user.email });
    if (sessions.size > 200) sessions.delete(sessions.keys().next().value);
    res.json({ success: true, data: { token, user: { id: user.ID, login: user.login, type: user.type, email: user.email } } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/auth/me', authMiddleware, function(req, res) {
  res.json({ success: true, data: { id: req.user.userId, login: req.user.login, type: req.user.type, email: req.user.email } });
});

app.post('/api/auth/logout', authMiddleware, function(req, res) {
  sessions.delete(req.headers.authorization.substring(7));
  res.json({ success: true });
});

// ═══════════ REFERENCES ══════════════════════════════════

app.get('/api/references/search', authMiddleware, async function(req, res) {
  try {
    var q = (req.query.q || '').trim();
    if (q.length < 1) return res.json({ success: true, data: [] });
    var [rows] = await db.query('SELECT id, codedemande, Reference, DateDemande, Type, sup, Manifestation, Prospect, Specialite, Secteur FROM reference_etat WHERE Reference LIKE ? LIMIT 20', ['%'+q+'%']);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════ PRODUITS ════════════════════════════════════

app.get('/api/produits', authMiddleware, async function(_req, res) {
  try { var [r] = await db.query('SELECT ID, PRODUIT FROM produits ORDER BY PRODUIT'); res.json({ success: true, data: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════ PROSPECTS ═══════════════════════════════════

app.get('/api/prospects', authMiddleware, async function(_req, res) {
  try { var [r] = await db.query('SELECT ID, CODEPROSPECT, NOMPRENOM, SPECIALITE, SECTEUR FROM prospect ORDER BY NOMPRENOM'); res.json({ success: true, data: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/prospects/search', authMiddleware, async function(req, res) {
  try {
    var q = (req.query.q || '').trim();
    if (q.length < 1) return res.json({ success: true, data: [] });
    var [r] = await db.query('SELECT ID, CODEPROSPECT, NOMPRENOM, SPECIALITE, SECTEUR FROM prospect WHERE NOMPRENOM LIKE ? OR CAST(CODEPROSPECT AS CHAR) LIKE ? ORDER BY NOMPRENOM LIMIT 30', ['%'+q+'%', '%'+q+'%']);
    res.json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════ UTILISATEURS ════════════════════════════════

app.get('/api/utilisateurs', authMiddleware, async function(_req, res) {
  try { var [r] = await db.query('SELECT ID, CODEUTILISATEUR, UTILISATEUR, SUPERVISEUR, TYPEUTILISATEUR, RESEAU FROM utilisateur ORDER BY UTILISATEUR'); res.json({ success: true, data: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/utilisateurs/search', authMiddleware, async function(req, res) {
  try {
    var q = (req.query.q || '').trim();
    if (q.length < 1) return res.json({ success: true, data: [] });
    var [r] = await db.query('SELECT ID, CODEUTILISATEUR, UTILISATEUR, SUPERVISEUR, TYPEUTILISATEUR, RESEAU FROM utilisateur WHERE UTILISATEUR LIKE ? OR SUPERVISEUR LIKE ? OR CAST(CODEUTILISATEUR AS CHAR) LIKE ? ORDER BY UTILISATEUR LIMIT 30', ['%'+q+'%', '%'+q+'%', '%'+q+'%']);
    res.json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════ PARTENARIATS ════════════════════════════════

function buildPartnership(p, prods, pharmas, qtys, creatorName, monthStatuses) {
  var tableData = {};
  for (var i = 0; i < qtys.length; i++) {
    var q = qtys[i];
    var ph = pharmas.find(function(x) { return x.pharmacy_name === q.pharmacy_name; });
    if (!ph) continue;
    var key = ph.id + '|' + q.product_name;
    if (!tableData[key]) tableData[key] = {};
    tableData[key][q.month] = q.quantity;
  }

  // Construire l'objet monthStatus depuis les rows
  var monthStatus = {};
  for (var i = 0; i < monthStatuses.length; i++) {
    var ms = monthStatuses[i];
    monthStatus[ms.month] = ms.status; // 'active' | 'closed' | 'locked'
  }

  // Déterminer le mois actif en cours
  var activeMonth = '';
  for (var m in monthStatus) {
    if (monthStatus[m] === 'active') { activeMonth = m; break; }
  }

  return {
    id: String(p.id), year: p.annee || '', reference: p.reference || '',
    typeManifestation: p.type_manifestation || '', manifestation: p.manifestation || '',
    startMonth: p.start_month || '', endMonth: p.end_month || '',
    followUpEndMonth: p.follow_up_end_month || '',
    prospect: p.prospect || '', supervisor: p.supervisor || '', delegates: p.delegates || '',
    budget: parseFloat(p.budget) || 0, potentialPharmacies: parseFloat(p.potential_pharmacies) || 0,
    createdByName: creatorName || '',
    currentActiveMonth: activeMonth,
    monthStatus: monthStatus,
    products: prods.map(function(pr) { return { id: String(pr.id), name: pr.product_name, boxes: pr.boxes || 0 }; }),
    pharmacies: pharmas.map(function(ph) { return { id: String(ph.id), name: ph.pharmacy_name }; }),
    tableData: tableData,
    createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
  };
}

async function loadRelated(pId) {
  var [prods] = await db.query('SELECT id, product_name, boxes FROM partenariat_produits WHERE partenariat_id = ?', [pId]);
  var [pharmas] = await db.query('SELECT id, pharmacy_name FROM partenariat_pharmacies WHERE partenariat_id = ?', [pId]);
  var [qtys] = await db.query('SELECT pharmacy_name, product_name, month, quantity FROM partenariat_quantities WHERE partenariat_id = ?', [pId]);
  var [mss] = await db.query('SELECT month, status FROM partenariat_month_status WHERE partenariat_id = ?', [pId]);
  return { prods: prods, pharmas: pharmas, qtys: qtys, mss: mss };
}

async function getCreatorName(createdBy) {
  if (!createdBy) return '';
  try { var [r] = await db.query('SELECT login FROM users WHERE ID = ?', [createdBy]); return r.length > 0 ? r[0].login : ''; }
  catch { return ''; }
}

// GET all
app.get('/api/partenariats', authMiddleware, async function(req, res) {
  try {
    var role = req.user.type; var rows;
    if (role === 'admin') { [rows] = await db.query('SELECT * FROM partenariats ORDER BY created_at DESC'); }
    else if (role === 'dm') { [rows] = await db.query('SELECT * FROM partenariats WHERE created_by = ? ORDER BY created_at DESC', [req.user.userId]); }
    else if (role === 'sup') {
      [rows] = await db.query('SELECT DISTINCT p.* FROM partenariats p JOIN users u ON p.created_by = u.ID JOIN utilisateur ut ON u.login = ut.UTILISATEUR WHERE ut.SUPERVISEUR = ? ORDER BY p.created_at DESC', [req.user.login]);
    } else { return res.json({ success: true, data: [] }); }

    var result = [];
    for (var i = 0; i < rows.length; i++) {
      var p = rows[i];
      var rel = await loadRelated(p.id);
      var creatorName = await getCreatorName(p.created_by);
      result.push(buildPartnership(p, rel.prods, rel.pharmas, rel.qtys, creatorName, rel.mss));
    }
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET by id
app.get('/api/partenariats/:id', authMiddleware, async function(req, res) {
  try {
    var [rows] = await db.query('SELECT * FROM partenariats WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Non trouvé' });
    var p = rows[0], role = req.user.type;

    if (role === 'dm' && p.created_by !== req.user.userId) return res.status(403).json({ success: false, error: 'Accès refusé' });
    if (role === 'sup') {
      var [chk] = await db.query('SELECT 1 FROM partenariats p JOIN users u ON p.created_by = u.ID JOIN utilisateur ut ON u.login = ut.UTILISATEUR WHERE p.id = ? AND ut.SUPERVISEUR = ?', [req.params.id, req.user.login]);
      if (chk.length === 0) return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    var rel = await loadRelated(p.id);
    var creatorName = await getCreatorName(p.created_by);
    res.json({ success: true, data: buildPartnership(p, rel.prods, rel.pharmas, rel.qtys, creatorName, rel.mss) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST
app.post('/api/partenariats', authMiddleware, async function(req, res) {
  if (req.user.type !== 'admin' && req.user.type !== 'dm') return res.status(403).json({ success: false, error: 'Droits insuffisants' });
  var conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    var b = req.body;
    var [result] = await conn.query('INSERT INTO partenariats (annee, reference, type_manifestation, manifestation, start_month, end_month, follow_up_end_month, prospect, supervisor, delegates, budget, potential_pharmacies, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [b.year, b.reference, b.typeManifestation, b.manifestation || null, b.startMonth, b.endMonth, b.followUpEndMonth || null, b.prospect || null, b.supervisor || null, b.delegates || null, b.budget || 0, b.potentialPharmacies || 0, req.user.userId]);
    var pid = result.insertId;
    var products = [], pharmacies = [];
    if (b.products) for (var i = 0; i < b.products.length; i++) { var pr = b.products[i]; var [r] = await conn.query('INSERT INTO partenariat_produits (partenariat_id, product_name, boxes) VALUES (?,?,?)', [pid, pr.name, pr.boxes || 0]); products.push({ id: String(r.insertId), name: pr.name, boxes: pr.boxes || 0 }); }
    if (b.pharmacies) for (var j = 0; j < b.pharmacies.length; j++) { var ph = b.pharmacies[j]; var [r2] = await conn.query('INSERT INTO partenariat_pharmacies (partenariat_id, pharmacy_name) VALUES (?,?)', [pid, ph.name]); pharmacies.push({ id: String(r2.insertId), name: ph.name }); }
    await conn.commit();
    res.json({ success: true, data: { id: String(pid), year: b.year, reference: b.reference, typeManifestation: b.typeManifestation, manifestation: b.manifestation || '', startMonth: b.startMonth, endMonth: b.endMonth, followUpEndMonth: b.followUpEndMonth || '', prospect: b.prospect || '', supervisor: b.supervisor || '', delegates: b.delegates || '', budget: b.budget || 0, potentialPharmacies: b.potentialPharmacies || 0, createdByName: req.user.login, currentActiveMonth: '', monthStatus: {}, products: products, pharmacies: pharmacies, tableData: {}, createdAt: new Date().toISOString() } });
  } catch (e) { await conn.rollback(); res.status(500).json({ success: false, error: e.message }); }
  finally { conn.release(); }
});

// PUT quantity
app.put('/api/partenariats/:id/quantity', authMiddleware, async function(req, res) {
  try {
    var id = req.params.id;
    if (req.user.type !== 'admin') {
      var [rows] = await db.query('SELECT created_by FROM partenariats WHERE id = ?', [id]);
      if (rows.length === 0 || rows[0].created_by !== req.user.userId) return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    var pharmacyName = req.body.pharmacyName, productName = req.body.productName, month = req.body.month, quantity = req.body.quantity;
    await db.query('INSERT INTO partenariat_quantities (partenariat_id, pharmacy_name, product_name, month, quantity) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)', [id, pharmacyName, productName, month, quantity || 0]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE
app.delete('/api/partenariats/:id', authMiddleware, async function(req, res) {
  if (req.user.type !== 'admin') return res.status(403).json({ success: false, error: 'Seul un administrateur peut supprimer' });
  try { await db.query('DELETE FROM partenariats WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════ GESTION DES MOIS ════════════════════════════

// POST: Activer le mois suivant (admin seulement)
app.post('/api/partenariats/:id/activate-month', authMiddleware, async function(req, res) {
  if (req.user.type !== 'admin') return res.status(403).json({ success: false, error: 'Admin seulement' });
  try {
    var id = req.params.id, month = req.body.month;
    await db.query('INSERT INTO partenariat_month_status (partenariat_id, month, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)', [id, month, 'active']);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST: Débloquer un mois (admin seulement)
app.post('/api/partenariats/:id/unlock-month', authMiddleware, async function(req, res) {
  if (req.user.type !== 'admin') return res.status(403).json({ success: false, error: 'Admin seulement' });
  try {
    var id = req.params.id, month = req.body.month;
    await db.query('INSERT INTO partenariat_month_status (partenariat_id, month, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)', [id, month, 'active']);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST: Clôturer le mois actif (dm peut clôturer son mois actif)
app.post('/api/partenariats/:id/close-month', authMiddleware, async function(req, res) {
  try {
    var id = req.params.id, month = req.body.month;
    // Vérifier que le mois est actif
    var [ms] = await db.query('SELECT status FROM partenariat_month_status WHERE partenariat_id = ? AND month = ?', [id, month]);
    if (ms.length === 0 || ms[0].status !== 'active') return res.status(400).json({ success: false, error: 'Ce mois ne peut pas être clôturé' });

    // Vérifier que le délégué peut clôturer (propriétaire)
    if (req.user.type === 'dm') {
      var [check] = await db.query('SELECT created_by FROM partenariats WHERE id = ?', [id]);
      if (check.length === 0 || check[0].created_by !== req.user.userId) return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    await db.query('UPDATE partenariat_month_status SET status = ? WHERE partenariat_id = ? AND month = ?', ['closed', id, month]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.listen(PORT, function() { console.log('\n🚀 Partenariats API → http://localhost:' + PORT + '\n'); });
