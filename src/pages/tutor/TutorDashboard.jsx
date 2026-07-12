import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useBookings } from '../../hooks/useBookings';
import StatCard from '../../components/ui/StatCard';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  const bg = type==='error'?'#FEE2E2':'#D1FAE5', color=type==='error'?'#DC2626':'#065F46';
  return (
    <div style={{position:'fixed',top:24,right:24,zIndex:99999,background:bg,borderRadius:12,padding:'14px 20px',fontSize:14,color,fontWeight:600,boxShadow:'0 4px 20px rgba(0,0,0,.12)',display:'flex',alignItems:'center',gap:10,maxWidth:380}}>
      <span>{type==='error'?'❌':'✅'}</span><span style={{flex:1}}>{msg}</span>
      <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color,fontSize:16,padding:0}}>✕</button>
    </div>
  );
}

export default function TutorDashboard() {
  const { user, profile } = useAuth();
  const { bookings } = useBookings();

  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions,  setTransactions]  = useState([]);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmt,   setWithdrawAmt]   = useState('');
  const [withdrawing,   setWithdrawing]   = useState(false);
  const [gcashNumber,   setGcashNumber]   = useState('');
  const [toast,         setToast]         = useState(null);

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  const fetchWallet = async () => {
    const { data } = await supabase
      .from('tutors')
      .select('wallet_balance')
      .eq('id', user.id)
      .single();
    setWalletBalance(Number(data?.wallet_balance || 0));

    const { data: txns } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setTransactions(txns || []);
    setLoadingWallet(false);
  };

  useEffect(() => { fetchWallet(); }, []);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmt);
    if (!amount || amount < 1)          { showToast('Minimum withdrawal is ₱1.', 'error'); return; }
    if (amount > walletBalance)         { showToast('Insufficient wallet balance.', 'error'); return; }
    if (!gcashNumber.trim())            { showToast('Please enter your GCash number.', 'error'); return; }
    if (gcashNumber.length < 11)        { showToast('Please enter a valid 11-digit GCash number.', 'error'); return; }

    setWithdrawing(true);
    try {
      // Deduct from tutor wallet
      await supabase.rpc('decrement_tutor_wallet', { tutor_id: user.id, amount });

      // Record withdrawal transaction
      await supabase.from('wallet_transactions').insert({
        user_id:     user.id,
        type:        'withdrawal',
        amount,
        description: `Withdrawal to GCash ${gcashNumber}`,
        status:      'pending', // admin processes manually
      });

      showToast(`✅ Withdrawal request of ₱${amount.toFixed(2)} submitted! Admin will process within 1-3 business days.`);
      setWithdrawModal(false);
      setWithdrawAmt('');
      setGcashNumber('');
      fetchWallet();
    } catch(e) { showToast(e.message, 'error'); }
    finally { setWithdrawing(false); }
  };

  const active    = bookings.filter(b=>b.status==='confirmed').length;
  const pending   = bookings.filter(b=>b.status==='pending').length;
  const completed = bookings.filter(b=>b.status==='completed').length;

  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={()=>setToast(null)}/>

      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{fontSize:24}}>
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Tutor'} 👋
        </h2>
        <p className="text-sm text-muted mt-4">Manage your sessions and track your earnings.</p>
      </div>

      {/* Earnings wallet card */}
      <div style={{background:`linear-gradient(135deg,#059669,#10B981)`,borderRadius:16,padding:'24px 28px',marginBottom:24,color:'#fff',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:13,opacity:0.85,marginBottom:4}}>💰 Earnings Wallet</div>
          {loadingWallet ? (
            <Spinner size={24}/>
          ) : (
            <div style={{fontSize:36,fontWeight:900}}>₱{walletBalance.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
          )}
          <div style={{fontSize:12,opacity:0.75,marginTop:4}}>90% of confirmed session payments</div>
        </div>
        <button onClick={()=>setWithdrawModal(true)} disabled={walletBalance<=0}
          style={{background:'rgba(255,255,255,0.2)',border:'2px solid rgba(255,255,255,0.4)',borderRadius:12,padding:'12px 24px',color:'#fff',fontWeight:700,fontSize:14,cursor:walletBalance>0?'pointer':'not-allowed',backdropFilter:'blur(4px)',opacity:walletBalance>0?1:0.6}}>
          📤 Withdraw
        </button>
      </div>

      {/* Platform info */}
      <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:12,padding:'12px 20px',marginBottom:24,fontSize:13,color:'#1D4ED8',lineHeight:1.7}}>
        💡 <strong>How it works:</strong> When a parent pays for confirmed sessions, LearnBridge keeps 10% as a platform fee and deposits 90% directly to your earnings wallet.
      </div>

      {/* Stats */}
      <div className="grid-3 mb-24">
        <StatCard label="Active Sessions"   value={active}    icon="book"  color={tokens.primary}/>
        <StatCard label="Pending Bookings"  value={pending}   icon="clock" color="#F59E0B"/>
        <StatCard label="Completed"         value={completed} icon="check" color={tokens.success}/>
      </div>

      {/* Recent transactions */}
      <div className="card" style={{overflow:'hidden'}}>
        <div style={{padding:'16px 24px',borderBottom:`1px solid ${tokens.border}`}}>
          <div className="font-jakarta font-bold" style={{fontSize:15}}>Recent Earnings</div>
        </div>
        {loadingWallet ? (
          <div style={{textAlign:'center',padding:'24px 0'}}><Spinner dark size={24}/></div>
        ) : transactions.length===0 ? (
          <div style={{textAlign:'center',padding:'32px 0',color:tokens.muted,fontSize:13}}>
            No transactions yet. Earnings appear here after parents pay.
          </div>
        ) : (
          <div style={{padding:'8px 0'}}>
            {transactions.map(t=>(
              <div key={t.id} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 24px',borderBottom:`1px solid ${tokens.border}`}}>
                <div style={{width:36,height:36,borderRadius:10,background:t.type==='earning'?'#D1FAE5':t.type==='withdrawal'?'#FEE2E2':'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                  {t.type==='earning'?'💰':'📤'}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{t.description||t.type}</div>
                  <div style={{fontSize:11,color:tokens.muted}}>{new Date(t.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}</div>
                </div>
                <div style={{fontSize:14,fontWeight:800,color:t.type==='earning'?'#065F46':'#DC2626'}}>
                  {t.type==='earning'?'+':'−'}₱{Number(t.amount).toLocaleString('en-PH',{minimumFractionDigits:2})}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdraw Modal */}
      <Modal open={withdrawModal} onClose={()=>setWithdrawModal(false)} title="📤 Withdraw Earnings"
        footer={<>
          <button className="btn btn-ghost" onClick={()=>setWithdrawModal(false)}>Cancel</button>
          <button className="btn btn-primary" style={{background:'#059669'}} onClick={handleWithdraw} disabled={withdrawing||!withdrawAmt||!gcashNumber}>
            {withdrawing?'Submitting...':'Submit Withdrawal Request'}
          </button>
        </>}>
        <div>
          <div style={{background:'#D1FAE5',border:'1px solid #6EE7B7',borderRadius:10,padding:'12px 16px',marginBottom:20}}>
            <div style={{fontSize:12,color:'#065F46',marginBottom:2}}>Available Balance</div>
            <div style={{fontSize:24,fontWeight:900,color:'#065F46'}}>₱{walletBalance.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
          </div>

          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:tokens.muted,marginBottom:6,fontWeight:600}}>Withdrawal Amount</div>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontWeight:700,color:tokens.mid}}>₱</span>
              <input className="input" type="number" min="1" max={walletBalance} placeholder="0.00"
                value={withdrawAmt} onChange={e=>setWithdrawAmt(e.target.value)} style={{paddingLeft:32}}/>
            </div>
            <button type="button" onClick={()=>setWithdrawAmt(String(walletBalance))}
              style={{marginTop:6,fontSize:11,color:tokens.primary,background:'none',border:'none',cursor:'pointer',fontWeight:600,padding:0}}>
              Withdraw all (₱{walletBalance.toFixed(2)})
            </button>
          </div>

          <div>
            <div style={{fontSize:12,color:tokens.muted,marginBottom:6,fontWeight:600}}>GCash Number</div>
            <input className="input" type="tel" placeholder="e.g. 09171234567" maxLength={11}
              value={gcashNumber} onChange={e=>setGcashNumber(e.target.value.replace(/\D/g,''))}/>
          </div>

          <div style={{background:'#FEF9C3',border:'1px solid #FDE68A',borderRadius:10,padding:'10px 14px',marginTop:16,fontSize:12,color:'#92400E',lineHeight:1.6}}>
            ⏳ Withdrawals are processed by admin within <strong>1–3 business days</strong> via GCash.
          </div>
        </div>
      </Modal>
    </div>
  );
}