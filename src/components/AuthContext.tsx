// AuthContext.tsx - GÜNCELLENMİŞ VERSİYON
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { dataServiceSQL } from '../utils/dataServiceSQL'; // PostgreSQL servisini kullan

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: keyof User['permissions']) => boolean;
  canViewPage: (page: string) => boolean;
  canEditPage: (page: string) => boolean;
  canDeletePage: (page: string) => boolean;
  canAddToPage: (page: string) => boolean;
  refreshUser: () => void;
  hasFullAccess: (page: string) => boolean;
  getRoleDisplayName: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      
      // 1. Önce localStorage'dan token'ı kontrol et
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (token && userStr) {
        try {
          const parsedUser = JSON.parse(userStr);
          setUser(parsedUser);
          setIsAuthenticated(true);
          console.log('✅ Kullanıcı localStorage\'dan yüklendi:', parsedUser.email);
        } catch (error) {
          console.error('❌ User parse error:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      
      // 2. Backend'den kullanıcı bilgisini al (token varsa)
      if (token) {
        try {
          const currentUser = await dataServiceSQL.getCurrentUser();
          if (currentUser && currentUser.id !== 'guest') {
            setUser(currentUser);
            setIsAuthenticated(true);
            localStorage.setItem('user', JSON.stringify(currentUser));
            console.log('✅ Kullanıcı backend\'den yüklendi:', currentUser.email);
          }
        } catch (error) {
          console.warn('⚠️ Backend kullanıcı bilgisi alınamadı:', error);
          // Token geçersiz olabilir, temizle
          if (error.message.includes('Oturum süresi doldu')) {
            logout();
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string, rememberMe?: boolean): Promise<boolean> => {
    try {
      console.log('🔐 Login attempt:', email);
      
      const result = await dataServiceSQL.login(email, password);
      
      if (result.success && result.token && result.user) {
        // Token ve user bilgisini kaydet
        dataServiceSQL.setToken(result.token);
        setUser(result.user);
        setIsAuthenticated(true);
        
        // Remember me
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email);
        } else {
          localStorage.removeItem('rememberedEmail');
        }
        
        console.log('✅ Login successful:', email);
        return true;
      } else {
        console.error('❌ Login failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    dataServiceSQL.clearToken();
    localStorage.removeItem('user');
    localStorage.removeItem('rememberedEmail');
    console.log('👋 Logout successful');
  };

  // Diğer fonksiyonlar aynı kalabilir...
  const hasPermission = (permission: keyof User['permissions']): boolean => {
    if (!user) return false;
    return user.permissions[permission] || false;
  };

  const canViewPage = (page: string): boolean => {
    if (!user) return false;
    // ... (mevcut kod aynı)
  };

  // Diğer yetki fonksiyonları...

  const refreshUser = async () => {
    await checkAuthStatus();
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated,
    hasPermission,
    canViewPage,
    canEditPage,
    canDeletePage,
    canAddToPage,
    refreshUser,
    hasFullAccess: (page: string) => user?.role === 'admin' || false,
    getRoleDisplayName: () => {
      if (!user) return '';
      switch (user.role) {
        case 'admin': return 'Sistem Yöneticisi';
        case 'manager': return 'Yönetici';
        case 'doctor': return 'Doktor';
        case 'staff': return 'Personel';
        case 'viewer': return 'Gözlemci';
        default: return user.role;
      }
    }
  };

  if (loading) {
    return <div>Yükleniyor...</div>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};