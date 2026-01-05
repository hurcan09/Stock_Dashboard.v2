const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // Tabloyu güncel haliyle oluştur
  db.run(`CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    tc TEXT UNIQUE,
    diagnosis TEXT,
    phone TEXT,
    email TEXT,
    birth_date TEXT,
    gender TEXT,
    address TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('Patients table creation error:', err.message);
  });

  // Tüm hastaları getir
  router.get('/', (req, res) => {
    const { search } = req.query;
    
    let query = 'SELECT * FROM patients';
    let params = [];
    
    if (search) {
      query += ' WHERE name LIKE ? OR tc LIKE ? OR diagnosis LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // Yeni hasta ekle
  router.post('/', (req, res) => {
    const { 
      name, 
      tc, 
      diagnosis, 
      phone, 
      email, 
      birth_date, 
      gender, 
      address, 
      notes 
    } = req.body;
    
    db.run(
      `INSERT INTO patients (
        name, tc, diagnosis, phone, email, 
        birth_date, gender, address, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, tc, diagnosis, phone, email, birth_date, gender, address, notes],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ 
          id: this.lastID, 
          name, 
          tc, 
          diagnosis,
          message: 'Hasta başarıyla eklendi'
        });
      }
    );
  });

  // Hasta güncelle
  router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { 
      name, 
      tc, 
      diagnosis, 
      phone, 
      email, 
      birth_date, 
      gender, 
      address, 
      notes 
    } = req.body;
    
    db.run(
      `UPDATE patients SET 
        name = ?, tc = ?, diagnosis = ?, phone = ?, email = ?,
        birth_date = ?, gender = ?, address = ?, notes = ?
      WHERE id = ?`,
      [name, tc, diagnosis, phone, email, birth_date, gender, address, notes, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ 
          message: 'Hasta başarıyla güncellendi',
          changes: this.changes 
        });
      }
    );
  });

  // Hasta sil
  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM patients WHERE id = ?', [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ 
        message: 'Hasta başarıyla silindi',
        changes: this.changes 
      });
    });
  });

  // Hasta detayını getir
  router.get('/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM patients WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Hasta bulunamadı' });
      res.json(row);
    });
  });

  // TC'ye göre hasta ara
  router.get('/search/tc/:tc', (req, res) => {
    const { tc } = req.params;
    
    db.get('SELECT * FROM patients WHERE tc = ?', [tc], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || null);
    });
  });

  return router;
};