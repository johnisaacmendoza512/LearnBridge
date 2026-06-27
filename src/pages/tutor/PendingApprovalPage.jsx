import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import tokens from '../../lib/tokens';

export default function PendingApprovalPage() {
  const { user, profile, signOut } = useAuth();
  const navigate    = useNavigate();
  const [status,    setStatus]    = useState('pending');
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    if (!user) return;
    const checkStatus = async () => {
      const { data } = await supabase
        .from('tutors')
        .select('status, admin_notes')
        .eq('id', user.id)
        .single();
      if (data) {
        setStatus(data.status);
        setAdminNote(data.admin_notes || '');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const DOCS = [
    { label: 'NBI Clearance',      icon: '🪪' },
    { label: 'PRC License',        icon: '📄' },
    { label: 'Medical Certificate',icon: '🏥' },
    { label: 'Resume / CV',        icon: '📋' },
  ];

  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';

  const STEPS = [
    { label: 'Documents Submitted', icon: '📤', done: true,       active: false },
    { label: 'Admin Review',        icon: '🔍', done: isApproved, active: !isApproved && !isRejected },
    { label: 'Account Approved',    icon: '✅', done: isApproved, active: false },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg,${tokens.primaryLight},#fff,#FEF3C7)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 540 }}>
        <div className="card fade-in" style={{ padding: 40 }}>

          {/* Logo */}
          <div className="flex items-center gap-10 mb-28">
            <div style={{ width: 40, height: 40, borderRadius: 10, background: tokens.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>LB</span>
            </div>
            <div>
              <div className="font-jakarta font-extrabold" style={{ fontSize: 16 }}>LearnBridge</div>
              <div className="text-xs text-muted">Tutor Application</div>
            </div>
          </div>

          {/* ── REJECTED ── */}
          {isRejected && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>❌</div>
                <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22, color: '#DC2626' }}>
                  Application Not Approved
                </h2>
                <p className="text-sm text-muted mt-8" style={{ lineHeight: 1.7 }}>
                  Unfortunately your application was not approved at this time.
                </p>
              </div>
              {adminNote && (
                <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 12, padding: 16, marginBottom: 24 }}>
                  <div className="font-semibold mb-6" style={{ fontSize: 13, color: '#DC2626' }}>📋 Reason from Admin:</div>
                  <p style={{ fontSize: 13, color: '#7F1D1D', lineHeight: 1.6, margin: 0 }}>{adminNote}</p>
                </div>
              )}
              <button className="btn btn-primary btn-full btn-lg mb-12" onClick={() => navigate('/register')}>
                Re-apply as Tutor
              </button>
              <button className="btn btn-ghost btn-full" onClick={handleSignOut}>Sign Out</button>
            </>
          )}

          {/* ── APPROVED ── */}
          {isApproved && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
                <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22, color: tokens.success }}>
                  Application Approved!
                </h2>
                <p className="text-sm text-muted mt-8" style={{ lineHeight: 1.7 }}>
                  Congratulations, <strong>{profile?.full_name || 'Tutor'}</strong>! Your documents have been verified. Please log in to proceed to the AI Certification Exam.
                </p>
              </div>

              {/* All steps green */}
              <div style={{ marginBottom: 24 }}>
                {STEPS.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        background: '#D1FAE5', border: `2px solid ${tokens.success}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      }}>✓</div>
                      {i < STEPS.length - 1 && (
                        <div style={{ width: 2, height: 28, background: tokens.success }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: i < STEPS.length - 1 ? 28 : 0 }}>
                      <div className="font-semibold" style={{ fontSize: 14, color: tokens.success }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 12, padding: 16, marginBottom: 24, fontSize: 13, color: '#065F46' }}>
                <div className="font-semibold mb-6">✅ What's next?</div>
                <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
                  <li>Log in to your account</li>
                  <li>Complete the <strong>AI Certification Exam</strong> (required)</li>
                  <li>Once certified, your profile goes live for parents</li>
                </ul>
              </div>

              <button className="btn btn-primary btn-full btn-lg" onClick={handleSignOut}>
                Proceed to Login →
              </button>
            </>
          )}

          {/* ── PENDING ── */}
          {!isApproved && !isRejected && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                    <span style={{ fontSize: 40 }}>📋</span>
                  </div>
                  <div style={{ position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderRadius: '50%', background: '#FCD34D', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', animation: 'ping 1.5s infinite' }} />
                  </div>
                </div>
                <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22, color: tokens.dark }}>
                  Documents Under Review
                </h2>
                <p className="text-sm text-muted mt-8" style={{ lineHeight: 1.7 }}>
                  Thank you for submitting your application, <strong>{profile?.full_name || 'Tutor'}</strong>! Our admin team is reviewing your documents.
                </p>
              </div>

              {/* Steps */}
              <div style={{ marginBottom: 24 }}>
                {STEPS.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        background: s.done ? '#D1FAE5' : s.active ? '#FEF9C3' : '#F3F4F6',
                        border: `2px solid ${s.done ? tokens.success : s.active ? '#FCD34D' : tokens.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      }}>
                        {s.done ? '✓' : s.icon}
                      </div>
                      {i < STEPS.length - 1 && (
                        <div style={{ width: 2, height: 28, background: s.done ? tokens.success : tokens.border }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: i < STEPS.length - 1 ? 28 : 0 }}>
                      <div className="font-semibold" style={{ fontSize: 14, color: s.done ? tokens.success : s.active ? '#92400E' : tokens.muted }}>
                        {s.label}
                      </div>
                      {i === 0 && <div className="text-xs text-muted mt-2">All 4 documents received ✓</div>}
                      {i === 1 && <div className="text-xs mt-2" style={{ color: '#92400E' }}>Estimated 1–3 business days</div>}
                      {i === 2 && <div className="text-xs text-muted mt-2">You'll be notified when ready</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Submitted docs */}
              <div style={{ background: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <div className="font-semibold mb-12" style={{ fontSize: 13, color: tokens.dark }}>📁 Submitted Documents</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {DOCS.map((doc, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>{doc.icon}</span>
                      <span style={{ fontSize: 13, flex: 1, color: tokens.mid }}>{doc.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', background: '#D1FAE5', padding: '2px 8px', borderRadius: 6 }}>✓ Submitted</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: tokens.primaryLight, border: `1px solid ${tokens.primary}30`, borderRadius: 12, padding: 16, marginBottom: 24, fontSize: 13, color: tokens.primary }}>
                <div className="font-semibold mb-6">ℹ️ What happens next?</div>
                <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.8, color: tokens.mid }}>
                  <li>The admin team will verify your submitted documents</li>
                  <li>You will receive an email once your account is approved</li>
                  <li>After approval, you must complete the AI Certification Exam</li>
                  <li>Once certified, your profile will be visible to parents</li>
                </ul>
              </div>

              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <p className="text-xs text-muted">This page checks your status automatically every 30 seconds.</p>
              </div>

              <button className="btn btn-ghost btn-full" onClick={handleSignOut}>Sign Out</button>
            </>
          )}
        </div>

        <style>{`
          @keyframes ping {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.4); opacity: 0.6; }
          }
        `}</style>
      </div>
    </div>
  );
}