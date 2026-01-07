// src/utils/apiService.ts
const API_BASE_URL = 'https://stock-dashboard-p5ip.onrender.com/api';

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

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': this.token ? `Bearer ${this.token}` : '',
      ...options.headers
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Materials
  async getMaterials(params?: any) {
    const queryParams = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/materials${queryParams ? `?${queryParams}` : ''}`);
  }

  async addMaterial(material: any) {
    return this.request('/materials', {
      method: 'POST',
      body: JSON.stringify(material)
    });
  }

  async updateMaterial(id: string, updates: any) {
    return this.request(`/materials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteMaterial(id: string) {
    return this.request(`/materials/${id}`, {
      method: 'DELETE'
    });
  }

  // Patients
  async getPatients(params?: any) {
    const queryParams = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/patients${queryParams ? `?${queryParams}` : ''}`);
  }

  // Dashboard
  async getDashboardStats() {
    return this.request('/dashboard/stats');
  }

  // Categories
  async getCategories() {
    return this.request('/categories');
  }

  // Suppliers
  async getSuppliers() {
    return this.request('/suppliers');
  }

  // Users
  async getUsers() {
    return this.request('/users');
  }

  // Sync
  async getSyncTimestamp() {
    return this.request('/sync/timestamp');
  }

  async checkUpdates(lastSync: string) {
    return this.request('/sync/check', {
      method: 'POST',
      body: JSON.stringify({ lastSync })
    });
  }
}

export const apiService = new ApiService();