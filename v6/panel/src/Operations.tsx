import {useEffect,useRef,useState,type ReactNode,type FormEvent} from 'react';
import {api,type Inventory} from './InventoryPanel';
import {dayKey} from './recordFilters';

export const box='rounded-xl border border-slate-200 bg-white p-4 sm:p-5';
export const field='block w-full rounded-lg border border-slate-300 p-2';
export const button='rounded-lg bg-cyan-800 px-4 py-2 font-semibold text-white disabled:opacity-50';
export const muted='rounded-lg border border-slate-300 px-3 py-2';
export const states:Record<string,string>={manager_pending:'Yönetici onayı bekliyor',owner_pending:'Sistem Kurucusu onayı bekliyor',approved:'Onaylandı',rejected:'Düzeltme bekliyor'};
export const time=(date:string)=>new Date(date).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'});
export type Task={id:string;title:string;branch:string;due:string};
export type Profile={name:string;email:string;public_id:number;phone:string;address:string;city:string;district:string};

export function Dialog({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog ref={ref} aria-label={title} className="report-dialog ege-modal" onCancel={e=>{e.preventDefault();close();}}>
  <div className="report-dialog-body"><header><h2 className="text-lg">{title}</h2><button type="button" autoFocus aria-label="Pencereyi kapat" onClick={close}>×</button></header>{children}</div>
 </dialog>;
}

export function ActionForm({children,submit,action}:{children:ReactNode;submit:string;action:(data:FormData)=>Promise<void>}){
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setStatus('');setBusy(true);
  try{await action(new FormData(e.currentTarget));setStatus('Kaydedildi.');}
  catch(error){setStatus(error instanceof Error?error.message:'İşlem tamamlanamadı.');}
  finally{setBusy(false);}
 }
 return <form className="grid gap-3" onSubmit={save}>{children}<div className="flex justify-end"><button className={button} disabled={busy}>{busy?'Kaydediliyor…':submit}</button></div>{status&&<p role="status">{status}</p>}</form>;
}
export function Branch({branches,value,onChange}:{branches:Inventory['branches'];value?:string;onChange?:(v:string)=>void}){
 return <label>Şube<select className={field} name="branch" required value={value} onChange={onChange&& (e=>onChange(e.target.value))}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>;
}
export function ProfilePage({compact=false}:{compact?:boolean}){
 const [profile,setProfile]=useState<Profile>(),[error,setError]=useState('');
 useEffect(()=>{api('profile').then(setProfile).catch(e=>setError(e.message));},[]);
 if(!profile)return <p role="status">{error||'Profil yükleniyor…'}</p>;
 return <section className={compact?'':box}>
  <h2 className="text-lg font-bold">{profile.name}</h2><p>{profile.email} · Kullanıcı ID: {profile.public_id}</p>
  <div className="mt-4"><ActionForm submit="Profili kaydet" action={async f=>{await api('profile',Object.fromEntries(f));}}>
   <div className="grid gap-3 sm:grid-cols-2">
   {([['phone','Telefon',40],['city','İl',80],['district','İlçe',80],['address','Adres',400]] as const).map(([key,label,max])=><label key={key}>{label}<input className={field} name={key} type={key==='phone'?'tel':'text'} maxLength={max} defaultValue={profile[key]}/></label>)}
   </div>
  </ActionForm></div>
 </section>;
}
type Event={id:number;page:string;action:string;at:string;name:string;public_id:number|null};
export function ActivityPage(){
 const [rows,setRows]=useState<Event[]>(),[error,setError]=useState('');
 const load=()=>api('activities').then(setRows).catch(e=>setError(e.message));
 useEffect(()=>{void load();},[]);
 return <section className={box}><div className="mb-3 flex justify-end"><button className={muted} onClick={load}>Yenile</button></div>
  {rows?.map(row=><article className="border-t py-3" key={row.id}><strong>{row.name}{row.public_id?' · '+row.public_id:''}</strong><p>{row.page} · {row.action}</p><small>{time(row.at.replace(' ','T')+'Z')}</small></article>)}
  <p role="status">{error|| (!rows?'Aktiviteler yükleniyor…':rows.length?'':'Henüz aktivite yok.')}</p>
 </section>;
}
function Weather(){
 const [p,setProfile]=useState<Profile>(),[message,setMessage]=useState('Profilinize il veya ilçe ekleyin.'),[weather,setWeather]=useState<{name:string;temperature:number;code:number}>();
 useEffect(()=>{
  const controller=new AbortController();
  async function load(){
   const profile=await api('profile') as Profile;
   if(controller.signal.aborted)return;
   setProfile(profile);
   const location=profile.district||profile.city;
   if(!location)return;
   setMessage('Hava durumu yükleniyor…');
   const options={signal:controller.signal};
   const get=async(url:string)=>{const r=await fetch(url,options);if(!r.ok)throw Error();return r.json();};
   const locations=await get('https://geocoding-api.open-meteo.com/v1/search?language=tr&countryCode=TR&count=20&name='+encodeURIComponent(location));
   const places=locations.results||[];
   const norm=(t:string)=>t.normalize('NFC').toLocaleLowerCase('tr');
   const place=profile.city&&profile.district?places.find((p:{admin1?:string})=>norm(p.admin1||'')===norm(profile.city)):places[0];
   if(!place){setMessage('Konum bulunamadı. İl ve ilçe yazımını kontrol edin.');return;}
   const forecast=await get('https://api.open-meteo.com/v1/forecast?current=temperature_2m,weather_code&latitude='+place.latitude+'&longitude='+place.longitude);
   setWeather({name:place.name,temperature:forecast.current.temperature_2m,code:forecast.current.weather_code});
  }
  load().catch(()=>{if(!controller.signal.aborted)setMessage('Hava durumu şu anda alınamadı.');});
  return()=>controller.abort();
 },[]);
 const descriptions=(code:number)=>code===0?'Açık':code<4?'Bulutlu':code<50?'Sisli':code>=95?'Gök gürültülü':code===71||code===73||code===75||code===77||code===85||code===86?'Karlı':'Yağışlı';
 return <section className={box}><h2 className="font-bold">Hava durumu</h2>{weather?<div><strong className="text-3xl">{weather.temperature} °C</strong><p>{weather.name} · {descriptions(weather.code)}</p><small>Open-Meteo</small></div>:<p>{p?.city&&p.city+' · '}{message}</p>}</section>;
}
export function Home({data,save,start}:{data:Inventory;save:(p:string,d:object)=>Promise<void>;start:(task:Task)=>void}){
 const [period,setPeriod]=useState<'daily'|'weekly'|null>(null),[edit,setEdit]=useState<Task|null>(),[branch,setBranch]=useState('');
 const owner=data.role==='owner';
 return <div className="space-y-4">
  <div className="grid gap-4 md:grid-cols-3"><Weather/>{(['daily','weekly'] as const).map(key=><section key={key} className={box}>
   <h2 className="font-bold">{key==='daily'?'Günlük not':'Haftalık not'}</h2>
   <p className="my-2 whitespace-pre-wrap break-words">{data.notes?.find(n=>n.period===key)?.text||'Henüz not yok.'}</p>
   {owner&&<button className={muted} onClick={()=>setPeriod(key)}>Not yaz</button>}
  </section>)}</div>
  <section className={box}><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Planlanan sayımlar</h2>{owner&&data.branches.length>0&&<button className={button} onClick={()=>{setBranch(data.branches[0].id);setEdit(null);}}>Sayım görevi oluştur</button>}</div>
   {data.tasks?.map(task=>{const record=data.counts.find(c=>c.task===task.id&&c.status!=='rejected');
    return <article className="mt-3 border-t pt-3" key={task.id}><strong>{task.title}</strong><p>{data.branches.find(b=>b.id===task.branch)?.name} · {task.due.split('-').reverse().join('.')} · {record?states[record.status||'approved']:'Planlandı'}</p>
    {!record&&<div className="mt-2 flex gap-2">{owner&&<button className={muted} onClick={()=>{setBranch(task.branch);setEdit(task);}}>Düzenle</button>}<button className={button} onClick={()=>start(task)}>Sayıma git</button></div>}</article>;
   })}
   {!data.tasks?.length&&<p>Planlanmış sayım yok.</p>}
  </section>
  {period&&<Dialog title={period==='daily'?'Günlük not':'Haftalık not'} close={()=>setPeriod(null)}>
   <ActionForm submit="Notu yayımla" action={async f=>{await save('notes',{period,text:f.get('text')});setPeriod(null);}}>
    <label>Not<textarea name="text" className={field} rows={4} required maxLength={1000} defaultValue={data.notes?.find(n=>n.period===period)?.text}/></label>
   </ActionForm></Dialog>}
  {edit!==undefined&&<Dialog title={edit?'Sayım görevini düzenle':'Sayım görevi oluştur'} close={()=>setEdit(undefined)}>
   <ActionForm submit="Görevi kaydet" action={async f=>{await save('tasks',{...Object.fromEntries(f),id:edit?.id});setEdit(undefined);}}>
    <Branch branches={data.branches} value={branch} onChange={setBranch}/>
    <label>Sayım adı<input className={field} name="title" required maxLength={100} defaultValue={edit?.title}/></label>
    <label>Planlanan tarih<input className={field} type="date" name="due" required min={dayKey(new Date().toISOString())} defaultValue={edit?.due}/></label>
   </ActionForm></Dialog>}
 </div>;
}
