import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useInquiries() {
  const { user } = useAuth();
  const [inquiries, setInquiries] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchInquiries = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('inquiries')
      .select(`
        *,
        tutor:tutor_id ( id, full_name, email ),
        student:student_id ( id, name, grade_level )
      `)
      .eq('parent_id', user.id)
      // Fetch ALL statuses (open + booked + cancelled)
      // so tutors stay in the chat list even after booking
      .in('status', ['open', 'booked'])
      .order('created_at', { ascending: false });

    setInquiries(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  const startInquiry = async ({ tutorId, subject }) => {
    if (!user) throw new Error('Not logged in');

    // Check if an open inquiry already exists for this tutor
    const { data: existing } = await supabase
      .from('inquiries')
      .select('id, status')
      .eq('parent_id', user.id)
      .eq('tutor_id', tutorId)
      .in('status', ['open', 'booked'])
      .maybeSingle();

    if (existing) return existing; // Already has an inquiry — just open messages

    // Create new inquiry
    const { data, error } = await supabase
      .from('inquiries')
      .insert({
        parent_id: user.id,
        tutor_id:  tutorId,
        subject:   subject || '',
        status:    'open',
      })
      .select()
      .single();

    if (error) throw error;

    // Send an opening message to the tutor automatically
    await supabase.from('direct_messages').insert({
      sender_id:   user.id,
      receiver_id: tutorId,
      content:     `Hello! I'm interested in tutoring services${subject ? ` for ${subject}` : ''}. I'd like to learn more about your approach and availability.`,
    });

    await fetchInquiries();
    return data;
  };

  const confirmBooking = async ({
    inquiryId, tutorId, studentId, subject,
    sessionMode, paymentMethod, totalAmount,
  }) => {
    if (!user) throw new Error('Not logged in');

    // Create the booking
    const { data: booking, error: bookErr } = await supabase
      .from('bookings')
      .insert({
        parent_id:         user.id,
        tutor_id:          tutorId,
        student_id:        studentId,
        subject:           subject,
        session_mode:      sessionMode,
        payment_method:    paymentMethod,
        total_amount:      totalAmount,
        commission_amount: totalAmount * 0.10,
        status:            'pending',
      })
      .select()
      .single();
    if (bookErr) throw bookErr;

    // Mark inquiry as booked — keeps it in the chat list
    await supabase
      .from('inquiries')
      .update({ status: 'booked', student_id: studentId })
      .eq('id', inquiryId);

    // Send a confirmation message in the chat
    await supabase.from('direct_messages').insert({
      sender_id:   user.id,
      receiver_id: tutorId,
      content:     `I've submitted a booking request for ${subject}! Please confirm the schedule and details. Looking forward to working with you! 📚`,
    });

    await fetchInquiries();
    return booking;
  };

  const cancelInquiry = async (inquiryId, tutorId) => {
    if (inquiryId) {
      await supabase
        .from('inquiries')
        .update({ status: 'cancelled' })
        .eq('id', inquiryId);
    }

    if (tutorId) {
      await supabase.from('direct_messages').insert({
        sender_id:   user.id,
        receiver_id: tutorId,
        content:     "Thank you for your time! I've decided not to proceed with the inquiry at this time.",
      });
    }

    await fetchInquiries();
  };

  const getInquiryForTutor = (tutorId) => {
    // Returns open inquiry first, then booked
    return (
      inquiries.find(i => i.tutor_id === tutorId && i.status === 'open') ||
      inquiries.find(i => i.tutor_id === tutorId && i.status === 'booked') ||
      null
    );
  };

  return {
    inquiries,
    loading,
    startInquiry,
    confirmBooking,
    cancelInquiry,
    getInquiryForTutor,
    refresh: fetchInquiries,
  };
}