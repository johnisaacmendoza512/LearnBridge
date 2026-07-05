import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function calculateCommission(booking, tutorApprovedRate = null) {
  const rate         = tutorApprovedRate || booking?.approved_rate || booking?.rate_per_session || 0;
  const sessionCount = booking?.session_count || 8;
  const totalAmount  = Number(booking?.total_amount || 0) || (Number(rate) * Number(sessionCount));
  const commission   = totalAmount * 0.10;
  return {
    rate:         Number(rate),
    sessionCount: Number(sessionCount),
    totalAmount,
    commission:   Math.round(commission * 100) / 100,
  };
}

export function useBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('bookings')
      .select(`
        *,
        tutor:tutor_id   ( id, full_name, email ),
        parent:parent_id ( id, full_name, email ),
        student:student_id ( id, name, grade_level )
      `)
      .or(`parent_id.eq.${user.id},tutor_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    setBookings(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const createBooking = async (payload) => {
    const { data, error } = await supabase
      .from('bookings')
      .insert({ ...payload, parent_id: user.id, status: 'pending' })
      .select()
      .single();
    if (error) throw error;
    await fetchBookings();
    return data;
  };

  const updateBookingStatus = async (id, status) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
    if (error) throw error;
    await fetchBookings();
  };

  // Tutor marks complete → parent must confirm
  const markComplete = async (bookingId) => {
    const { error } = await supabase
      .from('bookings').update({ status: 'pending_parent_confirm' }).eq('id', bookingId);
    if (error) throw error;
    await fetchBookings();
  };

  // Parent confirms + rates + deducts commission
  const confirmComplete = async (bookingId, feedback) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) throw new Error('Booking not found.');
    const tutorId = booking.tutor_id;

    const { data: tutorRow } = await supabase
      .from('tutors').select('approved_rate, rate_per_session, wallet_balance').eq('id', tutorId).single();

    const { totalAmount, commission } = calculateCommission(booking, tutorRow?.approved_rate || tutorRow?.rate_per_session);

    await supabase.from('sessions').insert({
      booking_id:            bookingId,
      scheduled_date:        new Date().toISOString().split('T')[0],
      status:                'completed',
      topic_covered:         feedback.topic || '',
      performance_indicator: feedback.indicator || 'good',
      tutor_comments:        '',
    });

    if (tutorId && feedback.star_rating) {
      await supabase.from('tutor_ratings').upsert({
        tutor_id:    tutorId,
        parent_id:   user.id,
        booking_id:  bookingId,
        star_rating: feedback.star_rating,
        comment:     feedback.rating_comment || '',
      }, { onConflict: 'booking_id,parent_id' });
    }

    await supabase.from('bookings').update({
      status:            'completed',
      total_amount:      totalAmount,
      commission_amount: commission,
    }).eq('id', bookingId);

    if (tutorId && commission > 0) {
      const newBalance = Number(tutorRow?.wallet_balance || 0) - commission;
      await supabase.from('tutors').update({ wallet_balance: newBalance }).eq('id', tutorId);
      await supabase.from('wallet_transactions').insert({
        tutor_id:      tutorId,
        type:          'commission_deduction',
        amount:        -commission,
        balance_after: newBalance,
        description:   `10% Commission · ₱${totalAmount.toLocaleString()} total · Booking #${bookingId.slice(0, 8)}`,
        booking_id:    bookingId,
      });
    }

    await fetchBookings();
  };

  // Save schedule (parent proposes or tutor confirms)
  const saveSchedule = async (bookingId, fields) => {
    const { error } = await supabase.from('bookings').update(fields).eq('id', bookingId);
    if (error) throw error;
    await fetchBookings();
  };

  return {
    bookings, loading,
    createBooking, updateBookingStatus, markComplete, confirmComplete, saveSchedule,
    refresh: fetchBookings,
  };
}