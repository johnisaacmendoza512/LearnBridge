import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [profile,   setProfile]   = useState(null);
  const [tutorData, setTutorData] = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setTutorData(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);

    // If tutor, also fetch tutor-specific data for certification check
    if (data?.role === 'tutor') {
      const { data: tData } = await supabase
        .from('tutors')
        .select('status, certification_scores')
        .eq('id', userId)
        .single();
      setTutorData(tData || null);
    }

    setLoading(false);
  }

  async function signUp({ email, password, fullName, role }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    if (error) throw error;

    if (!data.user) {
      throw new Error('Sign-up did not return a user. Check your Supabase email confirmation settings.');
    }

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id:        data.user.id,
        role,
        full_name: fullName,
        email,
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile insert failed:', profileError);
      throw new Error(`Account created, but profile setup failed: ${profileError.message}`);
    }

    setUser(data.user);
    setProfile(profileRow);

    return data;
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setTutorData(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, tutorData, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}