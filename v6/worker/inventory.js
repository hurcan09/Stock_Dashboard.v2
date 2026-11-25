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
   return {id,name,expected,actual,quantity:expected,price};
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
export async function inventoryApi(db,member,user,req,path){
 if(!member)return error(403,'Önce bir şirkete katılın.');
 const {state,revision}=await readInventory(db,member.id);
 const owner=member.role==='owner',manager=member.role==='manager';
 const accessible=id=>owner||id===member.branch;
 if(req.method==='GET'&&path==='/api/inventory'){
  return result({
   company:member.name,role:member.role,
   branches:state.branches.filter(row=>accessible(row.id)),
   products:state.products.filter(row=>accessible(row.branch)),
   invoices:state.invoices.filter(row=>accessible(row.branch)&&(owner||manager)),
   counts:state.counts.filter(row=>accessible(row.branch)&&(owner||manager||row.author===user.id))
  });
 }
 if(req.method!=='POST'||req.headers.get('X-Ege-Request')!=='1')return error(403,'İşlem doğrulanamadı.');
 const data=await req.json().catch(()=>null);
 if(!data||typeof data!=='object')return error(400,'Formu kontrol edin.');
 const id=crypto.randomUUID(),branch=state.branches.find(row=>row.id===data.branch);
 if(path==='/api/inventory/branches'){
  if(!owner)return error(403,'Şubeyi yalnızca patron oluşturabilir.');
  const name=clean(data.name);
  if(!name||state.branches.some(row=>row.name.toLocaleLowerCase('tr')===name.toLocaleLowerCase('tr')))return error(400,'Benzersiz bir şube adı girin.');
  state.branches.push({id,name});
 }else{
  if(!branch||!accessible(branch.id))return error(403,'Bu şubeye erişiminiz yok.');
  if(path==='/api/inventory/products'){
   if(!owner&&!manager)return error(403,'Malzeme ekleme yetkiniz yok.');
   const name=clean(data.name),sku=clean(data.sku);
   if(!name||!sku||!integer(data.quantity)||!integer(data.minimum)||!integer(data.price,100000000)||state.products.some(row=>row.branch===branch.id&&row.sku===sku))return error(400,'Benzersiz stok kodu ve geçerli miktar girin.');
   state.products.push({id,branch:branch.id,name,sku,quantity:data.quantity,minimum:data.minimum,price:data.price});
  }else if(path==='/api/inventory/invoices'||path==='/api/inventory/counts'){
   const invoice=path.endsWith('/invoices');
   if(invoice&&!owner&&!manager)return error(403,'Fatura kaydetme yetkiniz yok.');
   if(!Array.isArray(data.lines)||!data.lines.length||data.lines.length>100||new Set(data.lines.map(line=>line?.id)).size!==data.lines.length)return error(400,'En az bir benzersiz malzeme seçin.');
   const lines=[];
   for(const line of data.lines){
    const product=state.products.find(row=>row.id===line?.id&&row.branch===branch.id);
    if(!product||!integer(line.quantity)||invoice&&(!line.quantity||!integer(line.price,100000000)))return error(400,'Kalem bilgilerini kontrol edin.');
    if(!invoice&&line.expected!==product.quantity)return error(409,'Stok güncellendi. Sayfayı yenileyip tekrar sayın.');
    if(invoice&&!integer(product.quantity+line.quantity))return error(400,'Stok miktarı üst sınırı aşıldı.');
    if(invoice){
     lines.push({id:product.id,name:product.name,quantity:line.quantity,price:line.price});
     product.quantity+=line.quantity;product.price=line.price;
    }else{
     lines.push({id:product.id,name:product.name,expected:product.quantity,actual:line.quantity});
     product.quantity=line.quantity;
    }
   }
   if(invoice){
    const number=clean(data.number),supplier=clean(data.supplier);
    if(!number||!supplier||state.invoices.some(row=>row.branch===branch.id&&row.number===number))return error(400,'Benzersiz fatura numarası ve tedarikçi zorunlu.');
    state.invoices.unshift({id,branch:branch.id,number,supplier,date:now(),lines});
   }else{
    const title=clean(data.title);
    if(!title)return error(400,'Sayım adı zorunlu.');
    state.counts.unshift({id,branch:branch.id,title,date:now(),author:user.id,authorName:user.name,lines});
   }
  }else return error(404,'İşlem bulunamadı.');
 }
 const changed=revision===0
  ?await stmt(db,'INSERT INTO v6_inventory(company,revision,data) VALUES(?,1,?) ON CONFLICT(company) DO UPDATE SET revision=1,data=excluded.data WHERE revision=0',member.id,JSON.stringify(state)).run()
  :await stmt(db,'UPDATE v6_inventory SET revision=revision+1,data=? WHERE company=? AND revision=?',JSON.stringify(state),member.id,revision).run();
 return changed.meta.changes?result({id},201):error(409,'Aynı anda başka bir kayıt değişti. Yenileyip tekrar deneyin.');
}
