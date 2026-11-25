import { ensureFixture, inventoryApi, readInventory } from './inventory.js';
import { membership } from './membership.js';
import accounts from './accounts.json';
import assets from './assets.json';
import login from './login.html';
import css from './gate.css';
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const random=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
const encode=s=>new TextEncoder().encode(s);
const digest=async s=>hex(await crypto.subtle.digest('SHA-256',encode(s)));
async function derive(password,salt){
 const key=await crypto.subtle.importKey('raw',encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:100000,salt:Uint8Array.from(salt.match(/../g),s=>parseInt(s,16))},key,256));
}
const send=(body,type,status=200,extra={})=>new Response(body,{status,headers:{'Content-Type':type,'Cache-Control':'no-store',...extra}});
const json=(v,status=200,extra)=>send(JSON.stringify(v),'application/json',status,extra);
const cookie=(v,age)=>({'Set-Cookie':'ege_v6='+v+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+age});
export default {async fetch(req,env){
 const path=new URL(req.url).pathname, db=env.DB;
 const memberships=membership(db,digest);
 if(path==='/gate.css')return send(css,'text/css');
 const token=(req.headers.get('Cookie')||'').match(/(?:^|;\s*)ege_v6=([a-f0-9]{64})/)?.[1];
 const session=token?await db.prepare('SELECT member FROM sessions WHERE token=? AND expires>?').bind(await digest(token),Date.now()).first():null;
 const knownDemo=session&&accounts.find(a=>a.id===session.member);
 if(knownDemo)await ensureFixture(db,knownDemo.email);
 if(path.startsWith('/api/inventory')){
  if(!session)return json({error:'Oturum açın.'},401);
  const user=await db.prepare('SELECT id,name FROM members WHERE id=?').bind(session.member).first();
  return inventoryApi(db,await memberships.get(session.member),user,req,path);
 }
 if(req.method==='POST'){
  if(req.headers.get('X-Ege-Request')!=='1')return json({},403);
  if(path==='/api/logout'){if(token)await db.prepare('DELETE FROM sessions WHERE token=?').bind(await digest(token)).run();return json({},200,cookie('',0));}
  if(path==='/api/team/invite'||path==='/api/team/assignment'||path==='/api/team/account'){
   if(!session)return json({error:'Oturum açın.'},401);
   const user=await db.prepare('SELECT * FROM members WHERE id=?').bind(session.member).first();
   if(!user)return json({error:'Hesap bulunamadı.'},403);
   const data=await req.json().catch(()=>null);
   if(!data)return json({error:'Formu kontrol edin.'},400);
   if(path==='/api/team/account'){
    const email=String(data.email||'').trim().toLowerCase(),password=data.password;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||(password&&(typeof password!=='string'||password.length<10||password.length>256)))return json({error:'E-posta veya yeni şifre geçersiz.'},400);
    if(typeof data.currentPassword!=='string'||data.currentPassword.length>256||await derive(data.currentPassword,user.salt)!==user.hash)return json({error:'Mevcut şifre hatalı.'},403);
    if(accounts.some(a=>a.email===email&&a.id!==user.id))return json({error:'Bu e-posta kullanımda.'},409);
    const salt=password?random(16):user.salt,hash=password?await derive(password,salt):user.hash;
    try {
     await db.batch([
      db.prepare('UPDATE members SET email=?,salt=?,hash=? WHERE id=?').bind(email,salt,hash,user.id),
      db.prepare('DELETE FROM sessions WHERE member=?').bind(user.id)
     ]);
    }catch{return json({error:'E-posta değiştirilemedi.'},409);}
    return json({},200,cookie('',0));
   }
   const company=await memberships.get(user.id);
   if(company?.role!=='owner')return json({error:'Bu işlem patron yetkisi gerektirir.'},403);
   const {state}=await readInventory(db,company.id);
   if(!state.branches.some(b=>b.id===data.branch)||!['manager','employee'].includes(data.role))return json({error:'Şube ve rol seçin.'},400);
   if(path==='/api/team/assignment'){
    const r=await db.prepare("UPDATE v6_team SET branch=?,role=? WHERE member=? AND company=? AND role<>'owner'").bind(data.branch,data.role,String(data.member||''),company.id).run();
    return r.meta.changes?json({}):json({error:'Ekip üyesi bulunamadı.'},404);
   }
   const email=String(data.email||'').trim().toLowerCase();
   if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'E-posta adresini kontrol edin.'},400);
   if(accounts.some(a=>a.email===email))return json({error:'Mevcut demo hesabının şubesini ekip ayarlarından değiştirin.'},400);
   return json({token:await memberships.invite(company.id,email,data.role,data.branch)},201);
  }
  if(path==='/api/team/join'){
   if(!session)return json({error:'Oturum açın.'},401);
   const member=await db.prepare('SELECT id,email FROM members WHERE id=?').bind(session.member).first();
   if(!member||await memberships.get(member.id))return json({error:'Bu hesap davete katılamaz.'},403);
   const data=await req.json().catch(()=>({}));
   const changes=await memberships.accept(String(data.inviteCode||'').trim(),member.email,member.id);
   if(!changes)return json({error:'Davet geçersiz, kullanılmış veya bu e-postaya ait değil.'},403);
   try{await db.batch(changes);}catch{return json({error:'Davet bu oturumda kullanılamadı.'},409);}
   return json({},201);
  }
  if(!['/api/register','/api/login'].includes(path))return json({},404);
  const p=await req.json().catch(()=>({}));const email=String(p.email||'').trim().toLowerCase(),name=String(p.name||'').trim(),pw=p.password;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof pw!=='string'||!pw||pw.length>256)return json({error:'E-posta ve şifreyi kontrol edin.'},400);
  if(path==='/api/login')await ensureFixture(db,email);
  let u=await db.prepare('SELECT * FROM members WHERE email=?').bind(email).first();
  if(path==='/api/register'&&accounts.some(a=>a.email===email))return json({error:'Bu e-posta kullanımda.'},409);
  if(path==='/api/register'){
   if(u||!name||name.length>80||pw.length<10)return json({error:'Kayıt tamamlanamadı. E-posta, ad ve şifreyi kontrol edin.'},400);
   const salt=random(16);u={id:crypto.randomUUID(),email,name,salt,hash:await derive(pw,salt)};
   const companyName=String(p.companyName||'').trim();
   const inviteCode=String(p.inviteCode||'').trim();
   if(companyName.length>100||Boolean(companyName)===Boolean(inviteCode))return json({error:'Şirket adı girin veya davet kodu kullanın.'},400);
   const changes=companyName?memberships.create(u.id,companyName):await memberships.accept(inviteCode,email,u.id);
   if(!changes)return json({error:'Davet geçersiz, kullanılmış veya bu e-postaya ait değil.'},403);
   try{await db.batch([db.prepare('INSERT INTO members VALUES(?,?,?,?,?)').bind(u.id,email,name,salt,u.hash),...changes]);}
   catch{return json({error:'Hesap oluşturulamadı. E-posta veya daveti kontrol edin.'},409);}
  }else{
   const derived=await derive(pw,(u||accounts[0]).salt);if(!u||derived!==u.hash)return json({error:'E-posta veya şifre hatalı.'},401);
  }
  const raw=random(32);await db.batch([db.prepare('DELETE FROM sessions WHERE expires<=? OR token=?').bind(Date.now(),await digest(token||'')),db.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await digest(raw),u.id,Date.now()+28800000)]);
  return json({},200,cookie(raw,28800));
 }
 if(path==='/api/me'){
  if(!session)return json({},401);
  const u=await db.prepare('SELECT id,name,email FROM members WHERE id=?').bind(session.member).first();
  if(!u)return json({},401);
  const company=await memberships.get(u.id);
  const roles={owner:'admin',manager:'manager',employee:'staff'};
  return json({id:u.id,email:u.email,name:u.name,role:company?roles[company.role]:u.role||'staff',department:company?.name||u.department||'',companyRole:company?.role||null});
 }
 if(path==='/api/team'){
  if(!session)return json({error:'Oturum açın.'},401);
  const company=await memberships.get(session.member);
  const user=await db.prepare('SELECT email FROM members WHERE id=?').bind(session.member).first();
  if(!user)return json({error:'Tekrar giriş yapın.'},401);
  return json({company,email:user.email,team:company?.role==='owner'?await memberships.team(company.id):[]});
 }
 if(!session&&(path==='/'||path==='/index.html'))return send(login,'text/html; charset=utf-8');
 if(!session&&path!=='/ege-envanter.png')return json({},401);
 const key=path==='/'?'/index.html':path;if(!Object.hasOwn(assets,key))return json({},404);
 const mime={js:'text/javascript',css:'text/css',png:'image/png',html:'text/html; charset=utf-8',svg:'image/svg+xml'}[key.split('.').pop()];
 return send(Uint8Array.from(atob(assets[key]),c=>c.charCodeAt(0)),mime||'application/octet-stream');
}};
