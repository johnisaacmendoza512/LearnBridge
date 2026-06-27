import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * useSessions
 * ───────────
 * Fetches sessions for both tutors and parents from Supabase.
 * Handles the two-way session completion flow:
 *
 * scheduled
 *   → [tutor submits feedback] → pending_parent_confirm
 *   → [parent confirms]        → pending_tutor_complete
 *   → [tutor completes]        → completed
 */
export function useSessions() {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from('sessions')
        .select(`
          id, session_number, scheduled_date, scheduled_time,
          status, topic_covered, performance_indicator, tutor_comments,
          created_at,
          booking:booking_id (
            id, subject, session_mode,
            tutor:tutor_id   ( id, full_name ),
            parent:parent_id ( id, full_name ),
            student:student_id ( id, name, grade_level )
          )
        `)
        .order('scheduled_date', { ascending: false });

      if (err) throw err;
      setSessions(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // ── Tutor: submit feedback → pending_parent_confirm ─────────────────
  const submitFeedback = async (sessionId, { topic, indicator, comments }) => {
    const { error } = await supabase
      .from('sessions')
      .update({
        status:               'pending_parent_confirm',
        topic_covered:        topic,
        performance_indicator: indicator,
        tutor_comments:       comments,
      })
      .eq('id', sessionId);
    if (error) throw error;
    await fetchSessions();
  };

  // ── Parent: confirm session → pending_tutor_complete ────────────────
  const parentConfirm = async (sessionId) => {
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'pending_tutor_complete' })
      .eq('id', sessionId);
    if (error) throw error;
    await fetchSessions();
  };

  // ── Tutor: mark complete → completed ────────────────────────────────
  const tutorComplete = async (sessionId) => {
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'completed' })
      .eq('id', sessionId);
    if (error) throw error;
    await fetchSessions();
  };

  return {
    sessions,
    loading,
    error,
    isTutor:  profile?.role === 'tutor',
    isParent: profile?.role === 'parent',
    submitFeedback,
    parentConfirm,
    tutorComplete,
    refresh: fetchSessions,
  };
}