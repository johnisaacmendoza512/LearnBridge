import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { createTopUpLink } from '../../lib/paymongo';
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

export default function ParentWalletPage() {
  const { user, profile } = useAuth();
  const [searchParams]    = useSearchParams();

  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions,  setTransactions]  = useState([]);
  const [loading,       setLoading]       = useState(true);
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
      .order('created_at', { ascending: false });
    setTransactions(txns || []);
    setLoading(false);
  };

  // Check if returning from PayMongo
  useEffect(() => {
    const verifyTopUp = async () => {
      const topup   = searchParams.get('topup');
      const stored  = localStorage.getItem('lb_topup');
      const pending = stored ? JSON.parse(stored) : null;

      if (topup === 'success' && pending) {
        localStorage.removeItem('lb_topup');
        try {
          const { data: existing } = await supabase
            .from('wallet_transactions')
            .select('id, status')
            .eq('paymongo_link_id', pending.linkId)
            .single();

          if (existing?.status === 'completed') {
            showToast('Wallet already credited for this payment.');
          } else {
            await supabase.rpc('increment_wallet', { user_id: pending.userId || user.id, amount: pending.amount });
            await supabase.from('wallet_transactions')
              .update({ status: 'completed' })
              .eq('paymongo_link_id', pending.linkId);
            showToast(`✅ ₱${Number(pending.amount).toFixed(2)} added to your wallet!`);
          }
        } catch(e) { showToast('Payment received but wallet update failed. Contact support.', 'error'); }
        window.history.replaceState({}, '', '/wallet');
      } else if (topup === 'failed') {
        showToast('Payment was cancelled or failed. Please try again.', 'error');
        localStorage.removeItem('lb_topup');
        window.history.replaceState({}, '', '/wallet');
      }
      fetchWallet();
    };
    verifyTopUp();
  }, []);

  const handleSimulatePayment = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount < 1) { showToast('Please enter a valid amount.', 'error'); return; }
    setTopping(true);
    try {
      await supabase.rpc('increment_wallet', { user_id: user.id, amount });
      await supabase.from('wallet_transactions').insert({
        user_id:     user.id,
        type:        'topup',
        amount,
        description: 'Wallet top up via PayMongo',
        status:      'completed',
      });
      setTopUpModal(false);
      setTopUpAmount('');
      showToast(`✅ ₱${amount.toFixed(2)} added to your wallet!`);
      fetchWallet();
    } catch(e) { showToast(e.message, 'error'); }
    finally { setTopping(false); }
  };

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount < 1) { showToast('Minimum top up is ₱1.', 'error'); return; }
    setTopping(true);
    try {
      const { linkId, checkoutUrl } = await createTopUpLink({ amount, userId: user.id });
      await supabase.from('wallet_transactions').insert({
        user_id:          user.id,
        type:             'topup',
        amount,
        description:      'Wallet top up via PayMongo',
        status:           'pending',
        paymongo_link_id: linkId,
      });
      localStorage.setItem('lb_topup', JSON.stringify({ linkId, amount, userId: user.id }));
      window.location.href = checkoutUrl;
    } catch(e) { showToast(e.message, 'error'); }
    finally { setTopping(false); }
  };

  const typeConfig = {
    topup:      { label:'Top Up',   color:'#065F46', bg:'#D1FAE5', icon:'💰', sign:'+' },
    deduction:  { label:'Payment',  color:'#DC2626', bg:'#FEE2E2', icon:'💳', sign:'-' },
    earning:    { label:'Earning',  color:'#1D4ED8', bg:'#EFF6FF', icon:'📈', sign:'+' },
    withdrawal: { label:'Withdraw', color:'#D97706', bg:'#FEF9C3', icon:'📤', sign:'-' },
  };

  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={()=>setToast(null)}/>

      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{fontSize:22}}>💳 My Wallet</h2>
        <p className="text-sm text-muted mt-4">Manage your LearnBridge wallet balance and transactions.</p>
      </div>

      {/* Wallet card */}
      <div style={{background:`linear-gradient(135deg, ${tokens.primary}, #6366F1)`,borderRadius:16,padding:'28px 32px',marginBottom:24,color:'#fff',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:13,opacity:0.85,marginBottom:6}}>💳 Available Balance</div>
          {loading ? <Spinner size={28}/> : (
            <div style={{fontSize:42,fontWeight:900,letterSpacing:-1}}>
              ₱{walletBalance.toLocaleString('en-PH',{minimumFractionDigits:2})}
            </div>
          )}
          <div style={{fontSize:12,opacity:0.75,marginTop:6}}>Used for session payments</div>
        </div>
        {profile?.status === 'approved' ? (
          <button onClick={()=>setTopUpModal(true)}
            style={{background:'rgba(255,255,255,0.2)',border:'2px solid rgba(255,255,255,0.5)',borderRadius:12,padding:'14px 28px',color:'#fff',fontWeight:700,fontSize:15,cursor:'pointer',backdropFilter:'blur(4px)',flexShrink:0}}>
            + Top Up
          </button>
        ) : (
          <div style={{background:'rgba(255,255,255,0.1)',border:'2px solid rgba(255,255,255,0.3)',borderRadius:12,padding:'14px 28px',color:'rgba(255,255,255,0.6)',fontWeight:700,fontSize:13,textAlign:'center'}}>
            🪪 Verify ID first
          </div>
        )}
      </div>

      {/* Info box */}
      <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:12,padding:'14px 20px',marginBottom:24,fontSize:13,color:'#1D4ED8',lineHeight:1.7}}>
        💡 Each session costs <strong>₱1 × 8 sessions = ₱8 per booking</strong>. Payment is deducted automatically after both you and the tutor confirm the sessions.
      </div>

      {/* Transactions */}
      <div className="card" style={{overflow:'hidden'}}>
        <div style={{padding:'16px 24px',borderBottom:`1px solid ${tokens.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div className="font-jakarta font-bold" style={{fontSize:15}}>Transaction History</div>
          <div style={{fontSize:12,color:tokens.muted}}>{transactions.length} transaction{transactions.length!==1?'s':''}</div>
        </div>

        {loading ? (
          <div style={{textAlign:'center',padding:'32px 0'}}><Spinner dark size={28}/></div>
        ) : transactions.length === 0 ? (
          <div style={{textAlign:'center',padding:'40px 0',color:tokens.muted}}>
            <div style={{fontSize:40,marginBottom:12}}>💳</div>
            <div style={{fontWeight:600,fontSize:14}}>No transactions yet</div>
            <p style={{fontSize:13,marginTop:4}}>Top up your wallet to get started.</p>
          </div>
        ) : (
          <div>
            {transactions.map(t => {
              const tc = typeConfig[t.type] || {label:t.type,color:tokens.muted,bg:'#F3F4F6',icon:'💸',sign:''};
              return (
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:14,padding:'16px 24px',borderBottom:`1px solid ${tokens.border}`}}>
                  <div style={{width:42,height:42,borderRadius:12,background:tc.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                    {tc.icon}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600}}>{t.description || tc.label}</div>
                    <div style={{fontSize:11,color:tokens.muted,marginTop:2}}>
                      {new Date(t.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:16,fontWeight:800,color:tc.color}}>
                      {tc.sign}₱{Number(t.amount).toLocaleString('en-PH',{minimumFractionDigits:2})}
                    </div>
                    <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:t.status==='completed'?'#D1FAE5':t.status==='pending'?'#FEF9C3':'#FEE2E2',color:t.status==='completed'?'#065F46':t.status==='pending'?'#92400E':'#DC2626'}}>
                      {t.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Up Modal */}
      <Modal open={topUpModal} onClose={()=>setTopUpModal(false)} title="💳 Top Up Wallet"
        footer={<>
          <button className="btn btn-ghost" onClick={()=>setTopUpModal(false)}>Cancel</button>
          <button className="btn btn-sm" onClick={handleSimulatePayment} disabled={topping||!topUpAmount}
            style={{background:'#F59E0B',color:'#fff',border:'none',fontWeight:700}}>
            {topping?'Processing...':'🧪 Simulate Payment'}
          </button>
          <button className="btn btn-primary" onClick={handleTopUp} disabled={topping||!topUpAmount}>
            {topping?'Redirecting...':'Pay via PayMongo →'}
          </button>
        </>}>
        <div>
          <p className="text-sm text-muted mb-20" style={{lineHeight:1.7}}>
            Add funds to your LearnBridge wallet via GCash, Maya, or Credit Card through PayMongo.
          </p>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:tokens.muted,marginBottom:8,fontWeight:600}}>Quick amounts:</div>
            <div className="flex gap-8">
              {[8,50,100,500].map(a=>(
                <button key={a} type="button" onClick={()=>setTopUpAmount(String(a))}
                  style={{flex:1,padding:'10px 8px',borderRadius:10,border:`2px solid ${topUpAmount===String(a)?tokens.primary:tokens.border}`,background:topUpAmount===String(a)?tokens.primaryLight:'#FAFAFA',color:topUpAmount===String(a)?tokens.primary:tokens.mid,fontWeight:700,fontSize:13,cursor:'pointer'}}>
                  ₱{a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:12,color:tokens.muted,marginBottom:6,fontWeight:600}}>Or enter custom amount:</div>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontWeight:700,color:tokens.mid}}>₱</span>
              <input className="input" type="number" min="1" placeholder="0.00"
                value={topUpAmount} onChange={e=>setTopUpAmount(e.target.value)} style={{paddingLeft:32}}/>
            </div>
          </div>
          <div style={{background:'#FEF9C3',border:'1px solid #FDE68A',borderRadius:10,padding:'10px 14px',marginTop:12,fontSize:12,color:'#92400E',lineHeight:1.6}}>
            🧪 <strong>Simulate Payment</strong> — instantly credits your wallet without PayMongo. For demo purposes only.
          </div>
        </div>
      </Modal>
    </div>
  );
}
