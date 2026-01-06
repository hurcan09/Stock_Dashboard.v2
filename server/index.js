// index.js - TAM GÜNCELLENMİŞ VERSİYON
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const { Sequelize, DataTypes, Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// PostgreSQL Database Connection
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: ['https://stock-dashboard-p5ip.onrender.com', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  // 1. Header'dan dene
  const authHeader = req.headers['authorization'];
  const tokenFromHeader = authHeader && authHeader.split(' ')[1];
  
  // 2. Query parameter'dan dene
  const tokenFromQuery = req.query.token;
  
  const token = tokenFromHeader || tokenFromQuery;
  
  if (!token) {
    return res.status(401).json({ error: 'Token gereklidir' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Token verification error:', err.message);
      return res.status(403).json({ error: 'Geçersiz token' });
    }
    req.user = user;
    next();
  });
};

// Database Models
const Material = sequelize.define('Material', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  barcode: { type: DataTypes.STRING, unique: true, allowNull: false },
  gtin: { type: DataTypes.STRING },
  sn: { type: DataTypes.STRING },
  udiCode: { type: DataTypes.STRING },
  allBarcode: { type: DataTypes.STRING },
  intuitiveCode: { type: DataTypes.STRING },
  category: { type: DataTypes.STRING, allowNull: false },
  subCategory: { type: DataTypes.STRING },
  unit: { type: DataTypes.STRING, allowNull: false },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  currentStock: { type: DataTypes.INTEGER, defaultValue: 0 },
  minStock: { type: DataTypes.INTEGER, defaultValue: 0 },
  supplier: { type: DataTypes.STRING },
  expirationDate: { type: DataTypes.DATEONLY },
  serialNoStatus: { type: DataTypes.STRING },
  materialDescription: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: 'normal' },
  createdBy: { type: DataTypes.STRING },
  updatedBy: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'materials',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  full_name: { type: DataTypes.STRING, allowNull: false },
  department: { type: DataTypes.STRING },
  role: { type: DataTypes.STRING, defaultValue: 'staff' },
  avatar_color: { type: DataTypes.STRING, defaultValue: '#4F46E5' },
  phone: { type: DataTypes.STRING },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  last_login: { type: DataTypes.DATE },
  last_login_ip: { type: DataTypes.STRING },
  session_timeout: { type: DataTypes.INTEGER, defaultValue: 30 },
  can_view_pages: { type: DataTypes.JSONB, defaultValue: [] },
  can_edit_pages: { type: DataTypes.JSONB, defaultValue: [] },
  permissions: { type: DataTypes.JSONB, defaultValue: {} }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

User.prototype.validPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

const Patient = sequelize.define('Patient', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  surname: { type: DataTypes.STRING, allowNull: false },
  tc: { type: DataTypes.STRING, unique: true },
  phone: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  birth_date: { type: DataTypes.DATEONLY },
  gender: { type: DataTypes.STRING },
  address: { type: DataTypes.TEXT },
  notes: { type: DataTypes.TEXT },
  bloodType: { type: DataTypes.STRING },
  allergies: { type: DataTypes.TEXT },
  chronicDiseases: { type: DataTypes.TEXT },
  emergencyContact: { type: DataTypes.STRING },
  insuranceProvider: { type: DataTypes.STRING },
  doctorId: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  createdBy: { type: DataTypes.STRING }
}, {
  tableName: 'patients',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

// Oturum modeli
const UserSession = sequelize.define('UserSession', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  userName: { type: DataTypes.STRING, allowNull: false },
  userRole: { type: DataTypes.STRING, allowNull: false },
  loginTime: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  lastActivity: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  ipAddress: { type: DataTypes.STRING },
  userAgent: { type: DataTypes.TEXT },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  deviceInfo: { type: DataTypes.JSONB, defaultValue: {} }
}, {
  tableName: 'user_sessions',
  timestamps: true
});

// Sistem log modeli
const SystemLog = sequelize.define('SystemLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  action: { type: DataTypes.STRING, allowNull: false },
  module: { type: DataTypes.STRING, allowNull: false },
  recordId: { type: DataTypes.STRING, allowNull: false },
  details: { type: DataTypes.TEXT, allowNull: false },
  performedBy: { type: DataTypes.STRING, allowNull: false },
  performedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  ipAddress: { type: DataTypes.STRING },
  userAgent: { type: DataTypes.TEXT }
}, {
  tableName: 'system_logs',
  timestamps: false
});

// Initialize Database
const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL veritabanına bağlandı.');
    
    // Tabloları oluştur
    await sequelize.sync({ alter: true });
    console.log('✅ Database tabloları senkronize edildi.');
    
    // Varsayılan admin kullanıcısını kontrol et ve oluştur
    try {
      const adminUser = await User.findOne({ 
        where: { email: 'admin@osmangazigoz.com' } 
      });
      
      if (!adminUser) {
        console.log('🔍 Admin user bulunamadı, oluşturuluyor...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await User.create({
          email: 'admin@osmangazigoz.com',
          username: 'admin',
          password: hashedPassword,
          full_name: 'Sistem Yöneticisi',
          department: 'Yönetim',
          role: 'admin',
          avatar_color: '#4F46E5',
          permissions: {
            createSession: true, approveCounts: true, manageMaterials: true,
            managePatients: true, manageInvoices: true, bulkStatusChange: true,
            quickCount: true, exportData: true, manageUsers: true,
            manageSettings: true, viewDashboard: true, importExcel: true,
            manageDailyPlan: true, viewReports: true
          },
          is_active: true
        });
        console.log('✅ Default admin user created: admin@osmangazigoz.com / admin123');
      } else {
        console.log('✅ Admin user zaten mevcut.');
      }
    } catch (userError) {
      console.error('❌ Admin user creation error:', userError.message);
    }
    
    console.log('✅ Database initialization completed.');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
  }
};

// ============ API ROUTES ============

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      status: 'OK',
      database: 'Connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      database: 'Disconnected',
      error: error.message
    });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  console.log('🔍 LOGIN attempt for:', req.body.email);
  
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve şifre gereklidir' });
    }
    
    const user = await User.findOne({
      where: { email: email.toLowerCase(), is_active: true }
    });
    
    if (!user) {
      console.log('❌ No user found with email:', email);
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }
    
    const passwordValid = await bcrypt.compare(password, user.password);
    
    if (!passwordValid) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }
    
    // Token oluştur
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role,
        permissions: user.permissions || {}
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Son giriş zamanını güncelle
    await user.update({
      last_login: new Date(),
      last_login_ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress
    });
    
    // Oturum kaydı oluştur
    await UserSession.create({
      userId: user.id,
      userName: user.full_name,
      userRole: user.role,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      isActive: true,
      deviceInfo: {
        browser: extractBrowserInfo(req.headers['user-agent']),
        os: extractOSInfo(req.headers['user-agent']),
        device: extractDeviceInfo(req.headers['user-agent'])
      }
    });
    
    // Log kaydı
    await SystemLog.create({
      action: 'LOGIN',
      module: 'AUTH',
      recordId: user.id.toString(),
      details: `Kullanıcı giriş yaptı: ${user.email}`,
      performedBy: user.full_name,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    
    console.log('✅ Login successful for:', email);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.full_name,
        role: user.role,
        department: user.department,
        avatarColor: user.avatar_color,
        phone: user.phone,
        permissions: user.permissions || {}
      }
    });
    
  } catch (error) {
    console.error('🔥 LOGIN ERROR:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// User agent parsing helpers
function extractBrowserInfo(userAgent) {
  if (!userAgent) return 'Unknown';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Unknown';
}

function extractOSInfo(userAgent) {
  if (!userAgent) return 'Unknown';
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS')) return 'iOS';
  return 'Unknown';
}

function extractDeviceInfo(userAgent) {
  if (!userAgent) return 'Desktop';
  if (userAgent.includes('Mobile')) return 'Mobile';
  if (userAgent.includes('Tablet')) return 'Tablet';
  return 'Desktop';
}

// ============ KULLANICI YÖNETİMİ API ============

// Tüm kullanıcıları getir
app.get('/api/users', authenticateToken, async (req, res) => {
  console.log('🔍 /api/users endpoint called by:', req.user.email);
  
  try {
    const users = await User.findAll({
      attributes: [
        'id', 'email', 'username', 'full_name', 'phone', 'department', 
        'role', 'is_active', 'avatar_color', 'last_login',
        'permissions', 'createdAt', 'updatedAt'
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Kullanıcıları frontend formatına dönüştür
    const formattedUsers = users.map(user => ({
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      name: user.full_name,
      department: user.department,
      role: user.role,
      isActive: user.is_active,
      lastLogin: user.last_login,
      phone: user.phone,
      avatarColor: user.avatar_color,
      permissions: user.permissions || {
        createSession: false,
        approveCounts: false,
        manageMaterials: false,
        managePatients: false,
        manageInvoices: false,
        bulkStatusChange: false,
        quickCount: false,
        exportData: false,
        manageUsers: false,
        manageSettings: false,
        viewDashboard: true,
        importExcel: false,
        manageDailyPlan: false,
        viewReports: false
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
    
    console.log(`✅ ${formattedUsers.length} kullanıcı döndürüldü`);
    res.json(formattedUsers);
    
  } catch (error) {
    console.error('❌ Kullanıcıları getirme hatası:', error);
    res.status(500).json({ error: 'Kullanıcılar yüklenemedi' });
  }
});

// Yeni kullanıcı oluştur
app.post('/api/users', authenticateToken, async (req, res) => {
  console.log('🔍 /api/users POST called by:', req.user.email);
  
  try {
    const {
      name, email, password, role = 'staff',
      department, phone, permissions
    } = req.body;
    
    // Gerekli alanları kontrol et
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, şifre ve ad soyad gereklidir' });
    }
    
    // Email kontrolü
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Bu email zaten kayıtlı' });
    }
    
    // Varsayılan izinleri ayarla
    const defaultPermissions = {
      createSession: role === 'admin' || role === 'manager',
      approveCounts: role === 'admin' || role === 'manager',
      manageMaterials: role === 'admin',
      managePatients: role !== 'viewer',
      manageInvoices: role === 'admin',
      viewReports: true,
      manageUsers: role === 'admin',
      manageSettings: role === 'admin',
      bulkStatusChange: role === 'admin',
      quickCount: role === 'admin' || role === 'manager',
      exportData: role === 'admin' || role === 'manager',
      viewDashboard: true,
      importExcel: role === 'admin' || role === 'manager',
      manageDailyPlan: role === 'admin' || role === 'manager'
    };
    
    // Şifreyi hash'le
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await User.create({
      email: email.toLowerCase(),
      username: email.split('@')[0],
      password: hashedPassword,
      full_name: name,
      department: department || 'Personel',
      role: role,
      phone: phone || '',
      permissions: permissions || defaultPermissions,
      avatar_color: generateAvatarColor(),
      is_active: true
    });
    
    // Log kaydı
    await SystemLog.create({
      action: 'CREATE',
      module: 'USER',
      recordId: newUser.id.toString(),
      details: `Yeni kullanıcı oluşturuldu: ${name} (${email})`,
      performedBy: req.user.name
    });
    
    console.log(`✅ Yeni kullanıcı oluşturuldu: ${email}`);
    
    res.json({
      id: newUser.id.toString(),
      username: newUser.username,
      email: newUser.email,
      name: newUser.full_name,
      department: newUser.department,
      role: newUser.role,
      isActive: newUser.is_active,
      phone: newUser.phone,
      avatarColor: newUser.avatar_color,
      permissions: newUser.permissions,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt
    });
    
  } catch (error) {
    console.error('❌ Kullanıcı oluşturma hatası:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Bu email zaten kayıtlı' });
    }
    
    res.status(500).json({ error: 'Kullanıcı kaydedilemedi' });
  }
});

// Kullanıcı güncelle
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  console.log(`🔍 /api/users/${req.params.id} PUT called by:`, req.user.email);
  
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    // Güncellenecek alanları hazırla
    const updateData = {};
    
    if (updates.name !== undefined) updateData.full_name = updates.name;
    if (updates.email !== undefined) updateData.email = updates.email.toLowerCase();
    if (updates.department !== undefined) updateData.department = updates.department;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.permissions !== undefined) updateData.permissions = updates.permissions;
    if (updates.avatarColor !== undefined) updateData.avatar_color = updates.avatarColor;
    
    // Şifre güncelleniyorsa hash'le
    if (updates.password) {
      updateData.password = await bcrypt.hash(updates.password, 10);
    }
    
    await user.update(updateData);
    
    // Log kaydı
    await SystemLog.create({
      action: 'UPDATE',
      module: 'USER',
      recordId: id,
      details: `Kullanıcı güncellendi: ${user.full_name}`,
      performedBy: req.user.name
    });
    
    res.json({
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      name: user.full_name,
      department: user.department,
      role: user.role,
      isActive: user.is_active,
      phone: user.phone,
      avatarColor: user.avatar_color,
      permissions: user.permissions,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
    
  } catch (error) {
    console.error('❌ Kullanıcı güncelleme hatası:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Bu email zaten başka bir kullanıcıda kullanılıyor' });
    }
    
    res.status(500).json({ error: 'Kullanıcı güncellenemedi' });
  }
});

// Kullanıcı sil
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  console.log(`🔍 /api/users/${req.params.id} DELETE called by:`, req.user.email);
  
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    // Log kaydı (silmeden önce)
    await SystemLog.create({
      action: 'DELETE',
      module: 'USER',
      recordId: id,
      details: `Kullanıcı silindi: ${user.full_name} (${user.email})`,
      performedBy: req.user.name
    });
    
    await user.destroy();
    
    res.json({ success: true, message: 'Kullanıcı başarıyla silindi' });
    
  } catch (error) {
    console.error('❌ Kullanıcı silme hatası:', error);
    res.status(500).json({ error: 'Kullanıcı silinemedi' });
  }
});

// Oturumları getir
app.get('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await UserSession.findAll({
      where: { isActive: true },
      order: [['loginTime', 'DESC']],
      limit: 50
    });
    
    res.json(sessions.map(session => ({
      id: session.id.toString(),
      userId: session.userId.toString(),
      userName: session.userName,
      userRole: session.userRole,
      loginTime: session.loginTime,
      lastActivity: session.lastActivity,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isActive: session.isActive,
      deviceInfo: session.deviceInfo
    })));
  } catch (error) {
    console.error('❌ Oturumları getirme hatası:', error);
    res.status(500).json({ error: 'Oturumlar yüklenemedi' });
  }
});

// Oturumu sonlandır
app.delete('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const session = await UserSession.findByPk(id);
    if (!session) {
      return res.status(404).json({ error: 'Oturum bulunamadı' });
    }
    
    await session.update({ isActive: false });
    
    // Log kaydı
    await SystemLog.create({
      action: 'TERMINATE_SESSION',
      module: 'USER_SESSION',
      recordId: id,
      details: `Oturum sonlandırıldı: ${session.userName} - Sebep: ${reason || 'Yönetici tarafından'}`,
      performedBy: req.user.name
    });
    
    res.json({ success: true, message: 'Oturum sonlandırıldı' });
  } catch (error) {
    console.error('❌ Oturum sonlandırma hatası:', error);
    res.status(500).json({ error: 'Oturum sonlandırılamadı' });
  }
});

// Sistem loglarını getir
app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    const logs = await SystemLog.findAll({
      where: {
        [Op.or]: [
          { module: 'AUTH' },
          { module: 'USER' },
          { module: 'USER_SESSION' }
        ]
      },
      order: [['performedAt', 'DESC']],
      limit: 100
    });
    
    res.json(logs.map(log => ({
      id: log.id.toString(),
      action: log.action,
      module: log.module,
      recordId: log.recordId,
      details: log.details,
      performedBy: log.performedBy,
      performedAt: log.performedAt,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent
    })));
  } catch (error) {
    console.error('❌ Logları getirme hatası:', error);
    res.status(500).json({ error: 'Loglar yüklenemedi' });
  }
});

// ============ DİĞER API ROUTES ============

// Get user info
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'username', 'full_name', 'department', 'role', 'avatar_color', 'phone', 'permissions']
    });

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.full_name,
        role: user.role,
        department: user.department,
        avatarColor: user.avatar_color,
        phone: user.phone,
        permissions: user.permissions || {}
      }
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all materials
app.get('/api/materials', authenticateToken, async (req, res) => {
  try {
    const { search, category, status, page = 1, limit = 100 } = req.query;
    const where = { isActive: true };
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (category && category !== 'all') where.category = category;
    if (status && status !== 'all') where.status = status;

    const { count, rows } = await Material.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add new material
app.post('/api/materials', authenticateToken, async (req, res) => {
  try {
    const materialData = req.body;
    materialData.createdBy = req.user.name;
    materialData.updatedBy = req.user.name;

    const material = await Material.create(materialData);

    res.json({
      success: true,
      id: material.id,
      name: material.name,
      barcode: material.barcode,
      message: 'Malzeme başarıyla eklendi'
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Bu barkod zaten kayıtlı' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

// Update material
app.put('/api/materials/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    updates.updatedBy = req.user.name;

    const [affectedCount] = await Material.update(updates, {
      where: { id, isActive: true }
    });

    if (affectedCount === 0) {
      return res.status(404).json({ error: 'Malzeme bulunamadı' });
    }

    res.json({
      success: true,
      message: 'Malzeme başarıyla güncellendi'
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete material
app.delete('/api/materials/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [affectedCount] = await Material.update(
      { isActive: false, updatedBy: req.user.name },
      { where: { id } }
    );

    if (affectedCount === 0) {
      return res.status(404).json({ error: 'Malzeme bulunamadı' });
    }

    res.json({
      success: true,
      message: 'Malzeme başarıyla silindi'
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get patients
app.get('/api/patients', authenticateToken, async (req, res) => {
  try {
    const { search } = req.query;
    const where = { isActive: true };

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { surname: { [Op.iLike]: `%${search}%` } },
        { tc: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const patients = await Patient.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, data: patients });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Add patient
app.post('/api/patients', authenticateToken, async (req, res) => {
  try {
    const patientData = req.body;
    patientData.createdBy = req.user.name;

    const patient = await Patient.create(patientData);

    res.json({
      success: true,
      id: patient.id,
      message: 'Hasta başarıyla eklendi'
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Dashboard stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const totalMaterials = await Material.count({ where: { isActive: true } });
    
    const totalStockValueResult = await Material.findOne({
      where: { isActive: true },
      attributes: [
        [Sequelize.fn('SUM', Sequelize.literal('"unitPrice" * "currentStock"')), 'total']
      ],
      raw: true
    });
    
    const totalStockValue = totalStockValueResult?.total || 0;

    const criticalStockCount = await Material.count({
      where: {
        isActive: true,
        currentStock: { [Op.lte]: Sequelize.col('minStock') }
      }
    });

    const totalPatients = await Patient.count({ where: { isActive: true } });

    // Aktif oturum sayısı
    const activeSessions = await UserSession.count({ where: { isActive: true } });

    // Status özeti
    const statusSummaryResult = await Material.findAll({
      where: { isActive: true },
      attributes: [
        'status',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const statusSummary = {
      normal: 0,
      konsinye: 0,
      iade: 0,
      faturalı: 0
    };

    statusSummaryResult.forEach(item => {
      if (item.status === 'normal') statusSummary.normal = parseInt(item.count);
      else if (item.status === 'konsinye') statusSummary.konsinye = parseInt(item.count);
      else if (item.status === 'iade') statusSummary.iade = parseInt(item.count);
      else if (item.status === 'faturalı') statusSummary.faturalı = parseInt(item.count);
    });

    res.json({
      success: true,
      data: {
        totalMaterials,
        totalStockValue: parseFloat(totalStockValue),
        criticalStockCount,
        totalPatients,
        totalInvoices: 0,
        totalInvoiceAmount: 0,
        todayUsageCost: 0,
        todayUsagesCount: 0,
        activeSessions,
        statusSummary,
        totalSessions: await UserSession.count(),
        weeklySales: 0,
        monthlySales: 0
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ YARDIMCI FONKSİYONLAR ============

// Helper function for avatar color
function generateAvatarColor() {
  const colors = [
    '#4F46E5', '#7C3AED', '#EC4899', '#EF4444', 
    '#F59E0B', '#10B981', '#06B6D4', '#3B82F6'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Static files - Vite build klasörünü göster
app.use(express.static(path.join(__dirname, '../dist')));

// React Router fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Start server
const startServer = async () => {
  console.log('🚀 Starting server...');
  console.log(`📦 NODE_ENV: ${process.env.NODE_ENV}`);
  
  await initDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('=========================================');
    console.log('🚀 HOSPITAL STOCK MANAGEMENT API');
    console.log('=========================================');
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 URL: https://stock-dashboard-p5ip.onrender.com`);
    console.log(`📍 Database: PostgreSQL (Neon.tech)`);
    console.log('=========================================');
    console.log('👤 TEST LOGINS:');
    console.log(`   Email: admin@osmangazigoz.com`);
    console.log(`   Password: admin123`);
    console.log('=========================================');
    console.log('📊 API ENDPOINTS:');
    console.log(`   POST   /api/auth/login`);
    console.log(`   GET    /api/users`);
    console.log(`   POST   /api/users`);
    console.log(`   PUT    /api/users/:id`);
    console.log(`   DELETE /api/users/:id`);
    console.log(`   GET    /api/sessions`);
    console.log(`   DELETE /api/sessions/:id`);
    console.log(`   GET    /api/logs`);
    console.log(`   GET    /api/materials`);
    console.log(`   GET    /api/patients`);
    console.log(`   GET    /api/dashboard/stats`);
    console.log('=========================================');
  });
};

startServer().catch(console.error);