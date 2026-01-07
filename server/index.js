// index.js - EN BAŞ SATIR
require('dotenv').config();

// DATABASE_URL kontrolü
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL is not defined in .env file');
  console.log('💡 Using hardcoded DATABASE_URL as fallback');
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_UVsBCR7JM8NX@ep-fragrant-voice-agsxur99-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
}

console.log('✅ DATABASE_URL:', process.env.DATABASE_URL ? 'Loaded' : 'Missing');

// index.js - TAM GÜNCELLENMİŞ VERSİYON - GERÇEK ZAMANLI VERİTABANI YÖNETİMİ
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

// PostgreSQL Database Connection - UPDATED FOR REAL-TIME SYNC
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
    max: 20,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  retry: {
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/
    ],
    max: 3
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(morgan('dev'));
app.use(cors({
  origin: ['https://stock-dashboard-p5ip.onrender.com', 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
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

// ============ DATABASE MODELS - TABLOLARI NEON POSTGRESQL İLE UYUMLU HALE GETİRİYORUZ ============

// Users Tablosu - Neon ile uyumlu
const User = sequelize.define('User', {
  id: { 
    type: DataTypes.STRING, 
    primaryKey: true,
    defaultValue: () => 'user_' + Math.random().toString(36).substring(2, 12)
  },
  username: { 
    type: DataTypes.STRING, 
    allowNull: false,
    unique: true 
  },
  email: { 
    type: DataTypes.STRING, 
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  phone: { 
    type: DataTypes.STRING 
  },
  department: { 
    type: DataTypes.STRING 
  },
  role: { 
    type: DataTypes.STRING, 
    defaultValue: 'user',
    validate: {
      isIn: [['admin', 'manager', 'staff', 'user']]
    }
  },
  permissions: { 
    type: DataTypes.JSONB, 
    defaultValue: {} 
  },
  name: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  avatarColor: { 
    type: DataTypes.STRING, 
    defaultValue: '#4F46E5' 
  },
  isActive: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true 
  },
  lastLogin: { 
    type: DataTypes.DATE 
  },
  lastLoginIp: { 
    type: DataTypes.STRING 
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
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

// Materials Tablosu - Neon ile uyumlu
const Material = sequelize.define('Material', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  name: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  barcode: { 
    type: DataTypes.STRING, 
    unique: true, 
    allowNull: false 
  },
  gtin: { 
    type: DataTypes.STRING 
  },
  sn: { 
    type: DataTypes.STRING 
  },
  udiCode: { 
    type: DataTypes.STRING 
  },
  allBarcode: { 
    type: DataTypes.STRING 
  },
  intuitiveCode: { 
    type: DataTypes.STRING 
  },
  category: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  subCategory: { 
    type: DataTypes.STRING 
  },
  unit: { 
    type: DataTypes.STRING, 
    allowNull: false,
    defaultValue: 'adet'
  },
  unitPrice: { 
    type: DataTypes.DECIMAL(10, 2), 
    defaultValue: 0 
  },
  currentStock: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0 
  },
  minStock: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0 
  },
  supplier: { 
    type: DataTypes.STRING 
  },
  expirationDate: { 
    type: DataTypes.DATEONLY 
  },
  serialNoStatus: { 
    type: DataTypes.STRING 
  },
  materialDescription: { 
    type: DataTypes.TEXT 
  },
  status: { 
    type: DataTypes.STRING, 
    defaultValue: 'normal',
    validate: {
      isIn: [['normal', 'konsinye', 'iade', 'faturalı']]
    }
  },
  createdBy: { 
    type: DataTypes.STRING 
  },
  updatedBy: { 
    type: DataTypes.STRING 
  },
  isActive: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true 
  }
}, {
  tableName: 'materials',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

// Patients Tablosu - Neon ile uyumlu
const Patient = sequelize.define('Patient', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  name: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  surname: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  tc: { 
    type: DataTypes.STRING, 
    unique: true 
  },
  phone: { 
    type: DataTypes.STRING 
  },
  email: { 
    type: DataTypes.STRING,
    validate: {
      isEmail: true
    }
  },
  birth_date: { 
    type: DataTypes.DATEONLY 
  },
  gender: { 
    type: DataTypes.STRING,
    validate: {
      isIn: [['Erkek', 'Kadın', 'Diğer']]
    }
  },
  address: { 
    type: DataTypes.TEXT 
  },
  notes: { 
    type: DataTypes.TEXT 
  },
  bloodType: { 
    type: DataTypes.STRING 
  },
  allergies: { 
    type: DataTypes.TEXT 
  },
  chronicDiseases: { 
    type: DataTypes.TEXT 
  },
  emergencyContact: { 
    type: DataTypes.STRING 
  },
  insuranceProvider: { 
    type: DataTypes.STRING 
  },
  doctorId: { 
    type: DataTypes.STRING 
  },
  isActive: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true 
  },
  createdBy: { 
    type: DataTypes.STRING 
  }
}, {
  tableName: 'patients',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

// Oturum modeli
const UserSession = sequelize.define('UserSession', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  userId: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  userName: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  userRole: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  loginTime: { 
    type: DataTypes.DATE, 
    defaultValue: DataTypes.NOW 
  },
  lastActivity: { 
    type: DataTypes.DATE, 
    defaultValue: DataTypes.NOW 
  },
  ipAddress: { 
    type: DataTypes.STRING 
  },
  userAgent: { 
    type: DataTypes.TEXT 
  },
  isActive: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true 
  },
  deviceInfo: { 
    type: DataTypes.JSONB, 
    defaultValue: {} 
  }
}, {
  tableName: 'user_sessions',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

// Sistem log modeli
const SystemLog = sequelize.define('SystemLog', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  action: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  module: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  recordId: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  details: { 
    type: DataTypes.TEXT, 
    allowNull: false 
  },
  performedBy: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  performedAt: { 
    type: DataTypes.DATE, 
    defaultValue: DataTypes.NOW 
  },
  ipAddress: { 
    type: DataTypes.STRING 
  },
  userAgent: { 
    type: DataTypes.TEXT 
  }
}, {
  tableName: 'system_logs',
  timestamps: false
});

// Kategoriler Tablosu
const Category = sequelize.define('Category', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  name: { 
    type: DataTypes.STRING, 
    unique: true, 
    allowNull: false 
  },
  description: { 
    type: DataTypes.TEXT 
  },
  isActive: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true 
  }
}, {
  tableName: 'categories',
  timestamps: true
});

// Tedarikçiler Tablosu
const Supplier = sequelize.define('Supplier', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  name: { 
    type: DataTypes.STRING, 
    unique: true, 
    allowNull: false 
  },
  contactPerson: { 
    type: DataTypes.STRING 
  },
  email: { 
    type: DataTypes.STRING 
  },
  phone: { 
    type: DataTypes.STRING 
  },
  address: { 
    type: DataTypes.TEXT 
  },
  taxNumber: { 
    type: DataTypes.STRING 
  },
  taxOffice: { 
    type: DataTypes.STRING 
  },
  description: { 
    type: DataTypes.TEXT 
  },
  isActive: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true 
  }
}, {
  tableName: 'suppliers',
  timestamps: true
});

// Faturalar Tablosu
const Invoice = sequelize.define('Invoice', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  invoiceNumber: { 
    type: DataTypes.STRING, 
    unique: true, 
    allowNull: false 
  },
  patientId: { 
    type: DataTypes.INTEGER, 
    allowNull: false 
  },
  amount: { 
    type: DataTypes.DECIMAL(10, 2), 
    allowNull: false 
  },
  date: { 
    type: DataTypes.DATEONLY, 
    allowNull: false 
  },
  status: { 
    type: DataTypes.STRING, 
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'paid', 'cancelled']]
    }
  },
  description: { 
    type: DataTypes.TEXT 
  },
  createdBy: { 
    type: DataTypes.STRING 
  }
}, {
  tableName: 'invoices',
  timestamps: true
});

// Doktorlar Tablosu
const Doctor = sequelize.define('Doctor', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  name: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  surname: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  title: { 
    type: DataTypes.STRING 
  },
  specialization: { 
    type: DataTypes.STRING 
  },
  phone: { 
    type: DataTypes.STRING 
  },
  email: { 
    type: DataTypes.STRING 
  },
  isActive: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true 
  }
}, {
  tableName: 'doctors',
  timestamps: true
});

// Initialize Database
const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL veritabanına başarıyla bağlandı.');
    
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
          name: 'Sistem Yöneticisi',
          department: 'Yönetim',
          role: 'admin',
          avatarColor: '#4F46E5',
          permissions: {
            createSession: true, approveCounts: true, manageMaterials: true,
            managePatients: true, manageInvoices: true, bulkStatusChange: true,
            quickCount: true, exportData: true, manageUsers: true,
            manageSettings: true, viewDashboard: true, importExcel: true,
            manageDailyPlan: true, viewReports: true, manageDoctors: true,
            manageCategories: true, manageSuppliers: true
          },
          isActive: true
        });
        console.log('✅ Default admin user created: admin@osmangazigoz.com / admin123');
      } else {
        console.log('✅ Admin user zaten mevcut.');
      }
    } catch (userError) {
      console.error('❌ Admin user creation error:', userError.message);
    }
    
    // Varsayılan kategoriler
    const defaultCategories = [
      'İlaç', 'Tıbbi Malzeme', 'Laboratuvar', 'Radyoloji', 
      'Ameliyathane', 'Yoğun Bakım', 'Poliklinik', 'Diğer'
    ];
    
    for (const categoryName of defaultCategories) {
      const existingCategory = await Category.findOne({ where: { name: categoryName } });
      if (!existingCategory) {
        await Category.create({ 
          name: categoryName, 
          description: `${categoryName} kategorisi`,
          isActive: true 
        });
      }
    }
    console.log('✅ Default categories checked/created');
    
    console.log('✅ Database initialization completed.');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
  }
};

// ============ HELPER FUNCTIONS ============

// Avatar rengi oluştur
function generateAvatarColor() {
  const colors = [
    '#4F46E5', '#7C3AED', '#EC4899', '#EF4444', 
    '#F59E0B', '#10B981', '#06B6D4', '#3B82F6'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

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
      version: '2.0.0',
      realtime: true
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
      where: { email: email.toLowerCase(), isActive: true }
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
        name: user.name,
        role: user.role,
        permissions: user.permissions || {}
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Son giriş zamanını güncelle
    await user.update({
      lastLogin: new Date(),
      lastLoginIp: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress
    });
    
    // Oturum kaydı oluştur
    await UserSession.create({
      userId: user.id,
      userName: user.name,
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
      recordId: user.id,
      details: `Kullanıcı giriş yaptı: ${user.email}`,
      performedBy: user.name,
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
        name: user.name,
        role: user.role,
        department: user.department,
        avatarColor: user.avatarColor,
        phone: user.phone,
        permissions: user.permissions || {}
      }
    });
    
  } catch (error) {
    console.error('🔥 LOGIN ERROR:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ============ USER MANAGEMENT ============

// Get all users
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        'id', 'email', 'username', 'name', 'phone', 'department', 
        'role', 'isActive', 'avatarColor', 'lastLogin',
        'permissions', 'createdAt', 'updatedAt'
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(users);
  } catch (error) {
    console.error('❌ Kullanıcıları getirme hatası:', error);
    res.status(500).json({ error: 'Kullanıcılar yüklenemedi' });
  }
});

// Create new user
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const {
      name, email, password, role = 'staff',
      department, phone, permissions
    } = req.body;
    
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
      manageDailyPlan: role === 'admin' || role === 'manager',
      manageDoctors: role === 'admin',
      manageCategories: role === 'admin',
      manageSuppliers: role === 'admin'
    };
    
    const newUser = await User.create({
      email: email.toLowerCase(),
      username: email.split('@')[0],
      password: password,
      name: name,
      department: department || 'Personel',
      role: role,
      phone: phone || '',
      permissions: permissions || defaultPermissions,
      avatarColor: generateAvatarColor(),
      isActive: true
    });
    
    // Log kaydı
    await SystemLog.create({
      action: 'CREATE',
      module: 'USER',
      recordId: newUser.id,
      details: `Yeni kullanıcı oluşturuldu: ${name} (${email})`,
      performedBy: req.user.name
    });
    
    res.json(newUser);
    
  } catch (error) {
    console.error('❌ Kullanıcı oluşturma hatası:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Bu email zaten kayıtlı' });
    }
    
    res.status(500).json({ error: 'Kullanıcı kaydedilemedi' });
  }
});

// Update user
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    // Güncellenecek alanları hazırla
    const updateData = {};
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) updateData.email = updates.email.toLowerCase();
    if (updates.department !== undefined) updateData.department = updates.department;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.permissions !== undefined) updateData.permissions = updates.permissions;
    if (updates.avatarColor !== undefined) updateData.avatarColor = updates.avatarColor;
    
    await user.update(updateData);
    
    // Log kaydı
    await SystemLog.create({
      action: 'UPDATE',
      module: 'USER',
      recordId: id,
      details: `Kullanıcı güncellendi: ${user.name}`,
      performedBy: req.user.name
    });
    
    res.json(user);
    
  } catch (error) {
    console.error('❌ Kullanıcı güncelleme hatası:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Bu email zaten başka bir kullanıcıda kullanılıyor' });
    }
    
    res.status(500).json({ error: 'Kullanıcı güncellenemedi' });
  }
});

// Delete user
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
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
      details: `Kullanıcı silindi: ${user.name} (${user.email})`,
      performedBy: req.user.name
    });
    
    await user.destroy();
    
    res.json({ success: true, message: 'Kullanıcı başarıyla silindi' });
    
  } catch (error) {
    console.error('❌ Kullanıcı silme hatası:', error);
    res.status(500).json({ error: 'Kullanıcı silinemedi' });
  }
});

// ============ MATERIAL MANAGEMENT ============

// Get all materials
app.get('/api/materials', authenticateToken, async (req, res) => {
  try {
    const { 
      search, 
      category, 
      status, 
      page = 1, 
      limit = 100,
      sortBy = 'name',
      sortOrder = 'ASC'
    } = req.query;
    
    const where = { isActive: true };
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } },
        { gtin: { [Op.iLike]: `%${search}%` } },
        { sn: { [Op.iLike]: `%${search}%` } },
        { udiCode: { [Op.iLike]: `%${search}%` } },
        { allBarcode: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } },
        { supplier: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (category && category !== 'all') where.category = category;
    if (status && status !== 'all') where.status = status;
    
    const order = [];
    if (sortBy === 'currentStock') {
      order.push([sequelize.literal('CAST("currentStock" AS INTEGER)'), sortOrder]);
    } else if (sortBy === 'unitPrice') {
      order.push([sequelize.literal('CAST("unitPrice" AS DECIMAL)'), sortOrder]);
    } else {
      order.push([sortBy, sortOrder]);
    }
    
    const { count, rows } = await Material.findAndCountAll({
      where,
      order,
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

// Get single material
app.get('/api/materials/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const material = await Material.findByPk(id);
    
    if (!material) {
      return res.status(404).json({ error: 'Malzeme bulunamadı' });
    }
    
    res.json({ success: true, data: material });
  } catch (error) {
    console.error('Get material error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add new material
app.post('/api/materials', authenticateToken, async (req, res) => {
  try {
    const materialData = req.body;
    materialData.createdBy = req.user.name;
    materialData.updatedBy = req.user.name;
    
    // Barcode kontrolü
    const existingBarcode = await Material.findOne({ 
      where: { barcode: materialData.barcode } 
    });
    
    if (existingBarcode) {
      return res.status(400).json({ error: 'Bu barkod zaten kayıtlı' });
    }
    
    const material = await Material.create(materialData);
    
    // Log kaydı
    await SystemLog.create({
      action: 'CREATE',
      module: 'MATERIAL',
      recordId: material.id.toString(),
      details: `Yeni malzeme eklendi: ${material.name} (Barkod: ${material.barcode})`,
      performedBy: req.user.name
    });
    
    res.json({
      success: true,
      id: material.id,
      name: material.name,
      barcode: material.barcode,
      message: 'Malzeme başarıyla eklendi'
    });
  } catch (error) {
    console.error('Add material error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update material
app.put('/api/materials/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    updates.updatedBy = req.user.name;
    
    const material = await Material.findByPk(id);
    if (!material) {
      return res.status(404).json({ error: 'Malzeme bulunamadı' });
    }
    
    // Barcode değiştiyse kontrol et
    if (updates.barcode && updates.barcode !== material.barcode) {
      const existingBarcode = await Material.findOne({ 
        where: { barcode: updates.barcode } 
      });
      
      if (existingBarcode && existingBarcode.id !== parseInt(id)) {
        return res.status(400).json({ error: 'Bu barkod başka bir malzemede kullanılıyor' });
      }
    }
    
    await material.update(updates);
    
    // Log kaydı
    await SystemLog.create({
      action: 'UPDATE',
      module: 'MATERIAL',
      recordId: id,
      details: `Malzeme güncellendi: ${material.name} (Barkod: ${material.barcode})`,
      performedBy: req.user.name
    });
    
    res.json({
      success: true,
      message: 'Malzeme başarıyla güncellendi'
    });
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete material
app.delete('/api/materials/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const material = await Material.findByPk(id);
    
    if (!material) {
      return res.status(404).json({ error: 'Malzeme bulunamadı' });
    }
    
    await material.update({ 
      isActive: false, 
      updatedBy: req.user.name 
    });
    
    // Log kaydı
    await SystemLog.create({
      action: 'DELETE',
      module: 'MATERIAL',
      recordId: id,
      details: `Malzeme silindi: ${material.name} (Barkod: ${material.barcode})`,
      performedBy: req.user.name
    });
    
    res.json({
      success: true,
      message: 'Malzeme başarıyla silindi'
    });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Bulk update materials
app.post('/api/materials/bulk-update', authenticateToken, async (req, res) => {
  try {
    const { materialIds, updates } = req.body;
    
    if (!materialIds || !materialIds.length || !updates) {
      return res.status(400).json({ error: 'Geçersiz istek' });
    }
    
    const updatedCount = await Material.update(
      { 
        ...updates, 
        updatedBy: req.user.name,
        updatedAt: new Date()
      },
      { 
        where: { 
          id: { [Op.in]: materialIds },
          isActive: true 
        } 
      }
    );
    
    // Log kaydı
    await SystemLog.create({
      action: 'BULK_UPDATE',
      module: 'MATERIAL',
      recordId: 'BATCH_' + materialIds.join(','),
      details: `${updatedCount[0]} malzeme toplu güncellendi`,
      performedBy: req.user.name
    });
    
    res.json({
      success: true,
      message: `${updatedCount[0]} malzeme başarıyla güncellendi`
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ PATIENT MANAGEMENT ============

// Get all patients
app.get('/api/patients', authenticateToken, async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const where = { isActive: true };
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { surname: { [Op.iLike]: `%${search}%` } },
        { tc: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const { count, rows } = await Patient.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
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
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add new patient
app.post('/api/patients', authenticateToken, async (req, res) => {
  try {
    const patientData = req.body;
    patientData.createdBy = req.user.name;
    
    // TC kontrolü
    if (patientData.tc) {
      const existingPatient = await Patient.findOne({ 
        where: { tc: patientData.tc } 
      });
      
      if (existingPatient) {
        return res.status(400).json({ error: 'Bu TC kimlik numarası zaten kayıtlı' });
      }
    }
    
    const patient = await Patient.create(patientData);
    
    // Log kaydı
    await SystemLog.create({
      action: 'CREATE',
      module: 'PATIENT',
      recordId: patient.id.toString(),
      details: `Yeni hasta eklendi: ${patient.name} ${patient.surname}`,
      performedBy: req.user.name
    });
    
    res.json({
      success: true,
      id: patient.id,
      message: 'Hasta başarıyla eklendi'
    });
  } catch (error) {
    console.error('Add patient error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update patient
app.put('/api/patients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const patient = await Patient.findByPk(id);
    if (!patient) {
      return res.status(404).json({ error: 'Hasta bulunamadı' });
    }
    
    // TC değiştiyse kontrol et
    if (updates.tc && updates.tc !== patient.tc) {
      const existingPatient = await Patient.findOne({ 
        where: { tc: updates.tc } 
      });
      
      if (existingPatient && existingPatient.id !== parseInt(id)) {
        return res.status(400).json({ error: 'Bu TC kimlik numarası başka bir hastada kullanılıyor' });
      }
    }
    
    await patient.update(updates);
    
    // Log kaydı
    await SystemLog.create({
      action: 'UPDATE',
      module: 'PATIENT',
      recordId: id,
      details: `Hasta güncellendi: ${patient.name} ${patient.surname}`,
      performedBy: req.user.name
    });
    
    res.json({
      success: true,
      message: 'Hasta başarıyla güncellendi'
    });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete patient
app.delete('/api/patients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findByPk(id);
    
    if (!patient) {
      return res.status(404).json({ error: 'Hasta bulunamadı' });
    }
    
    await patient.update({ isActive: false });
    
    // Log kaydı
    await SystemLog.create({
      action: 'DELETE',
      module: 'PATIENT',
      recordId: id,
      details: `Hasta silindi: ${patient.name} ${patient.surname}`,
      performedBy: req.user.name
    });
    
    res.json({
      success: true,
      message: 'Hasta başarıyla silindi'
    });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ CATEGORY MANAGEMENT ============

// Get all categories
app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add new category
app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Kategori adı zorunludur' });
    }
    
    // Kategori kontrolü
    const existingCategory = await Category.findOne({ 
      where: { name: name } 
    });
    
    if (existingCategory) {
      return res.status(400).json({ error: 'Bu kategori zaten kayıtlı' });
    }
    
    const category = await Category.create({
      name,
      description: description || '',
      isActive: true
    });
    
    res.json({
      success: true,
      id: category.id,
      message: 'Kategori başarıyla eklendi'
    });
  } catch (error) {
    console.error('Add category error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ SUPPLIER MANAGEMENT ============

// Get all suppliers
app.get('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const suppliers = await Supplier.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    
    res.json({ success: true, data: suppliers });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add new supplier
app.post('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const { name, contactPerson, email, phone, address, taxNumber, taxOffice, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Tedarikçi adı zorunludur' });
    }
    
    // Tedarikçi kontrolü
    const existingSupplier = await Supplier.findOne({ 
      where: { name: name } 
    });
    
    if (existingSupplier) {
      return res.status(400).json({ error: 'Bu tedarikçi zaten kayıtlı' });
    }
    
    const supplier = await Supplier.create({
      name,
      contactPerson: contactPerson || '',
      email: email || '',
      phone: phone || '',
      address: address || '',
      taxNumber: taxNumber || '',
      taxOffice: taxOffice || '',
      description: description || '',
      isActive: true
    });
    
    res.json({
      success: true,
      id: supplier.id,
      message: 'Tedarikçi başarıyla eklendi'
    });
  } catch (error) {
    console.error('Add supplier error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ DOCTOR MANAGEMENT ============

// Get all doctors
app.get('/api/doctors', authenticateToken, async (req, res) => {
  try {
    const doctors = await Doctor.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    
    res.json({ success: true, data: doctors });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add new doctor
app.post('/api/doctors', authenticateToken, async (req, res) => {
  try {
    const { name, surname, title, specialization, phone, email } = req.body;
    
    if (!name || !surname) {
      return res.status(400).json({ error: 'Doktor adı ve soyadı zorunludur' });
    }
    
    const doctor = await Doctor.create({
      name,
      surname,
      title: title || '',
      specialization: specialization || '',
      phone: phone || '',
      email: email || '',
      isActive: true
    });
    
    res.json({
      success: true,
      id: doctor.id,
      message: 'Doktor başarıyla eklendi'
    });
  } catch (error) {
    console.error('Add doctor error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ INVOICE MANAGEMENT ============

// Get all invoices
app.get('/api/invoices', authenticateToken, async (req, res) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 50 } = req.query;
    const where = {};
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    if (status && status !== 'all') where.status = status;
    if (startDate && endDate) {
      where.date = {
        [Op.between]: [startDate, endDate]
      };
    }
    
    const { count, rows } = await Invoice.findAndCountAll({
      where,
      order: [['date', 'DESC']],
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
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add new invoice
app.post('/api/invoices', authenticateToken, async (req, res) => {
  try {
    const { invoiceNumber, patientId, amount, date, status, description } = req.body;
    
    if (!invoiceNumber || !patientId || !amount || !date) {
      return res.status(400).json({ error: 'Fatura numarası, hasta, tutar ve tarih zorunludur' });
    }
    
    // Fatura numarası kontrolü
    const existingInvoice = await Invoice.findOne({ 
      where: { invoiceNumber: invoiceNumber } 
    });
    
    if (existingInvoice) {
      return res.status(400).json({ error: 'Bu fatura numarası zaten kayıtlı' });
    }
    
    const invoice = await Invoice.create({
      invoiceNumber,
      patientId,
      amount,
      date,
      status: status || 'pending',
      description: description || '',
      createdBy: req.user.name
    });
    
    res.json({
      success: true,
      id: invoice.id,
      message: 'Fatura başarıyla eklendi'
    });
  } catch (error) {
    console.error('Add invoice error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ DASHBOARD STATS ============

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    // Total materials
    const totalMaterials = await Material.count({ where: { isActive: true } });
    
    // Total stock value
    const totalStockValueResult = await Material.findOne({
      where: { isActive: true },
      attributes: [
        [Sequelize.fn('SUM', Sequelize.literal('COALESCE("unitPrice", 0) * COALESCE("currentStock", 0)')), 'total']
      ],
      raw: true
    });
    
    const totalStockValue = totalStockValueResult?.total || 0;
    
    // Critical stock count
    const criticalStockCount = await Material.count({
      where: {
        isActive: true,
        currentStock: { 
          [Op.lte]: Sequelize.col('minStock') 
        }
      }
    });
    
    // Total patients
    const totalPatients = await Patient.count({ where: { isActive: true } });
    
    // Active sessions
    const activeSessions = await UserSession.count({ 
      where: { 
        isActive: true,
        lastActivity: {
          [Op.gte]: new Date(Date.now() - 30 * 60 * 1000) // Last 30 minutes
        }
      } 
    });
    
    // Status summary
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
      if (item.status === 'normal') statusSummary.normal = parseInt(item.count) || 0;
      else if (item.status === 'konsinye') statusSummary.konsinye = parseInt(item.count) || 0;
      else if (item.status === 'iade') statusSummary.iade = parseInt(item.count) || 0;
      else if (item.status === 'faturalı') statusSummary.faturalı = parseInt(item.count) || 0;
    });
    
    // Total invoices and amount
    const invoiceStats = await Invoice.findOne({
      attributes: [
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'totalAmount']
      ],
      raw: true
    });
    
    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayMaterials = await Material.count({
      where: {
        createdAt: {
          [Op.gte]: today
        }
      }
    });
    
    const todayPatients = await Patient.count({
      where: {
        createdAt: {
          [Op.gte]: today
        }
      }
    });
    
    res.json({
      success: true,
      data: {
        totalMaterials,
        totalStockValue: parseFloat(totalStockValue) || 0,
        criticalStockCount,
        totalPatients,
        totalInvoices: parseInt(invoiceStats?.total) || 0,
        totalInvoiceAmount: parseFloat(invoiceStats?.totalAmount) || 0,
        activeSessions,
        statusSummary,
        todayMaterials,
        todayPatients,
        totalUsers: await User.count({ where: { isActive: true } }),
        totalCategories: await Category.count({ where: { isActive: true } }),
        totalSuppliers: await Supplier.count({ where: { isActive: true } })
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ USER SESSIONS ============

// Get active sessions
app.get('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await UserSession.findAll({
      where: { isActive: true },
      order: [['lastActivity', 'DESC']],
      limit: 50
    });
    
    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Terminate session
app.delete('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const session = await UserSession.findByPk(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Oturum bulunamadı' });
    }
    
    await session.update({ isActive: false });
    
    res.json({ 
      success: true, 
      message: 'Oturum sonlandırıldı' 
    });
  } catch (error) {
    console.error('Terminate session error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ SYSTEM LOGS ============

// Get system logs
app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    const logs = await SystemLog.findAll({
      order: [['performedAt', 'DESC']],
      limit: 100
    });
    
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ USER PROFILE ============

// Get current user info
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        department: user.department,
        avatarColor: user.avatarColor,
        phone: user.phone,
        permissions: user.permissions || {}
      }
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update user profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    const { name, phone, department, avatarColor } = req.body;
    
    await user.update({
      name: name || user.name,
      phone: phone || user.phone,
      department: department || user.department,
      avatarColor: avatarColor || user.avatarColor
    });
    
    res.json({
      success: true,
      message: 'Profil başarıyla güncellendi'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Change password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mevcut şifre ve yeni şifre gereklidir' });
    }
    
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    const passwordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!passwordValid) {
      return res.status(400).json({ error: 'Mevcut şifre yanlış' });
    }
    
    await user.update({ password: newPassword });
    
    res.json({
      success: true,
      message: 'Şifre başarıyla değiştirildi'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ EXPORT/IMPORT ============

// Export materials to Excel
app.get('/api/export/materials', authenticateToken, async (req, res) => {
  try {
    const materials = await Material.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    
    // CSV formatına çevir
    const headers = [
      'ID', 'Ad', 'Barkod', 'GTIN', 'SN', 'UDI Code', 'All Barcode',
      'Kategori', 'Alt Kategori', 'Birim', 'Birim Fiyat', 'Mevcut Stok',
      'Kritik Stok', 'Tedarikçi', 'SKT', 'Seri No Durumu', 'Açıklama', 'Statü'
    ];
    
    const csvData = materials.map(material => [
      material.id,
      material.name,
      material.barcode,
      material.gtin || '',
      material.sn || '',
      material.udiCode || '',
      material.allBarcode || '',
      material.category,
      material.subCategory || '',
      material.unit,
      material.unitPrice,
      material.currentStock,
      material.minStock,
      material.supplier || '',
      material.expirationDate || '',
      material.serialNoStatus || '',
      material.materialDescription || '',
      material.status
    ]);
    
    const csv = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    // Log kaydı
    await SystemLog.create({
      action: 'EXPORT',
      module: 'MATERIAL',
      recordId: 'ALL',
      details: 'Tüm malzemeler Excel formatında dışa aktarıldı',
      performedBy: req.user.name
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=materials.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export materials error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Import materials from Excel
app.post('/api/import/materials', authenticateToken, async (req, res) => {
  try {
    const { materials } = req.body;
    
    if (!materials || !Array.isArray(materials)) {
      return res.status(400).json({ error: 'Geçersiz veri formatı' });
    }
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const materialData of materials) {
      try {
        // Zorunlu alanları kontrol et
        if (!materialData.name || !materialData.barcode) {
          errors.push(`${materialData.name || 'Unknown'}: Ad ve barkod zorunludur`);
          errorCount++;
          continue;
        }
        
        // Barkod kontrolü
        const existingMaterial = await Material.findOne({
          where: { barcode: materialData.barcode }
        });
        
        if (existingMaterial) {
          errors.push(`${materialData.name}: Bu barkod zaten kayıtlı (${existingMaterial.name})`);
          errorCount++;
          continue;
        }
        
        // Yeni malzeme oluştur
        await Material.create({
          ...materialData,
          createdBy: req.user.name,
          updatedBy: req.user.name,
          isActive: true
        });
        
        successCount++;
      } catch (error) {
        errors.push(`${materialData.name || 'Unknown'}: ${error.message}`);
        errorCount++;
      }
    }
    
    // Log kaydı
    await SystemLog.create({
      action: 'IMPORT',
      module: 'MATERIAL',
      recordId: 'BATCH_IMPORT',
      details: `${successCount} malzeme içe aktarıldı, ${errorCount} hata`,
      performedBy: req.user.name
    });
    
    res.json({
      success: true,
      message: `${successCount} malzeme başarıyla içe aktarıldı`,
      errors: errors.slice(0, 10), // İlk 10 hatayı göster
      totalErrors: errorCount
    });
  } catch (error) {
    console.error('Import materials error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ REAL-TIME SYNC ENDPOINTS ============

// Get last sync timestamp
app.get('/api/sync/timestamp', authenticateToken, async (req, res) => {
  try {
    // Son güncellenme zamanlarını al
    const [lastMaterialUpdate] = await sequelize.query(
      'SELECT MAX("updatedAt") as timestamp FROM materials WHERE "isActive" = true'
    );
    
    const [lastPatientUpdate] = await sequelize.query(
      'SELECT MAX("updatedAt") as timestamp FROM patients WHERE "isActive" = true'
    );
    
    const timestamps = {
      materials: lastMaterialUpdate[0]?.timestamp || new Date(0),
      patients: lastPatientUpdate[0]?.timestamp || new Date(0),
      categories: new Date(), // Her zaman güncel
      suppliers: new Date(), // Her zaman güncel
      server: new Date()
    };
    
    res.json({
      success: true,
      timestamps
    });
  } catch (error) {
    console.error('Get sync timestamp error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Check for updates
app.post('/api/sync/check', authenticateToken, async (req, res) => {
  try {
    const { lastSync } = req.body;
    
    if (!lastSync) {
      return res.status(400).json({ error: 'Son sync zamanı gereklidir' });
    }
    
    const updates = {
      materials: {
        updated: [],
        deleted: []
      },
      patients: {
        updated: [],
        deleted: []
      }
    };
    
    // Updated materials since last sync
    const updatedMaterials = await Material.findAll({
      where: {
        updatedAt: {
          [Op.gt]: new Date(lastSync)
        },
        isActive: true
      }
    });
    
    updates.materials.updated = updatedMaterials;
    
    // Deleted materials (isActive = false)
    const deletedMaterials = await Material.findAll({
      where: {
        updatedAt: {
          [Op.gt]: new Date(lastSync)
        },
        isActive: false
      },
      attributes: ['id']
    });
    
    updates.materials.deleted = deletedMaterials.map(m => m.id);
    
    // Updated patients since last sync
    const updatedPatients = await Patient.findAll({
      where: {
        updatedAt: {
          [Op.gt]: new Date(lastSync)
        },
        isActive: true
      }
    });
    
    updates.patients.updated = updatedPatients;
    
    // Deleted patients
    const deletedPatients = await Patient.findAll({
      where: {
        updatedAt: {
          [Op.gt]: new Date(lastSync)
        },
        isActive: false
      },
      attributes: ['id']
    });
    
    updates.patients.deleted = deletedPatients.map(p => p.id);
    
    res.json({
      success: true,
      updates,
      serverTime: new Date()
    });
  } catch (error) {
    console.error('Check updates error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ STATIC FILES AND CATCH-ALL ============

// Static files - Vite build klasörünü göster
app.use(express.static(path.join(__dirname, '../dist')));

// React Router fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ============ START SERVER ============

const startServer = async () => {
  console.log('🚀 Starting server...');
  console.log(`📦 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🌍 CORS Origins: https://stock-dashboard-p5ip.onrender.com, http://localhost:5173, http://localhost:3000`);
  
  await initDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('=========================================');
    console.log('🚀 HOSPITAL STOCK MANAGEMENT API v2.0');
    console.log('📍 REAL-TIME DATABASE SYNC ENABLED');
    console.log('=========================================');
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 Server URL: https://stock-dashboard-p5ip.onrender.com`);
    console.log(`📍 Database: PostgreSQL (Neon.tech)`);
    console.log('=========================================');
    console.log('👤 TEST LOGINS:');
    console.log(`   Email: admin@osmangazigoz.com`);
    console.log(`   Password: admin123`);
    console.log('=========================================');
    console.log('📊 API ENDPOINTS:');
    console.log(`   POST   /api/auth/login`);
    console.log(`   GET    /api/auth/me`);
    console.log(`   GET    /api/materials`);
    console.log(`   POST   /api/materials`);
    console.log(`   PUT    /api/materials/:id`);
    console.log(`   DELETE /api/materials/:id`);
    console.log(`   GET    /api/patients`);
    console.log(`   GET    /api/categories`);
    console.log(`   GET    /api/suppliers`);
    console.log(`   GET    /api/doctors`);
    console.log(`   GET    /api/invoices`);
    console.log(`   GET    /api/dashboard/stats`);
    console.log(`   GET    /api/users`);
    console.log(`   GET    /api/sessions`);
    console.log(`   GET    /api/logs`);
    console.log('=========================================');
    console.log('✅ Ready for real-time multi-user access!');
    console.log('=========================================');
  });
};

startServer().catch(console.error);