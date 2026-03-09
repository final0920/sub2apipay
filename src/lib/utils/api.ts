import { NextRequest, NextResponse } from 'next/server';
import { OrderError } from '@/lib/order/service';
import { resolveLocale } from '@/lib/locale';

/** 统一处理 OrderError 和未知错误 */
export function handleApiError(error: unknown, fallbackMessage: string, request?: NextRequest): NextResponse {
  if (error instanceof OrderError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
  }
  const locale = resolveLocale(request?.nextUrl.searchParams.get('lang'));
  const resolvedFallback = locale === 'en' ? translateFallbackMessage(fallbackMessage) : fallbackMessage;
  console.error(`${resolvedFallback}:`, error);
  return NextResponse.json({ error: resolvedFallback }, { status: 500 });
}

function translateFallbackMessage(message: string): string {
  switch (message) {
    case '退款失败':
      return 'Refund failed';
    case '重试充值失败':
      return 'Recharge retry failed';
    case '取消订单失败':
      return 'Cancel order failed';
    case '获取用户信息失败':
      return 'Failed to fetch user info';
    default:
      return message;
  }
}

/** 从 NextRequest 提取 headers 为普通对象 */
export function extractHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}
