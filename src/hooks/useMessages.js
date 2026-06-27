import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messages,      setMessages]      = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [loading,       setLoading]       = useState(true);
  const pollRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, subject, status,
        tutor:tutor_id   ( id, full_name ),
        parent:parent_id ( id, full_name ),
        student:student_id ( name )
      `)
      .or(`parent_id.eq.${user.id},tutor_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!error) {
      setConversations(data || []);
      if (!activeBooking && data?.length > 0) {
        setActiveBooking(data[0].id);
      }
    }
    setLoading(false);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMessages = useCallback(async (bookingId) => {
    if (!bookingId) return;
    const { data, error } = await supabase
      .from('messages')
      .select(`*, sender:sender_id ( id, full_name, role )`)
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });
    if (!error) setMessages(data || []);
  }, []);

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll messages for active booking every 5 seconds
  useEffect(() => {
    if (!activeBooking) return;
    fetchMessages(activeBooking);

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchMessages(activeBooking), 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeBooking, fetchMessages]);

  const sendMessage = async (content) => {
    if (!activeBooking || !content.trim()) return;
    const { error } = await supabase.from('messages').insert({
      booking_id: activeBooking,
      sender_id:  user.id,
      content:    content.trim(),
    });
    if (error) throw error;
    // Refresh immediately after send
    await fetchMessages(activeBooking);
  };

  return {
    conversations,
    messages,
    activeBooking,
    setActiveBooking,
    sendMessage,
    loading,
    refresh: fetchConversations,
  };
}