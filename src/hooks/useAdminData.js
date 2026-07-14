import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useAdminData() {
  const { user, profile } = useAuth();
  const [stats,          setStats]          = useState(null);
  const [tutors,         setTutors]         = useState([]);
  const [pendingParents, setPendingParents] = useState([]);
  const [allUsers,       setAllUsers]       = useState([]);
  const [allSessions,    setAllSessions]    = useState([]);
  const [allTxns,        setAllTxns]        = useState([]);
  const [platformEarnings, setPlatformEarnings] = useState([]);
  const [totalCommission,  setTotalCommission]  = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);

  const fetchAll = useCallback(async () => {
    if (!user || profile?.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {

      // ── Tutors ────────────────────────────────────────────────────────
      const { data: tutorRows, error: tErr } = await supabase
        .from('tutors')
        .select(`
          id, specialization, years_experience, rate_per_session,
          approved_rate, status, wallet_balance, certification_scores,
          admin_notes, created_at,
          prc_license_url, nbi_clearance_url, medical_cert_url, application_form_url,
          profile:id ( id, full_name, email, gender, bio, location, phone, role )
        `)
        .order('created_at', { ascending: false });
      if (tErr) throw tErr;
      setTutors(tutorRows || []);

      // ── Pending parents (for verification page) ───────────────────────
      const { data: ppRows, error: ppErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'parent')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (ppErr) throw ppErr;
      setPendingParents(ppRows || []);

      // ── All users for Users page ──────────────────────────────────────
      const { data: allProfiles, error: apErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (apErr) throw apErr;

      // Merge tutor data into tutor profiles
      const mergedUsers = (allProfiles || []).map(p => {
        if (p.role === 'tutor') {
          const tutorRow = (tutorRows || []).find(t => t.id === p.id);
          return { ...p, tutorData: tutorRow || null };
        }
        return p;
      });

      setAllUsers(mergedUsers);

      // ── Sessions ──────────────────────────────────────────────────────
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

      // ── Wallet transactions ───────────────────────────────────────────
      const { data: txns, error: txErr } = await supabase
        .from('wallet_transactions')
        .select(`id, type, amount, description, created_at, user:user_id ( full_name, email )`)
        .order('created_at', { ascending: false });
      if (txErr) throw txErr;
      setAllTxns(txns || []);

      // ── Platform earnings (10% commission) ────────────────────────────
      const { data: platData } = await supabase
        .from('platform_earnings')
        .select('*, booking:booking_id(subject, parent:parent_id(full_name), tutor:tutor_id(full_name))')
        .order('created_at', { ascending: false });
      setPlatformEarnings(platData || []);
      setTotalCommission((platData || []).reduce((s,e) => s + Number(e.commission||0), 0));

      // ── Stats ─────────────────────────────────────────────────────────
      const { data: statsData, error: stErr } = await supabase.rpc('get_admin_stats');
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
    const { error: err } = await supabase.from('tutors')
      .update({ status: 'approved', approved_rate: Number(approvedRate), admin_notes: adminNotes || null })
      .eq('id', tutorId);
    if (err) throw err;
    await fetchAll();
  };

  const rejectTutor = async (tutorId, adminNotes) => {
    const { error: err } = await supabase.from('tutors')
      .update({ status: 'rejected', admin_notes: adminNotes || null })
      .eq('id', tutorId);
    if (err) throw err;
    await fetchAll();
  };

  const approveParent = async (parentId) => {
    const { error: err } = await supabase.from('profiles')
      .update({ status: 'approved' }).eq('id', parentId);
    if (err) throw err;
    await fetchAll();
  };

  const rejectParent = async (parentId) => {
    const { error: err } = await supabase.from('profiles')
      .update({ status: 'rejected' }).eq('id', parentId);
    if (err) throw err;
    await fetchAll();
  };

  const deleteUser = async (userId) => {
    setAllUsers(prev => prev.filter(u => u.id !== userId));
    const { error: rpcErr } = await supabase.rpc('admin_delete_user', { target_user_id: userId });
    if (rpcErr) {
      const { error: profileErr } = await supabase.from('profiles').delete().eq('id', userId);
      if (profileErr) { await fetchAll(); throw profileErr; }
    }
  };

  return {
    stats, tutors, pendingParents, allUsers, allSessions, allTxns, platformEarnings, totalCommission,
    loading, error,
    approveTutor, rejectTutor, approveParent, rejectParent, deleteUser,
    refresh: fetchAll,
  };
}