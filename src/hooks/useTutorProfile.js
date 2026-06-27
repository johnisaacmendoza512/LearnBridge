import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * useTutorProfile
 * ───────────────
 * Loads and allows updating the `tutors` row joined with `profiles`
 * for the currently signed-in tutor.
 */
export function useTutorProfile() {
  const { user } = useAuth();
  const [tutorData, setTutorData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const fetchTutorProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from('tutors')
        .select(`
          *,
          profile:id ( id, full_name, email, role, location, gender, bio )
        `)
        .eq('id', user.id)
        .single();

      if (err && err.code !== 'PGRST116') throw err; // PGRST116 = not found
      setTutorData(data || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchTutorProfile(); }, [fetchTutorProfile]);

  /**
   * saveProfile — updates both `profiles` (bio/location/gender) and `tutors` (rate/specialization/experience)
   */
  const saveProfile = async ({ full_name, bio, location, gender, rate_per_session, years_experience, specialization }) => {
    // Update profiles table
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ full_name, bio, location, gender })
      .eq('id', user.id);
    if (profileErr) throw profileErr;

    // Upsert tutors table (creates row if it doesn't exist yet)
    const { error: tutorErr } = await supabase
      .from('tutors')
      .upsert({
        id: user.id,
        rate_per_session,
        years_experience,
        specialization,
      });
    if (tutorErr) throw tutorErr;

    await fetchTutorProfile();
  };

  return { tutorData, loading, error, saveProfile, refresh: fetchTutorProfile };
}