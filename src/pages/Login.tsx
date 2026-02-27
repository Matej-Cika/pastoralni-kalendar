import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'login' | 'register' | 'forgot'

export default function Login() {
  const { user, userProfile, isPriest, signInWithPassword, signUp, resetPasswordForEmail, updatePassword, loading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)
  const [isRecovery, setIsRecovery] = useState(() => typeof window !== 'undefined' && window.location.hash.includes('type=recovery'))
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  useEffect(() => {
    if (user && userProfile && !loading) {
      navigate(isPriest ? '/calendar' : '/request-booking', { replace: true })
    }
  }, [user, userProfile, isPriest, loading, navigate])

  function setModeAndClear(m: Mode) {
    setMode(m)
    setError(null)
    setForgotSent(false)
    if (m !== 'forgot') setConfirmPassword('')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    try {
      setError(null)
      setSubmitting(true)
      await signInWithPassword(email.trim(), password)
    } catch (err: unknown) {
      const obj = err && typeof err === 'object' ? (err as { message?: unknown; code?: unknown }) : {}
      const code = String((obj as { code?: unknown }).code ?? '')
      const msg = String((obj as { message?: unknown }).message ?? '')
      if (code === 'email_not_confirmed' || /confirm|potvrda/i.test(msg)) {
        setError('Potvrdite e-mail putem linka koji smo vam poslali, zatim se prijavite.')
      } else if (code === 'invalid_credentials' || /invalid|credentials/i.test(msg)) {
        setError('Pogrešan e-mail ili lozinka.')
      } else {
        setError('Prijava nije uspjela. Pokušajte ponovo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    if (password.length < 6) {
      setError('Lozinka mora imati najmanje 6 znakova.')
      return
    }
    if (password !== confirmPassword) {
      setError('Lozinke se ne podudaraju.')
      return
    }
    try {
      setError(null)
      setSubmitting(true)
      await signUp(email.trim(), password, name.trim() || undefined)
      // S obzirom da je "Confirm email" isključen u Supabaseu, korisnik će biti odmah prijavljen i preusmjeren
    } catch (err: unknown) {
      const obj = err && typeof err === 'object' ? (err as { message?: unknown; code?: unknown }) : {}
      const code = String((obj as { code?: unknown }).code ?? '')
      const msg = String((obj as { message?: unknown }).message ?? '')
      if (code === 'user_already_exists' || code === 'email_exists' || /already exists|already registered|email_exists/i.test(msg)) {
        setError('Korisnik s ovom e-mail adresom već postoji. Prijavite se ispod.')
        setMode('login')
      } else {
        setError('Registracija nije uspjela. Pokušajte ponovo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSetNewPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setError('Lozinka mora imati najmanje 6 znakova.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setError('Lozinke se ne podudaraju.')
      return
    }
    try {
      setError(null)
      setSubmitting(true)
      await updatePassword(newPassword)
      setIsRecovery(false)
      setNewPassword('')
      setConfirmNewPassword('')
      window.history.replaceState(null, '', '/login')
    } catch (err: unknown) {
      setError('Postavljanje lozinke nije uspjelo. Pokušajte ponovo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    try {
      setError(null)
      setSubmitting(true)
      await resetPasswordForEmail(email.trim())
      setForgotSent(true)
    } catch (err: unknown) {
      setError('Slanje linka nije uspjelo. Pokušajte ponovo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f6f7fa]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-rose-100 border-t-rose-600 rounded-full animate-spin" />
          <p className="text-[15px] font-medium text-slate-500 tracking-wide">Učitavanje…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7fa] px-4 py-8">
      <div className="w-full max-w-[400px]">

        <div className="bg-white rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.08)] border border-slate-200/60 px-6 sm:px-10 py-8 sm:py-10">

          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <img src="/logo-zupa.png" alt="Župa" className="w-20 h-20 rounded-full object-contain drop-shadow-sm" />
            </div>
            <h1 className="text-[20px] font-semibold text-slate-900">Pastoralni kalendar</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Župa Presvetog Srca Isusovog · Visoka</p>
          </div>

          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setModeAndClear('login')}
              className={`flex-1 py-2.5 text-[14px] font-medium rounded-xl transition-colors ${mode === 'login' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Prijava
            </button>
            <button
              type="button"
              onClick={() => setModeAndClear('register')}
              className={`flex-1 py-2.5 text-[14px] font-medium rounded-xl transition-colors ${mode === 'register' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Registracija
            </button>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
              {error}
            </div>
          )}

          {isRecovery ? (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <h2 className="text-[16px] font-semibold text-slate-900 mb-2">Postavite novu lozinku</h2>
              <p className="text-[13px] text-slate-500 mb-4">Unesite novu lozinku (min. 6 znakova).</p>
              <div>
                <label htmlFor="new-password" className="block text-[12px] font-medium text-slate-600 mb-1">Nova lozinka</label>
                <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} placeholder="••••••••" className="w-full px-4 py-3 text-[14px] border border-slate-300 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" />
              </div>
              <div>
                <label htmlFor="confirm-new" className="block text-[12px] font-medium text-slate-600 mb-1">Potvrdi lozinku</label>
                <input id="confirm-new" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required minLength={6} placeholder="••••••••" className="w-full px-4 py-3 text-[14px] border border-slate-300 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" />
              </div>
              <button type="submit" disabled={submitting || newPassword.length < 6 || newPassword !== confirmNewPassword} className="w-full py-3.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-60">
                {submitting ? 'Spremanje…' : 'Spremi lozinku'}
              </button>
            </form>
          ) : mode === 'forgot' && forgotSent ? (
            <div className="text-center py-2">
              <h2 className="text-[16px] font-semibold text-slate-900 mb-2">Provjerite e-mail</h2>
              <p className="text-[13px] text-slate-500 mb-6">
                Poslali smo link za reset lozinke na <strong>{email}</strong>. Kliknite na link i postavite novu lozinku.
              </p>
              <button type="button" onClick={() => setModeAndClear('login')} className="text-[14px] font-medium text-indigo-600 hover:text-indigo-700">
                Natrag na prijavu
              </button>
            </div>
          ) : mode === 'forgot' ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label htmlFor="email-forgot" className="block text-[12px] font-medium text-slate-600 mb-1">E-mail</label>
                <input
                  id="email-forgot"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="vas@email.com"
                  className="w-full px-4 py-3 text-[14px] border border-slate-300 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>
              <button type="submit" disabled={submitting || !email.trim()} className="w-full py-3.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-60">
                {submitting ? 'Šalje se…' : 'Pošalji link za reset'}
              </button>
              <button type="button" onClick={() => setModeAndClear('login')} className="w-full text-[13px] text-slate-500 hover:text-slate-700">
                Natrag na prijavu
              </button>
            </form>
          ) : mode === 'register' ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="email-reg" className="block text-[12px] font-medium text-slate-600 mb-1">E-mail *</label>
                <input id="email-reg" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="vas@email.com" className="w-full px-4 py-3 text-[14px] border border-slate-300 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" />
              </div>
              <div>
                <label htmlFor="name-reg" className="block text-[12px] font-medium text-slate-600 mb-1">Ime <span className="text-slate-400">(opcionalno)</span></label>
                <input id="name-reg" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vaše ime" className="w-full px-4 py-3 text-[14px] border border-slate-300 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" />
              </div>
              <div>
                <label htmlFor="password-reg" className="block text-[12px] font-medium text-slate-600 mb-1">Lozinka * <span className="text-slate-400">(min. 6 znakova)</span></label>
                <input id="password-reg" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 text-[14px] border border-slate-300 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" />
              </div>
              <div>
                <label htmlFor="confirm-reg" className="block text-[12px] font-medium text-slate-600 mb-1">Potvrdi lozinku *</label>
                <input id="confirm-reg" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 text-[14px] border border-slate-300 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" />
              </div>
              <button type="submit" disabled={submitting || !email.trim() || !password || !confirmPassword} className="w-full py-3.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-60">
                {submitting ? 'Registrira se…' : 'Registriraj se'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-[12px] font-medium text-slate-600 mb-1">E-mail</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="vas@email.com" className="w-full px-4 py-3 text-[14px] border border-slate-300 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" />
              </div>
              <div>
                <label htmlFor="password" className="block text-[12px] font-medium text-slate-600 mb-1">Lozinka</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 text-[14px] border border-slate-300 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" />
              </div>
              <button type="button" onClick={() => setModeAndClear('forgot')} className="text-[12px] text-indigo-600 hover:text-indigo-700 -mt-1">
                Zaboravljena lozinka?
              </button>
              <button type="submit" disabled={submitting || !email.trim() || !password} className="w-full py-3.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-60">
                {submitting ? 'Prijavljivanje…' : 'Prijavi se'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-5">© {new Date().getFullYear()} Župa Presvetog Srca Isusovog</p>
      </div>
    </div>
  )
}
