import InvoicePage from './InvoicePage';
import { RecordFilters, dayKey, matchesProduct } from './recordFilters';
import ReportAnalytics from './ReportAnalytics';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

export type Product = { id:string; name:string; branch:string; sku:string; barcode?:string; gtin?:string; serial?:string; category?:string; subcategory?:string; unit?:string; createdAt?:string; quantity:number; minimum:number; price:number };
export type Line = Partial<Product> & { id:string; name:string; quantity:number; price:number; actual:number; expected:number; valuationPrice?:number };
type RecordBase = { id:string; branch:string; date:string; lines:Line[] };
export type Invoice = RecordBase & {number:string; supplier:string};
type Count = RecordBase & {title:string;authorName:string};
type Role = 'owner'|'manager'|'employee';
export type Inventory = {company:string;role:Role;branches:{id:string;name:string}[];products:Product[];invoices:Invoice[];counts:Count[]};
type Person = {id:string;name:string;email:string;role:Role;branch:string|null};
const roles={owner:'Patron',manager:'Yönetici',employee:'Çalışan'};
const input='mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5';
const button='rounded-lg bg-cyan-800 px-4 py-2.5 font-semibold text-white disabled:opacity-50';
const card='rounded-xl border border-slate-200 bg-white p-4 sm:p-6';
const money = (n:number) => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(n/100);
const date = (s:string) => new Date(s).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'});
export async function api(path:string, data?:object) {
  const response=await fetch('/api/'+path,data&&{method:'POST',headers:{'Content-Type':'application/json','X-Ege-Request':'1'},body:JSON.stringify(data)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'İşlem tamamlanamadı.');
  return result;
}
function Field({name,label,type='text',required=true,min=0,step=1,value}:{
  name:string;label:string;type?:string;required?:boolean;min?:number;step?:number;value?:string;
}) {
  return <label className="block">{label}<input className={input} name={name} type={type} required={required} min={type==='number'?min:undefined} step={type==='number'?step:undefined} defaultValue={value}/></label>;
}
function Choice({name,label,children,value,onChange}:{name:string;label:string;children:ReactNode;value?:string;onChange?:(v:string)=>void}) {
  return <label className="block">{label}<select className={input} required name={name} value={value} onChange={onChange&& (e=>onChange(e.target.value))}>{children}</select></label>;
}
function Form({title,submit,children,action}:{title:string;submit:string;children:ReactNode;action:(form:FormData)=>Promise<string|void>}) {
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function send(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setMessage('');
    try{setMessage(await action(new FormData(event.currentTarget))||'Kaydedildi.');}
    catch(e){setMessage(e instanceof Error?e.message:'İşlem tamamlanamadı.');}
    finally{setBusy(false);}
  }
  return <form className={card+' space-y-3'} onSubmit={send}><h2 className="text-lg font-bold">{title}</h2>{children}<button className={button} disabled={busy}>{submit}</button>{message&&<p className="break-all text-sm" role="status">{message}</p>}</form>;
}
function Table({head,rows}:{head:string[];rows:ReactNode[][]}) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm">
    <thead><tr>{head.map(h=><th scope="col" className="whitespace-nowrap p-2" key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((row,i)=><tr className="border-t" key={i}>{row.map((cell,j)=><td className="p-2" key={j}>{cell}</td>)}</tr>)}</tbody>
  </table>{!rows.length&&<p className="p-2 text-slate-600">Kayıt yok.</p>}</div>;
}
const branchOptions=(branches:Inventory['branches'])=>branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>);
function DocumentForm({data,initialBranch,save}:{data:Inventory;initialBranch:string;save:(path:string,payload:object)=>Promise<void>}) {
  const [branch,setBranch]=useState(initialBranch||data.branches[0]?.id||'');
  const products=data.products.filter(p=>p.branch===branch);
  return <Form key={branch} title="Yeni sayım oturumu" submit="Sayımı kaydet" action={async f=>{
    const lines=products.filter(p=>String(f.get('qty-'+p.id)||'')!=='').map(p=>({id:p.id,expected:p.quantity,quantity:Number(f.get('qty-'+p.id))}));
    if(!lines.length)throw Error('En az bir malzemenin miktarını girin.');
    await save('counts',{branch,title:f.get('title'),lines});
  }}>
    <Choice label="Şube" name="branch" value={branch} onChange={setBranch}>{branchOptions(data.branches)}</Choice>
    <Field name="title" label="Sayım adı"/>
    <p className="text-sm text-slate-600">Miktarı boş bırakılan malzemeler kayda eklenmez.</p>
    <div className="grid gap-2 sm:grid-cols-2">{products.map(p=><div key={p.id} className="rounded-lg border p-3">
      <strong>{p.name}</strong><p className="text-sm text-slate-600">{p.sku} · Mevcut {p.quantity}</p>
      <Field name={'qty-'+p.id} label="Sayılan adet" type="number" required={false}/>
    </div>)}</div>
  </Form>;
}
function TeamPanel({data,settings,reload}:{data:Inventory;settings:boolean;reload:()=>Promise<void>}) {
  const [view,setView]=useState<{email:string;team:Person[]}>(),[error,setError]=useState('');
  const refresh=()=>api('team').then(setView);
  useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);
  const branchName=(id:string|null)=>data.branches.find(b=>b.id===id)?.name||'Tüm şubeler';
  const roleField=<Choice label="Yetki" name="role"><option value="employee">Çalışan</option><option value="manager">Yönetici</option></Choice>;
  const branchField=<Choice label="Şube" name="branch">{branchOptions(data.branches)}</Choice>;
  if(!view)return <p role="status">{error||'Yükleniyor…'}</p>;
  return <div className="space-y-4">
    {settings&&<section className={card}><h2 className="mb-3 font-bold">Şubeler</h2>{data.branches.map(b=><p key={b.id}>{b.name}</p>)}</section>}
    {settings&&data.role==='owner'&&<Form title="Şube ekle" submit="Şubeyi kaydet" action={async f=>{
      await api('inventory/branches',{name:f.get('name')});await reload();
    }}><Field name="name" label="Şube adı"/></Form>}
    {data.role==='owner'&&<section className={card}><Table head={['Kullanıcı','E-posta','Yetki','Şube']} rows={view.team.map(m=>[m.name,m.email,roles[m.role],branchName(m.branch)])}/></section>}
    {data.role==='owner'&&view.team.some(m=>m.role!=='owner')&&<Form title="Kullanıcı yetkisi ve şubesi" submit="Atamayı güncelle" action={async f=>{
      await api('team/assignment',Object.fromEntries(f));await refresh();
    }}><Choice label="Kullanıcı" name="member">{view.team.filter(m=>m.role!=='owner').map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Choice>{branchField}{roleField}</Form>}
    {data.role==='owner'&&data.branches.length>0&&<Form title="Kullanıcı davet et" submit="Davet kodu oluştur" action={async f=>{
      const {token}=await api('team/invite',Object.fromEntries(f));return '24 saat geçerli davet kodu: '+token;
    }}><Field name="email" label="E-posta" type="email"/>{branchField}{roleField}</Form>}
    {settings&&<Form title="Kullanıcı ayarları" submit="Hesabı güncelle" action={async f=>{
      await api('team/account',Object.fromEntries(f));location.replace('/');
    }}><Field name="email" label="E-posta" type="email" value={view.email}/><Field name="currentPassword" label="Mevcut şifre" type="password"/><Field name="password" label="Yeni şifre (isteğe bağlı)" type="password" required={false}/><p className="text-sm">Güncellemeden sonra yeniden giriş yapman gerekir.</p></Form>}
  </div>;
}
export default function InventoryPanel({page,data,reload,navigate}:{page:string;data:Inventory;reload:()=>Promise<void>;navigate:(p:string)=>void}) {
  const [filter,setFilter]=useState(''),[search,setSearch]=useState('');
  const [mode,setMode]=useState('day'),[period,setPeriod]=useState('');
  const visible=(id:string)=>!filter||id===filter;
  const branch=(id:string)=>data.branches.find(b=>b.id===id)?.name||'';
  const inPeriod=(value?:string)=>!period||Boolean(value&&dayKey(value).startsWith(period.slice(0,mode==='year'?4:mode==='month'?7:10)));
  const byId=new Map(data.products.map(p=>[p.id,p]));
  const wantsLine=(lines:Line[])=>!search.trim()||lines.some(l=>matchesProduct(l,search)|| Boolean(byId.get(l.id)&&matchesProduct(byId.get(l.id)!,search)));
  const invoices=data.invoices.filter(i=>visible(i.branch)&&inPeriod(i.date)&&wantsLine(i.lines));
  const counts=data.counts.filter(c=>visible(c.branch)&&inPeriod(c.date)&&wantsLine(c.lines));
  const datedProducts=new Set([...data.invoices,...data.counts].filter(d=>inPeriod(d.date)).flatMap(d=>d.lines.map(l=>l.id)));
  const products=data.products.filter(p=>visible(p.branch)&&matchesProduct(p,search)&&(!period||(p.createdAt&&inPeriod(p.createdAt))||datedProducts.has(p.id)));
  const sumInvoice=(i:Invoice)=>i.lines.reduce((sum,line)=>sum+line.quantity*line.price,0);
  const save=async(path:string,payload:object)=>{await api('inventory/'+path,payload);await reload();};
  const isOwner=data.role==='owner';
  const title:Record<string,string>={dashboard:'Stok özeti',materials:'Malzeme Yönetimi','stock-count':'Stok Sayımı','count-history':'Sayım Geçmişi',invoices:'Fatura Yönetimi',reports:'Raporlar ve İstatistikler',users:'Kullanıcı Yönetimi','company-team':'Şirket ve Ekip'};
  if(page==='reports')return <ReportAnalytics data={data}/>;
  return <div className="space-y-4">
    <header className="rounded-xl bg-[#103854] p-5 text-white"><h1 className="text-2xl font-bold">{title[page]}</h1>{page!=='invoices'&&<p>{data.company} · {roles[data.role]}</p>}</header>
    {page==='users'||page==='company-team'?<TeamPanel data={data} settings={page==='company-team'} reload={reload}/>:<>
    {page==='dashboard'&&isOwner&&<div className={card}><Choice label="Şube filtresi" name="filter" value={filter} onChange={setFilter}><option value="">Tüm şubeler</option>{branchOptions(data.branches)}</Choice></div>}
    {['materials','stock-count','count-history','invoices'].includes(page)&&<RecordFilters branches={data.branches} branch={filter} setBranch={setFilter} mode={mode} setMode={setMode} period={period} setPeriod={setPeriod} search={search} setSearch={setSearch}/>}
    {page==='dashboard'&&<>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        ['Malzeme',products.length],['Sayım oturumu',counts.length],['Kritik stok',products.filter(p=>p.quantity<=p.minimum).length],
        ['Stok değeri',money(products.reduce((s,p)=>s+p.quantity*p.price,0))],['Fatura',invoices.length],['Fatura toplamı',money(invoices.reduce((s,i)=>s+sumInvoice(i),0))],
        ['Sayılan kalem',counts.reduce((s,c)=>s+c.lines.length,0)],['Toplam sayım farkı',counts.reduce((s,c)=>s+c.lines.reduce((n,l)=>n+l.actual-l.expected,0),0)]
      ].map(([label,value])=><div key={label} className={card}><p>{label}</p><strong className="text-xl">{value}</strong></div>)}</div>
      <section className={card}><h2 className="font-bold">Şubelere göre stok</h2><Table head={['Şube','Malzeme','Stok adedi','Sayım']} rows={data.branches.filter(b=>visible(b.id)).map(b=>[b.name,products.filter(p=>p.branch===b.id).length,products.filter(p=>p.branch===b.id).reduce((s,p)=>s+p.quantity,0),counts.filter(c=>c.branch===b.id).length])}/></section>
      <button className={button} onClick={()=>navigate('count-history')}>Sayım geçmişini aç</button>
    </>}
    {page==='materials'&&<>
      <section className={card}><Table head={['Malzeme','Kod','Şube','Adet','Birim fiyat']} rows={products.map(p=>[p.name,p.sku,branch(p.branch),p.quantity,money(p.price)])}/></section>
      {data.role!=='employee'&&data.branches.length>0&&<Form title="Yeni malzeme" submit="Malzemeyi kaydet" action={async f=>{
        await save('products',{...Object.fromEntries(f),quantity:Number(f.get('quantity')),minimum:Number(f.get('minimum')),price:Math.round(Number(f.get('price'))*100)});
      }}><Choice name="branch" label="Şube">{branchOptions(data.branches)}</Choice><Field name="name" label="Malzeme adı"/><Field name="sku" label="Stok kodu"/><Field name="barcode" label="Barkod" required={false}/><Field name="quantity" label="Açılış stoku" type="number"/><Field name="minimum" label="Kritik stok sınırı" type="number"/><Field name="price" label="Birim fiyat (₺)" type="number" step={0.01}/></Form>}
    </>}
    {(page==='stock-count'||page==='count-history')&&<>
      {page==='stock-count'&&data.branches.length>0&&<DocumentForm key={filter} data={{...data,products:products.filter(p=>matchesProduct(p,search))}} initialBranch={filter} save={save}/>}
      <section className={card}><h2 className="mb-3 font-bold">Sayım oturumları</h2>{!counts.length&&<p>Kayıt yok.</p>}{counts.map(c=><details key={c.id} className="mb-2 rounded-lg border p-3"><summary className="cursor-pointer font-semibold">{c.title} · {c.lines.length} kalem</summary><p className="mb-2 mt-1 text-sm">{branch(c.branch)} · {date(c.date)} · {c.authorName}</p><Table head={['Malzeme','Beklenen','Sayılan','Fark']} rows={c.lines.map(l=>[l.name,l.expected,l.actual,l.actual-l.expected])}/></details>)}</section>
    </>}
    {page==='invoices'&&<InvoicePage data={data} invoices={invoices} initialBranch={filter} onSave={payload=>save('invoices',payload)}/>}

    </>}
  </div>;
}
