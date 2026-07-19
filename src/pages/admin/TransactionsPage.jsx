import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
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

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', {month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

export default function TransactionsPage() {
  const [tab,              setTab]              = useState('commission');
  const [commission,       setCommission]       = useState([]);
  const [allTxns,          setAllTxns]          = useState([]);
  const [withdrawals,      setWithdrawals]      = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [toast,            setToast]            = useState(null);
  const [processing,       setProcessing]       = useState(null);

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const fetchAll = async () => {
    setLoading(true);

    // Platform commission (10%)
    const { data: platData } = await supabase
      .from('platform_earnings')
      .select(`
        *,
        booking:booking_id (
          subject,
          parent:parent_id (full_name),
          tutor:tutor_id (full_name)
        )
      `)
      .order('created_at', { ascending: false });
    setCommission(platData || []);

    // All wallet transactions
    const { data: txnData } = await supabase
      .from('wallet_transactions')
      .select(`*, user:user_id (full_name, email)`)
      .order('created_at', { ascending: false });
    setAllTxns(txnData || []);

    // Pending withdrawals (tutor withdrawals pending admin action)
    const { data: wdData } = await supabase
      .from('wallet_transactions')
      .select(`*, user:user_id (full_name, email)`)
      .eq('type', 'withdrawal')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setWithdrawals(wdData || []);

    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleProcessWithdrawal = async (txn, action) => {
    setProcessing(txn.id);
    try {
      if (action === 'approve') {
        await supabase.from('wallet_transactions')
          .update({ status: 'completed' })
          .eq('id', txn.id);
        showToast(`✅ Withdrawal of ₱${Number(txn.amount).toFixed(2)} approved for ${txn.user?.full_name}`);
      } else {
        // Reject — refund to tutor wallet
        await supabase.from('wallet_transactions')
          .update({ status: 'failed' })
          .eq('id', txn.id);
        await supabase.rpc('increment_tutor_wallet', {
          tutor_id: txn.user_id,
          amount:   txn.amount,
        });
        showToast(`Withdrawal rejected. ₱${Number(txn.amount).toFixed(2)} refunded to tutor wallet.`);
      }
      await fetchAll();
    } catch(e) { showToast(e.message, 'error'); }
    finally { setProcessing(null); }
  };

  // Summary totals
  const totalCommission  = commission.reduce((s,e) => s + Number(e.commission||0), 0);
  const totalTopUps      = allTxns.filter(t=>t.type==='topup').reduce((s,t) => s + Number(t.amount||0), 0);
  const totalEarnings    = allTxns.filter(t=>t.type==='earning').reduce((s,t) => s + Number(t.amount||0), 0);
  const pendingWithdraw  = withdrawals.reduce((s,t) => s + Number(t.amount||0), 0);

  const TABS = [
    { key:'commission', label:'🏛 Platform Commission', count:commission.length },
    { key:'all',        label:'📋 All Transactions',    count:allTxns.length },
    { key:'withdraw',   label:'📤 Withdrawal Requests', count:withdrawals.length },
  ];

  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={()=>setToast(null)}/>

      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{fontSize:22}}>💰 Transactions</h2>
        <p className="text-sm text-muted mt-4">Platform financial overview — all payments, earnings and commissions.</p>
      </div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
        {[
          {label:'Platform Commission (10%)', value:`₱${totalCommission.toFixed(2)}`,  bg:'#D1FAE5', color:'#065F46', icon:'🏛'},
          {label:'Total Parent Top Ups',      value:`₱${totalTopUps.toFixed(2)}`,       bg:'#EFF6FF', color:'#1D4ED8', icon:'💳'},
          {label:'Total Tutor Earnings (90%)',value:`₱${totalEarnings.toFixed(2)}`,     bg:'#FEF9C3', color:'#92400E', icon:'💰'},
          {label:'Pending Withdrawals',       value:`₱${pendingWithdraw.toFixed(2)}`,   bg:'#FEE2E2', color:'#DC2626', icon:'📤'},
        ].map(c=>(
          <div key={c.label} style={{background:c.bg,borderRadius:14,padding:'16px 20px'}}>
            <div style={{fontSize:24,marginBottom:6}}>{c.icon}</div>
            <div style={{fontSize:20,fontWeight:900,color:c.color}}>{c.value}</div>
            <div style={{fontSize:11,color:c.color,opacity:0.8,marginTop:2}}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-20" style={{borderBottom:`2px solid ${tokens.border}`}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            style={{padding:'10px 24px',border:'none',borderBottom:`3px solid ${tab===t.key?tokens.primary:'transparent'}`,background:'none',cursor:'pointer',fontWeight:700,fontSize:13,color:tab===t.key?tokens.primary:tokens.muted,marginBottom:-2,display:'flex',alignItems:'center',gap:8}}>
            {t.label}
            {t.count>0&&<span style={{fontSize:11,fontWeight:800,padding:'2px 8px',borderRadius:20,background:tab===t.key?tokens.primary:'#E5E7EB',color:tab===t.key?'#fff':tokens.muted}}>{t.count}</span>}
          </button>
        ))}
      </div>

      {loading ? <Spinner dark size={28}/> : (
        <div className="card" style={{overflow:'hidden'}}>

          {/* Platform Commission Tab */}
          {tab==='commission' && (
            commission.length===0 ? (
              <div style={{textAlign:'center',padding:'40px 0',color:tokens.muted}}>No commission records yet.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Booking</th><th>Parent</th><th>Tutor</th><th>Gross</th><th>Commission (10%)</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {commission.map(e=>(
                    <tr key={e.id}>
                      <td style={{fontSize:13,textTransform:'capitalize'}}>{e.booking?.subject||'—'}</td>
                      <td style={{fontSize:13}}>{e.booking?.parent?.full_name||'—'}</td>
                      <td style={{fontSize:13}}>{e.booking?.tutor?.full_name||'—'}</td>
                      <td style={{fontSize:13,fontWeight:600}}>₱{Number(e.gross_amount).toFixed(2)}</td>
                      <td style={{fontSize:14,fontWeight:800,color:'#065F46'}}>₱{Number(e.commission).toFixed(2)}</td>
                      <td style={{fontSize:12,color:tokens.muted}}>{fmtDate(e.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{background:'#F0FDF4'}}>
                    <td colSpan={4} style={{fontWeight:700,padding:'12px 16px'}}>Total Platform Earnings</td>
                    <td style={{fontSize:16,fontWeight:900,color:'#065F46',padding:'12px 16px'}}>₱{totalCommission.toFixed(2)}</td>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            )
          )}

          {/* All Transactions Tab */}
          {tab==='all' && (
            allTxns.length===0 ? (
              <div style={{textAlign:'center',padding:'40px 0',color:tokens.muted}}>No transactions yet.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>User</th><th>Type</th><th>Amount</th><th>Description</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {allTxns.map(t=>{
                    const typeConfig = {
                      topup:      {label:'Top Up',    color:'#1D4ED8', bg:'#DBEAFE'},
                      deduction:  {label:'Payment',   color:'#DC2626', bg:'#FEE2E2'},
                      earning:    {label:'Earning',   color:'#065F46', bg:'#D1FAE5'},
                      withdrawal: {label:'Withdrawal',color:'#D97706', bg:'#FEF9C3'},
                    };
                    const tc = typeConfig[t.type] || {label:t.type, color:tokens.muted, bg:'#F3F4F6'};
                    return (
                      <tr key={t.id}>
                        <td style={{fontSize:13}}>
                          <div style={{fontWeight:600}}>{t.user?.full_name||'—'}</div>
                          <div style={{fontSize:11,color:tokens.muted}}>{t.user?.email||'—'}</div>
                        </td>
                        <td>
                          <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:tc.bg,color:tc.color}}>
                            {tc.label}
                          </span>
                        </td>
                        <td style={{fontSize:14,fontWeight:800,color:t.type==='deduction'?'#DC2626':'#065F46'}}>
                          {t.type==='deduction'?'-':'+'} ₱{Number(t.amount).toFixed(2)}
                        </td>
                        <td style={{fontSize:12,color:tokens.mid,maxWidth:200}}>{t.description||'—'}</td>
                        <td>
                          <Badge variant={t.status==='completed'?'success':t.status==='pending'?'warning':'danger'}>
                            {t.status}
                          </Badge>
                        </td>
                        <td style={{fontSize:12,color:tokens.muted}}>{fmtDate(t.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}

          {/* Withdrawal Requests Tab */}
          {tab==='withdraw' && (
            withdrawals.length===0 ? (
              <div style={{textAlign:'center',padding:'40px 0',color:tokens.muted}}>
                <div style={{fontSize:40,marginBottom:12}}>✅</div>
                <div style={{fontWeight:600}}>No pending withdrawals</div>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:16,padding:20}}>
                <div style={{background:'#FEF9C3',border:'1px solid #FDE68A',borderRadius:10,padding:'12px 16px',fontSize:13,color:'#92400E',lineHeight:1.6}}>
                  ⚠️ <strong>Admin action required:</strong> For each approved withdrawal, manually send the amount to the tutor's PayMongo account number shown below, then click Approve to confirm.
                </div>
                {withdrawals.map(t=>{
                  // Extract PayMongo account number from description e.g. "Withdrawal to GCash 09171234567"
                  const gcashMatch = (t.description||'').match(/PayMongo — (.+?) \((.+?)\)/);
                  const gcashNum   = gcashMatch ? `${gcashMatch[1]} — ${gcashMatch[2]}` : null;
                  return (
                    <div key={t.id} style={{border:`2px solid #FDE68A`,borderRadius:14,overflow:'hidden'}}>
                      {/* Header */}
                      <div style={{background:'#FFFBEB',padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #FDE68A'}}>
                        <div style={{display:'flex',alignItems:'center',gap:12}}>
                          <div style={{width:40,height:40,borderRadius:'50%',background:'#F59E0B',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <span style={{color:'#fff',fontWeight:800,fontSize:16}}>{(t.user?.full_name||'T').charAt(0)}</span>
                          </div>
                          <div>
                            <div style={{fontWeight:700,fontSize:15}}>{t.user?.full_name||'—'}</div>
                            <div style={{fontSize:12,color:tokens.muted}}>{t.user?.email||'—'}</div>
                          </div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:28,fontWeight:900,color:'#D97706'}}>₱{Number(t.amount).toFixed(2)}</div>
                          <div style={{fontSize:11,color:tokens.muted}}>{fmtDate(t.created_at)}</div>
                        </div>
                      </div>

                      {/* PayMongo account number — prominent */}
                      <div style={{padding:'16px 20px',background:'#fff'}}>
                        <div style={{fontSize:12,color:tokens.muted,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>Send to PayMongo Account:</div>
                        {gcashNum ? (
                          <div style={{display:'flex',alignItems:'center',gap:12}}>
                            <div style={{background:'#007AFF',borderRadius:10,padding:'12px 20px',display:'inline-flex',alignItems:'center',gap:10}}>
                              <span style={{fontSize:24}}>📱</span>
                              <div>
                                <div style={{color:'#fff',fontWeight:900,fontSize:22,letterSpacing:2}}>{gcashNum}</div>
                                <div style={{color:'rgba(255,255,255,0.8)',fontSize:11}}>PayMongo Account</div>
                              </div>
                            </div>
                            <button
                              onClick={()=>{navigator.clipboard.writeText(gcashNum); showToast('PayMongo account number copied!');}}
                              style={{padding:'8px 16px',borderRadius:8,background:'#EFF6FF',border:'1px solid #BFDBFE',color:'#1D4ED8',fontWeight:600,fontSize:13,cursor:'pointer'}}>
                              📋 Copy
                            </button>
                          </div>
                        ) : (
                          <div style={{fontSize:13,color:tokens.muted,fontStyle:'italic'}}>{t.description||'No GCash info provided'}</div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{padding:'12px 20px',background:'#F9FAFB',borderTop:'1px solid #FDE68A',display:'flex',gap:10,alignItems:'center'}}>
                        <span style={{fontSize:12,color:tokens.muted,flex:1}}>
                          Once you've sent ₱{Number(t.amount).toFixed(2)} to PayMongo account {gcashNum||''}, click Approve to confirm.
                        </span>
                        <button className="btn btn-sm"
                          style={{background:'#D1FAE5',color:'#065F46',border:'1px solid #6EE7B7',fontWeight:700,padding:'10px 20px'}}
                          onClick={()=>handleProcessWithdrawal(t,'approve')}
                          disabled={processing===t.id}>
                          {processing===t.id?'Processing...':'✅ Sent — Approve'}
                        </button>
                        <button className="btn btn-sm"
                          style={{background:'#FEE2E2',color:'#DC2626',border:'1px solid #FECACA',fontWeight:700}}
                          onClick={()=>handleProcessWithdrawal(t,'reject')}
                          disabled={processing===t.id}>
                          {processing===t.id?'...':'✗ Reject'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}