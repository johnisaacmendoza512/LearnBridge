import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import FormGroup from '../../components/ui/FormGroup';
import Icon from '../../components/ui/Icon';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import { supabase } from '../../lib/supabase';
import tokens from '../../lib/tokens';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES   = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

export default function TutorProfilePage() {
  const { user, profile } = useAuth();
  const fileInputRef = useRef(null);

  const [tutorData,     setTutorData]     = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [editing,       setEditing]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [uploadingPic,  setUploadingPic]  = useState(false);
  const [avatarUrl,     setAvatarUrl]     = useState(null);
  const [error,         setError]         = useState('');
  const [success,       setSuccess]       = useState('');

  const [form, setForm] = useState({
    full_name:       '',
    bio:             '',
    location:        '',
    gender:          '',
    years_experience:'',
    rate_per_session:'',
    specialization:  [],
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Fetch profile + tutor data ────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const { data: tutor } = await supabase
        .from('tutors')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setAvatarUrl(profileData.avatar_url || null);
        setForm({
          full_name:        profileData.full_name        || '',
          bio:              profileData.bio               || '',
          location:         profileData.location          || '',
          gender:           profileData.gender            || '',
          years_experience: tutor?.years_experience       ?? '',
          rate_per_session: tutor?.rate_per_session       ?? '',
          specialization:   tutor?.specialization         || [],
        });
      }
      setTutorData(tutor);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  // ── Upload profile picture ────────────────────────────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setError(`Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`);
      return;
    }

    setUploadingPic(true);
    setError('');
    try {
      const ext  = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      // Add cache-busting timestamp so React re-renders the new photo
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);

      setAvatarUrl(publicUrl);
      setSuccess('Profile picture updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to upload picture: ' + err.message);
    } finally {
      setUploadingPic(false);
    }
  };

  // ── Save profile changes ──────────────────────────────────────────
  const handleSave = async () => {
    // Validate full name - alphabets and spaces only
    if (form.full_name && !/^[a-zA-Z\s]+$/.test(form.full_name)) {
      setError('Full name must contain letters and spaces only.');
      return;
    }
    // Validate rate - numbers only
    if (form.rate_per_session && isNaN(Number(form.rate_per_session))) {
      setError('Proposed rate must be a valid number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await supabase.from('profiles').update({
        full_name: form.full_name,
        bio:       form.bio,
        location:  form.location,
        gender:    form.gender,
      }).eq('id', user.id);

      await supabase.from('tutors').update({
        years_experience: Number(form.years_experience) || 0,
        rate_per_session: Number(form.rate_per_session) || null,
        specialization:   form.specialization,
      }).eq('id', user.id);

      setTutorData(prev => ({
        ...prev,
        years_experience: Number(form.years_experience) || 0,
        rate_per_session: Number(form.rate_per_session) || null,
        specialization:   form.specialization,
      }));

      setSuccess('Profile saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setEditing(false);
    } catch (err) {
      setError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSpec = (s) => {
    setForm(f => ({
      ...f,
      specialization: f.specialization.includes(s)
        ? f.specialization.filter(x => x !== s)
        : [...f.specialization, s],
    }));
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner dark size={32} /></div>;

  const displayName   = form.full_name || profile?.full_name || 'Tutor';
  const displayRate   = tutorData?.approved_rate || tutorData?.rate_per_session || 0;
  const specs         = tutorData?.specialization || [];
  const certScores    = tutorData?.certification_scores || {};
  const avgRating     = tutorData?.average_rating || 0;
  const totalRatings  = tutorData?.total_ratings  || 0;

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-24">
        <div>
          <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>My Profile</h2>
          <p className="text-sm text-muted mt-4">This is how parents and admins see your profile.</p>
        </div>
        <button className="btn btn-outline" onClick={() => { setEditing(!editing); setError(''); }}>
          <Icon name="edit" size={14} /> {editing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {error   && <div className="alert alert-error mb-16">{error}</div>}
      {success && <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#065F46', fontWeight: 600 }}>✅ {success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>

        {/* ── Left card: Avatar + stats ── */}
        <div className="card p-24 text-center" style={{ alignSelf: 'flex-start' }}>

          {/* Avatar with upload overlay */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                style={{
                  width: 96, height: 96, borderRadius: '50%',
                  objectFit: 'cover',
                  border: `3px solid ${tokens.primary}`,
                }}
              />
            ) : (
              <div style={{
                width: 96, height: 96, borderRadius: '50%',
                background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `3px solid ${tokens.primary}`,
              }}>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 32 }}>
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {/* Camera overlay button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPic}
              style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 30, height: 30, borderRadius: '50%',
                background: tokens.primary, border: '2px solid #fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'transform 0.15s',
              }}
              title="Change profile picture"
            >
              {uploadingPic
                ? <div style={{ width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                : <Icon name="camera" size={13} color="#fff" />
              }
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
          </div>

          <div className="font-jakarta font-bold" style={{ fontSize: 17 }}>{displayName}</div>
          <div className="text-sm text-muted mt-4" style={{ textTransform: 'capitalize' }}>
            {specs.join(' & ') || 'No subject set'}
          </div>

          <div className="mt-12 mb-12">
            <Badge variant="success">
              <Icon name="shield" size={9} color="#065F46" /> Verified
            </Badge>
          </div>

          <p className="text-xs text-muted" style={{ marginBottom: 16 }}>
            Click the camera icon to update your photo
          </p>

          {/* Rating */}
          {avgRating > 0 ? (
            <div style={{ padding: '10px 12px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A' }}>
              <div className="font-jakarta font-black" style={{ fontSize: 24, color: '#F59E0B' }}>
                {avgRating.toFixed(1)} ★
              </div>
              <div className="text-xs text-muted">{totalRatings} parent review{totalRatings !== 1 ? 's' : ''}</div>
            </div>
          ) : (
            <div style={{ padding: '10px 12px', background: '#F9FAFB', borderRadius: 10 }}>
              <div className="text-xs text-muted">No ratings yet</div>
            </div>
          )}

          {/* Wallet balance */}
          <div style={{ marginTop: 12, padding: '10px 12px', background: tokens.primaryLight, borderRadius: 10 }}>
            <div className="font-jakarta font-extrabold" style={{ fontSize: 18, color: tokens.primary }}>
              ₱{Number(tutorData?.wallet_balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted">Wallet Balance</div>
          </div>
        </div>

        {/* ── Right card: Details ── */}
        <div className="card p-28">
          {editing ? (
            <div>
              <h3 className="font-jakarta font-bold mb-20" style={{ fontSize: 16 }}>Edit Profile</h3>

              <FormGroup label="Full Name">
                <input className="input" value={form.full_name}
                  onChange={e => {
                    const val = e.target.value;
                    if (/^[a-zA-Z\s]*$/.test(val)) set('full_name', val);
                  }}
                  placeholder="Your full name" />
              </FormGroup>

              <FormGroup label="Bio" hint="Tell parents about your teaching experience and style.">
                <textarea
                  className="textarea"
                  value={form.bio}
                  onChange={e => set('bio', e.target.value)}
                  placeholder="e.g. Licensed teacher with 5 years experience..."
                  style={{ minHeight: 90 }}
                />
              </FormGroup>

              <div className="grid-2">
                <FormGroup label="Location">
                  <input className="input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Quezon City" />
                </FormGroup>
                <FormGroup label="Gender">
                  <select className="select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </FormGroup>
              </div>

              <div className="grid-2">
                <FormGroup label="Years of Experience">
                  <input className="input" type="number" min="0" value={form.years_experience} onChange={e => set('years_experience', e.target.value)} placeholder="e.g. 5" />
                </FormGroup>
                <FormGroup label="Proposed Rate (₱/session)" hint="Admin sets your final approved rate.">
                  <input className="input" type="number" min="0" value={form.rate_per_session}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      set('rate_per_session', val);
                    }}
                    placeholder="e.g. 350" />
                </FormGroup>
              </div>

              <FormGroup label="Specialization" hint="Based on your AI certification exam. Cannot be changed.">
                <div className="flex gap-10">
                  {(tutorData?.specialization || []).length > 0 ? (tutorData.specialization.map(s => (
                    <span key={s} style={{
                      flex: 1, padding: '10px 16px', borderRadius: 10, textAlign: 'center',
                      border: `2px solid ${tokens.primary}`,
                      background: tokens.primaryLight,
                      color: tokens.primary,
                      fontWeight: 600, fontSize: 14, textTransform: 'capitalize',
                    }}>✓ {s}</span>
                  ))) : (
                    <span style={{fontSize:13,color:tokens.muted}}>No specialization set</span>
                  )}
                </div>
              </FormGroup>

              <div className="flex justify-end gap-10 mt-8">
                <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><Spinner /> Saving...</> : <><Icon name="check" size={13} /> Save Changes</>}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="font-jakarta font-bold mb-20" style={{ fontSize: 16 }}>Profile Details</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {[
                  ['Email',           profile?.email              || '—'],
                  ['Location',        form.location               || '—'],
                  ['Gender',          form.gender                 || '—'],
                  ['Experience',      form.years_experience ? `${form.years_experience} year(s)` : '—'],
                  ['Proposed Rate',   form.rate_per_session ? `₱${Number(form.rate_per_session).toLocaleString()}/session` : '—'],
                  ['Approved Rate',   displayRate ? `₱${Number(displayRate).toLocaleString()}/session` : 'Pending admin review'],
                  ['Status',         tutorData?.status === 'approved' ? 'Active & Approved' : tutorData?.status || '—'],
                  ['8-Session Total', displayRate ? `₱${(Number(displayRate) * 8).toLocaleString()}` : '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                    <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing: '0.5px' }}>{k}</div>
                    <div className="font-semibold" style={{ fontSize: 13 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Bio */}
              {form.bio && (
                <div style={{ marginBottom: 20 }}>
                  <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing: '0.5px' }}>Bio</div>
                  <p style={{ fontSize: 14, color: tokens.mid, lineHeight: 1.7 }}>{form.bio}</p>
                </div>
              )}

              {/* Specializations */}
              {specs.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing: '0.5px' }}>Subjects</div>
                  <div className="flex gap-8">
                    {specs.map(s => (
                      <span key={s} style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                        background: s === 'english' ? '#EFF6FF' : '#F0FDF4',
                        color:      s === 'english' ? '#1D4ED8' : '#15803D',
                        textTransform: 'capitalize',
                      }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Certification Scores */}
              {Object.keys(certScores).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="text-xs text-muted uppercase font-bold mb-10" style={{ letterSpacing: '0.5px' }}>AI Certification Scores</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(certScores).map(([topic, score]) => (
                      <div key={topic}>
                        <div className="flex items-center justify-between mb-4">
                          <span style={{ fontSize: 13, textTransform: 'capitalize' }}>{topic.replace(/_/g, ' ')}</span>
                          <span style={{
                            fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                            background: score >= 80 ? '#D1FAE5' : '#FEF3C7',
                            color:      score >= 80 ? '#065F46' : '#92400E',
                          }}>{score}%</span>
                        </div>
                        <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3, width: `${score}%`,
                            background: score >= 80 ? tokens.success : '#F59E0B',
                            transition: 'width 0.4s',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              <div>
                <div className="text-xs text-muted uppercase font-bold mb-8" style={{ letterSpacing: '0.5px' }}>Submitted Documents</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'NBI Clearance',      ok: !!tutorData?.nbi_clearance_url,    url: tutorData?.nbi_clearance_url    },
                    { label: 'PRC License',         ok: !!tutorData?.prc_license_url,      url: tutorData?.prc_license_url      },
                    { label: 'Medical Certificate', ok: !!tutorData?.medical_cert_url,     url: tutorData?.medical_cert_url     },
                    { label: 'Application Form',    ok: !!tutorData?.application_form_url, url: tutorData?.application_form_url },
                  ].map(doc => (
                    doc.url ? (
                      <a key={doc.label} href={doc.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:'none'}}>
                        <Badge variant="success">
                          <Icon name="check" size={9} color="#065F46" /> {doc.label} ↗
                        </Badge>
                      </a>
                    ) : (
                      <Badge key={doc.label} variant="warning">
                        <Icon name="upload" size={9} color="#92400E" /> {doc.label}
                      </Badge>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}