import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBookings } from '../../hooks/useBookings';
import StatCard from '../../components/ui/StatCard';
import tokens from '../../lib/tokens';

export default function TutorDashboard() {
  const { profile } = useAuth();
  const { bookings } = useBookings();
  const navigate = useNavigate();

  const active    = bookings.filter(b => ['confirmed','pending_parent_confirm'].includes(b.status)).length;
  const pending   = bookings.filter(b => b.status === 'pending').length;
  const completed = bookings.filter(b => b.status === 'completed').length;

  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{fontSize:24}}>
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Tutor'} 👋
        </h2>
        <p className="text-sm text-muted mt-4">Manage your sessions and track your earnings.</p>
      </div>

      {/* Stats */}
      <div className="grid-3 mb-24">
        <StatCard label="Active Sessions"  value={active}    icon="book"  color={tokens.primary}/>
        <StatCard label="Pending Bookings" value={pending}   icon="clock" color="#F59E0B"/>
        <StatCard label="Completed"        value={completed} icon="check" color={tokens.success}/>
      </div>

      {/* Quick actions */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <button className="card" onClick={()=>navigate('/bookings')}
          style={{padding:'24px',textAlign:'left',cursor:'pointer',border:`2px solid ${tokens.border}`,transition:'all 0.15s',background:'#fff'}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=tokens.primary}
          onMouseLeave={e=>e.currentTarget.style.borderColor=tokens.border}>
          <div style={{fontSize:32,marginBottom:12}}>📅</div>
          <div className="font-jakarta font-bold" style={{fontSize:16,marginBottom:4}}>My Bookings</div>
          <div style={{fontSize:13,color:tokens.muted}}>View and manage your session bookings.</div>
        </button>

        <button className="card" onClick={()=>navigate('/wallet')}
          style={{padding:'24px',textAlign:'left',cursor:'pointer',border:`2px solid ${tokens.border}`,transition:'all 0.15s',background:'#fff'}}
          onMouseEnter={e=>e.currentTarget.style.borderColor='#059669'}
          onMouseLeave={e=>e.currentTarget.style.borderColor=tokens.border}>
          <div style={{fontSize:32,marginBottom:12}}>💰</div>
          <div className="font-jakarta font-bold" style={{fontSize:16,marginBottom:4}}>My Wallet</div>
          <div style={{fontSize:13,color:tokens.muted}}>View earnings and request withdrawals.</div>
        </button>

        <button className="card" onClick={()=>navigate('/calendar')}
          style={{padding:'24px',textAlign:'left',cursor:'pointer',border:`2px solid ${tokens.border}`,transition:'all 0.15s',background:'#fff'}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=tokens.primary}
          onMouseLeave={e=>e.currentTarget.style.borderColor=tokens.border}>
          <div style={{fontSize:32,marginBottom:12}}>🗓</div>
          <div className="font-jakarta font-bold" style={{fontSize:16,marginBottom:4}}>Calendar</div>
          <div style={{fontSize:13,color:tokens.muted}}>Accept or reject session requests from parents.</div>
        </button>

        <button className="card" onClick={()=>navigate('/sessions')}
          style={{padding:'24px',textAlign:'left',cursor:'pointer',border:`2px solid ${tokens.border}`,transition:'all 0.15s',background:'#fff'}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=tokens.primary}
          onMouseLeave={e=>e.currentTarget.style.borderColor=tokens.border}>
          <div style={{fontSize:32,marginBottom:12}}>📚</div>
          <div className="font-jakarta font-bold" style={{fontSize:16,marginBottom:4}}>Sessions</div>
          <div style={{fontSize:13,color:tokens.muted}}>Upload modules, quizzes and track student progress.</div>
        </button>
      </div>
    </div>
  );
}