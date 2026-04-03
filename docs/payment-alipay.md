# 支付宝当面付接入指南

## 概述

本项目通过直接对接 **支付宝开放平台** 的 **当面付** 能力实现扫码收款，不依赖任何三方聚合支付平台。

当前实现采用：

| 产品 | API 方法 | 场景 |
| --- | --- | --- |
| 当面付 | `alipay.trade.precreate` | 服务端预下单，前端直显支付宝二维码 |

签名算法：**RSA2 (SHA256withRSA)**，密钥格式 **PKCS8**。

## 前置条件

1. 注册 [支付宝开放平台](https://open.alipay.com/) 企业/个人账号
2. 创建网页/移动应用，获取 **APPID**
3. 在应用中签约 **当面付**
4. 配置 **接口加签方式**，选择 **公钥模式 (RSA2)**，生成密钥对

## 密钥说明

支付宝公钥模式涉及三把密钥，必须区分：

| 密钥 | 来源 | 用途 | 对应环境变量 |
| --- | --- | --- | --- |
| 应用私钥 | 你自己生成 | 对请求参数签名 | `ALIPAY_PRIVATE_KEY` |
| 支付宝公钥 | 上传应用公钥后，支付宝返回 | 验证回调通知签名 | `ALIPAY_PUBLIC_KEY` |
| 应用公钥 | 你自己生成 | 上传到支付宝后台 | 不配置到项目 |

> 常见错误：把“应用公钥”填到 `ALIPAY_PUBLIC_KEY`。项目里必须使用“支付宝公钥”。

## 环境变量

```env
# ── 必需 ──
ALIPAY_APP_ID=2021000000000000
ALIPAY_PRIVATE_KEY=MIIEvQIBADANB...
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqh...
ALIPAY_NOTIFY_URL=https://pay.example.com/api/alipay/notify

# ── 可选 ──
ALIPAY_RETURN_URL=https://pay.example.com/pay/result

# ── 启用渠道 ──
PAYMENT_PROVIDERS=alipay
ENABLED_PAYMENT_TYPES=alipay_direct
```

## 支付架构

```text
用户打开支付页
   │
   ├── 服务端创建订单
   ├── 调用 alipay.trade.precreate
   └── 返回支付宝官方 qr_code
          │
          ▼
前端直接展示支付宝二维码
          │
          ▼
用户使用支付宝扫码支付
          │
          ▼
支付宝服务器 POST /api/alipay/notify
          │
          ├── 验签（RSA2 + 支付宝公钥）
          ├── 校验 app_id / 金额 / 订单号
          └── 调用 handlePaymentNotify() → 订单状态流转 → 充值/订阅履约
```

## 文件结构

```text
src/lib/alipay/
├── provider.ts   # AlipayProvider，创建 precreate 订单
├── client.ts     # execute / precreateExecute 服务端 API 调用
├── sign.ts       # RSA2 签名生成 + 验签
├── codec.ts      # 回调参数解析
└── types.ts      # TypeScript 类型定义

src/app/api/alipay/
└── notify/route.ts

src/app/pay/
└── [orderId]/route.ts   # 历史订单兼容/状态页，不再是新订单主支付入口
```

## 支持的 API 能力

| 能力 | API | 说明 |
| --- | --- | --- |
| 创建支付 | `alipay.trade.precreate` | 返回官方二维码内容 |
| 查询订单 | `alipay.trade.query` | 主动查询交易状态 |
| 关闭订单 | `alipay.trade.close` | 超时关单 |
| 退款 | `alipay.trade.refund` | 全额退款 |
| 异步通知 | POST 回调 | RSA2 验签 |

## 注意事项

- 前端二维码应直接展示支付宝返回的 `qr_code`，而不是站内中转 URL
- `alipay_direct` 当前语义已调整为“支付宝当面付扫码”
- 历史订单可能仍保留旧的站内短链，`/pay/[orderId]` 需继续兼容
