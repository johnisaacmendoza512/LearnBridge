import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useWallet() {
  const { user } = useAuth();
  const [balance,      setBalance]      = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);

  const fetchWallet = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: tutor } = await supabase
      .from('tutors')
      .select('wallet_balance')
      .eq('id', user.id)
      .single();

    const { data: txns } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setBalance(tutor?.wallet_balance ?? 0);
    setTransactions(txns || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  const hasEnoughBalance = (amount) => balance >= amount;

  return { balance, transactions, loading, hasEnoughBalance, refresh: fetchWallet };
}