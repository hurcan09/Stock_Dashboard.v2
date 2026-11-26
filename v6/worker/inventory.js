import units from './units.json';
import accounts from './accounts.json';

const demoCompany='ege-mavi-kiyi-2026';
const demoPeople=[['demo-0','owner',null],['demo-1','manager','izmir'],['demo-2','manager','ankara'],['demo-4','employee','izmir'],['demo-5','employee','ankara']];
const empty={branches:[],products:[],invoices:[],counts:[]};
const clean=(value,max=100)=>typeof value==='string'&&value.trim().length<=max?value.trim():'';
const integer=(n,max=1000000)=>Number.isInteger(n)&&n>=0&&n<=max;
const result=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const error=(status,message)=>result({error:message},status);
const now=()=>new Date().toISOString();
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);

function seedData(){
 const branches=[{id:'izmir',name:'İzmir Merkez'},{id:'ankara',name:'Ankara'}];
 const catalog=['Kraft koli','Kargo zarfı','Paket bandı','Etiket rulosu','Köpük levha','Streç film','Balonlu naylon','Kraft torba','Arşiv kutusu','Sevkiyat poşeti','Palet örtüsü','Karton seperatör'];
 const date='2026-11-25T07:15:00.000Z', state={branches,products:[],invoices:[],counts:[]};
 for(const [index,branch] of branches.entries()){
  const lines=catalog.map((name,i)=>{
   const id=branch.id+'-'+(i+1),expected=20+index*5+i,actual=expected-(i%4===0?2:0),price=1250+i*175;
   state.products.push({id,branch:branch.id,name,sku:(index?'ANK':'IZM')+'-'+String(i+1).padStart(3,'0'),quantity:actual,price,minimum:10});
   return {id,name,expected,actual,quantity:expected,price,valuationPrice:price};
  });
  state.invoices.push({id:'f-'+branch.id,branch:branch.id,number:'FTR-2026-11-00'+(index+1),supplier:'Mavi Ambalaj',date,lines});
  state.counts.push({id:'s-'+branch.id,branch:branch.id,title:'Kasım Sayımı · '+branch.name,date,author:index?'demo-5':'demo-4',authorName:index?'Bora Sel':'Duru Kaya',lines});
 }
 return state;
}
export async function ensureFixture(db,email){
 const people=demoPeople.map(([id,role,branch])=>({account:accounts.find(a=>a.id===id),role,branch}));
 if(!people.some(({account})=>account.email===email))return;
 if(await stmt(db,'SELECT company FROM v6_inventory WHERE company=?',demoCompany).first())return;
 await db.batch([
  stmt(db,'INSERT OR IGNORE INTO v6_companies VALUES(?,?)',demoCompany,'Mavi Kıyı Tedarik'),
  ...people.map(({account:a})=>stmt(db,'INSERT OR IGNORE INTO members VALUES(?,?,?,?,?)',a.id,a.email,a.name,a.salt,a.hash)),
  ...people.map(({account:a,role,branch})=>stmt(db,'INSERT OR IGNORE INTO v6_team(member,company,role,branch) VALUES(?,?,?,?)',a.id,demoCompany,role,branch)),
  stmt(db,'INSERT OR IGNORE INTO v6_inventory(company,data) VALUES(?,?)',demoCompany,JSON.stringify(seedData()))
 ]);
}
export async function readInventory(db,company){
 const row=await stmt(db,'SELECT revision,data FROM v6_inventory WHERE company=?',company).first();
 return row?{revision:row.revision,state:JSON.parse(row.data)}:{revision:0,state:structuredClone(empty)};
}
function invoiceDate(value){
 if(value===undefined)return now();
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const parsed=new Date(value+'T12:00:00.000Z');
 return Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===value?parsed.toISOString():null;
}
const productFields=['barcode','gtin','serial','category','subcategory'];
export async function inventoryApi(db,member,user,req,path){
 if(!member)return error(403,'Önce bir şirkete katılın.');
 const {state,revision}=await readInventory(db,member.id);
 state.tasks??=[];
 state.notes??=[];
 let affectedBranch=null;
 const owner=member.role==='owner',manager=member.role==='manager';
 const accessible=id=>owner||id===member.branch;
 if(req.method==='GET'&&path==='/api/inventory'){
  return result({
   company:member.name,role:member.role,
   branches:state.branches.filter(row=>accessible(row.id)),
   products:state.products.filter(row=>accessible(row.branch)),
   invoices:state.invoices.filter(row=>accessible(row.branch)&&(owner||manager)),
   tasks:state.tasks.filter(t=>accessible(t.branch)),
   notes:state.notes.filter(n=>n.expires>=now()),
   counts:state.counts.filter(row=>accessible(row.branch)&&(owner||manager||row.author===user.id))
  });
 }
 if(req.method!=='POST'||req.headers.get('X-Ege-Request')!=='1')return error(403,'İşlem doğrulanamadı.');
 const data=await req.json().catch(()=>null);
 if(!data||typeof data!=='object')return error(400,'Formu kontrol edin.');
 const id=crypto.randomUUID(),branch=state.branches.find(row=>row.id===data.branch);
 if(path==='/api/inventory/notes'){
  if(!owner)return error(403,'Kurucu yetkisi gerekir.');
  const text=clean(data.text,1000);
  if(!text||!['daily','weekly'].includes(data.period))return error(400,'Not ve dönem zorunlu.');
  state.notes=state.notes.filter(n=>n.expires>=now()&&n.period!==data.period);
  state.notes.push({id,period:data.period,text,date:now(),expires:new Date(Date.now()+(data.period==='daily'?1:7)*86400000).toISOString()});
 }else if(path==='/api/inventory/tasks'){
  if(!owner)return error(403,'Kurucu yetkisi gerekir.');
  const title=clean(data.title),due=data.due;
  if(!branch||!title||!due||!invoiceDate(due)||due<new Date(Date.now()+10800000).toISOString().slice(0,10))return error(400,'Şube, başlık ve ileri tarih seçin.');
  const task={id:id,branch:branch.id,title,due};
  if(data.id){
   const index=state.tasks.findIndex(t=>t.id===data.id);
   if(index<0||state.counts.some(c=>c.task===data.id&&c.status!=='rejected'))return error(409,'İşleme alınan görev değiştirilemez.');
   task.id=data.id;state.tasks[index]=task;
  }else state.tasks.push(task);
  affectedBranch=branch.id;
 }else if(path==='/api/inventory/approve'||path==='/api/inventory/reject'){
  const count=state.counts.find(c=>c.id===data.id&&accessible(c.branch));
  const permission=count&&(manager&&count.status==='manager_pending'||owner&&count.status==='owner_pending');
  if(!permission)return error(403,'Bu aşama için onay yetkiniz yok.');
  affectedBranch=count.branch;
  count.approvals.push({name:user.name,date:now(),role:member.role,decision:path.endsWith('/reject')?'rejected':'approved'});
  if(path.endsWith('/reject'))count.status='rejected';
  else if(manager)count.status='owner_pending';
  else{
   const rows=count.lines.map(line=>state.products.find(p=>p.id===line.id&&p.branch===count.branch));
   if(rows.some((p,i)=>!p||p.quantity!==count.lines[i].expected))return error(409,'Stok sayımdan sonra değişti. Sayımı düzeltmeye gönderin.');
   rows.forEach((p,i)=>{p.quantity=count.lines[i].actual;count.lines[i].valuationPrice=p.price;});
   count.status='approved';
   count.approvedAt=now();
  }
 }else if(path==='/api/inventory/branches'){
  if(!owner)return error(403,'Şubeyi yalnızca Sistem Kurucusu oluşturabilir.');
  const name=clean(data.name);
  if(!name||state.branches.some(row=>row.name.toLocaleLowerCase('tr')===name.toLocaleLowerCase('tr')))return error(400,'Benzersiz bir şube adı girin.');
  state.branches.push({id,name});
 }else{
  if(!branch||!accessible(branch.id))return error(403,'Bu şubeye erişiminiz yok.');
  affectedBranch=branch.id;
  if(path==='/api/inventory/products'||path==='/api/inventory/import'){
   if(!owner&&!manager)return error(403,'Malzeme ekleme yetkiniz yok.');
   const rows=path.endsWith('/import')?data.rows:[data];
   if(!Array.isArray(rows)||rows.length<1||rows.length>500)return error(400,'Bir işlemde 1–500 malzeme ekleyin.');
   for(const row of rows){
    const name=clean(row?.name),sku=clean(row?.sku),unit=row?.unit||'Adet';
    if(!name||!sku||!units.includes(unit)||!integer(row.quantity)||!integer(row.minimum)||!integer(row.price,100000000)||state.products.some(p=>p.branch===branch.id&&p.sku.toLocaleLowerCase('tr')===sku.toLocaleLowerCase('tr')))return error(400,'Stok kodu benzersiz olmalı. Miktar, fiyat ve birimi kontrol edin.');
    const fields=Object.fromEntries(productFields.map(field=>[field,clean(row[field])]));
    state.products.push({id:crypto.randomUUID(),branch:branch.id,name,sku,...fields,unit,quantity:row.quantity,minimum:row.minimum,price:row.price,createdAt:now()});
   }
  }else if(path==='/api/inventory/invoices'||path==='/api/inventory/counts'){
   const invoice=path.endsWith('/invoices');
   if(invoice&&!owner&&!manager)return error(403,'Fatura kaydetme yetkiniz yok.');
   if(!Array.isArray(data.lines)||!data.lines.length||data.lines.length>100)return error(400,'En az bir benzersiz malzeme seçin.');
   const lines=[],seen=new Set();
   for(const line of data.lines){
    if(!line||typeof line!=='object')return error(400,'Kalem bilgilerini kontrol edin.');
    const sku=clean(line.sku);
    let product=line.id?state.products.find(row=>row.id===line.id&&row.branch===branch.id):undefined;
    let metadata={};
    if(invoice){
     const name=clean(line.name),unit=line.unit||product?.unit||'Adet';
     if(!units.includes(unit))return error(400,'Geçerli bir birim seçin.');
     metadata={unit};
     for(const field of productFields)if(line[field]!==undefined){
      if(typeof line[field]!=='string'||line[field].trim().length>100)return error(400,'Ürün bilgileri en fazla 100 karakter olabilir.');
      metadata[field]=clean(line[field]);
     }
     if(!line.id&&sku){
      product=state.products.find(p=>p.branch===branch.id&&p.sku.toLocaleLowerCase('tr')===sku.toLocaleLowerCase('tr'));
      if(!product&&name){
       product={id:crypto.randomUUID(),branch:branch.id,sku,name,quantity:0,minimum:0,price:0,createdAt:now()};
       state.products.push(product);
      }
     }
     if(product?.unit&&product.unit!==unit&&product.quantity>0)return error(400,'Stokta bulunan malzeme için aynı birimi kullanın.');
    }
    if(!product||seen.has(product.id)||!integer(line.quantity)||invoice&&(!line.quantity||!integer(line.price,100000000)))return error(400,'Kalem ve miktar bilgilerini kontrol edin. Aynı malzemeyi bir kez ekleyin.');
    seen.add(product.id);
    if(!invoice&&line.expected!==product.quantity)return error(409,'Stok güncellendi. Sayfayı yenileyip tekrar sayın.');
    if(invoice&&!integer(product.quantity+line.quantity))return error(400,'Stok miktarı üst sınırı aşıldı.');
    if(invoice){
     Object.assign(product,metadata);
     lines.push({id:product.id,name:clean(line.name)||product.name,sku:product.sku,...Object.fromEntries(productFields.map(field=>[field,product[field]])),unit:product.unit,quantity:line.quantity,price:line.price});
     product.quantity+=line.quantity;product.price=line.price;
    }else{
     lines.push({id:product.id,name:product.name,expected:product.quantity,actual:line.quantity,valuationPrice:product.price});

    }
   }
   if(invoice){
    const number=clean(data.number),supplier=clean(data.supplier);
    const date=invoiceDate(data.date);
    if(!date)return error(400,'Geçerli bir fatura tarihi girin.');
    if(!number||!supplier||state.invoices.some(row=>row.branch===branch.id&&row.number===number))return error(400,'Benzersiz fatura numarası ve tedarikçi zorunlu.');
    state.invoices.unshift({id,branch:branch.id,number,supplier,date,lines});
   }else{
    const title=clean(data.title);
    if(!title)return error(400,'Sayım adı zorunlu.');
    const task=data.task&&state.tasks.find(t=>t.id===data.task&&t.branch===branch.id);
    if(data.task&&(!task||state.counts.some(c=>c.task===task.id&&c.status!=='rejected')))return error(409,'Görev kullanılamıyor.');
    state.counts.unshift({id,branch:branch.id,title,date:now(),author:user.id,authorName:user.name,lines,task:task?.id,status:'manager_pending',approvals:[]});
   }
  }else return error(404,'İşlem bulunamadı.');
 }
 const changed=revision===0
  ?await stmt(db,'INSERT INTO v6_inventory(company,revision,data) VALUES(?,1,?) ON CONFLICT(company) DO UPDATE SET revision=1,data=excluded.data WHERE revision=0',member.id,JSON.stringify(state)).run()
  :await stmt(db,'UPDATE v6_inventory SET revision=revision+1,data=? WHERE company=? AND revision=?',JSON.stringify(state),member.id,revision).run();
 return changed.meta.changes?result({id,branch:affectedBranch},201):error(409,'Aynı anda başka bir kayıt değişti. Yenileyip tekrar deneyin.');
}
