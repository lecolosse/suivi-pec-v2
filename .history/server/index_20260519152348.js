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
  let t = '';
  for (let i = 0; i < 64; i++) t += c.charAt(Math.floor(Math.random() * c.length));
  return t;
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Non autorisé' });
  const session = sessions.get(auth.substring(7));
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
    const { login, pwd } = req.body;
    if (!login || !pwd) return res.status(400).json({ success: false, error: 'Login et mot de passe requis' });
    const [rows] = await db.query('SELECT ID, login, pwd, type, email FROM users WHERE login = ?', [login]);
    if (rows.length === 0) return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    const user = rows[0];
    if (!await bcrypt.compare(pwd, user.pwd)) return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    const token = generateToken();
    sessions.set(token, { userId: user.ID, login: user.login, type: user.type, email: user.email });
    if (sessions.size > 200) sessions.delete(sessions.keys().next().value);
    res.json({ success: true, data: { token, user: { id: user.ID, login: user.login, type: user.type, email: user.email } } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ success: true, data: { id: req.user.userId, login: req.user.login, type: req.user.type, email: req.user.email } });
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  sessions.delete(req.headers.authorization.substring(7));
  res.json({ success: true });
});

// ═══════════ REFERENCES ══════════════════════════════════

app.get('/api/references/search', authMiddleware, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 1) return res.json({ success: true, data: [] });
    const [rows] = await db.query(
      'SELECT id, codedemande, Reference, DateDemande, Type, sup, Manifestation, Prospect, Specialite, Secteur FROM reference_etat WHERE Reference LIKE ? LIMIT 20',
      [`%${q}%`]
    );
    res.json({ success: true, data: rows });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ═══════════ PRODUITS ════════════════════════════════════

app.get('/api/produits', authMiddleware, async (_req, res) => {
  try { const [r] = await db.query('SELECT ID, PRODUIT FROM produits ORDER BY PRODUIT'); res.json({ success: true, data: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════ PROSPECTS ═══════════════════════════════════

app.get('/api/prospects', authMiddleware, async (_req, res) => {
  try { const [r] = await db.query('SELECT ID, CODEPROSPECT, NOMPRENOM, SPECIALITE, SECTEUR FROM prospect ORDER BY NOMPRENOM'); res.json({ success: true, data: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/prospects/search', authMiddleware, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 1) return res.json({ success: true, data: [] });
    const [r] = await db.query(
      'SELECT ID, CODEPROSPECT, NOMPRENOM, SPECIALITE, SECTEUR FROM prospect WHERE NOMPRENOM LIKE ? OR CAST(CODEPROSPECT AS CHAR) LIKE ? ORDER BY NOMPRENOM LIMIT 30',
      [`%${q}%`, `%${q}%`]
    );
    res.json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════ UTILISATEURS ════════════════════════════════

app.get('/api/utilisateurs', authMiddleware, async (_req, res) => {
  try { const [r] = await db.query('SELECT ID, CODEUTILISATEUR, UTILISATEUR, SUPERVISEUR, TYPEUTILISATEUR, RESEAU FROM utilisateur ORDER BY UTILISATEUR'); res.json({ success: true, data: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/utilisateurs/search', authMiddleware, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 1) return res.json({ success: true, data: [] });
    const [r] = await db.query(
      'SELECT ID, CODEUTILISATEUR, UTILISATEUR, SUPERVISEUR, TYPEUTILISATEUR, RESEAU FROM utilisateur WHERE UTILISATEUR LIKE ? OR SUPERVISEUR LIKE ? OR CAST(CODEUTILISATEUR AS CHAR) LIKE ? ORDER BY UTILISATEUR LIMIT 30',
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );
    res.json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════ PARTENARIATS ════════════════════════════════

function buildPartnership(p, prods, pharmas, qtys) {
  const tableData = {};
  for (const q of qtys) {
    const ph = pharmas.find(x => x.pharmacy_name === q.pharmacy_name);
    if (!ph) continue;
    const key = ph.id + '|' + q.product_name;
    if (!tableData[key]) tableData[key] = {};
    tableData[key][q.month] = q.quantity;
  }
  return {
    id: String(p.id), year: p.annee || '', reference: p.reference || '',
    typeManifestation: p.type_manifestation || '', manifestation: p.manifestation || '',
    startMonth: p.start_month || '', endMonth: p.end_month || '',
    followUpEndMonth: p.follow_up_end_month || '',
    prospect: p.prospect || '', supervisor: p.supervisor || '', delegates: p.delegates || '',
    budget: parseFloat(p.budget) || 0, potentialPharmacies: parseFloat(p.potential_pharmacies) || 0,
    products: prods.map(pr => ({ id: String(pr.id), name: pr.product_name, boxes: pr.boxes || 0 })),
    pharmacies: pharmas.map(ph => ({ id: String(ph.id), name: ph.pharmacy_name })),
    tableData,
    createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
  };
}

async function loadRelated(pId) {
  const [prods] = await db.query('SELECT id, product_name, boxes FROM partenariat_produits WHERE partenariat_id = ?', [pId]);
  const [pharmas] = await db.query('SELECT id, pharmacy_name FROM partenariat_pharmacies WHERE partenariat_id = ?', [pId]);
  const [qtys] = await db.query('SELECT pharmacy_name, product_name, month, quantity FROM partenariat_quantities WHERE partenariat_id = ?', [pId]);
  return { prods, pharmas, qtys };
}

// GET all
app.get('/api/partenariats', authMiddleware, async (req, res) => {
  try {
    const role = req.user.type;
    let rows;
console.log('User role:', role);
    if (role === 'admin') {
      [rows] = await db.query('SELECT * FROM partenariats ORDER BY created_at DESC');
    } else if (role === 'dm') {
      [rows] = await db.query('SELECT * FROM partenariats WHERE created_by = ? ORDER BY created_at DESC', [req.user.userId]);
    } else if (role === 'sup') {
      [rows] = await db.query(
        'SELECT DISTINCT p.* FROM partenariats p JOIN users u ON p.created_by = u.ID JOIN utilisateur ut ON u.login = ut.UTILISATEUR WHERE ut.SUPERVISEUR = ? ORDER BY p.created_at DESC',
        [req.user.login]
      );
    } else {
      return res.json({ success: true, data: [] });
    }

    const result = [];
    for (const p of rows) {
      const { prods, pharmas, qtys } = await loadRelated(p.id);
      result.push(buildPartnership(p, prods, pharmas, qtys));
    }
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET by id
app.get('/api/partenariats/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM partenariats WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Non trouvé' });
    const p = rows[0];
    const role = req.user.type;

    if (role === 'dm' && p.created_by !== req.user.userId)
      return res.status(403).json({ success: false, error: 'Accès refusé' });

    if (role === 'sup') {
      const [chk] = await db.query(
        'SELECT 1 FROM partenariats p JOIN users u ON p.created_by = u.ID JOIN utilisateur ut ON u.login = ut.UTILISATEUR WHERE p.id = ? AND ut.SUPERVISEUR = ?',
        [req.params.id, req.user.login]
      );
      if (chk.length === 0) return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const { prods, pharmas, qtys } = await loadRelated(p.id);
    res.json({ success: true, data: buildPartnership(p, prods, pharmas, qtys) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST (admin + dm seulement)
app.post('/api/partenariats', authMiddleware, async (req, res) => {
  if (req.user.type !== 'admin' && req.user.type !== 'dm')
    return res.status(403).json({ success: false, error: 'Droits insuffisants' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const b = req.body;
    const [result] = await conn.query(
      'INSERT INTO partenariats (annee, reference, type_manifestation, manifestation, start_month, end_month, follow_up_end_month, prospect, supervisor, delegates, budget, potential_pharmacies, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [b.year, b.reference, b.typeManifestation, b.manifestation || null, b.startMonth, b.endMonth, b.followUpEndMonth || null, b.prospect || null, b.supervisor || null, b.delegates || null, b.budget || 0, b.potentialPharmacies || 0, req.user.userId]
    );
    const pid = result.insertId;
    const products = [], pharmacies = [];
    if (b.products) for (const pr of b.products) { const [r] = await conn.query('INSERT INTO partenariat_produits (partenariat_id, product_name, boxes) VALUES (?,?,?)', [pid, pr.name, pr.boxes || 0]); products.push({ id: String(r.insertId), name: pr.name, boxes: pr.boxes || 0 }); }
    if (b.pharmacies) for (const ph of b.pharmacies) { const [r] = await conn.query('INSERT INTO partenariat_pharmacies (partenariat_id, pharmacy_name) VALUES (?,?)', [pid, ph.name]); pharmacies.push({ id: String(r.insertId), name: ph.name }); }
    await conn.commit();
    res.json({ success: true, data: { id: String(pid), year: b.year, reference: b.reference, typeManifestation: b.typeManifestation, manifestation: b.manifestation || '', startMonth: b.startMonth, endMonth: b.endMonth, followUpEndMonth: b.followUpEndMonth || '', prospect: b.prospect || '', supervisor: b.supervisor || '', delegates: b.delegates || '', budget: b.budget || 0, potentialPharmacies: b.potentialPharmacies || 0, products, pharmacies, tableData: {}, createdAt: new Date().toISOString() } });
  } catch (e) { await conn.rollback(); res.status(500).json({ success: false, error: e.message }); }
  finally { conn.release(); }
});

// PUT quantity (admin + dm propriétaire)
app.put('/api/partenariats/:id/quantity', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.type !== 'admin') {
      const [rows] = await db.query('SELECT created_by FROM partenariats WHERE id = ?', [id]);
      if (rows.length === 0 || rows[0].created_by !== req.user.userId) return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const { pharmacyName, productName, month, quantity } = req.body;
    await db.query('INSERT INTO partenariat_quantities (partenariat_id, pharmacy_name, product_name, month, quantity) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)', [id, pharmacyName, productName, month, quantity || 0]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE (admin seulement)
app.delete('/api/partenariats/:id', authMiddleware, async (req, res) => {
  if (req.user.type !== 'admin') return res.status(403).json({ success: false, error: 'Seul un administrateur peut supprimer' });
  try { await db.query('DELETE FROM partenariats WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.listen(PORT, () => { console.log('\n🚀 Partenariats API → http://localhost:' + PORT + '\n'); });
