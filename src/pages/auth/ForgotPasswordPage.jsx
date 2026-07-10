import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import tokens from '../../lib/tokens';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true);
    setError('');
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (err) throw err;
      setSent(true);
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:`linear-gradient(135deg,${tokens.primaryLight},#fff,#FEF3C7)`, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:440 }}>
        <Link to="/login" className="btn btn-ghost btn-sm mb-20" style={{ display:'inline-flex' }}>← Back to Login</Link>

        <div className="card fade-in" style={{ padding:36 }}>
          {/* Logo */}
          <div className="flex items-center gap-8 mb-24">
            <div style={{ width:40, height:40, borderRadius:10, background:tokens.primary, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'#fff', fontWeight:800, fontSize:16 }}>LB</span>
            </div>
            <div>
              <div className="font-jakarta font-extrabold" style={{ fontSize:16 }}>LearnBridge</div>
              <div className="text-xs text-muted">Reset Password</div>
            </div>
          </div>

          {sent ? (
            /* Success state */
            <div style={{ textAlign:'center', padding:'8px 0' }}>
              <div style={{ fontSize:56, marginBottom:16 }}>📧</div>
              <h2 className="font-jakarta font-extrabold mb-8" style={{ fontSize:22 }}>Check your email</h2>
              <p className="text-sm text-muted mb-20" style={{ lineHeight:1.7 }}>
                We sent a password reset link to <strong>{email}</strong>. Click the link in the email to reset your password.
              </p>
              <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#1D4ED8', marginBottom:24, textAlign:'left', lineHeight:1.6 }}>
                ℹ️ Didn't receive it? Check your spam folder. The link expires in <strong>1 hour</strong>.
              </div>
              <button className="btn btn-primary btn-full" onClick={() => { setSent(false); setEmail(''); }}>
                Try a different email
              </button>
              <p className="text-sm text-muted mt-16">
                Remembered your password? <Link to="/login" style={{ color:tokens.primary, fontWeight:600 }}>Sign In</Link>
              </p>
            </div>
          ) : (
            /* Form state */
            <>
              <h2 className="font-jakarta font-extrabold mb-4" style={{ fontSize:24 }}>Forgot Password?</h2>
              <p className="text-sm text-muted mb-24" style={{ lineHeight:1.6 }}>
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  className="input"
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  autoFocus
                />
              </div>

              {error && (
                <div style={{ background:'#FEE2E2', border:'1px solid #FCA5A5', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#DC2626' }}>
                  ⚠ {error}
                </div>
              )}

              <button className="btn btn-primary btn-full btn-lg" onClick={handleSubmit} disabled={loading || !email.trim()}>
                {loading ? 'Sending...' : '📧 Send Reset Link'}
              </button>

              <p className="text-sm text-muted mt-20 text-center">
                Remembered your password? <Link to="/login" style={{ color:tokens.primary, fontWeight:600 }}>Sign In</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}