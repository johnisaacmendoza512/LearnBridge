import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const PAYMONGO_SECRET = Deno.env.get('PAYMONGO_SECRET_KEY') ?? '';
const SITE_URL        = 'https://learnbridge.site';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { amount, userId, type } = await req.json();

    if (!amount || amount < 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create PayMongo payment link
    const response = await fetch('https://api.paymongo.com/v1/links', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${btoa(PAYMONGO_SECRET + ':')}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount:      Math.round(amount * 100), // centavos
            currency:    'PHP',
            description: 'LearnBridge Wallet Top Up',
            remarks:     `topup:${userId}`,
          },
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err?.errors?.[0]?.detail || 'PayMongo error');
    }

    const data        = await response.json();
    const linkId      = data?.data?.id;
    const checkoutUrl = data?.data?.attributes?.checkout_url;

    return new Response(
      JSON.stringify({ linkId, checkoutUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});