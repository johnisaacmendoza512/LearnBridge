import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Icon from '../../components/ui/Icon';
import tokens from '../../lib/tokens';

export default function PendingApprovalPage() {
  const { profile, signOut } = useAuth();
  const location  = useLocation();
  const stateMsg  = location.state?.message || null;
  const [tutorStatus, setTutorStatus] = useState('pending');
  const [adminNotes,  setAdminNotes]  = useState('');
  const [loading,     setLoading]     = useState(true);

  // Fallback: if profile never loads, stop spinning after 5 seconds
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!profile?.id) {
      // Profile not loaded yet - wait for it
      return;
    }

    const fetchStatus = async () => {
      try {
        const { data } = await supabase
          .from('tutors')
          .select('status, admin_notes')
          .eq('id', profile.id)
          .single();
        if (data) {
          setTutorStatus(data.status || 'pending');
          setAdminNotes(data.admin_notes || '');
        } else {
          // No tutors row yet — still pending
          setTutorStatus('pending');
        }
      } catch(e) {
        console.error('Status fetch error:', e);
        setTutorStatus('pending');
      }
      setLoading(false);
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [profile?.id]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#F8FAFC',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: `3px solid ${tokens.primary}`,
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p className="text-sm text-muted">Checking your application status...</p>
        </div>
      </div>
    );
  }

  const isPending = tutorStatus === 'pending';

  return (
    <div style={{
      minHeight: '100vh', background: '#F8FAFC',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      {/* Brand */}
      <div className="flex items-center gap-10 mb-32">
        <img
          src={require('../../assets/learnbridge-logo.png')}
          alt="LearnBridge"
          style={{ width: 52, height: 52, objectFit: 'contain' }}
        />
        <div className="font-jakarta font-extrabold" style={{ fontSize: 20 }}>LearnBridge</div>
      </div>

      {/* Email verification notice */}
      {stateMsg && (
        <div style={{
          background:'#D1FAE5', border:'1px solid #6EE7B7', borderRadius:12,
          padding:'16px 24px', marginBottom:20, maxWidth:480, width:'100%',
          display:'flex', alignItems:'flex-start', gap:12, lineHeight:1.6,
        }}>
          <span style={{fontSize:24,flexShrink:0}}>📧</span>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:'#065F46',marginBottom:4}}>Check Your Email</div>
            <div style={{fontSize:13,color:'#065F46'}}>{stateMsg}</div>
          </div>
        </div>
      )}

      {/* Main card */}
      <div style={{
        background: '#fff', borderRadius: 20,
        padding: '48px 40px', maxWidth: 480, width: '100%',
        textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.08)',
      }}>

        {isPending ? (
          <>
            {/* Pending icon */}
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: '#FEF9C3',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <Icon name="clock" size={36} color="#CA8A04" />
            </div>

            <h2 className="font-jakarta font-extrabold mb-12" style={{ fontSize: 24 }}>
              Pending Admin Approval
            </h2>

            <p className="text-sm" style={{ color: tokens.mid, lineHeight: 1.8, marginBottom: 24 }}>
              Your requirements have been submitted successfully! Our admin team is currently
              reviewing your credentials. You will receive an email notification once your
              account has been approved.
            </p>

            {/* Info box */}
            <div style={{
              background: '#EFF6FF', border: `1px solid #BFDBFE`,
              borderRadius: 12, padding: '14px 20px', marginBottom: 28,
              fontSize: 13, color: '#1D4ED8', lineHeight: 1.6,
            }}>
              This review process typically takes 1–3 business days. Thank you for your patience!
            </div>

            {/* What happens next */}
            <div style={{
              background: '#F9FAFB', borderRadius: 12,
              padding: '16px 20px', marginBottom: 28, textAlign: 'left',
            }}>
              <div className="font-jakarta font-bold mb-12" style={{ fontSize: 13, color: tokens.dark }}>
                What happens next?
              </div>
              {[
                ['Admin reviews your NBI, PRC License & Medical Certificate', 'shield'],
                ['Admin sets your approved session rate',                      'wallet'],
                ['You receive approval notification',                           'check'],
                ['You take the AI Certification Exam per subject topic',        'award'],
                ['Your profile becomes visible to parents',                     'users'],
              ].map(([text, icon]) => (
                <div key={text} className="flex items-start gap-10 mb-10">
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: tokens.primaryLight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name={icon} size={12} color={tokens.primary} />
                  </div>
                  <span style={{ fontSize: 13, color: tokens.mid, lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Rejected icon */}
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: '#FEE2E2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <Icon name="x" size={36} color={tokens.danger} />
            </div>

            <h2 className="font-jakarta font-extrabold mb-12" style={{ fontSize: 24 }}>
              Application Not Approved
            </h2>

            <p className="text-sm" style={{ color: tokens.mid, lineHeight: 1.8, marginBottom: 24 }}>
              Unfortunately, your tutor application was not approved at this time.
              Please review the notes below and contact our support team for more information.
            </p>

            {adminNotes && (
              <div style={{
                background: '#FFF5F5', border: `1px solid #FECACA`,
                borderRadius: 12, padding: '14px 20px',
                marginBottom: 24, textAlign: 'left',
              }}>
                <div className="font-bold mb-6" style={{ fontSize: 13, color: tokens.danger }}>
                  Admin Notes:
                </div>
                <p style={{ fontSize: 13, color: tokens.mid, lineHeight: 1.6 }}>{adminNotes}</p>
              </div>
            )}

            <div style={{
              background: '#F9FAFB', borderRadius: 12,
              padding: '14px 20px', marginBottom: 24,
              fontSize: 13, color: tokens.mid,
            }}>
              If you believe this is an error or would like to reapply, please contact us at{' '}
              <a
                href="mailto:support@learnbridge.edu.ph"
                style={{ color: tokens.primary, fontWeight: 600 }}
              >
                support@learnbridge.edu.ph
              </a>
            </div>
          </>
        )}

        {/* Sign out button */}
        <button
          className="btn btn-primary btn-full"
          onClick={handleSignOut}
          style={{ fontSize: 15, padding: '14px' }}
        >
          <Icon name="x" size={16} /> Sign Out
        </button>

        {isPending && (
          <p className="text-xs text-muted mt-12">
            This page checks your status automatically every 30 seconds.
          </p>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}