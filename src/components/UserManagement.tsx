import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Edit,
  Trash2,
  Power,
  Shield,
  CheckCircle,
  XCircle,
  X,
  Info,
  Database,
  RefreshCw,
  Activity,
  UserCheck
} from 'lucide-react';
import { User, UserSession } from '../types';

// PostgreSQL API Client
const API_BASE = 'http://localhost:5000/api';

// Token'ı localStorage'dan al
const getToken = () => {
  return localStorage.getItem('token') || '';
};

// PostgreSQL API Client
const apiClient = {
  async getUsers(): Promise<User[]> {
    const token = getToken();
    try {
      const response = await fetch(`${API_BASE}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (Array.isArray(result)) {
        return result.map((item: any) => ({
          id: item.id.toString(),
          username: item.username || item.email.split('@')[0],
          email: item.email,
          password: item.password || '',
          name: item.name,
          phone: item.phone || '',
          department: item.department || '',
          role: item.role || 'user',
          permissions: item.permissions || {
            viewDashboard: true,
            viewReports: true
          },
          avatarColor: item.avatarColor || '#4F46E5',
          isActive: item.isActive !== false,
          lastLogin: item.lastLogin,
          lastLoginIp: item.lastLoginIp || '',
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString()
        }));
      }
      
      return [];
    } catch (error) {
      console.error('❌ Kullanıcılar yüklenemedi:', error);
      throw error;
    }
  },

  async createUser(userData: any): Promise<User> {
    const token = getToken();
    try {
      console.log('📤 PostgreSQL\'e kullanıcı ekleniyor:', userData.email);
      
      const postgresUser = {
        name: userData.name.trim(),
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        username: userData.email.split('@')[0],
        phone: userData.phone || '',
        department: userData.department || '',
        role: userData.role || 'staff',
        permissions: userData.permissions || {
          viewDashboard: true,
          viewReports: true
        },
        isActive: true
      };

      const response = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postgresUser)
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Kullanıcı oluşturma hatası:', response.status, errorText);
        
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || 'Kullanıcı oluşturulamadı');
        } catch {
          throw new Error(`Kullanıcı oluşturulamadı: ${response.status}`);
        }
      }
      
      const result = await response.json();
      
      if (!result.id) {
        throw new Error(result.error || 'Kullanıcı oluşturulamadı');
      }
      
      console.log('✅ PostgreSQL kullanıcı oluşturuldu:', result);
      
      return {
        id: result.id.toString(),
        username: result.username || userData.email.split('@')[0],
        email: result.email || userData.email,
        password: '',
        name: result.name || userData.name,
        phone: result.phone || userData.phone || '',
        department: result.department || userData.department || '',
        role: result.role || userData.role || 'staff',
        permissions: result.permissions || userData.permissions,
        avatarColor: result.avatarColor || '#4F46E5',
        isActive: true,
        lastLogin: null,
        lastLoginIp: '',
        createdAt: result.createdAt || new Date().toISOString(),
        updatedAt: result.updatedAt || new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ PostgreSQL kullanıcı oluşturma hatası:', error);
      throw error;
    }
  },

  async updateUser(id: string, updates: any): Promise<User> {
    const token = getToken();
    try {
      const response = await fetch(`${API_BASE}/users/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Kullanıcı güncellenemedi');
      }
      
      const result = await response.json();
      
      return {
        id: result.id.toString(),
        username: result.username || '',
        email: result.email || '',
        password: '',
        name: result.name || updates.name,
        phone: result.phone || updates.phone || '',
        department: result.department || updates.department || '',
        role: result.role || updates.role,
        permissions: result.permissions || updates.permissions,
        avatarColor: result.avatarColor || '#4F46E5',
        isActive: result.isActive !== false,
        lastLogin: result.lastLogin || null,
        lastLoginIp: result.lastLoginIp || '',
        createdAt: result.createdAt || new Date().toISOString(),
        updatedAt: result.updatedAt || new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ PostgreSQL kullanıcı güncelleme hatası:', error);
      throw error;
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    const token = getToken();
    try {
      const response = await fetch(`${API_BASE}/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Kullanıcı silinemedi');
      }
      
      const result = await response.json();
      return result.success === true || result.message !== undefined;
    } catch (error) {
      console.error('❌ PostgreSQL kullanıcı silme hatası:', error);
      throw error;
    }
  },

  async changePassword(userId: string, newPassword: string): Promise<boolean> {
    const token = getToken();
    try {
      const response = await fetch(`${API_BASE}/users/${userId}/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: newPassword })
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu');
      }
      
      return response.ok;
    } catch (error) {
      console.error('❌ Şifre değiştirme hatası:', error);
      throw error;
    }
  },

  async getActiveSessions(): Promise<UserSession[]> {
    const token = getToken();
    try {
      const response = await fetch(`${API_BASE}/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        return [];
      }
      
      const result = await response.json();
      return result.success ? result.data : [];
    } catch (error) {
      console.error('❌ Oturumlar yüklenemedi:', error);
      return [];
    }
  },

  async terminateSession(sessionId: number): Promise<boolean> {
    const token = getToken();
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('❌ Oturum sonlandırma hatası:', error);
      return false;
    }
  }
};

// Database Status Component
const DatabaseStatus: React.FC<{ 
  isConnected: boolean; 
  message: string;
  onRefresh?: () => void;
}> = ({ isConnected, message, onRefresh }) => {
  return (
    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium ${
      isConnected 
        ? 'bg-green-100 text-green-800 border border-green-200' 
        : 'bg-red-100 text-red-800 border border-red-200'
    }`}>
      {isConnected ? (
        <>
          <Database className="h-3.5 w-3.5" />
          <span>PostgreSQL: Aktif</span>
        </>
      ) : (
        <>
          <Database className="h-3.5 w-3.5" />
          <span>PostgreSQL: Bağlantı Yok</span>
        </>
      )}
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="ml-1 p-1 hover:opacity-80 transition-opacity"
          title="Bağlantıyı yenile"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

// Benzersiz kullanıcıları son giriş tarihine göre filtreleme fonksiyonu
const getUniqueUsersByLastLogin = (users: User[]): User[] => {
  const uniqueUsers = new Map<string, User>();
  
  users.forEach(user => {
    const existingUser = uniqueUsers.get(user.email);
    if (!existingUser || (user.lastLogin && (!existingUser.lastLogin || new Date(user.lastLogin) > new Date(existingUser.lastLogin)))) {
      uniqueUsers.set(user.email, user);
    }
  });
  
  return Array.from(uniqueUsers.values());
};

// Son giriş zamanını formatlayan fonksiyon
const formatLastLogin = (dateString?: string | Date): string => {
  if (!dateString) return 'Hiç giriş yapmadı';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) {
    return 'Az önce';
  } else if (diffMins < 60) {
    return `${diffMins} dakika önce`;
  } else if (diffHours < 24) {
    return `${diffHours} saat önce`;
  } else if (diffDays < 7) {
    return `${diffDays} gün önce`;
  } else {
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
};

// User Management Component
export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [uniqueFilteredUsers, setUniqueFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    message: string;
  }>({
    connected: false,
    message: 'PostgreSQL bağlantısı kontrol ediliyor...'
  });
  
  // Kullanıcı düzenleme modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'staff' as User['role'],
    department: '',
    phone: '',
    isActive: true
  });

  // Şifre değiştirme modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  // Yeni kullanıcı modal state
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'staff' as User['role'],
    department: '',
    phone: '',
    showPassword: false
  });

  // Yetki yönetimi modal state
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionUser, setPermissionUser] = useState<User | null>(null);
  const [permissionForm, setPermissionForm] = useState({
    manageMaterials: false,
    managePatients: false,
    manageInvoices: false,
    manageUsers: false,
    viewDashboard: true,
    importExcel: false,
    manageDailyPlan: false,
    viewReports: true
  });

  // Aktif oturumlar state
  const [activeSessions, setActiveSessions] = useState<UserSession[]>([]);
  
  // Sistem logları state
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  // Seçili kullanıcılar
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // PostgreSQL bağlantısını kontrol et
  const checkPostgreSQLConnection = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();
      
      const isConnected = data.status === 'OK' && data.database === 'Connected';
      
      setDbStatus({
        connected: isConnected,
        message: isConnected 
          ? '✅ PostgreSQL bağlantısı başarılı' 
          : '❌ PostgreSQL bağlantısı yok'
      });

      return isConnected;
    } catch (error) {
      console.error('❌ PostgreSQL bağlantı kontrolü başarısız:', error);
      setDbStatus({
        connected: false,
        message: '❌ PostgreSQL sunucusuna bağlanılamıyor'
      });
      return false;
    }
  }, []);

  // Verileri yükle
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      // Önce PostgreSQL bağlantısını kontrol et
      const isConnected = await checkPostgreSQLConnection();
      
      if (!isConnected) {
        setError('PostgreSQL bağlantısı yok! Kullanıcı yönetimi için PostgreSQL bağlantısı gerekiyor.');
        setLoading(false);
        return;
      }

      console.log('📡 PostgreSQL kullanıcı verileri yükleniyor...');
      const allUsers = await apiClient.getUsers();
      console.log('✅ PostgreSQL kullanıcıları yüklendi:', allUsers.length);
      
      setUsers(allUsers);
      setFilteredUsers(allUsers);
      setUniqueFilteredUsers(getUniqueUsersByLastLogin(allUsers));
      
      // Aktif oturumları yükle
      const sessions = await apiClient.getActiveSessions();
      setActiveSessions(sessions);
      
      // Demo log verileri
      setActivityLogs([
        {
          performedBy: 'Sistem Yöneticisi',
          details: 'Yeni kullanıcı oluşturuldu: Ahmet Yılmaz',
          action: 'CREATE',
          performedAt: new Date(Date.now() - 3600000)
        },
        {
          performedBy: 'Doktor Mehmet',
          details: 'Hasta kaydı güncellendi: Fatma Çelik',
          action: 'UPDATE',
          performedAt: new Date(Date.now() - 7200000)
        },
        {
          performedBy: 'Personel Ayşe',
          details: 'Malzeme stoğu güncellendi: Katarakt Lens',
          action: 'UPDATE',
          performedAt: new Date(Date.now() - 10800000)
        }
      ]);
      
    } catch (err: any) {
      console.error('❌ PostgreSQL veri yükleme hatası:', err);
      setError('PostgreSQL veritabanından veriler yüklenemedi: ' + (err.message || 'Bilinmeyen hata'));
      
      // Token kontrolü
      const token = localStorage.getItem('token');
      if (err.message.includes('401') || err.message.includes('Oturum süresi doldu')) {
        setError('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  }, [checkPostgreSQLConnection]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Arama ve filtreleme
  useEffect(() => {
    let result = users;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(user =>
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.department?.toLowerCase().includes(term) ||
        user.phone?.toLowerCase().includes(term)
      );
    }
    
    if (filterRole !== 'all') {
      result = result.filter(user => user.role === filterRole);
    }
    
    if (filterStatus !== 'all') {
      result = result.filter(user => 
        filterStatus === 'active' ? user.isActive : !user.isActive
      );
    }
    
    setFilteredUsers(result);
    setUniqueFilteredUsers(getUniqueUsersByLastLogin(result));
  }, [users, searchTerm, filterRole, filterStatus]);

  // Yeni kullanıcı oluşturma - PostgreSQL'e kaydet
  const handleCreateUser = async () => {
    // Validasyon
    if (!newUserForm.name.trim()) {
      setError('Lütfen ad soyad giriniz');
      return;
    }
    
    if (!newUserForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserForm.email)) {
      setError('Lütfen geçerli bir email adresi giriniz');
      return;
    }
    
    if (newUserForm.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return;
    }
    
    if (newUserForm.password !== newUserForm.confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // PostgreSQL için kullanıcı verisi oluştur
      const userData = {
        name: newUserForm.name.trim(),
        email: newUserForm.email.trim().toLowerCase(),
        password: newUserForm.password,
        role: newUserForm.role,
        department: newUserForm.department.trim() || '',
        phone: newUserForm.phone.trim() || '',
        permissions: {
          createSession: newUserForm.role === 'admin' || newUserForm.role === 'manager',
          approveCounts: newUserForm.role === 'admin' || newUserForm.role === 'manager',
          manageMaterials: newUserForm.role === 'admin',
          managePatients: newUserForm.role !== 'viewer',
          manageInvoices: newUserForm.role === 'admin',
          viewReports: true,
          manageUsers: newUserForm.role === 'admin',
          manageSettings: newUserForm.role === 'admin',
          bulkStatusChange: newUserForm.role === 'admin',
          quickCount: newUserForm.role === 'admin' || newUserForm.role === 'manager',
          exportData: newUserForm.role === 'admin' || newUserForm.role === 'manager',
          viewDashboard: true,
          importExcel: newUserForm.role === 'admin' || newUserForm.role === 'manager',
          manageDailyPlan: newUserForm.role === 'admin' || newUserForm.role === 'manager'
        }
      };

      console.log('📤 PostgreSQL\'e yeni kullanıcı gönderiliyor:', userData.email);
      
      // PostgreSQL'e kaydet
      const newUser = await apiClient.createUser(userData);
      
      console.log('✅ PostgreSQL kullanıcı oluşturuldu:', newUser.email);
      
      // Başarı mesajı
      setSuccess(`${newUser.name} PostgreSQL veritabanına başarıyla eklendi!`);
      
      // Formu temizle
      setNewUserForm({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'staff',
        department: '',
        phone: '',
        showPassword: false
      });
      
      // Modal'ı kapat
      setShowNewUserModal(false);
      
      // Verileri yenile
      await loadData();
      
      // 5 saniye sonra başarı mesajını temizle
      setTimeout(() => setSuccess(''), 5000);
      
    } catch (err: any) {
      console.error('❌ PostgreSQL kullanıcı oluşturma hatası:', err);
      
      let errorMessage = 'Kullanıcı oluşturulamadı!';
      
      if (err.message.includes('Bu email adresi zaten kayıtlı')) {
        errorMessage = '❌ Bu email adresi zaten başka bir kullanıcıda kullanılıyor!';
      } else if (err.message.includes('Oturum süresi doldu')) {
        errorMessage = '❌ Oturum süresi doldu. Lütfen tekrar giriş yapın.';
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        errorMessage = `❌ ${err.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Kullanıcı düzenleme
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || '',
      phone: user.phone || '',
      isActive: user.isActive
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    setLoading(true);
    setError('');
    
    try {
      const updatedUser = await apiClient.updateUser(editingUser.id, editForm);
      
      setSuccess(`${updatedUser.name} PostgreSQL'de başarıyla güncellendi`);
      setShowEditModal(false);
      await loadData();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Şifre değiştirme
  const handleChangePassword = (user: User) => {
    setPasswordUser(user);
    setPasswordForm({
      newPassword: '',
      confirmPassword: ''
    });
    setShowPasswordModal(true);
  };

  const handleUpdatePassword = async () => {
    if (!passwordUser) return;
    
    if (passwordForm.newPassword.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const success = await apiClient.changePassword(passwordUser.id, passwordForm.newPassword);
      
      if (success) {
        setSuccess(`${passwordUser.name} şifresi PostgreSQL'de değiştirildi`);
        setShowPasswordModal(false);
        setPasswordForm({
          newPassword: '',
          confirmPassword: ''
        });
        
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error('Şifre değiştirilemedi');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Kullanıcı durumunu değiştirme
  const handleToggleUserStatus = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    if (window.confirm(`${user.name} kullanıcısının durumunu PostgreSQL'de ${user.isActive ? 'pasif' : 'aktif'} yapmak istiyor musunuz?`)) {
      try {
        await apiClient.updateUser(userId, { isActive: !user.isActive });
        setSuccess(`${user.name} PostgreSQL durumu ${!user.isActive ? 'aktif' : 'pasif'} yapıldı`);
        await loadData();
        
        setTimeout(() => setSuccess(''), 3000);
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  // Kullanıcı silme
  const handleDeleteUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    if (window.confirm(`${user.name} kullanıcısını PostgreSQL veritabanından silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!`)) {
      try {
        const success = await apiClient.deleteUser(userId);
        if (success) {
          setSuccess(`${user.name} PostgreSQL'den başarıyla silindi`);
          await loadData();
          
          setTimeout(() => setSuccess(''), 3000);
        }
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  // Yetki düzenleme
  const handleEditPermissions = (user: User) => {
    setPermissionUser(user);
    setPermissionForm({
      manageMaterials: user.permissions?.manageMaterials || false,
      managePatients: user.permissions?.managePatients || false,
      manageInvoices: user.permissions?.manageInvoices || false,
      manageUsers: user.permissions?.manageUsers || false,
      viewDashboard: user.permissions?.viewDashboard !== false,
      importExcel: user.permissions?.importExcel || false,
      manageDailyPlan: user.permissions?.manageDailyPlan || false,
      viewReports: user.permissions?.viewReports !== false
    });
    setShowPermissionModal(true);
  };

  const handleUpdatePermissions = async () => {
    if (!permissionUser) return;
    
    setLoading(true);
    setError('');
    
    try {
      await apiClient.updateUser(permissionUser.id, { permissions: permissionForm });
      
      setSuccess(`${permissionUser.name} yetkileri güncellendi`);
      setShowPermissionModal(false);
      await loadData();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Oturum yönetimi
  const handleTerminateSession = async (sessionId: number, userName: string) => {
    if (window.confirm(`${userName} kullanıcısının oturumunu sonlandırmak istiyor musunuz?`)) {
      try {
        const success = await apiClient.terminateSession(sessionId);
        if (success) {
          setSuccess('Oturum sonlandırıldı');
          await loadData();
          
          setTimeout(() => setSuccess(''), 3000);
        }
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  const handleTerminateAllSessions = async () => {
    if (window.confirm('Tüm aktif oturumları sonlandırmak istiyor musunuz?')) {
      try {
        // Tüm oturumları teker teker sonlandır
        const terminatePromises = activeSessions.map(session => 
          apiClient.terminateSession(session.id)
        );
        
        await Promise.all(terminatePromises);
        setSuccess('Tüm oturumlar sonlandırıldı');
        await loadData();
        
        setTimeout(() => setSuccess(''), 3000);
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  // Yardımcı fonksiyonlar
  const getRoleColor = (role: User['role']) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'doctor': return 'bg-green-100 text-green-800';
      case 'staff': return 'bg-orange-100 text-orange-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: User['role']) => {
    switch (role) {
      case 'admin': return 'Sistem Yöneticisi';
      case 'manager': return 'Yönetici';
      case 'doctor': return 'Doktor';
      case 'staff': return 'Personel';
      case 'viewer': return 'Gözlemci';
      default: return role;
    }
  };

  // Seçim işlemleri
  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === uniqueFilteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(uniqueFilteredUsers.map(user => user.id));
    }
  };

  // Filtreleri temizle
  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterRole('all');
    setFilterStatus('all');
  };

  // PostgreSQL bağlantısını yenile
  const handleRefreshConnection = async () => {
    await checkPostgreSQLConnection();
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Hata ve Başarı Mesajları */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Yükleme durumu */}
      {loading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
            <span>PostgreSQL verileri yükleniyor...</span>
          </div>
        </div>
      )}

      {/* Başlık ve İstatistikler */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">PostgreSQL Kullanıcı Yönetimi</h1>
            <p className="text-blue-200">PostgreSQL kullanıcılarını yönetin ve yetkileri düzenleyin</p>
          </div>
          <div className="flex items-center space-x-4">
            <DatabaseStatus 
              isConnected={dbStatus.connected} 
              message={dbStatus.message}
              onRefresh={handleRefreshConnection}
            />
            <div className="text-center">
              <div className="text-2xl font-bold">{uniqueFilteredUsers.length}</div>
              <div className="text-sm text-blue-300">PostgreSQL Kullanıcı</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{users.length}</div>
              <div className="text-sm text-blue-300">Toplam Kayıt</div>
            </div>
          </div>
        </div>
      </div>

      {/* Kontrol Paneli */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Arama */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="PostgreSQL kullanıcı ara..."
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!dbStatus.connected}
            />
          </div>

          {/* Filtreler */}
          <div className="flex gap-2">
            <select
              className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              disabled={!dbStatus.connected}
            >
              <option value="all">Tüm Roller</option>
              <option value="admin">Yönetici</option>
              <option value="manager">Müdür</option>
              <option value="doctor">Doktor</option>
              <option value="staff">Personel</option>
              <option value="viewer">Gözlemci</option>
            </select>

            <select
              className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              disabled={!dbStatus.connected}
            >
              <option value="all">Tüm Durumlar</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>

            <button
              onClick={handleClearFilters}
              className="px-4 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors flex items-center"
              disabled={!dbStatus.connected}
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>

        {!dbStatus.connected && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center">
              <Database className="h-5 w-5 text-red-600 mr-2" />
              <p className="text-red-700">
                PostgreSQL bağlantısı yok! Kullanıcı yönetimi için PostgreSQL veritabanına bağlı olmalısınız.
                <br />
                <button
                  onClick={handleRefreshConnection}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium underline"
                >
                  Bağlantıyı yeniden dene
                </button>
              </p>
            </div>
          </div>
        )}

        {/* PostgreSQL Bağlantı Bilgisi */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center text-sm text-blue-700">
            <Info className="h-4 w-4 mr-2" />
            <span>
              PostgreSQL veritabanındaki kullanıcılar yönetilmektedir. 
              Yeni kullanıcılar PostgreSQL'e kaydedilir ve doğrudan giriş yapabilirler.
            </span>
          </div>
        </div>

        {/* Kullanıcı Listesi */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-4 px-6 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === uniqueFilteredUsers.length && uniqueFilteredUsers.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-orange-600 rounded"
                    disabled={!dbStatus.connected}
                  />
                </th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-gray-900">PostgreSQL Kullanıcı</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-gray-900">Rol</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-gray-900">Departman</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-gray-900">Durum</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-gray-900">Son Giriş</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-gray-900">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {uniqueFilteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleSelectUser(user.id)}
                      className="h-4 w-4 text-orange-600 rounded"
                    />
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white font-bold text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        {user.phone && (
                          <p className="text-xs text-gray-500">{user.phone}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex px-3 py-1.5 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-gray-700">{user.department || '-'}</span>
                  </td>
                  <td className="py-4 px-6">
                    <button
                      onClick={() => handleToggleUserStatus(user.id)}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        user.isActive
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {user.isActive ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Aktif
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Pasif
                        </>
                      )}
                    </button>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm">
                      <div className="text-gray-900 font-medium">
                        {formatLastLogin(user.lastLogin)}
                      </div>
                      {user.lastLogin && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(user.lastLogin).toLocaleDateString('tr-TR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Düzenle"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditPermissions(user)}
                        className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Yetkileri Düzenle"
                      >
                        <Shield className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleChangePassword(user)}
                        className="p-2 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 rounded-lg transition-colors"
                        title="Şifre Değiştir"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {uniqueFilteredUsers.length === 0 && !loading && (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-700 font-medium">Kullanıcı bulunamadı</p>
              <p className="text-gray-500 text-sm mt-1">Arama kriterlerinize uygun kullanıcı bulunamadı</p>
            </div>
          )}
        </div>

        {/* Yeni Kullanıcı Butonu */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setShowNewUserModal(true)}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center shadow-lg hover:shadow-xl"
            disabled={!dbStatus.connected}
          >
            <UserPlus className="h-5 w-5 mr-3" />
            Yeni Kullanıcı Ekle
          </button>
        </div>
      </div>

      {/* Aktif Oturumlar ve Son Aktiviteler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aktif Oturumlar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <UserCheck className="h-5 w-5 mr-2 text-orange-600" />
              Aktif Oturumlar ({activeSessions.length})
            </h3>
            <button
              onClick={handleTerminateAllSessions}
              className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center"
            >
              <Power className="h-4 w-4 mr-1" />
              Tümünü Sonlandır
            </button>
          </div>
          
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
            {activeSessions.slice(0, 5).map((session) => (
              <div key={session.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{session.userName}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="capitalize">{session.userRole}</span>
                      <span className="mx-2">•</span>
                      {session.deviceInfo?.browser || 'Tarayıcı bilinmiyor'}
                      <span className="mx-2">•</span>
                      {session.deviceInfo?.os || 'OS bilinmiyor'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleTerminateSession(session.id, session.userName)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                    title="Oturumu Sonlandır"
                  >
                    <Power className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  <span>IP: {session.ipAddress || 'Bilinmiyor'}</span>
                  <span className="mx-2">•</span>
                  <span>Giriş: {formatLastLogin(session.loginTime)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Son Aktiviteler */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-orange-600" />
              Son Aktiviteler
            </h3>
            <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">
              Son 10 aktivite
            </span>
          </div>
          
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
            {activityLogs.map((log, index) => (
              <div key={index} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{log.performedBy}</p>
                    <p className="text-sm text-gray-700 mt-1">{log.details}</p>
                  </div>
                  <div className="text-right ml-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      log.action.includes('CREATE') ? 'bg-green-100 text-green-800' :
                      log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-800' :
                      log.action.includes('DELETE') ? 'bg-red-100 text-red-800' :
                      log.action.includes('LOGIN') ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {log.action}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatLastLogin(log.performedAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Yeni Kullanıcı Modal */}
      {showNewUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <UserPlus className="h-5 w-5 mr-2 text-orange-600" />
                  Yeni Kullanıcı Ekle
                </h2>
                <button
                  onClick={() => setShowNewUserModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ad Soyad *
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm({...newUserForm, name: e.target.value})}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Şifre * (min. 6 karakter)
                    </label>
                    <input
                      type={newUserForm.showPassword ? "text" : "password"}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Şifre Tekrar *
                    </label>
                    <input
                      type={newUserForm.showPassword ? "text" : "password"}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      value={newUserForm.confirmPassword}
                      onChange={(e) => setNewUserForm({...newUserForm, confirmPassword: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showPassword"
                    className="h-4 w-4 text-orange-600 rounded"
                    checked={newUserForm.showPassword}
                    onChange={(e) => setNewUserForm({...newUserForm, showPassword: e.target.checked})}
                  />
                  <label htmlFor="showPassword" className="ml-2 text-sm text-gray-600">
                    Şifreyi göster
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rol *
                    </label>
                    <select
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value as User['role']})}
                      required
                    >
                      <option value="staff">Personel</option>
                      <option value="manager">Yönetici</option>
                      <option value="admin">Sistem Yöneticisi</option>
                      <option value="doctor">Doktor</option>
                      <option value="viewer">Gözlemci</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Departman
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      value={newUserForm.department}
                      onChange={(e) => setNewUserForm({...newUserForm, department: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    value={newUserForm.phone}
                    onChange={(e) => setNewUserForm({...newUserForm, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleCreateUser}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  {loading ? 'Ekleniyor...' : 'Kullanıcı Ekle'}
                </button>
                <button
                  onClick={() => setShowNewUserModal(false)}
                  className="flex-1 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-xl font-medium transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Düzenleme Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Edit className="h-5 w-5 mr-2 text-orange-600" />
                  Kullanıcıyı Düzenle
                </h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ad Soyad
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    value={editForm.email}
                    onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rol
                    </label>
                    <select
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      value={editForm.role}
                      onChange={(e) => setEditForm({...editForm, role: e.target.value as User['role']})}
                    >
                      <option value="staff">Personel</option>
                      <option value="manager">Yönetici</option>
                      <option value="admin">Sistem Yöneticisi</option>
                      <option value="doctor">Doktor</option>
                      <option value="viewer">Gözlemci</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Durum
                    </label>
                    <select
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      value={editForm.isActive ? 'active' : 'inactive'}
                      onChange={(e) => setEditForm({...editForm, isActive: e.target.value === 'active'})}
                    >
                      <option value="active">Aktif</option>
                      <option value="inactive">Pasif</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Departman
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    value={editForm.department}
                    onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleUpdateUser}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  {loading ? 'Güncelleniyor...' : 'Güncelle'}
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-xl font-medium transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Yetki Yönetimi Modal */}
      {showPermissionModal && permissionUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-orange-600" />
                  Yetki Yönetimi: {permissionUser.name}
                </h2>
                <button
                  onClick={() => setShowPermissionModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {Object.entries(permissionForm).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      {key === 'manageMaterials' && 'Malzeme Yönetimi'}
                      {key === 'managePatients' && 'Hasta Yönetimi'}
                      {key === 'manageInvoices' && 'Fatura Yönetimi'}
                      {key === 'manageUsers' && 'Kullanıcı Yönetimi'}
                      {key === 'viewDashboard' && 'Dashboard Görüntüleme'}
                      {key === 'importExcel' && 'Excel Import'}
                      {key === 'manageDailyPlan' && 'Günlük Plan Yönetimi'}
                      {key === 'viewReports' && 'Rapor Görüntüleme'}
                    </label>
                    <button
                      onClick={() => setPermissionForm({
                        ...permissionForm,
                        [key]: !value
                      })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        value ? 'bg-orange-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          value ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-blue-50 rounded-xl">
                <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                  <Info className="h-4 w-4 mr-2" />
                  Bilgi
                </h4>
                <p className="text-sm text-blue-600">
                  Yetkiler değişiklikleri anında uygulanır. Kullanıcının mevcut oturumu varsa,
                  değişiklikler yeni oturum açıldığında geçerli olacaktır.
                </p>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleUpdatePermissions}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  {loading ? 'Kaydediliyor...' : 'Yetkileri Güncelle'}
                </button>
                <button
                  onClick={() => setShowPermissionModal(false)}
                  className="flex-1 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-xl font-medium transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Şifre Değiştirme Modal */}
      {showPasswordModal && passwordUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Power className="h-5 w-5 mr-2 text-orange-600" />
                  Şifre Değiştir: {passwordUser.name}
                </h2>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Yeni Şifre (min. 6 karakter)
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Yeni Şifre Tekrar
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleUpdatePassword}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  {loading ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
                </button>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-xl font-medium transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}