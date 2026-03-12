/**
 * Pixelclaw Office 点阵资产系统
 * 图片转点阵、AI生成、像素编辑、动画管理
 */

// ==================== 配置 ====================
const DEBUG_ASSET = false; // 开发调试时设为 true
const CONFIG = {
    CANVAS_SIZE: 512,
    DEFAULT_TARGET_SIZE: 64,
    DEFAULT_COLOR_COUNT: 16,
    GRID_SIZE: 20,  // 与地图编辑器相同的格子大小
    ZOOM_LEVELS: [0.5, 0.75, 1, 1.5, 2, 3, 4],
    DEFAULT_ZOOM_INDEX: 2,
    // 格子系统配置
    DEFAULT_GRID_CELLS: 5,
    MIN_GRID_CELLS: 1,
    MAX_GRID_CELLS: 20
};

// ==================== 点阵资产格式 ====================
class DotMatrixAsset {
    constructor(name, width, height, palette, pixelData, gridCells, pixelsPerCell) {
        this.version = '1.0';
        this.name = name;
        this.width = width;
        this.height = height;
        this.gridCells = gridCells;
        this.pixelsPerCell = pixelsPerCell;
        this.palette = palette; // [[r,g,b], ...]
        this.pixelData = pixelData; // 每个像素的调色板索引数组
        this.metadata = {
            created: new Date().toISOString(),
            format: 'openclaw-dotmatrix'
        };
    }
    
    // 导出为二进制格式
    toBinary() {
        // 文件头: OCMD (OpenClaw Matrix Data)
        const header = new Uint8Array([0x4F, 0x43, 0x4D, 0x44]);
        
        // 版本号
        const version = new Uint8Array([1, 0]);
        
        // 尺寸信息 (2字节宽度 + 2字节高度)
        const dimensions = new Uint16Array([this.width, this.height]);
        
        // 格子信息
        const gridInfo = new Uint8Array([this.gridCells, this.pixelsPerCell]);
        
        // 调色板数量
        const paletteCount = new Uint8Array([this.palette.length]);
        
        // 调色板数据 (每个颜色3字节 RGB)
        const paletteData = new Uint8Array(this.palette.length * 3);
        for (let i = 0; i < this.palette.length; i++) {
            paletteData[i * 3] = this.palette[i][0];
            paletteData[i * 3 + 1] = this.palette[i][1];
            paletteData[i * 3 + 2] = this.palette[i][2];
        }
        
        // 像素数据 (每个像素1字节，表示调色板索引)
        const pixelBytes = new Uint8Array(this.pixelData);
        
        // 合并所有数据
        const totalSize = header.length + version.length + 4 + gridInfo.length + 
                         1 + paletteData.length + pixelBytes.length;
        const buffer = new Uint8Array(totalSize);
        
        let offset = 0;
        buffer.set(header, offset); offset += header.length;
        buffer.set(version, offset); offset += version.length;
        buffer.set(new Uint8Array(dimensions.buffer), offset); offset += 4;
        buffer.set(gridInfo, offset); offset += gridInfo.length;
        buffer.set(paletteCount, offset); offset += 1;
        buffer.set(paletteData, offset); offset += paletteData.length;
        buffer.set(pixelBytes, offset);
        
        return buffer;
    }
    
    // 导出为JSON格式
    toJSON() {
        return {
            version: this.version,
            name: this.name,
            width: this.width,
            height: this.height,
            gridCells: this.gridCells,
            pixelsPerCell: this.pixelsPerCell,
            palette: this.palette,
            pixelData: Array.from(this.pixelData),
            metadata: this.metadata
        };
    }
    
    // 从JSON导入
    static fromJSON(json) {
        return new DotMatrixAsset(
            json.name,
            json.width,
            json.height,
            json.palette,
            new Uint8Array(json.pixelData),
            json.gridCells,
            json.pixelsPerCell
        );
    }
}

// ==================== AI 生成器 ====================
class AIGenerator {
    // 生成简单的像素图案
    static generatePattern(type, size, colors) {
        try {
            if (DEBUG_ASSET) console.log('开始生成图案:', { type, size, colors });
            
            // 检查document是否存在
            if (!document) {
                throw new Error('document对象不存在');
            }
            
            if (DEBUG_ASSET) console.log('document存在，开始创建canvas');
            const canvas = document.createElement('canvas');
            if (DEBUG_ASSET) console.log('canvas创建结果:', canvas);
            
            if (!canvas) {
                throw new Error('无法创建canvas元素');
            }
            
            canvas.width = size;
            canvas.height = size;
            if (DEBUG_ASSET) console.log('canvas尺寸设置完成:', { width: canvas.width, height: canvas.height });
            
            const ctx = canvas.getContext('2d');
            if (DEBUG_ASSET) console.log('canvas上下文获取结果:', ctx);
            
            if (!ctx) {
                throw new Error('无法获取canvas上下文');
            }
            
            if (DEBUG_ASSET) console.log('开始生成调色板');
            const palette = this.generatePalette(colors);
            if (DEBUG_ASSET) console.log('调色板生成完成:', palette);
            
            if (DEBUG_ASSET) console.log('开始生成具体图案:', type);
            switch (type) {
                case 'house':
                    return this.generatePixelHouse(ctx, size, palette);
                case 'desk':
                    return this.generatePixelDesk(ctx, size, palette);
                case 'plant':
                    return this.generatePixelPlant(ctx, size, palette);
                case 'animal':
                    return this.generatePixelAnimal(ctx, size, palette);
                case 'checkerboard':
                    return this.generateCheckerboard(ctx, size, palette);
                case 'circles':
                    return this.generateCircles(ctx, size, palette);
                case 'stripes':
                    return this.generateStripes(ctx, size, palette);
                case 'noise':
                    return this.generateNoise(ctx, size, palette);
                case 'gradient':
                    return this.generateGradient(ctx, size, palette);
                case 'random':
                default:
                    return this.generateRandom(ctx, size, palette);
            }
        } catch (error) {
            console.error('生成图案错误:', error);
            console.error('错误堆栈:', error.stack);
            
            // 直接返回一个简单的对象，不依赖canvas
            return {
                canvas: null,
                palette: [[0,0,0], [255,255,255]]
            };
        }
    }
    
    // 生成调色板
    static generatePalette(count) {
        const palette = [];
        for (let i = 0; i < count; i++) {
            const hue = (i / count) * 360;
            const sat = 70 + Math.random() * 30;
            const light = 40 + Math.random() * 40;
            palette.push(this.hslToRgb(hue, sat, light));
        }
        return palette;
    }
    
    // HSL转RGB
    static hslToRgb(h, s, l) {
        s /= 100;
        l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
    }
    
    // 生成噪点图案
    static generateNoise(ctx, size, palette) {
        const imageData = ctx.createImageData(size, size);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const color = palette[Math.floor(Math.random() * palette.length)];
            imageData.data[i] = color[0];
            imageData.data[i + 1] = color[1];
            imageData.data[i + 2] = color[2];
            imageData.data[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
        return { canvas, palette };
    }
    
    // 生成渐变图案
    static generateGradient(ctx, size, palette) {
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        palette.forEach((color, i) => {
            gradient.addColorStop(i / (palette.length - 1), `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
        });
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        return { canvas, palette };
    }
    
    // 生成棋盘图案
    static generateCheckerboard(ctx, size, palette) {
        const cellSize = Math.max(4, Math.floor(size / 8));
        for (let y = 0; y < size; y += cellSize) {
            for (let x = 0; x < size; x += cellSize) {
                const colorIndex = ((x / cellSize) + (y / cellSize)) % 2;
                const color = palette[colorIndex % palette.length];
                ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                ctx.fillRect(x, y, cellSize, cellSize);
            }
        }
        return { canvas, palette };
    }
    
    // 生成圆形图案
    static generateCircles(ctx, size, palette) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, size, size);
        const count = 5 + Math.floor(Math.random() * 5);
        for (let i = 0; i < count; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = 5 + Math.random() * (size / 4);
            const color = palette[i % palette.length];
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            ctx.fill();
        }
        return { canvas, palette };
    }
    
    // 生成条纹图案
    static generateStripes(ctx, size, palette) {
        const stripeWidth = Math.max(4, Math.floor(size / 10));
        for (let i = 0; i < size / stripeWidth; i++) {
            const color = palette[i % palette.length];
            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            ctx.fillRect(i * stripeWidth, 0, stripeWidth, size);
        }
        return { canvas, palette };
    }
    
    // 生成随机图案
    static generateRandom(ctx, size, palette) {
        const patterns = ['house', 'desk', 'plant', 'animal', 'checkerboard', 'circles', 'stripes'];
        const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
        return this.generatePattern(randomPattern, size, palette.length);
    }

    // 像素风格 - 房子 (0空 1屋顶 2墙 3门 4窗)
    static generatePixelHouse(ctx, size, palette) {
        const gs = Math.max(4, Math.floor(size / 10));
        const grid = 8;
        const sprite = [
            [0,0,0,1,1,1,0,0], [0,0,1,1,1,1,1,0], [0,1,2,2,2,2,2,1],
            [1,2,2,2,2,2,2,2], [2,2,2,4,2,4,2,2], [2,2,2,2,2,2,2,2],
            [2,2,2,3,3,3,2,2], [2,2,2,2,2,2,2,2]
        ];
        this.drawPixelSprite(ctx, size, palette, sprite, gs, grid);
        return { canvas: ctx.canvas, palette };
    }

    // 像素风格 - 办公桌 (0空 1桌面 2桌腿 3屏幕)
    static generatePixelDesk(ctx, size, palette) {
        const gs = Math.max(4, Math.floor(size / 10));
        const grid = 8;
        const sprite = [
            [0,0,0,3,3,0,0,0], [0,0,0,3,3,0,0,0], [0,0,1,1,1,1,0,0],
            [0,1,1,1,1,1,1,0], [1,1,1,1,1,1,1,1], [0,0,2,0,0,2,0,0],
            [0,0,2,0,0,2,0,0], [0,0,2,0,0,2,0,0]
        ];
        this.drawPixelSprite(ctx, size, palette, sprite, gs, grid);
        return { canvas: ctx.canvas, palette };
    }

    // 像素风格 - 盆栽 (0空 1花盆 2叶子)
    static generatePixelPlant(ctx, size, palette) {
        const gs = Math.max(4, Math.floor(size / 10));
        const grid = 8;
        const sprite = [
            [0,0,0,2,2,0,0,0], [0,0,2,2,2,2,0,0], [0,2,2,2,2,2,2,0],
            [0,0,2,2,2,2,0,0], [0,0,0,2,2,0,0,0], [0,0,1,1,1,1,0,0],
            [0,1,1,1,1,1,1,0], [1,1,1,1,1,1,1,1]
        ];
        this.drawPixelSprite(ctx, size, palette, sprite, gs, grid);
        return { canvas: ctx.canvas, palette };
    }

    // 像素风格 - 小动物/猫 (0空 1身体 2脚)
    static generatePixelAnimal(ctx, size, palette) {
        const gs = Math.max(4, Math.floor(size / 10));
        const grid = 8;
        const sprite = [
            [0,0,0,1,1,0,0,0], [0,0,1,1,1,1,0,0], [0,1,1,1,1,1,1,0],
            [0,1,1,1,1,1,1,0], [0,1,1,1,1,1,1,0], [0,0,2,0,0,2,0,0],
            [0,0,2,0,0,2,0,0], [0,0,0,0,0,0,0,0]
        ];
        this.drawPixelSprite(ctx, size, palette, sprite, gs, grid);
        return { canvas: ctx.canvas, palette };
    }

    static drawPixelSprite(ctx, size, palette, sprite, gs, grid) {
        const padX = (size - grid * gs) / 2;
        const padY = (size - grid * gs) / 2;
        const bg = palette[0] || [30, 25, 25];
        ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
        ctx.fillRect(0, 0, size, size);
        for (let r = 0; r < grid && r < sprite.length; r++) {
            for (let c = 0; c < grid && c < sprite[r].length; c++) {
                const idx = sprite[r][c];
                if (idx === 0) continue;
                const color = palette[idx % palette.length] || palette[0];
                ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
                ctx.fillRect(padX + c * gs, padY + r * gs, gs, gs);
            }
        }
    }
}

// ==================== 颜色量化器 ====================
class ColorQuantizer {
    static medianCut(imageData, colorCount) {
        const pixels = [];
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 128) {
                pixels.push([data[i], data[i + 1], data[i + 2]]);
            }
        }
        
        if (pixels.length === 0) return [];
        
        const buckets = [pixels];
        
        while (buckets.length < colorCount && buckets.length < pixels.length) {
            let maxBucketIndex = 0;
            let maxRange = 0;
            
            for (let i = 0; i < buckets.length; i++) {
                const range = this.getColorRange(buckets[i]);
                const totalRange = range.r + range.g + range.b;
                if (totalRange > maxRange) {
                    maxRange = totalRange;
                    maxBucketIndex = i;
                }
            }
            
            const bucket = buckets[maxBucketIndex];
            const range = this.getColorRange(bucket);
            
            let channel = 'r';
            if (range.g > range.r && range.g > range.b) channel = 'g';
            if (range.b > range.r && range.b > range.g) channel = 'b';
            
            const channelIndex = channel === 'r' ? 0 : channel === 'g' ? 1 : 2;
            bucket.sort((a, b) => a[channelIndex] - b[channelIndex]);
            
            const mid = Math.floor(bucket.length / 2);
            buckets.splice(maxBucketIndex, 1, bucket.slice(0, mid), bucket.slice(mid));
        }
        
        return buckets.map(bucket => {
            if (bucket.length === 0) return [0, 0, 0];
            const sum = bucket.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
            return [
                Math.round(sum[0] / bucket.length),
                Math.round(sum[1] / bucket.length),
                Math.round(sum[2] / bucket.length)
            ];
        });
    }
    
    static getColorRange(pixels) {
        if (pixels.length === 0) return { r: 0, g: 0, b: 0 };
        
        let minR = 255, maxR = 0;
        let minG = 255, maxG = 0;
        let minB = 255, maxB = 0;
        
        for (const p of pixels) {
            minR = Math.min(minR, p[0]); maxR = Math.max(maxR, p[0]);
            minG = Math.min(minG, p[1]); maxG = Math.max(maxG, p[1]);
            minB = Math.min(minB, p[2]); maxB = Math.max(maxB, p[2]);
        }
        
        return { r: maxR - minR, g: maxG - minG, b: maxB - minB };
    }
    
    static colorDistance(c1, c2) {
        const dr = c1[0] - c2[0];
        const dg = c1[1] - c2[1];
        const db = c1[2] - c2[2];
        return dr * dr + dg * dg + db * db;
    }
    
    static findClosestColor(color, palette) {
        if (!palette || palette.length === 0) return 0;
        let minDist = Infinity;
        let closest = 0;
        
        for (let i = 0; i < palette.length; i++) {
            const dist = this.colorDistance(color, palette[i]);
            if (dist < minDist) {
                minDist = dist;
                closest = i;
            }
        }
        
        return closest;
    }
}

// ==================== 抖动算法 ====================
class Dithering {
    static bayerMatrix = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
    ];
    
    static bayer(imageData, palette, width, height) {
        const output = new Uint8ClampedArray(imageData.data);
        const matrixSize = 4;
        const matrixValue = 16;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                if (output[idx + 3] < 128) continue;
                
                const threshold = (this.bayerMatrix[y % matrixSize][x % matrixSize] / matrixValue - 0.5) * 32;
                
                const r = Math.max(0, Math.min(255, output[idx] + threshold));
                const g = Math.max(0, Math.min(255, output[idx + 1] + threshold));
                const b = Math.max(0, Math.min(255, output[idx + 2] + threshold));
                
                const closest = ColorQuantizer.findClosestColor([r, g, b], palette);
                const color = palette[closest];
                
                output[idx] = color[0];
                output[idx + 1] = color[1];
                output[idx + 2] = color[2];
            }
        }
        
        return new ImageData(output, width, height);
    }
}

// ==================== 点阵资产系统 ====================
class AssetSystem {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.originalImage = null;
        this.convertedImage = null;
        this.currentAsset = null; // 当前点阵资产
        this.palette = [];
        this.currentTool = 'grid';
        this.zoomIndex = CONFIG.DEFAULT_ZOOM_INDEX;
        this.selectedColor = 0;
        
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        
        // 裁剪状态
        this.cropStart = null;
        this.cropEnd = null;
        this.pendingCropRect = null;
        
        this.assets = new Map();
        this.frames = [];
        this.currentFrame = 0;
        
        this.gridCells = CONFIG.DEFAULT_GRID_CELLS;
        this.pixelsPerCell = CONFIG.GRID_SIZE;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.generatePalette();
        this.loadBuiltInAssets();
        this.updateUI();
        this.updateConvertParams();
        this.renderGrid();
    }
    
    loadBuiltInAssets() {
        const libraryContent = document.getElementById('libraryContent');
        if (!libraryContent) return;
        libraryContent.innerHTML = '';
        
        const categories = {
            floor: { title: '🟫 地板', items: ['floorWood', 'floorTile', 'floorCarpet', 'floorMarble', 'floorConcrete', 'floorLinoleum'] },
            furniture: { title: '🪑 家具', items: ['desk', 'chair', 'monitor', 'meetingTable', 'receptionDesk', 'sofa'] },
            people: { title: '👥 人物', items: ['personWorking', 'personStanding', 'receptionist', 'manager'] },
            environment: { title: '🏢 环境', items: ['glassWall', 'window', 'door', 'plant'] },
            decorations: { title: '🎨 装饰', items: ['coffeeMachine', 'printer', 'filingCabinet'] }
        };
        const names = {
            floorWood: '木地板', floorTile: '白瓷砖', floorCarpet: '地毯', floorMarble: '大理石', floorConcrete: '水泥', floorLinoleum: '复合地板',
            desk: '办公桌', chair: '椅子', monitor: '显示器', meetingTable: '会议桌', receptionDesk: '前台', sofa: '沙发',
            personWorking: '办公', personStanding: '站立', receptionist: '前台', manager: '经理',
            glassWall: '玻璃墙', window: '窗户', door: '门', plant: '盆栽',
            coffeeMachine: '咖啡机', printer: '打印机', filingCabinet: '文件柜'
        };
        const paths = {
            desk: 'assets/furniture/desk_isometric.png', chair: 'assets/furniture/chair_isometric.png', monitor: 'assets/furniture/monitor_isometric.png',
            meetingTable: 'assets/furniture/meeting_table.png', receptionDesk: 'assets/furniture/reception_desk.png', sofa: 'assets/furniture/sofa_lounge.png',
            personWorking: 'assets/people/person_working.png', personStanding: 'assets/people/person_standing.png',
            receptionist: 'assets/people/receptionist.png', manager: 'assets/people/manager.png',
            glassWall: 'assets/environment/glass_wall.png', window: 'assets/environment/window.png', door: 'assets/environment/door.png',
            plant: 'assets/decorations/plant.png', coffeeMachine: 'assets/decorations/coffee_machine.png', printer: 'assets/decorations/printer.png',
            filingCabinet: 'assets/furniture/filing_cabinet.png'
        };
        
        Object.entries(categories).forEach(([cat, { title, items }]) => {
            const div = document.createElement('div');
            div.className = 'asset-category';
            div.innerHTML = `<div class="asset-category-title">${title}</div><div class="asset-grid" data-category="${cat}"></div>`;
            libraryContent.appendChild(div);
            const grid = div.querySelector('.asset-grid');
            items.forEach(key => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'asset-item';
                itemDiv.title = names[key] || key;
                if (cat === 'floor') {
                    const img = new Image();
                    img.onload = () => {
                        itemDiv.innerHTML = `<img src="${img.src}" alt="${names[key]}"><span class="asset-name">${names[key]}</span>`;
                        itemDiv.onclick = () => this.loadBuiltInImage(img, names[key]);
                        grid.appendChild(itemDiv);
                    };
                    img.src = this.createFloorTexture(key);
                } else {
                    const img = new Image();
                    img.onload = () => {
                        itemDiv.innerHTML = `<img src="${img.src}" alt="${names[key]}"><span class="asset-name">${names[key]}</span>`;
                        itemDiv.onclick = () => this.loadBuiltInImage(img, names[key]);
                        grid.appendChild(itemDiv);
                    };
                    img.onerror = () => { itemDiv.innerHTML = `<span class="asset-name">${names[key]} (加载失败)</span>`; grid.appendChild(itemDiv); };
                    img.src = paths[key] || '';
                }
            });
        });
        
        const dotDiv = document.createElement('div');
        dotDiv.className = 'asset-category';
        dotDiv.innerHTML = '<div class="asset-category-title">🔴 点阵资产</div><div class="asset-grid" data-category="dotmatrix"></div>';
        libraryContent.appendChild(dotDiv);
        
        try {
            const mapAssets = JSON.parse(localStorage.getItem('mapEditorAssets') || '[]');
            mapAssets.forEach(assetData => {
                const img = new Image();
                img.onload = () => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'asset-item';
                    itemDiv.innerHTML = `<img src="${img.src}" alt="${assetData.name}"><span class="asset-name">${assetData.name}</span>`;
                    itemDiv.onclick = () => this.loadBuiltInImage(img, assetData.name);
                    dotDiv.querySelector('.asset-grid').appendChild(itemDiv);
                };
                img.src = assetData.image;
            });
        } catch (_) {}
    }
    
    createFloorTexture(type) {
        const size = CONFIG.GRID_SIZE;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const patterns = {
            floorWood: () => {
                const g = ctx.createLinearGradient(0, 0, size, 0);
                g.addColorStop(0, '#8b6914'); g.addColorStop(0.5, '#a67c00'); g.addColorStop(1, '#6b5012');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, size, size);
            },
            floorTile: () => { ctx.fillStyle = '#e8e4e0'; ctx.fillRect(0, 0, size, size); },
            floorCarpet: () => {
                const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
                g.addColorStop(0, '#5a4a6a'); g.addColorStop(1, '#4a3a5a');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, size, size);
            },
            floorMarble: () => { ctx.fillStyle = '#d4d0cc'; ctx.fillRect(0, 0, size, size); },
            floorConcrete: () => { ctx.fillStyle = '#9a9590'; ctx.fillRect(0, 0, size, size); },
            floorLinoleum: () => { ctx.fillStyle = '#2d4a3e'; ctx.fillRect(0, 0, size, size); }
        };
        if (patterns[type]) patterns[type]();
        return canvas.toDataURL('image/png');
    }
    
    loadBuiltInImage(img, name) {
        this.originalImage = img;
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);
        this.saveHistory();
        this.updateCanvasInfo();
        this.showNotification(`已加载: ${name}，可进行转换`);
    }
    
    bindEvents() {
        const uploadZone = document.getElementById('uploadZone');
        
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });
        
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.loadImage(files[0]);
            }
        });
        
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }
    
    // ==================== AI 生成 ====================
    showAIGenerator() {
        try {
            const dialog = document.getElementById('aiGeneratorDialog');
            dialog.style.display = 'flex';
        } catch (error) {
            console.error('AI生成按钮点击错误:', error);
            this.showNotification(`错误: ${error.message}`);
        }
    }
    
    selectAIPattern(type) {
        try {
            if (DEBUG_ASSET) console.log('选择的AI图案类型:', type);
            
            // 获取当前格子设置
            const gridCells = parseInt(document.getElementById('gridCells').value);
            const pixelsPerCell = parseInt(document.getElementById('pixelsPerCell').value);
            const size = gridCells * pixelsPerCell;
            const colorCount = parseInt(document.getElementById('colorCount').value);
            
            if (DEBUG_ASSET) console.log('AI生成参数:', { type, size, colorCount, gridCells, pixelsPerCell });
            
            this.generateWithAI(type, size, colorCount);
            this.closeAIDialog();
        } catch (error) {
            console.error('选择AI图案错误:', error);
            this.showNotification(`错误: ${error.message}`);
        }
    }
    
    closeAIDialog() {
        const dialog = document.getElementById('aiGeneratorDialog');
        dialog.style.display = 'none';
    }
    
    generateCustomPattern() {
        try {
            const descriptionInput = document.getElementById('patternDescription');
            const sizeInput = document.getElementById('patternSize');
            
            if (!descriptionInput || !sizeInput) {
                throw new Error('输入框未找到');
            }
            
            const description = descriptionInput.value.trim();
            const sizeStr = sizeInput.value.trim();
            
            if (!description) {
                this.showNotification('请输入图案描述');
                return;
            }
            
            if (!sizeStr) {
                this.showNotification('请输入尺寸');
                return;
            }
            
            // 解析尺寸格式 (如 5*5)
            const sizeMatch = sizeStr.match(/^(\d+)\s*[*x×]\s*(\d+)$/);
            if (!sizeMatch) {
                this.showNotification('尺寸格式错误，请使用 宽*高 格式（如：5*5）');
                return;
            }
            
            const gridWidth = parseInt(sizeMatch[1]);
            const gridHeight = parseInt(sizeMatch[2]);
            
            if (gridWidth < 1 || gridWidth > 20 || gridHeight < 1 || gridHeight > 20) {
                this.showNotification('尺寸范围错误，宽高应在 1-20 之间');
                return;
            }
            
            if (DEBUG_ASSET) console.log('自定义图案参数:', { description, gridWidth, gridHeight });
            
            // 根据描述选择图案类型
            const type = this.getPatternTypeFromDescription(description);
            if (DEBUG_ASSET) console.log('根据描述选择的图案类型:', type);
            
            // 获取每格像素数
            const pixelsPerCell = parseInt(document.getElementById('pixelsPerCell').value);
            const width = gridWidth * pixelsPerCell;
            const height = gridHeight * pixelsPerCell;
            const colorCount = parseInt(document.getElementById('colorCount').value);
            
            if (DEBUG_ASSET) console.log('生成参数:', { type, width, height, colorCount, pixelsPerCell });
            
            // 更新格子设置
            document.getElementById('gridCells').value = Math.max(gridWidth, gridHeight);
            this.updateConvertParams();
            
            // 生成图案
            this.canvas.width = width;
            this.canvas.height = height;
            this.drawPatternByDescription(description, width, height, colorCount);
            
            // 创建点阵资产
            this.createDotMatrixAsset();
            
            // 绘制网格
            this.renderGrid();
            
            this.saveHistory();
            this.updateCanvasInfo();
            this.showNotification(`生成完成: ${description} (${gridWidth}×${gridHeight})`);
            this.closeAIDialog();
            
            // 清空输入框
            descriptionInput.value = '';
            sizeInput.value = '';
        } catch (error) {
            console.error('自定义图案生成错误:', error);
            this.showNotification(`错误: ${error.message}`);
        }
    }
    
    // 根据描述获取图案类型（按提示词映射到像素风格元素）
    getPatternTypeFromDescription(description) {
        const desc = description.toLowerCase();
        if (desc.includes('房子') || desc.includes('建筑') || desc.includes('house') || desc.includes('building')) return 'house';
        if (desc.includes('办公桌') || desc.includes('桌子') || desc.includes('desk') || desc.includes('table')) return 'desk';
        if (desc.includes('盆栽') || desc.includes('树') || desc.includes('植物') || desc.includes('plant') || desc.includes('tree')) return 'plant';
        if (desc.includes('动物') || desc.includes('猫') || desc.includes('狗') || desc.includes('animal') || desc.includes('cat') || desc.includes('dog')) return 'animal';
        if (desc.includes('人物') || desc.includes('人') || desc.includes('person')) return 'random';
        if (desc.includes('天空') || desc.includes('背景') || desc.includes('sky')) return 'gradient';
        if (desc.includes('地面') || desc.includes('道路') || desc.includes('ground')) return 'stripes';
        return 'random';
    }
    
    // 根据描述绘制图案
    drawPatternByDescription(description, width, height, colorCount) {
        try {
            if (DEBUG_ASSET) console.log('根据描述绘制图案:', { description, width, height, colorCount });
            
            // 生成调色板
            const palette = [];
            for (let i = 0; i < colorCount; i++) {
                const hue = (i / colorCount) * 360;
                const sat = 70 + Math.random() * 30;
                const light = 40 + Math.random() * 40;
                palette.push(this.hslToRgb(hue, sat, light));
            }
            
            // 清空画布
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, width, height);
            
            const desc = description.toLowerCase();
            
            const type = this.getPatternTypeFromDescription(description);
            if (['house', 'desk', 'plant', 'animal'].includes(type)) {
                this.drawSimplePattern(type, width, height, colorCount);
            } else if (desc.includes('人物') || desc.includes('人') || desc.includes('person')) {
                this.drawPerson(width, height, palette);
                // drawPerson 使用固定颜色，同步实际使用的调色板
                this.palette = [
                    [0, 0, 0], [255, 200, 170], [100, 50, 20], [30, 30, 60],
                    [255, 255, 255], [180, 20, 20], [20, 20, 20]
                ];
                this.generatePalette();
            } else {
                const patterns = ['house', 'desk', 'plant', 'animal', 'checkerboard', 'circles', 'stripes'];
                this.drawSimplePattern(patterns[Math.floor(Math.random() * patterns.length)], width, height, colorCount);
            }
        } catch (error) {
            console.error('绘制图案错误:', error);
            // 绘制错误提示
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, width, height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('生成失败', width/2, height/2);
        }
    }
    
    // 绘制房子
    drawHouse(width, height, palette) {
        // 房子主体
        const houseWidth = width * 0.8;
        const houseHeight = height * 0.7;
        const houseX = (width - houseWidth) / 2;
        const houseY = height - houseHeight;
        
        // 墙壁
        this.ctx.fillStyle = `rgb(${palette[0][0]}, ${palette[0][1]}, ${palette[0][2]})`;
        this.ctx.fillRect(houseX, houseY, houseWidth, houseHeight);
        
        // 屋顶
        this.ctx.fillStyle = `rgb(${palette[1][0]}, ${palette[1][1]}, ${palette[1][2]})`;
        this.ctx.beginPath();
        this.ctx.moveTo(houseX - 10, houseY);
        this.ctx.lineTo(houseX + houseWidth / 2, houseY - 30);
        this.ctx.lineTo(houseX + houseWidth + 10, houseY);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 门
        const doorWidth = houseWidth * 0.2;
        const doorHeight = houseHeight * 0.4;
        const doorX = (width - doorWidth) / 2;
        const doorY = houseY + houseHeight - doorHeight;
        
        this.ctx.fillStyle = `rgb(${palette[2][0]}, ${palette[2][1]}, ${palette[2][2]})`;
        this.ctx.fillRect(doorX, doorY, doorWidth, doorHeight);
        
        // 窗户
        const windowSize = houseWidth * 0.15;
        const windowX1 = houseX + houseWidth * 0.2;
        const windowX2 = houseX + houseWidth * 0.65;
        const windowY = houseY + houseHeight * 0.3;
        
        this.ctx.fillStyle = `rgb(${palette[3][0]}, ${palette[3][1]}, ${palette[3][2]})`;
        this.ctx.fillRect(windowX1, windowY, windowSize, windowSize);
        this.ctx.fillRect(windowX2, windowY, windowSize, windowSize);
    }
    
    // 绘制树
    drawTree(width, height, palette) {
        // 树干
        const trunkWidth = width * 0.2;
        const trunkHeight = height * 0.3;
        const trunkX = (width - trunkWidth) / 2;
        const trunkY = height - trunkHeight;
        
        this.ctx.fillStyle = `rgb(${palette[0][0]}, ${palette[0][1]}, ${palette[0][2]})`;
        this.ctx.fillRect(trunkX, trunkY, trunkWidth, trunkHeight);
        
        // 树叶
        const leafSize = width * 0.6;
        const leafX = (width - leafSize) / 2;
        const leafY = height - trunkHeight - leafSize;
        
        this.ctx.fillStyle = `rgb(${palette[1][0]}, ${palette[1][1]}, ${palette[1][2]})`;
        this.ctx.beginPath();
        this.ctx.arc(width / 2, height - trunkHeight - leafSize / 2, leafSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 小树叶
        const smallLeafSize = leafSize * 0.6;
        this.ctx.fillStyle = `rgb(${palette[2][0]}, ${palette[2][1]}, ${palette[2][2]})`;
        this.ctx.beginPath();
        this.ctx.arc(width / 2 - leafSize / 3, height - trunkHeight - leafSize / 2, smallLeafSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.arc(width / 2 + leafSize / 3, height - trunkHeight - leafSize / 2, smallLeafSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    // 绘制人物
    drawPerson(width, height, palette) {
        // 清理画布
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, width, height);
        
        // 定义颜色
        const skinColor = [255, 200, 170]; // 皮肤色
        const hairColor = [100, 50, 20]; // 头发色
        const suitColor = [30, 30, 60]; // 西装色
        const shirtColor = [255, 255, 255]; // 衬衫色
        const tieColor = [180, 20, 20]; // 领带色
        const shoeColor = [20, 20, 20]; // 鞋子色
        
        // 头部
        const headSize = Math.min(width, height) * 0.25;
        const headX = (width - headSize) / 2;
        const headY = height * 0.15;
        
        // 头发
        this.ctx.fillStyle = `rgb(${hairColor[0]}, ${hairColor[1]}, ${hairColor[2]})`;
        this.ctx.fillRect(headX, headY, headSize, headSize * 0.7);
        
        // 脸部
        this.ctx.fillStyle = `rgb(${skinColor[0]}, ${skinColor[1]}, ${skinColor[2]})`;
        this.ctx.fillRect(headX + headSize * 0.1, headY + headSize * 0.2, headSize * 0.8, headSize * 0.8);
        
        // 眼睛
        this.ctx.fillStyle = '#000';
        const eyeSize = headSize * 0.1;
        this.ctx.fillRect(headX + headSize * 0.3, headY + headSize * 0.4, eyeSize, eyeSize);
        this.ctx.fillRect(headX + headSize * 0.6, headY + headSize * 0.4, eyeSize, eyeSize);
        
        // 嘴巴
        this.ctx.fillRect(headX + headSize * 0.4, headY + headSize * 0.7, headSize * 0.2, headSize * 0.05);
        
        // 身体
        const bodyWidth = headSize * 1.2;
        const bodyHeight = headSize * 1.8;
        const bodyX = (width - bodyWidth) / 2;
        const bodyY = headY + headSize;
        
        // 西装外套
        this.ctx.fillStyle = `rgb(${suitColor[0]}, ${suitColor[1]}, ${suitColor[2]})`;
        this.ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
        
        // 衬衫领子
        this.ctx.fillStyle = `rgb(${shirtColor[0]}, ${shirtColor[1]}, ${shirtColor[2]})`;
        this.ctx.fillRect(bodyX + bodyWidth * 0.35, bodyY, bodyWidth * 0.3, bodyHeight * 0.2);
        
        // 领带
        this.ctx.fillStyle = `rgb(${tieColor[0]}, ${tieColor[1]}, ${tieColor[2]})`;
        this.ctx.fillRect(bodyX + bodyWidth * 0.45, bodyY + bodyHeight * 0.15, bodyWidth * 0.1, bodyHeight * 0.4);
        
        // 手臂
        const armWidth = headSize * 0.3;
        const armHeight = bodyHeight * 0.6;
        
        // 左臂
        this.ctx.fillStyle = `rgb(${suitColor[0]}, ${suitColor[1]}, ${suitColor[2]})`;
        this.ctx.fillRect(bodyX - armWidth, bodyY + bodyHeight * 0.1, armWidth, armHeight);
        
        // 右臂
        this.ctx.fillRect(bodyX + bodyWidth, bodyY + bodyHeight * 0.1, armWidth, armHeight);
        
        // 手
        this.ctx.fillStyle = `rgb(${skinColor[0]}, ${skinColor[1]}, ${skinColor[2]})`;
        this.ctx.fillRect(bodyX - armWidth, bodyY + bodyHeight * 0.6, armWidth, armWidth);
        this.ctx.fillRect(bodyX + bodyWidth, bodyY + bodyHeight * 0.6, armWidth, armWidth);
        
        // 腿
        const legWidth = headSize * 0.4;
        const legHeight = headSize * 1.5;
        
        this.ctx.fillStyle = `rgb(${suitColor[0]}, ${suitColor[1]}, ${suitColor[2]})`;
        this.ctx.fillRect(bodyX + bodyWidth * 0.2, bodyY + bodyHeight, legWidth, legHeight);
        this.ctx.fillRect(bodyX + bodyWidth * 0.45, bodyY + bodyHeight, legWidth, legHeight);
        
        // 鞋子
        this.ctx.fillStyle = `rgb(${shoeColor[0]}, ${shoeColor[1]}, ${shoeColor[2]})`;
        this.ctx.fillRect(bodyX + bodyWidth * 0.15, bodyY + bodyHeight + legHeight - legWidth * 0.3, legWidth * 1.2, legWidth * 0.3);
        this.ctx.fillRect(bodyX + bodyWidth * 0.4, bodyY + bodyHeight + legHeight - legWidth * 0.3, legWidth * 1.2, legWidth * 0.3);
        
        // 阴影
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(bodyX - headSize * 0.2, bodyY + bodyHeight + legHeight, bodyWidth + headSize * 0.4, legWidth * 0.2);
    }
    
    generateWithAI(type, size, colorCount) {
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        progressContainer.classList.add('active');
        progressText.textContent = 'AI生成中...';
        progressFill.style.width = '50%';
        
        try {
            if (DEBUG_ASSET) console.log('开始生成AI图案:', { type, size, colorCount });
            
            const result = AIGenerator.generatePattern(type, size, colorCount);
            
            if (DEBUG_ASSET) console.log('生成结果:', result);
            
            this.canvas.width = size;
            this.canvas.height = size;
            
            if (result.canvas) {
                // 使用生成的canvas
                this.ctx.drawImage(result.canvas, 0, 0);
            } else {
                // 直接在主画布上绘制简单图案
                if (DEBUG_ASSET) console.log('直接在主画布上绘制图案');
                this.drawSimplePattern(type, size, colorCount);
            }
            
            // 提取调色板
            if (result.palette && result.palette.length > 0) {
                this.palette = result.palette.slice(0, colorCount);
                this.generatePalette();
            }
            
            // 创建点阵资产
            this.createDotMatrixAsset();
            
            // 绘制网格
            this.renderGrid();
            
            progressText.textContent = '生成完成!';
            progressFill.style.width = '100%';
            
            setTimeout(() => {
                progressContainer.classList.remove('active');
            }, 1000);
            
            this.saveHistory();
            this.updateCanvasInfo();
            this.showNotification(`AI生成完成: ${type}`);
        } catch (error) {
            console.error('AI生成错误:', error);
            progressText.textContent = '生成失败!';
            progressFill.style.width = '100%';
            progressFill.style.backgroundColor = '#dc3545';
            
            setTimeout(() => {
                progressContainer.classList.remove('active');
                progressFill.style.backgroundColor = '';
            }, 2000);
            
            this.showNotification(`AI生成失败: ${error.message}`);
        }
    }
    
    // 直接在主画布上绘制简单图案
    drawSimplePattern(type, size, colorCount) {
        try {
            if (DEBUG_ASSET) console.log('绘制简单图案:', { type, size, colorCount });
            
            // 生成默认调色板（用于 noise/gradient 等）
            const palette = [];
            for (let i = 0; i < colorCount; i++) {
                const hue = (i / colorCount) * 360;
                const sat = 70 + Math.random() * 30;
                const light = 40 + Math.random() * 40;
                palette.push(this.hslToRgb(hue, sat, light));
            }
            let usedPalette = palette;
            
            // 清空画布
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, size, size);
            
            switch (type) {
                case 'house':
                case 'desk':
                case 'plant':
                case 'animal': {
                    const result = AIGenerator.generatePattern(type, size, colorCount);
                    if (result && result.canvas) {
                        this.ctx.drawImage(result.canvas, 0, 0, size, size);
                        if (result.palette && result.palette.length > 0) usedPalette = result.palette;
                    }
                    break;
                }
                case 'noise':
                    for (let y = 0; y < size; y++) {
                        for (let x = 0; x < size; x++) {
                            const color = palette[Math.floor(Math.random() * palette.length)];
                            this.ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                            this.ctx.fillRect(x, y, 1, 1);
                        }
                    }
                    break;
                case 'gradient':
                    const gradient = this.ctx.createLinearGradient(0, 0, size, size);
                    palette.forEach((color, i) => {
                        gradient.addColorStop(i / Math.max(1, palette.length - 1), `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
                    });
                    this.ctx.fillStyle = gradient;
                    this.ctx.fillRect(0, 0, size, size);
                    break;
                case 'checkerboard':
                    // 棋盘图案
                    const cellSize = Math.max(4, Math.floor(size / 8));
                    for (let y = 0; y < size; y += cellSize) {
                        for (let x = 0; x < size; x += cellSize) {
                            const colorIndex = ((x / cellSize) + (y / cellSize)) % 2;
                            const color = palette[colorIndex % palette.length];
                            this.ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                            this.ctx.fillRect(x, y, cellSize, cellSize);
                        }
                    }
                    break;
                case 'circles':
                    // 圆形图案
                    this.ctx.fillStyle = '#000';
                    this.ctx.fillRect(0, 0, size, size);
                    const count = 5 + Math.floor(Math.random() * 5);
                    for (let i = 0; i < count; i++) {
                        const x = Math.random() * size;
                        const y = Math.random() * size;
                        const r = 5 + Math.random() * (size / 4);
                        const color = palette[i % palette.length];
                        this.ctx.beginPath();
                        this.ctx.arc(x, y, r, 0, Math.PI * 2);
                        this.ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                        this.ctx.fill();
                    }
                    break;
                case 'stripes':
                    // 条纹图案
                    const stripeWidth = Math.max(4, Math.floor(size / 10));
                    for (let i = 0; i < size / stripeWidth; i++) {
                        const color = palette[i % palette.length];
                        this.ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                        this.ctx.fillRect(i * stripeWidth, 0, stripeWidth, size);
                    }
                    break;
                default:
                    const patterns = ['house', 'desk', 'plant', 'animal', 'checkerboard', 'circles', 'stripes'];
                    this.drawSimplePattern(patterns[Math.floor(Math.random() * patterns.length)], size, colorCount);
                    return; // 递归已处理调色板
            }
            // 同步调色板供 createDotMatrixAsset 使用
            this.palette = usedPalette;
            this.generatePalette();
        } catch (error) {
            console.error('绘制简单图案错误:', error);
            // 绘制错误提示
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, size, size);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('生成失败', size/2, size/2);
        }
    }
    
    // HSL转RGB
    hslToRgb(h, s, l) {
        s /= 100;
        l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
    }
    
    // ==================== 图片处理 ====================
    showUploadDialog() {
        document.getElementById('fileUpload').click();
    }
    
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            this.loadImage(file);
        }
        event.target.value = '';
    }
    
    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.displayOriginal();
                this.showNotification('图片已加载');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    displayOriginal() {
        if (!this.originalImage) return;
        
        const previewOriginal = document.getElementById('previewOriginal');
        previewOriginal.innerHTML = '';
        const img = document.createElement('img');
        img.src = this.originalImage.src;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        previewOriginal.appendChild(img);
        
        this.canvas.width = this.originalImage.width;
        this.canvas.height = this.originalImage.height;
        this.ctx.drawImage(this.originalImage, 0, 0);
        
        this.saveHistory();
        this.updateCanvasInfo();
    }
    
    // ==================== 转换 ====================
    async convertImage() {
        if (!this.originalImage) {
            alert('请先上传图片');
            return;
        }
        
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        progressContainer.classList.add('active');
        progressText.textContent = '正在准备...';
        progressFill.style.width = '10%';
        
        const gridCells = parseInt(document.getElementById('gridCells').value);
        const pixelsPerCell = parseInt(document.getElementById('pixelsPerCell').value);
        const colorCount = parseInt(document.getElementById('colorCount').value);
        const ditherMethod = document.getElementById('ditherMethod').value;
        const convertMethod = document.getElementById('convertMethod').value;
        
        const targetSize = gridCells * pixelsPerCell;
        
        if (convertMethod === 'ai') {
            // AI转换
            this.convertImageWithAI(targetSize, colorCount, progressContainer, progressFill, progressText);
        } else {
            // 传统转换
            this.convertImageTraditional(targetSize, colorCount, ditherMethod, progressContainer, progressFill, progressText);
        }
    }
    
    // 传统转换
    convertImageTraditional(targetSize, colorCount, ditherMethod, progressContainer, progressFill, progressText) {
        progressText.textContent = '正在分析颜色...';
        progressFill.style.width = '20%';
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = targetSize;
        tempCanvas.height = targetSize;
        
        tempCtx.drawImage(this.originalImage, 0, 0, targetSize, targetSize);
        
        progressText.textContent = '正在量化颜色...';
        progressFill.style.width = '50%';
        
        const imageData = tempCtx.getImageData(0, 0, targetSize, targetSize);
        
        // 颜色量化
        this.palette = ColorQuantizer.medianCut(imageData, colorCount);
        this.generatePalette();
        
        progressText.textContent = '正在应用抖动...';
        progressFill.style.width = '80%';
        
        // 应用抖动
        let convertedData;
        if (ditherMethod === 'bayer') {
            convertedData = Dithering.bayer(imageData, this.palette, targetSize, targetSize);
        } else {
            // 无抖动
            const data = new Uint8ClampedArray(imageData.data);
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] < 128) continue;
                const closest = ColorQuantizer.findClosestColor([data[i], data[i + 1], data[i + 2]], this.palette);
                const color = this.palette[closest];
                data[i] = color[0];
                data[i + 1] = color[1];
                data[i + 2] = color[2];
            }
            convertedData = new ImageData(data, targetSize, targetSize);
        }
        
        this.canvas.width = targetSize;
        this.canvas.height = targetSize;
        this.ctx.putImageData(convertedData, 0, 0);
        
        this.finishConversion(progressContainer, progressFill, progressText);
    }
    
    // AI转换
    convertImageWithAI(targetSize, colorCount, progressContainer, progressFill, progressText) {
        progressText.textContent = 'AI分析图片...';
        progressFill.style.width = '30%';
        
        // 分析图片内容
        const description = this.analyzeImageContent();
        if (DEBUG_ASSET) console.log('AI分析结果:', description);
        
        progressText.textContent = 'AI生成点阵图...';
        progressFill.style.width = '60%';
        
        // 调整画布大小
        this.canvas.width = targetSize;
        this.canvas.height = targetSize;
        
        // 根据分析结果生成点阵图
        this.drawPatternByDescription(description, targetSize, targetSize, colorCount);
        
        this.finishConversion(progressContainer, progressFill, progressText);
    }
    
    // 分析图片内容
    analyzeImageContent() {
        // 这里使用简单的颜色分析来判断图片内容
        // 实际项目中可以使用更复杂的图像识别算法
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = 100;
        tempCanvas.height = 100;
        tempCtx.drawImage(this.originalImage, 0, 0, 100, 100);
        
        const imageData = tempCtx.getImageData(0, 0, 100, 100);
        const data = imageData.data;
        
        // 统计颜色分布
        let redSum = 0, greenSum = 0, blueSum = 0;
        let pixelCount = 0;
        
        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha > 128) {
                redSum += data[i];
                greenSum += data[i + 1];
                blueSum += data[i + 2];
                pixelCount++;
            }
        }
        
        if (pixelCount === 0) return 'abstract';
        
        const avgRed = redSum / pixelCount;
        const avgGreen = greenSum / pixelCount;
        const avgBlue = blueSum / pixelCount;
        
        // 根据颜色特征判断内容
        if (avgRed > 150 && avgGreen < 100 && avgBlue < 100) {
            return 'building'; // 红色为主，可能是建筑
        } else if (avgGreen > 150 && avgRed < 100 && avgBlue < 100) {
            return 'tree'; // 绿色为主，可能是植物
        } else if (avgRed > 200 && avgGreen > 180 && avgBlue > 150) {
            return 'person'; // 浅色为主，可能是人物
        } else if (avgBlue > 150 && avgRed < 100 && avgGreen < 100) {
            return 'sky'; // 蓝色为主，可能是天空
        } else {
            return 'abstract'; // 其他情况
        }
    }
    
    // 完成转换
    finishConversion(progressContainer, progressFill, progressText) {
        // 创建点阵资产
        this.createDotMatrixAsset();
        
        // 绘制网格
        this.renderGrid();
        
        // 显示预览
        this.convertedImage = this.canvas.toDataURL();
        const previewConverted = document.getElementById('previewConverted');
        previewConverted.innerHTML = '';
        const img = document.createElement('img');
        img.src = this.convertedImage;
        previewConverted.appendChild(img);
        
        progressText.textContent = '转换完成！';
        progressFill.style.width = '100%';
        
        setTimeout(() => {
            progressContainer.classList.remove('active');
        }, 1000);
        
        this.saveHistory();
        this.updateCanvasInfo();
        this.showNotification('转换完成');
    }
    
    // 创建点阵资产
    createDotMatrixAsset() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        if (width <= 0 || height <= 0) return;
        
        // 确保调色板有效
        if (!this.palette || this.palette.length === 0) {
            this.palette = [
                [0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 255, 0],
                [0, 0, 255], [255, 255, 0], [255, 0, 255], [0, 255, 255],
                [128, 128, 128], [192, 192, 192]
            ];
            this.generatePalette();
        }
        
        const imageData = this.ctx.getImageData(0, 0, width, height);
        
        // 提取像素数据（调色板索引）
        const pixelData = new Uint8Array(width * height);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            const a = imageData.data[i + 3];
            
            if (a < 128) {
                pixelData[i / 4] = 255; // 透明标记
            } else {
                pixelData[i / 4] = ColorQuantizer.findClosestColor([r, g, b], this.palette);
            }
        }
        
        const gridCellsEl = document.getElementById('gridCells');
        const pixelsPerCellEl = document.getElementById('pixelsPerCell');
        const gridCells = gridCellsEl ? Math.max(CONFIG.MIN_GRID_CELLS, Math.min(CONFIG.MAX_GRID_CELLS, parseInt(gridCellsEl.value) || CONFIG.DEFAULT_GRID_CELLS)) : CONFIG.DEFAULT_GRID_CELLS;
        const pixelsPerCell = pixelsPerCellEl ? Math.max(1, parseInt(pixelsPerCellEl.value) || Math.ceil(CONFIG.DEFAULT_TARGET_SIZE / CONFIG.DEFAULT_GRID_CELLS)) : Math.ceil(CONFIG.DEFAULT_TARGET_SIZE / CONFIG.DEFAULT_GRID_CELLS);
        
        this.currentAsset = new DotMatrixAsset(
            `Asset_${Date.now()}`,
            width,
            height,
            this.palette,
            pixelData,
            gridCells,
            pixelsPerCell
        );
    }
    
    // ==================== 调色板 ====================
    generatePalette() {
        const container = document.getElementById('paletteContainer');
        container.innerHTML = '';
        
        if (this.palette.length === 0) {
            this.palette = [
                [0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 255, 0],
                [0, 0, 255], [255, 255, 0], [255, 0, 255], [0, 255, 255],
                [128, 128, 128], [192, 192, 192], [128, 0, 0], [0, 128, 0],
                [0, 0, 128], [128, 128, 0], [128, 0, 128], [0, 128, 128]
            ];
        }
        
        this.palette.forEach((color, index) => {
            const div = document.createElement('div');
            div.className = 'palette-color' + (index === this.selectedColor ? ' selected' : '');
            div.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            div.onclick = () => this.selectColor(index);
            container.appendChild(div);
        });
    }
    
    selectColor(index) {
        this.selectedColor = index;
        document.querySelectorAll('.palette-color').forEach((el, i) => {
            el.classList.toggle('selected', i === index);
        });
    }
    
    // ==================== 像素编辑 ====================
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        if (this.currentTool === 'crop') {
            this.cropStart = { x, y };
            this.cropEnd = { x, y };
            this.pendingCropRect = null;
            this.isDrawing = true;
            return;
        }
        
        this.isDrawing = true;
        this.lastX = x;
        this.lastY = y;
        this.drawPixel(x, y);
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        if (this.currentTool === 'crop' && this.isDrawing && this.cropStart) {
            this.cropEnd = { x, y };
            this.renderCropOverlay();
            return;
        }
        
        if (!this.isDrawing) return;
        
        this.drawLine(this.lastX, this.lastY, x, y);
        this.lastX = x;
        this.lastY = y;
    }
    
    handleMouseUp() {
        if (this.currentTool === 'crop' && this.isDrawing && this.cropStart) {
            const minX = Math.min(this.cropStart.x, this.cropEnd.x);
            const minY = Math.min(this.cropStart.y, this.cropEnd.y);
            const w = Math.abs(this.cropEnd.x - this.cropStart.x) + 1;
            const h = Math.abs(this.cropEnd.y - this.cropStart.y) + 1;
            if (w >= 4 && h >= 4) {
                this.pendingCropRect = { x: minX, y: minY, w, h };
                this.showCropConfirmDialog();
            }
            this.isDrawing = false;
            this.cropStart = null;
            this.cropEnd = null;
            this.renderCropOverlay();
            return;
        }
        
        if (this.isDrawing) {
            this.isDrawing = false;
            this.createDotMatrixAsset(); // 更新资产
            this.saveHistory();
        }
    }
    
    drawPixel(x, y) {
        if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) return;
        
        if (this.currentTool === 'grid') {
            this.drawGridCell(x, y);
        } else if (this.currentTool === 'eraser') {
            this.eraseGridCell(x, y);
        } else if (this.currentTool === 'picker') {
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const idx = (y * this.canvas.width + x) * 4;
            const r = imageData.data[idx], g = imageData.data[idx + 1], b = imageData.data[idx + 2], a = imageData.data[idx + 3];
            if (a > 10 && this.palette.length > 0) {
                const closest = ColorQuantizer.findClosestColor([r, g, b], this.palette);
                this.selectColor(closest);
                this.showNotification(`已取色 #${((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1)}`);
            }
            this.setTool('grid');
        } else if (this.currentTool === 'fill') {
            this.floodFill(x, y);
        }
    }
    
    // 格子橡皮：擦除整格
    eraseGridCell(x, y) {
        const cellSize = this.pixelsPerCell;
        const gridX = Math.floor(x / cellSize) * cellSize;
        const gridY = Math.floor(y / cellSize) * cellSize;
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        for (let py = gridY; py < gridY + cellSize && py < this.canvas.height; py++) {
            for (let px = gridX; px < gridX + cellSize && px < this.canvas.width; px++) {
                const idx = (py * this.canvas.width + px) * 4 + 3;
                imageData.data[idx] = 0;
            }
        }
        this.ctx.putImageData(imageData, 0, 0);
        this.renderGrid();
    }
    
    floodFill(startX, startY) {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        const w = this.canvas.width, h = this.canvas.height;
        const idx = (startY * w + startX) * 4;
        const startR = data[idx], startG = data[idx+1], startB = data[idx+2], startA = data[idx+3];
        const color = this.palette[this.selectedColor] || [0,0,0];
        const fillR = color[0], fillG = color[1], fillB = color[2];
        const same = (i) => data[i]===startR && data[i+1]===startG && data[i+2]===startB && data[i+3]===startA;
        const stack = [[startX, startY]];
        let count = 0;
        const maxFill = w * h;
        while (stack.length > 0 && count < maxFill) {
            const [x, y] = stack.pop();
            if (x < 0 || x >= w || y < 0 || y >= h) continue;
            const i = (y * w + x) * 4;
            if (!same(i)) continue;
            data[i]=fillR; data[i+1]=fillG; data[i+2]=fillB; data[i+3]=255;
            count++;
            stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
        }
        this.ctx.putImageData(imageData, 0, 0);
        this.renderGrid();
    }
    
    drawGridCell(x, y) {
        const cellSize = this.pixelsPerCell;
        const gridX = Math.floor(x / cellSize) * cellSize;
        const gridY = Math.floor(y / cellSize) * cellSize;
        
        const color = this.palette[this.selectedColor];
        this.ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        this.ctx.fillRect(gridX, gridY, cellSize, cellSize);
        
        this.renderGrid();
    }
    
    drawLine(x0, y0, x1, y1) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        
        while (true) {
            this.drawPixel(x0, y0);
            
            if (x0 === x1 && y0 === y1) break;
            
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
    }
    
    // ==================== 网格渲染 ====================
    renderGrid() {
        const overlay = document.getElementById('gridOverlay');
        if (!overlay || !this.gridCells || !this.pixelsPerCell) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cellSize = this.pixelsPerCell;
        const rect = this.canvas.getBoundingClientRect();
        
        overlay.width = width;
        overlay.height = height;
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += cellSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += cellSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 2;
        for (let x = 0; x <= width; x += cellSize * 5) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += cellSize * 5) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(233, 69, 96, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, width, height);
    }
    
    // 绘制裁剪选区
    renderCropOverlay() {
        const overlay = document.getElementById('cropOverlay');
        if (!overlay) return;
        if (!this.cropStart || !this.cropEnd) {
            overlay.style.display = 'none';
            return;
        }
        overlay.style.display = 'block';
        const rect = this.canvas.getBoundingClientRect();
        overlay.width = this.canvas.width;
        overlay.height = this.canvas.height;
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        const minX = Math.min(this.cropStart.x, this.cropEnd.x);
        const minY = Math.min(this.cropStart.y, this.cropEnd.y);
        const w = Math.abs(this.cropEnd.x - this.cropStart.x) + 1;
        const h = Math.abs(this.cropEnd.y - this.cropStart.y) + 1;
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(minX, minY, w, h);
        ctx.fillStyle = 'rgba(233, 69, 96, 0.15)';
        ctx.fillRect(minX, minY, w, h);
    }
    
    startCropMode() {
        this.setTool('crop');
        this.cropStart = null;
        this.cropEnd = null;
        this.pendingCropRect = null;
        const ov = document.getElementById('cropOverlay');
        if (ov) ov.style.display = 'none';
        this.canvas.style.cursor = 'crosshair';
        this.showNotification('拖拽选择裁剪区域');
    }
    
    showCropConfirmDialog() {
        const d = document.getElementById('cropConfirmDialog');
        if (d) {
            d.style.display = 'flex';
        }
    }
    
    cancelCrop() {
        const d = document.getElementById('cropConfirmDialog');
        if (d) d.style.display = 'none';
        this.pendingCropRect = null;
        const ov = document.getElementById('cropOverlay');
        if (ov) ov.style.display = 'none';
        this.setTool('pencil');
    }
    
    applyCrop(overwrite) {
        document.getElementById('cropConfirmDialog').style.display = 'none';
        const r = this.pendingCropRect;
        if (!r || r.w < 4 || r.h < 4) {
            this.pendingCropRect = null;
            this.setTool('pencil');
            return;
        }
        const temp = document.createElement('canvas');
        temp.width = r.w;
        temp.height = r.h;
        const tctx = temp.getContext('2d');
        tctx.drawImage(this.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        if (overwrite) {
            this.saveHistory();
            this.canvas.width = r.w;
            this.canvas.height = r.h;
            this.ctx.drawImage(temp, 0, 0);
            this.createDotMatrixAsset();
            this.renderGrid();
            this.saveHistory();
            this.updateCanvasInfo();
            this.applyZoom();
            this.setTool('pencil');
            this.showNotification('裁剪完成，已覆盖');
        } else {
            const dataUrl = temp.toDataURL('image/png');
            const img = new Image();
            img.onload = () => {
                this.saveHistory();
                this.canvas.width = img.width;
                this.canvas.height = img.height;
                this.ctx.drawImage(img, 0, 0);
                this.createDotMatrixAsset();
                this.renderGrid();
                this.saveHistory();
                this.updateCanvasInfo();
                this.applyZoom();
                this.setTool('pencil');
                this.saveToLibrary();
                this.showNotification('裁剪完成，已另存到资产库');
            };
            img.src = dataUrl;
        }
        this.pendingCropRect = null;
        const ov = document.getElementById('cropOverlay');
        if (ov) ov.style.display = 'none';
    }
    
    // ==================== 工具 ====================
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`tool-${tool}`)?.classList.add('active');
        
        const cursors = { eraser: 'cell', picker: 'copy', fill: 'pointer', grid: 'cell', crop: 'crosshair' };
        this.canvas.style.cursor = cursors[tool] || 'default';
    }
    
    // ==================== 历史记录 ====================
    saveHistory() {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push(this.canvas.toDataURL());
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            // 当移除第一个元素时，历史索引也需要减1
            if (this.historyIndex > 0) {
                this.historyIndex--;
            }
        } else {
            this.historyIndex++;
        }
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreFromHistory();
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreFromHistory();
        }
    }
    
    restoreFromHistory() {
        const img = new Image();
        img.onload = () => {
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            this.ctx.drawImage(img, 0, 0);
            this.renderGrid();
            this.createDotMatrixAsset();
        };
        img.src = this.history[this.historyIndex];
    }
    
    // ==================== 缩放 ====================
    zoomIn() {
        if (this.zoomIndex < CONFIG.ZOOM_LEVELS.length - 1) {
            this.zoomIndex++;
            this.applyZoom();
        }
    }
    
    zoomOut() {
        if (this.zoomIndex > 0) {
            this.zoomIndex--;
            this.applyZoom();
        }
    }
    
    resetZoom() {
        this.zoomIndex = CONFIG.DEFAULT_ZOOM_INDEX;
        this.applyZoom();
    }
    
    applyZoom() {
        const zoom = CONFIG.ZOOM_LEVELS[this.zoomIndex];
        this.canvas.style.width = (this.canvas.width * zoom) + 'px';
        this.canvas.style.height = (this.canvas.height * zoom) + 'px';
        this.updateCanvasInfo();
        this.renderGrid();
    }
    
    // ==================== 画布操作 ====================
    clearCanvas() {
        // 检查画布是否有内容
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        let hasContent = false;
        
        for (let i = 0; i < imageData.data.length; i += 4) {
            const alpha = imageData.data[i + 3];
            if (alpha > 0) {
                hasContent = true;
                break;
            }
        }
        
        // 如果有内容，显示确认对话框
        if (hasContent) {
            if (confirm('确定要清除画布吗？此操作不可撤销。')) {
                this.doClearCanvas();
            }
        } else {
            this.doClearCanvas();
        }
    }
    
    doClearCanvas() {
        // 保存当前状态到历史记录
        this.saveHistory();
        
        // 清除画布
        this.ctx.fillStyle = '#2d2d44';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 重新绘制网格
        this.renderGrid();
        
        // 创建空的点阵资产
        this.createDotMatrixAsset();
        
        this.showNotification('画布已清除');
    }
    
    // ==================== 键盘快捷键 ====================
    handleKeyDown(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) this.redo();
                    else this.undo();
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
                case 's':
                    e.preventDefault();
                    this.saveToLibrary();
                    break;
            }
        }
        
        switch (e.key) {
            case 'e': this.setTool('eraser'); break;
            case 'i': this.setTool('picker'); break;
            case 'g': this.setTool('grid'); break;
            case 'f': this.setTool('fill'); break;
        }
    }
    
    // ==================== UI 更新 ====================
    updateConvertParams() {
        const colorCount = document.getElementById('colorCount').value;
        document.getElementById('colorCountValue').textContent = colorCount;
        
        const gridCells = parseInt(document.getElementById('gridCells').value);
        const pixelsPerCell = parseInt(document.getElementById('pixelsPerCell').value);
        const finalSize = gridCells * pixelsPerCell;
        document.getElementById('finalSize').textContent = `${finalSize} x ${finalSize}`;
        
        // 更新配置
        this.gridCells = gridCells;
        this.pixelsPerCell = pixelsPerCell;
    }
    
    updateCanvasInfo() {
        const zoom = CONFIG.ZOOM_LEVELS[this.zoomIndex];
        document.getElementById('canvasInfo').textContent = 
            `${this.canvas.width} x ${this.canvas.height} px | 缩放: ${Math.round(zoom * 100)}% | 格子: ${this.gridCells}x${this.gridCells}`;
    }
    
    updateUI() {
        this.generatePalette();
    }
    
    // ==================== 资产管理 ====================
    saveToLibrary() {
        if (!this.currentAsset) {
            this.createDotMatrixAsset();
        }
        
        if (!this.currentAsset) {
            alert('没有可保存的资产');
            return;
        }
        
        const id = Date.now();
        const asset = {
            id,
            name: this.currentAsset.name,
            asset: this.currentAsset,
            preview: this.canvas.toDataURL(),
            date: new Date().toLocaleString()
        };
        
        this.assets.set(id, asset);
        this.addAssetToLibrary(asset);
        this.showNotification('已保存到资产库');
    }
    
    addAssetToLibrary(asset) {
        const libraryContent = document.getElementById('libraryContent');
        let grid = libraryContent?.querySelector('[data-category="dotmatrix"]');
        if (!grid) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'asset-category';
            categoryDiv.innerHTML = '<div class="asset-category-title">🔴 点阵资产</div><div class="asset-grid" data-category="dotmatrix"></div>';
            libraryContent?.appendChild(categoryDiv);
            grid = categoryDiv.querySelector('.asset-grid');
        }
        
        const assetDiv = document.createElement('div');
        assetDiv.className = 'asset-item';
        assetDiv.dataset.id = asset.id;
        assetDiv.innerHTML = `
            <img src="${asset.preview}" alt="${asset.name}">
            <span class="asset-name">${asset.name}</span>
        `;
        
        assetDiv.onclick = () => this.loadAsset(asset);
        
        grid.appendChild(assetDiv);
    }
    
    loadAsset(asset) {
        const dotAsset = asset.asset;
        
        // 恢复画布
        this.canvas.width = dotAsset.width;
        this.canvas.height = dotAsset.height;
        
        // 恢复调色板
        this.palette = dotAsset.palette;
        this.generatePalette();
        
        // 恢复像素数据
        const imageData = this.ctx.createImageData(dotAsset.width, dotAsset.height);
        for (let i = 0; i < dotAsset.pixelData.length; i++) {
            const paletteIndex = dotAsset.pixelData[i];
            if (paletteIndex === 255) {
                // 透明
                imageData.data[i * 4 + 3] = 0;
            } else {
                const color = dotAsset.palette[paletteIndex];
                imageData.data[i * 4] = color[0];
                imageData.data[i * 4 + 1] = color[1];
                imageData.data[i * 4 + 2] = color[2];
                imageData.data[i * 4 + 3] = 255;
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
        
        // 恢复格子设置
        document.getElementById('gridCells').value = dotAsset.gridCells;
        document.getElementById('pixelsPerCell').value = dotAsset.pixelsPerCell;
        this.gridCells = dotAsset.gridCells;
        this.pixelsPerCell = dotAsset.pixelsPerCell;
        
        this.currentAsset = dotAsset;
        this.renderGrid();
        this.saveHistory();
        this.updateCanvasInfo();
        this.updateConvertParams();
        
        this.showNotification(`已加载: ${dotAsset.name}`);
    }
    
    // ==================== 导出 ====================
    exportProject() {
        if (this.assets.size === 0) {
            alert('资产库为空');
            return;
        }
        
        const exportData = {
            version: '1.0',
            date: new Date().toISOString(),
            format: 'openclaw-project',
            assets: Array.from(this.assets.values()).map(item => ({
                id: item.id,
                name: item.name,
                data: item.asset.toJSON()
            }))
        };
        
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'openclaw-project.json';
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('项目已导出');
    }
    
    // 导出点阵文件
    exportDotMatrix() {
        if (!this.currentAsset) {
            alert('没有可导出的点阵资产');
            return;
        }
        
        const binary = this.currentAsset.toBinary();
        const blob = new Blob([binary], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentAsset.name}.ocdm`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('点阵文件已导出');
    }
    
    // 导出到地图编辑器
    exportToMapEditor() {
        if (!this.currentAsset) {
            alert('没有可导出的点阵资产');
            return;
        }
        
        // 将画布转换为图片
        const imageData = this.canvas.toDataURL('image/png');
        
        // 保存到localStorage，供地图编辑器使用
        const assetData = {
            name: this.currentAsset.name,
            image: imageData,
            width: this.currentAsset.width,
            height: this.currentAsset.height,
            gridCells: this.currentAsset.gridCells,
            pixelsPerCell: this.currentAsset.pixelsPerCell,
            timestamp: Date.now()
        };
        
        // 存储到localStorage
        let mapEditorAssets = JSON.parse(localStorage.getItem('mapEditorAssets') || '[]');
        mapEditorAssets.push(assetData);
        // 限制存储数量
        if (mapEditorAssets.length > 50) {
            mapEditorAssets = mapEditorAssets.slice(-50);
        }
        localStorage.setItem('mapEditorAssets', JSON.stringify(mapEditorAssets));
        
        this.showNotification('已导出到地图编辑器');
        
        // 跳转到地图编辑器
        setTimeout(() => {
            window.location.href = 'editor.html';
        }, 1000);
    }
    
    // ==================== 标签切换 ====================
    switchTab(tab) {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        event.target.classList.add('active');
        
        if (tab === 'ai') {
            this.showAIGenerator();
        }
    }
    
    // ==================== 通知 ====================
    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #00d9a3, #00b386);
            color: white;
            padding: 14px 24px;
            border-radius: 10px;
            font-size: 14px;
            z-index: 3000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 5px 20px rgba(0, 217, 163, 0.4);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2500);
    }
}

// ==================== 初始化 ====================
let system;

document.addEventListener('DOMContentLoaded', () => {
    system = new AssetSystem();
});

// CSS 动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
