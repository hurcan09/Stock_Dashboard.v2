import type { Task } from './Operations';
import { useEffect, useRef, useState } from 'react';
import Layout from './components/Layout';
import { AuthProvider } from './components/AuthContext';
import InventoryPanel, { api, type Inventory } from './InventoryPanel';

function AppContent() {
  const [page,setPage]=useState('dashboard');
  const [task,setTask]=useState<Task>();
  const [data,setData]=useState<Inventory>();
  const [error,setError]=useState('');
  async function reload(){setData(await api('inventory'));}
  useEffect(()=>{reload().catch(e=>setError(e.message));},[]);
  const lastPage=useRef('');
  useEffect(()=>{if(lastPage.current===page)return;lastPage.current=page;void api('activities',{page}).catch(()=>{});},[page]);
  return <Layout currentPage={page} onPageChange={next=>{setTask(undefined);setPage(next);void reload().catch(()=>{});}} inventory={data}>
    {data?<InventoryPanel key={page} page={page} data={data} reload={reload} task={task} startTask={item=>{setTask(item);setPage('stock-count');}}/>:<p role="status">{error||'Yükleniyor…'}</p>}
  </Layout>;
}
export default function App(){return <AuthProvider><AppContent/></AuthProvider>;}
