// src/utils/dataServiceSQL.ts
import { Pool } from 'pg';
import {
  Material, User, Patient, Invoice, StockCount, StockCountSession,
  Category, Supplier, PatientMaterialUsage, SystemLog,
  DailyPlan, Doctor, UserSession, ActivityLog,
  DashboardStats, MaterialStatus
} from '../types';

// Neon PostgreSQL bağlantısı - Render'daki env değişkeni
const pool = new Pool({
  connectionString: process.env.NEXT_PUBLIC_DATABASE_URL || 
                   'postgresql://username:password@ep-cool-cloud-123456.eu-central-1.aws.neon.tech/database',
  ssl: { rejectUnauthorized: false }
});

class DataServiceSQL {
  // ============ KULLANICI İŞLEMLERİ ============
  async getUsers(): Promise<User[]> {
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
      return this.mapUsersFromDB(result.rows);
    } catch (error) {
      console.error('Kullanıcıları getirme hatası:', error);
      return [];
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM users WHERE id = $1`,
        [id]
      );
      if (result.rows.length === 0) return null;
      return this.mapUserFromDB(result.rows[0]);
    } catch (error) {
      console.error('Kullanıcı getirme hatası:', error);
      return null;
    }
  }

  async saveUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    try {
      const result = await pool.query(`
        INSERT INTO users (
          username, email, password, full_name, phone, department, role,
          permissions, avatar_color, session_timeout, can_view_pages, can_edit_pages
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        userData.username,
        userData.email,
        userData.password,
        userData.name,
        userData.phone || '',
        userData.department,
        userData.role,
        JSON.stringify(userData.permissions),
        userData.avatarColor || '#4F46E5',
        userData.sessionTimeout || 30,
        JSON.stringify(userData.canViewPages || []),
        JSON.stringify(userData.canEditPages || [])
      ]);

      return this.mapUserFromDB(result.rows[0]);
    } catch (error) {
      console.error('Kullanıcı kaydetme hatası:', error);
      throw error;
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      // İzin verilen alanları güncelle
      const allowedFields = [
        'username', 'email', 'full_name', 'phone', 'department', 'role',
        'permissions', 'avatar_color', 'session_timeout', 'can_view_pages',
        'can_edit_pages', 'is_active', 'last_login', 'last_login_ip'
      ];

      Object.entries(updates).forEach(([key, value]) => {
        const dbField = this.mapToDbField(key);
        if (allowedFields.includes(dbField)) {
          setClauses.push(`${dbField} = $${paramCount}`);
          
          if (key === 'permissions' || key === 'canViewPages' || key === 'canEditPages') {
            values.push(JSON.stringify(value));
          } else if (key === 'name') {
            values.push(value); // full_name'e dönüştürülecek
          } else {
            values.push(value);
          }
          paramCount++;
        }
      });

      if (setClauses.length === 0) return null;

      setClauses.push('updated_at = NOW()');
      
      const query = `
        UPDATE users 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;
      values.push(id);

      const result = await pool.query(query, values);
      if (result.rows.length === 0) return null;
      
      return this.mapUserFromDB(result.rows[0]);
    } catch (error) {
      console.error('Kullanıcı güncelleme hatası:', error);
      return null;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const result = await pool.query(
        `DELETE FROM users WHERE id = $1 RETURNING id`,
        [id]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Kullanıcı silme hatası:', error);
      return false;
    }
  }

  // ============ MALZEME İŞLEMLERİ (TÜM KULLANICILAR AYNI VERİYİ GÖRÜR) ============
  async getMaterials(): Promise<Material[]> {
    try {
      const result = await pool.query(`
        SELECT id, name, barcode, gtin, sn, udi_code as "udiCode",
               all_barcode as "allBarcode", intuitive_code as "intuitiveCode",
               serial_number as "serialNumber", category, sub_category as "subCategory",
               unit, unit_price as "unitPrice", current_stock as "currentStock",
               min_stock_level as "minStockLevel", min_stock as "minStock",
               supplier, expiration_date as "expirationDate",
               serial_no_status as "serialNoStatus", material_description as "materialDescription",
               location, is_active as "isActive", status,
               last_stock_count_date as "lastStockCountDate",
               last_stock_count_by as "lastStockCountBy",
               last_stock_count_quantity as "lastStockCountQuantity",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM materials
        WHERE is_active = true
        ORDER BY name
      `);
      return this.mapMaterialsFromDB(result.rows);
    } catch (error) {
      console.error('Malzemeleri getirme hatası:', error);
      return [];
    }
  }

  async getMaterialById(id: string): Promise<Material | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM materials WHERE id = $1 AND is_active = true`,
        [id]
      );
      if (result.rows.length === 0) return null;
      return this.mapMaterialFromDB(result.rows[0]);
    } catch (error) {
      console.error('Malzeme getirme hatası:', error);
      return null;
    }
  }

  async saveMaterial(materialData: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>): Promise<Material> {
    try {
      const result = await pool.query(`
        INSERT INTO materials (
          name, barcode, gtin, sn, udi_code, all_barcode, intuitive_code,
          serial_number, category, sub_category, unit, unit_price,
          current_stock, min_stock_level, min_stock, supplier,
          expiration_date, serial_no_status, material_description,
          location, is_active, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                  $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *
      `, [
        materialData.name,
        materialData.barcode,
        materialData.gtin || '',
        materialData.sn || '',
        materialData.udiCode || '',
        materialData.allBarcode || '',
        materialData.intuitiveCode || '',
        materialData.serialNumber || '',
        materialData.category,
        materialData.subCategory || '',
        materialData.unit,
        materialData.unitPrice,
        materialData.currentStock,
        materialData.minStockLevel || materialData.minStock,
        materialData.minStock,
        materialData.supplier || '',
        materialData.expirationDate || null,
        materialData.serialNoStatus || '',
        materialData.materialDescription || materialData.name,
        materialData.location || '',
        true,
        materialData.status || 'normal'
      ]);

      return this.mapMaterialFromDB(result.rows[0]);
    } catch (error) {
      console.error('Malzeme kaydetme hatası:', error);
      throw error;
    }
  }

  async updateMaterial(id: string, updates: Partial<Material>): Promise<Material | null> {
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      Object.entries(updates).forEach(([key, value]) => {
        const dbField = this.mapToDbField(key);
        setClauses.push(`${dbField} = $${paramCount}`);
        values.push(value);
        paramCount++;
      });

      if (setClauses.length === 0) return null;

      setClauses.push('updated_at = NOW()');
      
      const query = `
        UPDATE materials 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;
      values.push(id);

      const result = await pool.query(query, values);
      if (result.rows.length === 0) return null;
      
      return this.mapMaterialFromDB(result.rows[0]);
    } catch (error) {
      console.error('Malzeme güncelleme hatası:', error);
      return null;
    }
  }

  async deleteMaterial(id: string): Promise<boolean> {
    try {
      // Soft delete yapıyoruz (is_active = false)
      const result = await pool.query(
        `UPDATE materials SET is_active = false WHERE id = $1 RETURNING id`,
        [id]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Malzeme silme hatası:', error);
      return false;
    }
  }

  // ============ DASHBOARD İSTATİSTİKLERİ ============
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Toplam malzeme sayısı
      const materialsResult = await pool.query(`SELECT COUNT(*) FROM materials WHERE is_active = true`);
      const totalMaterials = parseInt(materialsResult.rows[0].count);

      // Toplam hasta sayısı
      const patientsResult = await pool.query(`SELECT COUNT(*) FROM patients WHERE is_active = true`);
      const totalPatients = parseInt(patientsResult.rows[0].count);

      // Toplam stok değeri
      const stockValueResult = await pool.query(`
        SELECT SUM(current_stock * unit_price) as total_value 
        FROM materials 
        WHERE is_active = true
      `);
      const totalStockValue = parseFloat(stockValueResult.rows[0].total_value || 0);

      // Kritik stok sayısı
      const criticalStockResult = await pool.query(`
        SELECT COUNT(*) 
        FROM materials 
        WHERE is_active = true AND current_stock <= min_stock
      `);
      const criticalStockCount = parseInt(criticalStockResult.rows[0].count);

      // Son malzemeler
      const lowStockMaterialsResult = await pool.query(`
        SELECT * FROM materials 
        WHERE is_active = true AND current_stock <= min_stock
        LIMIT 5
      `);
      const lowStockMaterials = this.mapMaterialsFromDB(lowStockMaterialsResult.rows);

      return {
        totalMaterials,
        totalPatients,
        totalStockValue,
        criticalStockCount,
        totalUsageCost: 0, // TODO: Hasta malzeme kullanımından hesapla
        lowStockMaterials,
        recentActivities: [],
        topUsedMaterials: [],
        totalInvoices: 0,
        totalInvoiceAmount: 0,
        todayUsageCost: 0,
        weeklySales: 0,
        monthlySales: 0,
        todayUsagesCount: 0,
        activeSessions: 0,
        statusSummary: { normal: 0, konsinye: 0, iade: 0, faturalı: 0 },
        totalSessions: 0,
        recentSessions: [],
        quickCountSessions: 0,
        todayCounts: 0,
        pendingApprovals: 0
      };
    } catch (error) {
      console.error('Dashboard istatistikleri hatası:', error);
      return this.getEmptyDashboardStats();
    }
  }

  // ============ YARDIMCI METODLAR ============
  private mapToDbField(field: string): string {
    const mapping: Record<string, string> = {
      // Users
      'name': 'full_name',
      'isActive': 'is_active',
      'lastLogin': 'last_login',
      'lastLoginIp': 'last_login_ip',
      'avatarColor': 'avatar_color',
      'sessionTimeout': 'session_timeout',
      'canViewPages': 'can_view_pages',
      'canEditPages': 'can_edit_pages',
      'createdAt': 'created_at',
      'updatedAt': 'updated_at',
      
      // Materials
      'udiCode': 'udi_code',
      'allBarcode': 'all_barcode',
      'intuitiveCode': 'intuitive_code',
      'serialNumber': 'serial_number',
      'subCategory': 'sub_category',
      'unitPrice': 'unit_price',
      'currentStock': 'current_stock',
      'minStockLevel': 'min_stock_level',
      'minStock': 'min_stock',
      'expirationDate': 'expiration_date',
      'serialNoStatus': 'serial_no_status',
      'materialDescription': 'material_description',
      'isActive': 'is_active',
      'lastStockCountDate': 'last_stock_count_date',
      'lastStockCountBy': 'last_stock_count_by',
      'lastStockCountQuantity': 'last_stock_count_quantity'
    };
    
    return mapping[field] || field;
  }

  private mapUsersFromDB(dbUsers: any[]): User[] {
    return dbUsers.map(dbUser => this.mapUserFromDB(dbUser));
  }

  private mapUserFromDB(dbUser: any): User {
    return {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      password: dbUser.password,
      name: dbUser.full_name || dbUser.name,
      department: dbUser.department,
      role: dbUser.role as User['role'],
      permissions: dbUser.permissions || {
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
      isActive: dbUser.is_active,
      lastLogin: dbUser.last_login,
      lastLoginIp: dbUser.last_login_ip,
      avatarColor: dbUser.avatar_color,
      phone: dbUser.phone,
      canViewPages: dbUser.can_view_pages || [],
      canEditPages: dbUser.can_edit_pages || [],
      sessionTimeout: dbUser.session_timeout,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at
    };
  }

  private mapMaterialsFromDB(dbMaterials: any[]): Material[] {
    return dbMaterials.map(dbMaterial => this.mapMaterialFromDB(dbMaterial));
  }

  private mapMaterialFromDB(dbMaterial: any): Material {
    return {
      id: dbMaterial.id,
      name: dbMaterial.name,
      barcode: dbMaterial.barcode,
      gtin: dbMaterial.gtin,
      sn: dbMaterial.sn,
      udiCode: dbMaterial.udi_code,
      allBarcode: dbMaterial.all_barcode,
      intuitiveCode: dbMaterial.intuitive_code,
      serialNumber: dbMaterial.serial_number,
      category: dbMaterial.category,
      subCategory: dbMaterial.sub_category,
      unit: dbMaterial.unit,
      unitPrice: parseFloat(dbMaterial.unit_price),
      currentStock: parseInt(dbMaterial.current_stock),
      minStockLevel: parseInt(dbMaterial.min_stock_level || dbMaterial.min_stock),
      minStock: parseInt(dbMaterial.min_stock),
      supplier: dbMaterial.supplier,
      expirationDate: dbMaterial.expiration_date,
      serialNoStatus: dbMaterial.serial_no_status,
      materialDescription: dbMaterial.material_description,
      location: dbMaterial.location,
      isActive: dbMaterial.is_active,
      status: dbMaterial.status as MaterialStatus,
      createdAt: dbMaterial.created_at,
      updatedAt: dbMaterial.updated_at,
      lastStockCountDate: dbMaterial.last_stock_count_date,
      lastStockCountBy: dbMaterial.last_stock_count_by,
      lastStockCountQuantity: dbMaterial.last_stock_count_quantity,
      isCritical: parseInt(dbMaterial.current_stock) <= parseInt(dbMaterial.min_stock)
    };
  }

  private getEmptyDashboardStats(): DashboardStats {
    return {
      totalMaterials: 0,
      totalPatients: 0,
      totalStockValue: 0,
      criticalStockCount: 0,
      totalUsageCost: 0,
      lowStockMaterials: [],
      recentActivities: [],
      topUsedMaterials: [],
      totalInvoices: 0,
      totalInvoiceAmount: 0,
      todayUsageCost: 0,
      weeklySales: 0,
      monthlySales: 0,
      todayUsagesCount: 0,
      activeSessions: 0,
      statusSummary: { normal: 0, konsinye: 0, iade: 0, faturalı: 0 },
      totalSessions: 0,
      recentSessions: [],
      quickCountSessions: 0,
      todayCounts: 0,
      pendingApprovals: 0
    };
  }

  // ============ BAĞLANTI TESTİ ============
  async testConnection(): Promise<boolean> {
    try {
      await pool.query('SELECT NOW()');
      console.log('✅ Neon SQL bağlantısı başarılı!');
      return true;
    } catch (error) {
      console.error('❌ Neon SQL bağlantı hatası:', error);
      return false;
    }
  }

  // ============ SİSTEM TEMİZLEME ============
  async clearAllData(): Promise<void> {
    try {
      await pool.query('TRUNCATE TABLE materials, users, patients, invoices, categories RESTART IDENTITY CASCADE');
      console.log('✅ Tüm veriler temizlendi');
    } catch (error) {
      console.error('❌ Veri temizleme hatası:', error);
    }
  }
}

// Singleton instance
export const dataServiceSQL = new DataServiceSQL();