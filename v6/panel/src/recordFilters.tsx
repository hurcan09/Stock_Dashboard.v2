import type { Inventory, Product } from './InventoryPanel';

export const dayKey = (date: string) => new Intl.DateTimeFormat('sv-SE', {
  timeZone:'Europe/Istanbul', year:'numeric', month:'2-digit', day:'2-digit'
}).format(new Date(date));

export function contains(value: string, query: string) {
  const normalized=(s:string)=>s.trim().normalize('NFC').toLocaleLowerCase('tr');
  return normalized(value).includes(normalized(query));
}

export function matchesProduct(product: Pick<Product,'name'> & Partial<Product>, query: string) {
  return [product.name,product.barcode,product.sku,product.gtin,product.serial].some(value=>contains(value||'',query));
}

export function Period({mode,setMode,period,setPeriod}:{mode:string;setMode:(v:string)=>void;period:string;setPeriod:(v:string)=>void}){
 return <>
  <label>Dönem <select value={mode} onChange={e=>{setMode(e.target.value);setPeriod('');}}><option value="day">Gün</option><option value="month">Ay</option><option value="year">Yıl</option></select></label>
  <label>{mode==='day'?'Gün seç':mode==='month'?'Ay seç':'Yıl seç (takvim)'}<input aria-label={mode==='year'?'Yıl seçmek için takvimden bir tarih seç':'Takvim'} type={mode==='month'?'month':'date'} value={period} onChange={e=>setPeriod(e.target.value)}/></label>
 </>;
}

export function RecordFilters({branches,branch,setBranch,mode,setMode,period,setPeriod,search,setSearch,children}:{
  branches:Inventory['branches'];branch:string;setBranch:(v:string)=>void;
  mode:string;setMode:(v:string)=>void;period:string;setPeriod:(v:string)=>void;
  search:string;setSearch:(v:string)=>void;children?:React.ReactNode;
}){
 return <div className="report-box report-filters">
  <label>Şube <select value={branch} onChange={e=>setBranch(e.target.value)}><option value="">Tüm yetkili şubeler</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
  <Period mode={mode} setMode={setMode} period={period} setPeriod={setPeriod}/>
  {children}
  <label>Malzeme <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ürün adı, barkod veya stok kodu"/></label>
 </div>;
}
