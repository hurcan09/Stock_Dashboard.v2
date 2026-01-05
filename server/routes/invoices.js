const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // Tabloyu güncel haliyle oluştur
  db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patientName TEXT NOT NULL,
    patientTc TEXT,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('Invoices table creation error:', err.message);
  });

  // Tüm faturaları getir
  router.get('/', (req, res) => {
    const { status, startDate, endDate } = req.query;
    
    let query = 'SELECT * FROM invoices';
    let params = [];
    
    const conditions = [];
    
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    
    if (startDate) {
      conditions.push('DATE(date) >= DATE(?)');
      params.push(startDate);
    }
    
    if (endDate) {
      conditions.push('DATE(date) <= DATE(?)');
      params.push(endDate);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY date DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // Yeni fatura ekle
  router.post('/', (req, res) => {
    const { patientName, patientTc, amount, date, status, description } = req.body;
    
    db.run(
      'INSERT INTO invoices (patientName, patientTc, amount, date, status, description) VALUES (?, ?, ?, ?, ?, ?)',
      [patientName, patientTc, amount, date, status || 'pending', description || ''],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ 
          id: this.lastID, 
          patientName, 
          amount, 
          date,
          message: 'Fatura başarıyla eklendi'
        });
      }
    );
  });

  // Fatura güncelle
  router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { patientName, patientTc, amount, date, status, description } = req.body;
    
    db.run(
      `UPDATE invoices SET 
        patientName = ?, patientTc = ?, amount = ?, date = ?, 
        status = ?, description = ?
      WHERE id = ?`,
      [patientName, patientTc, amount, date, status, description, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ 
          message: 'Fatura başarıyla güncellendi',
          changes: this.changes 
        });
      }
    );
  });

  // Fatura sil
  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM invoices WHERE id = ?', [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ 
        message: 'Fatura başarıyla silindi',
        changes: this.changes 
      });
    });
  });

  // Fatura durumu güncelle
  router.patch('/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    db.run(
      'UPDATE invoices SET status = ? WHERE id = ?',
      [status, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ 
          message: 'Fatura durumu güncellendi',
          changes: this.changes 
        });
      }
    );
  });

  // Fatura istatistikleri
  router.get('/stats', (req, res) => {
    db.get('SELECT COUNT(*) as total, SUM(amount) as totalAmount FROM invoices', [], (err, totalRow) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get('SELECT COUNT(*) as pending, SUM(amount) as pendingAmount FROM invoices WHERE status = "pending"', [], (err, pendingRow) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.get('SELECT COUNT(*) as paid, SUM(amount) as paidAmount FROM invoices WHERE status = "paid"', [], (err, paidRow) => {
          if (err) return res.status(500).json({ error: err.message });
          
          res.json({
            total: totalRow.total || 0,
            totalAmount: totalRow.totalAmount || 0,
            pending: pendingRow.pending || 0,
            pendingAmount: pendingRow.pendingAmount || 0,
            paid: paidRow.paid || 0,
            paidAmount: paidRow.paidAmount || 0
          });
        });
      });
    });
  });

  return router;
};