import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import tokens from '../../lib/tokens';

function getPasswordStrength(pw) {
  const checks = {
    length:    pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    number:    /[0-9]/.test(pw),
    special:   /[^A-Za-z0-9]/.test(pw),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const strength = passed <= 1 ? 'Weak' : passed === 2 ? 'Fair' : passed === 3 ? 'Good' : 'Strong';
  const color    = passed <= 1 ? '#DC2626' : passed === 2 ? '#F59E0B' : passed === 3 ? '#3B82F6' : '#16A34A';
  return { checks, passed, strength, color };
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [password,    setPassword]    = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [done,        setDone]        = useState(false);
  const [validSession,setValidSession]= useState(false);
  const [checking,    setChecking]    = useState(true);

  const pwStrength = password ? getPasswordStrength(password) : null;

  useEffect(() => {
    // Supabase sends the reset token in the URL hash
    // onAuthStateChange fires with PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true);
        setChecking(false);
      }
    });

    // Also check if there's already a session (user clicked link and landed here)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setValidSession(true);
      }
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    if (!password) { setError('Please enter a new password.'); return; }
    if (password !== confirmPw) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/login', { state: { passwordReset: true } }), 3000);
    } catch (e) {
      setError(e.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center', color:tokens.muted }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
          <div>Verifying reset link...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:`linear-gradient(135deg,${tokens.primaryLight},#fff,#FEF3C7)`, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:440 }}>
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

          {done ? (
            /* Success */
            <div style={{ textAlign:'center', padding:'8px 0' }}>
              <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
              <h2 className="font-jakarta font-extrabold mb-8" style={{ fontSize:22 }}>Password Reset!</h2>
              <p className="text-sm text-muted mb-20" style={{ lineHeight:1.7 }}>
                Your password has been updated successfully. Redirecting you to login...
              </p>
              <Link to="/login" className="btn btn-primary btn-full">Go to Login</Link>
            </div>
          ) : !validSession ? (
            /* Invalid / expired link */
            <div style={{ textAlign:'center', padding:'8px 0' }}>
              <div style={{ fontSize:56, marginBottom:16 }}>⚠️</div>
              <h2 className="font-jakarta font-extrabold mb-8" style={{ fontSize:22 }}>Link Expired</h2>
              <p className="text-sm text-muted mb-20" style={{ lineHeight:1.7 }}>
                This password reset link has expired or is invalid. Please request a new one.
              </p>
              <Link to="/forgot-password" className="btn btn-primary btn-full">Request New Link</Link>
            </div>
          ) : (
            /* Reset form */
            <>
              <h2 className="font-jakarta font-extrabold mb-4" style={{ fontSize:24 }}>Set New Password</h2>
              <p className="text-sm text-muted mb-24">Choose a strong password for your account.</p>

              {/* New password */}
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position:'relative' }}>
                  <input
                    className="input"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    style={{ paddingRight:44 }}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:tokens.muted, fontSize:13, fontWeight:600, padding:0 }}>
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>

                {/* Strength indicator */}
                {password && pwStrength && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ display:'flex', gap:4, marginBottom:5 }}>
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{ flex:1, height:4, borderRadius:2, background: i <= pwStrength.passed ? pwStrength.color : '#E5E7EB', transition:'background 0.2s' }} />
                      ))}
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <span style={{ fontSize:11, color:tokens.muted }}>Password strength</span>
                      <span style={{ fontSize:11, fontWeight:700, color:pwStrength.color }}>{pwStrength.strength}</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                      {[
                        { key:'length',    label:'At least 8 characters' },
                        { key:'uppercase', label:'Uppercase letter (A-Z)' },
                        { key:'number',    label:'Number (0-9)' },
                        { key:'special',   label:'Special character (!@#$...)' },
                      ].map(({ key, label }) => (
                        <div key={key} style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ width:14, height:14, borderRadius:'50%', flexShrink:0, background:pwStrength.checks[key]?'#D1FAE5':'#F3F4F6', color:pwStrength.checks[key]?'#16A34A':'#9CA3AF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700 }}>
                            {pwStrength.checks[key] ? '✓' : '✕'}
                          </span>
                          <span style={{ fontSize:11, color:pwStrength.checks[key]?'#16A34A':tokens.muted }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <div style={{ position:'relative' }}>
                  <input
                    className="input"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repeat your new password"
                    value={confirmPw}
                    onChange={e => { setConfirmPw(e.target.value); setError(''); }}
                    style={{ paddingRight:44 }}
                  />
                  <button type="button" onClick={() => setShowConfirm(s => !s)}
                    style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:tokens.muted, fontSize:13, fontWeight:600, padding:0 }}>
                    {showConfirm ? 'Hide' : 'Show'}
                  </button>
                </div>
                {confirmPw && (
                  <div style={{ marginTop:5, fontSize:11, fontWeight:600, color: password === confirmPw ? '#16A34A' : '#DC2626' }}>
                    {password === confirmPw ? '✓ Passwords match' : '✕ Passwords do not match'}
                  </div>
                )}
              </div>

              {error && (
                <div style={{ background:'#FEE2E2', border:'1px solid #FCA5A5', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#DC2626' }}>
                  ⚠ {error}
                </div>
              )}

              <button className="btn btn-primary btn-full btn-lg" onClick={handleReset}
                disabled={loading || !password || !confirmPw || password !== confirmPw}>
                {loading ? 'Updating...' : '🔒 Reset Password'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}