import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import FormGroup from '../../components/ui/FormGroup';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import tokens from '../../lib/tokens';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES   = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

export default function ParentProfilePage() {
  const { profile, user } = useAuth();
  const fileInputRef = useRef(null);

  const [savedPhone,    setSavedPhone]    = useState(profile?.phone    || '');
  const [savedLocation, setSavedLocation] = useState(profile?.location || '');
  const [savedGender,   setSavedGender]   = useState(profile?.gender   || '');
  const [savedId1, setSavedId1] = useState(profile?.valid_id_1 || null);
  const [savedId2, setSavedId2] = useState(profile?.valid_id_2 || null);

  // Update when profile loads from AuthContext
  useEffect(() => {
    if (profile?.valid_id_1) setSavedId1(profile.valid_id_1);
    if (profile?.valid_id_2) setSavedId2(profile.valid_id_2);
  }, [profile?.valid_id_1, profile?.valid_id_2]);

  const [editing,      setEditing]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [avatarUrl,    setAvatarUrl]    = useState(profile?.avatar_url || null);
  const [success,      setSuccess]      = useState('');
  const [error,        setError]        = useState('');
  const [form, setForm] = useState({ phone: profile?.phone || '', location: profile?.location || '', gender: profile?.gender || '' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const accountStatus = profile?.status || 'approved';

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) { setError('Please upload a JPG, PNG or WebP image.'); return; }
    if (file.size > MAX_AVATAR_SIZE) { setError(`Image too large. Max 5MB.`); return; }
    setUploadingPic(true); setError('');
    try {
      const ext  = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      setAvatarUrl(publicUrl);
      setSuccess('Profile picture updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError('Failed to upload: ' + err.message); }
    finally { setUploadingPic(false); }
  };

  const handleSave = async () => {
    // Validate phone number
    if (form.phone && (!form.phone.startsWith('09') || form.phone.length !== 11)) {
      setError('Contact number must start with 09 and be exactly 11 digits.');
      return;
    }
    setSaving(true); setError('');
    try {
      const { error: saveErr } = await supabase.from('profiles').update({ phone: form.phone || null, location: form.location || null, gender: form.gender || null }).eq('id', user.id);
      if (saveErr) throw saveErr;
      setSavedPhone(form.phone);
      setSavedLocation(form.location);
      setSuccess('Profile updated successfully!');
      setEditing(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError('Failed to save: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleCancelEdit = () => {
    setForm({ phone: savedPhone, location: savedLocation, gender: savedGender });
    setEditing(false); setError('');
  };

  const openDoc = async (url) => {
    if (!url) return;
    window.open(url, '_blank');
  };

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-24">
        <div>
          <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>My Profile</h2>
          <p className="text-sm text-muted mt-4">Manage your account information and submitted documents.</p>
        </div>
        <button className="btn btn-outline" onClick={() => { if (editing) { handleCancelEdit(); } else { setForm({ phone: savedPhone, location: savedLocation, gender: savedGender }); setEditing(true); setError(''); } }}>
          <Icon name="edit" size={14} /> {editing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {/* Account status banner */}
      {accountStatus === 'pending' && (
        <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 12, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: '#92400E', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>⏳</span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Account Pending Approval</div>
            <div>Your submitted IDs are under review by the admin team. You will be notified once approved (1–3 business days).</div>
          </div>
        </div>
      )}
      {accountStatus === 'approved' && (
        <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 12, padding: '12px 18px', marginBottom: 20, fontSize: 13, color: '#065F46', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div><strong>Account Verified</strong> — Your identity has been verified by the admin team.</div>
        </div>
      )}
      {accountStatus === 'rejected' && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>❌</span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Account Not Approved</div>
            <div>Your submitted IDs were not accepted. Please contact admin through the messages section.</div>
          </div>
        </div>
      )}

      {error && <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#DC2626', fontWeight: 600 }}>❌ {error}</div>}
      {success && <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#065F46', fontWeight: 600 }}>✅ {success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>

        {/* Left card */}
        <div className="card p-24 text-center" style={{ alignSelf: 'flex-start' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={profile?.full_name} style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${tokens.primary}` }} />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: '50%', background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${tokens.primary}` }}>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 36 }}>{(profile?.full_name || 'P').charAt(0).toUpperCase()}</span>
              </div>
            )}
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPic}
              style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: '50%', background: tokens.primary, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {uploadingPic ? <div style={{ width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <Icon name="camera" size={13} color="#fff" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/jpg,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>
          <div className="font-jakarta font-bold" style={{ fontSize: 17 }}>{profile?.full_name || 'Parent'}</div>
          <div className="text-sm text-muted mt-4 mb-4">{profile?.email}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: accountStatus === 'approved' ? '#D1FAE5' : accountStatus === 'pending' ? '#FEF9C3' : '#FEE2E2', color: accountStatus === 'approved' ? '#065F46' : accountStatus === 'pending' ? '#92400E' : '#DC2626', marginBottom: 8 }}>
            {accountStatus === 'approved' ? '✓ Verified' : accountStatus === 'pending' ? '⏳ Pending' : '✗ Rejected'}
          </div>
          <p className="text-xs text-muted mt-8">Click the camera icon to update your photo</p>
          <p className="text-xs text-muted mt-8">Member since{' '}{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }) : '—'}</p>
        </div>

        {/* Right card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Profile details */}
          <div className="card p-28">
            {editing ? (
              <div>
                <h3 className="font-jakarta font-bold mb-20" style={{ fontSize: 16 }}>Edit Profile</h3>
                <FormGroup label="Full Name" hint="Contact admin to change your name.">
                  <input className="input" value={profile?.full_name || ''} disabled style={{ background: '#F9FAFB', color: tokens.muted, cursor: 'not-allowed' }} />
                </FormGroup>
                <FormGroup label="Email Address" hint="Email cannot be changed.">
                  <input className="input" value={profile?.email || ''} disabled style={{ background: '#F9FAFB', color: tokens.muted, cursor: 'not-allowed' }} />
                </FormGroup>
                <div className="grid-2">
                  <FormGroup label="Contact Number">
                    <input className="input" value={form.phone}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val.length <= 11) set('phone', val);
                      }}
                      placeholder="e.g. 09171234567" maxLength={11} />
                    {form.phone && form.phone.length > 0 && (!form.phone.startsWith('09') || form.phone.length !== 11) && (
                      <p style={{fontSize:11,color:'#DC2626',marginTop:4}}>Must start with 09 and be exactly 11 digits.</p>
                    )}
                  </FormGroup>
                  <FormGroup label="Gender">
                    <select className="select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Rather not say">Rather not say</option>
                    </select>
                  </FormGroup>
                </div>
                <FormGroup label="Home Address">
                  <textarea className="textarea" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. 123 Rizal St., Quezon City" style={{ minHeight: 80 }} />
                </FormGroup>
                <div className="flex justify-end gap-10 mt-8">
                  <button className="btn btn-ghost" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? <><Spinner /> Saving...</> : <><Icon name="check" size={13} /> Save Changes</>}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-jakarta font-bold mb-20" style={{ fontSize: 16 }}>Profile Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  {[
                    ['Full Name',      profile?.full_name || '—'],
                    ['Email Address',  profile?.email     || '—'],
                    ['Contact Number', savedPhone       || 'Not set'],
                    ['Address',        savedLocation       || 'Not set'],
                    ['Role',           'Parent'],
                    ['Account Status', accountStatus.charAt(0).toUpperCase() + accountStatus.slice(1)],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                      <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing: '0.5px' }}>{k}</div>
                      <div className="font-semibold" style={{ fontSize: 13 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submitted Valid IDs */}
          <div className="card p-28">
            <h3 className="font-jakarta font-bold mb-4" style={{ fontSize: 16 }}>🪪 Submitted Valid IDs</h3>
            <p className="text-sm text-muted mb-20">These are the identification documents you submitted during registration.</p>

            {savedId1 || savedId2 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: '1st Valid ID', url: savedId1 },
                  { label: '2nd Valid ID', url: savedId2 },
                ].map((doc, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: doc.url ? '#F0FDF4' : '#FEF2F2', border: `1.5px solid ${doc.url ? '#6EE7B7' : '#FCA5A5'}` }}>
                    <span style={{ fontSize: 24 }}>🪪</span>
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold" style={{ fontSize: 14 }}>{doc.label}</div>
                      <div className="text-xs text-muted mt-2">{doc.url ? 'PDF submitted · Click to view' : 'Not submitted'}</div>
                    </div>
                    {doc.url ? (
                      <button onClick={() => openDoc(doc.url)} className="btn btn-sm" style={{ background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7' }}>
                        👁 View PDF
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>Missing</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: tokens.muted, fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                No documents submitted yet.
              </div>
            )}

            <div style={{ marginTop: 16, padding: '10px 14px', background: '#F9FAFB', borderRadius: 10, fontSize: 12, color: tokens.muted }}>
              🔒 Your documents are securely stored and only accessible by you and authorized admin staff.
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}