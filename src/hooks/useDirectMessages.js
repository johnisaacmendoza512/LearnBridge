import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useDirectMessages() {
  const { user } = useAuth();

  const [threads,      setThreads]      = useState([]);
  const [messages,     setMessages]     = useState([]);
  const [activeUserId, setActiveUserId] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [msgLoading,   setMsgLoading]   = useState(false);

  const pollRef       = useRef(null);
  const activeUserRef = useRef(null);
  const messagesRef   = useRef([]);

  useEffect(() => { activeUserRef.current = activeUserId; }, [activeUserId]);

  // ── Always fetch admin profile (needed by parents AND tutors) ─────────
  const fetchAdmin = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('role', 'admin')
      .limit(1)
      .single();
    if (data) setAdminProfile(data);
  }, []);

  // ── Fetch all conversation partners for the current user ──────────────
  // Works for ALL roles: admin sees everyone, tutors see parents, parents see tutors+admin
  const fetchThreads = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('direct_messages')
      .select(`
        sender_id, receiver_id,
        sender:sender_id     ( id, full_name, role ),
        receiver:receiver_id ( id, full_name, role )
      `)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    const seen  = new Set();
    const users = [];
    (data || []).forEach(m => {
      const other = m.sender_id === user.id ? m.receiver : m.sender;
      if (other && !seen.has(other.id) && other.id !== user.id) {
        seen.add(other.id);
        users.push(other);
      }
    });

    setThreads(prev => {
      const prevIds = prev.map(t => t.id).join(',');
      const newIds  = users.map(t => t.id).join(',');
      return prevIds === newIds ? prev : users;
    });

    setLoading(false);
  }, [user]);

  // ── Fetch messages between current user and a specific other user ──────
  const fetchMessages = useCallback(async (otherUserId, isInitial = false) => {
    if (!user || !otherUserId) return;
    if (isInitial) setMsgLoading(true);

    const { data, error } = await supabase
      .from('direct_messages')
      .select(`
        id, content, created_at, sender_id, receiver_id,
        sender:sender_id ( id, full_name, role )
      `)
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),` +
        `and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true });

    if (error) {
      console.error('fetchMessages error:', error.message);
      if (isInitial) setMsgLoading(false);
      return;
    }

    const fresh = data || [];
    const prev  = messagesRef.current;
    const hasChanged =
      fresh.length !== prev.length ||
      (fresh.length > 0 && fresh[fresh.length - 1]?.id !== prev[prev.length - 1]?.id);

    if (hasChanged) {
      messagesRef.current = fresh;
      setMessages(fresh);
    }

    if (isInitial) setMsgLoading(false);
  }, [user]);

  // ── Initial load ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    // Everyone needs the admin profile
    fetchAdmin();
    // Everyone fetches their own thread list
    fetchThreads();
  }, [user, fetchAdmin, fetchThreads]);

  // ── Poll every 5 seconds when a thread is active ──────────────────────
  useEffect(() => {
    if (!activeUserId) return;

    messagesRef.current = [];
    fetchMessages(activeUserId, true);

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (activeUserRef.current === activeUserId) {
        fetchMessages(activeUserId, false);
      }
      // Also refresh thread list to catch new senders
      fetchThreads();
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeUserId, fetchMessages, fetchThreads]);

  // ── Select a thread ────────────────────────────────────────────────────
  const selectUser = useCallback((userId) => {
    if (!userId || userId === activeUserRef.current) return;
    setMessages([]);
    messagesRef.current = [];
    setActiveUserId(userId);
  }, []);

  // ── Send a message ─────────────────────────────────────────────────────
  const sendMessage = useCallback(async (content, receiverId) => {
    if (!user || !content.trim()) return;
    const targetId = receiverId || activeUserRef.current || adminProfile?.id;
    if (!targetId) throw new Error('No recipient selected.');

    const { error } = await supabase.from('direct_messages').insert({
      sender_id:   user.id,
      receiver_id: targetId,
      content:     content.trim(),
    });
    if (error) throw error;

    await fetchMessages(targetId, false);
    await fetchThreads();
  }, [user, adminProfile?.id, fetchMessages, fetchThreads]);

  return {
    threads,
    messages,
    activeUserId,
    adminProfile,
    loading,
    msgLoading,
    selectUser,
    sendMessage,
    refreshThreads:  fetchThreads,
    refreshMessages: () => activeUserId && fetchMessages(activeUserId, false),
  };
}