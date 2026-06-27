import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import FormGroup from '../../components/ui/FormGroup';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const registrationMessage = location.state?.message || null;

  const [form,    setForm]    = useState({ email: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // ── Step 1: Sign in directly with Supabase ──────────────────────
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email:    form.email.trim(),
        password: form.password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (!data?.user) {
        setError('Login failed. Please try again.');
        return;
      }

      // ── Step 2: Get role from profiles table ────────────────────────
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        setError('Profile not found. Please contact support.');
        return;
      }

      // ── Step 3: Route based on role ─────────────────────────────────

      // Admin → straight to dashboard
      if (profile.role === 'admin') {
        navigate('/dashboard', { replace: true });
        return;
      }

      // Parent → straight to dashboard
      if (profile.role === 'parent') {
        navigate('/dashboard', { replace: true });
        return;
      }

      // Tutor → check verification status first
      if (profile.role === 'tutor') {
        const { data: tutorRow } = await supabase
          .from('tutors')
          .select('status')
          .eq('id', data.user.id)
          .single();

        const status = tutorRow?.status || 'pending';

        if (status === 'approved') {
          navigate('/dashboard', { replace: true });
        } else {
          // pending or rejected → show waiting page
          navigate('/pending-approval', { replace: true });
        }
        return;
      }

      // Fallback
      navigate('/dashboard', { replace: true });

    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${tokens.primaryLight}, #fff, #FEF3C7)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <Link to="/" className="btn btn-ghost btn-sm mb-20" style={{ display: 'inline-flex' }}>
          ← Back
        </Link>

        <div className="card fade-in" style={{ padding: 36 }}>
          {/* Brand */}
          <div className="flex items-center gap-8 mb-24">
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: tokens.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>LB</span>
            </div>
            <div>
              <div className="font-jakarta font-extrabold" style={{ fontSize: 16 }}>LearnBridge</div>
              <div className="text-xs text-muted">Sign in to your account</div>
            </div>
          </div>

          <h2 className="font-jakarta font-extrabold mb-4" style={{ fontSize: 24 }}>
            Welcome Back
          </h2>
          <p className="text-sm text-muted mb-20">
            Sign in to access your LearnBridge account.
          </p>

          {/* Registration success message */}
          {registrationMessage && !error && (
            <div style={{
              background: '#D1FAE5', border: `1px solid #6EE7B7`,
              borderRadius: 10, padding: '12px 16px', marginBottom: 16,
              fontSize: 13, color: '#065F46', lineHeight: 1.6,
            }}>
              ✅ {registrationMessage}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{
              background: '#FEE2E2', border: `1px solid #FCA5A5`,
              borderRadius: 10, padding: '12px 16px', marginBottom: 16,
              fontSize: 13, color: '#991B1B', lineHeight: 1.6,
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <FormGroup label="Email Address">
              <input
                className="input"
                type="email"
                placeholder="you@email.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                required
                autoFocus
              />
            </FormGroup>

            <FormGroup label="Password">
              <input
                className="input"
                type="password"
                placeholder="Your password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                required
              />
            </FormGroup>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg mt-4"
              disabled={loading}
            >
              {loading ? <Spinner /> : 'Sign In'}
            </button>
          </form>

          <p className="text-sm text-muted mt-20 text-center">
            Don't have an account?{' '}
            <Link to="/register" style={{ color: tokens.primary, fontWeight: 600 }}>
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}