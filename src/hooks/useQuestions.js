import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * useQuestions
 * ────────────
 * Tutors: see their own contributed questions.
 * Admins: see all questions (for review/approve/reject).
 */
export function useQuestions() {
  const { user, profile } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const fetchQuestions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('questions')
        .select(`*, contributor:tutor_id ( id, full_name, email )`)
        .order('created_at', { ascending: false });

      // Tutors only see their own questions
      if (profile?.role === 'tutor') {
        query = query.eq('tutor_id', user.id);
      }
      // Admins see all — no extra filter needed

      const { data, error: err } = await query;
      if (err) throw err;
      setQuestions(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, profile?.role]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  /** Tutor submits a new question for admin review */
  const addQuestion = async (payload) => {
    const { data, error: err } = await supabase
      .from('questions')
      .insert({ ...payload, tutor_id: user.id, status: 'pending' })
      .select()
      .single();
    if (err) throw err;
    setQuestions(prev => [data, ...prev]);
    return data;
  };

  /** Admin approves or rejects a question */
  const updateStatus = async (id, status) => {
    const { error: err } = await supabase
      .from('questions')
      .update({ status })
      .eq('id', id);
    if (err) throw err;
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, status } : q));
  };

  /** Admin deletes a question */
  const deleteQuestion = async (id) => {
    const { error: err } = await supabase.from('questions').delete().eq('id', id);
    if (err) throw err;
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  return {
    questions,
    loading,
    error,
    addQuestion,
    updateStatus,
    deleteQuestion,
    refresh: fetchQuestions,
  };
}