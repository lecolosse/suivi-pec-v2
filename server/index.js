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

// ── Simulation de date ────────────────────────────────────
function getNow() {
  var sim = process.env.SIMULATE_DATE;
  if (sim) return new Date(sim + 'T00:00:00');
  return new Date();
}

// ═══════════ RÈGLES MÉTIER ════════════════════════════════

// 1. Le mois M entre en période d'activation le 1er du mois M+1
// 2. Un mois "manuel" (admin) reste actif indéfiniment jusqu'à clôture manuelle
// 3. Un mois "auto" se clôture automatiquement le 15 du mois M+2 (45j après le début du mois)
// 4. UN SEUL mois actif à la fois

function isMonthActivatable(ym) {
  // Mois M devient activable le 1er du mois M+1
  var parts = ym.split('-').map(Number);
  var y = parts[0], m = parts[1];
  var actM = m + 1, actY = y;
  if (actM > 12) { actM = 1; actY++; }
  return getNow() >= new Date(actY, actM - 1, 1);
}

function isMonthAutoClosed(ym) {
  // Mois M se clôture auto le 15 du mois M+2
  var parts = ym.split('-').map(Number);
  var y = parts[0], m = parts[1];
  var closeM = m + 2, closeY = y;
  if (closeM > 12) { closeM -= 12; closeY++; }
  return getNow() >= new Date(closeY, closeM - 1, 15);
}

// Appliquer les règles à tous les mois d'un partenariat
async function applyMonthRules(partenariatId, months) {
  var [rows] = await db.query('SELECT month, status, manual_close FROM partenariat_month_status WHERE partenariat_id = ?', [partenariatId]);
  var states = {};
  for (var i = 0; i < rows.length; i++) {
    states[rows[i].month] = { status: rows[i].status, manual: !!rows[i].manual_close };
  }

  // Initialiser les mois inexistants
  var changed = false;
  for (var i = 0; i < months.length; i++) {
    var ym = months[i];
    if (!states[ym]) {
      states[ym] = { status: 'inactive', manual: false };
      await db.query('INSERT IGNORE INTO partenariat_month_status (partenariat_id, month, status, manual_close) VALUES (?,?,?,?)', [partenariatId, ym, 'inactive', 0]);
      changed = true;
    }
  }

  // Trouver le mois actif actuel
  var activeMonth = null;
  for (var m in states) {
    if (states[m].status === 'active') { activeMonth = m; break; }
  }

  // Appliquer les règles
  for (var i = 0; i < months.length; i++) {
    var ym = months[i];
    var s = states[ym];

    if (s.manual) {
      // ═══ Mois MANUEL (admin) ═══
      // Il est géré UNIQUEMENT par l'admin (radio box) et le DM (close-month)
      // JAMAIS d'auto-activation ici
      // S'il est actif, vérifier qu'il n'est pas en retard (clôture auto ne s'applique pas aux manuels)
      // Donc on ne fait rien - tout est géré par month-config et close-month
      continue;
    }

    if (!s.manual) {
      // ═══ Mois AUTO ═══
      if (s.status === 'active') {
        // Se clôture automatiquement après 45 jours ?
        if (isMonthAutoClosed(ym)) {
          states[ym].status = 'closed';
          activeMonth = null;
          await db.query('UPDATE partenariat_month_status SET status = ? WHERE partenariat_id = ? AND month = ?', ['closed', partenariatId, ym]);
        }
      } else if (s.status === 'inactive') {
        // S'active automatiquement si c'est le 1er du mois suivant
        // et qu'aucun autre mois n'est actif
        if (!activeMonth && isMonthActivatable(ym)) {
          states[ym].status = 'active';
          activeMonth = ym;
          await db.query('UPDATE partenariat_month_status SET status = ? WHERE partenariat_id = ? AND month = ?', ['active', partenariatId, ym]);
        }
      }
      // closed → ne change pas
    }
  }

  return states;
}

// ═══════════ HELPERS ══════════════════════════════════════

function buildPartnership(p, prods, pharmas, qtys, creatorName, states) {
  var tableData = {};
  for (var i = 0; i < qtys.length; i++) {
    var q = qtys[i];
    var ph = pharmas.find(function(x) { return x.pharmacy_name === q.pharmacy_name; });
    if (!ph) continue;
    var key = ph.id + '|' + q.product_name;
    if (!tableData[key]) tableData[key] = {};
    tableData[key][q.month] = q.quantity;
  }

  var monthStatus = {}, manualClose = {}, activeMonth = '';
  for (var m in states) {
    monthStatus[m] = states[m].status;
    manualClose[m] = states[m].manual;
    if (states[m].status === 'active') activeMonth = m;
  }

  return {
    id: String(p.id), year: p.annee || '', reference: p.reference || '',
    typeManifestation: p.type_manifestation || '', manifestation: p.manifestation || '',
    startMonth: p.start_month || '', endMonth: p.end_month || '',
    followUpEndMonth: p.follow_up_end_month || '',
    prospect: p.prospect || '', supervisor: p.supervisor || '', delegates: p.delegates || '',
    budget: parseFloat(p.budget) || 0, potentialPharmacies: parseFloat(p.potential_pharmacies) || 0,
    createdByName: creatorName || '',
    currentActiveMonth: activeMonth, monthStatus: monthStatus, manualClose: manualClose,
    contratStatus: p.contrat_status || null,
    contratClosedBy: p.contrat_closed_by || null,
    contratClosedAt: p.contrat_closed_at || null,
    contratComment: p.contrat_comment || null,
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
  var months = []; if (pRow.length > 0) months = generateMonthsFromDB(pRow[0].start_month, pRow[0].follow_up_end_month || pRow[0].end_month);
  var states = await applyMonthRules(pId, months);
  return { prods: prods, pharmas: pharmas, qtys: qtys, states: states };
}

async function getCreatorName(id) { if (!id) return ''; try { var [r] = await db.query('SELECT login FROM users WHERE ID = ?', [id]); return r.length > 0 ? r[0].login : ''; } catch { return ''; } }

// ═══════════ ROUTES ══════════════════════════════════════

app.get('/api/health', async function(_req, res) {
  try { await db.query('SELECT 1'); res.json({ success: true, message: 'OK' }); }
  catch { res.json({ success: true, message: 'DB unreachable' }); }
});

app.post('/api/auth/login', async function(req, res) {
  try {
    var login = req.body.login, pwd = req.body.pwd;
    if (!login || !pwd) return res.status(400).json({ success: false, error: 'Login requis' });
    var [rows] = await db.query('SELECT ID, login, pwd, type, email FROM users WHERE login = ?', [login]);
    if (rows.length === 0) return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    if (!await bcrypt.compare(pwd, rows[0].pwd)) return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    var token = generateToken();
    sessions.set(token, { userId: rows[0].ID, login: rows[0].login, type: rows[0].type, email: rows[0].email });
    if (sessions.size > 200) sessions.delete(sessions.keys().next().value);
    res.json({ success: true, data: { token: token, user: { id: rows[0].ID, login: rows[0].login, type: rows[0].type, email: rows[0].email } } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/auth/me', authMiddleware, function(req, res) {
  res.json({ success: true, data: { id: req.user.userId, login: req.user.login, type: req.user.type, email: req.user.email } });
});

app.post('/api/auth/logout', authMiddleware, function(req, res) {
  sessions.delete(req.headers.authorization.substring(7));
  res.json({ success: true });
});

app.get('/api/references/search', authMiddleware, async function(req, res) {
  try { var q = (req.query.q || '').trim(); if (q.length < 1) return res.json({ success: true, data: [] });
    var [rows] = await db.query('SELECT id, codedemande, Reference, DateDemande, Type, sup, Manifestation, Prospect, Specialite, Secteur FROM reference_etat WHERE Reference LIKE ? LIMIT 20', ['%'+q+'%']); res.json({ success: true, data: rows }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/produits', authMiddleware, async function(_req, res) {
  try { var [r] = await db.query('SELECT ID, PRODUIT FROM produits ORDER BY PRODUIT'); res.json({ success: true, data: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/prospects', authMiddleware, async function(_req, res) {
  try { var [r] = await db.query('SELECT ID, CODEPROSPECT, NOMPRENOM, SPECIALITE, SECTEUR FROM prospect ORDER BY NOMPRENOM'); res.json({ success: true, data: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/prospects/search', authMiddleware, async function(req, res) {
  try { var q = (req.query.q || '').trim(); if (q.length < 1) return res.json({ success: true, data: [] });
    var [r] = await db.query('SELECT ID, CODEPROSPECT, NOMPRENOM, SPECIALITE, SECTEUR FROM prospect WHERE NOMPRENOM LIKE ? OR CAST(CODEPROSPECT AS CHAR) LIKE ? ORDER BY NOMPRENOM LIMIT 30', ['%'+q+'%', '%'+q+'%']); res.json({ success: true, data: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/utilisateurs', authMiddleware, async function(_req, res) {
  try { var [r] = await db.query("SELECT ID, CODEUTILISATEUR, UTILISATEUR, SUPERVISEUR, TYPEUTILISATEUR, RESEAU FROM utilisateur WHERE LOWER(TYPEUTILISATEUR) = 'delegue' OR LOWER(TYPEUTILISATEUR) = 'dm' ORDER BY UTILISATEUR"); res.json({ success: true, data: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/utilisateurs/search', authMiddleware, async function(req, res) {
  try { var q = (req.query.q || '').trim(); if (q.length < 1) return res.json({ success: true, data: [] });
    var [r] = await db.query("SELECT ID, CODEUTILISATEUR, UTILISATEUR, SUPERVISEUR, TYPEUTILISATEUR, RESEAU FROM utilisateur WHERE (LOWER(TYPEUTILISATEUR) = 'delegue' OR LOWER(TYPEUTILISATEUR) = 'dm') AND (UTILISATEUR LIKE ? OR SUPERVISEUR LIKE ? OR CAST(CODEUTILISATEUR AS CHAR) LIKE ?) ORDER BY UTILISATEUR LIMIT 30", ['%'+q+'%', '%'+q+'%', '%'+q+'%']); res.json({ success: true, data: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET partenariats
app.get('/api/partenariats', authMiddleware, async function(req, res) {
  try {
    var rows;
    if (req.user.type === 'admin') { [rows] = await db.query('SELECT * FROM partenariats ORDER BY created_at DESC'); }
    else if (req.user.type === 'dm') { [rows] = await db.query('SELECT * FROM partenariats WHERE created_by = ? ORDER BY created_at DESC', [req.user.userId]); }
    else if (req.user.type === 'sup') { [rows] = await db.query('SELECT DISTINCT p.* FROM partenariats p JOIN users u ON p.created_by = u.ID JOIN utilisateur ut ON u.login = ut.UTILISATEUR WHERE ut.SUPERVISEUR = ? ORDER BY p.created_at DESC', [req.user.login]); }
    else { return res.json({ success: true, data: [] }); }
    var result = [];
    for (var i = 0; i < rows.length; i++) { var p = rows[i]; var rel = await loadRelated(p.id); result.push(buildPartnership(p, rel.prods, rel.pharmas, rel.qtys, await getCreatorName(p.created_by), rel.states)); }
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET: Vérifier si une référence existe déjà (AVANT :id pour éviter conflit)
app.get('/api/partenariats/check-reference', authMiddleware, async function(req, res) {
  try {
    var ref = (req.query.ref || '').trim();
    if (ref.length < 1) return res.json({ success: true, data: { exists: false } });
    var [existing] = await db.query('SELECT id, reference FROM partenariats WHERE reference = ? LIMIT 1', [ref]);
    res.json({ success: true, data: { exists: existing.length > 0, reference: existing.length > 0 ? existing[0].reference : '' } });
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
    var rel = await loadRelated(p.id); res.json({ success: true, data: buildPartnership(p, rel.prods, rel.pharmas, rel.qtys, await getCreatorName(p.created_by), rel.states) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST
app.post('/api/partenariats', authMiddleware, async function(req, res) {
  if (req.user.type !== 'admin' && req.user.type !== 'dm') return res.status(403).json({ success: false, error: 'Droits insuffisants' });
  var conn = await db.getConnection();
  try {
    await conn.beginTransaction(); var b = req.body;

    // Vérifier que la référence n'existe pas déjà
    var [existing] = await db.query('SELECT id FROM partenariats WHERE reference = ? LIMIT 1', [b.reference]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Cette référence existe déjà. Veuillez utiliser une référence unique.' });
    }
    var [result] = await conn.query('INSERT INTO partenariats (annee, reference, type_manifestation, manifestation, start_month, end_month, follow_up_end_month, prospect, supervisor, delegates, budget, potential_pharmacies, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [b.year, b.reference, b.typeManifestation, b.manifestation || null, b.startMonth, b.endMonth, b.followUpEndMonth || null, b.prospect || null, b.supervisor || null, b.delegates || null, b.budget || 0, b.potentialPharmacies || 0, req.user.userId]);
    var pid = result.insertId; var products = [], pharmacies = [];
    if (b.products) for (var i = 0; i < b.products.length; i++) { var [r] = await conn.query('INSERT INTO partenariat_produits (partenariat_id, product_name, boxes) VALUES (?,?,?)', [pid, b.products[i].name, b.products[i].boxes || 0]); products.push({ id: String(r.insertId), name: b.products[i].name, boxes: b.products[i].boxes || 0 }); }
    if (b.pharmacies) for (var j = 0; j < b.pharmacies.length; j++) { var [r2] = await conn.query('INSERT INTO partenariat_pharmacies (partenariat_id, pharmacy_name) VALUES (?,?)', [pid, b.pharmacies[j].name]); pharmacies.push({ id: String(r2.insertId), name: b.pharmacies[j].name }); }
    await conn.commit();
    res.json({ success: true, data: { id: String(pid), year: b.year, reference: b.reference, typeManifestation: b.typeManifestation, manifestation: b.manifestation || '', startMonth: b.startMonth, endMonth: b.endMonth, followUpEndMonth: b.followUpEndMonth || '', prospect: b.prospect || '', supervisor: b.supervisor || '', delegates: b.delegates || '', budget: b.budget || 0, potentialPharmacies: b.potentialPharmacies || 0, createdByName: req.user.login, currentActiveMonth: '', monthStatus: {}, manualClose: {}, products: products, pharmacies: pharmacies, tableData: {}, createdAt: new Date().toISOString() } });
  } catch (e) { await conn.rollback(); res.status(500).json({ success: false, error: e.message }); } finally { conn.release(); }
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
  try { await db.query('DELETE FROM partenariats WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════ GESTION MOIS ════════════════════════════════

// Admin : configurer un mois (manuel/auto + activer)
app.put('/api/partenariats/:id/month-config', authMiddleware, async function(req, res) {
  if (req.user.type !== 'admin') return res.status(403).json({ success: false, error: 'Admin seulement' });
  try {
    var id = req.params.id, month = req.body.month, newStatus = req.body.status, autoActivate = req.body.autoActivate ? 1 : 0;

    if (newStatus === 'active') {
      // Désactiver tous les autres mois
      await db.query('UPDATE partenariat_month_status SET status = ? WHERE partenariat_id = ?', ['inactive', id]);
    }

    await db.query('INSERT INTO partenariat_month_status (partenariat_id, month, status, manual_close) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE status = VALUES(status), manual_close = VALUES(manual_close)', [id, month, newStatus, autoActivate]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DM ou Admin : clôturer le mois actif → active le prochain mois marqué manuel
app.post('/api/partenariats/:id/close-month', authMiddleware, async function(req, res) {
  try {
    var id = req.params.id, month = req.body.month;
    if (req.user.type === 'dm') {
      var [check] = await db.query('SELECT created_by FROM partenariats WHERE id = ?', [id]);
      if (check.length === 0 || check[0].created_by !== req.user.userId) return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    // Clôturer
    await db.query('UPDATE partenariat_month_status SET status = ? WHERE partenariat_id = ? AND month = ?', ['closed', id, month]);

    // Activer le prochain mois (manuel d'abord, sinon auto)
    var [all] = await db.query('SELECT month, manual_close, status FROM partenariat_month_status WHERE partenariat_id = ? ORDER BY month', [id]);
    var nextActive = null;
    // Chercher d'abord un mois manuel après le mois clôturé
    for (var i = 0; i < all.length; i++) {
      if (all[i].month > month && all[i].manual_close && all[i].status != 'closed') {
        nextActive = all[i].month; break;
      }
    }
    // Si pas de manuel, prendre le prochain mois (auto) qui n'est pas closed ET qui est activable
    if (!nextActive) {
      for (var j = 0; j < all.length; j++) {
        if (all[j].month > month && all[j].status != 'closed' && isMonthActivatable(all[j].month)) {
          nextActive = all[j].month; break;
        }
      }
    }
    if (nextActive) {
      await db.query('UPDATE partenariat_month_status SET status = ? WHERE partenariat_id = ?', ['inactive', id]);
      await db.query('UPDATE partenariat_month_status SET status = ? WHERE partenariat_id = ? AND month = ?', ['active', id, nextActive]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════ CLÔTURE CONTRAT (superviseur) ═══════════════
app.post('/api/partenariats/:id/close-contract', authMiddleware, async function(req, res) {
  if (req.user.type !== 'sup') return res.status(403).json({ success: false, error: 'Superviseur seulement' });
  try {
    var id = req.params.id;
    var status = req.body.status; // 'Desistement' | 'NonHonnore' | 'Honnore' | 'Autre'
    var comment = req.body.comment || '';
    if (!status) return res.status(400).json({ success: false, error: 'Statut requis' });
    if (status === 'Autre' && !comment.trim()) return res.status(400).json({ success: false, error: 'Commentaire requis pour le choix Autre' });

    // Vérifier que le sup peut clôturer ce contrat
    var [chk] = await db.query('SELECT 1 FROM partenariats p JOIN users u ON p.created_by = u.ID JOIN utilisateur ut ON u.login = ut.UTILISATEUR WHERE p.id = ? AND ut.SUPERVISEUR = ?', [id, req.user.login]);
    if (chk.length === 0) return res.status(403).json({ success: false, error: 'Accès refusé' });

    // Clôturer tous les mois actifs
    await db.query("UPDATE partenariat_month_status SET status = 'closed' WHERE partenariat_id = ? AND status IN ('active','inactive')", [id]);

    // Marquer le contrat comme clôturé
    await db.query('UPDATE partenariats SET contrat_status = ?, contrat_closed_by = ?, contrat_closed_at = NOW(), contrat_comment = ? WHERE id = ?',
      [status, req.user.login, comment, id]);

    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.listen(PORT, function() { console.log('\n🚀 API → http://localhost:' + PORT + '\n'); });
