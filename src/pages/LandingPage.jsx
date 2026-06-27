import { useNavigate } from 'react-router-dom';
import Icon from '../components/ui/Icon';
import tokens from '../lib/tokens';

const features = [
  { icon:'shield',   title:'Verified Tutors',   desc:'NBI Clearance, PRC License and Medical Certificate required before any tutor is approved.' },
  { icon:'brain',    title:'AI Certification',   desc:'OpenAI-powered topic-based exam dynamically validates tutor knowledge — no repetitive questions.' },
  { icon:'trending', title:'Smart Matching',     desc:'Student pre-assessment results weighted against tutor certification scores and your preferences.' },
  { icon:'wallet',   title:'Prepaid Wallet',     desc:'10% platform commission auto-deducted from tutor wallet after every session. No manual collection.' },
  { icon:'calendar', title:'8-Session Packages', desc:'Structured monthly packages: 2 sessions/week, 1.5 hrs each. Consistent, trackable progress.' },
  { icon:'chart',    title:'Progress Dashboard', desc:'Parents see every session topic, tutor feedback, and improvement trend in real time.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div style={{ background: tokens.bg }}>
      {/* NAVBAR */}
      <nav style={{ position:'sticky',top:0,zIndex:200,height:64,background:'rgba(255,255,255,.92)',backdropFilter:'blur(12px)',borderBottom:`1px solid ${tokens.border}`,padding:'0 40px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
        <div className="flex items-center gap-8">
          <div style={{ width:36,height:36,borderRadius:10,background:tokens.primary,display:'flex',alignItems:'center',justifyContent:'center' }}>
            <span style={{ color:'#fff',fontWeight:800,fontSize:14,fontFamily:"'Plus Jakarta Sans'" }}>LB</span>
          </div>
          <span className="font-jakarta font-extrabold" style={{ fontSize:18 }}>LearnBridge</span>
        </div>
        <div className="flex items-center gap-8">
          <button className="btn btn-ghost" onClick={() => navigate('/login')}>Log In</button>
          <button className="btn btn-primary" onClick={() => navigate('/register')}>Get Started</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding:'120px 40px 100px',textAlign:'center',background:`linear-gradient(135deg,#FAFAFA 0%,${tokens.primaryLight} 50%,#FEF3C7 100%)` }}>
        <div style={{ maxWidth:740,margin:'0 auto' }}>
          <h1 className="font-jakarta font-black mb-24" style={{ fontSize:'clamp(36px,6vw,60px)',lineHeight:1.1 }}>
            Where Filipino Students{' '}
            <br />
            Find Their{' '}
            <span style={{ background:`linear-gradient(135deg,${tokens.primary},${tokens.accent})`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>
              Perfect Tutor
            </span>
          </h1>
          <p style={{ fontSize:18,color:tokens.muted,maxWidth:540,margin:'0 auto 40px',lineHeight:1.7 }}>
            AI-powered verification, smart matching, and transparent progress tracking for Grade 2–6 learners in English and Mathematics. No more word-of-mouth. Just quality tutoring.
          </p>
          <div className="flex items-center gap-12" style={{ justifyContent:'center',flexWrap:'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
              Start as a Parent <Icon name="arrowRight" size={16} />
            </button>
            <button className="btn btn-outline btn-lg" onClick={() => navigate('/register?role=tutor')}>
              Join as a Tutor
            </button>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding:'80px 40px',background:tokens.dark }}>
        <div style={{ maxWidth:1100,margin:'0 auto' }}>
          <div className="text-center mb-32">
            <div style={{ fontSize:11,fontWeight:700,color:tokens.secondary,textTransform:'uppercase',letterSpacing:'1px',marginBottom:12 }}>PLATFORM FEATURES</div>
            <h2 className="font-jakarta font-extrabold text-white" style={{ fontSize:36 }}>Everything You Need, Nothing You Don't</h2>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:20 }}>
            {features.map((f,i) => (
              <div key={i} style={{ padding:28,borderRadius:16,border:'1px solid rgba(255,255,255,.1)',background:'rgba(255,255,255,.05)' }}>
                <div style={{ width:44,height:44,borderRadius:12,background:tokens.primary+'30',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16 }}>
                  <Icon name={f.icon} size={20} color={tokens.primary} />
                </div>
                <h3 className="font-jakarta font-bold mb-8 text-white" style={{ fontSize:16 }}>{f.title}</h3>
                <p style={{ fontSize:13,color:'#9CA3AF',lineHeight:1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:tokens.dark,borderTop:'1px solid rgba(255,255,255,.08)',padding:40,textAlign:'center' }}>
        <p style={{ color:'#6B7280',fontSize:13 }}>© 2026 LearnBridge. Empowering Grade 2–6 Filipino learners in English & Mathematics.</p>
      </footer>
    </div>
  );
}