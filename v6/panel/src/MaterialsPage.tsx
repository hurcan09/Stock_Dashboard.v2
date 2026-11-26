import {useState} from 'react';
import type {Inventory,Product} from './InventoryPanel';
import {Dialog,ActionForm,Branch,box,button,field,muted,time,states} from './Operations';
import units from '../../worker/units.json';

const columns=[
 ['sku','Stok kodu'],['name','Malzeme adı'],['barcode','Barkod'],['gtin','GTIN'],['serial','Seri no'],['category','Kategori'],['subcategory','Alt kategori'],
 ['unit','Birim'],['quantity','Stok'],['minimum','Kritik sınır'],['price','Birim fiyat (TL)']
] as const;
const number=(value:unknown)=>String(value??'').trim().replace(',','.');
const currency=(n:number)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(n/100);
const rowData=(r:Record<string,unknown>)=>({...r,quantity:Number(number(r.quantity)),minimum:Number(number(r.minimum)),price:Math.round(Number(number(r.price))*100)});

export default function MaterialsPage({data,products,initialBranch,save}:{
 data:Inventory;products:Product[];initialBranch:string;save:(path:string,payload:object)=>Promise<void>;
}){
 const [page,setPage]=useState(1),[modal,setModal]=useState(''),[selected,setSelected]=useState<Product>();
 const [message,setMessage]=useState('');
 const canWrite=data.role!=='employee'&&data.branches.length>0;
 const pages=Math.max(1,Math.ceil(products.length/20)),current=Math.min(page,pages);
 const branchName=(id:string)=>data.branches.find(b=>b.id===id)?.name;
 async function download(template=false){
  try{
   const {Workbook}=await import('exceljs'),book=new Workbook(),sheet=book.addWorksheet('Malzemeler');
   sheet.columns=[{header:'Şube',key:'branch',width:22},...columns.map(([key,header])=>({key,header,width:19}))];
   if(!template)for(const row of products)sheet.addRow({...row,branch:branchName(row.branch),price:row.price/100,unit:row.unit||'Adet'});
   const buffer=await book.xlsx.writeBuffer();
   const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
   const link=document.createElement('a');link.href=url;link.download=template?'malzeme-sablonu.xlsx':'malzemeler.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{setMessage('Excel dosyası hazırlanamadı.');}
 }
 return <section className={box}>
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
   <div>{canWrite&&<button className={button} onClick={()=>setModal('new')}>Yeni malzeme</button>}</div>
   <div className="flex flex-wrap gap-2">{canWrite&&<button className={muted} onClick={()=>setModal('import')}>Excel içe aktar</button>}<button className={muted} onClick={()=>download()}>Excel dışa aktar</button></div>
  </div>
  {message&&<p role="status">{message}</p>}
  <p>{products.length} malzeme</p>
  <div className="report-scroll"><table className="w-full text-left"><thead><tr>{['Malzeme','Kod','Şube','Stok','Birim fiyat'].map(t=><th className="p-2" key={t}>{t}</th>)}</tr></thead>
   <tbody>{products.slice((current-1)*20,current*20).map(p=><tr className="border-t" key={p.id}>
    <td><button className="p-2 text-left font-semibold text-cyan-900 underline" onClick={()=>setSelected(p)}>{p.name}</button></td><td className="p-2">{p.sku}</td><td className="p-2">{branchName(p.branch)}</td><td className="p-2">{p.quantity} {p.unit||'Adet'}</td><td className="p-2">{currency(p.price)}</td>
   </tr>)}</tbody></table></div>
  <nav aria-label="Malzeme sayfaları" className="mt-3 flex flex-wrap gap-2">
   <button className={muted} disabled={current===1} onClick={()=>setPage(current-1)}>Önceki</button>
   <label>Sayfa <select className={muted} value={current} onChange={e=>setPage(Number(e.target.value))}>{Array.from({length:pages},(_,i)=><option key={i}>{i+1}</option>)}</select> / {pages}</label>
   <button className={muted} disabled={current===pages} onClick={()=>setPage(current+1)}>Sonraki</button>
  </nav>
  {modal==='new'&&<Dialog title="Yeni malzeme" close={()=>setModal('')}><ActionForm submit="Malzemeyi kaydet" action={async f=>{await save('products',rowData(Object.fromEntries(f)));setModal('');}}>
   <Branch branches={data.branches} value={undefined}/>
   <div className="grid gap-2 sm:grid-cols-2">{columns.map(([key,label])=><label key={key}>{label}{key==='unit'?<select className={field} name={key}>{units.map(u=><option key={u}>{u}</option>)}</select>:
    <input className={field} name={key} maxLength={100} type={['quantity','minimum','price'].includes(key)?'number':'text'} min={0} step={key==='price'?0.01:1} required={['name','sku','quantity','minimum','price'].includes(key)}/>}</label>)}</div>
  </ActionForm></Dialog>}
  {modal==='import'&&<Dialog title="Excel içe aktar" close={()=>setModal('')}>
   <p>Şablonu doldur ve aktarılacak şubeyi seç. Ürün adını, stok kodunu ve miktarı gir. Barkod ve GTIN alanlarını baştaki sıfırları korumak için metin biçiminde yaz.</p>
   <button type="button" className={muted} onClick={()=>download(true)}>Excel şablonunu indir</button>
   <ActionForm submit="Malzemeleri aktar" action={async f=>{
    const file=f.get('file');if(!(file instanceof File)||!file.size||file.size>5_000_000||!file.name.toLowerCase().endsWith('.xlsx'))throw Error('5 MB altı bir .xlsx dosyası seçin.');
    const {Workbook}=await import('exceljs'),book=new Workbook();
    await book.xlsx.load(await file.arrayBuffer());
    const sheet=book.worksheets[0];if(!sheet)throw Error('Çalışma sayfası bulunamadı.');
    const indexes=columns.map(([,label])=>{let at=0;sheet.getRow(1).eachCell((cell,i)=>{if(cell.text.trim()===label)at=i;});return at;});
    if(indexes.some(i=>!i))throw Error('Sütun başlıkları Excel şablonuyla eşleşmiyor.');
    const rows:Record<string,unknown>[]=[];
    sheet.eachRow((row,i)=>{if(i===1)return;
      const cells=columns.map(([key],j)=>[key,row.getCell(indexes[j]).text.trim()]);
      if(cells.some(([,v])=>v))rows.push(rowData(Object.fromEntries(cells)));
    });
    if(!rows.length||rows.length>500)throw Error('Dosyada 1–500 malzeme olmalı.');
    await save('import',{branch:f.get('branch'),rows});setModal('');setMessage(rows.length+' malzeme aktarıldı.');
   }}>
    <label>Aktarılacak şube<select className={field} name="branch" defaultValue={initialBranch||undefined} required>{data.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    <label>Excel dosyası<input className={field} type="file" name="file" accept=".xlsx" required/></label>
   </ActionForm></Dialog>}
  {selected&&<Dialog title={selected.name+' · Sayım geçmişi'} close={()=>setSelected(undefined)}>
   <p>{branchName(selected.branch)} · {selected.sku}</p>
   {data.counts.flatMap(c=>c.lines.filter(l=>l.id===selected.id).map(l=><article className="border-t py-2" key={c.id}><strong>{c.title}</strong><p>{time(c.date)} · {c.authorName} · {states[c.status||'approved']}</p><p>Beklenen {l.expected} · Sayılan {l.actual} · Fark {l.actual-l.expected}</p></article>))}
   {!data.counts.some(c=>c.lines.some(l=>l.id===selected.id))&&<p>Bu malzeme için sayım kaydı yok.</p>}
  </Dialog>}
 </section>;
}
