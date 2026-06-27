import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useWallet() {
  const { user } = useAuth();
  const [balance,      setBalance]      = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [topups,       setTopups]       = useState([]);
  const [loading,      setLoading]      = useState(true);

  const fetchWallet = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch wallet balance from tutors table
    const { data: tutor } = await supabase
      .from('tutors')
      .select('wallet_balance')
      .eq('id', user.id)
      .single();

    // Fetch transaction history
    const { data: txns } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false });

    // Fetch top-up requests
    const { data: topupData } = await supabase
      .from('wallet_topups')
      .select('*')
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false });

    setBalance(tutor?.wallet_balance ?? 0);
    setTransactions(txns || []);
    setTopups(topupData || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  // Submit a GCash top-up request (pending admin approval)
  const submitTopupRequest = async ({ amount, referenceNumber, receiptFile }) => {
    if (!user) throw new Error('Not authenticated');

    // Check for duplicate reference number
    const { data: existing } = await supabase
      .from('wallet_topups')
      .select('id')
      .eq('reference_number', referenceNumber)
      .single();

    if (existing) throw new Error('This GCash reference number has already been submitted.');

    let receiptUrl = null;

    // Upload receipt image if provided
    if (receiptFile) {
      const ext  = receiptFile.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('wallet-receipts')
        .upload(path, receiptFile, { upsert: false });

      if (uploadErr) throw new Error('Failed to upload receipt: ' + uploadErr.message);

      const { data: urlData } = supabase.storage
        .from('wallet-receipts')
        .getPublicUrl(path);

      receiptUrl = urlData?.publicUrl || null;
    }

    // Create top-up request
    const { error } = await supabase.from('wallet_topups').insert({
      tutor_id:         user.id,
      amount:           Number(amount),
      reference_number: referenceNumber.trim(),
      receipt_url:      receiptUrl,
      status:           'pending',
    });

    if (error) throw error;
    await fetchWallet();
  };

  // Deduct commission from wallet after booking completion
  const deductCommission = async (bookingId, commissionAmount, bookingRef) => {
    if (!user) return;

    const newBalance = balance - commissionAmount;

    // Update wallet balance
    const { error: balErr } = await supabase
      .from('tutors')
      .update({ wallet_balance: newBalance })
      .eq('id', user.id);

    if (balErr) throw balErr;

    // Record transaction
    await supabase.from('wallet_transactions').insert({
      tutor_id:      user.id,
      type:          'commission_deduction',
      amount:        -commissionAmount,
      balance_after: newBalance,
      description:   `10% platform commission · ${bookingRef || 'Booking'}`,
      booking_id:    bookingId,
    });

    await fetchWallet();
  };

  // Check if tutor has enough balance for a booking's commission
  const hasEnoughBalance = (commissionAmount) => {
    return balance >= commissionAmount;
  };

  return {
    balance,
    transactions,
    topups,
    loading,
    submitTopupRequest,
    deductCommission,
    hasEnoughBalance,
    refresh: fetchWallet,
  };
}