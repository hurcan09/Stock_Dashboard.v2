// src/pages/api/users.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const result = await pool.query(`
        SELECT id, username, email, password, full_name as name, phone, department, 
               role, is_active as "isActive", last_login as "lastLogin",
               last_login_ip as "lastLoginIp", avatar_color as "avatarColor",
               session_timeout as "sessionTimeout", can_view_pages as "canViewPages",
               can_edit_pages as "canEditPages", permissions,
               created_at as "createdAt", updated_at as "updatedAt"
        FROM users 
        ORDER BY created_at DESC
      `);
      res.status(200).json(result.rows);
    } catch (error: any) {
      console.error('GET users error:', error);
      res.status(500).json({ error: error.message });
    }
  } 
  else if (req.method === 'POST') {
    try {
      const { username, email, password, name, department, role, phone, permissions, avatarColor } = req.body;
      
      const result = await pool.query(`
        INSERT INTO users (username, email, password, full_name, phone, department, role, permissions, avatar_color)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [username, email, password, name, phone || '', department, role, JSON.stringify(permissions || {}), avatarColor || '#4F46E5']);
      
      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('POST user error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}