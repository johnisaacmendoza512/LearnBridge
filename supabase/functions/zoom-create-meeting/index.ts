const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  // Handle preflight IMMEDIATELY - before anything else
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const accountId    = Deno.env.get('ZOOM_ACCOUNT_ID') ?? '';
    const clientId     = Deno.env.get('ZOOM_CLIENT_ID') ?? '';
    const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET') ?? '';

    const credentials = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Basic ${credentials}` },
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return new Response(
        JSON.stringify({ error: `Token failed: ${JSON.stringify(tokenData)}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const meetingRes = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'LearnBridge Tutoring Session',
        type: 1,
        duration: 60,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          waiting_room: false,
        },
      }),
    });

    const meetingData = await meetingRes.json();

    if (!meetingRes.ok) {
      return new Response(
        JSON.stringify({ error: `Meeting failed: ${JSON.stringify(meetingData)}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        meetingId: String(meetingData.id),
        password:  meetingData.password || '',
        joinUrl:   meetingData.join_url,
        hostUrl:   meetingData.start_url,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});