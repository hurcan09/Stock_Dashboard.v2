export function membership(db, digest) {
  const query = (sql,...args) => db.prepare(sql).bind(...args);
  const get = id => query('SELECT c.id,c.name,t.role,t.branch FROM v6_team t JOIN v6_companies c ON c.id=t.company WHERE t.member=?',id).first();
  function create(id,name) {
    const company = crypto.randomUUID();
    return [
      query('INSERT INTO v6_companies VALUES(?,?)',company,name),
      query('INSERT INTO v6_team(member,company,role) VALUES(?,?,?)',id,company,'owner')
    ];
  }
  async function accept(token,email,id) {
    if (!/^[a-f0-9]{48}$/.test(token)) return null;
    const key=await digest(token);
    const invite=await query('SELECT * FROM v6_invites WHERE token=? AND email=? AND expires>?',key,email,Date.now()).first();
    if (!invite) return null;
    return [
      query('INSERT INTO v6_team VALUES(?,(SELECT company FROM v6_invites WHERE token=?),(SELECT role FROM v6_invites WHERE token=?),(SELECT branch FROM v6_invites WHERE token=?))',id,key,key,key),
      query('DELETE FROM v6_invites WHERE token=?',key)
    ];
  }
  async function team(company) {
    const result=await query('SELECT m.id,m.name,m.email,t.role,t.branch FROM v6_team t JOIN members m ON m.id=t.member WHERE t.company=? ORDER BY m.name',company).all();
    return result.results;
  }
  async function invite(company,email,role,branch) {
    const token=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
    await query('INSERT INTO v6_invites VALUES(?,?,?,?,?,?)',await digest(token),company,email,role,Date.now()+86400000,branch).run();
    return token;
  }
  return {get,create,accept,team,invite};
}
