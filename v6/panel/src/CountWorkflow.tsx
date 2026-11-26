import {useState} from 'react';
import type {Inventory} from './InventoryPanel';
import {Dialog,ActionForm,Branch,box,button,field,muted,states,time,type Task} from './Operations';
import {matchesProduct} from './recordFilters';

export default function CountWorkflow({data,counts,task,initialBranch,search,showCreate,save}:{
 data:Inventory;counts:Inventory['counts'];task?:Task;initialBranch:string;search:string;showCreate:boolean;save:(path:string,payload:object)=>Promise<void>;
}){
 const [stage,setStage]=useState(task?'lines':''),[branch,setBranch]=useState(task?.branch||initialBranch||data.branches[0]?.id||''),[title,setTitle]=useState(task?.title||'');
 const [assigned,setAssigned]=useState(task?.id),[active,setActive]=useState<Inventory['counts'][number]>();
 const candidates=data.products.filter(p=>p.branch===branch&&matchesProduct(p,search));
 const branchName=(id:string)=>data.branches.find(b=>b.id===id)?.name;
 const canDecide=active&&(data.role==='owner'&&active.status==='owner_pending'||data.role==='manager'&&active.status==='manager_pending');
 return <section className={box}>
  {showCreate&&data.branches.length>0&&<button className={button+' mb-3'} onClick={()=>{setTitle('');setAssigned(undefined);setStage('header');}}>Yeni sayım oturumu</button>}
  <h2 className="font-bold">Sayım oturumları</h2>
  {counts.map(c=><button key={c.id} className={muted+' my-2 block w-full text-left'} onClick={()=>setActive(c)}>
   <strong>{c.title} · {c.lines.length} kalem</strong><span className="block">{branchName(c.branch)} · {time(c.date)} · {states[c.status||'approved']}</span>
  </button>)}
  {!counts.length&&<p>Görüntülenecek sayım yok.</p>}
  {stage&&<Dialog title={stage==='header'?'Yeni sayım oturumu':'Sayım malzemeleri'} close={()=>setStage('')}>
   {stage==='header'?<ActionForm submit="Malzemelere geç" action={async()=>setStage('lines')}>
    <Branch branches={data.branches} value={branch} onChange={setBranch}/>
    <label>Sayım adı<input className={field} maxLength={100} required value={title} onChange={e=>setTitle(e.target.value)}/></label>
   </ActionForm>:<ActionForm submit="Yönetici onayına gönder" action={async f=>{
    const lines=candidates.filter(p=>f.get(p.id)!=='').map(p=>({id:p.id,expected:p.quantity,quantity:Number(f.get(p.id))}));
    if(!lines.length)throw Error('En az bir malzeme sayın.');
    await save('counts',{branch,title,lines,task:assigned});setStage('');
   }}>
    <p>{title} · {branchName(branch)}</p><p className="text-sm">Boş bırakılan malzemeler sayıma eklenmez.</p>
    {!candidates.length&&<p>Bu şube ve filtreyle eşleşen malzeme yok.</p>}
    <div className="grid gap-2 sm:grid-cols-2">{candidates.map(p=><label className="rounded border p-2" key={p.id}>{p.name} · {p.sku}<small className="block">Mevcut {p.quantity} {p.unit||'Adet'}</small><input className={field} aria-label={p.name+' sayılan miktar'} type="number" min="0" max="1000000" name={p.id}/></label>)}</div>
   </ActionForm>}
  </Dialog>}
  {active&&<Dialog title={active.title} close={()=>setActive(undefined)}>
    <p>{branchName(active.branch)} · {time(active.date)} · {active.authorName}</p><strong>{states[active.status||'approved']}</strong>
    <div className="report-table-wrap report-scroll"><table><thead><tr>{['Malzeme','Beklenen','Sayılan','Fark'].map(text=><th key={text}>{text}</th>)}</tr></thead><tbody>{active.lines.map(l=><tr key={l.id}><td>{l.name}</td><td>{l.expected}</td><td>{l.actual}</td><td>{l.actual-l.expected}</td></tr>)}</tbody></table></div>
    {active.approvals?.map((a,i)=><p key={i}>{a.name} · {a.role==='owner'?'Sistem Kurucusu':'Yönetici'} · {a.decision==='rejected'?'Düzeltmeye gönderdi':'Onayladı'} · {time(a.date)}</p>)}
    {showCreate&&canDecide&&<ActionForm submit="Kararı kaydet" action={async f=>{await save(String(f.get('decision')),{id:active.id});setActive(undefined);}}>
     <label>Karar<select className={field} name="decision"><option value="approve">Onayla</option><option value="reject">Düzeltmeye gönder</option></select></label>
    </ActionForm>}
  </Dialog>}
 </section>;
}
