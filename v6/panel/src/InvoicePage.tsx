import {useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import type {Inventory,Invoice,Product} from './InventoryPanel';
import units from '../../worker/units.json';
import {dayKey, matchesProduct} from './recordFilters';

const field='mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5';
const primary='rounded-lg bg-cyan-800 px-4 py-2 font-semibold text-white disabled:opacity-50';
const secondary='rounded-lg border border-slate-300 px-4 py-2 font-semibold';
const money=(n:number)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(n/100);
const total=(lines:{price:number;quantity:number}[])=>lines.reduce((sum,l)=>sum+l.price*l.quantity,0);
const columns=[
 ['barcode','Ürün barkodu'],['gtin','GTIN kodu'],['sku','Stok kodu'],['serial','Seri No'],
 ['name','Ürün adı'],['category','Ürün kategorisi'],['subcategory','Alt kategori']
] as const;
type Draft=Pick<Product,'id'|'sku'|'name'|'barcode'|'gtin'|'serial'|'category'|'subcategory'|'unit'|'quantity'|'price'>;
type Header={branch:string;number:string;supplier:string;date:string};
type Stage='header'|'lines'|'confirm'|'detail';
function blank():Draft{return {id:'',name:'',sku:'',unit:'Adet',quantity:1,price:0};}

function Modal({stage,title,close,children}:{stage:Stage;title:string;close:()=>void;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.showModal();},[]);
 return <dialog ref={dialog} className="report-dialog" aria-labelledby="invoice-dialog-title" onCancel={e=>{e.preventDefault();close();}}>
  <div className="report-dialog-body">
   <header><h2 id="invoice-dialog-title" tabIndex={-1} autoFocus>{title}</h2><button type="button" aria-label="Pencereyi kapat" onClick={close}>×</button></header>
   <div key={stage}>{children}</div>
  </div>
 </dialog>;
}

export default function InvoicePage({data,invoices,initialBranch,onSave}:{data:Inventory;invoices:Invoice[];initialBranch:string;onSave:(data:object)=>Promise<void>}){
 const [stage,setStage]=useState<Stage|null>(null);
 const [selected,setSelected]=useState<Invoice>();
 const [header,setHeader]=useState<Header>({branch:'',number:'',supplier:'',date:''});
 const [lines,setLines]=useState<Draft[]>([]);
 const [line,setLine]=useState<Draft>(blank),[edit,setEdit]=useState<number|null>(null);
 const [search,setSearch]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const available=data.products.filter(p=>p.branch===header.branch);
 const branchName=(id:string)=>data.branches.find(b=>b.id===id)?.name;
 function open(){
  setHeader({branch:initialBranch||data.branches[0]?.id||'',number:'',supplier:'',date:dayKey(new Date().toISOString())});
  setLines([]);setLine(blank());setEdit(null);setSearch('');setError('');setStage('header');
 }
 function add(e:FormEvent){
  e.preventDefault();
  if(!line.name.trim()||!line.sku.trim()){setError('Ürün adı ve stok kodu zorunlu.');return;}
  if(lines.some((p,i)=>i!==edit&&p.sku.trim().toLocaleLowerCase('tr')===line.sku.trim().toLocaleLowerCase('tr'))){
   setError('Bu stok kodu faturada var. Adedi güncellemek için kalemi düzenleyin.');return;
  }
  if(lines.length>=100&&edit===null){setError('Fatura en fazla 100 kalem içerebilir.');return;}
  setLines(edit===null?[...lines,line]:lines.map((p,i)=>i===edit?line:p));
  setLine(blank());setEdit(null);setError('');
 }
 async function save(){
  setBusy(true);setError('');
  try{await onSave({...header,lines});setStage(null);}
  catch(e){setError(e instanceof Error?e.message:'Fatura kaydedilemedi.');}
  finally{setBusy(false);}
 }
 const headings={header:'Yeni fatura',lines:'Fatura malzemeleri',confirm:'Faturayı onayla',detail:'Fatura özeti'};
 const summary=selected&&<><p>{selected.number} · {selected.supplier}</p><p>{branchName(selected.branch)} · {dayKey(selected.date)} · {selected.lines.length} kalem</p><strong>{money(total(selected.lines))}</strong>
   <div className="report-scroll report-table-wrap mt-3"><table><thead><tr>{['Malzeme','Stok kodu','Miktar','Birim fiyat','Tutar'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{selected.lines.map(l=><tr key={l.id}><td>{l.name}{l.serial&&<small className="block">SN {l.serial}</small>}</td><td>{l.sku||data.products.find(p=>p.id===l.id)?.sku||'—'}</td><td>{l.quantity} {l.unit||'Adet'}</td><td>{money(l.price)}</td><td>{money(l.price*l.quantity)}</td></tr>)}</tbody></table></div></>;
 return <>
  <section className="rounded-xl border bg-white p-4">
   <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Faturalar</h2>{data.role!=='employee'&&data.branches.length>0&&<button className={primary} onClick={open}>Yeni fatura ekle</button>}</div>
   {!invoices.length&&<p>Eşleşen fatura yok.</p>}
   {invoices.map(i=><button key={i.id} className="mb-2 block w-full rounded-lg border p-3 text-left hover:bg-cyan-50" onClick={()=>{setSelected(i);setError('');setStage('detail');}}>
    <strong>{i.number} · {money(total(i.lines))}</strong><span className="block text-sm">{branchName(i.branch)} · {dayKey(i.date)} · {i.lines.length} kalem</span>
   </button>)}
  </section>
  {stage&&<Modal stage={stage} title={headings[stage]} close={()=>{if(!busy)setStage(null);}}>
   {stage==='header'&&<form className="grid gap-3" onSubmit={e=>{e.preventDefault();setStage('lines');}}>
    <label>Şube<select className={field} required value={header.branch} onChange={e=>setHeader({...header,branch:e.target.value})}>{data.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    {([['number','Fatura numarası','text'],['supplier','Tedarikçi','text'],['date','Fatura tarihi','date']] as const).map(([key,label,type])=><label key={key}>{label}<input className={field} required maxLength={100} type={type} value={header[key]} onChange={e=>setHeader({...header,[key]:e.target.value})}/></label>)}
    <button className={primary}>Fatura malzemelerine geç</button>
   </form>}
   {stage==='lines'&&<>
    <label>Mevcut ürün ara<input className={field} value={search} onChange={e=>setSearch(e.target.value)}/></label>
    {search.trim()&&<div className="my-2 max-h-32 overflow-auto">{available.filter(p=>matchesProduct(p,search)).map(p=><button key={p.id} className="block p-2 text-left underline" onClick={()=>{setLine({...p,quantity:1,unit:p.unit||'Adet'});setSearch('');}}>{p.name} · {p.sku}</button>)}</div>}
    <form className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" onSubmit={add}>
     {columns.map(([key,label])=><label key={key}>{label}<input className={field} required={key==='sku'||key==='name'} readOnly={key==='sku'&&Boolean(line.id)} maxLength={100} value={line[key]||''} onChange={e=>setLine({...line,[key]:e.target.value})}/></label>)}
     <label>Birim<select className={field} value={line.unit} onChange={e=>setLine({...line,unit:e.target.value})}>{units.map(u=><option key={u}>{u}</option>)}</select></label>
     <label>Stok (faturaya giren miktar)<input className={field} type="number" min="1" max="1000000" required value={line.quantity||''} onChange={e=>setLine({...line,quantity:Number(e.target.value)})}/></label>
     <label>Birim fiyat (₺)<input key={edit??'new'} className={field} type="number" min="0" max="1000000" step="0.01" required value={line.price/100} onChange={e=>setLine({...line,price:Math.round(Number(e.target.value)*100)})}/></label>
     <button className={primary}>{edit===null?'Kalemi ekle':'Kalem değişikliklerini uygula'}</button>
     {edit!==null&&<button className={secondary} type="button" onClick={()=>{setEdit(null);setLine(blank());}}>Düzenlemeyi bırak</button>}
    </form>
    <ul className="my-3 space-y-2">{lines.map((p,i)=><li key={i} className="flex flex-wrap items-center gap-2 rounded border p-2"><span className="flex-1">{p.name} · {p.quantity} {p.unit} · {money(p.price*p.quantity)}</span><button className={secondary} onClick={()=>{setEdit(i);setLine(p);}}>Düzenle</button><button className={secondary} onClick={()=>{setLines(lines.filter((_,j)=>j!==i));setEdit(null);setLine(blank());}}>Kaldır</button></li>)}</ul>
    <button className={primary} disabled={!lines.length||edit!==null} onClick={()=>{setStage('confirm');setError('');}}>Fatura özetine geç</button>
   </>}
   {stage==='confirm'&&<>
    <p className="font-bold">{header.number} · {header.supplier}</p><p>{branchName(header.branch)} · {header.date} · {lines.length} kalem</p>
    <p className="mt-2">Toplam <strong>{money(total(lines))}</strong></p><p>Kaydedildiğinde faturadaki miktarlar şube stoklarına eklenecek.</p>
    <div className="mt-4 flex flex-wrap justify-end gap-2"><button className={primary} disabled={busy} onClick={save}>{busy?'Kaydediliyor…':'Faturayı kaydet'}</button><button className={secondary} disabled={busy} onClick={()=>{setStage('lines');setError('');}}>Fatura malzemelerini düzenle</button></div>
   </>}
   {stage==='detail'&&summary}
   {error&&<p className="mt-2" role="alert">{error}</p>}
  </Modal>}
 </>;
}
