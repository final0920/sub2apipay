'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { applyLocaleToSearchParams, pickLocaleText, resolveLocale } from '@/lib/locale';

function ResultContent() {
  const searchParams = useSearchParams();
  const outTradeNo = searchParams.get('out_trade_no') || searchParams.get('order_id');
  const isPopup = searchParams.get('popup') === '1';
  const theme = searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const locale = resolveLocale(searchParams.get('lang'));
  const isDark = theme === 'dark';

  const text = {
    checking: pickLocaleText(locale, '查询支付结果中...', 'Checking payment result...'),
    success: pickLocaleText(locale, '充值成功', 'Top-up successful'),
    processing: pickLocaleText(locale, '充值处理中', 'Top-up processing'),
    successMessage: pickLocaleText(locale, '余额已成功到账！', 'Balance has been credited successfully!'),
    processingMessage: pickLocaleText(locale, '支付成功，余额正在充值中...', 'Payment succeeded, balance is being credited...'),
    returning: pickLocaleText(locale, '正在返回...', 'Returning...'),
    returnNow: pickLocaleText(locale, '立即返回', 'Return now'),
    pending: pickLocaleText(locale, '等待支付', 'Awaiting payment'),
    pendingMessage: pickLocaleText(locale, '订单尚未完成支付', 'The order has not been paid yet'),
    expired: pickLocaleText(locale, '订单已超时', 'Order expired'),
    cancelled: pickLocaleText(locale, '订单已取消', 'Order cancelled'),
    abnormal: pickLocaleText(locale, '支付异常', 'Payment error'),
    expiredMessage: pickLocaleText(locale, '订单已超时，请重新充值', 'This order has expired. Please create a new one.'),
    cancelledMessage: pickLocaleText(locale, '订单已被取消', 'This order has been cancelled.'),
    abnormalMessage: pickLocaleText(locale, '请联系管理员处理', 'Please contact the administrator.'),
    back: pickLocaleText(locale, '返回', 'Back'),
    orderId: pickLocaleText(locale, '订单号', 'Order ID'),
    unknown: pickLocaleText(locale, '未知', 'Unknown'),
    loading: pickLocaleText(locale, '加载中...', 'Loading...'),
  };

  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInPopup, setIsInPopup] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (isPopup || window.opener) {
      setIsInPopup(true);
    }
  }, [isPopup]);

  useEffect(() => {
    if (!outTradeNo) {
      setLoading(false);
      return;
    }

    const checkOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${outTradeNo}`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };

    checkOrder();
    const timer = setInterval(checkOrder, 3000);
    const timeout = setTimeout(() => clearInterval(timer), 30000);
    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [outTradeNo]);

  const isSuccess = status === 'COMPLETED' || status === 'PAID' || status === 'RECHARGING';

  const goBack = () => {
    if (isInPopup) {
      window.close();
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    const params = new URLSearchParams();
    params.set('theme', theme);
    applyLocaleToSearchParams(params, locale);
    window.location.replace(`/pay?${params.toString()}`);
  };

  useEffect(() => {
    if (!isSuccess) return;
    setCountdown(5);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          goBack();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isSuccess, isInPopup]);

  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className={isDark ? 'text-slate-400' : 'text-gray-500'}>{text.checking}</div>
      </div>
    );
  }

  const isPending = status === 'PENDING';
  const countdownText = countdown > 0 ? pickLocaleText(locale, `${countdown} 秒后自动返回`, `${countdown} seconds before returning`) : text.returning;

  return (
    <div className={`flex min-h-screen items-center justify-center p-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div
        className={[
          'w-full max-w-md rounded-xl p-8 text-center shadow-lg',
          isDark ? 'bg-slate-900 text-slate-100' : 'bg-white',
        ].join(' ')}
      >
        {isSuccess ? (
          <>
            <div className="text-6xl text-green-500">✓</div>
            <h1 className="mt-4 text-xl font-bold text-green-600">{status === 'COMPLETED' ? text.success : text.processing}</h1>
            <p className={isDark ? 'mt-2 text-slate-400' : 'mt-2 text-gray-500'}>
              {status === 'COMPLETED' ? text.successMessage : text.processingMessage}
            </p>
            <div className="mt-4 space-y-2">
              <p className={isDark ? 'text-sm text-slate-500' : 'text-sm text-gray-400'}>{countdownText}</p>
              <button
                type="button"
                onClick={goBack}
                className="text-sm text-blue-600 underline hover:text-blue-700"
              >
                {text.returnNow}
              </button>
            </div>
          </>
        ) : isPending ? (
          <>
            <div className="text-6xl text-yellow-500">⏳</div>
            <h1 className="mt-4 text-xl font-bold text-yellow-600">{text.pending}</h1>
            <p className={isDark ? 'mt-2 text-slate-400' : 'mt-2 text-gray-500'}>{text.pendingMessage}</p>
            <button
              type="button"
              onClick={goBack}
              className="mt-4 text-sm text-blue-600 underline hover:text-blue-700"
            >
              {text.back}
            </button>
          </>
        ) : (
          <>
            <div className="text-6xl text-red-500">✗</div>
            <h1 className="mt-4 text-xl font-bold text-red-600">
              {status === 'EXPIRED' ? text.expired : status === 'CANCELLED' ? text.cancelled : text.abnormal}
            </h1>
            <p className={isDark ? 'mt-2 text-slate-400' : 'mt-2 text-gray-500'}>
              {status === 'EXPIRED'
                ? text.expiredMessage
                : status === 'CANCELLED'
                  ? text.cancelledMessage
                  : text.abnormalMessage}
            </p>
            <button
              type="button"
              onClick={goBack}
              className="mt-4 text-sm text-blue-600 underline hover:text-blue-700"
            >
              {text.back}
            </button>
          </>
        )}

        <p className={isDark ? 'mt-4 text-xs text-slate-500' : 'mt-4 text-xs text-gray-400'}>
          {text.orderId}: {outTradeNo || text.unknown}
        </p>
      </div>
    </div>
  );
}

function ResultPageFallback() {
  const searchParams = useSearchParams();
  const locale = resolveLocale(searchParams.get('lang'));

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-gray-500">{pickLocaleText(locale, '加载中...', 'Loading...')}</div>
    </div>
  );
}

export default function PayResultPage() {
  return (
    <Suspense fallback={<ResultPageFallback />}>
      <ResultContent />
    </Suspense>
  );
}
