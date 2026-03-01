'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense, useMemo } from 'react';
import PaymentForm from '@/components/PaymentForm';
import PaymentQRCode from '@/components/PaymentQRCode';
import OrderStatus from '@/components/OrderStatus';

interface OrderResult {
  orderId: string;
  amount: number;
  status: string;
  paymentType: 'alipay' | 'wxpay';
  payUrl?: string | null;
  qrCode?: string | null;
  expiresAt: string;
}

interface UserInfo {
  id?: number;
  username: string;
  balance: number;
}

interface MyOrder {
  id: string;
  amount: number;
  status: string;
  paymentType: string;
  createdAt: string;
}

interface AppConfig {
  enabledPaymentTypes: string[];
  minAmount: number;
  maxAmount: number;
}

type OrderStatusFilter = 'ALL' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

const FILTER_OPTIONS: { key: OrderStatusFilter; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'PENDING', label: '待支付' },
  { key: 'COMPLETED', label: '已完成' },
  { key: 'CANCELLED', label: '已取消' },
  { key: 'EXPIRED', label: '已超时' },
];

const STATUS_TEXT_MAP: Record<string, string> = {
  PENDING: '待支付',
  PAID: '已支付',
  RECHARGING: '充值中',
  COMPLETED: '已完成',
  EXPIRED: '已超时',
  CANCELLED: '已取消',
  FAILED: '失败',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
  REFUND_FAILED: '退款失败',
};

function detectDeviceIsMobile(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Windows Phone|Mobile/i.test(ua);
  const smallPhysicalScreen = Math.min(window.screen.width, window.screen.height) <= 768;
  const touchCapable = navigator.maxTouchPoints > 1;

  return mobileUA || (touchCapable && smallPhysicalScreen);
}

function PayContent() {
  const searchParams = useSearchParams();
  const userId = Number(searchParams.get('user_id'));
  const token = (searchParams.get('token') || '').trim();
  const theme = searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const uiMode = searchParams.get('ui_mode') || 'standalone';
  const tab = searchParams.get('tab');
  const isDark = theme === 'dark';

  const [isIframeContext, setIsIframeContext] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [step, setStep] = useState<'form' | 'paying' | 'result'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [finalStatus, setFinalStatus] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<number | null>(null);
  const [myOrders, setMyOrders] = useState<MyOrder[]>([]);
  const [activeMobileTab, setActiveMobileTab] = useState<'pay' | 'orders'>('pay');
  const [activeFilter, setActiveFilter] = useState<OrderStatusFilter>('ALL');

  const [config] = useState<AppConfig>({
    enabledPaymentTypes: ['alipay', 'wxpay'],
    minAmount: 1,
    maxAmount: 10000,
  });

  const effectiveUserId = resolvedUserId || userId;
  const isEmbedded = uiMode === 'embedded' && isIframeContext;
  const hasToken = token.length > 0;
  const helpImageUrl = (process.env.NEXT_PUBLIC_PAY_HELP_IMAGE_URL || '').trim();
  const helpText = (process.env.NEXT_PUBLIC_PAY_HELP_TEXT || '').trim();
  const hasHelpContent = Boolean(helpImageUrl || helpText);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsIframeContext(window.self !== window.top);
    setIsMobile(detectDeviceIsMobile());
  }, []);

  useEffect(() => {
    if (!isMobile || step !== 'form') return;
    if (tab === 'orders') {
      setActiveMobileTab('orders');
      return;
    }
    setActiveMobileTab('pay');
  }, [isMobile, step, tab]);

  const loadUserAndOrders = async () => {
    if (!userId || Number.isNaN(userId) || userId <= 0) return;

    try {
      if (token) {
        const meRes = await fetch(`/api/orders/my?token=${encodeURIComponent(token)}`);
        if (meRes.ok) {
          const meData = await meRes.json();
          const meUser = meData.user || {};
          const meId = Number(meUser.id);
          if (Number.isInteger(meId) && meId > 0) {
            setResolvedUserId(meId);
          }

          setUserInfo({
            id: Number.isInteger(meId) && meId > 0 ? meId : userId,
            username:
              (typeof meUser.displayName === 'string' && meUser.displayName.trim()) ||
              (typeof meUser.username === 'string' && meUser.username.trim()) ||
              `用户 #${userId}`,
            balance: typeof meUser.balance === 'number' ? meUser.balance : 0,
          });

          if (Array.isArray(meData.orders)) {
            setMyOrders(meData.orders);
          } else {
            setMyOrders([]);
          }
          return;
        }
      }

      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) return;

      const data = await res.json();
      setUserInfo({
        id: userId,
        username:
          (typeof data.displayName === 'string' && data.displayName.trim()) ||
          (typeof data.username === 'string' && data.username.trim()) ||
          (typeof data.email === 'string' && data.email.trim()) ||
          `用户 #${userId}`,
        balance: typeof data.balance === 'number' ? data.balance : 0,
      });
      setMyOrders([]);
    } catch {
      // ignore and keep page usable
    }
  };

  useEffect(() => {
    loadUserAndOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token]);

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'ALL') return myOrders;
    return myOrders.filter((item) => item.status === activeFilter);
  }, [myOrders, activeFilter]);

  const formatStatus = (status: string) => STATUS_TEXT_MAP[status] || status;

  const formatCreatedAt = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const getStatusBadgeClass = (status: string) => {
    if (['COMPLETED', 'PAID'].includes(status)) {
      return isDark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-100 text-emerald-700';
    }
    if (status === 'PENDING') {
      return isDark ? 'bg-blue-500/20 text-blue-200' : 'bg-blue-100 text-blue-700';
    }
    if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(status)) {
      return isDark ? 'bg-slate-600 text-slate-200' : 'bg-slate-100 text-slate-700';
    }
    return isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700';
  };

  if (!effectiveUserId || Number.isNaN(effectiveUserId) || effectiveUserId <= 0) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="text-center text-red-500">
          <p className="text-lg font-medium">无效的用户 ID</p>
          <p className="mt-2 text-sm text-gray-500">请从 Sub2API 平台正确访问充值页面</p>
        </div>
      </div>
    );
  }

  const buildScopedUrl = (path: string, forceOrdersTab = false) => {
    const params = new URLSearchParams();
    if (effectiveUserId) params.set('user_id', String(effectiveUserId));
    if (token) params.set('token', token);
    params.set('theme', theme);
    params.set('ui_mode', uiMode);
    if (forceOrdersTab) params.set('tab', 'orders');
    return `${path}?${params.toString()}`;
  };

  const pcOrdersUrl = buildScopedUrl('/pay/orders');
  const mobileOrdersUrl = buildScopedUrl('/pay', true);
  const ordersUrl = isMobile ? mobileOrdersUrl : pcOrdersUrl;

  const handleSubmit = async (amount: number, paymentType: string) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: effectiveUserId,
          amount,
          payment_type: paymentType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '创建订单失败');
        return;
      }

      setOrderResult({
        orderId: data.orderId,
        amount: data.amount,
        status: data.status,
        paymentType: data.paymentType || paymentType,
        payUrl: data.payUrl,
        qrCode: data.qrCode,
        expiresAt: data.expiresAt,
      });

      if (data.userName || typeof data.userBalance === 'number') {
        setUserInfo((prev) => ({
          username:
            (typeof data.userName === 'string' && data.userName.trim()) ||
            prev?.username ||
            `用户 #${effectiveUserId}`,
          balance: typeof data.userBalance === 'number' ? data.userBalance : (prev?.balance ?? 0),
        }));
      }

      setStep('paying');
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (status: string) => {
    setFinalStatus(status);
    setStep('result');
    if (isMobile) {
      setActiveMobileTab('orders');
    }
  };

  const handleBack = () => {
    setStep('form');
    setOrderResult(null);
    setFinalStatus('');
    setError('');
  };

  useEffect(() => {
    if (step !== 'result' || finalStatus !== 'COMPLETED') return;
    const timer = setTimeout(() => {
      setStep('form');
      setOrderResult(null);
      setFinalStatus('');
      setError('');
      loadUserAndOrders();
    }, 2200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, finalStatus]);

  const renderMobileOrders = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={['text-base font-semibold', isDark ? 'text-slate-100' : 'text-slate-900'].join(' ')}>我的订单</h3>
        <button
          type="button"
          onClick={loadUserAndOrders}
          className={[
            'rounded-lg border px-2.5 py-1 text-xs font-medium',
            isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          刷新
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveFilter(item.key)}
            className={[
              'rounded-full border px-3 py-1 text-xs font-medium',
              activeFilter === item.key
                ? (isDark ? 'border-slate-500 bg-slate-700 text-slate-100' : 'border-slate-400 bg-slate-900 text-white')
                : (isDark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600'),
            ].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!hasToken ? (
        <div
          className={[
            'rounded-xl border border-dashed px-4 py-8 text-center text-sm',
            isDark ? 'border-amber-500/40 text-amber-200' : 'border-amber-300 text-amber-700',
          ].join(' ')}
        >
          当前链接未携带登录 token，无法查询“我的订单”。
        </div>
      ) : filteredOrders.length === 0 ? (
        <div
          className={[
            'rounded-xl border border-dashed px-4 py-8 text-center text-sm',
            isDark ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500',
          ].join(' ')}
        >
          暂无符合条件的订单记录
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className={[
                'rounded-xl border px-3 py-3',
                isDark ? 'border-slate-700 bg-slate-900/70' : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-semibold">¥{order.amount.toFixed(2)}</span>
                <span className={['rounded-full px-2 py-0.5 text-xs', getStatusBadgeClass(order.status)].join(' ')}>
                  {formatStatus(order.status)}
                </span>
              </div>
              <div className={['mt-1 text-sm', isDark ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
                {order.paymentType}
              </div>
              <div className={['mt-0.5 text-xs', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>
                {formatCreatedAt(order.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={[
        'relative min-h-screen w-full overflow-hidden p-3 sm:p-4',
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900',
      ].join(' ')}
    >
      <div
        className={[
          'pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full blur-3xl',
          isDark ? 'bg-indigo-500/25' : 'bg-sky-300/35',
        ].join(' ')}
      />
      <div
        className={[
          'pointer-events-none absolute -right-24 bottom-0 h-64 w-64 rounded-full blur-3xl',
          isDark ? 'bg-cyan-400/20' : 'bg-indigo-200/45',
        ].join(' ')}
      />

      <div
        className={[
          'relative mx-auto w-full rounded-3xl border p-4 sm:p-5',
          isMobile ? 'max-w-lg' : 'max-w-6xl',
          isDark
            ? 'border-slate-700/70 bg-slate-900/85 shadow-2xl shadow-black/35'
            : 'border-slate-200/90 bg-white/95 shadow-2xl shadow-slate-300/45',
          isEmbedded ? '' : 'mt-6',
        ].join(' ')}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="text-left">
            <div
              className={[
                'mb-2 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium',
                isDark ? 'bg-indigo-500/20 text-indigo-200' : 'bg-indigo-50 text-indigo-700',
              ].join(' ')}
            >
              Sub2API Secure Pay
            </div>
            <h1
              className={[
                'text-2xl font-semibold tracking-tight',
                isDark ? 'text-slate-100' : 'text-slate-900',
              ].join(' ')}
            >
              {'Sub2API '}{'\u4F59\u989D\u5145\u503C'}
            </h1>
            <p className={['mt-1 text-xs', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>
              {'\u5B89\u5168\u652F\u4ED8\uFF0C\u81EA\u52A8\u5230\u8D26'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {step === 'form' && isMobile && (
          <div
            className={[
              'mb-4 grid grid-cols-2 rounded-xl border p-1',
              isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-300 bg-slate-100/90',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => setActiveMobileTab('pay')}
              className={[
                'rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200',
                activeMobileTab === 'pay'
                  ? (isDark
                    ? 'bg-indigo-500/30 text-indigo-100 ring-1 ring-indigo-300/35 shadow-sm'
                    : 'bg-white text-slate-900 ring-1 ring-slate-300 shadow-md shadow-slate-300/50')
                  : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'),
              ].join(' ')}
            >
              充值
            </button>
            <button
              type="button"
              onClick={() => setActiveMobileTab('orders')}
              className={[
                'rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200',
                activeMobileTab === 'orders'
                  ? (isDark
                    ? 'bg-indigo-500/30 text-indigo-100 ring-1 ring-indigo-300/35 shadow-sm'
                    : 'bg-white text-slate-900 ring-1 ring-slate-300 shadow-md shadow-slate-300/50')
                  : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'),
              ].join(' ')}
            >
              我的订单
            </button>
          </div>
        )}

        {step === 'form' && (
          <>
            {isMobile ? (
              activeMobileTab === 'pay' ? (
                <PaymentForm
                  userId={effectiveUserId}
                  userName={userInfo?.username}
                  userBalance={userInfo?.balance}
                  enabledPaymentTypes={config.enabledPaymentTypes}
                  minAmount={config.minAmount}
                  maxAmount={config.maxAmount}
                  onSubmit={handleSubmit}
                  loading={loading}
                  dark={isDark}
                />
              ) : (
                renderMobileOrders()
              )
            ) : (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)]">
                <div className="min-w-0">
                  <PaymentForm
                    userId={effectiveUserId}
                    userName={userInfo?.username}
                    userBalance={userInfo?.balance}
                    enabledPaymentTypes={config.enabledPaymentTypes}
                    minAmount={config.minAmount}
                    maxAmount={config.maxAmount}
                    onSubmit={handleSubmit}
                    loading={loading}
                    dark={isDark}
                  />
                </div>
                <div className="space-y-4">
                  <div className={['rounded-2xl border p-4', isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50'].join(' ')}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={['text-xs', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>订单中心</div>
                        <div className="mt-1 text-lg font-semibold">最近订单：{myOrders.length} 条</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={loadUserAndOrders}
                          className={[
                            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                            isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100',
                          ].join(' ')}
                        >
                          刷新
                        </button>
                        <a
                          href={pcOrdersUrl}
                          className={[
                            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                            isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100',
                          ].join(' ')}
                        >
                          我的订单
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className={['rounded-2xl border p-4', isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50'].join(' ')}>
                    <div className={['text-xs', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>支付说明</div>
                    <ul className={['mt-2 space-y-1 text-sm', isDark ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
                      <li>订单完成后会自动到账</li>
                      <li>如需历史记录请查看“我的订单”</li>
                      {!hasToken && <li className={isDark ? 'text-amber-200' : 'text-amber-700'}>当前链接无 token，订单查询受限</li>}
                    </ul>
                  </div>

                  {hasHelpContent && (
                    <div className={['rounded-2xl border p-4', isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50'].join(' ')}>
                      <div className={['text-xs', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>Support</div>
                      {helpImageUrl && (
                        <img
                          src={helpImageUrl}
                          alt='help'
                          className='mt-3 max-h-40 w-full rounded-lg object-contain bg-white/70 p-2'
                        />
                      )}
                      {helpText && (
                        <p className={['mt-3 text-sm leading-6', isDark ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
                          {helpText}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {step === 'paying' && orderResult && (
          <PaymentQRCode
            orderId={orderResult.orderId}
            payUrl={orderResult.payUrl}
            qrCode={orderResult.qrCode}
            paymentType={orderResult.paymentType}
            amount={orderResult.amount}
            expiresAt={orderResult.expiresAt}
            onStatusChange={handleStatusChange}
            onBack={handleBack}
            dark={isDark}
          />
        )}

        {step === 'result' && (
          <OrderStatus status={finalStatus} onBack={handleBack} dark={isDark} />
        )}
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-gray-500">加载中...</div>
        </div>
      }
    >
      <PayContent />
    </Suspense>
  );
}
