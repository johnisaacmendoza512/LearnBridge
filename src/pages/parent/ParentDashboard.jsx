import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBookings } from '../../hooks/useBookings';
import { useStudents } from '../../hooks/useStudents';
import StatCard from '../../components/ui/StatCard';
import tokens from '../../lib/tokens';

export default function ParentDashboard() {
  const { profile } = useAuth();
  const { bookings } = useBookings();
  const { students } = useStudents();
  const navigate = useNavigate();

  const active    = bookings.filter(b => b.status === 'confirmed').length;
  const pending   = bookings.filter(b => b.status === 'pending').length;
  const completed = bookings.filter(b => b.status === 'completed').length;

  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{fontSize:24}}>
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Parent'} 👋
        </h2>
        <p className="text-sm text-muted mt-4">Manage your children's learning journey.</p>
      </div>

      {/* Verification pending banner */}
      {profile?.status === 'pending' && (
        <div style={{background:'#FEF9C3',border:'1px solid #FDE68A',borderRadius:12,padding:'16px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:14}}>
          <span style={{fontSize:32}}>🪪</span>
          <div style={{flex:1}}>
            <div className="font-jakarta font-bold" style={{fontSize:15,color:'#92400E'}}>ID Verification Pending</div>
            <p style={{fontSize:13,color:'#92400E',marginTop:4,lineHeight:1.6}}>
              Your valid ID has been submitted and is currently under review by our admin team. You will be able to book tutors and top up your wallet once your account is approved.
            </p>
          </div>
        </div>
      )}

      {/* Rejected banner */}
      {profile?.status === 'rejected' && (
        <div style={{background:'#FEE2E2',border:'1px solid #FECACA',borderRadius:12,padding:'16px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:14}}>
          <span style={{fontSize:32}}>❌</span>
          <div style={{flex:1}}>
            <div className="font-jakarta font-bold" style={{fontSize:15,color:'#DC2626'}}>ID Verification Rejected</div>
            <p style={{fontSize:13,color:'#DC2626',marginTop:4,lineHeight:1.6}}>
              Your submitted ID was rejected. Please contact support at packageonthemove@gmail.com for assistance.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid-3 mb-24">
        <StatCard label="Active Sessions"  value={active}          icon="book"     color={tokens.primary}/>
        <StatCard label="Pending Bookings" value={pending}         icon="clock"    color="#F59E0B"/>
        <StatCard label="Children"         value={students.length} icon="users"    color={tokens.success}/>
      </div>

      {/* Quick actions */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <button className="card" onClick={()=>navigate('/find-tutors')}
          style={{padding:'24px',textAlign:'left',cursor:'pointer',border:`2px solid ${tokens.border}`,transition:'all 0.15s',background:'#fff'}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=tokens.primary}
          onMouseLeave={e=>e.currentTarget.style.borderColor=tokens.border}>
          <div style={{fontSize:32,marginBottom:12}}>🔍</div>
          <div className="font-jakarta font-bold" style={{fontSize:16,marginBottom:4}}>Find a Tutor</div>
          <div style={{fontSize:13,color:tokens.muted}}>Browse and book verified tutors for your child.</div>
        </button>
        <button className="card" onClick={()=>navigate('/wallet')}
          style={{padding:'24px',textAlign:'left',cursor:'pointer',border:`2px solid ${tokens.border}`,transition:'all 0.15s',background:'#fff'}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=tokens.primary}
          onMouseLeave={e=>e.currentTarget.style.borderColor=tokens.border}>
          <div style={{fontSize:32,marginBottom:12}}>💳</div>
          <div className="font-jakarta font-bold" style={{fontSize:16,marginBottom:4}}>My Wallet</div>
          <div style={{fontSize:13,color:tokens.muted}}>Top up your wallet and view transaction history.</div>
        </button>
        <button className="card" onClick={()=>navigate('/bookings')}
          style={{padding:'24px',textAlign:'left',cursor:'pointer',border:`2px solid ${tokens.border}`,transition:'all 0.15s',background:'#fff'}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=tokens.primary}
          onMouseLeave={e=>e.currentTarget.style.borderColor=tokens.border}>
          <div style={{fontSize:32,marginBottom:12}}>📅</div>
          <div className="font-jakarta font-bold" style={{fontSize:16,marginBottom:4}}>My Bookings</div>
          <div style={{fontSize:13,color:tokens.muted}}>View and manage your session bookings.</div>
        </button>
        <button className="card" onClick={()=>navigate('/my-children')}
          style={{padding:'24px',textAlign:'left',cursor:'pointer',border:`2px solid ${tokens.border}`,transition:'all 0.15s',background:'#fff'}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=tokens.primary}
          onMouseLeave={e=>e.currentTarget.style.borderColor=tokens.border}>
          <div style={{fontSize:32,marginBottom:12}}>👧</div>
          <div className="font-jakarta font-bold" style={{fontSize:16,marginBottom:4}}>My Children</div>
          <div style={{fontSize:13,color:tokens.muted}}>Manage your children's profiles and progress.</div>
        </button>
      </div>
    </div>
  );
}