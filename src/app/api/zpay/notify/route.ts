import { NextRequest } from 'next/server';
import { handlePaymentNotify } from '@/lib/order/service';
import type { EasyPayNotifyParams } from '@/lib/easy-pay/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const params: EasyPayNotifyParams = {
      pid: searchParams.get('pid') || '',
      name: searchParams.get('name') || '',
      money: searchParams.get('money') || '',
      out_trade_no: searchParams.get('out_trade_no') || '',
      trade_no: searchParams.get('trade_no') || '',
      param: searchParams.get('param') || '',
      trade_status: searchParams.get('trade_status') || '',
      type: searchParams.get('type') || '',
      sign: searchParams.get('sign') || '',
      sign_type: searchParams.get('sign_type') || '',
    };

    const success = await handlePaymentNotify(params);

    // ZPAY requires plain text response
    return new Response(success ? 'success' : 'fail', {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('ZPAY notify error:', error);
    return new Response('fail', {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
