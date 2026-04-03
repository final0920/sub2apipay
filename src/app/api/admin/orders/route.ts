import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminToken, unauthorizedResponse } from '@/lib/admin-auth';

const VALID_ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'RECHARGING',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
  'FAILED',
  'REFUNDING',
  'REFUNDED',
  'REFUND_FAILED',
];

export async function GET(request: NextRequest) {
  if (!(await verifyAdminToken(request))) return unauthorizedResponse();

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('page_size') || '20')));
  const status = searchParams.get('status');
  const orderType = searchParams.get('orderType');
  const userId = searchParams.get('user_id');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  const where: Record<string, any> = {};
  if (status && VALID_ORDER_STATUSES.includes(status)) where.status = status;
  if (orderType && (orderType === 'balance' || orderType === 'subscription')) where.orderType = orderType;

  if (userId) {
    const parsedUserId = Number(userId);
    if (Number.isFinite(parsedUserId)) {
      where.userId = parsedUserId;
    }
  }

  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};
    let hasValidDate = false;

    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!isNaN(d.getTime())) {
        createdAt.gte = d;
        hasValidDate = true;
      }
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!isNaN(d.getTime())) {
        createdAt.lte = d;
        hasValidDate = true;
      }
    }

    if (hasValidDate) {
      where.createdAt = createdAt;
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        userId: true,
        userName: true,
        userEmail: true,
        userNotes: true,
        amount: true,
        payAmount: true,
        status: true,
        paymentType: true,
        createdAt: true,
        paidAt: true,
        completedAt: true,
        failedReason: true,
        expiresAt: true,
        srcHost: true,
        orderType: true,
        planId: true,
        subscriptionGroupId: true,
        subscriptionDays: true,
        refundAmount: true,
        refundAt: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({
    orders: orders.map((order: any) => ({
      ...order,
      amount: Number(order.amount),
      payAmount: order.payAmount ? Number(order.payAmount) : null,
      refundAmount: order.refundAmount ? Number(order.refundAmount) : null,
    })),
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  });
}
