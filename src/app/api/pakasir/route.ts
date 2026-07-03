import { NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const { action, data } = await request.json();
    const payload = typeof data === 'string' ? JSON.parse(data) : data;

    if (action === 'requestPakasirPayment') {
      const url = `https://${payload.slug}.pakasir.com/api/transaction/create`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': payload.apiKey
        },
        body: JSON.stringify({
          amount: payload.amount,
          order_id: payload.orderId,
          method: payload.method === 'qris' ? 'qris' : 'va'
        })
      });

      const responseText = await res.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { error: responseText };
      }

      return NextResponse.json(responseData, { headers: corsHeaders });
    } 
    else if (action === 'pollPakasirStatus') {
      const url = `https://${payload.slug}.pakasir.com/api/transaction/status/${payload.orderId}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': payload.apiKey
        }
      });
      const responseText = await res.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { error: responseText };
      }

      return NextResponse.json(responseData, { headers: corsHeaders });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: corsHeaders });
  } catch (error: any) {
    console.error("Pakasir API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
