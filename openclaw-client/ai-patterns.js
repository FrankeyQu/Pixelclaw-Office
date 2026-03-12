/**
 * AI 图案生成器 - 独立模块，供地图编辑器使用
 */
const AIGenerator = {
    generatePattern(type, size, colors) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const palette = this._palette(colors);
        const types = ['house','desk','plant','animal'];
        const t = types.includes(type) ? type : types[Math.floor(Math.random()*4)];
        this._drawSprite(ctx, size, palette, t);
        return { canvas, palette };
    },
    _palette(n) {
        const p = [];
        for (let i = 0; i < n; i++) {
            const h = (i/n)*360, s = 70+Math.random()*30, l = 40+Math.random()*40;
            p.push(this._hsl2rgb(h,s,l));
        }
        return p;
    },
    _hsl2rgb(h,s,l) {
        s/=100; l/=100;
        const k = n => (n + h/30) % 12;
        const a = s * Math.min(l, 1-l);
        const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n),1)));
        return [Math.round(f(0)*255), Math.round(f(8)*255), Math.round(f(4)*255)];
    },
    _drawSprite(ctx, size, palette, type) {
        const gs = Math.max(4, Math.floor(size/10)), g = 8;
        const sprites = {
            house: [[0,0,0,1,1,1,0,0],[0,0,1,1,1,1,1,0],[0,1,2,2,2,2,2,1],[1,2,2,2,2,2,2,2],[2,2,2,4,2,4,2,2],[2,2,2,2,2,2,2,2],[2,2,2,3,3,3,2,2],[2,2,2,2,2,2,2,2]],
            desk: [[0,0,0,3,3,0,0,0],[0,0,0,3,3,0,0,0],[0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1],[0,0,2,0,0,2,0,0],[0,0,2,0,0,2,0,0],[0,0,2,0,0,2,0,0]],
            plant: [[0,0,0,2,2,0,0,0],[0,0,2,2,2,2,0,0],[0,2,2,2,2,2,2,0],[0,0,2,2,2,2,0,0],[0,0,0,2,2,0,0,0],[0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1]],
            animal: [[0,0,0,1,1,0,0,0],[0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,0],[0,0,2,0,0,2,0,0],[0,0,2,0,0,2,0,0],[0,0,0,0,0,0,0,0]]
        };
        const s = sprites[type] || sprites.house;
        const padX = (size - g*gs)/2, padY = (size - g*gs)/2;
        const bg = palette[0] || [30,25,25];
        ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
        ctx.fillRect(0,0,size,size);
        for (let r = 0; r < g && r < s.length; r++)
            for (let c = 0; c < g && c < s[r].length; c++) {
                const idx = s[r][c];
                if (idx === 0) continue;
                const col = palette[idx % palette.length] || palette[0];
                ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
                ctx.fillRect(padX+c*gs, padY+r*gs, gs, gs);
            }
    }
};
