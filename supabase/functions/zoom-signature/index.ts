const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { meetingNumber, role } = await req.json();
    const sdkKey    = Deno.env.get('ZOOM_SDK_KEY') ?? '';
    const sdkSecret = Deno.env.get('ZOOM_SDK_SECRET') ?? '';

    const iat = Math.round(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2;

    // Build the message to sign
    const msg = `${sdkKey}${meetingNumber}${iat}${exp}${role}`;

    // HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(sdkSecret);
    const msgData = encoder.encode(msg);

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );

    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const sigArray  = Array.from(new Uint8Array(sigBuffer));
    const sigBase64 = btoa(String.fromCharCode(...sigArray));

    // Build signature token
    const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sdkKey,
      mn:       String(meetingNumber),
      role:     Number(role),
      iat,
      exp,
      appKey:   sdkKey,
      tokenExp: exp,
    }));

    const signature = `${header}.${payload}.${sigBase64}`;

    return new Response(
      JSON.stringify({ signature, sdkKey }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});