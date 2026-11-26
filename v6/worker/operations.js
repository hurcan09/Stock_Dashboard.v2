const q=(db,sql,...values)=>db.prepare(sql).bind(...values);
const pages={dashboard:'Anasayfa',materials:'Malzeme',invoices:'Fatura','stock-count':'Stok Sayımı','count-history':'Sayım Geçmişi',reports:'Raporlar','company-team':'Şirket ve Ekip','users':'Kullanıcılar',profile:'Profil',activities:'Sistem Aktiviteleri'};
export async function profile(db,id){
 const find=()=>q(db,'SELECT m.name,m.email,p.* FROM members m JOIN v6_profiles p ON p.member=m.id WHERE m.id=?',id).first();
 let row=await find();
 for(let i=0;!row&&i<32;i++){
  const number=10000+crypto.getRandomValues(new Uint32Array(1))[0]%90000;
  await q(db,'INSERT OR IGNORE INTO v6_profiles(member,public_id) VALUES(?,?)',id,number).run();
  row=await find();
 }
 return row;
}
export async function logActivity(db,company,id,page,action,branch=company?.branch){
 if(company)return q(db,'INSERT INTO v6_activities(company,member,branch,page,action) VALUES(?,?,?,?,?)',company.id,id,branch??null,pages[page]||page,action).run();
}
export async function operationsApi(db,req,path,id,company){
 if(!id)return Response.json({}, {status:401});
 const p=await profile(db,id);
 if(!p)return Response.json({error:'Profil oluşturulamadı.'},{status:503});
 const reply=data=>Response.json(data,{headers:{'Cache-Control':'no-store'}});
 if(req.method==='GET'&&path==='/api/profile')return reply(p);
 if(req.method==='GET'&&path==='/api/activities'){
  if(!company)return reply([]);
  const filters=company.role==='owner'?[]:company.role==='manager'&&company.branch?[company.branch,id]:[id];
  const clause=filters.length===0?'':filters.length===2?' AND (a.branch=? OR a.member=?)':' AND a.member=?';
  return reply((await q(db,`SELECT a.id,a.page,a.action,a.at,m.name,p.public_id FROM v6_activities a JOIN members m ON m.id=a.member LEFT JOIN v6_profiles p ON p.member=m.id WHERE a.company=?${clause} ORDER BY a.id DESC LIMIT 200`,company.id,...filters).all()).results);
 }
 if(req.method!=='POST'||req.headers.get('X-Ege-Request')!=='1')return Response.json({}, {status:403});
 const data=await req.json().catch(()=>null);
 if(!data)return Response.json({}, {status:400});
 if(path==='/api/profile'){
  const fields=['phone','address','city','district'];
  const values=fields.map(key=>typeof data[key]==='string'?data[key].trim():null);
  if(values.some((v,i)=>v===null||v.length>[40,400,80,80][i]))return Response.json({error:'Profil alanlarını kontrol edin.'},{status:400});
  await q(db,'UPDATE v6_profiles SET phone=?,address=?,city=?,district=? WHERE member=?',...values,id).run();
  await logActivity(db,company,id,'profile','Profil bilgilerini güncelledi');
  return reply({});
 }
 if(path==='/api/activities'&&Object.hasOwn(pages,data.page)){
  await logActivity(db,company,id,data.page,'Sayfayı açtı');
  return reply({});
 }
 return Response.json({}, {status:404});
}
