import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ── Commission helper ──────────────────────────────────────────────────────
// Commission = 10% of (approved_rate × session_count)
// Falls back to total_amount × 10% if rate/count not available
export function calculateCommission(booking, tutorApprovedRate = null) {
  const rate         = tutorApprovedRate || booking?.approved_rate || booking?.rate_per_session || 0;
  const sessionCount = booking?.session_count || 8; // default 8-session package
  const totalAmount  = Number(booking?.total_amount || 0) || (Number(rate) * Number(sessionCount));
  const commission   = totalAmount * 0.10;
  return {
    rate:          Number(rate),
    sessionCount:  Number(sessionCount),
    totalAmount,
    commission:    Math.round(commission * 100) / 100, // round to 2 decimals
  };
}

export function useBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        tutor:tutor_id   ( id, full_name, email ),
        parent:parent_id ( id, full_name, email ),
        student:student_id ( id, name, grade_level )
      `)
      .or(`parent_id.eq.${user.id},tutor_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!error) setBookings(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const createBooking = async (payload) => {
    // Always compute and save commission_amount on booking creation
    const rate          = Number(payload.approved_rate || payload.rate_per_session || 0);
    const sessionCount  = Number(payload.session_count || 8);
    const totalAmount   = Number(payload.total_amount || 0) || (rate * sessionCount);
    const commissionAmt = Math.round(totalAmount * 0.10 * 100) / 100;

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...payload,
        parent_id:        user.id,
        status:           'pending',
        total_amount:     totalAmount,
        commission_amount: commissionAmt,
        session_count:    sessionCount,
      })
      .select()
      .single();
    if (error) throw error;
    await fetchBookings();
    return data;
  };

  const updateBookingStatus = async (id, status) => {
    const { error } = await supabase
      .from('bookings').update({ status }).eq('id', id);
    if (error) throw error;
    await fetchBookings();
  };

  // Tutor clicks "Complete" → pending_parent_confirm
  const markComplete = async (bookingId) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'pending_parent_confirm' })
      .eq('id', bookingId);
    if (error) throw error;
    await fetchBookings();
  };

  // Parent clicks "Confirm" → saves rating + session + marks completed + deducts 10% commission
  const confirmComplete = async (bookingId, feedback) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) throw new Error('Booking not found.');

    const tutorId = booking.tutor_id;

    // ── Step 1: Get tutor's approved rate for accurate commission ──────────
    const { data: tutorRow } = await supabase
      .from('tutors')
      .select('approved_rate, rate_per_session, wallet_balance')
      .eq('id', tutorId)
      .single();

    const { totalAmount, commission } = calculateCommission(booking, tutorRow?.approved_rate || tutorRow?.rate_per_session);

    // ── Step 2: Create session record ──────────────────────────────────────
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        booking_id:            bookingId,
        scheduled_date:        new Date().toISOString().split('T')[0],
        status:                'completed',
        topic_covered:         feedback.topic || '',
        performance_indicator: feedback.indicator || 'good',
        tutor_comments:        '',
      });
    if (sessionError) throw new Error('Failed to save session: ' + sessionError.message);

    // ── Step 3: Save parent star rating ────────────────────────────────────
    const starRating    = feedback.star_rating || 5;
    const ratingComment = feedback.rating_comment || '';
    if (tutorId && starRating) {
      const { error: ratingError } = await supabase
        .from('tutor_ratings')
        .upsert({
          tutor_id:    tutorId,
          parent_id:   user.id,
          booking_id:  bookingId,
          star_rating: starRating,
          comment:     ratingComment,
        }, { onConflict: 'booking_id,parent_id' });
      if (ratingError) console.error('Rating save error:', ratingError);
    }

    // ── Step 4: Update booking to completed + save commission_amount ────────
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        status:            'completed',
        total_amount:      totalAmount,
        commission_amount: commission,
      })
      .eq('id', bookingId);
    if (bookingError) throw new Error('Failed to complete booking: ' + bookingError.message);

    // ── Step 5: Deduct commission from tutor wallet ─────────────────────────
    if (tutorId && commission > 0) {
      const currentBalance = Number(tutorRow?.wallet_balance || 0);
      const newBalance     = currentBalance - commission;

      const { error: walletErr } = await supabase
        .from('tutors')
        .update({ wallet_balance: newBalance })
        .eq('id', tutorId);

      if (walletErr) console.error('Wallet deduction error:', walletErr);

      // ── Step 6: Record transaction with full breakdown ──────────────────
      await supabase
        .from('wallet_transactions')
        .insert({
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

  return {
    bookings,
    loading,
    createBooking,
    updateBookingStatus,
    markComplete,
    confirmComplete,
    refresh: fetchBookings,
  };
}