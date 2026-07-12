const EDGE_FUNCTION_URL = 'https://wkllrijkyqxlrwldvgmg.supabase.co/functions/v1/paymongo-topup';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const PAYMONGO_BASE     = 'https://api.paymongo.com/v1';
const SECRET_KEY        = process.env.REACT_APP_PAYMONGO_SECRET_KEY;

function authHeader() {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Basic ${btoa(SECRET_KEY + ':')}`,
  };
}

// Creates a top up payment link via Edge Function (avoids CORS)
export async function createTopUpLink({ amount, userId }) {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ amount, userId, type: 'topup' }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `Request failed ${response.status}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);

  return {
    linkId:      data.linkId,
    checkoutUrl: data.checkoutUrl,
  };
}

// Check payment link status directly (read-only, less strict CORS)
export async function getPaymentLinkStatus(linkId) {
  const response = await fetch(`${PAYMONGO_BASE}/links/${linkId}`, {
    method:  'GET',
    headers: authHeader(),
  });

  if (!response.ok) throw new Error(`PayMongo fetch error ${response.status}`);

  const data  = await response.json();
  const attrs = data?.data?.attributes;
  return {
    status: attrs?.status,
    paid:   attrs?.status === 'paid',
    amount: (attrs?.amount || 0) / 100,
  };
}

// Aliases
export const createPaymentLink = createTopUpLink;
export const getPaymentLink    = getPaymentLinkStatus;