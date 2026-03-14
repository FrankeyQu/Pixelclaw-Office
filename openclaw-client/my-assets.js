/**
 * 我的资产页面逻辑
 */

const MyAssets = (function() {
    'use strict';

    // 付费元素配置（id 与 keygen 中的 product 一致）
    const PRODUCTS = [
        { id: 'cat-pack', name: '猫咪', icon: '🐱' },
        { id: 'bulletin-board', name: '布告栏', icon: '📋' }
    ];

    function showToast(msg) {
        const el = document.getElementById('toast');
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 2500);
    }

    function renderOverview() {
        const cached = typeof License !== 'undefined' ? License.getCached() : null;
        const emptyEl = document.getElementById('overviewEmpty');
        const activeEl = document.getElementById('overviewActive');

        if (!cached || !cached.products || cached.products.length === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            if (activeEl) activeEl.style.display = 'none';
            return;
        }

        if (emptyEl) emptyEl.style.display = 'none';
        if (activeEl) activeEl.style.display = 'block';

        const productsEl = document.getElementById('overviewProducts');
        const expiryEl = document.getElementById('overviewExpiry');

        if (productsEl) {
            const names = cached.products.map(id => {
                const p = PRODUCTS.find(x => x.id === id);
                return p ? p.name : id;
            });
            productsEl.textContent = names.join('、');
        }

        if (expiryEl) {
            if (!cached.expiry) {
                expiryEl.textContent = '永久';
            } else {
                const expiry = new Date(cached.expiry);
                const now = new Date();
                if (expiry < now) {
                    expiryEl.textContent = '已过期';
                } else {
                    const days = Math.ceil((expiry - now) / 86400000);
                    expiryEl.textContent = `剩余 ${days} 天 (至 ${cached.expiry})`;
                }
            }
        }
    }

    function renderAssetGrid() {
        const grid = document.getElementById('assetGrid');
        if (!grid) return;

        const hasProduct = (id) => typeof License !== 'undefined' && License.hasProduct(id);

        grid.innerHTML = PRODUCTS.map(p => {
            const unlocked = hasProduct(p.id);
            return `
                <div class="asset-card ${unlocked ? 'unlocked' : ''}" data-id="${p.id}">
                    <div class="asset-preview">${p.icon}</div>
                    <div class="asset-name">${p.name}</div>
                    <div class="asset-status">${unlocked ? '已解锁' : '未解锁'}</div>
                </div>
            `;
        }).join('');
    }

    function clearLicense() {
        if (typeof License !== 'undefined') License.clear();
        showToast('已解除激活');
        renderOverview();
        renderAssetGrid();
    }

    async function redeem() {
        const input = document.getElementById('redeemInput');
        if (!input || typeof License === 'undefined') return;

        const key = input.value.trim();
        if (!key) {
            showToast('请粘贴兑换码');
            return;
        }

        const result = await License.activate(key);
        if (result.success) {
            showToast('兑换成功');
            input.value = '';
            renderOverview();
            renderAssetGrid();
        } else {
            showToast('兑换失败：' + (result.error || '未知错误'));
        }
    }

    function init() {
        renderOverview();
        renderAssetGrid();
    }

    // 初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return { redeem, clearLicense, renderOverview, renderAssetGrid };
})();
