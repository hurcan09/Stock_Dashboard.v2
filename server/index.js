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
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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

// JWT Authentication Middleware - GELİŞTİRİLMİŞ
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
  name: { type: DataTypes.STRING, allowNull: false },
  department: { type: DataTypes.STRING },
  role: { type: DataTypes.STRING, defaultValue: 'user' },
  avatarColor: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastLogin: { type: DataTypes.DATE },
  lastLoginIp: { type: DataTypes.STRING },
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

// Initialize Database - DÜZELTİLMİŞ ve DEBUG EKLENDİ
const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL veritabanına bağlandı.');
    
    // Tabloları oluştur (force: false - var olan tabloları silmez)
    await sequelize.sync({ alter: true });
    console.log('✅ Database tabloları senkronize edildi.');
    
    // DEBUG: Tüm kullanıcıları göster
    const [allUsers] = await sequelize.query('SELECT id, email, password FROM users');
    console.log('👥 DEBUG: Mevcut kullanıcılar:', allUsers);
    
    // Create default admin user - DEBUG EKLENDİ
    try {
      console.log('🔍 DEBUG: Admin user kontrolü başlıyor...');
      const adminUser = await User.findOne({ 
        where: { email: 'hurcanalkan@osmangazigoz.com' } 
      });
      
      if (!adminUser) {
        console.log('🔍 DEBUG: Admin user bulunamadı, oluşturuluyor...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await User.create({
          email: 'hurcanalkan@osmangazigoz.com',
          username: 'admin',
          password: hashedPassword,
          name: 'Hürcan Alkan',
          department: 'Yönetim',
          role: 'admin',
          avatarColor: '#4F46E5',
          permissions: {
            createSession: true, approveCounts: true, manageMaterials: true,
            managePatients: true, manageInvoices: true, bulkStatusChange: true,
            quickCount: true, exportData: true, manageUsers: true,
            manageSettings: true, viewDashboard: true, importExcel: true,
            manageDailyPlan: true, viewReports: true
          },
          isActive: true
        });
        console.log('✅ Default admin user created. Password: admin123');
      } else {
        console.log('✅ Admin user already exists.');
        console.log('🔍 DEBUG: Admin password hash:', adminUser.password.substring(0, 30) + '...');
        
        // Admin şifresini güncelle (eğer yanlış şifreyle oluştuysa)
        if (adminUser.password === '123456' || adminUser.password.length < 20) {
          console.log('🔍 DEBUG: Admin password needs update');
          const hashedPassword = await bcrypt.hash('admin123', 10);
          await adminUser.update({ password: hashedPassword });
          console.log('✅ Admin password updated to: admin123');
        }
      }
    } catch (userError) {
      console.error('❌ Admin user creation error:', userError.message);
      
      // Alternatif admin oluştur
      try {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await User.create({
          email: 'admin@hospital.com',
          username: 'sysadmin',
          password: hashedPassword,
          name: 'System Administrator',
          department: 'IT',
          role: 'admin',
          avatarColor: '#4F46E5',
          permissions: {
            createSession: true, approveCounts: true, manageMaterials: true,
            managePatients: true, manageInvoices: true, bulkStatusChange: true,
            quickCount: true, exportData: true, manageUsers: true,
            manageSettings: true, viewDashboard: true, importExcel: true,
            manageDailyPlan: true, viewReports: true
          },
          isActive: true
        });
        console.log('✅ Alternative admin created: admin@hospital.com / admin123');
      } catch (altError) {
        console.error('❌ Alternative admin creation also failed:', altError.message);
      }
    }
    
    // DEBUG USER - Plain text password ile
    try {
      const [debugUser] = await sequelize.query(
        'SELECT id FROM users WHERE email = $1',
        { replacements: ['debug@hospital.com'] }
      );
      
      if (debugUser.length === 0) {
        await sequelize.query(
          `INSERT INTO users (email, username, password, name, department, role, permissions, "isActive") 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          {
            replacements: [
              'debug@hospital.com',
              'debug',
              'debug123', // PLAIN TEXT!
              'Debug User',
              'IT',
              'admin',
              JSON.stringify({ all: true }),
              true
            ]
          }
        );
        console.log('✅ DEBUG user created: debug@hospital.com / debug123 (PLAIN TEXT)');
      }
    } catch (debugError) {
      console.log('⚠️  Debug user error:', debugError.message);
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

// Login - DEBUG MODU EKLENDİ
app.post('/api/auth/login', async (req, res) => {
  console.log('🔍 LOGIN DEBUG === START ===');
  console.log('📧 Email:', req.body.email);
  console.log('🔑 Password:', req.body.password);
  
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ error: 'Email ve şifre gereklidir' });
    }
    
    // DEBUG: Direkt SQL query
    console.log('🔍 Database query for:', email);
    const [users] = await sequelize.query(
      'SELECT * FROM users WHERE email = $1 AND "isActive" = true',
      { replacements: [email] }
    );
    
    console.log('🔍 Users found:', users.length);
    
    if (users.length === 0) {
      console.log('❌ No user found with email:', email);
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }
    
    const user = users[0];
    console.log('👤 User found:', user.email);
    console.log('🗝️  Stored password (first 30):', user.password.substring(0, 30));
    console.log('🔢 Password length:', user.password.length);
    
    // ÇOKLU ŞİFRE KONTROLÜ
    let passwordValid = false;
    
    // 1. Bcrypt kontrol
    try {
      console.log('🔄 Trying bcrypt compare...');
      passwordValid = await bcrypt.compare(password, user.password);
      console.log('🔍 Bcrypt result:', passwordValid);
    } catch (bcryptError) {
      console.log('⚠️  Bcrypt error:', bcryptError.message);
    }
    
    // 2. Plain text kontrol (acil durum)
    if (!passwordValid) {
      console.log('🔄 Trying plain text compare...');
      if (user.password === password) {
        console.log('✅ PLAIN TEXT PASSWORD MATCH!');
        passwordValid = true;
        
        // Plain text şifreyi hash'le
        const hashedPassword = await bcrypt.hash(password, 10);
        await sequelize.query(
          'UPDATE users SET password = $1 WHERE id = $2',
          { replacements: [hashedPassword, user.id] }
        );
        console.log('🔧 Password hashed and updated in database');
      }
    }
    
    // 3. Özel durum: "123456" -> "admin123"
    if (!passwordValid && user.password === '123456' && password === 'admin123') {
      console.log('✅ Special case: 123456 -> admin123');
      passwordValid = true;
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await sequelize.query(
        'UPDATE users SET password = $1 WHERE id = $2',
        { replacements: [hashedPassword, user.id] }
      );
    }
    
    if (!passwordValid) {
      console.log('❌ All password checks failed');
      console.log('🔍 LOGIN DEBUG === END WITH FAILURE ===');
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }
    
    console.log('✅ Password validation successful');
    
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
    await sequelize.query(
      'UPDATE users SET "lastLogin" = CURRENT_TIMESTAMP WHERE id = $1',
      { replacements: [user.id] }
    );
    
    console.log('✅ Token created successfully');
    console.log('🔍 LOGIN DEBUG === END WITH SUCCESS ===');
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
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
    console.log('🔍 LOGIN DEBUG === END WITH ERROR ===');
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Emergency login endpoint (şifre sıfırlama için)
app.post('/api/auth/emergency-login', async (req, res) => {
  console.log('🚨 EMERGENCY LOGIN CALLED');
  
  try {
    const { email } = req.body;
    
    console.log('🔍 Emergency login for:', email);
    
    const [users] = await sequelize.query(
      'SELECT * FROM users WHERE email = $1',
      { replacements: [email] }
    );
    
    if (users.length === 0) {
      console.log('❌ User not found for emergency login');
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    const user = users[0];
    console.log('👤 Emergency user found:', user.email);
    
    // Yeni token oluştur
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions || {}
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    console.log('✅ Emergency token created');
    
    res.json({
      success: true,
      token,
      message: 'Emergency login successful'
    });
  } catch (error) {
    console.error('Emergency login error:', error);
    res.status(500).json({ error: 'Server error' });
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

    res.json({
      success: true,
      data: {
        totalMaterials,
        totalStockValue,
        criticalStockCount,
        totalPatients,
        totalInvoices: 0,
        totalInvoiceAmount: 0,
        todayUsageCost: 0,
        todayUsagesCount: 0
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get user info
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'username', 'name', 'department', 'role', 'avatarColor', 'phone']
    });

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    res.json({
      success: true,
      user: {
        ...user.toJSON(),
        permissions: req.user.permissions || {}
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Static files
app.use(express.static(path.join(__dirname, '../dist')));

// React Router fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Start server
const startServer = async () => {
  console.log('🚀 Starting server...');
  console.log(`📦 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🗄️  Database URL: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
  
  await initDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('=========================================');
    console.log('🚀 HOSPITAL STOCK MANAGEMENT API');
    console.log('=========================================');
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 URL: https://stock-dashboard-p5ip.onrender.com`);
    console.log(`📍 Database: PostgreSQL (Neon.tech)`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    console.log('=========================================');
    console.log('👤 TEST LOGINS:');
    console.log(`   1. Email: hurcanalkan@osmangazigoz.com`);
    console.log(`      Password: admin123 (or 123456 if plain text)`);
    console.log(`   2. Email: debug@hospital.com`);
    console.log(`      Password: debug123 (PLAIN TEXT)`);
    console.log(`   3. Email: admin@hospital.com`);
    console.log(`      Password: admin123`);
    console.log('=========================================');
    console.log('🔍 DEBUG MODE: ACTIVE - Check Render Logs');
    console.log('=========================================');
  });
};

startServer().catch(console.error);