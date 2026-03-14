#!/usr/bin/env python3
"""
许可证密钥生成工具（仅供发行方使用，勿泄露）

用法：
  python generate.py                              # 生成示例许可证
  python generate.py cat-pack bulletin-board      # 指定产品
  python generate.py --products cat-pack,bulletin-board --type site --expiry 2026-12-31
"""

import hmac
import hashlib
import json
import base64
import argparse

PREFIX = 'PXO-'
# 与 license.js 中的 SECRET 保持一致
SECRET = 'pxo_lk_' + '7f3a9b2e8d1c4f6a0e5b9d2c8a1f4e7b3d9c6a2f0e5b8d1c4a7f3e9b6d0c2a5'


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def sign(payload: dict) -> str:
    payload_str = json.dumps(payload, separators=(',', ':'), ensure_ascii=False)
    payload_bytes = payload_str.encode('utf-8')
    sig = hmac.new(SECRET.encode('utf-8'), payload_bytes, hashlib.sha256).digest()
    payload_b64 = b64url_encode(payload_bytes)
    sig_b64 = b64url_encode(sig)
    return PREFIX + payload_b64 + '.' + sig_b64


def main():
    parser = argparse.ArgumentParser(description='生成 Pixelclaw Office 许可证码')
    parser.add_argument('pos_products', nargs='*', metavar='product', help='产品 ID')
    parser.add_argument('--products', '-p', help='产品 ID 逗号分隔')
    parser.add_argument('--type', '-t', default='site', choices=['site', 'personal'])
    parser.add_argument('--expiry', '-e', default='2026-12-31')
    parser.add_argument('--holder', '-H', default='')
    args = parser.parse_args()

    if args.products:
        products = [p.strip() for p in args.products.split(',') if p.strip()]
    elif args.pos_products:
        products = args.pos_products
    else:
        products = ['cat-pack', 'bulletin-board']

    payload = {
        'products': products,
        'type': args.type,
        'expiry': args.expiry or None,
        'holder': args.holder or ''
    }
    key = sign(payload)
    print('\n=== 许可证码（复制发送给客户）===\n')
    print(key)
    print('\n================================\n')


if __name__ == '__main__':
    main()
