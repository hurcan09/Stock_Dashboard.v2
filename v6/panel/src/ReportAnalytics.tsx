import { Period } from './recordFilters';
import {useRef,useState,type ReactNode} from 'react';
import type {Inventory} from './InventoryPanel';
import './reports.css';

const currency=(n:number)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(n/100);
const keyDate=(s:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
const date=(s:string)=>new Date(s).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'});
const match=(s:string,q:string)=>s.toLocaleLowerCase('tr').includes(q.trim().toLocaleLowerCase('tr'));
type Table={head:string[];rows:ReactNode[][]};
type Point={label:string;value:number};

function Chart({title,points,line=false,format=String}:{title:string;points:Point[];line?:boolean;format?:(n:number)=>string}){
 const [selected,setSelected]=useState('');
 const active=points.find(p=>p.label===selected)||points.at(-1);
 const max=Math.max(1,...points.map(p=>p.value));
 const width=Math.max(420,points.length*74+65);
 const x=(i:number)=>55+(i+0.5)*(width-65)/points.length;
 const y=(v:number)=>175-v/max*135;
 return <section className="report-box"><h2>{title}</h2>
  {!points.length?<p>Bu filtrelerle gösterilecek kayıt yok.</p>:<>
  <div className="report-scroll"><svg width={width} height="214" role="img" aria-label={title}>
   {[0,.25,.5,.75,1].map(p=><g key={p}><line x1="52" x2={width-8} y1={y(max*p)} y2={y(max*p)} stroke="#dce9ef"/><text x="48" y={y(max*p)+4} textAnchor="end" fontSize="9" fill="#31556b">{format(Math.round(max*p))}</text></g>)}
   {line&&<polyline fill="none" stroke="#087e8b" strokeWidth="3" points={points.map((p,i)=>x(i)+','+y(p.value)).join(' ')}/>}
   {points.map((p,i)=><g key={p.label}>
    <title>{p.label+' · '+format(p.value)}</title>
    {line?<circle cx={x(i)} cy={y(p.value)} r="5" fill="#087e8b"/>:<rect x={x(i)-15} y={y(p.value)} width="30" height={175-y(p.value)} rx="4" fill="#146491"/>}
    <text x={x(i)} y="195" textAnchor="middle" fontSize="10" fill="#244a60">{p.label}</text>
   </g>)}
  </svg></div>
  <label>Grafik detayı <select value={active?.label} onChange={e=>setSelected(e.target.value)}>{points.map(p=><option key={p.label}>{p.label}</option>)}</select></label> <strong>{active&&format(active.value)}</strong>
  </>}
 </section>;
}
export default function ReportAnalytics({data}:{data:Inventory}){
 const [branch,setBranch]=useState(''),[mode,setMode]=useState('day'),[period,setPeriod]=useState('');
 const [product,setProduct]=useState(''),[invoice,setInvoice]=useState('');
 const [modal,setModal]=useState(''),[valueMode,setValueMode]=useState('day'),[valuePeriod,setValuePeriod]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 const inBranch=(id:string)=>!branch||id===branch;
 const inPeriod=(s:string,m=mode,p=period)=>!p||keyDate(s).startsWith(p.slice(0,m==='year'?4:m==='month'?7:10));
 const branchName=(id:string)=>data.branches.find(b=>b.id===id)?.name||id;
 const candidates=data.products.filter(p=>inBranch(p.branch)&&[p.name,p.sku,p.barcode||''].some(v=>match(v,product)));
 const ids=new Set(candidates.map(p=>p.id));
 const invoices=data.invoices.filter(i=>inBranch(i.branch)&&inPeriod(i.date)&&match(i.number,invoice))
  .map(i=>({...i,lines:i.lines.filter(l=>!product.trim()||ids.has(l.id)||(!data.products.some(p=>p.id===l.id)&&match(l.name,product)))})).filter(i=>i.lines.length);
 const billed=new Set(invoices.flatMap(i=>i.lines.map(l=>l.id)));
 const filtered=candidates.filter(p=>!invoice.trim()||billed.has(p.id));
 const countRows=data.counts.filter(c=>(!c.status||c.status==='approved')&&inBranch(c.branch))
  .map(c=>({...c,lines:c.lines.filter(l=>(!product.trim()||ids.has(l.id)||(!data.products.some(p=>p.id===l.id)&&match(l.name,product)))&&(!invoice.trim()||billed.has(l.id)))})).filter(c=>c.lines.length);
 const counts=countRows.filter(c=>inPeriod(c.date));
 const products=period?filtered.filter(p=>counts.some(c=>c.lines.some(l=>l.id===p.id))||invoices.some(i=>i.lines.some(l=>l.id===p.id))):filtered;
 const critical=products.filter(p=>p.quantity<=p.minimum);
 const invoiceTotal=(i:typeof invoices[number])=>i.lines.reduce((n,l)=>n+l.price*l.quantity,0);
 const differences=counts.flatMap(c=>c.lines.filter(l=>l.actual!==l.expected).map(l=>[l.name,branchName(c.branch),c.title,l.expected,l.actual-l.expected]));
 const productTable=(p:typeof products):Table=>({head:['Malzeme','Barkod / kod','Şube','Adet','Kritik sınır'],rows:p.map(r=>[r.name,r.barcode||r.sku,branchName(r.branch),r.quantity,r.minimum])});
 const periodValue=valuePeriod||period;
 const observed=countRows.filter(c=>inPeriod(c.date,valuePeriod?valueMode:mode,periodValue));
 const history=observed.flatMap(c=>c.lines.filter(l=>Number.isFinite(l.valuationPrice??l.price))
  .map(l=>[l.name,branchName(c.branch),date(c.date),l.actual,currency(l.actual*(l.valuationPrice??l.price))]));
 const tables:Record<string,Table>={
  'Malzeme':productTable(products),'Kritik stok':productTable(critical),
  'Sayım oturumu':{head:['Oturum','Şube','Tarih','Sayan','Kalem'],rows:counts.map(c=>[c.title,branchName(c.branch),date(c.date),c.authorName,c.lines.length])},
  'Stok değeri':{head:valuePeriod?['Malzeme','Şube','Sayım tarihi','Sayılan','Sayım değeri']:['Malzeme','Şube','Adet','Birim fiyat','Stok değeri'],rows:valuePeriod?history:products.map(p=>[p.name,branchName(p.branch),p.quantity,currency(p.price),currency(p.price*p.quantity)])},
  'Fatura':{head:['Fatura no','Tedarikçi','Şube','Tarih','Kalem'],rows:invoices.map(i=>[i.number,i.supplier,branchName(i.branch),date(i.date),i.lines.length])},
  'Fatura toplamı':{head:['Fatura no','Şube','Tarih','Kalem','Tutar'],rows:invoices.map(i=>[i.number,branchName(i.branch),date(i.date),i.lines.length,currency(invoiceTotal(i))])},
  'Sayılan kalem':{head:['Oturum','Şube','Tarih','Kalem','Sayılan adet'],rows:counts.map(c=>[c.title,branchName(c.branch),date(c.date),c.lines.length,c.lines.reduce((n,l)=>n+l.actual,0)])},
  'Toplam sayım farkı':{head:['Malzeme','Şube','Oturum','Beklenen','Fark'],rows:differences}
 };
 const summary:Record<string,string|number>={
  'Malzeme':products.length,'Sayım oturumu':counts.length,'Kritik stok':critical.length,
  'Stok değeri':currency(products.reduce((n,p)=>n+p.price*p.quantity,0)),'Fatura':invoices.length,
  'Fatura toplamı':currency(invoices.reduce((n,i)=>n+invoiceTotal(i),0)),
  'Sayılan kalem':counts.reduce((n,c)=>n+c.lines.length,0),
  'Toplam sayım farkı':counts.reduce((n,c)=>n+c.lines.reduce((s,l)=>s+l.actual-l.expected,0),0)
 };
 const byDate=new Map<string,number>();
 for(const i of invoices){const k=keyDate(i.date);byDate.set(k,(byDate.get(k)||0)+invoiceTotal(i));}
 const line=Array.from(byDate,([label,value])=>({label,value})).sort((a,b)=>a.label.localeCompare(b.label));
 const bars=data.branches.filter(b=>inBranch(b.id)).map(b=>({label:b.name,value:counts.filter(c=>c.branch===b.id).reduce((n,c)=>n+c.lines.length,0)}));
 const table=tables[modal];
 return <div className="report-area">
  <header className="report-title"><h1>Raporlar ve İstatistikler</h1></header>
  <div className="report-box report-filters">
   {data.branches.length>1&&<label>Şube <select value={branch} onChange={e=>setBranch(e.target.value)}><option value="">Tüm şubeler</option>{data.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
   <Period mode={mode} setMode={setMode} period={period} setPeriod={setPeriod}/>
   <label>Fatura no <input value={invoice} onChange={e=>setInvoice(e.target.value)} placeholder="Fatura numarası"/></label>
   <label>Malzeme <input value={product} onChange={e=>setProduct(e.target.value)} placeholder="Ürün adı veya barkod"/></label>
   <button type="button" onClick={()=>{setBranch('');setPeriod('');setInvoice('');setProduct('');}}>Filtreleri temizle</button>
  </div>
  <div className="report-metrics">{Object.entries(summary).map(([label,value])=><button className="report-box" key={label} onClick={()=>{setModal(label);setValueMode(mode);setValuePeriod(period);dialog.current?.showModal();}}><span>{label}</span><strong>{value}</strong><small>Detayları göster</small></button>)}</div>
  <div className="report-charts"><Chart title="Şubelere göre sayılan kalemler" points={bars}/><Chart title="Günlük fatura tutarı" points={line} line format={currency}/></div>
  <dialog className="report-dialog" ref={dialog} aria-labelledby="report-dialog-title" onClick={e=>{if(e.target===dialog.current)dialog.current.close();}}>
   <div className="report-dialog-body"><header><h2 id="report-dialog-title">{modal}</h2><button autoFocus aria-label="Pencereyi kapat" onClick={()=>dialog.current?.close()}>×</button></header>
   {modal==='Stok değeri'&&<><div className="report-filters"><Period mode={valueMode} setMode={setValueMode} period={valuePeriod} setPeriod={setValuePeriod}/><button onClick={()=>setValuePeriod('')}>Dönemi temizle</button></div><p>Tarih seçildiğinde fiyatı kaydedilmiş sayım kalemleri gösterilir. Tarihsiz görünüm güncel stok değeridir.</p></>}
   {modal==='Fatura toplamı'&&<p><strong>Toplam {summary[modal]}</strong></p>}
   {table&&<><p>{table.rows.length} kayıt</p><div className="report-scroll report-table-wrap" tabIndex={0} aria-label="Kaydırılabilir rapor tablosu">
    <table><thead><tr>{table.head.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead>
    <tbody>{table.rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table>
    {!table.rows.length&&<p>Bu filtrelerle eşleşen kayıt yok.</p>}
   </div></>}
   </div>
  </dialog>
 </div>;
}
