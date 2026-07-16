import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

const PASS_SCORE = 75;

export default function CertificationPage() {
  const { user } = useAuth();
  const [scores,  setScores]  = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScores = async () => {
      const { data } = await supabase
        .from('tutors')
        .select('certification_scores, specialization')
        .eq('id', user.id)
        .single();
      setScores(data?.certification_scores || {});
      setLoading(false);
    };
    fetchScores();
  }, [user]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <Spinner dark size={32}/>
    </div>
  );

  const subjects = ['english', 'mathematics'];
  const taken    = subjects.filter(s => scores[s] !== undefined);

  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>AI Certification Results</h2>
        <p className="text-sm text-muted mt-4">Your official AI exam results from registration.</p>
      </div>

      {taken.length === 0 ? (
        <div className="card p-40" style={{ textAlign:'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
          <div className="font-jakarta font-bold mb-8" style={{ fontSize: 18 }}>No Exam Results Yet</div>
          <p className="text-sm text-muted">Your certification results will appear here after you complete the AI exam during registration.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>

          {/* Summary card */}
          <div style={{ background:`linear-gradient(135deg, ${tokens.primary}, #6366F1)`, borderRadius:16, padding:'24px 28px', color:'#fff' }}>
            <div style={{ fontSize:13, opacity:0.85, marginBottom:4 }}>📜 Certification Status</div>
            <div style={{ fontSize:24, fontWeight:900, marginBottom:4 }}>
              {subjects.some(s => scores[s] >= PASS_SCORE) ? '✅ Certified Tutor' : '❌ Not Yet Certified'}
            </div>
            <div style={{ fontSize:13, opacity:0.8 }}>
              {subjects.filter(s => scores[s] >= PASS_SCORE).length} of {taken.length} subject(s) passed
            </div>
          </div>

          {/* Subject results */}
          <div className="card p-28">
            <div className="font-jakarta font-bold mb-20" style={{ fontSize: 16 }}>Subject Results</div>
            <div style={{ display:'flex', flexDirection:'column', gap: 20 }}>
              {subjects.map(s => {
                const score  = scores[s];
                const passed = score >= PASS_SCORE;
                if (score === undefined) return null;
                return (
                  <div key={s}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:15, textTransform:'capitalize' }}>{s}</div>
                        <div style={{ fontSize:12, color:tokens.muted, marginTop:2 }}>
                          {passed ? 'Passed — You are certified to teach this subject.' : `Failed — Score below ${PASS_SCORE}% passing mark.`}
                        </div>
                      </div>
                      <span style={{
                        fontSize:13, fontWeight:800, padding:'6px 16px', borderRadius:20,
                        background: passed ? '#D1FAE5' : '#FEE2E2',
                        color:      passed ? '#065F46' : '#DC2626',
                      }}>
                        {score}% — {passed ? '✓ Passed' : '✗ Failed'}
                      </span>
                    </div>
                    <div style={{ height:10, background:'#E5E7EB', borderRadius:6, overflow:'hidden' }}>
                      <div style={{
                        height:'100%', borderRadius:6, width:`${score}%`,
                        background: passed ? '#22C55E' : '#EF4444',
                        transition:'width 0.6s ease',
                      }}/>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:11, color:tokens.muted }}>
                      <span>0%</span>
                      <span style={{ color: passed ? '#22C55E' : '#EF4444', fontWeight:700 }}>
                        Passing: {PASS_SCORE}%
                      </span>
                      <span>100%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:12, padding:'14px 20px', fontSize:13, color:'#1D4ED8', lineHeight:1.7 }}>
            ℹ️ <strong>Note:</strong> These results are final and based on the AI certification exam taken during registration. Contact admin at <strong>packageonthemove@gmail.com</strong> for any concerns.
          </div>
        </div>
      )}
    </div>
  );
}