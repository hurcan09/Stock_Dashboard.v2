// src/components/AuthContext.tsx - POSTGRESQL ENTEGRASYONLU
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User as UserType } from '../types';
import { dataServiceSQL } from '../utils/dataServiceSQL';

interface AuthContextType {
  user: UserType | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  canViewPage: (pageId: string) => boolean;
  getRoleDisplayName: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserType | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (token && userStr) {
        try {
          const userData = JSON.parse(userStr);
          setUser(userData);
          setIsAuthenticated(true);
          dataServiceSQL.setToken(token);
          console.log('✅ Auth durumu kontrol edildi:', userData.name);
        } catch (error) {
          console.error('❌ User parse hatası:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } else {
        // Token yoksa PostgreSQL'den mevcut kullanıcıyı al
        try {
          const currentUser = await dataServiceSQL.getCurrentUser();
          if (currentUser && currentUser.id !== 'guest') {
            setUser(currentUser);
            setIsAuthenticated(true);
            console.log('✅ PostgreSQL kullanıcısı alındı:', currentUser.name);
          }
        } catch (error) {
          console.error('❌ PostgreSQL kullanıcısı alınamadı:', error);
        }
      }
    } catch (error) {
      console.error('❌ Auth durumu kontrol hatası:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('🔐 PostgreSQL giriş yapılıyor:', email);
      
      const result = await dataServiceSQL.login(email, password);
      
      if (result.success && result.token && result.user) {
        setUser(result.user);
        setIsAuthenticated(true);
        
        // Token ve user bilgilerini localStorage'a kaydet
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        
        console.log('✅ PostgreSQL giriş başarılı:', result.user.name);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('❌ Giriş hatası:', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await dataServiceSQL.logout();
    } catch (error) {
      console.error('❌ Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
      console.log('👋 Çıkış yapıldı');
    }
  };

  const canViewPage = (pageId: string): boolean => {
    if (!user) return false;

    // Sayfa yetki kontrolleri
    const pagePermissions: Record<string, keyof UserType['permissions']> = {
      'dashboard': 'viewDashboard',
      'materials': 'manageMaterials',
      'stock-count': 'createSession',
      'patients': 'managePatients',
      'invoices': 'manageInvoices',
      'reports': 'viewReports',
      'users': 'manageUsers',
      'doctors': 'managePatients', // Doktorlar için hasta yönetimi yetkisi
      'daily-plan': 'manageDailyPlan'
    };

    const requiredPermission = pagePermissions[pageId];
    
    if (!requiredPermission) {
      return true; // Yetki gerektirmeyen sayfalar
    }

    return user.permissions?.[requiredPermission] || false;
  };

  const getRoleDisplayName = (): string => {
    if (!user) return 'Misafir';

    switch (user.role) {
      case 'admin': return 'Sistem Yöneticisi';
      case 'manager': return 'Yönetici';
      case 'doctor': return 'Doktor';
      case 'staff': return 'Personel';
      case 'viewer': return 'Gözlemci';
      default: return user.role;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      login,
      logout,
      checkAuthStatus,
      canViewPage,
      getRoleDisplayName
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};