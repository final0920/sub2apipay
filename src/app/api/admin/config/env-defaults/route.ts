import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, unauthorizedResponse } from '@/lib/admin-auth';
import { getEnv } from '@/lib/config';
import { initPaymentProviders, paymentRegistry } from '@/lib/payment';

export async function GET(request: NextRequest) {
  if (!(await verifyAdminToken(request))) return unauthorizedResponse(request);

  try {
    const env = getEnv();
    initPaymentProviders();
    const supportedTypes = paymentRegistry.getSupportedTypes();

    return NextResponse.json({
      defaults: {
        ENABLED_PAYMENT_TYPES: supportedTypes.join(','),
        RECHARGE_MIN_AMOUNT: String(env.MIN_RECHARGE_AMOUNT),
        RECHARGE_MAX_AMOUNT: String(env.MAX_RECHARGE_AMOUNT),
        DAILY_RECHARGE_LIMIT: String(env.MAX_DAILY_RECHARGE_AMOUNT),
        ORDER_TIMEOUT_MINUTES: String(env.ORDER_TIMEOUT_MINUTES),
      },
    });
  } catch (error) {
    console.error('Failed to get env defaults:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Failed to get env defaults' }, { status: 500 });
  }
}
