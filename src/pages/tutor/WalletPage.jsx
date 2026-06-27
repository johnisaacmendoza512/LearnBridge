import { useState } from 'react';
import { useWallet } from '../../hooks/useWallet';
import FormGroup from '../../components/ui/FormGroup';
import Icon from '../../components/ui/Icon';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import AppDialog from '../../components/ui/AppDialog';
import tokens from '../../lib/tokens';

const GCASH_INFO = {
  number: '0968 709 5884',
  name:   'Ronn Alexis Leonardo',
};

const TOP_UP_AMOUNTS = [100, 200, 500, 1000];

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: '#CA8A04', bg: '#FEF9C3' },
  approved: { label: 'Approved', color: '#16A34A', bg: '#D1FAE5' },
  rejected: { label: 'Rejected', color: '#DC2626', bg: '#FEE2E2' },
};

export default function WalletPage() {
  const { balance, transactions, topups, loading, submitTopupRequest } = useWallet();

  const [showTopup,   setShowTopup]   = useState(false);
  const [dialog,      setDialog]      = useState(null);
  const [activeTab,   setActiveTab]   = useState('history'); // history | requests
  const [step,        setStep]        = useState(1); // 1=select amount, 2=submit proof
  const [amount,      setAmount]      = useState('');
  const [refNumber,   setRefNumber]   = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  const resetModal = () => {
    setShowTopup(false); setStep(1);
    setAmount(''); setRefNumber('');
    setReceiptFile(null); setError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const allowed = ['image/jpeg','image/png','image/jpg','application/pdf'];
    if (!allowed.includes(file.type)) { setError('Please upload a JPG, PNG, or PDF file.'); return; }
    if (file.size > 5 * 1024 * 1024)  { setError('File must be under 5MB.'); return; }
    setError('');
    setReceiptFile(file);
  };

  const handleSubmit = async () => {
    if (!amount)      { setError('Please select a top-up amount.'); return; }
    if (!refNumber.trim()) { setError('Please enter the GCash reference number.'); return; }
    if (!receiptFile)  { setError('Please upload your GCash receipt screenshot.'); return; }
    setError(''); setSubmitting(true);
    try {
      await submitTopupRequest({ amount, referenceNumber: refNumber, receiptFile });
      resetModal();
      setDialog({
        type: 'success',
        title: 'Request Submitted!',
        message: 'Your top-up request has been submitted successfully.\nThe admin will review and approve within 24 hours.\n\nTrack your request in the Top-Up Requests tab.',
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = topups.filter(t => t.status === 'pending').length;

  if (loading) return <Spinner dark size={32} />;

  return (
    <div className="fade-in">
      <div className="mb-24">
        <h2 className="font-jakarta font-extrabold" style={{ fontSize: 22 }}>Wallet & Commission</h2>
        <p className="text-sm text-muted mt-4">
          Maintain your prepaid balance to cover the 10% platform commission per booking.
        </p>
      </div>

      {/* Wallet Balance Card */}
      <div style={{
        background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`,
        borderRadius: 20, padding: 32, color: '#fff',
        marginBottom: 24, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -20, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />
        <div style={{ opacity: .8, fontSize: 13, marginBottom: 8 }}>Available Balance</div>
        <div className="font-jakarta font-black" style={{ fontSize: 52, marginBottom: 4 }}>
          ₱{Number(balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
        </div>
        <div style={{ opacity: .7, fontSize: 13, marginBottom: 24 }}>
          10% commission is auto-deducted after each completed session
        </div>
        {balance <= 0 && (
          <div style={{
            background: 'rgba(255,255,255,.15)', borderRadius: 10,
            padding: '8px 14px', marginBottom: 16, fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ⚠️ Your wallet is empty — top up to accept bookings
          </div>
        )}
        <button
          className="btn"
          onClick={() => setShowTopup(true)}
          style={{ background: '#fff', color: tokens.primary, fontWeight: 700 }}
        >
          <Icon name="plus" size={14} color={tokens.primary} /> Top Up Wallet
        </button>
        {pendingCount > 0 && (
          <span style={{
            marginLeft: 12, fontSize: 12, fontWeight: 700,
            background: '#FEF9C3', color: '#92400E',
            padding: '4px 10px', borderRadius: 20,
          }}>
            {pendingCount} request{pendingCount > 1 ? 's' : ''} pending
          </span>
        )}
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Top-Ups',    value: `₱${topups.filter(t => t.status === 'approved').reduce((s, t) => s + Number(t.amount), 0).toLocaleString()}`, icon: 'upload',  accent: tokens.success },
          { label: 'Commission Paid',  value: `₱${transactions.filter(t => t.type === 'commission_deduction').reduce((s, t) => s + Math.abs(Number(t.amount)), 0).toLocaleString()}`, icon: 'percent', accent: tokens.secondary },
          { label: 'Min. to Accept', value: '10%', icon: 'shield', accent: tokens.primary, sub: 'of booking total required' },
        ].map((c, i) => (
          <div key={i} className="card p-20">
            <div style={{ width: 36, height: 36, borderRadius: 10, background: c.accent + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Icon name={c.icon} size={16} color={c.accent} />
            </div>
            <div className="font-jakarta font-extrabold" style={{ fontSize: 22, color: c.accent }}>{c.value}</div>
            <div className="text-xs text-muted mt-4">{c.label}</div>
            {c.sub && <div className="text-xs text-muted">{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-8 mb-16">
        {[['history', 'Transaction History'], ['requests', `Top-Up Requests${pendingCount > 0 ? ` (${pendingCount})` : ''}`]].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} className="btn btn-sm" style={{
            background: activeTab === key ? tokens.primary : '#fff',
            color:      activeTab === key ? '#fff' : tokens.mid,
            border:     `1.5px solid ${activeTab === key ? tokens.primary : tokens.border}`,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Transaction History */}
      {activeTab === 'history' && (
        <div className="card">
          {transactions.length === 0 ? (
            <EmptyState icon="💳" title="No transactions yet" description="Your wallet activity will appear here." />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance After</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={t.id || i}>
                    <td style={{ fontSize: 12, color: tokens.muted }}>
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <div>{t.description}</div>
                      {t.type === 'commission_deduction' && t.amount && (
                        <div style={{ fontSize: 11, color: tokens.muted, marginTop: 2 }}>
                          Deducted: ₱{Math.abs(Number(t.amount)).toFixed(2)} (10% commission)
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: t.type === 'topup' ? '#D1FAE5' : '#FEE2E2',
                        color:      t.type === 'topup' ? '#065F46' : '#DC2626',
                      }}>
                        {t.type === 'topup' ? 'Top-Up' : 'Commission'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: 14, color: Number(t.amount) > 0 ? tokens.success : tokens.danger }}>
                        {Number(t.amount) > 0 ? '+' : ''}₱{Math.abs(Number(t.amount)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {t.balance_after != null ? `₱${Number(t.balance_after).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Top-Up Requests */}
      {activeTab === 'requests' && (
        <div className="card">
          {topups.length === 0 ? (
            <EmptyState icon="📋" title="No top-up requests yet" description="Submit a GCash top-up request and it will appear here." />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Reference #</th>
                  <th>Status</th>
                  <th>Admin Notes</th>
                </tr>
              </thead>
              <tbody>
                {topups.map((t, i) => {
                  const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending;
                  return (
                    <tr key={t.id || i}>
                      <td style={{ fontSize: 12, color: tokens.muted }}>
                        {new Date(t.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="font-semibold" style={{ fontSize: 14, color: tokens.success }}>
                        +₱{Number(t.amount).toLocaleString()}
                      </td>
                      <td style={{ fontSize: 12, fontFamily: 'monospace', color: tokens.mid }}>{t.reference_number}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: sc.bg, color: sc.color }}>
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: tokens.muted }}>{t.admin_notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TOP-UP MODAL ── */}
      {showTopup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: '#fff', borderRadius: 20,
            width: '100%', maxWidth: 520,
            maxHeight: '92vh', overflowY: 'auto', padding: 36,
          }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-24">
              <h3 className="font-jakarta font-bold" style={{ fontSize: 20 }}>Top Up Wallet</h3>
              <button onClick={resetModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: tokens.muted }}>×</button>
            </div>

            {/* Current balance */}
            <div style={{
              background: tokens.primaryLight, border: `1px solid ${tokens.primary}30`,
              borderRadius: 12, padding: '12px 16px', marginBottom: 20,
              fontSize: 13, color: tokens.primary,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Current Balance</span>
              <span className="font-jakarta font-extrabold" style={{ fontSize: 18 }}>
                ₱{Number(balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {step === 1 && (
              <>
                {/* Amount selection */}
                <div style={{ marginBottom: 20 }}>
                  <label className="form-label">Select Top-Up Amount</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    {TOP_UP_AMOUNTS.map(v => (
                      <button
                        key={v}
                        onClick={() => setAmount(String(v))}
                        style={{
                          padding: '14px', borderRadius: 12, cursor: 'pointer',
                          border: `2px solid ${amount === String(v) ? tokens.primary : tokens.border}`,
                          background: amount === String(v) ? tokens.primaryLight : '#FAFAFA',
                          color: amount === String(v) ? tokens.primary : tokens.dark,
                          fontWeight: 700, fontSize: 16,
                          transition: 'all 0.15s',
                        }}
                      >
                        ₱{v.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <input
                    className="input"
                    type="number"
                    placeholder="Or enter custom amount"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                </div>

                {/* GCash info */}
                <div style={{
                  border: `1.5px solid #16A34A40`, borderRadius: 14,
                  overflow: 'hidden', marginBottom: 20,
                }}>
                  <div style={{ background: '#16A34A', padding: '10px 16px' }}>
                    <div className="font-semibold" style={{ color: '#fff', fontSize: 14 }}>
                      📱 Send via GCash
                    </div>
                  </div>
                  <div style={{ padding: 20, background: '#F0FDF4' }}>
                    {/* GCash QR Code */}
                    <img
                      src={require('../../assets/QR.png')}
                      alt="GCash QR Code"
                      style={{
                        width: 190, height: 'auto', borderRadius: 12,
                        margin: '0 auto 16px', display: 'block',
                        boxShadow: '0 2px 12px rgba(0,0,0,.10)',
                      }}
                    />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 13, color: tokens.mid, marginBottom: 4 }}>GCash Number</div>
                      <div className="font-jakarta font-extrabold" style={{ fontSize: 20, color: '#16A34A', letterSpacing: '1px' }}>
                        {GCASH_INFO.number}
                      </div>
                      <div className="font-semibold" style={{ fontSize: 14, color: tokens.dark, marginTop: 6 }}>
                        {GCASH_INFO.name}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{
                  background: '#FFF7ED', border: '1px solid #FED7AA',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 20,
                  fontSize: 12, color: '#92400E',
                  display: 'flex', gap: 8,
                }}>
                  <Icon name="alertCircle" size={14} color="#92400E" />
                  <span>Send exactly <strong>₱{amount ? Number(amount).toLocaleString() : '___'}</strong> to the GCash number above. Keep your reference number — you'll need it in the next step.</span>
                </div>

                <div className="flex gap-10">
                  <button className="btn btn-ghost btn-full" onClick={resetModal}>Cancel</button>
                  <button
                    className="btn btn-primary btn-full btn-lg"
                    onClick={() => { if (!amount) { setError('Please select an amount.'); return; } setError(''); setStep(2); }}
                    disabled={!amount}
                  >
                    I've Sent the Payment →
                  </button>
                </div>
                {error && <p style={{ color: tokens.danger, fontSize: 13, marginTop: 10, textAlign: 'center' }}>{error}</p>}
              </>
            )}

            {step === 2 && (
              <>
                {/* Summary */}
                <div style={{
                  background: '#D1FAE5', border: '1px solid #6EE7B7',
                  borderRadius: 12, padding: 16, marginBottom: 20,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, color: '#065F46' }}>Amount to be credited</span>
                  <span className="font-jakarta font-extrabold" style={{ fontSize: 22, color: '#065F46' }}>
                    ₱{Number(amount).toLocaleString()}
                  </span>
                </div>

                {error && (
                  <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
                    ❌ {error}
                  </div>
                )}

                <FormGroup label="GCash Reference Number" hint="Found at the top of your GCash transaction receipt.">
                  <input
                    className="input"
                    placeholder="e.g. 1234567890"
                    value={refNumber}
                    onChange={e => setRefNumber(e.target.value)}
                    maxLength={30}
                  />
                </FormGroup>

                <FormGroup label="Upload GCash Receipt Screenshot" hint="JPG, PNG, or PDF · Max 5MB">
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 18px', borderRadius: 12, cursor: 'pointer',
                    border: `2px dashed ${receiptFile ? tokens.success : tokens.border}`,
                    background: receiptFile ? '#F0FDF4' : '#FAFAFA',
                    transition: 'all 0.15s',
                  }}>
                    <input type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" style={{ display: 'none' }} onChange={handleFileChange} />
                    <div style={{ fontSize: 28 }}>{receiptFile ? '✅' : '📤'}</div>
                    <div>
                      <div className="font-semibold" style={{ fontSize: 13, color: receiptFile ? '#065F46' : tokens.dark }}>
                        {receiptFile ? receiptFile.name : 'Click to upload receipt'}
                      </div>
                      <div className="text-xs text-muted">
                        {receiptFile
                          ? `${(receiptFile.size / 1024).toFixed(0)} KB`
                          : 'Screenshot of your GCash transaction confirmation'}
                      </div>
                    </div>
                  </label>
                </FormGroup>

                <div style={{
                  background: tokens.primaryLight, border: `1px solid ${tokens.primary}30`,
                  borderRadius: 10, padding: '10px 14px', marginBottom: 20,
                  fontSize: 12, color: tokens.primary,
                }}>
                  ℹ️ Your wallet will be credited within 24 hours after admin verification.
                </div>

                <div className="flex gap-10">
                  <button className="btn btn-ghost btn-full" onClick={() => { setStep(1); setError(''); }}>← Back</button>
                  <button
                    className="btn btn-primary btn-full btn-lg"
                    onClick={handleSubmit}
                    disabled={submitting || !refNumber.trim() || !receiptFile}
                  >
                    {submitting ? <><Spinner /> Submitting...</> : <><Icon name="send" size={14} /> Submit Request</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <AppDialog
        open={!!dialog}
        type={dialog?.type}
        title={dialog?.title}
        message={dialog?.message}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}