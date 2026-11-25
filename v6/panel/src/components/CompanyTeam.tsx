import { useEffect, useState, type FormEvent } from 'react';

type Role = 'owner' | 'manager' | 'employee';
type Team = {
  company: { name: string; role: Role } | null;
  team: { name: string; email: string; role: Role }[];
};
const roles = { owner: 'Patron', manager: 'Yönetici', employee: 'Çalışan' };

async function request(path: string, data?: Record<string, FormDataEntryValue>) {
  const response = await fetch('/api/team' + path, data && {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Ege-Request': '1'},
    body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'İşlem tamamlanamadı.');
  return result;
}

export default function CompanyTeam() {
  const [view, setView] = useState<Team>();
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [busy,setBusy] = useState(false);
  useEffect(() => {
    request('').then(setView).catch(error => setMessage(error.message));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    setBusy(true);
    setToken('');
    setMessage('');
    try {
      const result = await request(action, Object.fromEntries(new FormData(event.currentTarget)));
      if (action === '/invite') setToken(result.token);
      else window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  }
  const input='mt-1 block w-full rounded-lg border border-slate-300 p-3';
  const button='rounded-lg bg-cyan-800 px-4 py-2 font-semibold text-white disabled:opacity-50';
  return <section className="mx-auto max-w-3xl space-y-4 rounded-xl bg-white p-4 sm:p-6">
    <h1 className="text-xl font-bold">Şirket ve Ekip</h1>
    {view?.company && <p>{view.company.name} · {roles[view.company.role]}</p>}
    {view && !view.company && <div className="grid gap-4 sm:grid-cols-2">
      <form className="space-y-3" onSubmit={event => submit(event, '/create')}>
        <label>Şirket adı<input className={input} name="companyName" required maxLength={100} /></label>
        <button className={button} disabled={busy}>Şirket oluştur</button>
      </form>
      <form className="space-y-3" onSubmit={event => submit(event, '/join')}>
        <label>Davet kodu<input className={input} name="inviteCode" required maxLength={48} /></label>
        <button className={button} disabled={busy}>Davete katıl</button>
      </form>
    </div>}
    {view?.company?.role === 'owner' && <>
      <ul className="divide-y">{view.team.map(member => <li className="py-2" key={member.email}>
        <strong>{member.name}</strong><div>{member.email} · {roles[member.role]}</div>
      </li>)}</ul>
      <form className="space-y-3" onSubmit={event => submit(event, '/invite')}>
        <label>E-posta adresi<input className={input} name="email" type="email" required maxLength={254} /></label>
        <label>Rol<select className={input} name="role"><option value="employee">Çalışan</option><option value="manager">Yönetici</option></select></label>
        <button className={button} disabled={busy}>Davet kodu oluştur</button>
      </form>
    </>}
    {token && <div role="status"><p>24 saat geçerli davet kodunu kullanıcıyla paylaş.</p><input className={input} readOnly aria-label="Davet kodu" value={token} onFocus={event => event.currentTarget.select()} /></div>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
