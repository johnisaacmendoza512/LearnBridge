import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useParentDashboard() {
  const { user } = useAuth();
  const [stats,            setStats]            = useState({ children: 0, upcoming: 0, hoursThisMonth: 0 });
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [recentFeedback,   setRecentFeedback]   = useState([]);
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

      // Children count
      const { count: childCount } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', user.id);

      // Get all bookings for this parent first
      const { data: parentBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('parent_id', user.id);
      const bookingIds = (parentBookings || []).map(b => b.id);

      let upcomingData   = [];
      let feedbackData   = [];
      let completedCount = 0;

      if (bookingIds.length > 0) {
        // Upcoming sessions
        const { data: upcoming, error: upErr } = await supabase
          .from('sessions')
          .select(`
            id, session_number, scheduled_date, scheduled_time, status,
            booking:booking_id (
              subject, session_mode,
              tutor:tutor_id   ( id, full_name ),
              student:student_id ( name )
            )
          `)
          .in('booking_id', bookingIds)
          .eq('status', 'scheduled')
          .gte('scheduled_date', today)
          .order('scheduled_date', { ascending: true })
          .limit(5);
        if (upErr) throw upErr;
        upcomingData = upcoming || [];

        // Recent feedback
        const { data: feedback, error: fbErr } = await supabase
          .from('sessions')
          .select(`
            id, topic_covered, performance_indicator, tutor_comments, scheduled_date,
            booking:booking_id (
              subject,
              tutor:tutor_id   ( full_name ),
              student:student_id ( name )
            )
          `)
          .in('booking_id', bookingIds)
          .eq('status', 'completed')
          .order('scheduled_date', { ascending: false })
          .limit(5);
        if (fbErr) throw fbErr;
        feedbackData = feedback || [];

        // Hours this month
        const { count } = await supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .in('booking_id', bookingIds)
          .eq('status', 'completed')
          .gte('scheduled_date', monthStart);
        completedCount = count || 0;
      }

      setUpcomingSessions(upcomingData);
      setRecentFeedback(feedbackData);
      setStats({
        children:       childCount     || 0,
        upcoming:       upcomingData.length,
        hoursThisMonth: (completedCount * 1.5).toFixed(1),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { stats, upcomingSessions, recentFeedback, loading, error, refresh: fetchAll };
}