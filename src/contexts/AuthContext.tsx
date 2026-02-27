import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { supabase, User, UserRole } from '../lib/supabase'

interface AuthContextType {
  user: SupabaseUser | null
  userProfile: User | null
  session: Session | null
  loading: boolean
  authError: string | null
  signInWithOtp: (email: string) => Promise<void>
  signOut: () => Promise<void>
  isPriest: boolean
  isParishioner: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const GET_SESSION_TIMEOUT_MS = 10000
const PROFILE_QUERY_TIMEOUT_MS = 10000

const PRIEST_EMAIL = 'ivan.terze@gmail.com'

function getRoleFromEmail(email: string): UserRole {
  return email === PRIEST_EMAIL ? 'PRIEST' : 'PARISHIONER'
}

/**
 * Races an async factory against a hard timeout.
 * Uses a factory function (not the promise itself) because Supabase query
 * builders are thenables, not full Promises — they need to be called to execute.
 */
function runWithTimeout<T>(factory: () => PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms)
    Promise.resolve(factory()).then(
      (result) => { clearTimeout(timer); resolve(result) },
      (err) => { clearTimeout(timer); reject(err) }
    )
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const initDoneRef = useRef(false)

  useEffect(() => {
    let mounted = true

    async function initialize() {
      try {
        // Race getSession() against a hard timeout. A stale/corrupted token in
        // localStorage causes getSession() to hang while Supabase tries to refresh
        // it via network — potentially forever.
        const sessionResult = await runWithTimeout(
          () => supabase.auth.getSession(),
          GET_SESSION_TIMEOUT_MS
        )

        if (!mounted) return

        if (sessionResult.error) {
          // Invalid session — clear it fire-and-forget so UI unblocks immediately
          supabase.auth.signOut().catch(() => { })
          setLoading(false)
          return
        }

        const { session: activeSession } = sessionResult.data
        setSession(activeSession)
        setUser(activeSession?.user ?? null)

        if (activeSession?.user) {
          await fetchUserProfile(activeSession.user.id, activeSession.user.email ?? '', mounted)
        } else {
          setLoading(false)
        }
      } catch (err: unknown) {
        if (!mounted) return
        const msg = err instanceof Error ? err.message : String(err)
        if (msg === 'TIMEOUT') {
          // getSession() timed out — stale session. Clear it fire-and-forget so the
          // network hang doesn't propagate. setLoading(false) must run immediately.
          supabase.auth.signOut().catch(() => { })
          setLoading(false)
        } else {
          setAuthError('Greška pri dohvatu sesije. Molimo prijavite se ponovo.')
          setLoading(false)
        }
      }
    }

    initialize()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return
      // INITIAL_SESSION is handled by initialize() above — skip to avoid duplicates
      if (_event === 'INITIAL_SESSION') return

      setSession(newSession)
      setUser(newSession?.user ?? null)

      // TOKEN_REFRESHED fires silently in background (e.g. when returning to tab).
      // The session is already updated above — no profile change, no loading state.
      if (_event === 'TOKEN_REFRESHED') return

      if (!newSession?.user) {
        // Signed out
        setUserProfile(null)
        setAuthError(null)
        setLoading(false)
        return
      }

      if (!initDoneRef.current) {
        // Still in the initial loading phase — initialize() handles fetchUserProfile
        return
      }

      // SIGNED_IN or USER_UPDATED after initialization.
      // Refresh profile silently in background — do NOT show loading spinner,
      // as this fires on tab focus/restore and must not freeze the UI.
      fetchUserProfile(newSession.user.id, newSession.user.email ?? '', mounted)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function fetchUserProfile(
    userId: string,
    userEmail: string,
    mounted: boolean | object
  ) {
    const isMounted = () => (typeof mounted === 'boolean' ? mounted : true)
    // Capture whether this is the first-ever profile load or a background refresh.
    // Background refreshes should not show error screens if they fail.
    const isInitialLoad = !initDoneRef.current

    try {
      // Race the users-table query against a timeout. Recursive RLS subqueries can
      // hang PostgREST indefinitely — the migration fixes the root cause, but this
      // is a client-side safety net for any future stalls.
      const result = await runWithTimeout(
        () => supabase.from('users').select('*').eq('id', userId).single(),
        PROFILE_QUERY_TIMEOUT_MS
      ) as { data: User | null; error: { message: string; code?: string; status?: number } | null }

      if (!isMounted()) return

      if (result.error) {
        if (result.error.code === 'PGRST116') {
          // User exists in auth but not in public.users — trigger may have failed.
          // Auto-create with email-based role assignment.
          await autoCreateUserProfile(userId, userEmail, isMounted)
        } else if (isInitialLoad) {
          setAuthError('Nije moguće učitati korisnički profil. Molimo kontaktirajte administratora.')
        }
        // Background refresh errors are silently ignored — existing profile is kept
      } else {
        setUserProfile(result.data)
        setAuthError(null)
      }
    } catch (err: unknown) {
      if (!isMounted()) return
      const msg = err instanceof Error ? err.message : String(err)
      if (isInitialLoad) {
        if (msg === 'TIMEOUT') {
          setAuthError('Baza podataka ne odgovara. Molimo pričekajte trenutak i osvježite stranicu.')
        } else {
          setAuthError('Nije moguće učitati korisnički profil. Molimo osvježite stranicu.')
        }
      }
      // For background refreshes, silently fail and keep the existing profile
    } finally {
      initDoneRef.current = true
      setLoading(false) // Idempotent — safe to call even on background refreshes
    }
  }

  async function autoCreateUserProfile(userId: string, userEmail: string, isMounted: () => boolean) {
    const role = getRoleFromEmail(userEmail)
    const name = userEmail.split('@')[0]

    try {
      const result = await runWithTimeout(
        () => supabase
          .from('users')
          .insert({ id: userId, email: userEmail, name, role })
          .select()
          .single(),
        PROFILE_QUERY_TIMEOUT_MS
      ) as { data: User | null; error: { message: string } | null }

      if (!isMounted()) return
      if (result.error) throw new Error(result.error.message)
      setUserProfile(result.data)
      setAuthError(null)
    } catch (err) {
      console.error('Nije moguće kreirati korisnički profil:', err)
      if (isMounted()) {
        setAuthError('Nije moguće kreirati korisnički profil. Molimo kontaktirajte administratora.')
      }
    }
  }

  async function signInWithOtp(email: string) {
    setAuthError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
    if (error) throw error
  }

  async function signOut() {
    setAuthError(null)
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const isPriest = userProfile?.role === 'PRIEST'
  const isParishioner = userProfile?.role === 'PARISHIONER'

  return (
    <AuthContext.Provider
      value={{ user, userProfile, session, loading, authError, signInWithOtp, signOut, isPriest, isParishioner }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
