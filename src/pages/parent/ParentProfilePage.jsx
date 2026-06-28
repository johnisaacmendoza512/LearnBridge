import { useState, useRef } from 'react';
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

  // Local state that reflects saved values
  const [savedContact, setSavedContact] = useState(profile?.contact || '');
  const [savedAddress, setSavedAddress] = useState(profile?.address || '');

  const [editing,      setEditing]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [avatarUrl,    setAvatarUrl]    = useState(profile?.avatar_url || null);
  const [success,      setSuccess]      = useState('');
  const [error,        setError]        = useState('');
  const [form,         setForm]         = useState({
    contact: profile?.contact || '',
    address: profile?.address || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) { setError('Please upload a JPG, PNG or WebP image.'); return; }
    if (file.size > MAX_AVATAR_SIZE) { setError(`Image too large (${(file.size/1024/1024).toFixed(1)}MB). Max 5MB.`); return; }

    setUploadingPic(true);
    setError('');
    try {
      const ext  = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      setAvatarUrl(publicUrl);
      setSuccess('Profile picture updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to upload: ' + err.message);
    } finally {
      setUploadingPic(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const { error: saveErr } = await supabase
        .from('profiles')
        .update({
          contact: form.contact || null,
          address: form.address || null,
        })
        .eq('id', user.id);
      if (saveErr) throw saveErr;

      // Update local saved state so display reflects new values immediately
      setSavedContact(form.contact);
      setSavedAddress(form.address);

      setSuccess('Profile updated successfully!');
      setEditing(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset form to last saved values
    setForm({ contact: savedContact, address: savedAddress });
    setEditing(false);
    setError('');
  };

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-24">
        <div>
          <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>My Profile</h2>
          <p className="text-sm text-muted mt-4">This is how your information appears on LearnBridge.</p>
        </div>
        <button className="btn btn-outline" onClick={() => {
          if (editing) { handleCancelEdit(); }
          else { setForm({ contact: savedContact, address: savedAddress }); setEditing(true); setError(''); }
        }}>
          <Icon name="edit" size={14} /> {editing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
          ❌ {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#065F46', fontWeight: 600 }}>
          ✅ {success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>

        {/* Left card */}
        <div className="card p-24 text-center" style={{ alignSelf: 'flex-start' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={profile?.full_name}
                style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${tokens.primary}` }} />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: '50%', background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${tokens.primary}` }}>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 36 }}>
                  {(profile?.full_name || 'P').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPic}
              style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: '50%', background: tokens.primary, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title="Change profile picture"
            >
              {uploadingPic
                ? <div style={{ width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                : <Icon name="camera" size={13} color="#fff" />
              }
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/jpg,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>

          <div className="font-jakarta font-bold" style={{ fontSize: 17 }}>{profile?.full_name || 'Parent'}</div>
          <div className="text-sm text-muted mt-4 mb-4">{profile?.email}</div>
          <p className="text-xs text-muted mt-8">Click the camera icon to update your photo</p>
          <p className="text-xs text-muted mt-8">
            Member since{' '}
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
              : '—'}
          </p>
        </div>

        {/* Right card */}
        <div className="card p-28">
          {editing ? (
            <div>
              <h3 className="font-jakarta font-bold mb-20" style={{ fontSize: 16 }}>Edit Profile</h3>
              <FormGroup label="Full Name" hint="Contact admin to change your name.">
                <input className="input" value={profile?.full_name || ''} disabled
                  style={{ background: '#F9FAFB', color: tokens.muted, cursor: 'not-allowed' }} />
              </FormGroup>
              <FormGroup label="Email Address" hint="Email cannot be changed.">
                <input className="input" value={profile?.email || ''} disabled
                  style={{ background: '#F9FAFB', color: tokens.muted, cursor: 'not-allowed' }} />
              </FormGroup>
              <FormGroup label="Contact Number">
                <input className="input" value={form.contact} onChange={e => set('contact', e.target.value)} placeholder="e.g. 09XX XXX XXXX" />
              </FormGroup>
              <FormGroup label="Address">
                <textarea className="textarea" value={form.address} onChange={e => set('address', e.target.value)} placeholder="e.g. 123 Rizal St., Quezon City" style={{ minHeight: 80 }} />
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
                  ['Contact Number', savedContact       || 'Not set'],
                  ['Address',        savedAddress       || 'Not set'],
                  ['Role',           'Parent'],
                  ['Member Since',   profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
                    : '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                    <div className="text-xs text-muted uppercase font-bold mb-4" style={{ letterSpacing: '0.5px' }}>{k}</div>
                    <div className="font-semibold" style={{ fontSize: 13 }}>{v}</div>
                  </div>
                ))}
              </div>
              {(!savedContact || !savedAddress) && (
                <div style={{ padding: '12px 16px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, fontSize: 13, color: '#92400E', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span>⚠️</span>
                  <span>
                    Your profile is incomplete. Click <strong>Edit Profile</strong> to add your{' '}
                    {!savedContact && !savedAddress ? 'contact number and address' : !savedContact ? 'contact number' : 'address'}.
                  </span>
                </div>
              )}
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