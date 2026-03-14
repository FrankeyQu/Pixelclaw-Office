/**
 * Pixelclaw Office 许可证验证模块
 * 支持离线验签：用户购买后获得一条复杂码，粘贴即用
 *
 * 密钥格式：PXO-<base64url(payload)>.<base64url(hmac)>
 * payload: { products: string[], type: "site"|"personal", expiry: string, holder?: string }
 */

const License = (function() {
    'use strict';

    const STORAGE_KEY = 'pixelOfficeLicense';
    const PREFIX = 'PXO-';

    // 签发密钥（与 keygen 保持一致，勿泄露）
    const SECRET = 'pxo_lk_' + '7f3a9b2e8d1c4f6a0e5b9d2c8a1f4e7b3d9c6a2f0e5b8d1c4a7f3e9b6d0c2a5';

    // base64url 编解码
    function base64UrlDecode(str) {
        const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        const padded = pad ? base64 + '===='.slice(0, 4 - pad) : base64;
        const binary = atob(padded);
        return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
    }

    async function hmacSign(keyBytes, dataBytes) {
        const cryptoKey = await crypto.subtle.importKey(
            'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, dataBytes));
    }

    async function verifyHmac(payloadBytes, signatureBytes) {
        const keyBytes = new TextEncoder().encode(SECRET);
        const expected = await hmacSign(keyBytes, payloadBytes);
        if (expected.length !== signatureBytes.length) return false;
        let diff = 0;
        for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ signatureBytes[i];
        return diff === 0;
    }

    /**
     * 解析并验证许可证密钥
     * @param {string} key - 用户粘贴的许可证码
     * @returns {Promise<{ valid: boolean, data?: object, error?: string }>}
     */
    async function parseAndVerify(key) {
        if (!key || typeof key !== 'string') {
            return { valid: false, error: '请输入许可证码' };
        }
        const trimmed = key.trim();
        if (!trimmed.startsWith(PREFIX)) {
            return { valid: false, error: '许可证格式错误（应以 PXO- 开头）' };
        }
        const delimIdx = trimmed.slice(PREFIX.length).lastIndexOf('.');
        if (delimIdx < 0) {
            return { valid: false, error: '许可证格式错误' };
        }
        const rest = trimmed.slice(PREFIX.length);
        const payloadB64 = rest.slice(0, delimIdx);
        const sigB64 = rest.slice(delimIdx + 1);
        let payloadBytes, signatureBytes;
        try {
            payloadBytes = base64UrlDecode(payloadB64);
            signatureBytes = base64UrlDecode(sigB64);
        } catch (e) {
            return { valid: false, error: '许可证编码无效' };
        }

        const ok = await verifyHmac(payloadBytes, signatureBytes);
        if (!ok) return { valid: false, error: '许可证签名无效' };

        let data;
        try {
            const json = new TextDecoder().decode(payloadBytes);
            data = JSON.parse(json);
        } catch (e) {
            return { valid: false, error: '许可证内容损坏' };
        }

        if (!Array.isArray(data.products)) {
            return { valid: false, error: '许可证内容无效' };
        }

        if (data.expiry) {
            const expiry = new Date(data.expiry);
            if (isNaN(expiry.getTime()) || expiry < new Date()) {
                return { valid: false, error: '许可证已过期' };
            }
        }

        return { valid: true, data };
    }

    /**
     * 检查是否拥有某产品
     * @param {string} productId - 产品 ID，如 'cat-pack'
     */
    function hasProduct(productId) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        try {
            const cached = JSON.parse(raw);
            return cached.products && cached.products.includes(productId);
        } catch (e) { return false; }
    }

    /**
     * 获取当前许可证信息（用于展示）
     */
    function getCached() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) { return null; }
    }

    /**
     * 激活许可证并缓存
     * @param {string} key - 许可证码
     * @returns {Promise<{ success: boolean, error?: string, data?: object }>}
     */
    async function activate(key) {
        const result = await parseAndVerify(key);
        if (!result.valid) {
            return { success: false, error: result.error };
        }
        const toCache = {
            products: result.data.products,
            type: result.data.type || 'site',
            expiry: result.data.expiry || null,
            holder: result.data.holder || '',
            activatedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toCache));
        return { success: true, data: toCache };
    }

    /**
     * 清除许可证
     */
    function clear() {
        localStorage.removeItem(STORAGE_KEY);
    }

    return {
        parseAndVerify,
        activate,
        hasProduct,
        getCached,
        clear,
        PREFIX
    };
})();
