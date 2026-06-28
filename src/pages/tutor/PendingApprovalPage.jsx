import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import Icon from '../../components/ui/Icon';
import tokens from '../../lib/tokens';

export default function PendingApprovalPage() {
  const { signOut } = useAuth();
  const [tutorStatus, setTutorStatus] = useState('pending');
  const [adminNotes,  setAdminNotes]  = useState('');
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // Get current session directly — don't rely on profile from useAuth
        // since we signOut at the end of registration
        const { data: { user } } = await supabase.auth.getUser();

        if (!user?.id) {
          // No session — just show pending page, they were signed out after registration
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from('tutors')
          .select('status, admin_notes')
          .eq('id', user.id)
          .maybeSingle();

        if (data) {
          setTutorStatus(data.status);
          setAdminNotes(data.admin_notes || '');
        }
        // If no row found yet — just show pending, it's still being created
      } catch (e) {
        console.error('PendingApproval fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: `3px solid ${tokens.primary}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p className="text-sm text-muted">Checking your application status...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isPending = tutorStatus === 'pending' || tutorStatus === null;

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>

      {/* Brand */}
      <div className="flex items-center gap-10 mb-32">
        <img src={require('../../assets/learnbridge-logo.png')} alt="LearnBridge"
          style={{ width: 52, height: 52, objectFit: 'contain' }} />
        <div className="font-jakarta font-extrabold" style={{ fontSize: 20 }}>LearnBridge</div>
      </div>

      {/* Main card */}
      <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>

        {isPending ? (
          <>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Icon name="clock" size={36} color="#CA8A04" />
            </div>

            <h2 className="font-jakarta font-extrabold mb-12" style={{ fontSize: 24 }}>
              Pending Admin Approval
            </h2>

            <p className="text-sm" style={{ color: tokens.mid, lineHeight: 1.8, marginBottom: 24 }}>
              Your requirements have been submitted successfully! Our admin team is currently
              reviewing your credentials. You will be notified once your account has been approved.
            </p>

            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '14px 20px', marginBottom: 28, fontSize: 13, color: '#1D4ED8', lineHeight: 1.6 }}>
              This review process typically takes 1–3 business days. Thank you for your patience!
            </div>

            <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '16px 20px', marginBottom: 28, textAlign: 'left' }}>
              <div className="font-jakarta font-bold mb-12" style={{ fontSize: 13, color: tokens.dark }}>
                What happens next?
              </div>
              {[
                ['Admin reviews your NBI, PRC License, Medical Certificate & Application Form', 'shield'],
                ['Admin sets your approved session rate',                                        'wallet'],
                ['You receive approval notification',                                            'check'],
                ['Your profile becomes visible to parents',                                      'users'],
              ].map(([text, icon]) => (
                <div key={text} className="flex items-start gap-10 mb-10">
                  <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: tokens.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={icon} size={12} color={tokens.primary} />
                  </div>
                  <span style={{ fontSize: 13, color: tokens.mid, lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
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
              <div style={{ background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 20px', marginBottom: 24, textAlign: 'left' }}>
                <div className="font-bold mb-6" style={{ fontSize: 13, color: tokens.danger }}>Admin Notes:</div>
                <p style={{ fontSize: 13, color: tokens.mid, lineHeight: 1.6 }}>{adminNotes}</p>
              </div>
            )}

            <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '14px 20px', marginBottom: 24, fontSize: 13, color: tokens.mid }}>
              If you believe this is an error or would like to reapply, please contact us at{' '}
              <a href="mailto:support@learnbridge.edu.ph" style={{ color: tokens.primary, fontWeight: 600 }}>
                support@learnbridge.edu.ph
              </a>
            </div>
          </>
        )}

        <button className="btn btn-primary btn-full" onClick={handleSignOut} style={{ fontSize: 15, padding: '14px' }}>
          <Icon name="logout" size={16} /> Sign Out
        </button>

        {isPending && (
          <p className="text-xs text-muted mt-12">
            This page checks your status automatically every 30 seconds.
          </p>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}