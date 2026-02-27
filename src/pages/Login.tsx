import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { user, userProfile, isPriest, signInWithOtp, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user && userProfile && !loading) {
      navigate(isPriest ? '/calendar' : '/request-booking', { replace: true })
    }
  }, [user, userProfile, isPriest, loading, navigate])

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

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    try {
      setError(null)
      setSending(true)
      await signInWithOtp(email.trim())
      setSent(true)
    } catch {
      setError('Slanje linka nije uspjelo. Molimo pokušajte ponovo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7fa] px-4">
      <div className="w-full max-w-[420px]">

        <div className="bg-white rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.08)] border border-slate-200/60 px-10 py-10">

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

          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-[17px] font-semibold text-slate-900 mb-2">Provjerite e-mail</h2>
              <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
                Poslali smo link za prijavu na <strong className="text-slate-700">{email}</strong>. Kliknite na link u e-mailu za pristup kalendaru.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(''); setError(null) }}
                className="text-[13px] font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Pokušaj s drugom adresom
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendLink} className="space-y-4">
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

              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 text-[14px] font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <div className="w-4.5 h-4.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Šalje se…</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Pošalji link za prijavu</span>
                  </>
                )}
              </button>

              <p className="text-[12px] text-slate-400 text-center mt-4 leading-relaxed">
                Unesite e-mail adresu i primite link za prijavu u pastoralni kalendar.
              </p>
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
