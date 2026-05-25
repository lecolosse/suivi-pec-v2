require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Health Check ────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ success: true, message: 'Server & DB connected' });
  } catch {
    res.json({ success: true, message: 'Server running (DB unreachable)' });
  }
});

// ════════════════════════════════════════════════════════════
// REFERENCES  –  recherche dans reference_etat
// ════════════════════════════════════════════════════════════
app.get('/api/references/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 1) return res.json({ success: true, data: [] });

    const [rows] = await db.query(
      `SELECT id, codedemande, Reference, DateDemande, Type, sup,
              Manifestation, Prospect, Specialite, Secteur
       FROM reference_etat
       WHERE Reference LIKE ? OR CAST(codedemande AS CHAR) LIKE ?
       LIMIT 20`,
      [`%${q}%`, `%${q}%`],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Reference search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// PRODUITS  –  liste complète depuis la table produits
// ════════════════════════════════════════════════════════════
app.get('/api/produits', async (_req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT ID, PRODUIT FROM produits ORDER BY PRODUIT',
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get produits error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// PHARMACIES  –  liste complète depuis la table pharmacie
// ════════════════════════════════════════════════════════════
app.get('/api/pharmacies', async (_req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT ID_PHARMACIE, NomPharmacie, SpecialitePharmacie, SecteurPharmacie FROM pharmacie ORDER BY NomPharmacie',
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get pharmacies error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// PARTENARIATS  –  CRUD complet
// ════════════════════════════════════════════════════════════

// GET all  ─────────────────────────────────────────────────
app.get('/api/partenariats', async (_req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM partenariats ORDER BY created_at DESC',
    );

    const result = [];
    for (const p of rows) {
      const [prods] = await db.query(
        'SELECT id, product_name, boxes FROM partenariat_produits WHERE partenariat_id = ?',
        [p.id],
      );
      const [pharmas] = await db.query(
        'SELECT id, pharmacy_name FROM partenariat_pharmacies WHERE partenariat_id = ?',
        [p.id],
      );
      const [qtys] = await db.query(
        'SELECT pharmacy_name, product_name, month, quantity FROM partenariat_quantities WHERE partenariat_id = ?',
        [p.id],
      );

      // Build tableData :  key = "pharmacyDbId|productName"
      const tableData = {};
      for (const q of qtys) {
        const ph = pharmas.find((x) => x.pharmacy_name === q.pharmacy_name);
        if (!ph) continue;
        const key = `${ph.id}|${q.product_name}`;
        if (!tableData[key]) tableData[key] = {};
        tableData[key][q.month] = q.quantity;
      }

      result.push({
        id: String(p.id),
        year: p.annee || '',
        reference: p.reference || '',
        typeManifestation: p.type_manifestation || '',
        manifestation: p.manifestation || '',
        startMonth: p.start_month || '',
        endMonth: p.end_month || '',
        followUpEndMonth: p.follow_up_end_month || '',
        prospect: p.prospect || '',
        supervisor: p.supervisor || '',
        delegates: p.delegates || '',
        budget: parseFloat(p.budget) || 0,
        potentialPharmacies: parseFloat(p.potential_pharmacies) || 0,
        products: prods.map((pr) => ({
          id: String(pr.id),
          name: pr.product_name,
          boxes: pr.boxes || 0,
        })),
        pharmacies: pharmas.map((ph) => ({
          id: String(ph.id),
          name: ph.pharmacy_name,
        })),
        tableData,
        createdAt: p.created_at
          ? new Date(p.created_at).toISOString()
          : new Date().toISOString(),
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get partenariats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET by id  ───────────────────────────────────────────────
app.get('/api/partenariats/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM partenariats WHERE id = ?',
      [req.params.id],
    );
    if (rows.length === 0)
      return res
        .status(404)
        .json({ success: false, error: 'Partenariat non trouvé' });

    const p = rows[0];

    const [prods] = await db.query(
      'SELECT id, product_name, boxes FROM partenariat_produits WHERE partenariat_id = ?',
      [p.id],
    );
    const [pharmas] = await db.query(
      'SELECT id, pharmacy_name FROM partenariat_pharmacies WHERE partenariat_id = ?',
      [p.id],
    );
    const [qtys] = await db.query(
      'SELECT pharmacy_name, product_name, month, quantity FROM partenariat_quantities WHERE partenariat_id = ?',
      [p.id],
    );

    const tableData = {};
    for (const q of qtys) {
      const ph = pharmas.find((x) => x.pharmacy_name === q.pharmacy_name);
      if (!ph) continue;
      const key = `${ph.id}|${q.product_name}`;
      if (!tableData[key]) tableData[key] = {};
      tableData[key][q.month] = q.quantity;
    }

    res.json({
      success: true,
      data: {
        id: String(p.id),
        year: p.annee || '',
        reference: p.reference || '',
        typeManifestation: p.type_manifestation || '',
        manifestation: p.manifestation || '',
        startMonth: p.start_month || '',
        endMonth: p.end_month || '',
        followUpEndMonth: p.follow_up_end_month || '',
        prospect: p.prospect || '',
        supervisor: p.supervisor || '',
        delegates: p.delegates || '',
        budget: parseFloat(p.budget) || 0,
        potentialPharmacies: parseFloat(p.potential_pharmacies) || 0,
        products: prods.map((pr) => ({
          id: String(pr.id),
          name: pr.product_name,
          boxes: pr.boxes || 0,
        })),
        pharmacies: pharmas.map((ph) => ({
          id: String(ph.id),
          name: ph.pharmacy_name,
        })),
        tableData,
        createdAt: p.created_at
          ? new Date(p.created_at).toISOString()
          : new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get partenariat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create  ─────────────────────────────────────────────
app.post('/api/partenariats', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const b = req.body;

    const [result] = await conn.query(
      `INSERT INTO partenariats
        (annee, reference, type_manifestation, manifestation,
         start_month, end_month, follow_up_end_month,
         prospect, supervisor, delegates, budget, potential_pharmacies)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.year,
        b.reference,
        b.typeManifestation,
        b.manifestation || null,
        b.startMonth,
        b.endMonth,
        b.followUpEndMonth || null,
        b.prospect || null,
        b.supervisor || null,
        b.delegates || null,
        b.budget || 0,
        b.potentialPharmacies || 0,
      ],
    );

    const partenariatId = result.insertId;
    const products = [];
    const pharmacies = [];

    // Insert products
    if (b.products && b.products.length > 0) {
      for (const prod of b.products) {
        const [r] = await conn.query(
          'INSERT INTO partenariat_produits (partenariat_id, product_name, boxes) VALUES (?, ?, ?)',
          [partenariatId, prod.name, prod.boxes || 0],
        );
        products.push({
          id: String(r.insertId),
          name: prod.name,
          boxes: prod.boxes || 0,
        });
      }
    }

    // Insert pharmacies
    if (b.pharmacies && b.pharmacies.length > 0) {
      for (const phar of b.pharmacies) {
        const [r] = await conn.query(
          'INSERT INTO partenariat_pharmacies (partenariat_id, pharmacy_name) VALUES (?, ?)',
          [partenariatId, phar.name],
        );
        pharmacies.push({
          id: String(r.insertId),
          name: phar.name,
        });
      }
    }

    await conn.commit();

    // Return fully-formed partnership object
    res.json({
      success: true,
      data: {
        id: String(partenariatId),
        year: b.year,
        reference: b.reference,
        typeManifestation: b.typeManifestation,
        manifestation: b.manifestation || '',
        startMonth: b.startMonth,
        endMonth: b.endMonth,
        followUpEndMonth: b.followUpEndMonth || '',
        prospect: b.prospect || '',
        supervisor: b.supervisor || '',
        delegates: b.delegates || '',
        budget: b.budget || 0,
        potentialPharmacies: b.potentialPharmacies || 0,
        products,
        pharmacies,
        tableData: {},
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    await conn.rollback();
    console.error('Create partenariat error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    conn.release();
  }
});

// PUT update quantity  ─────────────────────────────────────
app.put('/api/partenariats/:id/quantity', async (req, res) => {
  try {
    const { id } = req.params;
    const { pharmacyName, productName, month, quantity } = req.body;

    await db.query(
      `INSERT INTO partenariat_quantities
         (partenariat_id, pharmacy_name, product_name, month, quantity)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
      [id, pharmacyName, productName, month, quantity || 0],
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update quantity error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT save all quantities (batch) ──────────────────────────
app.put('/api/partenariats/:id/quantities-batch', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const { quantities } = req.body; // Array of { pharmacyName, productName, month, quantity }

    if (quantities && quantities.length > 0) {
      for (const q of quantities) {
        await conn.query(
          `INSERT INTO partenariat_quantities
             (partenariat_id, pharmacy_name, product_name, month, quantity)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
          [id, q.pharmacyName, q.productName, q.month, q.quantity || 0],
        );
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    console.error('Batch update quantities error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    conn.release();
  }
});

// DELETE  ──────────────────────────────────────────────────
app.delete('/api/partenariats/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM partenariats WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete partenariat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   🚀  Partenariats API Server                ║');
  console.log(`║   →  http://localhost:${PORT}                    ║`);
  console.log(`║   ♥   Health: http://localhost:${PORT}/api/health ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
