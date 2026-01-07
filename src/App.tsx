// src/App.tsx - POSTGRESQL GÜNCELLEMESİ
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MaterialManagement from './components/MaterialManagement';
import StockCountManagement from './components/StockCountManagement';
import PatientManagement from './components/PatientManagement';
import InvoiceManagement from './components/InvoiceManagement';
import Reports from './components/Reports';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Anasayfa from './components/Anasayfa';
import DoctorManagement from './components/DoctorManagement';
import UserManagement from './components/UserManagement';
import { AuthProvider, useAuth } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { dataServiceSQL } from './utils/dataServiceSQL';

// Ana uygulama bileşeni
function AppContent() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { user, isAuthenticated, logout, checkAuthStatus } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    message: string;
  }>({ connected: false, message: 'PostgreSQL bağlantısı kontrol ediliyor...' });

  useEffect(() => {
    console.log('🔄 App component yüklendi');
    
    const initializeApp = async () => {
      try {
        // PostgreSQL bağlantısını kontrol et
        const healthCheck = await dataServiceSQL.healthCheck();
        const isConnected = healthCheck.status === 'OK' && healthCheck.database === 'Connected';
        
        setDbStatus({
          connected: isConnected,
          message: isConnected 
            ? '✅ PostgreSQL bağlantısı başarılı' 
            : '❌ PostgreSQL bağlantısı yok'
        });

        if (!isConnected) {
          console.warn('⚠️ PostgreSQL bağlantısı yok! Demo moda geçiliyor...');
        }

        // Auth durumunu kontrol et
        await checkAuthStatus();

      } catch (error) {
        console.error('❌ Uygulama başlatma hatası:', error);
        setDbStatus({
          connected: false,
          message: '❌ PostgreSQL sunucusuna bağlanılamıyor'
        });
      } finally {
        setLoading(false);
      }
    };

    initializeApp();

    // Her 30 saniyede bir bağlantıyı kontrol et
    const interval = setInterval(async () => {
      try {
        const healthCheck = await dataServiceSQL.healthCheck();
        const isConnected = healthCheck.status === 'OK' && healthCheck.database === 'Connected';
        
        setDbStatus({
          connected: isConnected,
          message: isConnected 
            ? '✅ PostgreSQL bağlantısı başarılı' 
            : '❌ PostgreSQL bağlantısı yok'
        });
      } catch (error) {
        console.error('❌ Bağlantı kontrol hatası:', error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [checkAuthStatus]);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Anasayfa />;
      case 'materials':
        return (
          <div className="h-full">
            <MaterialManagement />
          </div>
        );
      case 'stock-count':
        return <StockCountManagement />;
      case 'patients':
        return <PatientManagement />;
      case 'invoices':
        return <InvoiceManagement />;
      case 'reports':
        return <Reports />;
      case 'users':
        return <UserManagement />;
      case 'doctors':
        return <DoctorManagement />;
      case 'daily-plan':
        return <div className="p-8">Günlük Plan (Yapım aşamasında)</div>;
      default:
        return <Anasayfa />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-24 w-24 border-b-2 border-orange-500"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
              <svg 
                className="h-8 w-8 text-white" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="text-2xl font-bold text-white mt-6 mb-2">
          Osmangazi Göz Stok Takip Sistemi
        </div>
        <div className="text-orange-300 mb-4">
          PostgreSQL bağlantısı kuruluyor...
        </div>
        <div className={`px-4 py-2 rounded-lg ${
          dbStatus.connected 
            ? 'bg-green-900/30 text-green-300 border border-green-800/50' 
            : 'bg-red-900/30 text-red-300 border border-red-800/50'
        }`}>
          {dbStatus.message}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const AuthComponent = Auth as React.FC<{ onLogin: (user: any) => void }>;
    return (
      <AuthComponent 
        onLogin={() => {
          // Login olduktan sonra sayfayı yenile
          window.location.reload();
        }} 
      />
    );
  }

  return (
    <Layout
      currentPage={currentPage}
      onPageChange={setCurrentPage}
      dbStatus={dbStatus}
    >
      {renderPage()}
    </Layout>
  );
}

// Ana App bileşeni
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={
            <div className="min-h-screen">
              <Auth onLogin={() => {}} />
            </div>
          } />
          
          <Route path="/" element={
            <ProtectedRoute>
              <AppContent />
            </ProtectedRoute>
          } />
          
          {/* Diğer route'lar için de ProtectedRoute kullanabilirsiniz */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;