import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import { AuthProvider } from './components/AuthContext';
import InventoryPanel, { api, type Inventory } from './InventoryPanel';

function AppContent() {
  const [page,setPage]=useState('dashboard');
  const [data,setData]=useState<Inventory>();
  const [error,setError]=useState('');
  async function reload(){setData(await api('inventory'));}
  useEffect(()=>{reload().catch(e=>setError(e.message));},[]);
  return <Layout currentPage={page} onPageChange={setPage} inventory={data}>
    {data?<InventoryPanel key={page} page={page} data={data} reload={reload} navigate={setPage}/>:<p role="status">{error||'Yükleniyor…'}</p>}
  </Layout>;
}
export default function App(){return <AuthProvider><AppContent/></AuthProvider>;}
