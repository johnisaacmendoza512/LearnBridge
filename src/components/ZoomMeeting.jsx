import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Spinner from './ui/Spinner';
import tokens from '../lib/tokens';

const SUPABASE_URL      = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export default function ZoomMeeting({ booking, isTutor = false }) {
  const { user, profile } = useAuth();

  const [status,    setStatus]    = useState('idle');
  const [error,     setError]     = useState('');
  const [meetingId, setMeetingId] = useState(booking?.zoom_meeting_id || '');
  const [joinUrl,   setJoinUrl]   = useState('');
  const [hostUrl,   setHostUrl]   = useState('');
  const [creating,  setCreating]  = useState(false);

  useEffect(() => {
    if (booking?.zoom_meeting_id) {
      setMeetingId(booking.zoom_meeting_id);
      setStatus(booking.zoom_meeting_status === 'active' ? 'ready' : 'idle');
    }
    // Fetch join/host url from booking
    if (booking?.id) fetchMeetingDetails();
  }, [booking]);

  const fetchMeetingDetails = async () => {
    const { data } = await supabase
      .from('bookings')
      .select('zoom_meeting_id, zoom_meeting_password, zoom_join_url, zoom_host_url, zoom_meeting_status')
      .eq('id', booking.id)
      .single();
    if (data?.zoom_meeting_id) {
      setMeetingId(data.zoom_meeting_id);
      setJoinUrl(data.zoom_join_url || '');
      setHostUrl(data.zoom_host_url || '');
      setStatus(data.zoom_meeting_status === 'active' ? 'ready' : data.zoom_meeting_status === 'ended' ? 'ended' : 'idle');
    }
  };

  const createMeeting = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/zoom-create-meeting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          topic:    `LearnBridge — ${booking?.subject || 'Tutoring Session'}`,
          duration: 60,
        }),
      });
      const text = await res.text();
      const data = JSON.parse(text);
      if (!res.ok || data?.error) throw new Error(data?.error || text);

      // Save to bookings
      await supabase.from('bookings').update({
        zoom_meeting_id:       data.meetingId,
        zoom_meeting_password: data.password,
        zoom_join_url:         data.joinUrl,
        zoom_host_url:         data.hostUrl,
        zoom_meeting_status:   'active',
      }).eq('id', booking.id);

      setMeetingId(data.meetingId);
      setJoinUrl(data.joinUrl);
      setHostUrl(data.hostUrl);
      setStatus('ready');
    } catch(e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const endMeeting = async () => {
    await supabase.from('bookings')
      .update({ zoom_meeting_status: 'ended' })
      .eq('id', booking.id);
    setStatus('ended');
  };

  const hasMeeting = status === 'ready' && meetingId;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div className="card p-40" style={{textAlign:'center'}}>

        {/* Idle — no meeting yet */}
        {status === 'idle' && (
          <>
            <div style={{fontSize:56,marginBottom:16}}>🎥</div>
            <div className="font-jakarta font-extrabold mb-8" style={{fontSize:20}}>
              {isTutor ? 'Start a Video Meeting' : 'Join Video Meeting'}
            </div>
            <p className="text-sm text-muted mb-24" style={{lineHeight:1.7}}>
              {isTutor
                ? 'Create a Zoom meeting for this session. The student will be able to join directly from LearnBridge.'
                : 'No active meeting yet. Please wait for your tutor to start the meeting.'}
            </p>
            {isTutor && (
              <button className="btn btn-primary btn-lg" onClick={createMeeting} disabled={creating}>
                {creating ? <><Spinner size={16}/> Creating...</> : '🎥 Start Meeting'}
              </button>
            )}
            {!isTutor && (
              <div style={{padding:'16px 24px',borderRadius:12,background:'#FEF9C3',border:'1px solid #FDE68A',fontSize:13,color:'#92400E',fontWeight:600}}>
                ⏳ Waiting for your tutor to start the meeting...
              </div>
            )}
          </>
        )}

        {/* Ready — meeting is active */}
        {status === 'ready' && (
          <>
            <div style={{fontSize:56,marginBottom:16}}>✅</div>
            <div className="font-jakarta font-extrabold mb-8" style={{fontSize:20,color:'#065F46'}}>
              Meeting is Active
            </div>
            <p className="text-sm text-muted mb-8" style={{lineHeight:1.7}}>
              Meeting ID: <strong>{meetingId}</strong>
            </p>

            <div style={{display:'flex',flexDirection:'column',gap:10,maxWidth:320,margin:'16px auto 0'}}>
              {isTutor && hostUrl && (
                <a href={hostUrl} target="_blank" rel="noopener noreferrer"
                  className="btn btn-primary btn-lg" style={{textDecoration:'none',display:'block'}}>
                  🎥 Open as Host in Zoom
                </a>
              )}
              {!isTutor && joinUrl && (
                <a href={joinUrl} target="_blank" rel="noopener noreferrer"
                  className="btn btn-primary btn-lg" style={{textDecoration:'none',display:'block'}}>
                  📹 Join Meeting in Zoom
                </a>
              )}

              {/* Meeting info card */}
              <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:12,padding:'14px 20px',fontSize:13,color:'#1D4ED8',lineHeight:1.7,textAlign:'left',marginTop:8}}>
                <div style={{fontWeight:700,marginBottom:6}}>📋 Meeting Details</div>
                <div>Meeting ID: <strong>{meetingId}</strong></div>
                <div>Subject: <strong style={{textTransform:'capitalize'}}>{booking?.subject || '—'}</strong></div>
                <div>Status: <strong style={{color:'#065F46'}}>🟢 Active</strong></div>
              </div>

              {isTutor && (
                <button className="btn btn-danger" onClick={endMeeting} style={{marginTop:8}}>
                  📴 End Meeting
                </button>
              )}
            </div>
          </>
        )}

        {/* Ended */}
        {status === 'ended' && (
          <>
            <div style={{fontSize:56,marginBottom:16}}>📴</div>
            <div className="font-jakarta font-extrabold mb-8" style={{fontSize:20}}>Meeting Ended</div>
            <p className="text-sm text-muted mb-20">The video meeting has ended.</p>
            {isTutor && (
              <button className="btn btn-primary" onClick={createMeeting} disabled={creating}>
                {creating ? 'Creating...' : '🎥 Start New Meeting'}
              </button>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div style={{marginTop:16,padding:'12px 16px',borderRadius:10,background:'#FEE2E2',border:'1px solid #FECACA',fontSize:13,color:'#DC2626',wordBreak:'break-all'}}>
            ❌ {error}
            <button className="btn btn-sm" onClick={()=>setError('')} style={{marginLeft:8,fontSize:11}}>Dismiss</button>
          </div>
        )}
      </div>
    </div>
  );
}