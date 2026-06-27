import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Admin-side hook: lists ALL tutors (any status) joined with their
 * profile info, plus actions to approve/reject and set the approved rate.
 */
export function useTutorVerification() {
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTutors = async () => {
    const { data, error } = await supabase
      .from('tutors')
      .select(`
        id, specialization, years_experience, rate_per_session, approved_rate,
        prc_license_url, nbi_clearance_url, medical_cert_url, status, created_at,
        profile:id ( full_name, email )
      `)
      .order('created_at', { ascending: false });

    if (error) { console.error('useTutorVerification fetch error:', error); setTutors([]); }
    else setTutors(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTutors(); }, []);

  const setStatus = async (tutorId, status, approvedRate) => {
    const payload = { status };
    if (approvedRate !== undefined) payload.approved_rate = approvedRate;
    const { error } = await supabase.from('tutors').update(payload).eq('id', tutorId);
    if (error) throw error;
    await fetchTutors();
  };

  return { tutors, loading, setStatus, refresh: fetchTutors };
}