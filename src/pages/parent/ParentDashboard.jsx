import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useBookings } from '../../hooks/useBookings';
import { useStudents } from '../../hooks/useStudents';
import { createTopUpLink, getPaymentLinkStatus } from '../../lib/paymongo';
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

export default function ParentDashboard() {
  const { user, profile } = useAuth();
  const { bookings } = useBookings();
  const { students } = useStudents();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions,  setTransactions]  = useState([]);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [topUpModal,    setTopUpModal]    = useState(false);
  const [topUpAmount,   setTopUpAmount]   = useState('');
  const [topping,       setTopping]       = useState(false);
  const [toast,         setToast]         = useState(null);

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  const fetchWallet = async () => {
    const { data } = await supabase
      .from('profiles')
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

  // Check if returning from PayMongo top up
  useEffect(() => {
    const verifyTopUp = async () => {
      const linkId   = searchParams.get('link_id');
      const topup    = searchParams.get('topup');
      const amtParam = parseFloat(searchParams.get('amount') || '0');
      const uidParam = searchParams.get('user_id');

      if (!linkId || topup !== 'success') { fetchWallet(); return; }

      try {
        // Check if already processed to avoid double credit
        const { data: existing } = await supabase
          .from('wallet_transactions')
          .select('id')
          .eq('paymongo_link_id', linkId)
          .eq('status', 'completed')
          .maybeSingle();

        if (!existing) {
          const creditUserId = uidParam || user.id;
          const creditAmount = amtParam || 0;

          // Add to wallet
          await supabase.rpc('increment_wallet', { user_id: creditUserId, amount: creditAmount });
          await supabase.from('wallet_transactions').insert({
            user_id:          creditUserId,
            type:             'topup',
            amount:           creditAmount,
            description:      'Wallet top up via PayMongo',
            status:           'completed',
            paymongo_link_id: linkId,
          });
          showToast(`✅ ₱${creditAmount.toFixed(2)} added to your wallet!`);
        } else {
          showToast('Wallet already credited for this payment.');
        }
      } catch(e) {
        console.error('Top up verify error:', e);
        showToast('Could not verify payment. Contact support.', 'error');
      }

      // Clean URL
      window.history.replaceState({}, '', '/dashboard');
      fetchWallet();
    };

    verifyTopUp();
  }, []);

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount < 1) { showToast('Minimum top up is ₱1.', 'error'); return; }
    setTopping(true);
    try {
      const { linkId, checkoutUrl } = await createTopUpLink({ amount, userId: user.id });

      // Save pending transaction
      await supabase.from('wallet_transactions').insert({
        user_id:          user.id,
        type:             'topup',
        amount,
        description:      'Wallet top up via PayMongo',
        status:           'pending',
        paymongo_link_id: linkId,
      });

      // Redirect to PayMongo
      window.location.href = `${checkoutUrl}?success_url=${encodeURIComponent(`https://learnbridge.site/dashboard?link_id=${linkId}&type=topup`)}`;
    } catch(e) {
      showToast(e.message, 'error');
    } finally { setTopping(false); }
  };

  const active    = bookings.filter(b => b.status === 'confirmed').length;
  const pending   = bookings.filter(b => b.status === 'pending').length;
  const completed = bookings.filter(b => b.status === 'completed').length;

  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={()=>setToast(null)}/>

      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{fontSize:24}}>
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Parent'} 👋
        </h2>
        <p className="text-sm text-muted mt-4">Manage your children's learning journey.</p>
      </div>

      {/* Wallet card */}
      <div style={{background:`linear-gradient(135deg, ${tokens.primary}, #6366F1)`,borderRadius:16,padding:'24px 28px',marginBottom:24,color:'#fff',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:13,opacity:0.85,marginBottom:4}}>💳 Wallet Balance</div>
          {loadingWallet ? (
            <Spinner size={24}/>
          ) : (
            <div style={{fontSize:36,fontWeight:900}}>₱{walletBalance.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
          )}
          <div style={{fontSize:12,opacity:0.75,marginTop:4}}>Available for session payments</div>
        </div>
        <button onClick={()=>setTopUpModal(true)}
          style={{background:'rgba(255,255,255,0.2)',border:'2px solid rgba(255,255,255,0.4)',borderRadius:12,padding:'12px 24px',color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer',backdropFilter:'blur(4px)'}}>
          + Top Up
        </button>
      </div>

      {/* Stats */}
      <div className="grid-3 mb-24">
        <StatCard label="Active Sessions"   value={active}            icon="book"      color={tokens.primary}/>
        <StatCard label="Pending Bookings"  value={pending}           icon="clock"     color="#F59E0B"/>
        <StatCard label="Children"          value={students.length}   icon="users"     color={tokens.success}/>
      </div>

      {/* Recent transactions */}
      <div className="card" style={{overflow:'hidden'}}>
        <div style={{padding:'16px 24px',borderBottom:`1px solid ${tokens.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div className="font-jakarta font-bold" style={{fontSize:15}}>Recent Wallet Activity</div>
        </div>
        {loadingWallet ? (
          <div style={{textAlign:'center',padding:'24px 0'}}><Spinner dark size={24}/></div>
        ) : transactions.length === 0 ? (
          <div style={{textAlign:'center',padding:'32px 0',color:tokens.muted,fontSize:13}}>
            No wallet activity yet. Top up to get started!
          </div>
        ) : (
          <div style={{padding:'8px 0'}}>
            {transactions.map(t=>(
              <div key={t.id} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 24px',borderBottom:`1px solid ${tokens.border}`}}>
                <div style={{width:36,height:36,borderRadius:10,background:t.type==='topup'?'#D1FAE5':t.type==='deduction'?'#FEE2E2':'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                  {t.type==='topup'?'💰':t.type==='deduction'?'💳':'📤'}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{t.description||t.type}</div>
                  <div style={{fontSize:11,color:tokens.muted}}>{new Date(t.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                </div>
                <div style={{fontSize:14,fontWeight:800,color:t.type==='topup'?'#065F46':t.type==='deduction'?'#DC2626':tokens.primary}}>
                  {t.type==='topup'?'+':'−'}₱{Number(t.amount).toLocaleString('en-PH',{minimumFractionDigits:2})}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Up Modal */}
      <Modal open={topUpModal} onClose={()=>setTopUpModal(false)} title="💳 Top Up Wallet"
        footer={<>
          <button className="btn btn-ghost" onClick={()=>setTopUpModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleTopUp} disabled={topping||!topUpAmount}>
            {topping?'Redirecting to PayMongo...':'Pay via PayMongo →'}
          </button>
        </>}>
        <div>
          <p className="text-sm text-muted mb-20" style={{lineHeight:1.7}}>
            Add funds to your LearnBridge wallet. You'll be redirected to PayMongo to pay securely via GCash, Maya, or Credit Card.
          </p>

          {/* Quick amounts */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:tokens.muted,marginBottom:8,fontWeight:600}}>Quick amounts:</div>
            <div className="flex gap-8">
              {[8, 50, 100, 500].map(a=>(
                <button key={a} type="button" onClick={()=>setTopUpAmount(String(a))}
                  style={{flex:1,padding:'10px 8px',borderRadius:10,border:`2px solid ${topUpAmount===String(a)?tokens.primary:tokens.border}`,background:topUpAmount===String(a)?tokens.primaryLight:'#FAFAFA',color:topUpAmount===String(a)?tokens.primary:tokens.mid,fontWeight:700,fontSize:13,cursor:'pointer'}}>
                  ₱{a}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div>
            <div style={{fontSize:12,color:tokens.muted,marginBottom:6,fontWeight:600}}>Or enter custom amount:</div>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontWeight:700,color:tokens.mid}}>₱</span>
              <input className="input" type="number" min="1" placeholder="0.00"
                value={topUpAmount} onChange={e=>setTopUpAmount(e.target.value)}
                style={{paddingLeft:32}}/>
            </div>
          </div>

          <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,padding:'10px 14px',marginTop:16,fontSize:12,color:'#1D4ED8',lineHeight:1.6}}>
            ℹ️ Each session costs ₱1 × 8 sessions = <strong>₱8 per booking</strong>. Your wallet balance will be deducted automatically after both you and the tutor confirm the sessions.
          </div>
        </div>
      </Modal>
    </div>
  );
}