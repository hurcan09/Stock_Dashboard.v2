// src/utils/apiService.ts
const API_BASE_URL = 'http://localhost:5000/api';

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  pagination?: any;
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  private async request<T = ApiResponse>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    console.log(`📡 API Request: ${options.method || 'GET'} ${url}`);
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': this.token ? `Bearer ${this.token}` : '',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors',
        credentials: 'include'
      });

      console.log(`📡 API Response Status: ${response.status} ${response.statusText}`);

      if (response.status === 401) {
        // Unauthorized - token expired
        this.clearToken();
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
      }

      if (response.status === 403) {
        throw new Error('Bu işlem için yetkiniz yok.');
      }

      if (!response.ok) {
        const errorText = await response.text();
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
      console.log(`📡 API Response Data:`, data);
      return data;

    } catch (error) {
      console.error('❌ API Request Error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error('Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.');
        }
        throw error;
      }
      
      throw new Error('Bilinmeyen bir hata oluştu.');
    }
  }

  // ==================== AUTH ====================
  async login(email: string, password: string) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (response.success && response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  async getCurrentUser() {
    try {
      const response = await this.request('/auth/me');
      return response.user;
    } catch (error) {
      console.error('Kullanıcı bilgisi alınamadı:', error);
      return null;
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
  }) {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    
    const queryString = queryParams.toString();
    return this.request(`/materials${queryString ? `?${queryString}` : ''}`);
  }

  async getMaterial(id: string) {
    return this.request(`/materials/${id}`);
  }

  async addMaterial(material: any) {
    // Mevcut kullanıcıyı al
    const user = await this.getCurrentUser();
    
    const materialData = {
      ...material,
      createdBy: user?.name || 'Sistem',
      updatedBy: user?.name || 'Sistem',
      isActive: true,
      status: material.status || 'normal',
      unit: material.unit || 'adet',
      unitPrice: parseFloat(material.unitPrice) || 0,
      currentStock: parseInt(material.currentStock) || 0,
      minStock: parseInt(material.minStock) || 0
    };
    
    console.log('📤 Adding material:', materialData);
    
    return this.request('/materials', {
      method: 'POST',
      body: JSON.stringify(materialData)
    });
  }

  async updateMaterial(id: string, updates: any) {
    const user = await this.getCurrentUser();
    
    const updateData = {
      ...updates,
      updatedBy: user?.name || 'Sistem'
    };
    
    return this.request(`/materials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  async deleteMaterial(id: string) {
    return this.request(`/materials/${id}`, {
      method: 'DELETE'
    });
  }

  async bulkUpdateMaterials(materialIds: string[], updates: any) {
    const user = await this.getCurrentUser();
    
    const updateData = {
      ...updates,
      updatedBy: user?.name || 'Sistem'
    };
    
    return this.request('/materials/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ materialIds, updates: updateData })
    });
  }

  async bulkStatusChange(materialIds: string[], status: string) {
    const updates = { status };
    return this.bulkUpdateMaterials(materialIds, updates);
  }

  // ==================== CATEGORIES ====================
  async getCategories() {
    const response = await this.request('/categories');
    return response;
  }

  async addCategory(categoryData: { name: string; description?: string }) {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData)
    });
  }

  // ==================== SUPPLIERS ====================
  async getSuppliers() {
    const response = await this.request('/suppliers');
    return response;
  }

  async addSupplier(supplierData: any) {
    return this.request('/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplierData)
    });
  }

  // ==================== DASHBOARD ====================
  async getDashboardStats() {
    return this.request('/dashboard/stats');
  }

  // ==================== PATIENTS ====================
  async getPatients(params?: { search?: string; page?: number; limit?: number }) {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    
    const queryString = queryParams.toString();
    return this.request(`/patients${queryString ? `?${queryString}` : ''}`);
  }

  async addPatient(patientData: any) {
    const user = await this.getCurrentUser();
    
    const data = {
      ...patientData,
      createdBy: user?.name || 'Sistem'
    };
    
    return this.request('/patients', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // ==================== DOCTORS ====================
  async getDoctors() {
    return this.request('/doctors');
  }

  async addDoctor(doctorData: any) {
    return this.request('/doctors', {
      method: 'POST',
      body: JSON.stringify(doctorData)
    });
  }

  // ==================== INVOICES ====================
  async getInvoices(params?: { status?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    
    const queryString = queryParams.toString();
    return this.request(`/invoices${queryString ? `?${queryString}` : ''}`);
  }

  // ==================== USERS ====================
  async getUsers() {
    return this.request('/users');
  }

  // ==================== EXPORT/IMPORT ====================
  async exportMaterials() {
    const response = await fetch(`${API_BASE_URL}/export/materials`, {
      headers: {
        'Authorization': this.token ? `Bearer ${this.token}` : ''
      }
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    return response.blob();
  }

  // ==================== SYNC ====================
  async getSyncTimestamp() {
    try {
      return await this.request('/sync/timestamp');
    } catch (error) {
      console.error('Sync timestamp error:', error);
      return { success: false, timestamps: {} };
    }
  }

  async checkUpdates(lastSync: string) {
    try {
      return await this.request('/sync/check', {
        method: 'POST',
        body: JSON.stringify({ lastSync })
      });
    } catch (error) {
      console.error('Check updates error:', error);
      return { success: false, updates: {} };
    }
  }

  // ==================== HEALTH CHECK ====================
  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'ERROR', error: 'Server unavailable' };
    }
  }
}

export const apiService = new ApiService();