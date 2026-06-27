import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useTutorDashboard() {
  const { user } = useAuth();
  const [stats,           setStats]           = useState({ activeTutees: 0, sessionsThisMonth: 0, walletBalance: 0 });
  const [todaySessions,   setTodaySessions]   = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const today      = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString().split('T')[0];

      // Wallet balance
      const { data: tutorRow } = await supabase
        .from('tutors')
        .select('wallet_balance')
        .eq('id', user.id)
        .single();
      const walletBalance = tutorRow?.wallet_balance ?? 0;

      // Active tutees = distinct students in confirmed bookings
      const { data: confirmedBookings } = await supabase
        .from('bookings')
        .select('student_id')
        .eq('tutor_id', user.id)
        .eq('status', 'confirmed');
      const activeTutees = new Set((confirmedBookings || []).map(b => b.student_id)).size;

      // ── FIX: Get tutor's booking IDs first, then count sessions ──
      const { data: tutorBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('tutor_id', user.id);

      const bookingIds = (tutorBookings || []).map(b => b.id);

      // Sessions completed this month
      let sessionsThisMonth = 0;
      if (bookingIds.length > 0) {
        const { count } = await supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .in('booking_id', bookingIds)
          .eq('status', 'completed')
          .gte('scheduled_date', monthStart);
        sessionsThisMonth = count || 0;
      }

      // ── FIX: Today's sessions — filter via booking_id, not booking.tutor_id ──
      let todayData = [];
      if (bookingIds.length > 0) {
        const { data, error: todayErr } = await supabase
          .from('sessions')
          .select(`
            id, session_number, scheduled_time, status, topic_covered,
            booking:booking_id (
              subject,
              student:student_id ( name, grade_level )
            )
          `)
          .in('booking_id', bookingIds)
          .eq('scheduled_date', today)
          .order('scheduled_time', { ascending: true });
        if (todayErr) throw todayErr;
        todayData = data || [];
      }
      setTodaySessions(todayData);

      // Pending booking requests for this tutor
      const { data: pending, error: pendErr } = await supabase
        .from('bookings')
        .select(`
          id, subject, session_mode, payment_method, created_at,
          student:student_id ( name, grade_level ),
          parent:parent_id ( full_name )
        `)
        .eq('tutor_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (pendErr) throw pendErr;
      setPendingBookings(pending || []);

      setStats({ activeTutees, sessionsThisMonth, walletBalance });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const respondToBooking = async (bookingId, accept) => {
    const { error: err } = await supabase
      .from('bookings')
      .update({ status: accept ? 'confirmed' : 'rejected' })
      .eq('id', bookingId);
    if (err) throw err;
    await fetchAll();
  };

  return { stats, todaySessions, pendingBookings, loading, error, respondToBooking, refresh: fetchAll };
}