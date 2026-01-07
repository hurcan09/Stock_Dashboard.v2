import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Trash2, Edit2, Package, Filter, Download, 
  Barcode, Camera, X, Upload, Eye, Calendar, FileText, 
  ClipboardList, ChevronLeft, ChevronRight, CheckSquare, 
  Square, Check, MoveHorizontal, ArrowRight, ExternalLink,
  MoreVertical, Copy, Printer, QrCode, AlertTriangle,
  RefreshCw, Save, Star, Shield, Lock, Unlock,
  BarChart3, TrendingUp, TrendingDown, PackageOpen,
  Layers, Grid3X3, List, Grid, Menu, MoreHorizontal,
  ArrowUp, ArrowDown, UserPlus, Users, Building,
  Database, Wifi, WifiOff, CheckCircle, XCircle
} from 'lucide-react';
import { Material, Category, Supplier, StockCount, StockCountSession, MaterialStatus } from '../types';
import { dataService } from '../utils/dataService';
import { dataServiceSQL } from '../utils/dataServiceSQL';

// ✅ GÜNCELLENMİŞ API SERVİSİ - PostgreSQL için optimize edilmiş
const API_BASE_URL = 'http://localhost:10000';

const apiService = {
  // ✅ PostgreSQL bağlantı durumunu kontrol et
  async checkConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      console.log('🔗 PostgreSQL bağlantısı kontrol ediliyor...');
      const token = localStorage.getItem('token');
      
      if (!token) {
        return { connected: false, message: '❌ Token bulunamadı. Lütfen giriş yapın.' };
      }
      
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ PostgreSQL bağlantı durumu:', data);
        return { 
          connected: data.status === 'OK' && data.database === 'Connected', 
          message: data.status === 'OK' ? '✅ PostgreSQL bağlantısı aktif' : '❌ PostgreSQL bağlantı sorunu'
        };
      }
      
      return { connected: false, message: '❌ Sunucuya bağlanılamıyor' };
      
    } catch (error) {
      console.error('❌ PostgreSQL bağlantı kontrolü başarısız:', error);
      return { 
        connected: false, 
        message: '❌ Sunucuya bağlanılamıyor. Lütfen npm run server komutunu çalıştırın.' 
      };
    }
  },

  // ✅ Malzemeleri getir - PostgreSQL'DEN
  async getMaterials(): Promise<Material[]> {
    try {
      console.log('📡 PostgreSQL veritabanından malzemeler yükleniyor...');
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.warn('⚠️ Token bulunamadı. Boş dizi döndürülüyor.');
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/api/materials`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu.');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API hatası:', response.status, errorText);
        throw new Error(`API hatası: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        console.log(`✅ ${result.data.length} malzeme PostgreSQL'den başarıyla yüklendi`);
        
        // Verileri Material tipine dönüştür
        const materials: Material[] = result.data.map((item: any) => ({
          id: item.id.toString(),
          name: item.name,
          barcode: item.barcode,
          gtin: item.gtin || '',
          sn: item.sn || '',
          udiCode: item.udiCode || '',
          allBarcode: item.allBarcode || '',
          intuitiveCode: item.intuitiveCode || '',
          category: item.category || '',
          subCategory: item.subCategory || '',
          unit: item.unit || 'adet',
          unitPrice: parseFloat(item.unitPrice) || 0,
          currentStock: parseInt(item.currentStock) || 0,
          minStock: parseInt(item.minStock) || 0,
          supplier: item.supplier || '',
          expirationDate: item.expirationDate || '',
          serialNoStatus: item.serialNoStatus || '',
          materialDescription: item.materialDescription || '',
          status: (item.status || 'normal') as MaterialStatus,
          createdBy: item.createdBy,
          updatedBy: item.updatedBy,
          isActive: item.isActive !== false,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString()
        }));
        
        return materials;
      } else {
        console.warn('⚠️ Veri formatı beklenenden farklı:', result);
        return result.data || result || [];
      }
    } catch (error) {
      console.error('❌ PostgreSQL veritabanından malzemeler getirilemedi:', error);
      
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        alert('Sunucuya bağlanılamıyor. Lütfen "npm run server" komutunu çalıştırdığınızdan emin olun.');
      }
      
      return [];
    }
  },

  // ✅ Yeni malzeme ekle - PostgreSQL'e kaydet
  async addMaterial(material: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>): Promise<Material> {
    try {
      console.log('📤 PostgreSQL veritabanına malzeme ekleniyor...');
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Token bulunamadı. Lütfen giriş yapın.');
      }

      // PostgreSQL formatına dönüştür
      const postgresMaterial = {
        name: material.name,
        barcode: material.barcode,
        gtin: material.gtin || '',
        sn: material.sn || '',
        udiCode: material.udiCode || '',
        allBarcode: material.allBarcode || '',
        intuitiveCode: material.intuitiveCode || '',
        category: material.category || '',
        subCategory: material.subCategory || '',
        unit: material.unit || 'adet',
        unitPrice: material.unitPrice || 0,
        currentStock: material.currentStock || 0,
        minStock: material.minStock || 0,
        supplier: material.supplier || '',
        expirationDate: material.expirationDate || '',
        serialNoStatus: material.serialNoStatus || '',
        materialDescription: material.materialDescription || '',
        status: material.status || 'normal'
      };

      const response = await fetch(`${API_BASE_URL}/api/materials`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postgresMaterial)
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu.');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Malzeme eklenemedi:', response.status, errorText);
        
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || 'Malzeme eklenemedi');
        } catch {
          throw new Error(`Malzeme eklenemedi: ${response.status}`);
        }
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Malzeme eklenemedi');
      }
      
      console.log('✅ Malzeme PostgreSQL veritabanına başarıyla eklendi:', result);
      
      const newMaterial: Material = { 
        ...material, 
        id: result.data?.id || Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      };
      
      return newMaterial;
    } catch (error) {
      console.error('❌ PostgreSQL veritabanına malzeme eklenemedi:', error);
      throw error;
    }
  },

  // ✅ Malzeme güncelle - PostgreSQL'e kaydet
  async updateMaterial(id: string, updates: Partial<Material>): Promise<void> {
    try {
      console.log('✏️ PostgreSQL veritabanında malzeme güncelleniyor...');
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Token bulunamadı. Lütfen giriş yapın.');
      }

      const response = await fetch(`${API_BASE_URL}/api/materials/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu.');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Malzeme güncellenemedi:', response.status, errorText);
        throw new Error('Malzeme güncellenemedi');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Malzeme güncellenemedi');
      }
      
      console.log('✅ Malzeme PostgreSQL veritabanında başarıyla güncellendi');
    } catch (error) {
      console.error('❌ PostgreSQL veritabanında malzeme güncellenemedi:', error);
      throw error;
    }
  },

  // ✅ Malzeme sil - PostgreSQL'den sil
  async deleteMaterial(id: string): Promise<void> {
    try {
      console.log('🗑️ PostgreSQL veritabanından malzeme siliniyor...');
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Token bulunamadı. Lütfen giriş yapın.');
      }

      const response = await fetch(`${API_BASE_URL}/api/materials/${id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu.');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Malzeme silinemedi:', response.status, errorText);
        throw new Error('Malzeme silinemedi');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Malzeme silinemedi');
      }
      
      console.log('✅ Malzeme PostgreSQL veritabanından başarıyla silindi');
    } catch (error) {
      console.error('❌ PostgreSQL veritabanından malzeme silinemedi:', error);
      throw error;
    }
  },

  // ✅ Kategorileri getir
  async getCategories(): Promise<Category[]> {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/api/categories`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return [];
      }
      
      if (!response.ok) {
        console.error('Kategoriler getirilemedi:', response.status);
        return [];
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const categories: Category[] = result.data.map((item: any) => ({
          id: item.id.toString(),
          name: item.name,
          description: item.description || '',
          isActive: item.isActive !== false,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString()
        }));
        return categories;
      }
      
      return result.data || result || [];
    } catch (error) {
      console.error('Kategoriler getirilemedi:', error);
      return [];
    }
  },

  // ✅ Kategori ekle
  async addCategory(category: Omit<Category, 'id'>): Promise<Category> {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Token bulunamadı. Lütfen giriş yapın.');
      }

      const response = await fetch(`${API_BASE_URL}/api/categories`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(category)
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu.');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Kategori eklenemedi');
      }
      
      const result = await response.json();
      
      const newCategory: Category = {
        ...category,
        id: result.id || Date.now().toString(),
        isActive: true
      };
      
      return newCategory;
    } catch (error) {
      console.error('Kategori eklenemedi:', error);
      throw error;
    }
  },

  // ✅ Tedarikçileri getir
  async getSuppliers(): Promise<Supplier[]> {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return [];
      }
      
      if (!response.ok) {
        console.error('Tedarikçiler getirilemedi:', response.status);
        return [];
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const suppliers: Supplier[] = result.data.map((item: any) => ({
          id: item.id.toString(),
          name: item.name,
          contactPerson: item.contactPerson || '',
          email: item.email || '',
          phone: item.phone || '',
          address: item.address || '',
          taxNumber: item.taxNumber || '',
          taxOffice: item.taxOffice || '',
          description: item.description || '',
          isActive: item.isActive !== false,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString()
        }));
        return suppliers;
      }
      
      return result.data || result || [];
    } catch (error) {
      console.error('Tedarikçiler getirilemedi:', error);
      return [];
    }
  },

  // ✅ Tedarikçi ekle
  async addSupplier(supplier: Omit<Supplier, 'id'>): Promise<Supplier> {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Token bulunamadı. Lütfen giriş yapın.');
      }

      const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(supplier)
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu.');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Tedarikçi eklenemedi');
      }
      
      const result = await response.json();
      
      const newSupplier: Supplier = {
        ...supplier,
        id: result.id || Date.now().toString(),
        isActive: true
      };
      
      return newSupplier;
    } catch (error) {
      console.error('Tedarikçi eklenemedi:', error);
      throw error;
    }
  },

  // ✅ Toplu malzeme güncelleme
  async bulkUpdateMaterials(materialIds: string[], updates: any): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Token bulunamadı. Lütfen giriş yapın.');
      }

      const response = await fetch(`${API_BASE_URL}/api/materials/bulk-update`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ materialIds, updates })
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu.');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Toplu güncelleme yapılamadı');
      }
      
      console.log('✅ Toplu güncelleme başarıyla tamamlandı');
    } catch (error) {
      console.error('Toplu güncelleme yapılamadı:', error);
      throw error;
    }
  }
};

// ✅ Tedarikçi Ekleme Modal Component'i
function AddSupplierModal({ onSave, onClose }: { onSave: (supplier: Omit<Supplier, 'id'>) => void; onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    taxNumber: '',
    taxOffice: '',
    description: ''
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Tedarikçi adı zorunludur';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Geçerli bir e-posta adresi giriniz';
    }
    
    if (formData.phone && !/^[0-9+\-\s()]{10,15}$/.test(formData.phone)) {
      newErrors.phone = 'Geçerli bir telefon numarası giriniz';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const newSupplier: Omit<Supplier, 'id'> = {
      name: formData.name.trim(),
      contactPerson: formData.contactPerson.trim() || '',
      email: formData.email.trim() || '',
      phone: formData.phone.trim() || '',
      address: formData.address.trim() || '',
      taxNumber: formData.taxNumber.trim() || '',
      taxOffice: formData.taxOffice.trim() || '',
      description: formData.description.trim() || '',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    onSave(newSupplier);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-md mx-4">
        <div className="p-6 bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-800">
              Yeni Tedarikçi Ekle
            </h3>
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-full transition-colors"
              title="Kapat"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tedarikçi Adı <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`input-modern w-full ${errors.name ? 'border-red-500' : ''}`}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Tedarikçi adını giriniz"
                required
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Yetkili Kişi
              </label>
              <input
                type="text"
                className="input-modern w-full"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="Yetkili kişi adı"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <input
                  type="tel"
                  className={`input-modern w-full ${errors.phone ? 'border-red-500' : ''}`}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="05xx xxx xx xx"
                />
                {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-posta
                </label>
                <input
                  type="email"
                  className={`input-modern w-full ${errors.email ? 'border-red-500' : ''}`}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ornek@firma.com"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vergi Numarası
                </label>
                <input
                  type="text"
                  className="input-modern w-full"
                  value={formData.taxNumber}
                  onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  placeholder="Vergi numarası"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vergi Dairesi
                </label>
                <input
                  type="text"
                  className="input-modern w-full"
                  value={formData.taxOffice}
                  onChange={(e) => setFormData({ ...formData, taxOffice: e.target.value })}
                  placeholder="Vergi dairesi"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adres
              </label>
              <textarea
                className="input-modern w-full min-h-[80px]"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Tam adres"
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Açıklama
              </label>
              <textarea
                className="input-modern w-full min-h-[60px]"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ek açıklamalar"
                rows={2}
              />
            </div>
            
            <div className="flex space-x-3 pt-4 border-t border-gray-200">
              <button
                type="submit"
                className="btn-modern flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Tedarikçi Ekle
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-modern-secondary flex-1"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ✅ Kategori Ekleme Modal Component'i
function AddCategoryModal({ onSave, onClose }: { onSave: (category: Omit<Category, 'id'>) => void; onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Kategori adı zorunludur';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const newCategory: Omit<Category, 'id'> = {
      name: formData.name.trim(),
      description: formData.description.trim() || '',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    onSave(newCategory);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-md mx-4">
        <div className="p-6 bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-800">
              Yeni Kategori Ekle
            </h3>
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-full transition-colors"
              title="Kapat"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategori Adı <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`input-modern w-full ${errors.name ? 'border-red-500' : ''}`}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Kategori adını giriniz"
                required
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Açıklama
              </label>
              <textarea
                className="input-modern w-full min-h-[80px]"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Kategori açıklaması"
                rows={3}
              />
            </div>
            
            <div className="flex space-x-3 pt-4 border-t border-gray-200">
              <button
                type="submit"
                className="btn-modern flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                Kategori Ekle
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-modern-secondary flex-1"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ✅ Barkod tarama modal component'i
function BarcodeScannerModal({ onScan, onClose }: { onScan: (barcode: string) => void; onClose: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim());
      onClose();
    }
  };

  const startCameraScan = async () => {
    try {
      setScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setVideoStream(stream);
    } catch (error) {
      console.error('Kamera erişim hatası:', error);
      alert('Kameraya erişim sağlanamadı!');
      setScanning(false);
    }
  };

  const stopCameraScan = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCameraScan();
    };
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Barkod/QR Tara</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="text-center mb-6">
            <div className="bg-gray-100 rounded-lg p-8 mb-4">
              <div className="relative inline-block">
                <div className="w-64 h-48 bg-gray-200 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-400">
                  {scanning && videoStream ? (
                    <video 
                      ref={video => {
                        if (video) video.srcObject = videoStream;
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : scanning ? (
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Kamera başlatılıyor...</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Camera className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Kamera görüntüsü burada görünecek</p>
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 border-2 border-green-500 rounded-lg pointer-events-none">
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-2 py-1 text-xs rounded">
                    Barkodu bu alana getirin
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Barkod veya QR kodu kamera görüş alanının vurgulanan yerine tam olarak yerleştirin.
            </p>
          </div>

          <div className="border-t pt-4">
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Veya barkodu manuel girin:
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="Barkod numarasını girin"
                  autoFocus
                />
              </div>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={scanning ? stopCameraScan : startCameraScan}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-all flex items-center justify-center space-x-2"
                >
                  <Camera className="h-4 w-4" />
                  <span>{scanning ? 'Kamerayı Kapat' : 'Kamerayı Aç'}</span>
                </button>
                <button
                  type="submit"
                  disabled={!manualBarcode.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition-all"
                >
                  Tamam
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ Toplu Düzenleme Modal Component
function BulkEditModal({ 
  selectedMaterials, 
  onSave, 
  onClose 
}: { 
  selectedMaterials: Material[];
  onSave: (materialIds: string[], updates: { field: string; value: any }[]) => void;
  onClose: () => void;
}) {
  const [edits, setEdits] = useState<{ field: string; value: any }[]>([]);
  const [field, setField] = useState('unitPrice');
  const [value, setValue] = useState('');

  const currentUser = dataService.getCurrentUser();
  const isSystemAdmin = currentUser.role === 'admin' || currentUser.permissions.manageMaterials;

  if (!isSystemAdmin) {
    return (
      <div className="modal-overlay">
        <div className="modal-container w-full max-w-md mx-4">
          <div className="p-6">
            <div className="text-center py-8">
              <Shield className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-600 mb-2">Yetki Gerekli</h3>
              <p className="text-gray-600">Bu işlemi yapmak için sistem yöneticisi yetkisine sahip olmalısınız.</p>
              <button
                onClick={onClose}
                className="mt-4 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-6 rounded-lg font-medium transition-all"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleAddEdit = () => {
    if (!field.trim() || value === '') return;
    
    const newEdit = { field, value: parseValue(field, value) };
    setEdits([...edits, newEdit]);
    setField('unitPrice');
    setValue('');
  };

  const parseValue = (field: string, value: string) => {
    if (field === 'unitPrice' || field === 'currentStock' || field === 'minStock') {
      const parsed = parseFloat(value);
      return Number.isInteger(parsed) ? parseInt(value) : parsed;
    }
    return value;
  };

  const handleRemoveEdit = (index: number) => {
    const newEdits = [...edits];
    newEdits.splice(index, 1);
    setEdits(newEdits);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (edits.length === 0) {
      alert('Lütfen en az bir düzenleme ekleyin!');
      return;
    }

    const materialIds = selectedMaterials.map(m => m.id);
    onSave(materialIds, edits);
    onClose();
  };

  const fieldOptions = [
    { value: 'unitPrice', label: 'Birim Fiyat (₺)', type: 'number' },
    { value: 'currentStock', label: 'Mevcut Stok', type: 'number' },
    { value: 'minStock', label: 'Kritik Stok', type: 'number' }
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-2xl mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-semibold">Toplu Düzenleme</h3>
              <p className="text-gray-600">{selectedMaterials.length} malzeme seçildi</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                <Package className="h-5 w-5 mr-2" />
                Seçili Malzemeler
              </h4>
              <div className="max-h-40 overflow-y-auto">
                {selectedMaterials.slice(0, 10).map((material, index) => (
                  <div key={material.id} className="flex items-center justify-between py-2 border-b border-blue-100 last:border-0">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{material.name}</div>
                      <div className="text-xs text-gray-600">{material.barcode}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div>Stok: {material.currentStock}</div>
                      <div>Fiyat: ₺{material.unitPrice.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
                {selectedMaterials.length > 10 && (
                  <div className="text-center text-sm text-blue-600 pt-2">
                    ...ve {selectedMaterials.length - 10} malzeme daha
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-4">Düzenlemeleri Ekleyin</h4>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alan
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={field}
                      onChange={(e) => setField(e.target.value)}
                    >
                      {fieldOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Değer
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type={fieldOptions.find(f => f.value === field)?.type || 'text'}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={
                          field === 'unitPrice' ? 'Örn: 25.50' :
                          field === 'currentStock' ? 'Örn: 100' :
                          'Örn: 10'
                        }
                      />
                      <button
                        type="button"
                        onClick={handleAddEdit}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-1"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Ekle</span>
                      </button>
                    </div>
                  </div>
                </div>

                {edits.length > 0 && (
                  <div className="border-t pt-4">
                    <h5 className="font-semibold text-gray-700 mb-2">Eklenen Düzenlemeler:</h5>
                    <div className="space-y-2">
                      {edits.map((edit, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <div>
                            <span className="font-medium">
                              {fieldOptions.find(f => f.value === edit.field)?.label}
                            </span>
                            <span className="ml-2">→</span>
                            <span className="ml-2 font-semibold text-blue-600">
                              {typeof edit.value === 'number' && edit.field === 'unitPrice' ? '₺' : ''}
                              {edit.value}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveEdit(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-800 mb-1">Önemli!</h4>
                  <p className="text-sm text-yellow-700">
                    Bu işlem {selectedMaterials.length} malzemenin seçili alanlarını güncelleyecektir.
                    Değişiklikler geri alınamaz. Lütfen emin olun.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleSubmit}
                disabled={edits.length === 0}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white py-3 px-4 rounded-lg font-medium transition-all shadow-lg hover:shadow-xl"
              >
                Toplu Güncelleme Yap
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-3 px-4 rounded-lg font-medium transition-all"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ Hızlı Düzenleme Modal Component
function QuickEditModal({ material, onSave, onClose }: { material: Material; onSave: (updates: Partial<Material>) => void; onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: material.name,
    barcode: material.barcode,
    gtin: material.gtin || '',
    sn: material.sn || '',
    udiCode: material.udiCode || '',
    allBarcode: material.allBarcode || '',
    intuitiveCode: material.intuitiveCode || '',
    currentStock: material.currentStock,
    minStock: material.minStock,
    unitPrice: material.unitPrice,
    unit: material.unit,
    category: material.category,
    subCategory: material.subCategory || '',
    supplier: material.supplier || '',
    expirationDate: material.expirationDate || '',
    serialNoStatus: material.serialNoStatus || '',
    materialDescription: material.materialDescription || '',
    status: material.status || 'normal'
  });

  const units = ['adet', 'kutu', 'şişe', 'tüp', 'paket', 'ampul', 'kg', 'lt', 'metre'];
  const statusOptions: MaterialStatus[] = ['normal', 'konsinye', 'iade', 'faturalı'];
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  useEffect(() => {
    loadCategoriesAndSuppliers();
  }, []);

  const loadCategoriesAndSuppliers = async () => {
    try {
      const [cats, sups] = await Promise.all([
        apiService.getCategories(),
        apiService.getSuppliers()
      ]);
      setCategories(cats);
      setSuppliers(sups);
    } catch (error) {
      console.error('Kategoriler ve tedarikçiler yüklenemedi:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleAddCategory = async () => {
    if (newCategory.trim()) {
      try {
        const newCat: Omit<Category, 'id'> = {
          name: newCategory.trim(),
          description: '',
          isActive: true,
          createdAt: new Date().toISOString()
        };
        await apiService.addCategory(newCat);
        await loadCategoriesAndSuppliers();
        setFormData({ ...formData, category: newCategory.trim() });
        setNewCategory('');
        setShowAddCategory(false);
      } catch (error) {
        console.error('Kategori eklenemedi:', error);
        alert('Kategori eklenirken hata oluştu!');
      }
    }
  };

  const handleAddSupplier = async () => {
    if (newSupplier.trim()) {
      try {
        const newSup: Omit<Supplier, 'id'> = {
          name: newSupplier.trim(),
          contactPerson: '',
          email: '',
          phone: '',
          address: '',
          isActive: true,
          createdAt: new Date().toISOString()
        };
        await apiService.addSupplier(newSup);
        await loadCategoriesAndSuppliers();
        setFormData({ ...formData, supplier: newSupplier.trim() });
        setNewSupplier('');
        setShowAddSupplier(false);
      } catch (error) {
        console.error('Tedarikçi eklenemedi:', error);
        alert('Tedarikçi eklenirken hata oluştu!');
      }
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-6xl mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Hızlı Düzenle - {material.name}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Malzeme Adı *
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Barkod *
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GTIN
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.gtin}
                  onChange={(e) => setFormData({ ...formData, gtin: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SN
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.sn}
                  onChange={(e) => setFormData({ ...formData, sn: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  UDI Code
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.udiCode}
                  onChange={(e) => setFormData({ ...formData, udiCode: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  All Barcode
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.allBarcode}
                  onChange={(e) => setFormData({ ...formData, allBarcode: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sezgisel Kod
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.intuitiveCode}
                  onChange={(e) => setFormData({ ...formData, intuitiveCode: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statü
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as MaterialStatus })}
                >
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori
                </label>
                <div className="flex space-x-2">
                  <select
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">Kategori seçin</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCategory(true)}
                  className="mt-1 text-xs text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Yeni Kategori Ekle
                </button>
                {showAddCategory && (
                  <div className="mt-2 flex space-x-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Yeni kategori adı"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Ekle
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCategory('');
                        setShowAddCategory(false);
                      }}
                      className="px-2 py-1 bg-gray-300 rounded text-sm hover:bg-gray-400"
                    >
                      İptal
                    </button>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alt Kategori
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.subCategory}
                  onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tedarikçi
                </label>
                <div className="flex space-x-2">
                  <select
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  >
                    <option value="">Tedarikçi seçin</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.name}>{sup.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddSupplier(true)}
                  className="mt-1 text-xs text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Yeni Tedarikçi Ekle
                </button>
                {showAddSupplier && (
                  <div className="mt-2 flex space-x-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                      value={newSupplier}
                      onChange={(e) => setNewSupplier(e.target.value)}
                      placeholder="Yeni tedarikçi adı"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddSupplier}
                      className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Ekle
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewSupplier('');
                        setShowAddSupplier(false);
                      }}
                      className="px-2 py-1 bg-gray-300 rounded text-sm hover:bg-gray-400"
                    >
                      İptal
                    </button>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Birim
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                >
                  {units.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mevcut Stok
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.currentStock}
                  onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kritik Stok
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Birim Fiyat (₺)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKT
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.expirationDate}
                  onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seri No Durumu
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.serialNoStatus}
                  onChange={(e) => setFormData({ ...formData, serialNoStatus: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Malzeme Açıklama
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.materialDescription}
                  onChange={(e) => setFormData({ ...formData, materialDescription: e.target.value })}
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-2 px-4 rounded-lg font-medium transition-all shadow-lg hover:shadow-xl"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg font-medium transition-all"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ✅ Malzeme Detay Modal Component
function MaterialDetailsModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const [stockCounts, setStockCounts] = useState<StockCount[]>([]);
  const [sessions, setSessions] = useState<StockCountSession[]>([]);

  useEffect(() => {
    if (material) {
      const allCounts = dataService.getStockCounts();
      const allSessions = dataService.getStockCountSessions();
      
      const materialCounts = allCounts.filter(count => 
        count.barcode === material.barcode ||
        count.materialId === material.id
      );
      
      const sortedCounts = materialCounts.sort((a, b) => 
        new Date(b.countDate).getTime() - new Date(a.countDate).getTime()
      );
      
      setStockCounts(sortedCounts);
      setSessions(allSessions);
    }
  }, [material]);

  const getStockStatusBadge = (material: Material) => {
    if (material.currentStock === 0) {
      return <span className="inline-flex px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full">Stok Yok</span>;
    } else if (material.currentStock <= material.minStock) {
      return <span className="inline-flex px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">Kritik Stok</span>;
    } else {
      return <span className="inline-flex px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">Yeterli Stok</span>;
    }
  };

  const getStatusBadge = (status: MaterialStatus) => {
    const colors = {
      normal: 'bg-green-100 text-green-800',
      konsinye: 'bg-blue-100 text-blue-800',
      iade: 'bg-red-100 text-red-800',
      faturalı: 'bg-purple-100 text-purple-800'
    };
    
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colors[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const getSessionByCountId = (countId: string) => {
    const count = stockCounts.find(c => c.id === countId);
    return sessions.find(s => s.id === count?.sessionId);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-4xl mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-semibold">Malzeme Detayları</h3>
              <p className="text-gray-600">Barkod: {material.barcode} | Statü: {getStatusBadge(material.status || 'normal')}</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  Temel Bilgiler
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Malzeme Adı:</span>
                    <div className="mt-1 font-semibold">{material.name}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Barkod:</span>
                    <div className="mt-1 font-mono">{material.barcode}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">GTIN:</span>
                    <div className="mt-1 font-mono">{material.gtin || '-'}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">SN:</span>
                    <div className="mt-1 font-mono">{material.sn || '-'}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">UDI Code:</span>
                    <div className="mt-1 font-mono">{material.udiCode || '-'}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">All Barcode:</span>
                    <div className="mt-1 font-mono">{material.allBarcode || '-'}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Kategori:</span>
                    <div className="mt-1">{material.category}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Alt Kategori:</span>
                    <div className="mt-1">{material.subCategory || '-'}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Birim:</span>
                    <div className="mt-1">{material.unit}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Birim Fiyat:</span>
                    <div className="mt-1">₺{material.unitPrice.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                  <ClipboardList className="h-5 w-5 mr-2" />
                  Stok Bilgileri
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Mevcut Stok:</span>
                    <div className={`mt-1 font-semibold ${
                      material.currentStock === 0 ? 'text-red-600' :
                      material.currentStock <= material.minStock ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {material.currentStock} {material.unit}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Kritik Stok:</span>
                    <div className="mt-1">{material.minStock} {material.unit}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Stok Durumu:</span>
                    <div className="mt-1">{getStockStatusBadge(material)}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Tedarikçi:</span>
                    <div className="mt-1">{material.supplier || '-'}</div>
                  </div>
                </div>
              </div>

              {(material.expirationDate || material.serialNoStatus || material.materialDescription) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-3">Ek Bilgiler</h4>
                  <div className="space-y-2 text-sm">
                    {material.expirationDate && (
                      <div>
                        <span className="font-medium text-gray-700">SKT:</span>
                        <div className="mt-1">{material.expirationDate}</div>
                      </div>
                    )}
                    {material.serialNoStatus && (
                      <div>
                        <span className="font-medium text-gray-700">Seri No Durumu:</span>
                        <div className="mt-1">{material.serialNoStatus}</div>
                      </div>
                    )}
                    {material.materialDescription && (
                      <div>
                        <span className="font-medium text-gray-700">Açıklama:</span>
                        <div className="mt-1">{material.materialDescription}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-800 mb-3 flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Son Sayım Geçmişi ({stockCounts.length} kayıt)
                </h4>
                
                {stockCounts.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {stockCounts.slice(0, 5).map((count) => {
                      const session = getSessionByCountId(count.id);
                      return (
                        <div key={count.id} className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-medium text-blue-600">
                              {session?.invoiceNo || 'Fatura Yok'}
                            </div>
                            <div className="flex space-x-2">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                count.status === 'tamamlandı' || count.status === 'onaylandı' ? 'bg-green-100 text-green-800' :
                                count.status === 'beklemede' ? 'bg-yellow-100 text-yellow-800' :
                                count.status === 'reddedildi' ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {count.status}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(count.countDate).toLocaleDateString('tr-TR')}
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              <span>Tarih: {new Date(count.countDate).toLocaleDateString('tr-TR')}</span>
                            </div>
                            <div>
                              <span className="font-medium">Miktar:</span> {count.countedQuantity} {material.unit}
                            </div>
                            <div>
                              <span className="font-medium">Sayım Yapan:</span> {count.countedBy}
                            </div>
                            <div>
                              <span className="font-medium">Toplam:</span> ₺{count.totalValue.toFixed(2)}
                            </div>
                          </div>

                          {session && (
                            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                              <div>Oturum No: {session.sessionNo}</div>
                              <div>Periyot: {new Date(session.startDate).toLocaleDateString('tr-TR')} - {new Date(session.endDate).toLocaleDateString('tr-TR')}</div>
                            </div>
                          )}

                          {count.notes && (
                            <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                              <span className="font-medium">Not:</span> {count.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {stockCounts.length > 5 && (
                      <div className="text-center pt-2 border-t">
                        <p className="text-sm text-gray-500">
                          {stockCounts.length - 5} kayıt daha var...
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p>Bu malzeme için henüz sayım kaydı bulunmuyor.</p>
                  </div>
                )}
              </div>

              {stockCounts.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Son Fatura Bilgileri</h4>
                  {(() => {
                    const lastCount = stockCounts[0];
                    const session = getSessionByCountId(lastCount.id);
                    
                    if (session) {
                      return (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium">Fatura No:</span>
                            <span className="font-semibold text-blue-600">{session.invoiceNo}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Son Sayım Tarihi:</span>
                            <span>{new Date(lastCount.countDate).toLocaleDateString('tr-TR')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Sayım Yapan:</span>
                            <span>{lastCount.countedBy}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Sayılan Miktar:</span>
                            <span className="font-semibold">{lastCount.countedQuantity} {material.unit}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Toplam Değer:</span>
                            <span className="font-semibold text-green-600">₺{lastCount.totalValue.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <p className="text-gray-500 text-center py-4">
                        Bu malzeme için fatura bilgisi bulunmuyor.
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-6 rounded-lg font-medium transition-all"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ Excel Import Modal Component
function ExcelImportModal({ onImport, onClose }: { onImport: (materials: any[]) => void; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const templateColumns = [
    'Malzeme Adı',
    'Barkod',
    'GTIN',
    'SN',
    'UDI Code',
    'All Barcode',
    'Kategori',
    'Alt Kategori',
    'Birim',
    'Birim Fiyat',
    'Mevcut Stok',
    'Kritik Stok',
    'Tedarikçi',
    'SKT',
    'Seri No Durumu',
    'Malzeme Açıklama',
    'Statü'
  ];

  const handleDownloadTemplate = () => {
    const templateData = [
      templateColumns,
      [
        'Örnek Malzeme Adı',
        '1234567890123',
        '12345678901234',
        'SN123456789',
        'UDI123456789',
        'ALL123456789',
        'İlaç',
        'Tablet',
        'adet',
        '25.50',
        '100',
        '10',
        'Örnek Tedarikçi',
        '2025-12-31',
        'Aktif',
        'Örnek malzeme açıklaması',
        'normal'
      ]
    ];

    const BOM = '\uFEFF';
    const csvContent = BOM + templateData
      .map(row => row.map(cell => `"${cell}"`).join(';'))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `malzeme_sablonu_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setValidationErrors([]);
      validateFileStructure(selectedFile);
    }
  };

  const validateFileStructure = async (file: File) => {
    try {
      const text = await file.text();
      const cleanText = text.replace(/^\uFEFF/, '');
      const lines = cleanText.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length === 0) {
        setValidationErrors(['Dosya boş veya geçersiz format']);
        return false;
      }

      const headers = lines[0].split(';').map(h => h.replace(/"/g, '').trim());
      
      const errors: string[] = [];

      if (headers.length !== templateColumns.length) {
        errors.push(`Sütun sayısı uyuşmuyor. Beklenen: ${templateColumns.length}, Mevcut: ${headers.length}`);
      }

      templateColumns.forEach((expectedColumn, index) => {
        if (headers[index] !== expectedColumn) {
          errors.push(`${index + 1}. sütun hatası: Beklenen "${expectedColumn}", Mevcut "${headers[index]}"`);
        }
      });

      setValidationErrors(errors);
      return errors.length === 0;
    } catch (error) {
      console.error('Dosya doğrulama hatası:', error);
      setValidationErrors(['Dosya okunurken hata oluştu. Lütfen dosya formatını kontrol edin.']);
      return false;
    }
  };

  const handleImport = async () => {
    if (!file) return;

    const isValid = await validateFileStructure(file);
    if (!isValid) {
      alert('CSV dosyasının yapısı uygun değil. Lütfen şablonu kullanın!');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const text = await file.text();
      const cleanText = text.replace(/^\uFEFF/, '');
      const lines = cleanText.split('\n').filter(line => line.trim() !== '');
      const headers = lines[0].split(';').map(h => h.replace(/"/g, '').trim());
      
      const materials = [];
      const importErrors: string[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(';').map(v => v.replace(/"/g, '').trim());
        const material: any = {};
        
        headers.forEach((header, index) => {
          const value = values[index] || '';
          if (header === 'Malzeme Adı') material.name = value;
          else if (header === 'Barkod') material.barcode = value;
          else if (header === 'GTIN') material.gtin = value;
          else if (header === 'SN') material.sn = value;
          else if (header === 'UDI Code') material.udiCode = value;
          else if (header === 'All Barcode') material.allBarcode = value;
          else if (header === 'Kategori') material.category = value;
          else if (header === 'Alt Kategori') material.subCategory = value;
          else if (header === 'Birim') material.unit = value;
          else if (header === 'Birim Fiyat') material.unitPrice = parseFloat(value.replace(',', '.')) || 0;
          else if (header === 'Mevcut Stok') material.currentStock = parseInt(value) || 0;
          else if (header === 'Kritik Stok') material.minStock = parseInt(value) || 0;
          else if (header === 'Tedarikçi') material.supplier = value;
          else if (header === 'SKT') material.expirationDate = value;
          else if (header === 'Seri No Durumu') material.serialNoStatus = value;
          else if (header === 'Malzeme Açıklama') material.materialDescription = value;
          else if (header === 'Statü') material.status = value || 'normal';
        });

        if (!material.name) {
          importErrors.push(`${i}. satır: Malzeme adı zorunludur`);
          continue;
        }

        if (!material.barcode) {
          material.barcode = `AUTO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        if (!material.unit) material.unit = 'adet';
        if (!material.category) material.category = 'Diğer';
        if (!material.unitPrice) material.unitPrice = 0;
        if (!material.currentStock) material.currentStock = 0;
        if (!material.minStock) material.minStock = 0;
        if (!material.status) material.status = 'normal';

        materials.push(material);
        setImportProgress(Math.round((i / (lines.length - 1)) * 100));
      }

      if (importErrors.length > 0) {
        alert(`İçe aktarma tamamlandı ancak bazı hatalar oluştu:\n\n${importErrors.slice(0, 5).join('\n')}${importErrors.length > 5 ? `\n\n...ve ${importErrors.length - 5} hata daha` : ''}`);
      }

      onImport(materials);
      setImportProgress(100);
      setTimeout(() => {
        onClose();
      }, 1000);
      
    } catch (error) {
      console.error('CSV import error:', error);
      alert('CSV dosyası okunurken hata oluştu!');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-2xl mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Excel/CSV'den Malzeme İçe Aktar</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">Önemli: CSV Şablon Kullanın</h4>
              <p className="text-sm text-blue-700 mb-3">
                Lütfen önce aşağıdaki butondan CSV şablonunu indirin ve bu şablondaki sütunları doldurarak yükleme yapın.
                <br /><strong>Sadece "Malzeme Adı" alanı zorunludur.</strong>
              </p>
              <button
                onClick={handleDownloadTemplate}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all"
              >
                <Download className="h-4 w-4" />
                <span>CSV Şablonunu İndir (.csv)</span>
              </button>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2">Şablon Sütunları:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {templateColumns.map((column, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className={`text-gray-700 ${column === 'Malzeme Adı' ? 'font-bold' : ''}`}>
                      {column} {column === 'Malzeme Adı' && '(Zorunlu)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-3">
                Şablonu doldurduktan sonra buradan yükleyin:
              </p>
              
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  validationErrors.length > 0 
                    ? 'border-red-300 bg-red-50' 
                    : file 
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 bg-white hover:border-blue-500'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {file ? file.name : 'Doldurulmuş CSV dosyasını seçin veya sürükleyin (.csv)'}
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                />
              </div>

              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-3">
                  <h4 className="font-semibold text-red-800 mb-2">Doğrulama Hataları:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {isImporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>İçe aktarılıyor...</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="flex space-x-2 pt-4">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg transition-all"
              >
                İptal
              </button>
              <button
                onClick={handleImport}
                disabled={!file || isImporting || validationErrors.length > 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition-all"
              >
                {isImporting ? 'Aktarılıyor...' : 'İçe Aktar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ Statü Değiştirme Modal Component
function StatusChangeModal({ 
  selectedMaterials, 
  onStatusChange, 
  onClose 
}: { 
  selectedMaterials: Material[];
  onStatusChange: (materialIds: string[], newStatus: MaterialStatus) => void;
  onClose: () => void;
}) {
  const [selectedStatus, setSelectedStatus] = useState<MaterialStatus>('normal');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStatusChange(selectedMaterials.map(m => m.id), selectedStatus);
    onClose();
  };

  const statusOptions: MaterialStatus[] = ['normal', 'konsinye', 'iade', 'faturalı'];

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Malzeme Statüsünü Değiştir</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                {selectedMaterials.length} malzemenin statüsünü değiştireceksiniz.
              </p>
              <div className="max-h-40 overflow-y-auto mb-4">
                {selectedMaterials.slice(0, 10).map((material, index) => (
                  <div key={material.id} className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-sm truncate">{material.name}</span>
                    <span className="text-xs text-gray-500">{material.barcode}</span>
                  </div>
                ))}
                {selectedMaterials.length > 10 && (
                  <div className="text-center text-sm text-gray-500 py-2">
                    ...ve {selectedMaterials.length - 10} malzeme daha
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Yeni Statü *
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as MaterialStatus)}
              >
                {statusOptions.map(status => (
                  <option key={status} value={status}>{status.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-2 px-4 rounded-lg font-medium transition-all shadow-lg hover:shadow-xl"
              >
                Değiştir
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg font-medium transition-all"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ✅ GÜNCELLENMİŞ Malzeme Modal Component
interface MaterialModalProps {
  material?: Material | null;
  categories: Category[];
  suppliers: Supplier[];
  onSave: (material: any) => void;
  onClose: () => void;
  onAddCategory?: (category: Omit<Category, 'id'>) => void;
  onAddSupplier?: (supplier: Omit<Supplier, 'id'>) => void;
}

function MaterialModal({ 
  material, 
  categories, 
  suppliers, 
  onSave, 
  onClose,
  onAddCategory,
  onAddSupplier
}: MaterialModalProps) {
  const [formData, setFormData] = useState({
    name: material?.name || '',
    barcode: material?.barcode || '',
    gtin: material?.gtin || '',
    sn: material?.sn || '',
    udiCode: material?.udiCode || '',
    allBarcode: material?.allBarcode || '',
    category: material?.category || '',
    subCategory: material?.subCategory || '',
    unit: material?.unit || 'adet',
    unitPrice: material?.unitPrice || 0,
    currentStock: material?.currentStock || 0,
    minStock: material?.minStock || 0,
    supplier: material?.supplier || '',
    expirationDate: material?.expirationDate || '',
    serialNoStatus: material?.serialNoStatus || '',
    materialDescription: material?.materialDescription || '',
    intuitiveCode: material?.intuitiveCode || '',
    serialNumber: material?.serialNumber || '',
    status: material?.status || 'normal',
  });

  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [showAddSupplierForm, setShowAddSupplierForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');

  const units = ['adet', 'kutu', 'şişe', 'tüp', 'paket', 'ampul', 'kg', 'lt', 'metre'];
  const statusOptions: MaterialStatus[] = ['normal', 'konsinye', 'iade', 'faturalı'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Lütfen malzeme adı giriniz!');
      return;
    }
    
    if (!formData.barcode.trim()) {
      alert('Lütfen barkod giriniz!');
      return;
    }
    
    if (!formData.gtin.trim()) {
      alert('Lütfen GTIN giriniz!');
      return;
    }
    
    if (!formData.sn.trim()) {
      alert('Lütfen SN giriniz!');
      return;
    }
    
    if (formData.unitPrice <= 0) {
      alert('Lütfen geçerli bir fiyat giriniz!');
      return;
    }
    
    if (formData.currentStock < 0) {
      alert('Lütfen geçerli bir stok miktarı giriniz!');
      return;
    }
    
    if (!formData.supplier.trim()) {
      alert('Lütfen tedarikçi giriniz!');
      return;
    }
    
    if (!formData.status.trim()) {
      alert('Lütfen statü seçiniz!');
      return;
    }

    onSave(formData);
  };

  const handleBarcodeScan = (barcode: string) => {
    setFormData({ ...formData, barcode });
    setShowBarcodeScanner(false);
  };

  const handleAddNewCategory = () => {
    if (newCategoryName.trim() && onAddCategory) {
      const newCategory: Omit<Category, 'id'> = {
        name: newCategoryName.trim(),
        description: '',
        isActive: true,
        createdAt: new Date().toISOString()
      };
      onAddCategory(newCategory);
      setFormData({ ...formData, category: newCategoryName.trim() });
      setNewCategoryName('');
      setShowAddCategoryForm(false);
    }
  };

  const handleAddNewSupplier = () => {
    if (newSupplierName.trim() && onAddSupplier) {
      const newSupplier: Omit<Supplier, 'id'> = {
        name: newSupplierName.trim(),
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        isActive: true,
        createdAt: new Date().toISOString()
      };
      onAddSupplier(newSupplier);
      setFormData({ ...formData, supplier: newSupplierName.trim() });
      setNewSupplierName('');
      setShowAddSupplierForm(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-4xl mx-4">
        <div className="p-6 bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-800">
              {material ? 'Malzeme Bilgilerini Düzenle' : 'Yeni Malzeme Ekle'}
            </h3>
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-full transition-colors"
              title="Kapat"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Malzeme Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="input-modern w-full"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Malzeme adını giriniz"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Barkod <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    required
                    className="input-modern flex-1"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Barkod giriniz"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBarcodeScanner(true)}
                    className="btn-modern whitespace-nowrap"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Tara</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GTIN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="input-modern w-full"
                  value={formData.gtin}
                  onChange={(e) => setFormData({ ...formData, gtin: e.target.value })}
                  placeholder="GTIN numarasını giriniz"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="input-modern w-full"
                  value={formData.sn}
                  onChange={(e) => setFormData({ ...formData, sn: e.target.value })}
                  placeholder="Seri numarasını giriniz"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  UDI Code
                </label>
                <input
                  type="text"
                  className="input-modern w-full"
                  value={formData.udiCode}
                  onChange={(e) => setFormData({ ...formData, udiCode: e.target.value })}
                  placeholder="UDI kodu"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  All Barcode
                </label>
                <input
                  type="text"
                  className="input-modern w-full"
                  value={formData.allBarcode}
                  onChange={(e) => setFormData({ ...formData, allBarcode: e.target.value })}
                  placeholder="Tüm barkodlar"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori
                </label>
                <div className="flex space-x-2">
                  <select
                    className="input-modern flex-1"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">Kategori seçin</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.name}>{category.name}</option>
                    ))}
                  </select>
                </div>
                {onAddCategory && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowAddCategoryForm(true)}
                      className="mt-1 text-xs text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Yeni Kategori Ekle
                    </button>
                    {showAddCategoryForm && (
                      <div className="mt-2 flex space-x-2">
                        <input
                          type="text"
                          className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Yeni kategori adı"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddNewCategory}
                          className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          Ekle
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNewCategoryName('');
                            setShowAddCategoryForm(false);
                          }}
                          className="px-2 py-1 bg-gray-300 rounded text-sm hover:bg-gray-400"
                        >
                          İptal
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alt Kategori
                </label>
                <input
                  type="text"
                  className="input-modern w-full"
                  value={formData.subCategory}
                  onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                  placeholder="Alt kategori (isteğe bağlı)"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mevcut Stok <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  className="input-modern w-full"
                  value={formData.currentStock}
                  onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                  placeholder="Mevcut stok miktarı"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Birim Fiyat (₺) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="input-modern w-full"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                  placeholder="Birim fiyat"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Birim
                </label>
                <select
                  className="input-modern w-full"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                >
                  {units.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kritik Stok
                </label>
                <input
                  type="number"
                  min="0"
                  className="input-modern w-full"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                  placeholder="Kritik stok seviyesi"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tedarikçi <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-2">
                  <select
                    className="input-modern flex-1"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    required
                  >
                    <option value="">Tedarikçi seçin</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.name}>{supplier.name}</option>
                    ))}
                  </select>
                </div>
                {onAddSupplier && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowAddSupplierForm(true)}
                      className="mt-1 text-xs text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Yeni Tedarikçi Ekle
                    </button>
                    {showAddSupplierForm && (
                      <div className="mt-2 flex space-x-2">
                        <input
                          type="text"
                          className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                          value={newSupplierName}
                          onChange={(e) => setNewSupplierName(e.target.value)}
                          placeholder="Yeni tedarikçi adı"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddNewSupplier}
                          className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          Ekle
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNewSupplierName('');
                            setShowAddSupplierForm(false);
                          }}
                          className="px-2 py-1 bg-gray-300 rounded text-sm hover:bg-gray-400"
                        >
                          İptal
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKT
                </label>
                <input
                  type="date"
                  className="input-modern w-full"
                  value={formData.expirationDate}
                  onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seri No Durumu
                </label>
                <select
                  className="input-modern w-full"
                  value={formData.serialNoStatus}
                  onChange={(e) => setFormData({ ...formData, serialNoStatus: e.target.value })}
                >
                  <option value="">Seçiniz</option>
                  <option value="Aktif">Aktif</option>
                  <option value="Pasif">Pasif</option>
                  <option value="İade">İade</option>
                  <option value="Hurda">Hurda</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statü <span className="text-red-500">*</span>
                </label>
                <select
                  className="input-modern w-full"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as MaterialStatus })}
                  required
                >
                  <option value="">Statü seçin</option>
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sezgisel Kod
                </label>
                <input
                  type="text"
                  className="input-modern w-full"
                  value={formData.intuitiveCode}
                  onChange={(e) => setFormData({ ...formData, intuitiveCode: e.target.value })}
                  placeholder="Sezgisel kod"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seri Numarası
                </label>
                <input
                  type="text"
                  className="input-modern w-full"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="Seri numarası"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Malzeme Açıklama
              </label>
              <textarea
                className="input-modern w-full min-h-[80px]"
                value={formData.materialDescription}
                onChange={(e) => setFormData({ ...formData, materialDescription: e.target.value })}
                placeholder="Malzeme açıklaması"
                rows={3}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-800 mb-1">Zorunlu Alanlar</h4>
                  <p className="text-sm text-blue-700">
                    <span className="text-red-500">*</span> işaretli alanlar zorunludur. Lütfen tüm zorunlu alanları doldurun.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-4 border-t border-gray-200">
              <button
                type="submit"
                className="btn-modern flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                {material ? 'Güncelle' : 'Ekle'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-modern-secondary flex-1"
              >
                İptal
              </button>
            </div>
          </form>

          {showBarcodeScanner && (
            <BarcodeScannerModal
              onScan={handleBarcodeScan}
              onClose={() => setShowBarcodeScanner(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ✅ ANA COMPONENT - GÜNCELLENMİŞ VERSİYON
export default function MaterialManagement() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [quickEditMaterial, setQuickEditMaterial] = useState<Material | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [showStatusChangeModal, setShowStatusChangeModal] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showSelectAll, setShowSelectAll] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    message: string;
  }>({ connected: false, message: 'Bağlantı kontrol ediliyor...' });
  const [cacheBuster, setCacheBuster] = useState(Date.now());
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const currentUser = dataService.getCurrentUser();

  // ✅ PostgreSQL bağlantı durumunu kontrol et
  const checkPostgreSQLConnection = async () => {
    const status = await apiService.checkConnection();
    setConnectionStatus(status);
    return status.connected;
  };

  // ✅ Verileri PostgreSQL'den yükle
  const loadData = async () => {
    setIsLoading(true);
    
    try {
      console.log('📡 PostgreSQL veritabanından tüm veriler yükleniyor...');
      
      // Önce bağlantıyı kontrol et
      const isConnected = await checkPostgreSQLConnection();
      
      if (!isConnected) {
        console.error('❌ PostgreSQL bağlantısı kurulamadı!');
        setIsLoading(false);
        return;
      }
      
      // Malzemeleri yükle
      const loadedMaterials = await apiService.getMaterials();
      console.log(`✅ ${loadedMaterials.length} malzeme PostgreSQL'den yüklendi`);
      
      // Yeni eklenen malzemelerin en başa gelmesi için ters sırala
      const sortedMaterials = [...loadedMaterials].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const dateB = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return dateB - dateA; // En yeni en başta
      });
      
      setMaterials(sortedMaterials);
      
      // Kategorileri ve tedarikçileri yükle
      const [loadedCategories, loadedSuppliers] = await Promise.all([
        apiService.getCategories(),
        apiService.getSuppliers()
      ]);
      
      console.log(`✅ ${loadedCategories.length} kategori yüklendi`);
      console.log(`✅ ${loadedSuppliers.length} tedarikçi yüklendi`);
      
      setCategories(loadedCategories);
      setSuppliers(loadedSuppliers);
      
    } catch (error) {
      console.error('❌ PostgreSQL veritabanından veri yükleme hatası:', error);
      
      let errorMessage = 'Veriler yüklenirken hata oluştu!';
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = 'PostgreSQL sunucusuna bağlanılamıyor. Lütfen "npm run server" komutunun çalıştığından emin olun.';
        } else if (error.message.includes('Token bulunamadı')) {
          errorMessage = 'Oturum süresi doldu. Lütfen tekrar giriş yapın.';
          window.location.href = '/login';
        }
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Her 30 saniyede bir bağlantıyı kontrol et
    const connectionCheckInterval = setInterval(async () => {
      await checkPostgreSQLConnection();
    }, 30000);
    
    return () => clearInterval(connectionCheckInterval);
  }, [cacheBuster]);

  const refreshData = () => {
    setCacheBuster(Date.now());
    console.log('🔄 Veriler yenileniyor...');
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setLowStockOnly(false);
    setSelectedStatus('all');
    setSelectedMaterials([]);
    setShowSelectAll(false);
    setCurrentPage(1);
    setSortConfig(null);
  };

  // Sıralama fonksiyonu
  const sortMaterials = (materialsToSort: Material[]) => {
    if (!sortConfig) return materialsToSort;
    
    return [...materialsToSort].sort((a, b) => {
      let aValue: any = a;
      let bValue: any = b;
      
      const keyPath = sortConfig.key.split('.');
      keyPath.forEach(key => {
        aValue = aValue[key];
        bValue = bValue[key];
      });
      
      if (aValue === undefined || aValue === null) aValue = '';
      if (bValue === undefined || bValue === null) bValue = '';
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      if (sortConfig.key.includes('Date') || sortConfig.key.includes('date')) {
        const dateA = new Date(aValue).getTime();
        const dateB = new Date(bValue).getTime();
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const filteredMaterials = sortMaterials(materials.filter(material => {
    const matchesSearch = searchTerm ? 
      material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.gtin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.sn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.udiCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.allBarcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.intuitiveCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.materialDescription?.toLowerCase().includes(searchTerm.toLowerCase())
      : true;

    const matchesCategory = selectedCategory === 'all' || material.category === selectedCategory;
    const matchesLowStock = !lowStockOnly || material.currentStock <= material.minStock;
    const matchesStatus = selectedStatus === 'all' || material.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesLowStock && matchesStatus;
  }));

  const totalPages = Math.ceil(filteredMaterials.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentMaterials = filteredMaterials.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
  };

  // ✅ Yeni malzeme ekle - PostgreSQL'e direkt kaydet
  const handleAddMaterial = async (materialData: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.log('📤 Yeni malzeme PostgreSQL veritabanına ekleniyor...');
      
      // PostgreSQL'e kaydet
      const newMaterial = await apiService.addMaterial(materialData);
      
      // State'i güncelle - yeni malzemeyi en başa ekle
      setMaterials(prev => [newMaterial, ...prev]);
      
      // Sayfayı yenile ve modalı kapat
      setCurrentPage(1);
      setShowAddModal(false);
      
      // Kullanıcıya bilgi ver
      alert(`${materialData.name} malzemesi başarıyla eklendi!\n\nArtık tüm kullanıcılar bu malzemeyi görebilir.`);
      
    } catch (error) {
      console.error('❌ PostgreSQL veritabanına malzeme eklenemedi:', error);
      
      let errorMessage = 'Malzeme eklenirken bir hata oluştu!';
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
      
      alert(errorMessage);
    }
  };

  // ✅ Tedarikçi ekle
  const handleAddSupplier = async (supplierData: Omit<Supplier, 'id'>) => {
    try {
      console.log('📤 PostgreSQL veritabanına tedarikçi ekleniyor...');
      
      // PostgreSQL'e kaydet
      const newSupplier = await apiService.addSupplier(supplierData);
      
      // State'i güncelle
      setSuppliers(prev => [...prev, newSupplier]);
      
      // Modalı kapat
      setShowAddSupplierModal(false);
      
      // Kullanıcıya bilgi ver
      alert(`${supplierData.name} tedarikçisi başarıyla eklendi!\n\nArtık tüm kullanıcılar bu tedarikçiyi görebilir.`);
      
    } catch (error) {
      console.error('❌ PostgreSQL veritabanına tedarikçi eklenemedi:', error);
      alert('Tedarikçi eklenirken bir hata oluştu!');
    }
  };

  // ✅ Kategori ekle
  const handleAddCategory = async (categoryData: Omit<Category, 'id'>) => {
    try {
      console.log('📤 PostgreSQL veritabanına kategori ekleniyor...');
      
      // PostgreSQL'e kaydet
      const newCategory = await apiService.addCategory(categoryData);
      
      // State'i güncelle
      setCategories(prev => [...prev, newCategory]);
      
      // Modalı kapat
      setShowAddCategoryModal(false);
      
      // Kullanıcıya bilgi ver
      alert(`${categoryData.name} kategorisi başarıyla eklendi!\n\nArtık tüm kullanıcılar bu kategoriyi görebilir.`);
      
    } catch (error) {
      console.error('❌ PostgreSQL veritabanına kategori eklenemedi:', error);
      alert('Kategori eklenirken bir hata oluştu!');
    }
  };

  // ✅ Malzeme güncelle - PostgreSQL'e direkt kaydet
  const handleUpdateMaterial = async (id: string, updates: Partial<Material>) => {
    try {
      console.log('✏️ PostgreSQL veritabanında malzeme güncelleniyor...');
      
      // PostgreSQL'de güncelle
      await apiService.updateMaterial(id, updates);
      
      // State'i güncelle
      setMaterials(prev => prev.map(m => 
        m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
      ));
      
      setEditingMaterial(null);
      setQuickEditMaterial(null);
      
      alert('Malzeme başarıyla güncellendi!\n\nDeğişiklikler tüm kullanıcılarda görünecek.');
    } catch (error) {
      console.error('❌ PostgreSQL veritabanında malzeme güncellenemedi:', error);
      alert('Malzeme güncellenirken bir hata oluştu!');
    }
  };

  // ✅ Toplu güncelleme
  const handleBulkUpdate = async (materialIds: string[], updates: { field: string; value: any }[]) => {
    try {
      console.log('✏️ PostgreSQL veritabanında toplu malzeme güncelleniyor...');
      
      const updateData: any = {};
      updates.forEach(edit => {
        updateData[edit.field] = edit.value;
      });
      
      // PostgreSQL'de toplu güncelle
      await apiService.bulkUpdateMaterials(materialIds, updateData);
      
      // State'i güncelle
      setMaterials(prev => prev.map(m => 
        materialIds.includes(m.id) 
          ? { ...m, ...updateData, updatedAt: new Date().toISOString() }
          : m
      ));
      
      setSelectedMaterials([]);
      setShowSelectAll(false);
      
      alert(`${materialIds.length} malzeme başarıyla güncellendi!\n\nDeğişiklikler tüm kullanıcılarda görünecek.`);
    } catch (error) {
      console.error('❌ PostgreSQL veritabanında toplu güncelleme hatası:', error);
      alert('Toplu güncelleme yapılırken bir hata oluştu!');
    }
  };

  // ✅ Toplu statü değişikliği
  const handleBulkStatusChange = async (materialIds: string[], newStatus: MaterialStatus) => {
    try {
      console.log('✏️ PostgreSQL veritabanında toplu statü değişikliği...');
      
      // PostgreSQL'de toplu güncelle
      await apiService.bulkUpdateMaterials(materialIds, { status: newStatus });
      
      // State'i güncelle
      setMaterials(prev => prev.map(m => 
        materialIds.includes(m.id) 
          ? { ...m, status: newStatus, updatedAt: new Date().toISOString() }
          : m
      ));
      
      setSelectedMaterials([]);
      setShowSelectAll(false);
      
      alert(`${materialIds.length} malzemenin statüsü başarıyla değiştirildi!\n\nDeğişiklikler tüm kullanıcılarda görünecek.`);
    } catch (error) {
      console.error('❌ PostgreSQL veritabanında toplu statü değişikliği hatası:', error);
      alert('Statü değişikliği yapılırken bir hata oluştu!');
    }
  };

  // ✅ Malzeme sil - PostgreSQL'den direkt sil
  const handleDeleteMaterial = async (id: string) => {
    const material = materials.find(m => m.id === id);
    if (confirm(`"${material?.name}" malzemesini silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz ve malzeme tüm kullanıcılardan kaldırılacaktır.`)) {
      try {
        console.log('🗑️ PostgreSQL veritabanından malzeme siliniyor...');
        
        // PostgreSQL'den sil
        await apiService.deleteMaterial(id);
        
        // State'den sil
        setMaterials(prev => prev.filter(m => m.id !== id));
        
        alert('Malzeme başarıyla silindi!\n\nMalzeme tüm kullanıcılardan kaldırıldı.');
      } catch (error) {
        console.error('❌ PostgreSQL veritabanından malzeme silinemedi:', error);
        alert('Malzeme silinirken bir hata oluştu!');
      }
    }
  };

  const handleBarcodeScan = (barcode: string) => {
    setSearchTerm(barcode);
    setShowBarcodeScanner(false);
    setCurrentPage(1);
    
    const foundMaterial = materials.find(m => 
      m.barcode === barcode ||
      m.gtin === barcode ||
      m.sn === barcode ||
      m.udiCode === barcode ||
      m.allBarcode === barcode
    );
    if (foundMaterial) {
      setSelectedMaterial(foundMaterial);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handleMaterialClick = (material: Material) => {
    setSelectedMaterial(material);
  };

  const handleQuickEditClick = (material: Material, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickEditMaterial(material);
  };

  const handleMaterialSelect = (materialId: string, checked: boolean) => {
    if (checked) {
      setSelectedMaterials([...selectedMaterials, materialId]);
    } else {
      setSelectedMaterials(selectedMaterials.filter(id => id !== materialId));
    }
  };

  const handleSelectAll = () => {
    if (showSelectAll) {
      setSelectedMaterials([]);
      setShowSelectAll(false);
    } else {
      const allIds = currentMaterials.map(m => m.id);
      setSelectedMaterials(allIds);
      setShowSelectAll(true);
    }
  };

  const handleExportExcel = () => {
    const headers = [
      'Barkod',
      'GTIN',
      'SN',
      'UDI Code',
      'All Barcode',
      'Malzeme',
      'Sezgisel Kod',
      'Statü',
      'SKT',
      'Seri No Durumu',
      'Malzeme Açıklama',
      'Kategori',
      'Alt Kategori',
      'Birim',
      'Birim Fiyat',
      'Mevcut Stok',
      'Kritik Stok',
      'Tedarikçi'
    ];
    
    const data = filteredMaterials.map(material => [
      material.barcode,
      material.gtin || '',
      material.sn || '',
      material.udiCode || '',
      material.allBarcode || '',
      material.name,
      material.intuitiveCode || '',
      material.status || 'normal',
      material.expirationDate || '',
      material.serialNoStatus || '',
      material.materialDescription || material.name,
      material.category,
      material.subCategory,
      material.unit,
      material.unitPrice.toFixed(2),
      material.currentStock.toString(),
      material.minStock.toString(),
      material.supplier
    ]);
    
    const BOM = '\uFEFF';
    const csvContent = BOM + [headers, ...data]
      .map(row => row.map(cell => `"${cell}"`).join(';'))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `malzemeler_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExcelImport = async (importedMaterials: any[]) => {
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Kullanıcıya bilgi ver
    if (!confirm(`${importedMaterials.length} malzeme içe aktarılacak.\n\nBu işlem biraz zaman alabilir. Devam etmek istiyor musunuz?`)) {
      return;
    }

    for (const material of importedMaterials) {
      try {
        // PostgreSQL'e her malzemeyi tek tek ekle
        await apiService.addMaterial(material);
        successCount++;
        
        // İlerleme durumunu göster
        if (successCount % 10 === 0) {
          console.log(`📊 ${successCount} malzeme başarıyla aktarıldı...`);
        }
      } catch (error) {
        errorCount++;
        errors.push(`${material.name || 'Bilinmeyen'}: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
        
        if (errors.length <= 5) {
          console.error('❌ Malzeme aktarılamadı:', material, error);
        }
      }
    }

    // Verileri yeniden yükle
    await loadData();
    
    setCurrentPage(1);
    setShowExcelImport(false);
    
    // Sonuçları göster
    let message = `${successCount} malzeme başarıyla içe aktarıldı.`;
    if (errorCount > 0) {
      message += ` ${errorCount} malzeme aktarılamadı.`;
      if (errors.length > 0) {
        message += `\n\nHatalar:\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          message += `\n...ve ${errors.length - 5} hata daha`;
        }
      }
    }
    
    alert(message);
  };

  const getStockStatusBadge = (material: Material) => {
    if (material.currentStock === 0) {
      return <span className="material-status-badge bg-red-100 text-red-800">Stok Yok</span>;
    } else if (material.currentStock <= material.minStock) {
      return <span className="material-status-badge bg-yellow-100 text-yellow-800">Kritik Stok</span>;
    } else {
      return <span className="material-status-badge bg-green-100 text-green-800">Yeterli Stok</span>;
    }
  };

  const getStatusBadge = (status: MaterialStatus) => {
    const colors = {
      normal: 'bg-green-100 text-green-800',
      konsinye: 'bg-blue-100 text-blue-800',
      iade: 'bg-red-100 text-red-800',
      faturalı: 'bg-purple-100 text-purple-800'
    };
    
    return (
      <span className={`material-status-badge ${colors[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig && sortConfig.key === key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }
    
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUp className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />;
    }
    
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-3 w-3 text-blue-600" />
      : <ArrowDown className="h-3 w-3 text-blue-600" />;
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`pagination-button ${currentPage === i ? 'active' : ''}`}
        >
          {i}
        </button>
      );
    }
    
    return pages;
  };

  return (
    <div className="material-grid-layout cache-buster">
      {/* Üst Bar */}
      <div className="material-toolbar">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-bold text-gray-800">📦 Malzeme Yönetimi</h2>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Package className="h-4 w-4" />
            <span>Toplam: <span className="font-semibold">{filteredMaterials.length}</span></span>
            <div className={`flex items-center space-x-1 ${
              connectionStatus.connected ? 'text-green-600' : 'text-red-600'
            }`}>
              {connectionStatus.connected ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">✅ PostgreSQL Aktif</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  <span className="font-medium">{connectionStatus.message}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={refreshData}
            className="btn-modern-secondary text-sm"
            title="Verileri PostgreSQL'den Yenile"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Yenile</span>
          </button>
          <button
            onClick={() => setShowAddCategoryModal(true)}
            className="btn-modern-secondary text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Kategori Ekle</span>
          </button>
          <button
            onClick={() => setShowAddSupplierModal(true)}
            className="btn-modern-secondary text-sm"
          >
            <Building className="h-4 w-4" />
            <span>Tedarikçi Ekle</span>
          </button>
          <button
            onClick={() => setShowExcelImport(true)}
            className="btn-modern-secondary text-sm"
          >
            <Upload className="h-4 w-4" />
            <span>Excel İçe Aktar</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="btn-modern-secondary text-sm"
          >
            <Download className="h-4 w-4" />
            <span>Excel İndir</span>
          </button>
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="btn-modern-secondary text-sm"
          >
            <Camera className="h-4 w-4" />
            <span>Barkod Tara</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-modern text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Yeni Malzeme</span>
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">PostgreSQL veritabanından veriler yükleniyor...</p>
          <p className="text-sm text-gray-500 mt-2">
            {materials.length} malzeme yüklendi - Gerçek Zamanlı Senkronizasyon Aktif
          </p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Arama ve Filtreler */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="material-search-bar">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Malzeme adı, barkod, GTIN, SN, kategori veya tedarikçi ara..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all">Tüm Kategoriler</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.name}>{category.name}</option>
                  ))}
                </select>
                
                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="all">Tüm Statüler</option>
                  <option value="normal">Normal</option>
                  <option value="konsinye">Konsinye</option>
                  <option value="iade">İade</option>
                  <option value="faturalı">Faturalı</option>
                </select>
                
                <label className="flex items-center space-x-2 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-200 text-sm cursor-pointer hover:bg-yellow-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={lowStockOnly}
                    onChange={(e) => setLowStockOnly(e.target.checked)}
                    className="rounded text-yellow-600 focus:ring-yellow-500 h-4 w-4"
                  />
                  <span className="text-yellow-800 font-medium">Kritik Stok</span>
                </label>
                
                <button
                  type="submit"
                  className="btn-modern text-sm"
                >
                  <Search className="h-4 w-4" />
                  <span>Ara</span>
                </button>
                
                {(searchTerm || selectedCategory !== 'all' || lowStockOnly || selectedStatus !== 'all') && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-sm text-gray-600 hover:text-gray-800 flex items-center space-x-1"
                  >
                    <X className="h-4 w-4" />
                    <span>Filtreleri Temizle</span>
                  </button>
                )}
              </div>
              
              {selectedMaterials.length > 0 && (
                <div className="material-bulk-actions">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-blue-800 text-sm">
                        {selectedMaterials.length} malzeme seçildi
                      </span>
                    </div>
                    
                    {(currentUser.role === 'admin' || currentUser.permissions.manageMaterials) && (
                      <button
                        onClick={() => setShowBulkEditModal(true)}
                        className="btn-modern text-sm"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span>Toplu Düzenle (Fiyat/Stok)</span>
                      </button>
                    )}
                    
                    <button
                      onClick={() => setShowStatusChangeModal(true)}
                      className="btn-modern text-sm"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span>Statü Değiştir</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setSelectedMaterials([]);
                        setShowSelectAll(false);
                      }}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Seçimi Temizle
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Tablo Container */}
          <div className="material-table-container">
            <div className="material-table-scroll-hint">
              <div className="flex items-center justify-center space-x-2 text-blue-800 text-sm">
                <MoveHorizontal className="h-4 w-4 animate-pulse" />
                <span className="font-medium">Sağa kaydırarak tüm sütunları görebilirsiniz</span>
                <ArrowRight className="h-4 w-4 animate-pulse" />
              </div>
            </div>

            <div className="material-table-wrapper" ref={tableContainerRef}>
              <table className="material-table">
                <thead>
                  <tr>
                    <th className="sticky-left" style={{ width: '50px' }}>
                      <div className="column-header">
                        <button
                          onClick={handleSelectAll}
                          className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 transition-colors"
                          title={showSelectAll ? "Tümünü Kaldır" : "Tümünü Seç"}
                        >
                          {showSelectAll ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '150px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('barcode')}
                        >
                          <span className="column-header-text">Barkod</span>
                          {getSortIcon('barcode')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '120px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('gtin')}
                        >
                          <span className="column-header-text">GTIN</span>
                          {getSortIcon('gtin')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '120px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('sn')}
                        >
                          <span className="column-header-text">SN</span>
                          {getSortIcon('sn')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '120px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('udiCode')}
                        >
                          <span className="column-header-text">UDI Code</span>
                          {getSortIcon('udiCode')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '140px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('allBarcode')}
                        >
                          <span className="column-header-text">All Barcode</span>
                          {getSortIcon('allBarcode')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '200px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('name')}
                        >
                          <span className="column-header-text">Malzeme</span>
                          {getSortIcon('name')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '120px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('intuitiveCode')}
                        >
                          <span className="column-header-text">Sezgisel Kod</span>
                          {getSortIcon('intuitiveCode')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '100px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('status')}
                        >
                          <span className="column-header-text">Statü</span>
                          {getSortIcon('status')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '120px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('category')}
                        >
                          <span className="column-header-text">Kategori</span>
                          {getSortIcon('category')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '120px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('subCategory')}
                        >
                          <span className="column-header-text">Alt Kategori</span>
                          {getSortIcon('subCategory')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '80px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('unit')}
                        >
                          <span className="column-header-text">Birim</span>
                          {getSortIcon('unit')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '100px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('unitPrice')}
                        >
                          <span className="column-header-text">Birim Fiyat</span>
                          {getSortIcon('unitPrice')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '100px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('currentStock')}
                        >
                          <span className="column-header-text">Mevcut Stok</span>
                          {getSortIcon('currentStock')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '100px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('minStock')}
                        >
                          <span className="column-header-text">Kritik Stok</span>
                          {getSortIcon('minStock')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '120px' }}>
                      <div className="column-header">
                        <span className="column-header-text">Stok Durumu</span>
                      </div>
                    </th>
                    
                    <th style={{ width: '150px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('supplier')}
                        >
                          <span className="column-header-text">Tedarikçi</span>
                          {getSortIcon('supplier')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '100px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('expirationDate')}
                        >
                          <span className="column-header-text">SKT</span>
                          {getSortIcon('expirationDate')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '140px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('serialNoStatus')}
                        >
                          <span className="column-header-text">Seri No Durumu</span>
                          {getSortIcon('serialNoStatus')}
                        </button>
                      </div>
                    </th>
                    
                    <th style={{ width: '200px' }}>
                      <div className="column-header">
                        <button 
                          className="column-header-button group"
                          onClick={() => handleSort('materialDescription')}
                        >
                          <span className="column-header-text">Açıklama</span>
                          {getSortIcon('materialDescription')}
                        </button>
                      </div>
                    </th>
                    
                    <th className="sticky-right" style={{ width: '120px' }}>
                      <div className="column-header">
                        <span className="column-header-text">İşlemler</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                
                <tbody>
                  {currentMaterials.map((material, index) => (
                    <tr key={material.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="sticky-left">
                        <input
                          type="checkbox"
                          checked={selectedMaterials.includes(material.id)}
                          onChange={(e) => handleMaterialSelect(material.id, e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                      </td>
                      
                      <td>
                        <div className="group relative">
                          <button
                            onClick={(e) => handleQuickEditClick(material, e)}
                            className="flex items-center space-x-2 hover:text-blue-600 transition-colors text-left w-full"
                          >
                            <Barcode className="h-3 w-3 text-gray-400 flex-shrink-0" />
                            <span className="font-mono text-sm column-cell">
                              {material.barcode}
                            </span>
                          </button>
                        </div>
                      </td>
                      
                      <td>
                        <span className="font-mono text-sm column-cell">
                          {material.gtin || '-'}
                        </span>
                      </td>
                      
                      <td>
                        <div className="group relative">
                          <span className="font-mono text-sm column-cell">
                            {material.sn || '-'}
                          </span>
                        </div>
                      </td>
                      
                      <td>
                        <span className="font-mono text-sm column-cell">
                          {material.udiCode || '-'}
                        </span>
                      </td>
                      
                      <td>
                        <span className="font-mono text-sm column-cell">
                          {material.allBarcode || '-'}
                        </span>
                      </td>
                      
                      <td>
                        <div className="group relative">
                          <button
                            onClick={() => handleMaterialClick(material)}
                            className="flex items-center space-x-2 hover:text-blue-600 transition-colors text-left w-full"
                          >
                            <Package className="h-3 w-3 text-gray-400 flex-shrink-0" />
                            <span className="font-medium text-sm column-cell">
                              {material.name}
                            </span>
                          </button>
                        </div>
                      </td>
                      
                      <td>
                        <div className="group relative">
                          <span className="text-gray-600 text-sm column-cell">
                            {material.intuitiveCode || '-'}
                          </span>
                        </div>
                      </td>
                      
                      <td>
                        {getStatusBadge(material.status || 'normal')}
                      </td>
                      
                      <td>
                        <span className="text-sm text-gray-600 column-cell">
                          {material.category}
                        </span>
                      </td>
                      
                      <td>
                        <span className="text-sm text-gray-600 column-cell">
                          {material.subCategory || '-'}
                        </span>
                      </td>
                      
                      <td>
                        <span className="text-sm text-gray-600 column-cell">
                          {material.unit}
                        </span>
                      </td>
                      
                      <td>
                        <span className="text-sm font-medium text-gray-700 column-cell">
                          ₺{material.unitPrice.toFixed(2)}
                        </span>
                      </td>
                      
                      <td>
                        <span className={`text-sm font-medium column-cell ${
                          material.currentStock === 0 ? 'text-red-600' :
                          material.currentStock <= material.minStock ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {material.currentStock}
                        </span>
                      </td>
                      
                      <td>
                        <span className="text-sm text-gray-600 column-cell">
                          {material.minStock}
                        </span>
                      </td>
                      
                      <td>
                        {getStockStatusBadge(material)}
                      </td>
                      
                      <td>
                        <span className="text-sm text-gray-600 column-cell">
                          {material.supplier || '-'}
                        </span>
                      </td>
                      
                      <td>
                        {material.expirationDate ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            <span className="text-sm">{material.expirationDate}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      
                      <td>
                        <span className="text-sm text-gray-600 column-cell">
                          {material.serialNoStatus || '-'}
                        </span>
                      </td>
                      
                      <td>
                        <span className="text-sm text-gray-600 column-cell truncate" title={material.materialDescription || ''}>
                          {material.materialDescription || '-'}
                        </span>
                      </td>
                      
                      <td className="sticky-right">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleMaterialClick(material)}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            title="Detayları Görüntüle"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingMaterial(material)}
                            className="p-1 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 rounded transition-colors"
                            title="Tam Düzenle"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMaterial(material.id)}
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Sil"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  
                  {currentMaterials.length === 0 && (
                    <tr>
                      <td colSpan={21} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <Package className="h-16 w-16 text-gray-300 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">Malzeme bulunamadı</h3>
                          <p className="text-gray-500 text-sm mb-4 max-w-md">
                            {searchTerm || selectedCategory !== 'all' || lowStockOnly || selectedStatus !== 'all'
                              ? 'Arama kriterlerinize uygun malzeme bulunamadı.'
                              : 'Henüz hiç malzeme eklenmemiş. İlk malzemeyi eklemek için "Yeni Malzeme" butonunu kullanın.'
                            }
                          </p>
                          {(searchTerm || selectedCategory !== 'all' || lowStockOnly || selectedStatus !== 'all') && (
                            <button
                              onClick={clearAllFilters}
                              className="btn-modern"
                            >
                              Filtreleri Temizle
                            </button>
                          )}
                          {!searchTerm && selectedCategory === 'all' && !lowStockOnly && selectedStatus === 'all' && (
                            <button
                              onClick={() => setShowAddModal(true)}
                              className="btn-modern"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              İlk Malzemeyi Ekle
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alt Bar - Sayfalama */}
          <div className="pagination-container">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Gösterilen: <span className="font-semibold">
                  {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredMaterials.length)}
                </span> / <span className="font-semibold">{filteredMaterials.length}</span>
                {selectedMaterials.length > 0 && (
                  <span className="ml-3 text-blue-600 font-semibold">
                    {selectedMaterials.length} seçili
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="pagination-button"
                  title="İlk Sayfa"
                >
                  «
                </button>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="pagination-button"
                  title="Önceki Sayfa"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                {renderPageNumbers()}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="pagination-button"
                  title="Sonraki Sayfa"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="pagination-button"
                  title="Son Sayfa"
                >
                  »
                </button>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Kritik Stok: <span className="font-semibold text-red-600">
                  {filteredMaterials.filter(m => m.currentStock <= m.minStock).length}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Sayfa başı:</span>
                <select
                  className="page-size-selector"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modaller */}
      {(showAddModal || editingMaterial) && (
        <MaterialModal
          material={editingMaterial}
          categories={categories}
          suppliers={suppliers}
          onSave={editingMaterial ? 
            (updates) => handleUpdateMaterial(editingMaterial.id, updates) : 
            handleAddMaterial
          }
          onAddCategory={handleAddCategory}
          onAddSupplier={handleAddSupplier}
          onClose={() => {
            setShowAddModal(false);
            setEditingMaterial(null);
          }}
        />
      )}

      {showAddSupplierModal && (
        <AddSupplierModal
          onSave={handleAddSupplier}
          onClose={() => setShowAddSupplierModal(false)}
        />
      )}

      {showAddCategoryModal && (
        <AddCategoryModal
          onSave={handleAddCategory}
          onClose={() => setShowAddCategoryModal(false)}
        />
      )}

      {showBarcodeScanner && (
        <BarcodeScannerModal
          onScan={handleBarcodeScan}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {showExcelImport && (
        <ExcelImportModal
          onImport={handleExcelImport}
          onClose={() => setShowExcelImport(false)}
        />
      )}

      {selectedMaterial && (
        <MaterialDetailsModal
          material={selectedMaterial}
          onClose={() => setSelectedMaterial(null)}
        />
      )}

      {quickEditMaterial && (
        <QuickEditModal
          material={quickEditMaterial}
          onSave={(updates) => handleUpdateMaterial(quickEditMaterial.id, updates)}
          onClose={() => setQuickEditMaterial(null)}
        />
      )}

      {showStatusChangeModal && (
        <StatusChangeModal
          selectedMaterials={materials.filter(m => selectedMaterials.includes(m.id))}
          onStatusChange={handleBulkStatusChange}
          onClose={() => setShowStatusChangeModal(false)}
        />
      )}

      {showBulkEditModal && (
        <BulkEditModal
          selectedMaterials={materials.filter(m => selectedMaterials.includes(m.id))}
          onSave={handleBulkUpdate}
          onClose={() => setShowBulkEditModal(false)}
        />
      )}
    </div>
  );
}