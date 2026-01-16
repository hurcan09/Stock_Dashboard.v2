// server/index.js - TAM GÜNCELLENMİŞ VERSİYON
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
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'stock-dashboard-super-secret-jwt-key-2024';

// 1. PostgreSQL Database Connection
console.log('🔧 Environment check starting...');
console.log('🔐 JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Missing');
console.log('🌐 PORT:', process.env.PORT);
console.log('🗄️ DATABASE_URL:', process.env.DATABASE_URL ? 'Set (Length: ' + process.env.DATABASE_URL.length + ')' : 'Missing');

let sequelize;
let isDatabaseConnected = false;

if (process.env.DATABASE_URL) {
  try {
    console.log('🔗 PostgreSQL bağlantısı kuruluyor...');
    
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: console.log,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      retry: {
        max: 5
      }
    });
    
    console.log('✅ Sequelize instance oluşturuldu');
  } catch (error) {
    console.error('❌ Sequelize connection error:', error.message);
  }
} else {
  console.log('⚠️ DATABASE_URL bulunamadı. Test modunda çalışılacak.');
}

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

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token gereklidir' });
  }

  // Test token kontrolü (geliştirme için)
  if (token === 'test-jwt-token-backend' || token === 'jwt-test-token-backend') {
    req.user = { 
      id: 'test_admin_1', 
      email: 'admin@osmangazigoz.com', 
      role: 'admin',
      name: 'Test Admin'
    };
    return next();
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

// ============ DATABASE MODELS ============

let User, Material, Patient, Category, Supplier, Invoice, Doctor, StockMovement;

if (sequelize) {
  // Users Tablosu
  User = sequelize.define('User', {
    id: { 
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    username: { 
      type: DataTypes.STRING(100), 
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 100]
      }
    },
    email: { 
      type: DataTypes.STRING(255), 
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: { 
      type: DataTypes.STRING(255), 
      allowNull: false 
    },
    phone: { 
      type: DataTypes.STRING(20),
      validate: {
        len: [10, 20]
      }
    },
    department: { 
      type: DataTypes.STRING(100) 
    },
    role: { 
      type: DataTypes.ENUM('admin', 'manager', 'staff', 'user'), 
      defaultValue: 'user'
    },
    permissions: { 
      type: DataTypes.JSONB, 
      defaultValue: {} 
    },
    name: { 
      type: DataTypes.STRING(100), 
      allowNull: false 
    },
    avatarColor: { 
      type: DataTypes.STRING(7), 
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
      type: DataTypes.STRING(45) 
    }
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

  // Categories Tablosu
  Category = sequelize.define('Category', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT
    },
    color: {
      type: DataTypes.STRING(7),
      defaultValue: '#6B7280'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    parentId: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'categories',
    timestamps: true
  });

  // Suppliers Tablosu
  Supplier = sequelize.define('Supplier', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(50),
      unique: true
    },
    taxNumber: {
      type: DataTypes.STRING(50)
    },
    taxOffice: {
      type: DataTypes.STRING(100)
    },
    address: {
      type: DataTypes.TEXT
    },
    phone: {
      type: DataTypes.STRING(20)
    },
    email: {
      type: DataTypes.STRING(100),
      validate: {
        isEmail: true
      }
    },
    contactPerson: {
      type: DataTypes.STRING(100)
    },
    website: {
      type: DataTypes.STRING(200)
    },
    paymentTerm: {
      type: DataTypes.INTEGER,
      defaultValue: 30
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'suppliers',
    timestamps: true
  });

  // Materials Tablosu
  Material = sequelize.define('Material', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(50),
      unique: true
    },
    barcode: {
      type: DataTypes.STRING(100)
    },
    gtin: {
      type: DataTypes.STRING(50)
    },
    serialNumber: {
      type: DataTypes.STRING(100)
    },
    udiCode: {
      type: DataTypes.STRING(100)
    },
    intuitiveCode: {
      type: DataTypes.STRING(100)
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    supplierId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    unit: {
      type: DataTypes.STRING(20),
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
      defaultValue: 10
    },
    maxStock: {
      type: DataTypes.INTEGER,
      defaultValue: 1000
    },
    expirationDate: {
      type: DataTypes.DATE
    },
    batchNumber: {
      type: DataTypes.STRING(50)
    },
    location: {
      type: DataTypes.STRING(100)
    },
    description: {
      type: DataTypes.TEXT
    },
    status: {
      type: DataTypes.ENUM('normal', 'kritik', 'tükenmiş', 'fazla'),
      defaultValue: 'normal'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'materials',
    timestamps: true
  });

  // Patients Tablosu
  Patient = sequelize.define('Patient', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    patientNumber: {
      type: DataTypes.STRING(50),
      unique: true
    },
    tcKimlikNo: {
      type: DataTypes.STRING(11)
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    surname: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    birthDate: {
      type: DataTypes.DATE
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      defaultValue: 'other'
    },
    phone: {
      type: DataTypes.STRING(20)
    },
    email: {
      type: DataTypes.STRING(100)
    },
    address: {
      type: DataTypes.TEXT
    },
    bloodGroup: {
      type: DataTypes.STRING(5)
    },
    allergies: {
      type: DataTypes.TEXT
    },
    chronicDiseases: {
      type: DataTypes.TEXT
    },
    emergencyContact: {
      type: DataTypes.STRING(100)
    },
    emergencyPhone: {
      type: DataTypes.STRING(20)
    },
    insuranceType: {
      type: DataTypes.STRING(50)
    },
    insuranceNumber: {
      type: DataTypes.STRING(50)
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'patients',
    timestamps: true
  });

  // Doctors Tablosu
  Doctor = sequelize.define('Doctor', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    doctorNumber: {
      type: DataTypes.STRING(50),
      unique: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    surname: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    specialty: {
      type: DataTypes.STRING(100)
    },
    title: {
      type: DataTypes.STRING(50)
    },
    phone: {
      type: DataTypes.STRING(20)
    },
    email: {
      type: DataTypes.STRING(100)
    },
    licenseNumber: {
      type: DataTypes.STRING(50)
    },
    department: {
      type: DataTypes.STRING(100)
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'doctors',
    timestamps: true
  });

  // Invoices Tablosu
  Invoice = sequelize.define('Invoice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    invoiceNumber: {
      type: DataTypes.STRING(50),
      unique: true
    },
    patientId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    doctorId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    invoiceDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    dueDate: {
      type: DataTypes.DATE
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    taxAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    finalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'partial', 'paid', 'cancelled'),
      defaultValue: 'pending'
    },
    paymentMethod: {
      type: DataTypes.ENUM('cash', 'credit_card', 'bank_transfer', 'insurance', 'other'),
      defaultValue: 'cash'
    },
    notes: {
      type: DataTypes.TEXT
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'invoices',
    timestamps: true
  });

  // StockMovements Tablosu
  StockMovement = sequelize.define('StockMovement', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    materialId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    movementType: {
      type: DataTypes.ENUM('in', 'out', 'transfer', 'adjustment', 'return'),
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2)
    },
    totalPrice: {
      type: DataTypes.DECIMAL(10, 2)
    },
    sourceLocation: {
      type: DataTypes.STRING(100)
    },
    targetLocation: {
      type: DataTypes.STRING(100)
    },
    referenceType: {
      type: DataTypes.STRING(50)
    },
    referenceId: {
      type: DataTypes.UUID
    },
    notes: {
      type: DataTypes.TEXT
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    movementDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'stock_movements',
    timestamps: true,
    indexes: [
      {
        fields: ['materialId']
      },
      {
        fields: ['movementDate']
      },
      {
        fields: ['referenceType', 'referenceId']
      }
    ]
  });

  // İlişkileri tanımla
  Category.hasMany(Material, { foreignKey: 'categoryId' });
  Material.belongsTo(Category, { foreignKey: 'categoryId' });

  Supplier.hasMany(Material, { foreignKey: 'supplierId' });
  Material.belongsTo(Supplier, { foreignKey: 'supplierId' });

  Patient.hasMany(Invoice, { foreignKey: 'patientId' });
  Invoice.belongsTo(Patient, { foreignKey: 'patientId' });

  Doctor.hasMany(Invoice, { foreignKey: 'doctorId' });
  Invoice.belongsTo(Doctor, { foreignKey: 'doctorId' });

  Material.hasMany(StockMovement, { foreignKey: 'materialId' });
  StockMovement.belongsTo(Material, { foreignKey: 'materialId' });

  User.hasMany(StockMovement, { foreignKey: 'userId' });
  StockMovement.belongsTo(User, { foreignKey: 'userId' });
}

// Database Initialization
const initDatabase = async () => {
  if (!sequelize) {
    console.log('⚠️ PostgreSQL bağlantısı yok, test modunda çalışılıyor');
    return;
  }

  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL veritabanına başarıyla bağlandı.');
    isDatabaseConnected = true;

    // Tabloları oluştur
    await sequelize.sync({ alter: true });
    console.log('✅ Database tabloları senkronize edildi.');

    // Admin kullanıcısını oluştur (eğer yoksa)
    try {
      const adminCount = await User.count({ where: { email: 'admin@osmangazigoz.com' } });
      if (adminCount === 0) {
        const adminUser = await User.create({
          username: 'admin',
          email: 'admin@osmangazigoz.com',
          password: 'admin123',
          name: 'Sistem Yöneticisi',
          role: 'admin',
          department: 'Yönetim',
          phone: '',
          permissions: {
            createSession: true, approveCounts: true, manageMaterials: true,
            managePatients: true, manageInvoices: true, bulkStatusChange: true,
            quickCount: true, exportData: true, manageUsers: true,
            manageSettings: true, viewDashboard: true, importExcel: true,
            manageDailyPlan: true, viewReports: true, manageDoctors: true,
            manageCategories: true, manageSuppliers: true
          }
        });
        console.log('✅ Admin kullanıcısı oluşturuldu:', adminUser.email);
      }
    } catch (userError) {
      console.log('⚠️ Admin kullanıcısı oluşturulamadı:', userError.message);
    }

  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    console.log('⚠️ PostgreSQL bağlantı hatası, test modunda devam ediliyor');
  }
};

// ============ API ROUTES ============

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    let databaseStatus = 'Disconnected';
    if (sequelize) {
      try {
        await sequelize.authenticate();
        databaseStatus = 'Connected';
      } catch (dbError) {
        databaseStatus = 'Error: ' + dbError.message;
      }
    }

    res.json({
      status: 'OK',
      database: databaseStatus,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '2.0.0',
      mode: sequelize ? 'PostgreSQL' : 'Test Mode'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      database: 'Check failed',
      error: error.message
    });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  console.log('🔍 LOGIN attempt for:', req.body.email);
  
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve şifre gereklidir' });
    }

    // Test login (geliştirme için)
    if (email === 'admin@osmangazigoz.com' && password === 'admin123') {
      console.log('✅ Test login kullanılıyor');
      
      const token = jwt.sign(
        {
          id: 'admin_1',
          email: email,
          name: 'Sistem Yöneticisi',
          role: 'admin',
          permissions: {}
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      return res.json({
        success: true,
        token: token,
        user: {
          id: 'admin_1',
          email: email,
          username: 'admin',
          name: 'Sistem Yöneticisi',
          role: 'admin',
          department: 'Yönetim',
          avatarColor: '#4F46E5',
          phone: '',
          permissions: {
            createSession: true, approveCounts: true, manageMaterials: true,
            managePatients: true, manageInvoices: true, bulkStatusChange: true,
            quickCount: true, exportData: true, manageUsers: true,
            manageSettings: true, viewDashboard: true, importExcel: true,
            manageDailyPlan: true, viewReports: true, manageDoctors: true,
            manageCategories: true, manageSuppliers: true
          }
        }
      });
    }

    // PostgreSQL login
    if (!sequelize || !isDatabaseConnected) {
      return res.status(503).json({ 
        error: 'Database bağlantısı yok',
        suggestion: 'admin@osmangazigoz.com / admin123 ile test login kullanın' 
      });
    }

    const user = await User.findOne({
      where: { 
        email: email.toLowerCase().trim(),
        isActive: true 
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    
    if (!passwordValid) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Create token
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

    console.log('✅ PostgreSQL login başarılı:', email);
    
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
    console.error('🔥 LOGIN ERROR:', error.message);
    res.status(500).json({ 
      error: 'Sunucu hatası',
      details: error.message 
    });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    // Test user için
    if (req.user.id === 'test_admin_1' || req.user.id === 'admin_1') {
      return res.json({
        success: true,
        user: {
          id: 'admin_1',
          email: 'admin@osmangazigoz.com',
          username: 'admin',
          name: 'Sistem Yöneticisi',
          role: 'admin',
          department: 'Yönetim',
          avatarColor: '#4F46E5',
          phone: '',
          permissions: {
            createSession: true, approveCounts: true, manageMaterials: true,
            managePatients: true, manageInvoices: true, bulkStatusChange: true,
            quickCount: true, exportData: true, manageUsers: true,
            manageSettings: true, viewDashboard: true, importExcel: true,
            manageDailyPlan: true, viewReports: true, manageDoctors: true,
            manageCategories: true, manageSuppliers: true
          }
        }
      });
    }

    // PostgreSQL'den al
    if (!sequelize) {
      return res.status(503).json({ error: 'Database bağlantısı yok' });
    }

    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
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

// ============ USER MANAGEMENT ============

// Get all users
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (!sequelize || !isDatabaseConnected) {
      // Test verisi
      return res.json([
        {
          id: 'admin_1',
          email: 'admin@osmangazigoz.com',
          username: 'admin',
          name: 'Sistem Yöneticisi',
          phone: '',
          department: 'Yönetim',
          role: 'admin',
          isActive: true,
          avatarColor: '#4F46E5',
          lastLogin: new Date().toISOString(),
          permissions: {
            createSession: true, approveCounts: true, manageMaterials: true,
            managePatients: true, manageInvoices: true, bulkStatusChange: true,
            quickCount: true, exportData: true, manageUsers: true,
            manageSettings: true, viewDashboard: true, importExcel: true,
            manageDailyPlan: true, viewReports: true, manageDoctors: true,
            manageCategories: true, manageSuppliers: true
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]);
    }

    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Kullanıcılar yüklenemedi' });
  }
});

// Create user
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const userData = req.body;

    if (!sequelize || !isDatabaseConnected) {
      return res.status(503).json({ error: 'Database bağlantısı yok' });
    }

    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: userData.email },
          { username: userData.username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email veya kullanıcı adı zaten kullanımda' });
    }

    const user = await User.create(userData);

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
        isActive: user.isActive,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Kullanıcı oluşturulamadı' });
  }
});

// Update user
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userData = req.body;

    if (!sequelize || !isDatabaseConnected) {
      return res.status(503).json({ error: 'Database bağlantısı yok' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    await user.update(userData);

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
        isActive: user.isActive,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Kullanıcı güncellenemedi' });
  }
});

// Delete user
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!sequelize || !isDatabaseConnected) {
      return res.status(503).json({ error: 'Database bağlantısı yok' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    // Admin kullanıcısını silme
    if (user.email === 'admin@osmangazigoz.com') {
      return res.status(400).json({ error: 'Admin kullanıcısı silinemez' });
    }

    await user.destroy();

    res.json({ success: true, message: 'Kullanıcı silindi' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Kullanıcı silinemedi' });
  }
});

// ============ MATERIAL MANAGEMENT ============

// Get all materials with pagination
app.get('/api/materials', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', categoryId } = req.query;
    const offset = (page - 1) * limit;

    if (!sequelize || !isDatabaseConnected) {
      // Test verisi
      const testMaterials = [
        {
          id: 'test_1',
          name: 'Parol Tablet',
          code: 'MED001',
          barcode: '8691234567890',
          categoryId: 'cat_1',
          supplierId: null,
          unit: 'kutu',
          unitPrice: 25.50,
          currentStock: 150,
          minStock: 50,
          maxStock: 500,
          expirationDate: '2025-12-31',
          batchNumber: 'BATCH001',
          location: 'Depo A',
          description: 'Ağrı kesici tablet',
          status: 'normal',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      return res.json({
        success: true,
        data: testMaterials,
        pagination: {
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1
        }
      });
    }

    const where = {
      isActive: true
    };

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const { count, rows } = await Material.findAndCountAll({
      where,
      include: [
        { model: Category, attributes: ['id', 'name', 'color'] },
        { model: Supplier, attributes: ['id', 'name'] }
      ],
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({ error: 'Malzemeler yüklenemedi' });
  }
});

// Get single material
app.get('/api/materials/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!sequelize || !isDatabaseConnected) {
      // Test verisi
      return res.json({
        id: 'test_1',
        name: 'Parol Tablet',
        code: 'MED001',
        barcode: '8691234567890',
        categoryId: 'cat_1',
        supplierId: null,
        unit: 'kutu',
        unitPrice: 25.50,
        currentStock: 150,
        minStock: 50,
        maxStock: 500,
        expirationDate: '2025-12-31',
        batchNumber: 'BATCH001',
        location: 'Depo A',
        description: 'Ağrı kesici tablet',
        status: 'normal',
        isActive: true
      });
    }

    const material = await Material.findByPk(id, {
      include: [
        { model: Category, attributes: ['id', 'name', 'color'] },
        { model: Supplier, attributes: ['id', 'name'] }
      ]
    });

    if (!material) {
      return res.status(404).json({ error: 'Malzeme bulunamadı' });
    }

    res.json(material);
  } catch (error) {
    console.error('Get material error:', error);
    res.status(500).json({ error: 'Malzeme yüklenemedi' });
  }
});

// Create material
app.post('/api/materials', authenticateToken, async (req, res) => {
  try {
    const materialData = req.body;

    if (!sequelize || !isDatabaseConnected) {
      return res.status(503).json({ error: 'Database bağlantısı yok' });
    }

    // Check if code exists
    if (materialData.code) {
      const existing = await Material.findOne({ where: { code: materialData.code } });
      if (existing) {
        return res.status(400).json({ error: 'Bu kod zaten kullanılıyor' });
      }
    }

    const material = await Material.create(materialData);

    res.json({
      success: true,
      material: material
    });
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({ error: 'Malzeme oluşturulamadı' });
  }
});

// Update material
app.put('/api/materials/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const materialData = req.body;

    if (!sequelize || !isDatabaseConnected) {
      return res.status(503).json({ error: 'Database bağlantısı yok' });
    }

    const material = await Material.findByPk(id);
    if (!material) {
      return res.status(404).json({ error: 'Malzeme bulunamadı' });
    }

    // Check if code is being changed and exists
    if (materialData.code && materialData.code !== material.code) {
      const existing = await Material.findOne({ where: { code: materialData.code } });
      if (existing) {
        return res.status(400).json({ error: 'Bu kod zaten kullanılıyor' });
      }
    }

    await material.update(materialData);

    res.json({
      success: true,
      material: material
    });
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ error: 'Malzeme güncellenemedi' });
  }
});

// Delete material
app.delete('/api/materials/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!sequelize || !isDatabaseConnected) {
      return res.status(503).json({ error: 'Database bağlantısı yok' });
    }

    const material = await Material.findByPk(id);
    if (!material) {
      return res.status(404).json({ error: 'Malzeme bulunamadı' });
    }

    await material.update({ isActive: false });

    res.json({ success: true, message: 'Malzeme silindi' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Malzeme silinemedi' });
  }
});

// Update stock
app.post('/api/materials/:id/stock', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, movementType, notes } = req.body;

    if (!sequelize || !isDatabaseConnected) {
      return res.status(503).json({ error: 'Database bağlantısı yok' });
    }

    const material = await Material.findByPk(id);
    if (!material) {
      return res.status(404).json({ error: 'Malzeme bulunamadı' });
    }

    // Calculate new stock
    let newStock = material.currentStock;
    if (movementType === 'in') {
      newStock += quantity;
    } else if (movementType === 'out') {
      newStock -= quantity;
    }

    if (newStock < 0) {
      return res.status(400).json({ error: 'Yetersiz stok' });
    }

    // Update material stock
    await material.update({ currentStock: newStock });

    // Create stock movement record
    await StockMovement.create({
      materialId: id,
      movementType,
      quantity,
      unitPrice: material.unitPrice,
      totalPrice: quantity * material.unitPrice,
      notes,
      userId: req.user.id
    });

    res.json({
      success: true,
      material: {
        id: material.id,
        name: material.name,
        currentStock: newStock,
        status: newStock <= material.minStock ? 'kritik' : 
                newStock >= material.maxStock ? 'fazla' : 'normal'
      }
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ error: 'Stok güncellenemedi' });
  }
});

// ============ CATEGORY MANAGEMENT ============

// Get all categories
app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    if (!sequelize || !isDatabaseConnected) {
      // Test verisi
      return res.json({
        success: true,
        data: [
          { id: 'cat_1', name: 'İlaç', description: 'İlaç kategorisi', color: '#3B82F6', isActive: true },
          { id: 'cat_2', name: 'Tıbbi Malzeme', description: 'Tıbbi malzeme kategorisi', color: '#10B981', isActive: true },
          { id: 'cat_3', name: 'Laboratuvar', description: 'Laboratuvar malzemeleri', color: '#F59E0B', isActive: true }
        ]
      });
    }

    const categories = await Category.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Kategoriler yüklenemedi' });
  }
});

// Create category
app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    const categoryData = req.body;

    if (!sequelize || !isDatabaseConnected) {
      return res.status(503).json({ error: 'Database bağlantısı yok' });
    }

    const category = await Category.create(categoryData);
    res.json({ success: true, data: category });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Kategori oluşturulamadı' });
  }
});

// ============ SUPPLIER MANAGEMENT ============

// Get all suppliers
app.get('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    if (!sequelize || !isDatabaseConnected) {
      // Test verisi
      return res.json({
        success: true,
        data: [
          { id: 'sup_1', name: 'Abdi İbrahim', code: 'ABDI01', taxNumber: '1234567890', isActive: true },
          { id: 'sup_2', name: 'Roche', code: 'ROCHE01', taxNumber: '0987654321', isActive: true }
        ]
      });
    }

    const suppliers = await Supplier.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });

    res.json({ success: true, data: suppliers });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Tedarikçiler yüklenemedi' });
  }
});

// ============ PATIENT MANAGEMENT ============

// Get all patients
app.get('/api/patients', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;

    if (!sequelize || !isDatabaseConnected) {
      // Test verisi
      const testPatients = [
        {
          id: 'pat_1',
          patientNumber: 'PAT001',
          tcKimlikNo: '12345678901',
          name: 'Ahmet',
          surname: 'Yılmaz',
          birthDate: '1980-01-15',
          gender: 'male',
          phone: '05551234567',
          isActive: true
        }
      ];
      return res.json({
        success: true,
        data: testPatients,
        pagination: {
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1
        }
      });
    }

    const where = {
      isActive: true
    };

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { surname: { [Op.iLike]: `%${search}%` } },
        { patientNumber: { [Op.iLike]: `%${search}%` } },
        { tcKimlikNo: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Patient.findAndCountAll({
      where,
      order: [['surname', 'ASC'], ['name', 'ASC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Hastalar yüklenemedi' });
  }
});

// ============ DASHBOARD STATS ============

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    if (!sequelize || !isDatabaseConnected) {
      // Test verisi
      return res.json({
        success: true,
        data: {
          totalMaterials: 125,
          totalStockValue: 15250.75,
          criticalStockCount: 8,
          totalPatients: 42,
          totalInvoices: 18,
          totalInvoiceAmount: 12500.50,
          activeSessions: 1,
          statusSummary: {
            normal: 85,
            kritik: 25,
            tükenmiş: 10,
            fazla: 5
          },
          todayMaterials: 3,
          todayPatients: 2,
          totalUsers: 5,
          totalCategories: 8,
          totalSuppliers: 12
        }
      });
    }

    const [
      totalMaterials,
      criticalStockCount,
      totalPatients,
      totalInvoices,
      totalUsers,
      totalCategories,
      totalSuppliers
    ] = await Promise.all([
      Material.count({ where: { isActive: true } }),
      Material.count({ where: { status: 'kritik', isActive: true } }),
      Patient.count({ where: { isActive: true } }),
      Invoice.count({ where: { isActive: true } }),
      User.count({ where: { isActive: true } }),
      Category.count({ where: { isActive: true } }),
      Supplier.count({ where: { isActive: true } })
    ]);

    // Calculate total stock value
    const materials = await Material.findAll({
      where: { isActive: true },
      attributes: ['currentStock', 'unitPrice']
    });

    const totalStockValue = materials.reduce((sum, material) => {
      return sum + (material.currentStock * material.unitPrice);
    }, 0);

    // Get status summary
    const statusSummary = await Material.findAll({
      where: { isActive: true },
      attributes: ['status', [Sequelize.fn('COUNT', Sequelize.col('status')), 'count']],
      group: ['status']
    });

    const statusObj = {};
    statusSummary.forEach(item => {
      statusObj[item.status] = parseInt(item.dataValues.count);
    });

    // Get today's counts
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayMaterials = await Material.count({
      where: {
        isActive: true,
        createdAt: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        }
      }
    });

    const todayPatients = await Patient.count({
      where: {
        isActive: true,
        createdAt: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        }
      }
    });

    res.json({
      success: true,
      data: {
        totalMaterials,
        totalStockValue,
        criticalStockCount,
        totalPatients,
        totalInvoices,
        totalInvoiceAmount: 12500.50, // Bu veriyi Invoice tablosundan hesaplayabilirsiniz
        activeSessions: 1,
        statusSummary: statusObj,
        todayMaterials,
        todayPatients,
        totalUsers,
        totalCategories,
        totalSuppliers
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Dashboard verileri yüklenemedi' });
  }
});

// ============ FILE UPLOAD ============

// Import materials from Excel
app.post('/api/materials/import', authenticateToken, async (req, res) => {
  try {
    const materials = req.body;

    if (!Array.isArray(materials)) {
      return res.status(400).json({ error: 'Geçersiz veri formatı' });
    }

    if (!sequelize || !isDatabaseConnected) {
      return res.status(503).json({ error: 'Database bağlantısı yok' });
    }

    const createdMaterials = [];
    const errors = [];

    for (const materialData of materials) {
      try {
        const material = await Material.create(materialData);
        createdMaterials.push(material);
      } catch (error) {
        errors.push({
          material: materialData.name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `${createdMaterials.length} malzeme başarıyla içe aktarıldı`,
      createdCount: createdMaterials.length,
      errorCount: errors.length,
      errors: errors
    });
  } catch (error) {
    console.error('Import materials error:', error);
    res.status(500).json({ error: 'İçe aktarma başarısız' });
  }
});

// ============ BACKUP & RESTORE ============

// Export all data
app.get('/api/backup/export', authenticateToken, async (req, res) => {
  try {
    if (!sequelize || !isDatabaseConnected) {
      return res.status(503).json({ error: 'Database bağlantısı yok' });
    }

    const [
      users,
      materials,
      categories,
      suppliers,
      patients,
      doctors,
      invoices,
      stockMovements
    ] = await Promise.all([
      User.findAll(),
      Material.findAll(),
      Category.findAll(),
      Supplier.findAll(),
      Patient.findAll(),
      Doctor.findAll(),
      Invoice.findAll(),
      StockMovement.findAll()
    ]);

    const backupData = {
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      data: {
        users,
        materials,
        categories,
        suppliers,
        patients,
        doctors,
        invoices,
        stockMovements
      }
    };

    res.json(backupData);
  } catch (error) {
    console.error('Export backup error:', error);
    res.status(500).json({ error: 'Yedekleme başarısız' });
  }
});

// ============ STATIC FILES AND CATCH-ALL ============

// Static files
app.use(express.static(path.join(__dirname, '../dist')));

// React Router fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ============ START SERVER ============

const startServer = async () => {
  console.log('🚀 Starting server...');
  console.log(`📦 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌍 PORT: ${PORT}`);
  
  await initDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('=========================================');
    console.log('🚀 HOSPITAL STOCK MANAGEMENT API v2.0');
    console.log('=========================================');
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 Server URL: http://localhost:${PORT}`);
    console.log(`📍 Database: ${isDatabaseConnected ? 'PostgreSQL (Connected)' : 'TEST MODE'}`);
    console.log('=========================================');
    console.log('👤 TEST LOGIN:');
    console.log(`   Email: admin@osmangazigoz.com`);
    console.log(`   Password: admin123`);
    console.log('=========================================');
    console.log('📊 API ENDPOINTS:');
    console.log(`   GET    /api/health`);
    console.log(`   POST   /api/auth/login`);
    console.log(`   GET    /api/auth/me`);
    console.log(`   GET    /api/materials`);
    console.log(`   GET    /api/categories`);
    console.log(`   GET    /api/suppliers`);
    console.log(`   GET    /api/patients`);
    console.log(`   GET    /api/dashboard/stats`);
    console.log(`   GET    /api/users`);
    console.log(`   POST   /api/materials/import`);
    console.log(`   GET    /api/backup/export`);
    console.log('=========================================');
    console.log('✅ Ready!');
    console.log('=========================================');
  });
};

startServer().catch(console.error);