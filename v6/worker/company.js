
const fail = (status,message) => Response.json({error:message},{status});
const ok = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const clean = value => typeof value === 'string' ? value.trim() : '';
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');

export function companyRoutes(db, authenticate) {
  const stmt=(sql,...args)=>db.prepare(sql).bind(...args);
  const one=(sql,...args)=>stmt(sql,...args).first();
  const all=async(sql,...args)=>(await stmt(sql,...args).all()).results;
  const run=async(sql,...args)=>(await stmt(sql,...args).run()).meta;
  async function view(member){
    const scope=member.role==='owner'?[member.company]:[member.company,member.branch];
    const where='b.company=?'+(member.role==='owner'?'':' AND b.id=?');
    const branchRows=await all('SELECT b.id,b.name,b.region FROM branches b WHERE '+where+' ORDER BY b.name',...scope);
    const products=await all('SELECT p.*,b.name AS branch_name FROM products p JOIN branches b ON b.id=p.branch WHERE '+where+' ORDER BY p.name',...scope);
    const own=member.role==='employee'?' AND c.author=?':'';
    const counts=await all('SELECT c.*,p.name AS product_name,b.name AS branch_name,m.name AS author_name FROM counts c JOIN branches b ON b.id=c.branch JOIN products p ON p.id=c.product JOIN memberships m ON m.member=c.author WHERE '+where+own+' ORDER BY c.created_at DESC',...scope,...(own?[member.member]:[]));
    const team=member.role==='owner'?await all('SELECT member,name,email,role,branch FROM memberships WHERE company=? ORDER BY name',member.company):[];
    return {company:(await one('SELECT name FROM companies WHERE id=?',member.company)).name,role:member.role,member:member.member,branches:branchRows,products,counts,team};
  }

  return async request=>{
    const identity=await authenticate(request);
    if(!identity)return fail(401,'Oturum açın.');
    const path=new URL(request.url).pathname;
    const membership=()=>one('SELECT * FROM memberships WHERE member=?',identity.id);
    if(request.method==='GET'&&path==='/api/company'){const member=await membership();return ok(member?await view(member):{company:null});}
    if(request.method!=='POST')return fail(405,'Yöntem desteklenmiyor.');
    if(request.headers.get('X-Ege-Request')!=='1')return fail(403,'İstek doğrulanamadı.');
    const data=await request.json().catch(()=>null);
    if(!data||typeof data!=='object')return fail(400,'Form bilgilerini kontrol edin.');
    const member=await membership();
    const name=clean(data.name),region=clean(data.region),sku=clean(data.sku);
    const validName=value=>value.length>0&&value.length<=100;
    if(path==='/api/company/create'){
      const branch=clean(data.branch);
      if(member)return fail(409,'Hesap zaten bir şirkete bağlı.');
      if(![name,branch,region].every(validName))return fail(400,'Şirket, şube ve bölge zorunludur.');
      const company=crypto.randomUUID(),branchId=crypto.randomUUID();
      await db.batch([
        stmt('INSERT INTO companies VALUES(?,?)',company,name),
        stmt('INSERT INTO branches VALUES(?,?,?,?)',branchId,company,branch,region),
        stmt('INSERT INTO memberships VALUES(?,?,?,?,?,?)',identity.id,company,null,identity.name,identity.email,'owner')
      ]);
      return ok({},201);
    }
    if(path==='/api/company/join'){
      if(member)return fail(409,'Hesap zaten bir şirkete bağlı.');
      const token=await hash(clean(data.token));
      const [insert]=await db.batch([
        stmt('INSERT OR IGNORE INTO memberships SELECT ?,company,branch,?,?,role FROM invites WHERE token=? AND email=? AND expires>?',identity.id,identity.name,identity.email,token,identity.email,Date.now()),
        stmt('DELETE FROM invites WHERE token=? AND changes()=1',token)
      ]);
      return insert.meta.changes?ok({},201):fail(403,'Bu hesap için geçerli davet bulunamadı.');
    }
    if(!member)return fail(403,'Önce şirket oluşturun veya davete katılın.');
    const branch=await one('SELECT * FROM branches WHERE id=? AND company=?',clean(data.branch),member.company);
    if(path==='/api/company/branches'){
      if(member.role!=='owner')return fail(403,'Şubeyi yalnızca patron açabilir.');
      if(!validName(name)||!validName(region))return fail(400,'Şube adı ve bölge zorunludur.');
      const result=await run('INSERT OR IGNORE INTO branches VALUES(?,?,?,?)',crypto.randomUUID(),member.company,name,region);
      return result.changes?ok({},201):fail(409,'Bu şube adı kullanılıyor.');
    }
    if(path==='/api/company/invites'||path==='/api/company/roles'){
      if(member.role!=='owner'||!branch)return fail(403,'Bu işlem patron yetkisi gerektirir.');
      if(!['manager','employee'].includes(data.role))return fail(400,'Yönetici veya çalışan rolü seçin.');
      if(path.endsWith('/roles')){
        const result=await run("UPDATE memberships SET role=?,branch=? WHERE member=? AND company=? AND role<>'owner'",data.role,branch.id,clean(data.member),member.company);
        return result.changes?ok({}):fail(404,'Ekip üyesi bulunamadı.');
      }
      const email=clean(data.email).toLowerCase();
      if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail(400,'Geçerli e-posta girin.');
      const token=crypto.randomUUID()+crypto.randomUUID();
      await run('INSERT INTO invites VALUES(?,?,?,?,?,?)',await hash(token),member.company,branch.id,email,data.role,Date.now()+86400000);
      return ok({token},201);
    }
    if(!branch||(member.role!=='owner'&&member.branch!==branch.id))return fail(403,'Bu şubeye erişiminiz yok.');
    if(path==='/api/company/products'){
      if(member.role==='employee')return fail(403,'Ürün açmak için yönetici yetkisi gerekir.');
      if(!validName(name)||!validName(sku)||!Number.isInteger(data.quantity)||data.quantity<0||data.quantity>1000000)return fail(400,'Ürün bilgilerini ve miktarı kontrol edin.');
      const result=await run('INSERT OR IGNORE INTO products VALUES(?,?,?,?,?)',crypto.randomUUID(),branch.id,name,sku,data.quantity);
      return result.changes?ok({},201):fail(409,'Bu stok kodu şubede zaten var.');
    }
    if(path==='/api/company/counts'){
      const note=clean(data.note),id=clean(data.product);
      if(!Number.isInteger(data.actual)||data.actual<0||data.actual>1000000||note.length>500)return fail(400,'Sayım miktarını ve notu kontrol edin.');
      const result=await run('INSERT INTO counts SELECT ?,branch,id,?,quantity,?,?,? FROM products WHERE id=? AND branch=? AND quantity=?',crypto.randomUUID(),member.member,data.actual,note,new Date().toISOString(),id,branch.id,data.expected);
      return result.changes?ok({},201):fail(409,'Ürün bulunamadı veya stok değişti. Sayfayı yenileyin.');
    }
    return fail(404,'İşlem bulunamadı.');
  };
}
