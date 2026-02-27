import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'login' | 'register' | 'forgot'

export default function Login() {
  const { user, userProfile, isPriest, signInWithPassword, signUp, resetPasswordForEmail, loading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)

  useEffect(() => {
    if (user && userProfile && !loading) {
      navigate(isPriest ? '/calendar' : '/request-booking', { replace: true })
    }
  }, [user, userProfile, isPriest, loading, navigate])

  function clearForm() {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setName('')
    setError(null)
  }

  function toLogin(preserveEmail = false, preserveError = false) {
    setMode('login')
    setForgotSent(false)
    setRegisterSuccess(false)
    setNeedsEmailConfirmation(false)
    if (!preserveEmail) clearForm()
    else {
      setPassword('')
      setConfirmPassword('')
      setName('')
      if (!preserveError) setError(null)
    }
  }

  function toRegister() {
    setMode('register')
    setForgotSent(false)
    clearForm()
  }

  function toForgot() {
    setMode('forgot')
    setRegisterSuccess(false)
    setPassword('')
    setConfirmPassword('')
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
      const msg = String(obj.message ?? '')
      const code = String(obj.code ?? '')
      if (code === 'email_not_confirmed' || /email not confirmed|email_not_confirmed|confirm your email/i.test(msg)) {
        setError('Molimo potvrdite svoju e-mail adresu putem linka koji smo vam poslali prilikom registracije.')
      } else if (code === 'invalid_credentials' || /invalid login credentials|invalid_credentials/i.test(msg)) {
        setError('Pogrešan e-mail ili lozinka.')
      } else {
        setError('Prijava nije uspjela. Molimo pokušajte ponovo.')
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
      const { needsEmailConfirmation: needsConfirm } = await signUp(email.trim(), password, name.trim() || undefined)
      setNeedsEmailConfirmation(needsConfirm)
      setRegisterSuccess(true)
    } catch (err: unknown) {
      const obj = err && typeof err === 'object' ? (err as { message?: unknown; code?: unknown }) : {}
      const msg = String(obj.message ?? '')
      const code = String(obj.code ?? '')
      if (code === 'user_already_exists' || code === 'email_exists' || /user already registered|already been registered|already exists|duplicate/i.test(msg)) {
        setError('Korisnik s ovom e-mail adresom već postoji. Prijavite se ispod ili koristite zaboravljenu lozinku.')
        setRegisterSuccess(false)
        toLogin(true, true)
      } else {
        setError('Registracija nije uspjela. Molimo pokušajte ponovo.')
      }
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
      setError('Slanje linka nije uspjelo. Molimo pokušajte ponovo.')
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
      <div className="w-full max-w-[420px]">

        <div className="bg-white rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.08)] border border-slate-200/60 px-6 sm:px-10 py-8 sm:py-10">

          <div className="text-center mb-9">
            <div className="flex justify-center mb-5">
              <img
                src="/logo-zupa.png"
                alt="Župa Presvetog Srca Isusovog"
                className="w-24 h-24 rounded-full object-contain drop-shadow-sm"
              />
            </div>

            <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight leading-snug mb-1.5">
              Pastoralni kalendar
            </h1>
            <p className="text-[14px] font-medium text-rose-800/80 leading-snug mb-1">
              Župa Presvetog Srca Isusovog
            </p>
            <p className="text-[12px] text-slate-400 tracking-wide">
              Visoka · Split
            </p>
          </div>

          <div className="h-px bg-slate-100 mb-7" />

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
              {error}
            </div>
          )}

          {/* ── Forgot password: success ── */}
          {mode === 'forgot' && forgotSent ? (
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-[17px] font-semibold text-slate-900 mb-2">Provjerite e-mail</h2>
              <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
                Poslali smo link za reset lozinke na <strong className="text-slate-700">{email}</strong>. Kliknite na link u e-mailu za postavljanje nove lozinke.
              </p>
              <button
                onClick={() => toLogin(true)}
                className="text-[13px] font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Natrag na prijavu
              </button>
            </div>
          ) : mode === 'forgot' ? (
            /* ── Forgot password form ── */
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label htmlFor="email-forgot" className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  E-mail adresa
                </label>
                <input
                  id="email-forgot"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="vas@email.com"
                  className="w-full px-4 py-3 text-[14px] text-slate-800 bg-white border border-slate-300 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 text-[14px] font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-4.5 h-4.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Šalje se…</span>
                  </>
                ) : (
                  'Pošalji link za reset lozinke'
                )}
              </button>
              <button type="button" onClick={() => toLogin(true)} className="w-full text-[13px] font-medium text-slate-500 hover:text-slate-700 transition-colors">
                Natrag na prijavu
              </button>
            </form>
          ) : mode === 'register' && registerSuccess ? (
            /* ── Register success ── */
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-[17px] font-semibold text-slate-900 mb-2">
                {needsEmailConfirmation ? 'Provjerite e-mail' : 'Račun kreiran'}
              </h2>
              <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
                {needsEmailConfirmation ? (
                  <>
                    Poslali smo link za potvrdu računa na <strong className="text-slate-700">{email}</strong>.
                    Kliknite na link u e-mailu da potvrdite račun, zatim se vratite ovdje i prijavite.
                  </>
                ) : (
                  <>
                    Možete se sada prijaviti s e-mail adresom <strong className="text-slate-700">{email}</strong> i lozinkom.
                  </>
                )}
              </p>
              <button
                onClick={() => toLogin(true)}
                className="text-[14px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl transition-colors"
              >
                Prijavi se
              </button>
            </div>
          ) : mode === 'register' ? (
            /* ── Register form ── */
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="email-reg" className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  E-mail adresa *
                </label>
                <input
                  id="email-reg"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="vas@email.com"
                  className="w-full px-4 py-3 text-[14px] text-slate-800 bg-white border border-slate-300 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
                />
              </div>
              <div>
                <label htmlFor="name-reg" className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Ime <span className="font-normal text-slate-400">(opcionalno)</span>
                </label>
                <input
                  id="name-reg"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vaše ime"
                  className="w-full px-4 py-3 text-[14px] text-slate-800 bg-white border border-slate-300 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
                />
              </div>
              <div>
                <label htmlFor="password-reg" className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Lozinka * <span className="font-normal text-slate-400">(min. 6 znakova)</span>
                </label>
                <input
                  id="password-reg"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 text-[14px] text-slate-800 bg-white border border-slate-300 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
                />
              </div>
              <div>
                <label htmlFor="confirm-reg" className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Potvrdi lozinku *
                </label>
                <input
                  id="confirm-reg"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 text-[14px] text-slate-800 bg-white border border-slate-300 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !email.trim() || !password || !confirmPassword}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 text-[14px] font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-4.5 h-4.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Registrira se…</span>
                  </>
                ) : (
                  'Registriraj se'
                )}
              </button>
              <button type="button" onClick={() => toLogin()} className="w-full text-[13px] font-medium text-slate-500 hover:text-slate-700 transition-colors">
                Već imate račun? Prijavite se
              </button>
            </form>
          ) : (
            /* ── Login form ── */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  E-mail adresa
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="vas@email.com"
                  className="w-full px-4 py-3 text-[14px] text-slate-800 bg-white border border-slate-300 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-[12px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Lozinka
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 text-[14px] text-slate-800 bg-white border border-slate-300 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
                />
              </div>
              <button
                type="button"
                onClick={toForgot}
                className="text-[12px] font-medium text-indigo-600 hover:text-indigo-700 transition-colors -mt-1"
              >
                Zaboravljena lozinka?
              </button>
              <button
                type="submit"
                disabled={submitting || !email.trim() || !password}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 text-[14px] font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-4.5 h-4.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Prijavljivanje…</span>
                  </>
                ) : (
                  'Prijavi se'
                )}
              </button>
              <button type="button" onClick={toRegister} className="w-full text-[13px] font-medium text-slate-500 hover:text-slate-700 transition-colors">
                Nemate račun? Registrirajte se
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[11.5px] text-slate-400 mt-5 leading-relaxed">
          © {new Date().getFullYear()} Župa Presvetog Srca Isusovog, Visoka · Split
        </p>
      </div>
    </div>
  )
}
