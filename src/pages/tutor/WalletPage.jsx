import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
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
  const [earnings,  setEarnings]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState(null);

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  useEffect(() => {
    const fetchEarnings = async () => {
      const { data, error } = await supabase
        .from('tutor_earnings')
        .select(`
          *,
          booking:booking_id (
            subject, session_mode,
            parent:parent_id (full_name),
            student:student_id (name, grade_level)
          )
        `)
        .eq('tutor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) showToast(error.message, 'error');
      setEarnings(data || []);
      setLoading(false);
    };
    fetchEarnings();
  }, [user]);

  const totalEarned   = earnings.reduce((s,e) => s + Number(e.net_earnings||0), 0);
  const totalPlatform = earnings.reduce((s,e) => s + Number(e.platform_fee||0), 0);
  const totalGross    = earnings.reduce((s,e) => s + Number(e.gross_amount||0), 0);
  const pending       = earnings.filter(e=>e.status==='pending').reduce((s,e) => s + Number(e.net_earnings||0), 0);
  const released      = earnings.filter(e=>e.status==='released').reduce((s,e) => s + Number(e.net_earnings||0), 0);

  if (loading) return <Spinner dark size={32}/>;

  return (
    <div className="fade-in">
      <Toast msg={toast?.msg} type={toast?.type} onClose={()=>setToast(null)}/>

      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{fontSize:22}}>💰 Wallet & Earnings</h2>
        <p className="text-sm text-muted mt-4">Your earnings from confirmed and paid sessions.</p>
      </div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
        {[
          {label:'Total Earned (Net)', value:`₱${totalEarned.toLocaleString('en-PH',{minimumFractionDigits:2})}`, bg:'#D1FAE5', color:'#065F46', icon:'💰'},
          {label:'Pending Release',    value:`₱${pending.toLocaleString('en-PH',{minimumFractionDigits:2})}`,    bg:'#FEF9C3', color:'#92400E', icon:'⏳'},
          {label:'Platform Fee (10%)', value:`₱${totalPlatform.toLocaleString('en-PH',{minimumFractionDigits:2})}`,bg:'#EFF6FF', color:'#1D4ED8', icon:'🏛'},
        ].map(c=>(
          <div key={c.label} style={{background:c.bg,borderRadius:14,padding:'20px 24px',border:`1px solid ${c.color}20`}}>
            <div style={{fontSize:28,marginBottom:8}}>{c.icon}</div>
            <div style={{fontSize:22,fontWeight:900,color:c.color,marginBottom:4}}>{c.value}</div>
            <div style={{fontSize:12,color:c.color,opacity:0.8}}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:12,padding:'14px 20px',marginBottom:24,fontSize:13,color:'#1D4ED8',lineHeight:1.7}}>
        💡 <strong>Commission model:</strong> Parents pay the full amount through LearnBridge. The platform retains <strong>10%</strong> as a service fee and releases <strong>90%</strong> to your wallet for each paid booking.
      </div>

      {/* Earnings list */}
      {earnings.length === 0 ? (
        <div className="card">
          <EmptyState icon="💰" title="No earnings yet" description="Your earnings will appear here once a parent completes payment for a confirmed booking."/>
        </div>
      ) : (
        <div className="card" style={{overflow:'hidden'}}>
          <div style={{padding:'16px 24px',borderBottom:`1px solid ${tokens.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div className="font-jakarta font-bold" style={{fontSize:15}}>Earnings History</div>
            <div style={{fontSize:13,color:tokens.muted}}>{earnings.length} booking{earnings.length!==1?'s':''}</div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Subject</th>
                <th>Gross</th>
                <th>Platform Fee</th>
                <th>Your Earnings</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {earnings.map(e=>(
                <tr key={e.id}>
                  <td style={{fontSize:13}}>
                    <div className="font-semibold">{e.booking?.student?.name||'—'}</div>
                    <div style={{fontSize:11,color:tokens.muted}}>Parent: {e.booking?.parent?.full_name||'—'}</div>
                  </td>
                  <td style={{fontSize:13,textTransform:'capitalize'}}>{e.booking?.subject||'—'}</td>
                  <td style={{fontSize:13,fontWeight:600}}>₱{Number(e.gross_amount||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
                  <td style={{fontSize:13,color:'#DC2626'}}>-₱{Number(e.platform_fee||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
                  <td style={{fontSize:14,fontWeight:800,color:'#065F46'}}>₱{Number(e.net_earnings||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
                  <td>
                    <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:e.status==='released'?'#D1FAE5':'#FEF9C3',color:e.status==='released'?'#065F46':'#92400E'}}>
                      {e.status==='released'?'✅ Released':'⏳ Pending'}
                    </span>
                  </td>
                  <td style={{fontSize:12,color:tokens.muted}}>
                    {e.created_at?new Date(e.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{padding:'12px 24px',borderTop:`1px solid ${tokens.border}`,display:'flex',justifyContent:'flex-end',gap:24}}>
            <div style={{fontSize:13,color:tokens.muted}}>Total Gross: <strong>₱{totalGross.toLocaleString('en-PH',{minimumFractionDigits:2})}</strong></div>
            <div style={{fontSize:13,color:'#DC2626'}}>Platform (10%): <strong>-₱{totalPlatform.toLocaleString('en-PH',{minimumFractionDigits:2})}</strong></div>
            <div style={{fontSize:14,fontWeight:800,color:'#065F46'}}>Net Earnings: ₱{totalEarned.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
          </div>
        </div>
      )}
    </div>
  );
}