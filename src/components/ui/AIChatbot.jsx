import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const SYSTEM_PROMPT = `You are LearnBot, a helpful AI assistant for LearnBridge — an online tutoring platform for Grade 2–6 Filipino learners specializing in English and Mathematics.

You help both parents and tutors navigate the platform. Here is what you know:

PLATFORM OVERVIEW:
- LearnBridge connects verified tutors with parents of Grade 2–6 students in the Philippines
- Subjects offered: English and Mathematics
- All tutors are verified (NBI Clearance, PRC License, Medical Certificate, Application Form) and must pass an AI certification exam before tutoring

FOR PARENTS:
- Parents must first add their child's profile under "My Children"
- Parents browse verified tutors in "Find Tutors" and send an inquiry
- After chatting with a tutor, parents can book an 8-session package
- Each booking = 8 sessions, 2 sessions/week, 1.5 hours each
- Payment is made directly to the tutor
- LearnBridge deducts a 10% platform commission from the tutor's wallet
- After each session, the tutor marks it complete, then the parent confirms and rates the tutor (1–5 stars)

FOR TUTORS:
- Tutors must register, upload documents, take the AI Certification Exam, and wait for admin approval
- Tutors maintain a wallet balance to cover the 10% platform commission per booking
- Tutors top up their wallet via GCash (send to 0968 709 5884 - Ronn Alexis Leonardo, then submit proof)
- Wallet top-ups are reviewed and approved by the admin within 24 hours

BOOKING FLOW:
1. Parent inquires → Chat with tutor → Parent clicks "Book Now" → Selects subject
2. Tutor receives booking request → Checks wallet balance → Accepts or Rejects
3. Confirmed booking → Tutor conducts sessions → Marks complete → Parent confirms → Commission deducted

IMPORTANT RULES:
- Always be friendly, helpful, and concise
- Respond in English
- Keep answers short — 2 to 4 sentences max unless a list is needed
- If unsure, say "Please contact our admin team for more details"`;

export default function AIChatbot() {
  const { profile } = useAuth();
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([
    {
      role:    'assistant',
      content: `Hi ${profile?.full_name?.split(' ')[0] || 'there'}! 👋 I'm LearnBot, your LearnBridge assistant. How can I help you today?`,
    },
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      inputRef.current?.focus();
    }
  }, [open, messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
      if (!apiKey) throw new Error('OpenAI API key not configured.');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model:       'gpt-4o-mini',
          max_tokens:  300,
          temperature: 0.7,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            userMessage,
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `API error ${response.status}`);
      }

      const data  = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: '⚠️ Sorry, I encountered an error. Please try again in a moment.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const QUICK = profile?.role === 'tutor'
    ? ['How do I top up my wallet?', 'How does commission work?', 'How do I accept bookings?']
    : ['How do I book a tutor?', 'How does a session work?', 'How do I rate my tutor?'];

  return (
    <>
      {/* ── Floating bubble ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Chat with LearnBot"
        style={{
          position:       'fixed',
          bottom:          90,
          right:           28,
          width:           60,
          height:          60,
          borderRadius:   '50%',
          border:          'none',
          cursor:          'pointer',
          background:     'linear-gradient(135deg, #4F46E5, #7C3AED)',
          boxShadow:       open
            ? '0 4px 20px rgba(79,70,229,.5)'
            : '0 4px 24px rgba(79,70,229,.45)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          zIndex:          1500,
          transition:     'all 0.3s cubic-bezier(.34,1.56,.64,1)',
          transform:       open ? 'scale(0.9) rotate(10deg)' : 'scale(1) rotate(0deg)',
          padding:         0,
          overflow:        'hidden',
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.transform = 'scale(1.12) translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(79,70,229,.6)';
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
            e.currentTarget.style.boxShadow = '0 4px 24px rgba(79,70,229,.45)';
          }
        }}
      >
        {/* Pulse ring */}
        {!open && (
          <div style={{
            position:     'absolute',
            inset:         0,
            borderRadius: '50%',
            background:   'rgba(79,70,229,.3)',
            animation:    'pulse-ring 2s ease-out infinite',
            pointerEvents:'none',
          }} />
        )}
        {open ? (
          <span style={{ color: '#fff', fontSize: 22, fontWeight: 700, position: 'relative', zIndex: 1 }}>×</span>
        ) : (
          <span style={{ fontSize: 26, position: 'relative', zIndex: 1 }}>🤖</span>
        )}
      </button>

      {/* ── Chat window ── */}
      {open && (
        <div style={{
          position:      'fixed',
          bottom:         160,
          right:          28,
          width:          360,
          height:         520,
          maxHeight:     'calc(100vh - 140px)',
          background:    '#fff',
          borderRadius:   20,
          boxShadow:     '0 12px 48px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08)',
          display:       'flex',
          flexDirection: 'column',
          overflow:       'hidden',
          zIndex:         1499,
          animation:     'slideUp 0.3s cubic-bezier(.34,1.56,.64,1)',
          border:        '1px solid rgba(79,70,229,.12)',
          ...(window.innerWidth < 480 ? {
            right:  8,
            left:   8,
            width: 'auto',
            bottom: 88,
          } : {}),
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
            padding:    '16px 18px',
            display:    'flex',
            alignItems: 'center',
            gap:         12,
            flexShrink:  0,
            position:   'relative',
            overflow:   'hidden',
          }}>
            <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,.06)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', bottom:-30, left:60, width:60, height:60, borderRadius:'50%', background:'rgba(255,255,255,.05)', pointerEvents:'none' }} />
            <div style={{
              width:42, height:42, borderRadius:12,
              background:'rgba(255,255,255,.15)',
              backdropFilter:'blur(8px)',
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0,
              border:'1px solid rgba(255,255,255,.2)',
              fontSize: 22,
            }}>🤖</div>
            <div style={{ flex:1 }}>
              <div style={{ color:'#fff', fontWeight:800, fontSize:15, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>LearnBot</div>
              <div style={{ color:'rgba(255,255,255,.75)', fontSize:11, marginTop:2, display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ADE80', display:'inline-block', boxShadow:'0 0 0 2px rgba(74,222,128,.3)' }} />
                AI Assistant · Always here to help
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background:'rgba(255,255,255,.15)', border:'none', width:28, height:28, borderRadius:8, cursor:'pointer', color:'#fff', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
            >✕</button>
          </div>

          {/* Messages */}
          <div style={{
            flex:1, overflowY:'auto', padding:'16px 14px 8px',
            display:'flex', flexDirection:'column', gap:10, background:'#F8F9FF',
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display:'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                alignItems:'flex-end', gap:8,
              }}>
                {m.role === 'assistant' && (
                  <div style={{
                    width:28, height:28, borderRadius:8, flexShrink:0,
                    background:'linear-gradient(135deg, #4F46E5, #7C3AED)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 2px 8px rgba(79,70,229,.25)', fontSize:14,
                  }}>🤖</div>
                )}
                <div style={{
                  maxWidth:'78%',
                  padding:'10px 14px',
                  borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg, #4F46E5, #7C3AED)'
                    : '#fff',
                  color: m.role === 'user' ? '#fff' : '#1F2937',
                  fontSize:13.5, lineHeight:1.6, whiteSpace:'pre-wrap',
                  boxShadow: m.role === 'user'
                    ? '0 2px 12px rgba(79,70,229,.3)'
                    : '0 1px 4px rgba(0,0,0,.08)',
                  border: m.role === 'assistant' ? '1px solid rgba(79,70,229,.08)' : 'none',
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
                <div style={{
                  width:28, height:28, borderRadius:8,
                  background:'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 2px 8px rgba(79,70,229,.25)', fontSize:14,
                }}>🤖</div>
                <div style={{
                  padding:'12px 16px', borderRadius:'18px 18px 18px 4px',
                  background:'#fff', display:'flex', gap:5, alignItems:'center',
                  boxShadow:'0 1px 4px rgba(0,0,0,.08)',
                  border:'1px solid rgba(79,70,229,.08)',
                }}>
                  {[0,1,2].map(d => (
                    <div key={d} style={{
                      width:7, height:7, borderRadius:'50%', background:'#7C3AED',
                      animation:`bounce 1.2s ${d * 0.2}s infinite`, opacity:0.6,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          {messages.length === 1 && (
            <div style={{ padding:'6px 14px 8px', display:'flex', flexWrap:'wrap', gap:6, flexShrink:0, background:'#F8F9FF' }}>
              {QUICK.map(q => (
                <button
                  key={q}
                  onClick={() => {
                    const userMsg = { role: 'user', content: q };
                    setMessages(prev => [...prev, userMsg]);
                    setLoading(true);
                    fetch('https://api.openai.com/v1/chat/completions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}` },
                      body: JSON.stringify({
                        model: 'gpt-4o-mini', max_tokens: 300, temperature: 0.7,
                        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: q }],
                      }),
                    })
                      .then(r => r.json())
                      .then(data => {
                        const reply = data.choices?.[0]?.message?.content || 'Sorry, try again.';
                        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
                      })
                      .catch(() => setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Error. Please try again.' }]))
                      .finally(() => setLoading(false));
                  }}
                  style={{
                    padding:'5px 12px', borderRadius:20,
                    border:'1.5px solid rgba(79,70,229,.3)',
                    background:'rgba(79,70,229,.06)', color:'#4F46E5',
                    fontSize:11.5, fontWeight:600, cursor:'pointer',
                    transition:'all 0.15s', whiteSpace:'nowrap',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding:'10px 12px', borderTop:'1px solid rgba(79,70,229,.1)',
            display:'flex', gap:8, flexShrink:0, background:'#fff', alignItems:'center',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask me anything..."
              disabled={loading}
              style={{
                flex:1, padding:'10px 16px', borderRadius:24,
                border:'1.5px solid rgba(79,70,229,.2)',
                fontSize:13, outline:'none', background:'#F8F9FF', color:'#1F2937',
                transition:'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(79,70,229,.5)'}
              onBlur={e  => e.target.style.borderColor = 'rgba(79,70,229,.2)'}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                width:38, height:38, borderRadius:'50%', border:'none',
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                background: !input.trim() || loading
                  ? '#E5E7EB'
                  : 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                display:'flex', alignItems:'center', justifyContent:'center',
                flexShrink:0, transition:'all 0.2s',
                boxShadow: !input.trim() || loading ? 'none' : '0 2px 8px rgba(79,70,229,.4)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke={!input.trim() || loading ? '#9CA3AF' : '#fff'} strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={!input.trim() || loading ? '#9CA3AF' : '#fff'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Footer */}
          <div style={{ padding:'6px 14px 10px', textAlign:'center', background:'#fff', flexShrink:0 }}>
            <span style={{ fontSize:10, color:'#9CA3AF' }}>Powered by LearnBridge AI · Press Enter to send</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50%       { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </>
  );
}