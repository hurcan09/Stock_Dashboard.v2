// src/utils/dataServiceSQL.ts
// PostgreSQL veritabanı senkronizasyon servisi - GÜNCELLENMİŞ

import { Material, Category, Supplier, User } from '../types';

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:10000/api'
  : '/api';

export class DataServiceSQL {
  private static instance: DataServiceSQL;
  private token: string | null = null;

  private constructor() {
    // Token'ı localStorage'dan al
    this.token = localStorage.getItem('token');
    
    // Eğer token yoksa ve kullanıcı giriş yapmışsa, localStorage'dan user'dan al
    if (!this.token) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.token) {
            this.token = user.token;
            localStorage.setItem('token', user.token);
          }
        } catch (error) {
          console.error('❌ User parse error:', error);
        }
      }
    }
  }

  public static getInstance(): DataServiceSQL {
    if (!DataServiceSQL.instance) {
      DataServiceSQL.instance = new DataServiceSQL();
    }
    return DataServiceSQL.instance;
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Token'ı her seferinde localStorage'dan kontrol et
    const currentToken = localStorage.getItem('token') || this.token;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': currentToken ? `Bearer ${currentToken}` : '',
      ...options.headers
    };

    console.log(`📡 API Request: ${options.method || 'GET'} ${url}`);
    console.log(`🔑 Token Status: ${currentToken ? 'Present' : 'Missing'}`);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors',
        credentials: 'include'
      });

      console.log(`📡 API Response: ${response.status} ${response.statusText}`);

      if (response.status === 401) {
        this.clearToken();
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
      }

      if (response.status === 403) {
        throw new Error('Bu işlem için yetkiniz yok.');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ API Success Response:', data);
      return data;

    } catch (error) {
      console.error('❌ API Request Error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error('Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin ve sunucunun çalıştığından emin olun.');
        }
        throw error;
      }
      
      throw new Error('Bilinmeyen bir hata oluştu.');
    }
  }

  // ==================== MATERIALS ====================

  async getMaterials(params?: {
    search?: string;
    category?: string;
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<Material[]> {
    try {
      console.log('📦 PostgreSQL malzemeleri yükleniyor...');
      
      // Önce localStorage'dan token kontrolü yap
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('⚠️ Token bulunamadı, boş dizi döndürülüyor');
        return [];
      }

      const queryParams = new URLSearchParams();
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            queryParams.append(key, String(value));
          }
        });
      }
      
      const queryString = queryParams.toString();
      const response = await this.request(`/materials${queryString ? `?${queryString}` : ''}`);
      
      if (response.success && Array.isArray(response.data)) {
        const materials = response.data.map((item: any) => ({
          id: item.id.toString(),
          name: item.name,
          barcode: item.barcode,
          gtin: item.gtin,
          sn: item.sn,
          udiCode: item.udiCode,
          allBarcode: item.allBarcode,
          intuitiveCode: item.intuitiveCode,
          category: item.category,
          subCategory: item.subCategory,
          unit: item.unit,
          unitPrice: parseFloat(item.unitPrice) || 0,
          currentStock: parseInt(item.currentStock) || 0,
          minStock: parseInt(item.minStock) || 0,
          supplier: item.supplier,
          expirationDate: item.expirationDate,
          serialNoStatus: item.serialNoStatus,
          materialDescription: item.materialDescription,
          status: item.status || 'normal',
          createdBy: item.createdBy,
          updatedBy: item.updatedBy,
          isActive: item.isActive !== false,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString()
        }));
        
        console.log(`✅ ${materials.length} malzeme PostgreSQL'den yüklendi`);
        return materials;
      }
      
      console.warn('⚠️ Veri formatı beklenenden farklı:', response);
      return [];
      
    } catch (error) {
      console.error('❌ Malzemeler getirilemedi:', error);
      
      // Hata durumunda kullanıcıya bilgi ver
      if (error instanceof Error) {
        if (error.message.includes('Sunucuya bağlanılamıyor')) {
          alert('❌ PostgreSQL sunucusuna bağlanılamıyor. Lütfen:\n1. Sunucunun çalıştığından emin olun\n2. İnternet bağlantınızı kontrol edin\n3. Terminalde "npm run server" komutunu çalıştırın');
        }
      }
      
      return [];
    }
  }

  async getMaterial(id: string): Promise<Material | null> {
    try {
      console.log(`📦 Malzeme detayı yükleniyor: ${id}`);
      
      const response = await this.request(`/materials/${id}`);
      
      if (response.success && response.data) {
        const item = response.data;
        return {
          id: item.id.toString(),
          name: item.name,
          barcode: item.barcode,
          gtin: item.gtin,
          sn: item.sn,
          udiCode: item.udiCode,
          allBarcode: item.allBarcode,
          intuitiveCode: item.intuitiveCode,
          category: item.category,
          subCategory: item.subCategory,
          unit: item.unit,
          unitPrice: parseFloat(item.unitPrice) || 0,
          currentStock: parseInt(item.currentStock) || 0,
          minStock: parseInt(item.minStock) || 0,
          supplier: item.supplier,
          expirationDate: item.expirationDate,
          serialNoStatus: item.serialNoStatus,
          materialDescription: item.materialDescription,
          status: item.status || 'normal',
          createdBy: item.createdBy,
          updatedBy: item.updatedBy,
          isActive: item.isActive !== false,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString()
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Malzeme getirilemedi:', error);
      return null;
    }
  }

  async addMaterial(material: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>): Promise<Material> {
    try {
      console.log('➕ Yeni malzeme PostgreSQL\'e ekleniyor:', material.name);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Lütfen önce giriş yapın. Token bulunamadı.');
      }

      const response = await this.request('/materials', {
        method: 'POST',
        body: JSON.stringify(material)
      });
      
      console.log('✅ Malzeme ekleme response:', response);
      
      if (response.success) {
        const newMaterial: Material = {
          ...material,
          id: response.id || Date.now().toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        console.log('✅ Malzeme başarıyla eklendi:', newMaterial.name);
        return newMaterial;
      }
      
      throw new Error(response.error || 'Malzeme eklenemedi');
      
    } catch (error) {
      console.error('❌ Malzeme eklenemedi:', error);
      
      let errorMessage = 'Malzeme eklenemedi!';
      if (error instanceof Error) {
        if (error.message.includes('Bu barkod zaten kayıtlı')) {
          errorMessage = '❌ Bu barkod zaten başka bir malzemede kullanılıyor!';
        } else if (error.message.includes('Lütfen önce giriş yapın')) {
          errorMessage = '❌ Lütfen önce giriş yapın!';
          window.location.href = '/login';
        } else {
          errorMessage = `❌ ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  async updateMaterial(id: string, updates: Partial<Material>): Promise<void> {
    try {
      console.log('✏️ Malzeme güncelleniyor:', id);
      
      const response = await this.request(`/materials/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      
      if (response.success) {
        console.log('✅ Malzeme başarıyla güncellendi');
      } else {
        throw new Error(response.error || 'Malzeme güncellenemedi');
      }
    } catch (error) {
      console.error('❌ Malzeme güncellenemedi:', error);
      throw error;
    }
  }

  async deleteMaterial(id: string): Promise<void> {
    try {
      console.log('🗑️ Malzeme siliniyor:', id);
      
      const response = await this.request(`/materials/${id}`, {
        method: 'DELETE'
      });
      
      if (response.success) {
        console.log('✅ Malzeme başarıyla silindi');
      } else {
        throw new Error(response.error || 'Malzeme silinemedi');
      }
    } catch (error) {
      console.error('❌ Malzeme silinemedi:', error);
      throw error;
    }
  }

  async bulkUpdateMaterials(materialIds: string[], updates: any): Promise<void> {
    try {
      console.log('✏️ Toplu malzeme güncelleniyor:', materialIds.length, 'malzeme');
      
      const response = await this.request('/materials/bulk-update', {
        method: 'POST',
        body: JSON.stringify({ materialIds, updates })
      });
      
      if (response.success) {
        console.log('✅ Toplu güncelleme başarılı');
      } else {
        throw new Error(response.error || 'Toplu güncelleme yapılamadı');
      }
    } catch (error) {
      console.error('❌ Toplu güncelleme yapılamadı:', error);
      throw error;
    }
  }

  // ==================== CATEGORIES ====================

  async getCategories(): Promise<Category[]> {
    try {
      console.log('🏷️ Kategoriler yükleniyor...');
      
      const response = await this.request('/categories');
      
      if (response.success && Array.isArray(response.data)) {
        const categories = response.data.map((item: any) => ({
          id: item.id.toString(),
          name: item.name,
          description: item.description,
          isActive: item.isActive !== false,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString()
        }));
        
        console.log(`✅ ${categories.length} kategori yüklendi`);
        return categories;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Kategoriler getirilemedi:', error);
      return [];
    }
  }

  async addCategory(category: Omit<Category, 'id'>): Promise<Category> {
    try {
      console.log('➕ Yeni kategori ekleniyor:', category.name);
      
      const response = await this.request('/categories', {
        method: 'POST',
        body: JSON.stringify(category)
      });
      
      if (response.success) {
        const newCategory: Category = {
          ...category,
          id: response.id || Date.now().toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        console.log('✅ Kategori başarıyla eklendi');
        return newCategory;
      }
      
      throw new Error(response.error || 'Kategori eklenemedi');
    } catch (error) {
      console.error('❌ Kategori eklenemedi:', error);
      throw error;
    }
  }

  // ==================== SUPPLIERS ====================

  async getSuppliers(): Promise<Supplier[]> {
    try {
      console.log('🏢 Tedarikçiler yükleniyor...');
      
      const response = await this.request('/suppliers');
      
      if (response.success && Array.isArray(response.data)) {
        const suppliers = response.data.map((item: any) => ({
          id: item.id.toString(),
          name: item.name,
          contactPerson: item.contactPerson,
          email: item.email,
          phone: item.phone,
          address: item.address,
          taxNumber: item.taxNumber,
          taxOffice: item.taxOffice,
          description: item.description,
          isActive: item.isActive !== false,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString()
        }));
        
        console.log(`✅ ${suppliers.length} tedarikçi yüklendi`);
        return suppliers;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Tedarikçiler getirilemedi:', error);
      return [];
    }
  }

  async addSupplier(supplier: Omit<Supplier, 'id'>): Promise<Supplier> {
    try {
      console.log('➕ Yeni tedarikçi ekleniyor:', supplier.name);
      
      const response = await this.request('/suppliers', {
        method: 'POST',
        body: JSON.stringify(supplier)
      });
      
      if (response.success) {
        const newSupplier: Supplier = {
          ...supplier,
          id: response.id || Date.now().toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        console.log('✅ Tedarikçi başarıyla eklendi');
        return newSupplier;
      }
      
      throw new Error(response.error || 'Tedarikçi eklenemedi');
    } catch (error) {
      console.error('❌ Tedarikçi eklenemedi:', error);
      throw error;
    }
  }

  // ==================== USERS ====================

  async getUsers(): Promise<User[]> {
    try {
      console.log('👥 Kullanıcılar yükleniyor...');
      
      const response = await this.request('/users');
      
      if (Array.isArray(response)) {
        const users = response.map((item: any) => ({
          id: item.id,
          username: item.username,
          email: item.email,
          password: item.password || '',
          name: item.name,
          phone: item.phone,
          department: item.department,
          role: item.role || 'user',
          permissions: item.permissions || {},
          avatarColor: item.avatarColor || '#4F46E5',
          isActive: item.isActive !== false,
          lastLogin: item.lastLogin,
          lastLoginIp: item.lastLoginIp,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString()
        }));
        
        console.log(`✅ ${users.length} kullanıcı yüklendi`);
        return users;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Kullanıcılar getirilemedi:', error);
      return [];
    }
  }

  async getCurrentUser(): Promise<User> {
    try {
      console.log('👤 Mevcut kullanıcı bilgisi alınıyor...');
      
      const response = await this.request('/auth/me');
      
      if (response.success && response.user) {
        const user = response.user;
        const currentUser = {
          id: user.id,
          username: user.username,
          email: user.email,
          password: '',
          name: user.name,
          phone: user.phone || '',
          department: user.department || '',
          role: user.role || 'user',
          permissions: user.permissions || {},
          avatarColor: user.avatarColor || '#4F46E5',
          isActive: true,
          lastLogin: null,
          lastLoginIp: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // localStorage'a kaydet
        localStorage.setItem('user', JSON.stringify(currentUser));
        console.log('✅ Kullanıcı bilgisi alındı:', currentUser.name);
        return currentUser;
      }
      
      throw new Error('Kullanıcı bilgisi alınamadı');
      
    } catch (error) {
      console.error('❌ Kullanıcı bilgisi alınamadı:', error);
      
      // Fallback: localStorage'dan al
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          console.log('⚠️ Kullanıcı localStorage\'dan yüklendi');
          return user;
        } catch {
          // JSON parse hatası
        }
      }
      
      console.log('⚠️ Varsayılan misafir kullanıcı oluşturuldu');
      // Varsayılan misafir kullanıcı
      return {
        id: 'guest',
        username: 'guest',
        email: 'guest@example.com',
        password: '',
        name: 'Misafir Kullanıcı',
        phone: '',
        department: '',
        role: 'user',
        permissions: {
          viewDashboard: true,
          viewReports: true
        },
        avatarColor: '#4F46E5',
        isActive: true,
        lastLogin: null,
        lastLoginIp: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }

  // ==================== AUTH ====================

  async login(email: string, password: string): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    try {
      console.log('🔐 Giriş yapılıyor:', email);
      
      // Özel login endpoint'i (token kontrolü yapmadan)
      const url = `${API_BASE_URL}/auth/login`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Giriş yapılamadı');
      }
      
      const data = await response.json();
      
      if (data.success && data.token) {
        // Token'ı kaydet
        this.setToken(data.token);
        
        // User bilgisini localStorage'a kaydet
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        
        console.log('✅ Giriş başarılı:', email);
        return {
          success: true,
          token: data.token,
          user: data.user
        };
      } else {
        throw new Error(data.error || 'Giriş yapılamadı');
      }
      
    } catch (error) {
      console.error('❌ Giriş hatası:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Giriş yapılamadı'
      };
    }
  }

  async logout(): Promise<void> {
    this.clearToken();
    localStorage.removeItem('user');
    console.log('👋 Çıkış yapıldı');
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: string;
    database: string;
    timestamp: string;
    environment: string;
    realtime: boolean;
  }> {
    try {
      console.log('🏥 Health check yapılıyor...');
      
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      
      console.log('✅ Health check sonucu:', data);
      return {
        status: data.status || 'ERROR',
        database: data.database || 'Disconnected',
        timestamp: data.timestamp || new Date().toISOString(),
        environment: data.environment || 'unknown',
        realtime: data.realtime || false
      };
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        status: 'ERROR',
        database: 'Disconnected',
        timestamp: new Date().toISOString(),
        environment: 'unknown',
        realtime: false
      };
    }
  }

  // ==================== SYNC ====================

  async getSyncTimestamp(): Promise<{ [key: string]: Date }> {
    try {
      const response = await this.request('/sync/timestamp');
      
      if (response.success && response.timestamps) {
        const timestamps: { [key: string]: Date } = {};
        Object.entries(response.timestamps).forEach(([key, value]) => {
          timestamps[key] = new Date(value as string);
        });
        return timestamps;
      }
      
      return {
        materials: new Date(0),
        patients: new Date(0),
        categories: new Date(0),
        suppliers: new Date(0),
        server: new Date()
      };
    } catch (error) {
      console.error('❌ Sync timestamp alınamadı:', error);
      return {
        materials: new Date(0),
        patients: new Date(0),
        categories: new Date(0),
        suppliers: new Date(0),
        server: new Date()
      };
    }
  }

  // ==================== DASHBOARD ====================

  async getDashboardStats(): Promise<any> {
    try {
      const response = await this.request('/dashboard/stats');
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return {
        totalMaterials: 0,
        totalStockValue: 0,
        criticalStockCount: 0,
        totalPatients: 0,
        activeSessions: 0,
        statusSummary: {
          normal: 0,
          konsinye: 0,
          iade: 0,
          faturalı: 0
        }
      };
    } catch (error) {
      console.error('❌ Dashboard stats alınamadı:', error);
      return {
        totalMaterials: 0,
        totalStockValue: 0,
        criticalStockCount: 0,
        totalPatients: 0,
        activeSessions: 0,
        statusSummary: {
          normal: 0,
          konsinye: 0,
          iade: 0,
          faturalı: 0
        }
      };
    }
  }

  // ==================== LOGS ====================

  async logAction(action: {
    action: string;
    module: string;
    recordId: string;
    details: string;
    performedBy: string;
  }): Promise<void> {
    try {
      // Log kaydını localStorage'a ekle
      const logs = JSON.parse(localStorage.getItem('action_logs') || '[]');
      logs.push({
        ...action,
        timestamp: new Date().toISOString(),
        ipAddress: '',
        userAgent: navigator.userAgent
      });
      
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      localStorage.setItem('action_logs', JSON.stringify(logs));
      
      console.log('📝 Action logged:', action);
    } catch (error) {
      console.error('❌ Log kaydedilemedi:', error);
    }
  }

  async getLogs(limit: number = 50): Promise<any[]> {
    try {
      const logs = JSON.parse(localStorage.getItem('action_logs') || '[]');
      return logs.slice(-limit).reverse();
    } catch (error) {
      console.error('❌ Loglar getirilemedi:', error);
      return [];
    }
  }

  // ==================== TEST CONNECTION ====================

  async testConnection(): Promise<boolean> {
    try {
      console.log('🔗 PostgreSQL bağlantısı test ediliyor...');
      
      const health = await this.healthCheck();
      
      if (health.status === 'OK' && health.database === 'Connected') {
        console.log('✅ PostgreSQL bağlantısı başarılı!');
        return true;
      } else {
        console.error('❌ PostgreSQL bağlantısı başarısız:', health);
        return false;
      }
    } catch (error) {
      console.error('❌ Bağlantı testi başarısız:', error);
      return false;
    }
  }

  // ==================== INITIALIZE ====================

  async initialize(): Promise<boolean> {
    try {
      console.log('🚀 PostgreSQL servisi başlatılıyor...');
      
      // Önce bağlantıyı test et
      const connected = await this.testConnection();
      
      if (!connected) {
        console.error('❌ PostgreSQL bağlantısı kurulamadı!');
        return false;
      }
      
      // Token kontrolü yap
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('⚠️ Token bulunamadı. Lütfen giriş yapın.');
        return false;
      }
      
      // Mevcut kullanıcıyı al
      await this.getCurrentUser();
      
      console.log('✅ PostgreSQL servisi başarıyla başlatıldı');
      return true;
      
    } catch (error) {
      console.error('❌ Servis başlatılamadı:', error);
      return false;
    }
  }
}

export const dataServiceSQL = DataServiceSQL.getInstance();