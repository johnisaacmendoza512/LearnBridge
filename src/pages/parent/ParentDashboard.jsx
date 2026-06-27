import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useParentDashboard } from '../../hooks/useParentDashboard';
import { supabase } from '../../lib/supabase';
import StatCard from '../../components/ui/StatCard';
import PerformanceBadge from '../../components/ui/PerformanceBadge';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import FormGroup from '../../components/ui/FormGroup';
import tokens from '../../lib/tokens';

export default function ParentDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { stats, upcomingSessions, recentFeedback, loading, error } = useParentDashboard();

  const [activeTab, setActiveTab] = useState('overview');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name:   profile?.full_name   || '',
    email:       profile?.email       || '',
    contact:     profile?.contact     || '',
    address:     profile?.address     || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');

  const firstName = profile?.full_name?.split(' ')[0] || 'Parent';
  const setF = (k, v) => setProfileForm(f => ({ ...f, [k]: v }));

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileForm.full_name,
          contact:   profileForm.contact,
          address:   profileForm.address,
        })
        .eq('id', user.id);
      if (error) throw error;
      setProfileSuccess('Profile updated successfully!');
      setEditingProfile(false);
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (e) {
      alert('Failed to save: ' + e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) return <Spinner dark size={32} />;
  if (error) return (
    <div className="card p-24 text-center">
      <p className="text-sm" style={{ color: tokens.danger }}>Failed to load dashboard: {error}</p>
      <button className="btn btn-primary mt-12" onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>
          Good {getGreeting()}, {firstName} 👋
        </h2>
        <p className="text-sm text-muted mt-4">Here's an overview of your children's learning progress.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-8 mb-24">
        {[
          { key: 'overview', label: '📊 Overview' },
          { key: 'profile',  label: '👤 My Profile' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="btn"
            style={{
              background: activeTab === tab.key ? tokens.primary : '#fff',
              color:      activeTab === tab.key ? '#fff' : tokens.mid,
              border:     `1.5px solid ${activeTab === tab.key ? tokens.primary : tokens.border}`,
              fontWeight: 600,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <>
          {/* Stats */}
          <div className="grid-4 mb-24">
            <StatCard label="Active Children"   value={stats.children}        icon="users"    accent="primary"   />
            <StatCard label="Upcoming Sessions" value={stats.upcoming}        icon="calendar" accent="secondary" />
            <StatCard label="Hours This Month"  value={stats.hoursThisMonth}  icon="book"     accent="teal"      />
            <StatCard label="Recent Feedback"   value={recentFeedback.length} icon="star"     accent="coral"     />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Upcoming Sessions */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-jakarta font-bold" style={{ fontSize: 15 }}>Upcoming Sessions</h3>
              </div>
              {upcomingSessions.length === 0 ? (
                <EmptyState icon="📅" title="No upcoming sessions" description="Book a tutor to get started." />
              ) : (
                upcomingSessions.map((s, i) => (
                  <div key={s.id} style={{
                    padding: '14px 0',
                    borderBottom: i < upcomingSessions.length - 1 ? `1px solid ${tokens.border}` : 'none',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: tokens.primaryLight,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="calendar" size={16} color={tokens.primary} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold" style={{ fontSize: 13 }}>
                        {s.booking?.student?.name} · {s.booking?.subject}
                      </div>
                      <div className="text-xs text-muted mt-2">
                        {s.booking?.tutor?.full_name} · {formatDate(s.scheduled_date)} at {formatTime(s.scheduled_time)}
                      </div>
                      <div className="text-xs mt-2" style={{ color: tokens.muted, textTransform: 'capitalize' }}>
                        {s.booking?.session_mode} · Session {s.session_number}/8
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Recent Feedback */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-jakarta font-bold" style={{ fontSize: 15 }}>Recent Tutor Feedback</h3>
              </div>
              {recentFeedback.length === 0 ? (
                <EmptyState icon="💬" title="No feedback yet" description="Feedback appears here after sessions are completed." />
              ) : (
                recentFeedback.map((f, i) => (
                  <div key={f.id} style={{
                    padding: '14px 0',
                    borderBottom: i < recentFeedback.length - 1 ? `1px solid ${tokens.border}` : 'none',
                  }}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="font-semibold" style={{ fontSize: 13 }}>
                        {f.booking?.student?.name} · {f.topic_covered || 'Topic N/A'}
                      </div>
                      {f.performance_indicator && <PerformanceBadge value={f.performance_indicator} />}
                    </div>
                    <div className="text-xs text-muted mb-4">
                      by {f.booking?.tutor?.full_name} on {formatDate(f.scheduled_date)}
                    </div>
                    {f.tutor_comments && (
                      <p style={{ fontSize: 12, color: tokens.mid, lineHeight: 1.6 }}>{f.tutor_comments}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-24">
            <h3 className="font-jakarta font-bold mb-16" style={{ fontSize: 15 }}>Quick Actions</h3>
            <div className="grid-3">
              {[
                { label: 'Add Child Profile', icon: 'plus',   desc: 'Register another learner',       path: '/my-children' },
                { label: 'Browse Tutors',     icon: 'search', desc: 'Find a verified tutor',          path: '/find-tutors' },
                { label: 'View Progress',     icon: 'chart',  desc: 'Track performance over time',    path: '/progress'    },
              ].map(({ label, icon, desc, path }) => (
                <button
                  key={label}
                  className="btn btn-ghost"
                  style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '16px', height: 'auto', textAlign: 'left', border: `1px solid ${tokens.border}`, borderRadius: 12 }}
                  onClick={() => navigate(path)}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: tokens.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <Icon name={icon} size={16} color={tokens.primary} />
                  </div>
                  <div className="font-semibold" style={{ fontSize: 13, marginBottom: 4 }}>{label}</div>
                  <div className="text-xs text-muted">{desc}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── PROFILE TAB ── */}
      {activeTab === 'profile' && (
        <div className="card p-28" style={{ maxWidth: 600 }}>
          <div className="flex items-center justify-between mb-24">
            <h3 className="font-jakarta font-bold" style={{ fontSize: 18 }}>My Profile</h3>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setProfileForm({
                  full_name: profile?.full_name || '',
                  email:     profile?.email     || '',
                  contact:   profile?.contact   || '',
                  address:   profile?.address   || '',
                });
                setEditingProfile(!editingProfile);
              }}
            >
              <Icon name="edit" size={13} /> {editingProfile ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {profileSuccess && (
            <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#065F46', fontWeight: 600 }}>
              ✅ {profileSuccess}
            </div>
          )}

          {editingProfile ? (
            <>
              <FormGroup label="Full Name">
                <input
                  className="input"
                  value={profileForm.full_name}
                  onChange={e => setF('full_name', e.target.value)}
                  placeholder="Your full name"
                />
              </FormGroup>
              <FormGroup label="Email Address" hint="Email cannot be changed here.">
                <input
                  className="input"
                  value={profileForm.email}
                  disabled
                  style={{ background: '#F9FAFB', color: tokens.muted, cursor: 'not-allowed' }}
                />
              </FormGroup>
              <FormGroup label="Contact Number">
                <input
                  className="input"
                  value={profileForm.contact}
                  onChange={e => setF('contact', e.target.value)}
                  placeholder="e.g. 09XX XXX XXXX"
                />
              </FormGroup>
              <FormGroup label="Address">
                <textarea
                  className="textarea"
                  value={profileForm.address}
                  onChange={e => setF('address', e.target.value)}
                  placeholder="e.g. 123 Rizal St., Quezon City"
                  style={{ minHeight: 72 }}
                />
              </FormGroup>
              <button
                className="btn btn-primary btn-full"
                onClick={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? <Spinner /> : <><Icon name="check" size={13} /> Save Changes</>}
              </button>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                ['Full Name',       profile?.full_name || '—'],
                ['Email Address',   profile?.email     || '—'],
                ['Contact Number',  profile?.contact   || 'Not set'],
                ['Address',         profile?.address   || 'Not set'],
                ['Role',            'Parent'],
                ['Member Since',    profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
                  : '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#F9FAFB', borderRadius: 10, padding: 14 }}>
                  <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing: '0.5px' }}>{k}</div>
                  <div className="font-semibold" style={{ fontSize: 13 }}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':');
  const date = new Date();
  date.setHours(+h, +m);
  return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
}