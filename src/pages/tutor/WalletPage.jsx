import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
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

export default function WalletPage() {
  const { user } = useAuth();

  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions,  setTransactions]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmt,   setWithdrawAmt]   = useState('');
  const [paymongoName,   setPaymongoName]   = useState('');
  const [paymongoNumber, setPaymongoNumber] = useState('');
  const [withdrawing,   setWithdrawing]   = useState(false);
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
      .order('created_at', { ascending: false });
    setTransactions(txns || []);
    setLoading(false);
  };

  useEffect(() => { fetchWallet(); }, [user]);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmt);
    if (!amount || amount < 1)   { showToast('Minimum withdrawal is ₱1.', 'error'); return; }
    if (amount > walletBalance)  { showToast('Insufficient wallet balance.', 'error'); return; }
    if (!paymongoName.trim())     { showToast('Please enter your PayMongo account name.', 'error'); return; }
    if (!paymongoNumber.trim())   { showToast('Please enter your PayMongo account number.', 'error'); return; }

    setWithdrawing(true);
    try {
      await supabase.rpc('decrement_tutor_wallet', { tutor_id: user.id, amount });
      await supabase.from('wallet_transactions').insert({
        user_id:     user.id,
        type:        'withdrawal',
        amount,
        description: `Withdrawal to PayMongo — ${paymongoName} (${paymongoNumber})`,
        status:      'pending',
      });
      showToast(`✅ Withdrawal request of ₱${amount.toFixed(2)} submitted! Admin will process within 1-3 business days.`);
      setWithdrawModal(false);
      setWithdrawAmt('');
      setPaymongoName('');
      setPaymongoNumber('');
      fetchWallet();
    } catch(e) { showToast(e.message, 'error'); }
    finally { setWithdrawing(false); }
  };

  const typeConfig = {
    earning:    { label:'Earning',    color:'#065F46', bg:'#D1FAE5', icon:'💰', sign:'+' },
    withdrawal: { label:'Withdrawal', color:'#DC2626', bg:'#FEE2E2', icon:'📤', sign:'-' },
    deduction:  { label:'Deduction',  color:'#D97706', bg:'#FEF9C3', icon:'💳', sign:'-' },
    topup:      { label:'Top Up',     color:'#1D4ED8', bg:'#EFF6FF', icon:'💳', sign:'+' },
  };

  const totalEarned    = transactions.filter(t=>t.type==='earning').reduce((s,t)=>s+Number(t.amount||0),0);
  const totalWithdrawn = transactions.filter(t=>t.type==='withdrawal').reduce((s,t)=>s+Number(t.amount||0),0);
  const pendingWithdraw= transactions.filter(t=>t.type==='withdrawal'&&t.status==='pending').reduce((s,t)=>s+Number(t.amount||0),0);

  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={()=>setToast(null)}/>

      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{fontSize:22}}>💰 My Wallet</h2>
        <p className="text-sm text-muted mt-4">Track your earnings and request withdrawals.</p>
      </div>

      {/* Wallet balance card */}
      <div style={{background:`linear-gradient(135deg,#059669,#10B981)`,borderRadius:16,padding:'28px 32px',marginBottom:24,color:'#fff',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:13,opacity:0.85,marginBottom:6}}>💰 Available Balance</div>
          {loading ? <Spinner size={28}/> : (
            <div style={{fontSize:42,fontWeight:900,letterSpacing:-1}}>
              ₱{walletBalance.toLocaleString('en-PH',{minimumFractionDigits:2})}
            </div>
          )}
          <div style={{fontSize:12,opacity:0.75,marginTop:6}}>90% of confirmed session payments</div>
        </div>
        <button onClick={()=>setWithdrawModal(true)} disabled={walletBalance<=0}
          style={{background:'rgba(255,255,255,0.2)',border:'2px solid rgba(255,255,255,0.5)',borderRadius:12,padding:'14px 28px',color:'#fff',fontWeight:700,fontSize:15,cursor:walletBalance>0?'pointer':'not-allowed',backdropFilter:'blur(4px)',opacity:walletBalance>0?1:0.6,flexShrink:0}}>
          📤 Withdraw
        </button>
      </div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
        {[
          {label:'Total Earned',      value:`₱${totalEarned.toLocaleString('en-PH',{minimumFractionDigits:2})}`,    bg:'#D1FAE5',color:'#065F46',icon:'💰'},
          {label:'Total Withdrawn',   value:`₱${totalWithdrawn.toLocaleString('en-PH',{minimumFractionDigits:2})}`, bg:'#FEE2E2',color:'#DC2626',icon:'📤'},
          {label:'Pending Withdrawal',value:`₱${pendingWithdraw.toLocaleString('en-PH',{minimumFractionDigits:2})}`,bg:'#FEF9C3',color:'#92400E',icon:'⏳'},
        ].map(c=>(
          <div key={c.label} style={{background:c.bg,borderRadius:14,padding:'16px 20px'}}>
            <div style={{fontSize:24,marginBottom:6}}>{c.icon}</div>
            <div style={{fontSize:20,fontWeight:900,color:c.color}}>{c.value}</div>
            <div style={{fontSize:11,color:c.color,opacity:0.8,marginTop:2}}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Commission info */}
      <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:12,padding:'14px 20px',marginBottom:24,fontSize:13,color:'#1D4ED8',lineHeight:1.7}}>
        💡 <strong>How it works:</strong> When a parent pays for confirmed sessions, LearnBridge keeps <strong>10%</strong> as a platform fee and deposits <strong>90%</strong> directly to your earnings wallet.
      </div>

      {/* Transaction history */}
      <div className="card" style={{overflow:'hidden'}}>
        <div style={{padding:'16px 24px',borderBottom:`1px solid ${tokens.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div className="font-jakarta font-bold" style={{fontSize:15}}>Transaction History</div>
          <div style={{fontSize:12,color:tokens.muted}}>{transactions.length} transaction{transactions.length!==1?'s':''}</div>
        </div>

        {loading ? (
          <div style={{textAlign:'center',padding:'32px 0'}}><Spinner dark size={28}/></div>
        ) : transactions.length===0 ? (
          <div style={{textAlign:'center',padding:'40px 0',color:tokens.muted}}>
            <div style={{fontSize:40,marginBottom:12}}>💰</div>
            <div style={{fontWeight:600,fontSize:14}}>No transactions yet</div>
            <p style={{fontSize:13,marginTop:4}}>Your earnings will appear here after parents confirm and pay for sessions.</p>
          </div>
        ) : (
          <div>
            {transactions.map(t=>{
              const tc = typeConfig[t.type] || {label:t.type,color:tokens.muted,bg:'#F3F4F6',icon:'💸',sign:''};
              return (
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:14,padding:'16px 24px',borderBottom:`1px solid ${tokens.border}`}}>
                  <div style={{width:42,height:42,borderRadius:12,background:tc.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                    {tc.icon}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600}}>{t.description||tc.label}</div>
                    <div style={{fontSize:11,color:tokens.muted,marginTop:2}}>
                      {new Date(t.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:16,fontWeight:800,color:tc.color}}>
                      {tc.sign}₱{Number(t.amount).toLocaleString('en-PH',{minimumFractionDigits:2})}
                    </div>
                    <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,
                      background:t.status==='completed'?'#D1FAE5':t.status==='pending'?'#FEF9C3':'#FEE2E2',
                      color:t.status==='completed'?'#065F46':t.status==='pending'?'#92400E':'#DC2626'}}>
                      {t.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Withdraw Modal */}
      <Modal open={withdrawModal} onClose={()=>setWithdrawModal(false)} title="📤 Withdraw Earnings"
        footer={<>
          <button className="btn btn-ghost" onClick={()=>setWithdrawModal(false)}>Cancel</button>
          <button className="btn btn-primary" style={{background:'#059669'}} onClick={handleWithdraw} disabled={withdrawing||!withdrawAmt||!paymongoName||!paymongoNumber}>
            {withdrawing?'Submitting...':'Submit Withdrawal Request'}
          </button>
        </>}>
        <div>
          <div style={{background:'#D1FAE5',border:'1px solid #6EE7B7',borderRadius:10,padding:'14px 16px',marginBottom:20}}>
            <div style={{fontSize:12,color:'#065F46',marginBottom:2,fontWeight:600}}>Available Balance</div>
            <div style={{fontSize:28,fontWeight:900,color:'#065F46'}}>₱{walletBalance.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
          </div>

          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:tokens.muted,marginBottom:6,fontWeight:600}}>Withdrawal Amount (₱)</div>
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

          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:tokens.muted,marginBottom:6,fontWeight:600}}>PayMongo Account Name</div>
            <input className="input" type="text" placeholder=""
              value={paymongoName} onChange={e=>setPaymongoName(e.target.value)}/>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:tokens.muted,marginBottom:6,fontWeight:600}}>PayMongo Account Number</div>
            <input className="input" type="text" placeholder=""
              value={paymongoNumber} onChange={e=>setPaymongoNumber(e.target.value)}/>
          </div>

          <div style={{background:'#FEF9C3',border:'1px solid #FDE68A',borderRadius:10,padding:'10px 14px',fontSize:12,color:'#92400E',lineHeight:1.6}}>
            ⏳ Withdrawals are processed by admin within <strong>1–3 business days</strong> via PayMongo.
          </div>
        </div>
      </Modal>
    </div>
  );
}