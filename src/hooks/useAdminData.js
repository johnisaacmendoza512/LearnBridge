import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useAdminData() {
  const { user, profile } = useAuth();
  const [stats,       setStats]       = useState(null);
  const [tutors,      setTutors]      = useState([]);
  const [allUsers,    setAllUsers]    = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [allTxns,     setAllTxns]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  const fetchAll = useCallback(async () => {
    if (!user || profile?.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      // Tutors with full profile
      const { data: tutorRows, error: tErr } = await supabase
        .from('tutors')
        .select(`
          id, specialization, years_experience, rate_per_session,
          approved_rate, status, wallet_balance, certification_scores,
          admin_notes, created_at,
          prc_license_url, nbi_clearance_url, medical_cert_url,
          profile:id ( id, full_name, email, gender, bio, location, phone, role )
        `)
        .order('created_at', { ascending: false });
      if (tErr) throw tErr;
      setTutors(tutorRows || []);

      // All user profiles
      const { data: users, error: uErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, location, gender, avatar_url, created_at')
        .order('created_at', { ascending: false });
      if (uErr) throw uErr;
      setAllUsers(users || []);

      // All sessions grouped — fetch bookings with their sessions
      const { data: sessions, error: sErr } = await supabase
        .from('sessions')
        .select(`
          id, session_number, scheduled_date, scheduled_time,
          status, topic_covered, performance_indicator, tutor_comments, created_at,
          booking_id,
          booking:booking_id (
            id, subject, session_mode, status, total_amount, commission_amount,
            tutor:tutor_id   ( id, full_name ),
            parent:parent_id ( id, full_name ),
            student:student_id ( id, name, grade_level )
          )
        `)
        .order('created_at', { ascending: false });
      if (sErr) throw sErr;
      setAllSessions(sessions || []);

      // All wallet transactions
      const { data: txns, error: txErr } = await supabase
        .from('wallet_transactions')
        .select(`
          id, type, amount, description, created_at,
          tutor:tutor_id ( full_name, email )
        `)
        .order('created_at', { ascending: false });
      if (txErr) throw txErr;
      setAllTxns(txns || []);

      // Platform stats via RPC
      const { data: statsData, error: stErr } = await supabase
        .rpc('get_admin_stats');
      if (stErr) throw stErr;
      setStats(statsData);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, profile?.role]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const approveTutor = async (tutorId, approvedRate, adminNotes) => {
    const { error: err } = await supabase
      .from('tutors')
      .update({
        status:        'approved',
        approved_rate: Number(approvedRate),
        admin_notes:   adminNotes || null,
      })
      .eq('id', tutorId);
    if (err) throw err;
    await fetchAll();
  };

  const rejectTutor = async (tutorId, adminNotes) => {
    const { error: err } = await supabase
      .from('tutors')
      .update({ status: 'rejected', admin_notes: adminNotes || null })
      .eq('id', tutorId);
    if (err) throw err;
    await fetchAll();
  };

  const deleteUser = async (userId) => {
    // Remove from local state immediately so UI updates without waiting
    setAllUsers(prev => prev.filter(u => u.id !== userId));

    // Call the server-side RPC that deletes from auth.users (cascades to profiles)
    const { error: rpcErr } = await supabase.rpc('admin_delete_user', {
      target_user_id: userId,
    });

    if (rpcErr) {
      // If RPC fails, fall back to deleting profile row only
      const { error: profileErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileErr) {
        // Restore the user in local state if both attempts failed
        await fetchAll();
        throw profileErr;
      }
    }
    // Don't call fetchAll() — we already updated local state optimistically
  };

  return {
    stats, tutors, allUsers, allSessions, allTxns,
    loading, error,
    approveTutor, rejectTutor, deleteUser,
    refresh: fetchAll,
  };
}