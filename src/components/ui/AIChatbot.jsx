import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import tokens from '../../lib/tokens';

const SYSTEM_PROMPT = `You are LearnBot, a helpful AI assistant for LearnBridge — an online tutoring platform for Grade 2–6 Filipino learners specializing in English and Mathematics.

You help both parents and tutors navigate the platform. Here is what you know:

PLATFORM OVERVIEW:
- LearnBridge connects verified tutors with parents of Grade 2–6 students in the Philippines
- Subjects offered: English and Mathematics
- All tutors are verified (NBI Clearance, PRC License, Medical Certificate) and must pass an AI certification exam before tutoring

FOR PARENTS:
- Parents must first add their child's profile under "My Children"
- Children take a pre-assessment to identify their learning level
- Parents browse verified tutors in "Find Tutors" and send an inquiry
- After chatting with a tutor, parents can book an 8-session package
- Each booking = 8 sessions, 2 sessions/week, 1.5 hours each
- Payment is made directly to the tutor (cash, GCash, or bank transfer)
- LearnBridge deducts a 10% platform commission from the tutor's wallet
- After each session, the tutor marks it complete, then the parent confirms and rates the tutor (1–5 stars)

FOR TUTORS:
- Tutors must register, upload documents, and wait for admin approval
- After approval, tutors must pass the AI Certification Exam (75% passing score) before accessing the dashboard
- Tutors maintain a wallet balance to cover the 10% platform commission per booking
- Tutors must have enough wallet balance to cover the 10% commission before accepting a booking
- Tutors top up their wallet via GCash (send to 0968 709 5884 - Ronn Alexis Leonardo, then submit proof)
- Wallet top-ups are reviewed and approved by the admin within 24 hours
- After completing a session, the tutor marks it done and the parent confirms

BOOKING FLOW:
1. Parent inquires → Chat with tutor → Parent clicks "Book Now" → Selects subject (English, Math, or Both)
2. Tutor receives booking request → Checks wallet balance → Accepts or Rejects
3. Confirmed booking → Tutor conducts sessions → Marks complete → Parent confirms → Commission deducted

IMPORTANT RULES:
- Always be friendly, helpful, and concise
- If asked something outside LearnBridge, politely redirect
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
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
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
    setError('');

    try {
      const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
      if (!apiKey) throw new Error('OpenAI API key not configured. Add REACT_APP_OPENAI_API_KEY to your .env file.');

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
            // Send last 10 messages for context (avoid token bloat)
            ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            userMessage,
          ],
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error?.message || `API error ${response.status}`);
      }

      const data    = await response.json();
      const reply   = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(err.message);
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: '⚠️ Sorry, I encountered an error. Please try again in a moment.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const QUICK = profile?.role === 'tutor'
    ? ['How do I top up my wallet?', 'How does the commission work?', 'When do I get paid?']
    : ['How do I book a tutor?', 'How does the session work?', 'How do I rate my tutor?'];

  return (
    <>
      {/* ── Floating bubble ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position:     'fixed',
          bottom:        28,
          right:         28,
          width:         56,
          height:        56,
          borderRadius: '50%',
          background:   `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`,
          border:        'none',
          cursor:        'pointer',
          boxShadow:     '0 4px 20px rgba(0,0,0,.25)',
          display:       'flex',
          alignItems:    'center',
          justifyContent:'center',
          zIndex:        1500,
          transition:    'transform 0.2s',
          transform:     open ? 'scale(0.9)' : 'scale(1)',
        }}
        title="Chat with LearnBot"
      >
        {open ? (
          <span style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>×</span>
        ) : (
          <span style={{ fontSize: 26 }}>🤖</span>
        )}
      </button>

      {/* ── Chat window ── */}
      {open && (
        <div style={{
          position:     'fixed',
          bottom:        96,
          right:         28,
          width:         360,
          height:        520,
          background:    '#fff',
          borderRadius:  20,
          boxShadow:     '0 8px 40px rgba(0,0,0,.18)',
          display:       'flex',
          flexDirection: 'column',
          overflow:      'hidden',
          zIndex:        1499,
          animation:     'slideUp 0.25s ease',
        }}>

          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`,
            padding:    '14px 18px',
            display:    'flex',
            alignItems: 'center',
            gap:         12,
            flexShrink:  0,
          }}>
            <div style={{
              width:      38, height: 38, borderRadius: '50%',
              background: 'rgba(255,255,255,.2)',
              display:    'flex', alignItems: 'center', justifyContent: 'center',
              fontSize:   20,
            }}>🤖</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>LearnBot</div>
              <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 11 }}>
                AI Assistant · Always here to help
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#4ADE80',
                boxShadow: '0 0 0 2px rgba(74,222,128,.3)',
              }} />
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex:       1,
            overflowY:  'auto',
            padding:    '14px 14px 8px',
            display:    'flex',
            flexDirection: 'column',
            gap:        10,
          }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display:       'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                  alignItems:    'flex-end',
                  gap:            8,
                }}
              >
                {m.role === 'assistant' && (
                  <div style={{
                    width:      28, height: 28, borderRadius: '50%',
                    background: tokens.primaryLight, flexShrink: 0,
                    display:    'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize:   14,
                  }}>🤖</div>
                )}
                <div style={{
                  maxWidth:     '78%',
                  padding:      '9px 13px',
                  borderRadius:  m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background:    m.role === 'user'
                    ? `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`
                    : '#F3F4F6',
                  color:         m.role === 'user' ? '#fff' : tokens.dark,
                  fontSize:      13,
                  lineHeight:    1.55,
                  whiteSpace:    'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: tokens.primaryLight,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                }}>🤖</div>
                <div style={{
                  padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
                  background: '#F3F4F6', display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(d => (
                    <div key={d} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: tokens.muted,
                      animation: `bounce 1.2s ${d * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick replies — only when 1 message (first open) */}
          {messages.length === 1 && (
            <div style={{
              padding:    '4px 14px 8px',
              display:    'flex',
              flexWrap:   'wrap',
              gap:         6,
              flexShrink:  0,
            }}>
              {QUICK.map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); setTimeout(sendMessage, 50); }}
                  style={{
                    padding:       '5px 10px',
                    borderRadius:   20,
                    border:        `1px solid ${tokens.primary}`,
                    background:     tokens.primaryLight,
                    color:          tokens.primary,
                    fontSize:       11,
                    fontWeight:     600,
                    cursor:         'pointer',
                    transition:    'all 0.15s',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding:    '10px 14px',
            borderTop:  `1px solid ${tokens.border}`,
            display:    'flex',
            gap:         8,
            flexShrink:  0,
            background:  '#FAFAFA',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask me anything..."
              disabled={loading}
              style={{
                flex:         1,
                padding:      '9px 14px',
                borderRadius:  20,
                border:       `1.5px solid ${tokens.border}`,
                fontSize:      13,
                outline:       'none',
                background:    '#fff',
                color:         tokens.dark,
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                width:        38, height: 38,
                borderRadius: '50%',
                background:   !input.trim() || loading ? '#E5E7EB' : `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`,
                border:       'none',
                cursor:       !input.trim() || loading ? 'not-allowed' : 'pointer',
                display:      'flex',
                alignItems:   'center',
                justifyContent:'center',
                flexShrink:    0,
                transition:   'all 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke={!input.trim() || loading ? '#9CA3AF' : '#fff'} strokeWidth="2" strokeLinecap="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={!input.trim() || loading ? '#9CA3AF' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-4px); }
        }
      `}</style>
    </>
  );
}