require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));

const sessions = new Map();

function generateToken() {
  var c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
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

// ── Helper: Un mois peut-il être activé maintenant ? ──
// Pour simuler: ajouter SIMULATE_DATE=2025-06-01 dans server/.env
function getNow() {
  var sim = process.env.SIMULATE_DATE;
  if (sim) return new Date(sim);
  return new Date();
}
function canActivateMonth(ym) {
  // Le mois M s'active le 1er du mois M+1
  // Ex: Mai 2025 → activable à partir du 1er Juin 2025
  // Ex: Juin 2025 → activable à partir du 1er Juillet 2025
  var parts = ym.split('-');
  var y = parseInt(parts[0]), m = parseInt(parts[1]);
  var actM = m + 1, actY = y;
  if (actM > 12) { actM = 1; actY++; }
  var activationDate = new Date(actY, actM - 1, 1, 0, 0, 0);
  var now = getNow();
  return now >= activationDate;
}

app.get('/api/health', async function(_req, res) {
  try { await db.query('SELECT 1'); res.json({ success: true, message: 'OK' }); }
  catch { res.json({ success: true, message: 'DB unreachable' }); }
});

// ═══════════ AUTH ════════════════════════════════════════

app.post('/api/auth/login', async function(req, res) {
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
    res.json({ success: true, data: { token: token, user: { id: user.ID, login: user.login, type: user.type, email: user.email } } });
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
  try { var q = (req.query.q || '').trim(); if (q.length < 1) return res.json({ success: true, data: [] });
    var [rows] = await db.query('SELECT id, codedemande, Reference, DateDemande, Type, sup, Manifestation, Prospect, Specialite, Secteur FROM reference_etat WHERE Reference LIKE ? LIMIT 20', ['%'+q+'%']); res.json({ success: true, data: rows }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
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
  try { var q = (req.query.q || '').trim(); if (q.length < 1) return res.json({ success: true, data: [] });
    var [r] = await db.query('SELECT ID, CODEPROSPECT, NOMPRENOM, SPECIALITE, SECTEUR FROM prospect WHERE NOMPRENOM LIKE ? OR CAST(CODEPROSPECT AS CHAR) LIKE ? ORDER BY NOMPRENOM LIMIT 30', ['%'+q+'%', '%'+q+'%']); res.json({ success: true, data: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════ UTILISATEURS ════════════════════════════════
app.get('/api/utilisateurs', authMiddleware, async function(_req, res) {
  try { var [r] = await db.query('SELECT ID, CODEUTILISATEUR, UTILISATEUR, SUPERVISEUR, TYPEUTILISATEUR, RESEAU FROM utilisateur ORDER BY UTILISATEUR'); res.json({ success: true, data: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/utilisateurs/search', authMiddleware, async function(req, res) {
  try { var q = (req.query.q || '').trim(); if (q.length < 1) return res.json({ success: true, data: [] });
    var [r] = await db.query('SELECT ID, CODEUTILISATEUR, UTILISATEUR, SUPERVISEUR, TYPEUTILISATEUR, RESEAU FROM utilisateur WHERE UTILISATEUR LIKE ? OR SUPERVISEUR LIKE ? OR CAST(CODEUTILISATEUR AS CHAR) LIKE ? ORDER BY UTILISATEUR LIMIT 30', ['%'+q+'%', '%'+q+'%', '%'+q+'%']); res.json({ success: true, data: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════ PARTENARIATS ════════════════════════════════

async function computeMonthStatuses(partenariatId, months) {
  var [mss] = await db.query('SELECT month, status, manual_close FROM partenariat_month_status WHERE partenariat_id = ?', [partenariatId]);
  var dbStatuses = {};
  for (var i = 0; i < mss.length; i++) {
    dbStatuses[mss[i].month] = { status: mss[i].status, manualClose: !!mss[i].manual_close };
  }

  if (Object.keys(dbStatuses).length === 0) {
    for (var i = 0; i < months.length; i++) {
      var ym = months[i];
      await db.query('INSERT INTO partenariat_month_status (partenariat_id, month, status, manual_close) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status), manual_close=VALUES(manual_close)', [partenariatId, ym, 'inactive', 0]);
      dbStatuses[ym] = { status: 'inactive', manualClose: false };
    }
  }

  // Vérifier s'il y a un mois "active" en base et s'il est toujours valide
  var hasActive = false;
  for (var m in dbStatuses) {
    if (dbStatuses[m].status === 'active') {
      if (canActivateMonth(m)) {
        hasActive = true;
      } else {
        // Mois actif mais pas encore activable → le remettre en inactive
        await db.query('UPDATE partenariat_month_status SET status = ? WHERE partenariat_id = ? AND month = ?', ['inactive', partenariatId, m]);
        dbStatuses[m].status = 'inactive';
      }
    }
  }

  // Activer automatiquement le mois en cours (celui qui vient de se terminer)
  // si aucun mois n'est déjà actif
  if (!hasActive) {
    var now = new Date();
    var currentYm = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    for (var i = 0; i < months.length; i++) {
      var ym = months[i];
      var entry = dbStatuses[ym];
      if (entry && entry.manualClose && canActivateMonth(ym) && entry.status !== 'closed') {
        // Activer le premier mois éligible
        await db.query('UPDATE partenariat_month_status SET status = ? WHERE partenariat_id = ? AND month = ?', ['active', partenariatId, ym]);
        entry.status = 'active';
        hasActive = true;
        break;
      }
    }
  }

  var result = {};
  var manual = {};
  for (var m in dbStatuses) {
    result[m] = dbStatuses[m].status;
    manual[m] = dbStatuses[m].manualClose;
  }
  result._manual = manual;
  return result;
}

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

  var manual = monthStatuses._manual || {};
  var monthStatus = {};
  for (var m in monthStatuses) { if (m === '_manual') continue; monthStatus[m] = monthStatuses[m]; }

  var activeMonth = '';
  for (var m in monthStatus) { if (monthStatus[m] === 'active') { activeMonth = m; break; } }

  return {
    id: String(p.id), year: p.annee || '', reference: p.reference || '',
    typeManifestation: p.type_manifestation || '', manifestation: p.manifestation || '',
    startMonth: p.start_month || '', endMonth: p.end_month || '',
    followUpEndMonth: p.follow_up_end_month || '',
    prospect: p.prospect || '', supervisor: p.supervisor || '', delegates: p.delegates || '',
    budget: parseFloat(p.budget) || 0, potentialPharmacies: parseFloat(p.potential_pharmacies) || 0,
    createdByName: creatorName || '',
    currentActiveMonth: activeMonth, monthStatus: monthStatus, manualClose: manual,
    products: prods.map(function(pr) { return { id: String(pr.id), name: pr.product_name, boxes: pr.boxes || 0 }; }),
    pharmacies: pharmas.map(function(ph) { return { id: String(ph.id), name: ph.pharmacy_name }; }),
    tableData: tableData,
    createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
  };
}

function generateMonthsFromDB(startMonth, endMonth) {
  var m = []; if (!startMonth || !endMonth) return m;
  var p1 = startMonth.split('-').map(Number), p2 = endMonth.split('-').map(Number);
  var cY = p1[0], cM = p1[1];
  while (cY < p2[0] || (cY === p2[0] && cM <= p2[1])) { m.push(cY + '-' + String(cM).padStart(2, '0')); cM++; if (cM > 12) { cM = 1; cY++; } }
  return m;
}

async function loadRelated(pId) {
  var [prods] = await db.query('SELECT id, product_name, boxes FROM partenariat_produits WHERE partenariat_id = ?', [pId]);
  var [pharmas] = await db.query('SELECT id, pharmacy_name FROM partenariat_pharmacies WHERE partenariat_id = ?', [pId]);
  var [qtys] = await db.query('SELECT pharmacy_name, product_name, month, quantity FROM partenariat_quantities WHERE partenariat_id = ?', [pId]);
  var [pRow] = await db.query('SELECT start_month, follow_up_end_month, end_month FROM partenariats WHERE id = ?', [pId]);
  var months = []; if (pRow.length > 0) { months = generateMonthsFromDB(pRow[0].start_month, pRow[0].follow_up_end_month || pRow[0].end_month); }
  var ms = await computeMonthStatuses(pId, months);
  return { prods: prods, pharmas: pharmas, qtys: qtys, mss: ms };
}

async function getCreatorName(id) { if (!id) return ''; try { var [r] = await db.query('SELECT login FROM users WHERE ID = ?', [id]); return r.length > 0 ? r[0].login : ''; } catch { return ''; } }

// GET all
app.get('/api/partenariats', authMiddleware, async function(req, res) {
  try {
    var rows;
    if (req.user.type === 'admin') { [rows] = await db.query('SELECT * FROM partenariats ORDER BY created_at DESC'); }
    else if (req.user.type === 'dm') { [rows] = await db.query('SELECT * FROM partenariats WHERE created_by = ? ORDER BY created_at DESC', [req.user.userId]); }
    else if (req.user.type === 'sup') { [rows] = await db.query('SELECT DISTINCT p.* FROM partenariats p JOIN users u ON p.created_by = u.ID JOIN utilisateur ut ON u.login = ut.UTILISATEUR WHERE ut.SUPERVISEUR = ? ORDER BY p.created_at DESC', [req.user.login]); }
    else { return res.json({ success: true, data: [] }); }
    var result = [];
    for (var i = 0; i < rows.length; i++) { var p = rows[i]; var rel = await loadRelated(p.id); result.push(buildPartnership(p, rel.prods, rel.pharmas, rel.qtys, await getCreatorName(p.created_by), rel.mss)); }
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET by id
app.get('/api/partenariats/:id', authMiddleware, async function(req, res) {
  try {
    var [rows] = await db.query('SELECT * FROM partenariats WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Non trouvé' });
    var p = rows[0];
    if (req.user.type === 'dm' && p.created_by !== req.user.userId) return res.status(403).json({ success: false, error: 'Accès refusé' });
    if (req.user.type === 'sup') { var [chk] = await db.query('SELECT 1 FROM partenariats p JOIN users u ON p.created_by = u.ID JOIN utilisateur ut ON u.login = ut.UTILISATEUR WHERE p.id = ? AND ut.SUPERVISEUR = ?', [req.params.id, req.user.login]); if (chk.length === 0) return res.status(403).json({ success: false, error: 'Accès refusé' }); }
    var rel = await loadRelated(p.id); res.json({ success: true, data: buildPartnership(p, rel.prods, rel.pharmas, rel.qtys, await getCreatorName(p.created_by), rel.mss) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST
app.post('/api/partenariats', authMiddleware, async function(req, res) {
  if (req.user.type !== 'admin' && req.user.type !== 'dm') return res.status(403).json({ success: false, error: 'Droits insuffisants' });
  var conn = await db.getConnection();
  try {
    await conn.beginTransaction(); var b = req.body;
    var [result] = await conn.query('INSERT INTO partenariats (annee, reference, type_manifestation, manifestation, start_month, end_month, follow_up_end_month, prospect, supervisor, delegates, budget, potential_pharmacies, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [b.year, b.reference, b.typeManifestation, b.manifestation || null, b.startMonth, b.endMonth, b.followUpEndMonth || null, b.prospect || null, b.supervisor || null, b.delegates || null, b.budget || 0, b.potentialPharmacies || 0, req.user.userId]);
    var pid = result.insertId; var products = [], pharmacies = [];
    if (b.products) for (var i = 0; i < b.products.length; i++) { var [r] = await conn.query('INSERT INTO partenariat_produits (partenariat_id, product_name, boxes) VALUES (?,?,?)', [pid, b.products[i].name, b.products[i].boxes || 0]); products.push({ id: String(r.insertId), name: b.products[i].name, boxes: b.products[i].boxes || 0 }); }
    if (b.pharmacies) for (var j = 0; j < b.pharmacies.length; j++) { var [r2] = await conn.query('INSERT INTO partenariat_pharmacies (partenariat_id, pharmacy_name) VALUES (?,?)', [pid, b.pharmacies[j].name]); pharmacies.push({ id: String(r2.insertId), name: b.pharmacies[j].name }); }
    await conn.commit();
    res.json({ success: true, data: { id: String(pid), year: b.year, reference: b.reference, typeManifestation: b.typeManifestation, manifestation: b.manifestation || '', startMonth: b.startMonth, endMonth: b.endMonth, followUpEndMonth: b.followUpEndMonth || '', prospect: b.prospect || '', supervisor: b.supervisor || '', delegates: b.delegates || '', budget: b.budget || 0, potentialPharmacies: b.potentialPharmacies || 0, createdByName: req.user.login, currentActiveMonth: '', monthStatus: {}, manualClose: {}, products: products, pharmacies: pharmacies, tableData: {}, createdAt: new Date().toISOString() } });
  } catch (e) { await conn.rollback(); res.status(500).json({ success: false, error: e.message }); }
  finally { conn.release(); }
});

// PUT quantity
app.put('/api/partenariats/:id/quantity', authMiddleware, async function(req, res) {
  try {
    if (req.user.type !== 'admin') { var [rows] = await db.query('SELECT created_by FROM partenariats WHERE id = ?', [req.params.id]); if (rows.length === 0 || rows[0].created_by !== req.user.userId) return res.status(403).json({ success: false, error: 'Accès refusé' }); }
    await db.query('INSERT INTO partenariat_quantities (partenariat_id, pharmacy_name, product_name, month, quantity) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)', [req.params.id, req.body.pharmacyName, req.body.productName, req.body.month, req.body.quantity || 0]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE
app.delete('/api/partenariats/:id', authMiddleware, async function(req, res) {
  if (req.user.type !== 'admin') return res.status(403).json({ success: false, error: 'Admin seulement' });
  try { await db.query('DELETE FROM partenariats WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════ GESTION MOIS ════════════════════════════════

// PUT: Configurer un mois (admin) — avec validation canActivateMonth
app.put('/api/partenariats/:id/month-config', authMiddleware, async function(req, res) {
  if (req.user.type !== 'admin') return res.status(403).json({ success: false, error: 'Admin seulement' });
  try {
    var id = req.params.id, month = req.body.month, newStatus = req.body.status, autoActivate = req.body.autoActivate ? 1 : 0;

    // Si l'admin essaie d'activer un mois, vérifier qu'il est activable
    if (newStatus === 'active' && !canActivateMonth(month)) {
      return res.status(400).json({ success: false, error: 'Ce mois ne peut pas encore être activé (disponible le 1er du mois suivant)' });
    }

    if (newStatus === 'active') {
      await db.query('UPDATE partenariat_month_status SET status = ? WHERE partenariat_id = ?', ['inactive', id]);
    }

    await db.query('INSERT INTO partenariat_month_status (partenariat_id, month, status, manual_close) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE status = VALUES(status), manual_close = VALUES(manual_close)', [id, month, newStatus, autoActivate]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST: Clôturer le mois actif
app.post('/api/partenariats/:id/close-month', authMiddleware, async function(req, res) {
  try {
    var id = req.params.id, month = req.body.month;
    if (req.user.type === 'dm') {
      var [check] = await db.query('SELECT created_by FROM partenariats WHERE id = ?', [id]);
      if (check.length === 0 || check[0].created_by !== req.user.userId) return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    await db.query('UPDATE partenariat_month_status SET status = ? WHERE partenariat_id = ? AND month = ?', ['closed', id, month]);

    // Activer le prochain mois avec autoActivate=true (s'il est activable)
    var [allMonths] = await db.query('SELECT month, manual_close FROM partenariat_month_status WHERE partenariat_id = ? ORDER BY month', [id]);
    for (var i = 0; i < allMonths.length; i++) {
      if (allMonths[i].month > month && allMonths[i].manual_close && canActivateMonth(allMonths[i].month)) {
        // Désactiver tout autre mois actif
        await db.query('UPDATE partenariat_month_status SET status = ? WHERE partenariat_id = ?', ['inactive', id]);
        await db.query('UPDATE partenariat_month_status SET status = ? WHERE partenariat_id = ? AND month = ?', ['active', id, allMonths[i].month]);
        break;
      }
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.listen(PORT, function() { console.log('\n🚀 API → http://localhost:' + PORT + '\n'); });
