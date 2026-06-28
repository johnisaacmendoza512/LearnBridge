import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useTutors() {
  const [tutors,  setTutors]  = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTutors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tutors')
      .select(`
        id, specialization, years_experience, approved_rate, rate_per_session,
        certification_scores, status, average_rating, total_ratings,
        wallet_balance,
        nbi_clearance_url, prc_license_url, medical_cert_url, application_form_url,
        profile:profiles!tutors_id_fkey ( full_name, email, gender, location, bio, avatar_url )
      `)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('useTutors fetch error:', error);
      setTutors([]);
    } else {
      setTutors(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTutors(); }, []);

  return { tutors, loading, refresh: fetchTutors };
}