import PerformanceBadge from '../../components/ui/PerformanceBadge';
import Avatar from '../../components/ui/Avatar';
import tokens from '../../lib/tokens';

const SESSIONS = [
  { num:1, date:'Jun 1',  topic:'Fractions – Introduction',        indicator:'needs_improvement', comment:'Juan found it difficult to differentiate proper from improper fractions. Will revisit next session.' },
  { num:2, date:'Jun 4',  topic:'Fractions – Proper vs Improper',  indicator:'improving',          comment:'Significant improvement! Juan can now classify fractions correctly with minimal guidance.' },
  { num:3, date:'Jun 8',  topic:'Fractions – Adding Like Fractions',indicator:'improving',         comment:'Performed well on addition. Minor errors on simplification.' },
  { num:4, date:'Jun 11', topic:'Fractions – Mixed Numbers',        indicator:'good',               comment:'Excellent session. Juan solved all 10 practice problems correctly.' },
  { num:5, date:'Jun 15', topic:'Fractions – Unlike Fractions',     indicator:'good',               comment:'Strong performance. Juan found LCM accurately for most problems. Very confident.' },
];

const DOT_COLORS = { good: tokens.success, improving: tokens.secondary, needs_improvement: tokens.coral };

export default function ProgressPage() {
  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize:22 }}>Progress Monitoring</h2>
        <p className="text-sm text-muted mt-4">Track your child's improvement across all tutoring sessions.</p>
      </div>

      {/* Student card */}
      <div className="card p-20 mb-20">
        <div className="flex items-center gap-16">
          <Avatar name="Juan Santos" size={44} colorIndex={0} />
          <div>
            <div className="font-bold" style={{ fontSize:16 }}>Juan Santos</div>
            <div className="text-sm text-muted">Grade 4 · Mathematics · Tutor: Ms. Rivera</div>
          </div>
          <div className="ml-auto"><span className="badge badge-info">Session 5 of 8</span></div>
        </div>
        <div className="mt-16">
          <div className="flex items-center justify-between mb-8">
            <span className="text-xs text-muted">Package Progress</span>
            <span className="text-xs font-semibold">5 / 8 sessions</span>
          </div>
          <div className="progress-wrap">
            <div className="progress-fill" style={{ width:'62.5%', background:`linear-gradient(90deg,${tokens.primary},${tokens.accent})` }} />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <div className="card-header"><h3 className="font-jakarta font-bold" style={{ fontSize:15 }}>Session Feedback Log</h3></div>
        <div style={{ padding:'8px 0' }}>
          {SESSIONS.map((s,i) => (
            <div key={s.num} style={{ padding:'16px 24px', borderBottom:i<SESSIONS.length-1?`1px solid ${tokens.border}`:'none', display:'flex', gap:16, alignItems:'flex-start' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                <div style={{ width:32,height:32,borderRadius:'50%',background:DOT_COLORS[s.indicator]+'20',display:'flex',alignItems:'center',justifyContent:'center',border:`2px solid ${DOT_COLORS[s.indicator]}` }}>
                  <span style={{ fontSize:11,fontWeight:800,color:DOT_COLORS[s.indicator] }}>{s.num}</span>
                </div>
                {i<SESSIONS.length-1 && <div style={{ width:2,height:20,background:tokens.border,margin:'4px 0' }} />}
              </div>
              <div style={{ flex:1 }}>
                <div className="flex items-center gap-8 mb-4">
                  <span className="font-semibold" style={{ fontSize:14 }}>{s.topic}</span>
                  <PerformanceBadge value={s.indicator} />
                </div>
                <div className="text-xs text-muted mb-6">{s.date}</div>
                <p className="text-sm text-mid" style={{ lineHeight:1.6 }}>{s.comment}</p>
              </div>
            </div>
          ))}
          {[6,7,8].map(n => (
            <div key={n} style={{ padding:'14px 24px', display:'flex', gap:16, alignItems:'center', borderTop:`1px solid ${tokens.border}`, opacity:0.4 }}>
              <div style={{ width:32,height:32,borderRadius:'50%',background:'#F3F4F6',display:'flex',alignItems:'center',justifyContent:'center',border:`2px dashed ${tokens.border}` }}>
                <span style={{ fontSize:11,color:tokens.muted,fontWeight:800 }}>{n}</span>
              </div>
              <span className="text-sm text-muted">Session {n} — not yet completed</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
