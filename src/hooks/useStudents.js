import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const fetchStudents = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('parent_id', user.id)
      .order('created_at', { ascending: false });
    setStudents(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, [user]);

  const addStudent = async (payload) => {
    const { data, error } = await supabase
      .from('students')
      .insert({ ...payload, parent_id: user.id })
      .select()
      .single();
    if (error) throw error;
    setStudents(prev => [data, ...prev]);
    return data;
  };

  const updateStudent = async (id, payload) => {
    const { data, error } = await supabase
      .from('students').update(payload).eq('id', id).select().single();
    if (error) throw error;
    setStudents(prev => prev.map(s => s.id === id ? data : s));
    return data;
  };

  const deleteStudent = async (id) => {
    await supabase.from('students').delete().eq('id', id);
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  return { students, loading, addStudent, updateStudent, deleteStudent, refresh: fetchStudents };
}
