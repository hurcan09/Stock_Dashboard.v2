import accounts from './accounts.json';
export async function ensureDemo(db, id) {
 const people=[['demo-0',null,'owner'],['demo-1','izmir','manager'],['demo-2','ankara','manager'],['demo-4','izmir','employee'],['demo-5','ankara','employee']];
 if(!people.some(p=>p[0]===id))return;
 if(await db.prepare('SELECT id FROM companies WHERE id=?').bind('mavi-demo').first())return;
 const stmt=(sql,...v)=>db.prepare(sql).bind(...v);
 const ts=new Date().toISOString();
 await db.batch([
  stmt('INSERT OR IGNORE INTO companies VALUES(?,?)','mavi-demo','Mavi Kıyı Test'),
  stmt('INSERT OR IGNORE INTO branches VALUES(?,?,?,?)','izmir','mavi-demo','İzmir Merkez','Ege'),
  stmt('INSERT OR IGNORE INTO branches VALUES(?,?,?,?)','ankara','mavi-demo','Ankara','İç Anadolu'),
  ...people.map(([id,branch,role])=>{const {name,email}=accounts.find(u=>u.id===id); return stmt('INSERT OR IGNORE INTO memberships VALUES(?,?,?,?,?,?)',id,'mavi-demo',branch,name,email,role);}),
  stmt('INSERT OR IGNORE INTO products VALUES(?,?,?,?,?)','demo-izmir','izmir','Paket','IZ-001',20),
  stmt('INSERT OR IGNORE INTO products VALUES(?,?,?,?,?)','demo-ankara','ankara','Koli','AN-001',50),
  stmt('INSERT OR IGNORE INTO counts VALUES(?,?,?,?,?,?,?,?)','demo-count1','izmir','demo-izmir','demo-4',20,18,'İzmir Merkez manuel raf sayımı',ts),
  stmt('INSERT OR IGNORE INTO counts VALUES(?,?,?,?,?,?,?,?)','demo-count2','ankara','demo-ankara','demo-5',50,48,'Ankara manuel depo sayımı',ts)
 ]);
}
