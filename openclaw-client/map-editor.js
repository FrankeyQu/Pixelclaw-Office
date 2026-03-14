/**
 * Pixelclaw Office 地图编辑器
 * 支持精确像素控制、画布大小设置、元素尺寸自定义
 */

// ==================== 配置 ====================
const CONFIG = {
    CANVAS_WIDTH: 1000,
    CANVAS_HEIGHT: 750,
    GRID_SIZE: 20,
    SNAP_TO_GRID: true,
    DEFAULT_ELEMENT_WIDTH: 4,  // 默认4个像素块宽
    DEFAULT_ELEMENT_HEIGHT: 4  // 默认4个像素块高
};

// ==================== 元素类 ====================
class MapElement {
    constructor(id, type, x, y, image, name, pixelBlocks = { w: 4, h: 4 }) {
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.image = image;
        this.name = name || `元素${id}`;
        
        // 像素块尺寸（以像素格为单位）
        this.pixelBlocks = {
            w: pixelBlocks.w || CONFIG.DEFAULT_ELEMENT_WIDTH,
            h: pixelBlocks.h || CONFIG.DEFAULT_ELEMENT_HEIGHT
        };
        
        // 实际像素尺寸
        this.width = this.pixelBlocks.w * CONFIG.GRID_SIZE;
        this.height = this.pixelBlocks.h * CONFIG.GRID_SIZE;
        
        // 属性
        this.properties = {
            solid: true,
            interactive: false,
            locked: false,
            layer: 1,
            opacity: 1,
            rotation: 0,
            scale: 1,
            flipH: false,
            flipV: false
        };
        
        // 碰撞边界 - 使用像素块矩阵，动态大小
        this.collisionBounds = this.createDefaultCollisionBounds();
        
        this.selected = false;
        this.dragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    // 创建默认碰撞边界（中心区域）
    createDefaultCollisionBounds() {
        const bounds = [];
        for (let row = 0; row < this.pixelBlocks.h; row++) {
            const rowArr = [];
            for (let col = 0; col < this.pixelBlocks.w; col++) {
                // 默认中心区域有碰撞
                const centerRowStart = Math.floor(this.pixelBlocks.h * 0.25);
                const centerRowEnd = Math.floor(this.pixelBlocks.h * 0.75);
                const centerColStart = Math.floor(this.pixelBlocks.w * 0.25);
                const centerColEnd = Math.floor(this.pixelBlocks.w * 0.75);
                
                const isCenter = row >= centerRowStart && row < centerRowEnd &&
                                col >= centerColStart && col < centerColEnd;
                rowArr.push(isCenter);
            }
            bounds.push(rowArr);
        }
        return bounds;
    }

    // 更新像素块尺寸
    updatePixelBlocks(w, h) {
        this.pixelBlocks.w = Math.max(1, Math.min(50, w));
        this.pixelBlocks.h = Math.max(1, Math.min(50, h));
        this.width = this.pixelBlocks.w * CONFIG.GRID_SIZE;
        this.height = this.pixelBlocks.h * CONFIG.GRID_SIZE;
        
        // 重新创建碰撞边界，保留原有设置
        const newBounds = [];
        for (let row = 0; row < this.pixelBlocks.h; row++) {
            const rowArr = [];
            for (let col = 0; col < this.pixelBlocks.w; col++) {
                // 如果之前有设置，保留；否则使用默认值
                if (row < this.collisionBounds.length && col < this.collisionBounds[0].length) {
                    rowArr.push(this.collisionBounds[row][col]);
                } else {
                    const centerRowStart = Math.floor(this.pixelBlocks.h * 0.25);
                    const centerRowEnd = Math.floor(this.pixelBlocks.h * 0.75);
                    const centerColStart = Math.floor(this.pixelBlocks.w * 0.25);
                    const centerColEnd = Math.floor(this.pixelBlocks.w * 0.75);
                    const isCenter = row >= centerRowStart && row < centerRowEnd &&
                                    col >= centerColStart && col < centerColEnd;
                    rowArr.push(isCenter);
                }
            }
            newBounds.push(rowArr);
        }
        this.collisionBounds = newBounds;
    }

    // 对齐到网格
    snapToGrid() {
        if (CONFIG.SNAP_TO_GRID) {
            this.x = Math.round(this.x / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE;
            this.y = Math.round(this.y / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE;
        }
    }

    // 获取实际碰撞区域（像素坐标）
    getCollisionRects() {
        const cellW = this.width / this.pixelBlocks.w;
        const cellH = this.height / this.pixelBlocks.h;
        const rects = [];
        
        for (let row = 0; row < this.pixelBlocks.h; row++) {
            for (let col = 0; col < this.pixelBlocks.w; col++) {
                if (this.collisionBounds[row][col]) {
                    rects.push({
                        x: this.x + col * cellW,
                        y: this.y + row * cellH,
                        width: cellW,
                        height: cellH
                    });
                }
            }
        }
        return rects;
    }

    // 检查点是否在碰撞区域内
    containsPoint(x, y) {
        const rects = this.getCollisionRects();
        return rects.some(rect => 
            x >= rect.x && x <= rect.x + rect.width &&
            y >= rect.y && y <= rect.y + rect.height
        );
    }

    // 获取边界框（用于选择）
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    // 获取图片绘制区域（去除透明边框）
    getImageDrawRect() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// ==================== 地图编辑器类 ====================
class MapEditor {
    constructor() {
        this.canvas = document.getElementById('editorCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;

        this.elements = [];
        this.assets = new Map();
        this.selectedElement = null;
        this.currentTool = 'select';
        this.collisionEditMode = false;  // 碰撞编辑模式：在画布上点击元素内格子切换碰撞
        this.showGrid = true;
        this.nextId = 1;

        this.dragState = {
            isDragging: false,
            element: null,
            startX: 0,
            startY: 0,
            offsetX: 0,
            offsetY: 0
        };

        this.resizeState = {
            isResizing: false,
            element: null,
            handle: 0,
            startX: 0,
            startY: 0,
            startElX: 0,
            startElY: 0,
            startW: 0,
            startH: 0
        };

        this.templates = [];
        this.cKeyHeld = false;

        // 撤销/重做
        this.undoStack = [];
        this.redoStack = [];
        this.MAX_HISTORY = 30;
        this.isRestoring = false;

        // 像素绘制层（格子笔、格子橡皮、取色、填充）
        this.drawLayer = null;
        this.drawLayerCtx = null;
        this.palette = this.getDefaultPalette();
        this.selectedColor = 0;
        this.isPixelDrawing = false;
        this.lastPixelCell = null;

        // 碰撞编辑拖动：连续选择；Shift+拖动为横列/纵列
        this.collisionDrawState = { active: false, startRow: 0, startCol: 0, lastRow: -1, lastCol: -1, setValue: true };

        // 裁剪模式（WPS 风格，8 个控制点，蓝色虚线框）
        this.cropMode = false;
        this.cropElement = null;
        this.cropRect = null;  // 元素局部坐标 { x, y, w, h }
        this.cropDragState = { active: false, handle: -1, startX: 0, startY: 0, startRect: null };

        // 区域标签（会议室、研发区等）
        this.regionLabels = [];
        this.selectedLabel = null;
        this.nextLabelId = 1;
        this.labelDragState = { isDragging: false, label: null, offsetX: 0, offsetY: 0 };

        this.init();
    }

    getDefaultPalette() {
        return [
            [0, 0, 0], [255, 255, 255], [200, 50, 50], [50, 150, 50], [50, 50, 200],
            [255, 200, 50], [200, 50, 200], [50, 200, 200], [150, 100, 50],
            [100, 100, 100], [180, 180, 180], [255, 100, 100], [100, 200, 100],
            [100, 100, 255], [255, 220, 100]
        ];
    }

    initDrawLayer() {
        this.drawLayer = document.createElement('canvas');
        this.drawLayer.width = this.canvas.width;
        this.drawLayer.height = this.canvas.height;
        this.drawLayerCtx = this.drawLayer.getContext('2d');
        this.drawLayerCtx.clearRect(0, 0, this.drawLayer.width, this.drawLayer.height);
        this.renderPaletteUI();
    }

    resizeDrawLayer() {
        if (!this.drawLayer || !this.drawLayerCtx) return;
        const oldW = this.drawLayer.width;
        const oldH = this.drawLayer.height;
        const newW = this.canvas.width;
        const newH = this.canvas.height;
        if (oldW === newW && oldH === newH) return;
        const temp = document.createElement('canvas');
        temp.width = oldW;
        temp.height = oldH;
        temp.getContext('2d').drawImage(this.drawLayer, 0, 0);
        this.drawLayer.width = newW;
        this.drawLayer.height = newH;
        this.drawLayerCtx.clearRect(0, 0, newW, newH);
        this.drawLayerCtx.drawImage(temp, 0, 0);
    }

    renderPaletteUI() {
        const strip = document.getElementById('paletteStrip');
        if (!strip) return;
        strip.innerHTML = '';
        this.palette.forEach((c, i) => {
            const swatch = document.createElement('div');
            swatch.style.cssText = `width:20px;height:20px;background:rgb(${c[0]},${c[1]},${c[2]});border:2px solid ${i === this.selectedColor ? '#e94560' : '#555'};cursor:pointer;border-radius:4px;`;
            swatch.title = `颜色 ${i + 1}`;
            swatch.onclick = () => this.selectColor(i);
            strip.appendChild(swatch);
        });
    }

    selectColor(index) {
        this.selectedColor = Math.max(0, Math.min(index, this.palette.length - 1));
        this.renderPaletteUI();
    }

    // ==================== 撤销/重做 ====================
    saveState() {
        if (this.isRestoring) return;
        const state = {
            regionLabels: this.regionLabels.map(l => ({ ...l })),
            nextLabelId: this.nextLabelId,
            selectedLabelId: this.selectedLabel ? this.selectedLabel.id : null,
            elements: this.elements.map(el => ({
                id: el.id,
                type: el.type,
                x: el.x,
                y: el.y,
                pixelBlocks: { ...el.pixelBlocks },
                name: el.name,
                properties: { ...el.properties },
                collisionBounds: el.collisionBounds.map(r => [...r]),
                assetKey: el.assetKey,
                imageSrc: el.image && el.image.complete ? el.image.src : null
            })),
            drawLayer: this.drawLayer && this.drawLayer.width > 0 ? this.drawLayer.toDataURL('image/png') : null,
            nextId: this.nextId,
            selectedId: this.selectedElement ? this.selectedElement.id : null
        };
        this.undoStack.push(state);
        if (this.undoStack.length > this.MAX_HISTORY) this.undoStack.shift();
        this.redoStack = [];
        this.updateUndoRedoUI();
    }

    async restoreState(state) {
        this.isRestoring = true;
        this.elements = [];
        this.selectedElement = null;
        this.regionLabels = (state.regionLabels || []).map(l => ({ ...l }));
        this.nextLabelId = state.nextLabelId || 1;
        this.selectedLabel = this.regionLabels.find(l => l.id === state.selectedLabelId) || null;
        this.nextId = state.nextId || 1;
        const selId = state.selectedId;

        const loadEl = (elData) => new Promise((resolve) => {
            let src = elData.imageSrc;
            if (!src && elData.assetKey && this.assets.has(elData.assetKey)) {
                const asset = this.assets.get(elData.assetKey);
                src = asset.image && asset.image.complete ? asset.image.src : '';
            }
            if (!src) { resolve(); return; }
            const img = new Image();
            img.onload = () => {
                const el = new MapElement(elData.id, elData.type, elData.x, elData.y, img, elData.name, elData.pixelBlocks);
                el.properties = elData.properties || { solid: true, interactive: false, locked: false, layer: 1, opacity: 1, rotation: 0, scale: 1 };
                if (elData.collisionBounds && elData.collisionBounds.length === el.pixelBlocks.h) {
                    el.collisionBounds = elData.collisionBounds.map(r => Array.isArray(r) ? [...r] : []);
                }
                if (elData.assetKey) el.assetKey = elData.assetKey;
                this.elements.push(el);
                if (selId && el.id === selId) this.selectedElement = el;
                resolve();
            };
            img.onerror = () => resolve();
            img.src = src;
        });

        for (const elData of (state.elements || [])) {
            await loadEl(elData);
        }
        if (selId && !this.selectedElement) {
            this.selectedElement = this.elements.find(e => e.id === selId) || null;
        }

        if (state.drawLayer && this.drawLayerCtx) {
            const img = new Image();
            img.onload = () => {
                this.drawLayerCtx.clearRect(0, 0, this.drawLayer.width, this.drawLayer.height);
                this.drawLayerCtx.drawImage(img, 0, 0);
            };
            img.src = state.drawLayer;
        } else if (this.drawLayerCtx) {
            this.drawLayerCtx.clearRect(0, 0, this.drawLayer.width, this.drawLayer.height);
        }

        this.isRestoring = false;
        this.updateUndoRedoUI();
        this.updatePropertiesPanel();
    }

    undo() {
        if (this.undoStack.length === 0) return;
        this.redoStack.push(this.getCurrentState());
        const state = this.undoStack.pop();
        this.restoreState(state);
        this.showNotification('已撤销');
    }

    redo() {
        if (this.redoStack.length === 0) return;
        this.undoStack.push(this.getCurrentState());
        const state = this.redoStack.pop();
        this.restoreState(state);
        this.showNotification('已重做');
    }

    getCurrentState() {
        return {
            regionLabels: this.regionLabels.map(l => ({ ...l })),
            nextLabelId: this.nextLabelId,
            selectedLabelId: this.selectedLabel ? this.selectedLabel.id : null,
            elements: this.elements.map(el => ({
                id: el.id,
                type: el.type,
                x: el.x,
                y: el.y,
                pixelBlocks: { ...el.pixelBlocks },
                name: el.name,
                properties: { ...el.properties },
                collisionBounds: el.collisionBounds.map(r => [...r]),
                assetKey: el.assetKey,
                imageSrc: el.image && el.image.complete ? el.image.src : null
            })),
            drawLayer: this.drawLayer && this.drawLayer.width > 0 ? this.drawLayer.toDataURL('image/png') : null,
            nextId: this.nextId,
            selectedId: this.selectedElement ? this.selectedElement.id : null
        };
    }

    updateUndoRedoUI() {
        const undoBtn = document.getElementById('btn-undo');
        const redoBtn = document.getElementById('btn-redo');
        if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
    }

    loadCurrentMap() {
        try {
            const params = new URLSearchParams(window.location.search);
            const wantCurrent = params.has('loadCurrent');
            let raw = localStorage.getItem('pixelOfficeCurrentMap');
            if (raw) {
                const data = JSON.parse(raw);
                if (data.canvas && data.elements) {
                    this.loadFromConfig(data);
                    this.showNotification('已加载当前使用的地图');
                    return;
                }
            }
            if (wantCurrent && this.templates.length > 0) {
                this.loadTemplate(0);
                this.showNotification('已加载默认模板（销售部）');
            }
        } catch (e) { console.warn('加载当前地图失败', e); }
    }

    renderToCleanImage() {
        const c = document.createElement('canvas');
        c.width = this.canvas.width;
        c.height = this.canvas.height;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#2d2d44';
        ctx.fillRect(0, 0, c.width, c.height);
        if (this.drawLayer) ctx.drawImage(this.drawLayer, 0, 0);
        const sorted = [...this.elements].sort((a, b) => (a.properties.layer || 1) - (b.properties.layer || 1));
        sorted.forEach(el => this.renderElementTo(ctx, el));
        this.renderRegionLabelsTo(ctx);
        return c.toDataURL('image/png');
    }

    renderElementTo(ctx, element) {
        const { x, y, width, height, image, properties } = element;
        const isFloor = element.type === 'floor' || (element.assetKey && String(element.assetKey).startsWith('floor'));
        ctx.save();
        ctx.globalAlpha = properties.opacity ?? 1;
        if (!isFloor && properties.rotation) {
            ctx.translate(x + width / 2, y + height / 2);
            ctx.rotate((properties.rotation || 0) * Math.PI / 180);
            ctx.translate(-(x + width / 2), -(y + height / 2));
        }
        if (!isFloor && properties.scale && properties.scale !== 1) {
            ctx.translate(x + width / 2, y + height / 2);
            ctx.scale(properties.scale, properties.scale);
            ctx.translate(-(x + width / 2), -(y + height / 2));
        }
        if (!isFloor && (properties.flipH || properties.flipV)) {
            const sx = properties.flipH ? -1 : 1, sy = properties.flipV ? -1 : 1;
            ctx.translate(x + width / 2, y + height / 2);
            ctx.scale(sx, sy);
            ctx.translate(-(x + width / 2), -(y + height / 2));
        }
        if (image && image.complete) {
            if (isFloor) {
                const gs = CONFIG.GRID_SIZE;
                for (let row = 0; row < element.pixelBlocks.h; row++)
                    for (let col = 0; col < element.pixelBlocks.w; col++)
                        ctx.drawImage(image, x + col * gs, y + row * gs, gs, gs);
            } else {
                ctx.drawImage(image, x, y, width, height);
            }
        } else {
            ctx.fillStyle = '#555';
            ctx.fillRect(x, y, width, height);
        }
        ctx.restore();
    }

    applyAsCurrentMap() {
        const exportData = this.getExportData();
        try {
            let imageData = null;
            try { imageData = this.renderToCleanImage(); } catch (_) {}
            const payload = { ...exportData, renderedImage: imageData };
            localStorage.setItem('pixelOfficeCurrentMap', JSON.stringify(payload));
            this.showNotification('已应用为当前地图，返回主页即可查看');
            setTimeout(() => { window.location.href = 'index.html'; }, 1200);
        } catch (e) {
            this.showNotification('保存失败：' + (e.message || '未知错误'));
        }
    }

    getExportData() {
        let drawLayerData = null;
        if (this.drawLayer && this.drawLayer.width > 0 && this.drawLayer.height > 0) {
            try { drawLayerData = this.drawLayer.toDataURL('image/png'); } catch (_) {}
        }
        return {
            canvas: { width: CONFIG.CANVAS_WIDTH, height: CONFIG.CANVAS_HEIGHT, gridSize: CONFIG.GRID_SIZE },
            drawLayer: drawLayerData,
            regionLabels: this.regionLabels.map(l => ({ ...l })),
            elements: this.elements.map(el => ({
                assetKey: el.assetKey || el.type,
                id: el.id,
                type: el.type,
                name: el.name,
                x: el.x,
                y: el.y,
                pixelBlocks: el.pixelBlocks,
                width: el.width,
                height: el.height,
                properties: el.properties,
                collisionBounds: el.collisionBounds
            }))
        };
    }

    async init() {
        this.bindEvents();
        this.initDrawLayer();
        this.loadDefaultAssets();
        this.loadTemplates();
        setTimeout(() => this.loadCurrentMap(), 1200);
        this.startRenderLoop();
        this.updateCanvasInfo();
        this.updateUndoRedoUI();
    }

    bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());

        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        this.canvas.addEventListener('drop', (e) => this.handleDrop(e));
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'c' || e.key === 'C') && !this.isInputFocused()) this.cKeyHeld = true;
        });
        document.addEventListener('keyup', (e) => {
            if (e.key === 'c' || e.key === 'C') this.cKeyHeld = false;
        });
    }

    loadDefaultAssets() {
        const categories = {
            floor: ['floorWood', 'floorTile', 'floorCarpet', 'floorMarble', 'floorConcrete', 'floorLinoleum'],
            furniture: ['desk', 'chair', 'monitor', 'meetingTable', 'receptionDesk', 'sofa'],
            people: ['personWorking', 'personStanding', 'receptionist', 'manager'],
            environment: ['glassWall', 'window', 'door', 'plant'],
            decorations: ['coffeeMachine', 'printer', 'filingCabinet']
        };

        const categoryNames = {
            floor: '🟫 地板',
            furniture: '🪑 家具',
            people: '👥 人物',
            environment: '🏢 环境',
            decorations: '🎨 装饰'
        };

        const container = document.getElementById('assetCategories');
        container.innerHTML = '';

        Object.entries(categories).forEach(([cat, items]) => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';
            categoryDiv.innerHTML = `
                <div class="category-title">${categoryNames[cat]}</div>
                <div class="asset-grid" id="category-${cat}"></div>
            `;
            container.appendChild(categoryDiv);

            const grid = categoryDiv.querySelector('.asset-grid');
            if (cat === 'floor') {
                items.forEach(item => this.loadFloorAsset(item, grid));
            } else {
                items.forEach(item => this.loadAssetImage(item, cat, grid));
            }
        });
        
        // 加载从点阵资产系统导出的资产
        this.loadDotMatrixAssets();
    }
    
    // 加载从点阵资产系统导出的资产
    showAIGenerator() {
        const d = document.getElementById('aiDialog');
        if (d) { d.style.display = 'flex'; }
    }

    closeAIDialog() {
        const d = document.getElementById('aiDialog');
        if (d) { d.style.display = 'none'; }
    }

    addAIPattern(type) {
        const size = 80;
        const names = { house: '房子', desk: '办公桌', plant: '盆栽', animal: '小动物' };
        const name = (names[type] || type) + '_' + Date.now().toString().slice(-6);
        try {
            const result = typeof AIGenerator !== 'undefined' && AIGenerator.generatePattern
                ? AIGenerator.generatePattern(type, size, 16)
                : null;
            if (!result || !result.canvas) return;
            const tc = document.createElement('canvas');
            tc.width = result.canvas.width;
            tc.height = result.canvas.height;
            const tctx = tc.getContext('2d');
            tctx.drawImage(result.canvas, 0, 0);
            const id = tctx.getImageData(0, 0, tc.width, tc.height);
            const d = id.data;
            let minX = tc.width, minY = tc.height, maxX = 0, maxY = 0;
            for (let y = 0; y < tc.height; y++)
                for (let x = 0; x < tc.width; x++)
                    if (d[(y * tc.width + x) * 4 + 3] > 10) {
                        minX = Math.min(minX, x); minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                    }
            const tw = Math.max(1, maxX - minX + 1), th = Math.max(1, maxY - minY + 1);
            const out = document.createElement('canvas');
            out.width = tw; out.height = th;
            const octx = out.getContext('2d');
            octx.drawImage(result.canvas, minX, minY, tw, th, 0, 0, tw, th);
            const dataUrl = out.toDataURL('image/png');
            const assetData = { name, image: dataUrl, width: tw, height: th, gridCells: 4, pixelsPerCell: CONFIG.GRID_SIZE };
            let list = JSON.parse(localStorage.getItem('mapEditorAssets') || '[]');
            list.push(assetData);
            if (list.length > 50) list = list.slice(-50);
            localStorage.setItem('mapEditorAssets', JSON.stringify(list));
            this.loadDotMatrixAssets();
            this.closeAIDialog();
        } catch (e) { console.warn('AI生成失败', e); }
    }

    loadDotMatrixAssets() {
        try {
            const mapEditorAssets = JSON.parse(localStorage.getItem('mapEditorAssets') || '[]');
            if (mapEditorAssets.length > 0) {
                const container = document.getElementById('assetCategories');
                
                // 创建点阵资产类别
                let dotMatrixContainer = document.getElementById('category-dotmatrix');
                if (!dotMatrixContainer) {
                    const categoryDiv = document.createElement('div');
                    categoryDiv.className = 'category';
                    categoryDiv.innerHTML = `
                        <div class="category-title">🔴 点阵资产</div>
                        <div class="asset-grid" id="category-dotmatrix"></div>
                    `;
                    container.appendChild(categoryDiv);
                    dotMatrixContainer = categoryDiv.querySelector('.asset-grid');
                }
                
                // 添加点阵资产
                mapEditorAssets.forEach(assetData => {
                    const img = new Image();
                    img.onload = () => {
                        const assetName = `dotmatrix_${assetData.name}`;
                        this.getImageWithCropOverride(assetName, img, (finalImg) => {
                        this.assets.set(assetName, {
                            image: finalImg,
                            originalImage: img,
                            category: 'dotmatrix',
                            name: assetData.name,
                            trimmed: true
                        });
                        
                        const assetDiv = document.createElement('div');
                        assetDiv.className = 'asset-item';
                        assetDiv.draggable = true;
                        assetDiv.dataset.asset = assetName;
                        assetDiv.innerHTML = `
                            <img src="${img.src}" alt="${assetData.name}">
                            <span class="asset-name">${assetData.name}</span>
                        `;
                        
                        assetDiv.addEventListener('dragstart', (e) => {
                            e.dataTransfer.setData('asset', assetName);
                            e.dataTransfer.effectAllowed = 'copy';
                            assetDiv.classList.add('dragging');
                        });
                        
                        assetDiv.addEventListener('dragend', () => {
                            assetDiv.classList.remove('dragging');
                        });
                        
                        dotMatrixContainer.appendChild(assetDiv);
                        });
                    };
                    img.src = assetData.image;
                });
            }
        } catch (error) {
            console.error('加载点阵资产失败:', error);
        }
    }

    // 生成地板纹理 - 单格尺寸（GRID_SIZE x GRID_SIZE），以画布格子为单位平铺
    createFloorTexture(type) {
        const size = CONFIG.GRID_SIZE;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const patterns = {
            floorWood: () => {
                const grad = ctx.createLinearGradient(0, 0, size, 0);
                grad.addColorStop(0, '#8b6914');
                grad.addColorStop(0.5, '#a67c00');
                grad.addColorStop(1, '#6b5012');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, size, size);
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(0, 0, size, size);
            },
            floorTile: () => {
                ctx.fillStyle = '#e8e4e0';
                ctx.fillRect(0, 0, size, size);
                ctx.strokeStyle = '#c0bcb8';
                ctx.lineWidth = 1;
                ctx.strokeRect(0, 0, size, size);
            },
            floorCarpet: () => {
                const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
                grad.addColorStop(0, '#5a4a6a');
                grad.addColorStop(1, '#4a3a5a');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, size, size);
            },
            floorMarble: () => {
                ctx.fillStyle = '#d4d0cc';
                ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = 'rgba(180,175,170,0.3)';
                ctx.fillRect(0, 0, size/2, size/2);
                ctx.fillRect(size/2, size/2, size/2, size/2);
            },
            floorConcrete: () => {
                ctx.fillStyle = '#9a9590';
                ctx.fillRect(0, 0, size, size);
                for (let i = 0; i < 5; i++) {
                    ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.04})`;
                    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
                }
            },
            floorLinoleum: () => {
                ctx.fillStyle = '#2d4a3e';
                ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = 'rgba(60,90,75,0.5)';
                ctx.fillRect(0, 0, size/2, size/2);
                ctx.fillRect(size/2, size/2, size/2, size/2);
            }
        };
        const fn = patterns[type];
        if (fn) fn();
        return canvas.toDataURL('image/png');
    }

    loadFloorAsset(name, container) {
        const names = {
            floorWood: '木地板',
            floorTile: '白瓷砖',
            floorCarpet: '地毯',
            floorMarble: '大理石',
            floorConcrete: '水泥',
            floorLinoleum: '复合地板'
        };
        const img = new Image();
        img.onload = () => {
            this.getImageWithCropOverride(name, img, (finalImg) => {
                this.assets.set(name, {
                    image: finalImg,
                    originalImage: img,
                    category: 'floor',
                    name: names[name] || name,
                    trimmed: false
                });
                this.createAssetElement(name, finalImg, container);
            });
        };
        img.src = this.createFloorTexture(name);
    }

    loadAssetImage(name, category, container) {
        const img = new Image();
        const paths = {
            desk: 'assets/furniture/desk_isometric.png',
            chair: 'assets/furniture/chair_isometric.png',
            monitor: 'assets/furniture/monitor_isometric.png',
            meetingTable: 'assets/furniture/meeting_table.png',
            receptionDesk: 'assets/furniture/reception_desk.png',
            sofa: 'assets/furniture/sofa_lounge.png',
            personWorking: 'assets/people/person_working.png',
            personStanding: 'assets/people/person_standing.png',
            receptionist: 'assets/people/receptionist.png',
            manager: 'assets/people/manager.png',
            glassWall: 'assets/environment/glass_wall.png',
            window: 'assets/environment/window.png',
            door: 'assets/environment/door.png',
            plant: 'assets/decorations/plant.png',
            coffeeMachine: 'assets/decorations/coffee_machine.png',
            printer: 'assets/decorations/printer.png',
            filingCabinet: 'assets/furniture/filing_cabinet.png'
        };

        img.onload = () => {
            // 创建裁剪后的图片（去除透明边框）
            this.createTrimmedImage(img, name, category, container);
        };

        img.onerror = () => console.warn(`Failed to load: ${paths[name]}`);
        img.src = paths[name];
    }

    // 创建裁剪后的图片（去除透明边框，排除右下角水印区域）
    createTrimmedImage(originalImg, name, category, container) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = originalImg.width;
        tempCanvas.height = originalImg.height;
        tempCtx.drawImage(originalImg, 0, 0);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        const w = tempCanvas.width;
        const h = tempCanvas.height;

        // 排除右下角水印区域（AI生成等文字通常在此处）
        const watermarkRight = Math.floor(w * 0.18);
        const watermarkBottom = Math.floor(h * 0.15);

        let minX = w, minY = h, maxX = 0, maxY = 0;
        let hasVisiblePixel = false;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const alpha = data[(y * w + x) * 4 + 3];
                const inWatermarkZone = (x >= w - watermarkRight) || (y >= h - watermarkBottom);
                if (alpha > 10 && !inWatermarkZone) {
                    hasVisiblePixel = true;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        // 创建裁剪后的图片
        const trimmedCanvas = document.createElement('canvas');
        const trimmedCtx = trimmedCanvas.getContext('2d');
        
        if (hasVisiblePixel) {
            const trimmedWidth = maxX - minX + 1;
            const trimmedHeight = maxY - minY + 1;
            trimmedCanvas.width = trimmedWidth;
            trimmedCanvas.height = trimmedHeight;
            trimmedCtx.drawImage(originalImg, -minX, -minY);
        } else {
            // 如果没有可见像素，使用原图
            trimmedCanvas.width = originalImg.width;
            trimmedCanvas.height = originalImg.height;
            trimmedCtx.drawImage(originalImg, 0, 0);
        }

        // 转换为图片对象
        const trimmedImg = new Image();
        trimmedImg.onload = () => {
            this.assets.set(name, { 
                image: trimmedImg, 
                originalImage: originalImg,
                category, 
                name,
                trimmed: true
            });
            this.createAssetElement(name, trimmedImg, container);
        };
        trimmedImg.src = trimmedCanvas.toDataURL();
    }

    createAssetElement(name, img, container) {
        const assetDiv = document.createElement('div');
        assetDiv.className = 'asset-item';
        assetDiv.draggable = true;
        assetDiv.dataset.asset = name;
        assetDiv.innerHTML = `
            <img src="${img.src}" alt="${name}">
            <span class="asset-name">${name}</span>
        `;

        assetDiv.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('asset', name);
            e.dataTransfer.effectAllowed = 'copy';
            assetDiv.classList.add('dragging');
        });

        assetDiv.addEventListener('dragend', () => {
            assetDiv.classList.remove('dragging');
        });

        container.appendChild(assetDiv);
    }

    handleDrop(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const templateIndex = e.dataTransfer.getData('template-index');
        if (templateIndex !== '') {
            const idx = parseInt(templateIndex, 10);
            if (!isNaN(idx) && this.templates[idx]) {
                this.placeTemplateAt(idx, x, y);
            }
            return;
        }

        const assetName = e.dataTransfer.getData('asset');
        if (!assetName || !this.assets.has(assetName)) return;
        const asset = this.assets.get(assetName);
        this.createElement(asset, x, y, assetName);
    }

    createElement(asset, x, y, assetKey) {
        this.saveState();
        const blocks = { w: CONFIG.DEFAULT_ELEMENT_WIDTH, h: CONFIG.DEFAULT_ELEMENT_HEIGHT };
        const element = new MapElement(
            this.nextId++,
            asset.category,
            x - (blocks.w * CONFIG.GRID_SIZE) / 2,
            y - (blocks.h * CONFIG.GRID_SIZE) / 2,
            asset.image,
            asset.name,
            blocks
        );
        if (assetKey) {
            element.assetKey = assetKey;
            if (String(assetKey).startsWith('floor')) element.properties.layer = 0;
        }
        element.snapToGrid();
        this.elements.push(element);
        this.selectElement(element);
        this.updatePropertiesPanel();
    }

    createElementFromPreset(data) {
        const asset = this.assets.get(data.assetKey);
        if (!asset) {
            console.warn('Asset not found:', data.assetKey);
            return;
        }
        const pixelBlocks = data.pixelBlocks || { w: CONFIG.DEFAULT_ELEMENT_WIDTH, h: CONFIG.DEFAULT_ELEMENT_HEIGHT };
        const element = new MapElement(
            this.nextId++,
            asset.category,
            data.x || 0,
            data.y || 0,
            asset.image,
            data.name || asset.name,
            pixelBlocks
        );
        if (data.properties) Object.assign(element.properties, data.properties);
        if (data.assetKey && String(data.assetKey).startsWith('floor')) {
            element.properties.layer = 0;
        }
        if (data.collisionBounds && data.collisionBounds.length > 0) {
            element.collisionBounds = data.collisionBounds.map(row => [...row]);
        }
        element.assetKey = data.assetKey;
        this.elements.push(element);
    }

    handleMouseDown(e) {
        if (this.isResizingCanvas) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // 裁剪模式：拖拽 8 个控制点
        if (this.cropMode && this.cropElement && this.cropRect) {
            const handleIdx = this.getCropHandleAt(x, y);
            if (handleIdx >= 0) {
                this.cropDragState = { active: true, handle: handleIdx, initX: x, initY: y, startRect: { x: this.cropRect.x, y: this.cropRect.y, w: this.cropRect.w, h: this.cropRect.h } };
                return;
            }
            return;
        }

        // 在选中元素的尺寸手柄上按下：开始调整尺寸
        const handleIdx = this.getResizeHandleAt(x, y);
        if (handleIdx >= 0) {
            this.saveState();
            const el = this.selectedElement;
            this.resizeState = {
                isResizing: true,
                element: el,
                handle: handleIdx,
                startX: x,
                startY: y,
                startElX: el.x,
                startElY: el.y,
                startW: el.width,
                startH: el.height
            };
            return;
        }

        // 按住 Ctrl 或碰撞编辑模式：在选中元素上点击/拖动切换碰撞格子
        const ctrlCollisionEdit = e.ctrlKey && this.selectedElement;
        if ((this.collisionEditMode || ctrlCollisionEdit) && this.selectedElement) {
            const el = this.selectedElement;
            const bounds = el.getBounds();
            if (x >= bounds.x && x < bounds.x + bounds.width &&
                y >= bounds.y && y < bounds.y + bounds.height) {
                const localX = x - el.x;
                const localY = y - el.y;
                const cellW = el.width / el.pixelBlocks.w;
                const cellH = el.height / el.pixelBlocks.h;
                const col = Math.floor(localX / cellW);
                const row = Math.floor(localY / cellH);
                if (row >= 0 && row < el.pixelBlocks.h && col >= 0 && col < el.pixelBlocks.w) {
                    this.saveState();
                    const setValue = !el.collisionBounds[row][col];
                    el.collisionBounds[row][col] = setValue;
                    this.collisionDrawState = { active: true, startRow: row, startCol: col, lastRow: row, lastCol: col, setValue };
                    this.updatePropertiesPanel();
                }
            }
            return;
        }

        // 点击选中框上的锁定按钮
        const lockHit = this.getLockButtonHit(x, y);
        if (lockHit) {
            this.selectedElement.properties.locked = !this.selectedElement.properties.locked;
            this.updatePropertiesPanel();
            return;
        }

        if (this.currentTool === 'erase' || this.cKeyHeld) {
            const element = this.getElementAt(x, y);
            if (element) {
                this.deleteElement(element);
                return;
            }
        }

        // 区域标签工具
        if (this.currentTool === 'label') {
            this.saveState();
            this.addRegionLabel(x, y);
            return;
        }

        // 像素绘制工具：格子笔、格子橡皮、取色、填充
        const pixelTools = ['grid', 'gridEraser', 'picker', 'fill'];
        if (pixelTools.includes(this.currentTool)) {
            if (this.currentTool === 'fill') {
                this.saveState();
                this.handlePixelDraw(x, y);
            } else if (this.currentTool === 'picker') {
                this.handlePixelDraw(x, y);
            } else {
                if (!this.isPixelDrawing) this.saveState();
                this.isPixelDrawing = true;
                this.lastPixelCell = null;
                this.handlePixelDraw(x, y);
                this.lastPixelCell = [Math.floor(x / CONFIG.GRID_SIZE), Math.floor(y / CONFIG.GRID_SIZE)];
            }
            return;
        }

        // 选择/移动工具：优先检查区域标签，支持拖拽移动
        if (this.currentTool === 'select' || this.currentTool === 'move') {
            const label = this.getLabelAt(x, y);
            if (label) {
                this.selectedLabel = label;
                this.selectedElement = null;
                this.saveState();
                this.labelDragState = {
                    isDragging: true,
                    label,
                    offsetX: x - label.x,
                    offsetY: y - label.y
                };
                this.updatePropertiesPanel();
                this.updateUI();
                return;
            }
        }

        const element = this.getElementAt(x, y);

        if (element) {
            this.selectedLabel = null;
            this.selectElement(element);
            
            if (!this.collisionEditMode && !e.ctrlKey && (this.currentTool === 'move' || this.currentTool === 'select') && !element.properties.locked) {
                this.saveState();
                this.dragState = {
                    isDragging: true,
                    element: element,
                    startX: x,
                    startY: y,
                    offsetX: x - element.x,
                    offsetY: y - element.y
                };
                element.dragging = true;
            }
        } else {
            this.selectedElement = null;
            this.selectedLabel = null;
            this.updatePropertiesPanel();
        }

        this.updateUI();
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // 裁剪模式拖拽
        if (this.cropMode && this.cropDragState.active && this.cropElement) {
            const st = this.cropDragState;
            const el = this.cropElement;
            const { width: ew, height: eh } = el.getBounds();
            const dx = x - st.initX;
            const dy = y - st.initY;
            const r0 = st.startRect;
            const minSize = 20;
            let rx = r0.x, ry = r0.y, rw = r0.w, rh = r0.h;
            if (st.handle === 0) {
                rx = Math.min(r0.x + r0.w - minSize, r0.x + dx);
                ry = Math.min(r0.y + r0.h - minSize, r0.y + dy);
                rx = Math.max(0, rx);
                ry = Math.max(0, ry);
                rw = r0.w + (r0.x - rx);
                rh = r0.h + (r0.y - ry);
            } else if (st.handle === 1) {
                ry = Math.min(r0.y + r0.h - minSize, Math.max(0, r0.y + dy));
                rw = Math.max(minSize, Math.min(ew - r0.x, r0.w + dx));
                rh = r0.h + (r0.y - ry);
            } else if (st.handle === 2) {
                rw = Math.max(minSize, Math.min(ew - r0.x, r0.w + dx));
                rh = Math.max(minSize, Math.min(eh - r0.y, r0.h + dy));
            } else if (st.handle === 3) {
                rx = Math.min(r0.x + r0.w - minSize, Math.max(0, r0.x + dx));
                rw = r0.w + (r0.x - rx);
                rh = Math.max(minSize, Math.min(eh - r0.y, r0.h + dy));
            } else if (st.handle === 4) {
                ry = Math.min(r0.y + r0.h - minSize, Math.max(0, r0.y + dy));
                rh = r0.h + (r0.y - ry);
            } else if (st.handle === 5) {
                rw = Math.max(minSize, Math.min(ew - r0.x, r0.w + dx));
            } else if (st.handle === 6) {
                rh = Math.max(minSize, Math.min(eh - r0.y, r0.h + dy));
            } else if (st.handle === 7) {
                rx = Math.min(r0.x + r0.w - minSize, Math.max(0, r0.x + dx));
                rw = r0.w + (r0.x - rx);
            }
            if (rw >= minSize && rh >= minSize && rx >= 0 && ry >= 0 && rx + rw <= ew && ry + rh <= eh) {
                this.cropRect = { x: rx, y: ry, w: rw, h: rh };
            }
            return;
        }

        const gridX = Math.floor(x / CONFIG.GRID_SIZE);
        const gridY = Math.floor(y / CONFIG.GRID_SIZE);
        document.getElementById('canvasInfo').textContent = 
            `${Math.floor(x)}, ${Math.floor(y)} px | 网格: ${gridX}, ${gridY} | 画布: ${CONFIG.CANVAS_WIDTH}x${CONFIG.CANVAS_HEIGHT}`;

        if (this.resizeState.isResizing && this.resizeState.element) {
            const rs = this.resizeState;
            const el = rs.element;
            const ar = rs.startElX + rs.startW;
            const ab = rs.startElY + rs.startH;
            const minSize = CONFIG.GRID_SIZE;
            let newX = rs.startElX, newY = rs.startElY, newW = rs.startW, newH = rs.startH;
            if (rs.handle === 0) {
                newX = Math.min(x, ar - minSize);
                newY = Math.min(y, ab - minSize);
                newW = ar - newX;
                newH = ab - newY;
            } else if (rs.handle === 1) {
                newY = Math.min(y, ab - minSize);
                newW = Math.max(minSize, x - rs.startElX);
                newH = ab - newY;
            } else if (rs.handle === 2) {
                newX = Math.min(x, ar - minSize);
                newW = ar - newX;
                newH = Math.max(minSize, y - rs.startElY);
            } else {
                newW = Math.max(minSize, x - rs.startElX);
                newH = Math.max(minSize, y - rs.startElY);
            }
            const bw = Math.max(1, Math.round(newW / CONFIG.GRID_SIZE));
            const bh = Math.max(1, Math.round(newH / CONFIG.GRID_SIZE));
            el.x = Math.round(newX / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE;
            el.y = Math.round(newY / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE;
            el.updatePixelBlocks(bw, bh);
            this.updatePropertiesPanel();
        } else if (this.labelDragState.isDragging && this.labelDragState.label) {
            const lbl = this.labelDragState.label;
            const pad = 6;
            this.ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
            const w = this.ctx.measureText(lbl.text).width + pad * 2;
            const minX = 0;
            const minY = 0;
            const maxX = Math.max(0, this.canvas.width - w);
            const maxY = Math.max(0, this.canvas.height - 22);
            lbl.x = Math.round(Math.max(minX, Math.min(maxX, x - this.labelDragState.offsetX)));
            lbl.y = Math.round(Math.max(minY, Math.min(maxY, y - this.labelDragState.offsetY)));
            this.updatePropertiesPanel();
        } else if (this.dragState.isDragging && this.dragState.element) {
            const element = this.dragState.element;
            element.x = x - this.dragState.offsetX;
            element.y = y - this.dragState.offsetY;
            this.updateCoordinateInputs();
        } else if (this.isPixelDrawing && (this.currentTool === 'grid' || this.currentTool === 'gridEraser')) {
            const cx = Math.floor(x / CONFIG.GRID_SIZE);
            const cy = Math.floor(y / CONFIG.GRID_SIZE);
            if (!this.lastPixelCell || this.lastPixelCell[0] !== cx || this.lastPixelCell[1] !== cy) {
                this.handlePixelDraw(x, y);
                this.lastPixelCell = [cx, cy];
            }
        } else if (this.collisionDrawState.active && this.selectedElement) {
            const el = this.selectedElement;
            const bounds = el.getBounds();
            if (x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height) {
                const localX = x - el.x;
                const localY = y - el.y;
                const cellW = el.width / el.pixelBlocks.w;
                const cellH = el.height / el.pixelBlocks.h;
                const col = Math.floor(localX / cellW);
                const row = Math.floor(localY / cellH);
                const maxR = el.pixelBlocks.h - 1;
                const maxC = el.pixelBlocks.w - 1;
                if (row >= 0 && row <= maxR && col >= 0 && col <= maxC) {
                    const st = this.collisionDrawState;
                    if (e.shiftKey) {
                        const dr = Math.abs(row - st.startRow);
                        const dc = Math.abs(col - st.startCol);
                        if (dc >= dr) {
                            const c0 = Math.min(st.startCol, col);
                            const c1 = Math.max(st.startCol, col);
                            for (let c = c0; c <= c1; c++) el.collisionBounds[st.startRow][c] = st.setValue;
                        } else {
                            const r0 = Math.min(st.startRow, row);
                            const r1 = Math.max(st.startRow, row);
                            for (let r = r0; r <= r1; r++) el.collisionBounds[r][st.startCol] = st.setValue;
                        }
                    } else {
                        if (row !== st.lastRow || col !== st.lastCol) {
                            el.collisionBounds[row][col] = st.setValue;
                            st.lastRow = row;
                            st.lastCol = col;
                        }
                    }
                    this.updatePropertiesPanel();
                }
            }
        }

        const cropHandle = this.cropMode ? this.getCropHandleAt(x, y) : -1;
        const hoverHandle = this.getResizeHandleAt(x, y);
        const hoverLock = this.getLockButtonHit(x, y);
        const hoverLabel = this.getLabelAt(x, y);
        const hoverElement = this.getElementAt(x, y);
        if (cropHandle >= 0) {
            const cropCursors = ['nwse-resize', 'nesw-resize', 'nwse-resize', 'nesw-resize', 'ns-resize', 'ew-resize', 'ns-resize', 'ew-resize'];
            this.canvas.style.cursor = cropCursors[cropHandle];
        } else if (this.cropMode) {
            this.canvas.style.cursor = 'default';
        } else if (hoverLock) {
            this.canvas.style.cursor = 'pointer';
        } else if (hoverHandle >= 0) {
            const cursors = ['nwse-resize', 'nesw-resize', 'nesw-resize', 'nwse-resize'];
            this.canvas.style.cursor = cursors[hoverHandle];
        } else if ((this.collisionEditMode || e.ctrlKey) && this.selectedElement) {
            const bounds = this.selectedElement.getBounds();
            const inBounds = x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height;
            this.canvas.style.cursor = inBounds ? 'cell' : 'default';
        } else if (this.currentTool === 'erase' || this.cKeyHeld) {
            this.canvas.style.cursor = hoverElement ? 'not-allowed' : 'default';
        } else if (this.currentTool === 'grid') {
            this.canvas.style.cursor = 'crosshair';
        } else if (this.currentTool === 'gridEraser') {
            this.canvas.style.cursor = 'cell';
        } else if (this.currentTool === 'picker') {
            this.canvas.style.cursor = 'crosshair';
        } else if (this.currentTool === 'fill') {
            this.canvas.style.cursor = 'crosshair';
        } else if (hoverLabel && (this.currentTool === 'select' || this.currentTool === 'move')) {
            this.canvas.style.cursor = 'move';
        } else if (hoverElement) {
            this.canvas.style.cursor = (hoverElement.properties.locked && this.currentTool === 'move') ? 'not-allowed' : (this.currentTool === 'move' ? 'move' : 'pointer');
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    handleMouseUp() {
        this.isPixelDrawing = false;
        this.lastPixelCell = null;
        this.collisionDrawState.active = false;

        if (this.cropDragState.active) {
            this.cropDragState = { active: false, handle: -1 };
            return;
        }

        if (this.resizeState.isResizing && this.resizeState.element) {
            this.resizeState.element.snapToGrid();
            this.resizeState = {
                isResizing: false,
                element: null,
                handle: 0,
                startX: 0,
                startY: 0,
                startElX: 0,
                startElY: 0,
                startW: 0,
                startH: 0
            };
            this.updatePropertiesPanel();
        }
        if (this.labelDragState.isDragging && this.labelDragState.label) {
            const lbl = this.labelDragState.label;
            lbl.x = Math.round(lbl.x / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE;
            lbl.y = Math.round(lbl.y / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE;
            this.labelDragState = { isDragging: false, label: null, offsetX: 0, offsetY: 0 };
            this.updatePropertiesPanel();
        }
        if (this.dragState.isDragging && this.dragState.element) {
            this.dragState.element.snapToGrid();
            this.dragState.element.dragging = false;
            this.dragState = {
                isDragging: false,
                element: null,
                startX: 0,
                startY: 0,
                offsetX: 0,
                offsetY: 0
            };
            this.updatePropertiesPanel();
        }
    }

    // ==================== 裁剪（WPS 风格） ====================
    startCropMode() {
        if (!this.selectedElement) {
            this.showNotification('请先选择一个元素');
            return;
        }
        const el = this.selectedElement;
        const isFloor = el.type === 'floor' || (el.assetKey && String(el.assetKey).startsWith('floor'));
        if (isFloor) {
            this.showNotification('地板元素不支持裁剪');
            return;
        }
        this.cropMode = true;
        this.cropElement = el;
        this.cropRect = { x: 0, y: 0, w: el.width, h: el.height };
        this.cropDragState = { active: false, handle: -1, startX: 0, startY: 0, startRect: null };
        const ov = document.getElementById('cropOverlay');
        if (ov) ov.style.display = 'block';
        const hint = document.getElementById('cropHint');
        if (hint) hint.style.display = 'block';
        const confirmBtn = document.getElementById('cropConfirmBtn');
        if (confirmBtn) confirmBtn.style.display = 'block';
        this.showNotification('拖拽 8 个控制点调整裁剪范围');
    }

    cancelCrop() {
        this.cropMode = false;
        this.cropElement = null;
        this.cropRect = null;
        this.cropDragState = { active: false, handle: -1 };
        const ov = document.getElementById('cropOverlay');
        if (ov) ov.style.display = 'none';
        const hint = document.getElementById('cropHint');
        if (hint) hint.style.display = 'none';
        const confirmBtn = document.getElementById('cropConfirmBtn');
        if (confirmBtn) confirmBtn.style.display = 'none';
        document.getElementById('cropConfirmDialog').style.display = 'none';
    }

    getCropHandleAt(canvasX, canvasY) {
        if (!this.cropElement || !this.cropRect) return -1;
        const el = this.cropElement;
        const { x: ex, y: ey } = el.getBounds();
        const r = this.cropRect;
        const handleSize = 12;
        const handles = [
            [ex + r.x, ey + r.y],
            [ex + r.x + r.w, ey + r.y],
            [ex + r.x + r.w, ey + r.y + r.h],
            [ex + r.x, ey + r.y + r.h],
            [ex + r.x + r.w / 2, ey + r.y],
            [ex + r.x + r.w, ey + r.y + r.h / 2],
            [ex + r.x + r.w / 2, ey + r.y + r.h],
            [ex + r.x, ey + r.y + r.h / 2]
        ];
        for (let i = 0; i < handles.length; i++) {
            const [hx, hy] = handles[i];
            if (Math.abs(canvasX - hx) <= handleSize && Math.abs(canvasY - hy) <= handleSize) return i;
        }
        return -1;
    }

    renderCropOverlay() {
        const overlay = document.getElementById('cropOverlay');
        if (!overlay || !this.cropMode || !this.cropElement || !this.cropRect) return;
        const canvas = this.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';

        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        const el = this.cropElement;
        const { x: ex, y: ey, width: ew, height: eh } = el.getBounds();
        const r = this.cropRect;
        const cx = ex + r.x;
        const cy = ey + r.y;
        const cw = r.w;
        const ch = r.h;

        // 被裁区域变暗
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, overlay.width, overlay.height);
        ctx.clearRect(cx, cy, cw, ch);

        // 蓝色虚线框
        ctx.strokeStyle = '#42a5f5';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(cx, cy, cw, ch);
        ctx.setLineDash([]);

        // 8 个控制点
        const handles = [
            [cx, cy], [cx + cw, cy], [cx + cw, cy + ch], [cx, cy + ch],
            [cx + cw / 2, cy], [cx + cw, cy + ch / 2], [cx + cw / 2, cy + ch], [cx, cy + ch / 2]
        ];
        ctx.fillStyle = '#42a5f5';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        handles.forEach(([hx, hy]) => {
            ctx.beginPath();
            ctx.arc(hx, hy, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    }

    saveCropOverride(assetKey, dataUrl) {
        try {
            const overrides = JSON.parse(localStorage.getItem('mapEditorCropOverrides') || '{}');
            overrides[assetKey] = dataUrl;
            localStorage.setItem('mapEditorCropOverrides', JSON.stringify(overrides));
        } catch (e) { console.warn('保存裁剪覆盖失败', e); }
    }

    getImageWithCropOverride(assetKey, defaultImg, callback) {
        try {
            const overrides = JSON.parse(localStorage.getItem('mapEditorCropOverrides') || '{}');
            const dataUrl = overrides[assetKey];
            if (dataUrl) {
                const img = new Image();
                img.onload = () => callback(img);
                img.onerror = () => callback(defaultImg);
                img.src = dataUrl;
                return;
            }
        } catch (_) {}
        callback(defaultImg);
    }

    applyCropFromRect(overwrite) {
        if (!this.cropElement || !this.cropRect) return;
        const el = this.cropElement;
        const r = this.cropRect;
        if (r.w < 4 || r.h < 4) {
            this.showNotification('裁剪区域过小');
            return;
        }

        const img = el.image;
        if (!img || !img.complete) return;

        // 将裁剪区域从元素显示坐标映射到图片像素坐标
        const sx = (r.x / el.width) * img.naturalWidth;
        const sy = (r.y / el.height) * img.naturalHeight;
        const sw = (r.w / el.width) * img.naturalWidth;
        const sh = (r.h / el.height) * img.naturalHeight;

        const temp = document.createElement('canvas');
        temp.width = Math.max(1, Math.floor(sw));
        temp.height = Math.max(1, Math.floor(sh));
        const tctx = temp.getContext('2d');
        tctx.drawImage(img, sx, sy, sw, sh, 0, 0, temp.width, temp.height);

        const dataUrl = temp.toDataURL('image/png');
        const newImg = new Image();
        newImg.onload = () => {
            this.saveState();
            const newW = Math.max(1, Math.round(r.w / CONFIG.GRID_SIZE));
            const newH = Math.max(1, Math.round(r.h / CONFIG.GRID_SIZE));
            el.image = newImg;
            el.updatePixelBlocks(newW, newH);
            if (overwrite) {
                if (el.assetKey && this.assets.has(el.assetKey)) {
                    this.assets.set(el.assetKey, { ...this.assets.get(el.assetKey), image: newImg });
                }
                this.saveCropOverride(el.assetKey || el.name, dataUrl);
                this.showNotification('裁剪完成，已覆盖原图');
            } else {
                const name = (el.name || '裁剪') + '_' + Date.now().toString().slice(-6);
                this.assets.set(name, { image: newImg, category: el.type, name });
                try {
                    const list = JSON.parse(localStorage.getItem('mapEditorAssets') || '[]');
                    list.push({ name, image: dataUrl, width: newImg.width, height: newImg.height, gridCells: 4, pixelsPerCell: CONFIG.GRID_SIZE });
                    if (list.length > 50) list = list.slice(-50);
                    localStorage.setItem('mapEditorAssets', JSON.stringify(list));
                } catch (_) {}
                this.createAssetElement(name, newImg, document.getElementById('category-custom') || document.getElementById('assetCategories'));
                this.showNotification('裁剪完成，已另存到元素库');
            }
            this.cancelCrop();
            this.updatePropertiesPanel();
        };
        newImg.src = dataUrl;
    }

    confirmCrop() {
        document.getElementById('cropConfirmDialog').style.display = 'flex';
    }

    applyCrop(overwrite) {
        this.applyCropFromRect(overwrite);
        document.getElementById('cropConfirmDialog').style.display = 'none';
    }

    handleKeyDown(e) {
        if (this.isInputFocused()) return;
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            e.shiftKey ? this.redo() : this.undo();
            return;
        }
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            this.redo();
            return;
        }
        if (e.key === 'Escape' && this.cropMode) {
            e.preventDefault();
            this.cancelCrop();
            return;
        }
        if (e.key === 'Enter' && this.cropMode && this.cropElement) {
            e.preventDefault();
            this.confirmCrop();
            return;
        }
        if (e.key === 'Delete' && this.selectedElement) {
            this.deleteElement(this.selectedElement);
        }
        if (this.selectedElement && !this.selectedElement.assetKey?.startsWith?.('floor')) {
            if (e.key === 'h' || e.key === 'H') {
                e.preventDefault();
                this.saveState();
                this.updateProperty('flipH', !this.selectedElement.properties.flipH);
                this.showNotification('水平翻转 H');
            } else if (e.key === 'v' || e.key === 'V') {
                e.preventDefault();
                this.saveState();
                this.updateProperty('flipV', !this.selectedElement.properties.flipV);
                this.showNotification('垂直翻转 V');
            }
        }
    }

    isInputFocused() {
        const el = document.activeElement;
        return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    }

    getLockButtonHit(x, y) {
        if (!this.selectedElement) return false;
        const el = this.selectedElement;
        const { x: ex, y: ey, width: w } = el.getBounds();
        const padding = 4;
        const btnSize = 20;
        const lx = ex + w + padding - btnSize;
        const ly = ey - padding - btnSize - 4;
        return x >= lx && x <= lx + btnSize && y >= ly && y <= ly + btnSize;
    }

    getResizeHandleAt(x, y) {
        if (!this.selectedElement) return -1;
        const el = this.selectedElement;
        const { x: ex, y: ey, width: w, height: h } = el.getBounds();
        const padding = 4;
        const handleSize = 6;
        const hitSize = 14;
        const handles = [
            [ex - padding - handleSize/2, ey - padding - handleSize/2],
            [ex + w + padding - handleSize/2, ey - padding - handleSize/2],
            [ex - padding - handleSize/2, ey + h + padding - handleSize/2],
            [ex + w + padding - handleSize/2, ey + h + padding - handleSize/2]
        ];
        const half = hitSize / 2;
        for (let i = 0; i < handles.length; i++) {
            const [hx, hy] = handles[i];
            const cx = hx + handleSize/2;
            const cy = hy + handleSize/2;
            if (x >= cx - half && x <= cx + half && y >= cy - half && y <= cy + half) return i;
        }
        return -1;
    }

    // 点击选择：按渲染层级（layer 高优先），同层按后添加优先，地板最后
    getElementAt(x, y) {
        const isFloor = (el) => el.type === 'floor' || (el.assetKey && String(el.assetKey).startsWith('floor'));
        const sorted = [...this.elements]
            .map((el, idx) => ({ el, idx }))
            .sort((a, b) => {
                const layerA = a.el.properties.layer ?? 1;
                const layerB = b.el.properties.layer ?? 1;
                if (layerB !== layerA) return layerB - layerA;
                return b.idx - a.idx;
            });
        for (const { el } of sorted) {
            const bounds = el.getBounds();
            if (x >= bounds.x && x < bounds.x + bounds.width &&
                y >= bounds.y && y < bounds.y + bounds.height) {
                return el;
            }
        }
        return null;
    }

    selectElement(element) {
        this.elements.forEach(e => e.selected = false);
        this.selectedElement = element;
        if (element) element.selected = true;
        this.updatePropertiesPanel();
        this.updateUI();
    }

    deleteElement(element) {
        const index = this.elements.indexOf(element);
        if (index > -1) {
            this.saveState();
            this.elements.splice(index, 1);
            if (this.selectedElement === element) {
                this.selectedElement = null;
            }
            this.updatePropertiesPanel();
            this.updateUI();
        }
    }

    // ==================== 渲染 ====================
    startRenderLoop() {
        const loop = () => {
            this.render();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    // ==================== 像素绘制（格子笔、格子橡皮、取色、填充） ====================
    drawGridCell(x, y) {
        if (!this.drawLayerCtx) return;
        const gs = CONFIG.GRID_SIZE;
        const gx = Math.floor(x / gs) * gs;
        const gy = Math.floor(y / gs) * gs;
        const color = this.palette[this.selectedColor] || [0, 0, 0];
        this.drawLayerCtx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        this.drawLayerCtx.fillRect(gx, gy, gs, gs);
    }

    eraseGridCell(x, y) {
        if (!this.drawLayerCtx) return;
        const gs = CONFIG.GRID_SIZE;
        const gx = Math.floor(x / gs) * gs;
        const gy = Math.floor(y / gs) * gs;
        const imgData = this.drawLayerCtx.getImageData(gx, gy, gs, gs);
        for (let i = 3; i < imgData.data.length; i += 4) imgData.data[i] = 0;
        this.drawLayerCtx.putImageData(imgData, gx, gy);
    }

    floodFill(startX, startY) {
        if (!this.drawLayerCtx) return;
        const w = this.drawLayer.width;
        const h = this.drawLayer.height;
        const imgData = this.drawLayerCtx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const idx = (startY * w + startX) * 4;
        const startR = data[idx], startG = data[idx + 1], startB = data[idx + 2], startA = data[idx + 3];
        const color = this.palette[this.selectedColor] || [0, 0, 0];
        const fillR = color[0], fillG = color[1], fillB = color[2];
        const same = (i) => data[i] === startR && data[i + 1] === startG && data[i + 2] === startB && data[i + 3] === startA;
        const stack = [[startX, startY]];
        let count = 0;
        const maxFill = w * h;
        while (stack.length > 0 && count < maxFill) {
            const [px, py] = stack.pop();
            if (px < 0 || px >= w || py < 0 || py >= h) continue;
            const i = (py * w + px) * 4;
            if (!same(i)) continue;
            data[i] = fillR; data[i + 1] = fillG; data[i + 2] = fillB; data[i + 3] = 255;
            count++;
            stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
        }
        this.drawLayerCtx.putImageData(imgData, 0, 0);
        this.showNotification(`填充了 ${count} 个像素`);
    }

    pickColor(x, y) {
        if (!this.drawLayerCtx) return;
        const w = this.drawLayer.width;
        const h = this.drawLayer.height;
        const imgData = this.drawLayerCtx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const px = Math.max(0, Math.min(Math.floor(x), w - 1));
        const py = Math.max(0, Math.min(Math.floor(y), h - 1));
        const i = (py * w + px) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 10) {
            this.showNotification('该位置无颜色，尝试从画布背景取色');
            return;
        }
        let closest = 0;
        let minDist = Infinity;
        this.palette.forEach((c, idx) => {
            const dr = r - c[0], dg = g - c[1], db = b - c[2];
            const dist = dr * dr + dg * dg + db * db;
            if (dist < minDist) { minDist = dist; closest = idx; }
        });
        this.selectColor(closest);
        this.showNotification(`已取色 #${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`);
        this.setTool('grid');
    }

    handlePixelDraw(x, y) {
        const pixelTools = ['grid', 'gridEraser', 'picker', 'fill'];
        if (!pixelTools.includes(this.currentTool)) return;
        if (this.currentTool === 'grid') {
            this.drawGridCell(x, y);
        } else if (this.currentTool === 'gridEraser') {
            this.eraseGridCell(x, y);
        } else if (this.currentTool === 'picker') {
            this.pickColor(x, y);
        } else if (this.currentTool === 'fill') {
            this.floodFill(x, y);
        }
    }

    render() {
        // 清空画布
        this.ctx.fillStyle = '#2d2d44';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 渲染网格
        if (this.showGrid) {
            this.renderGrid();
        }

        // 渲染绘制层（格子笔等）
        if (this.drawLayer) {
            this.ctx.drawImage(this.drawLayer, 0, 0);
        }

        // 按层级排序并渲染元素
        const sortedElements = [...this.elements].sort((a, b) => a.properties.layer - b.properties.layer);
        
        sortedElements.forEach(element => {
            this.renderElement(element);
        });

        // 渲染选中效果
        if (this.selectedElement) {
            this.renderSelection(this.selectedElement);
        }

        // 渲染区域标签
        this.renderRegionLabels();

        // 裁剪模式叠加层
        if (this.cropMode) {
            this.renderCropOverlay();
        }
    }

    renderRegionLabels() {
        this.regionLabels.forEach(lbl => {
            const isSelected = this.selectedLabel && this.selectedLabel.id === lbl.id;
            this.ctx.save();
            this.ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            const pad = 6;
            const m = this.ctx.measureText(lbl.text);
            const w = m.width + pad * 2;
            const h = 22;
            this.ctx.fillStyle = isSelected ? 'rgba(233,69,96,0.9)' : 'rgba(0,0,0,0.75)';
            this.ctx.fillRect(lbl.x, lbl.y, w, h);
            this.ctx.strokeStyle = isSelected ? '#e94560' : 'rgba(255,255,255,0.4)';
            this.ctx.strokeRect(lbl.x, lbl.y, w, h);
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText(lbl.text, lbl.x + pad, lbl.y + 4);
            this.ctx.restore();
        });
    }

    renderRegionLabelsTo(ctx) {
        this.regionLabels.forEach(lbl => {
            ctx.save();
            ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            const pad = 6;
            const m = ctx.measureText(lbl.text);
            const w = m.width + pad * 2;
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(lbl.x, lbl.y, w, 22);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.strokeRect(lbl.x, lbl.y, w, 22);
            ctx.fillStyle = '#fff';
            ctx.fillText(lbl.text, lbl.x + pad, lbl.y + 4);
            ctx.restore();
        });
    }

    addRegionLabel(x, y) {
        const text = prompt('区域标签（如：会议室、研发区、休息区）', '会议室');
        if (!text || !text.trim()) return;
        const lbl = {
            id: this.nextLabelId++,
            x: Math.round(x / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE,
            y: Math.round(y / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE,
            text: text.trim()
        };
        this.regionLabels.push(lbl);
        this.selectedLabel = lbl;
        this.selectedElement = null;
        this.saveState();
        this.updatePropertiesPanel();
        this.showNotification('区域标签已添加');
    }

    getLabelAt(x, y) {
        this.ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
        for (let i = this.regionLabels.length - 1; i >= 0; i--) {
            const lbl = this.regionLabels[i];
            const m = this.ctx.measureText(lbl.text);
            const w = m.width + 12;
            const h = 22;
            if (x >= lbl.x && x <= lbl.x + w && y >= lbl.y && y <= lbl.y + h)
                return lbl;
        }
        return null;
    }

    deleteSelectedLabel() {
        if (!this.selectedLabel) return;
        this.regionLabels = this.regionLabels.filter(l => l.id !== this.selectedLabel.id);
        this.selectedLabel = null;
        this.saveState();
        this.updatePropertiesPanel();
        this.showNotification('区域标签已删除');
    }

    updateLabelText(id, text) {
        const lbl = this.regionLabels.find(l => l.id === id);
        if (lbl && text && text.trim()) {
            lbl.text = text.trim();
            this.saveState();
        }
    }

    renderGrid() {
        // 主网格
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;

        for (let x = 0; x <= this.canvas.width; x += CONFIG.GRID_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y <= this.canvas.height; y += CONFIG.GRID_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // 每5格的粗线
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        this.ctx.lineWidth = 2;

        for (let x = 0; x <= this.canvas.width; x += CONFIG.GRID_SIZE * 5) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y <= this.canvas.height; y += CONFIG.GRID_SIZE * 5) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    renderElement(element) {
        const { x, y, width, height, image, properties } = element;
        const isFloor = element.type === 'floor' || (element.assetKey && String(element.assetKey).startsWith('floor'));

        this.ctx.save();
        this.ctx.globalAlpha = properties.opacity;

        // 旋转、缩放、镜像（地板跳过）
        if (!isFloor && properties.rotation !== 0) {
            this.ctx.translate(x + width / 2, y + height / 2);
            this.ctx.rotate(properties.rotation * Math.PI / 180);
            this.ctx.translate(-(x + width / 2), -(y + height / 2));
        }

        // 缩放
        if (!isFloor && properties.scale !== 1) {
            const scale = properties.scale;
            this.ctx.translate(x + width / 2, y + height / 2);
            this.ctx.scale(scale, scale);
            this.ctx.translate(-(x + width / 2), -(y + height / 2));
        }

        // 镜像
        if (!isFloor && (properties.flipH || properties.flipV)) {
            const sx = properties.flipH ? -1 : 1;
            const sy = properties.flipV ? -1 : 1;
            this.ctx.translate(x + width / 2, y + height / 2);
            this.ctx.scale(sx, sy);
            this.ctx.translate(-(x + width / 2), -(y + height / 2));
        }

        // 地板：按格子平铺纹理（尺寸=格子数×格子大小），非地板：单图拉伸
        if (image && image.complete) {
            if (isFloor) {
                const gs = CONFIG.GRID_SIZE;
                for (let row = 0; row < element.pixelBlocks.h; row++) {
                    for (let col = 0; col < element.pixelBlocks.w; col++) {
                        this.ctx.drawImage(image, x + col * gs, y + row * gs, gs, gs);
                    }
                }
            } else {
                this.ctx.drawImage(image, x, y, width, height);
            }
        } else {
            this.ctx.fillStyle = '#555';
            this.ctx.fillRect(x, y, width, height);
        }

        // 绘制碰撞边界（仅当勾选固体/碰撞时显示）
        if (element.selected && element.properties.solid) {
            this.renderCollisionBounds(element);
        }

        // 绘制像素块网格（选中时显示）
        if (element.selected) {
            this.renderPixelBlockGrid(element);
        }

        this.ctx.restore();
    }

    renderCollisionBounds(element) {
        const { x, y, width, height } = element;
        const cellW = width / element.pixelBlocks.w;
        const cellH = height / element.pixelBlocks.h;

        for (let row = 0; row < element.pixelBlocks.h; row++) {
            for (let col = 0; col < element.pixelBlocks.w; col++) {
                if (element.collisionBounds[row][col]) {
                    this.ctx.fillStyle = 'rgba(233, 69, 96, 0.4)';
                    this.ctx.fillRect(
                        x + col * cellW,
                        y + row * cellH,
                        cellW,
                        cellH
                    );
                    this.ctx.strokeStyle = 'rgba(233, 69, 96, 0.7)';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(
                        x + col * cellW,
                        y + row * cellH,
                        cellW,
                        cellH
                    );
                }
            }
        }
    }

    renderPixelBlockGrid(element) {
        const { x, y, width, height } = element;
        const cellW = width / element.pixelBlocks.w;
        const cellH = height / element.pixelBlocks.h;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 0.5;

        // 垂直线
        for (let col = 0; col <= element.pixelBlocks.w; col++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + col * cellW, y);
            this.ctx.lineTo(x + col * cellW, y + height);
            this.ctx.stroke();
        }

        // 水平线
        for (let row = 0; row <= element.pixelBlocks.h; row++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, y + row * cellH);
            this.ctx.lineTo(x + width, y + row * cellH);
            this.ctx.stroke();
        }
    }

    renderSelection(element) {
        const { x, y, width, height } = element;
        const padding = 4;

        // 选中框
        this.ctx.strokeStyle = '#e94560';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([6, 4]);
        this.ctx.strokeRect(
            x - padding,
            y - padding,
            width + padding * 2,
            height + padding * 2
        );
        this.ctx.setLineDash([]);

        // 控制点
        const handleSize = 6;
        this.ctx.fillStyle = '#e94560';
        
        const handles = [
            { x: x - padding - handleSize/2, y: y - padding - handleSize/2 },
            { x: x + width + padding - handleSize/2, y: y - padding - handleSize/2 },
            { x: x - padding - handleSize/2, y: y + height + padding - handleSize/2 },
            { x: x + width + padding - handleSize/2, y: y + height + padding - handleSize/2 }
        ];

        handles.forEach(handle => {
            this.ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
        });

        // 锁定按钮
        const btnSize = 20;
        const lockX = x + width + padding - btnSize;
        const lockY = y - padding - btnSize - 4;
        this.ctx.fillStyle = element.properties.locked ? 'rgba(233, 69, 96, 0.9)' : 'rgba(233, 69, 96, 0.5)';
        this.ctx.fillRect(lockX, lockY, btnSize, btnSize);
        this.ctx.strokeStyle = '#e94560';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(lockX, lockY, btnSize, btnSize);
        this.ctx.fillStyle = '#fff';
        const cx = lockX + btnSize/2;
        const cy = lockY + btnSize/2;
        if (element.properties.locked) {
            this.ctx.fillRect(cx - 4, cy - 1, 8, 7);
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy - 4, 5, Math.PI * 0.55, Math.PI * 1.45);
            this.ctx.stroke();
        } else {
            this.ctx.strokeStyle = '#fff';
            this.ctx.strokeRect(cx - 4, cy - 1, 8, 7);
            this.ctx.beginPath();
            this.ctx.arc(cx, cy - 5, 5, Math.PI * 0.55, Math.PI * 1.45);
            this.ctx.stroke();
        }

        // 尺寸标签
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(x, y - 28, 100, 20);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '11px Arial';
        this.ctx.fillText(`${element.pixelBlocks.w}x${element.pixelBlocks.h}格 (${width}x${height}px)`, x + 5, y - 14);
    }

    // ==================== UI 更新 ====================
    updatePropertiesPanel() {
        const container = document.getElementById('propertiesContent');

        if (this.selectedLabel && !this.selectedElement) {
            const lbl = this.selectedLabel;
            container.innerHTML = `
                <div class="property-group">
                    <h3>区域标签</h3>
                    <div class="property-row">
                        <span class="property-label">文字</span>
                        <div class="property-value">
                            <input type="text" value="${lbl.text}" onchange="editor.updateLabelText(${lbl.id}, this.value)">
                        </div>
                    </div>
                    <div class="property-row">
                        <button type="button" onclick="editor.deleteSelectedLabel()" style="width:100%;padding:8px;background:#dc3545;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">删除标签</button>
                    </div>
                </div>
            `;
            return;
        }

        if (!this.selectedElement) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div>选择一个元素或区域标签以编辑</div>
                </div>
            `;
            return;
        }

        const el = this.selectedElement;
        const props = el.properties;

        container.innerHTML = `
            <div class="property-group">
                <h3>基本信息</h3>
                <div class="property-row">
                    <span class="property-label">名称</span>
                    <div class="property-value">
                        <input type="text" value="${el.name}" onchange="editor.updateProperty('name', this.value)">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">类型</span>
                    <div class="property-value">
                        <input type="text" value="${el.type}" disabled>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">ID</span>
                    <div class="property-value">
                        <input type="text" value="${el.id}" disabled>
                    </div>
                </div>
            </div>

            <div class="property-group">
                <h3>像素块尺寸</h3>
                <div class="property-row">
                    <span class="property-label">宽度</span>
                    <div class="property-value coordinate-inputs">
                        <input type="number" value="${el.pixelBlocks.w}" min="1" max="50" 
                            onchange="editor.updatePixelBlockSize('w', this.value)">
                        <span style="color: #666; font-size: 12px;">格</span>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">高度</span>
                    <div class="property-value coordinate-inputs">
                        <input type="number" value="${el.pixelBlocks.h}" min="1" max="50" 
                            onchange="editor.updatePixelBlockSize('h', this.value)">
                        <span style="color: #666; font-size: 12px;">格</span>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">实际尺寸</span>
                    <div class="property-value" style="color: #888; font-size: 12px;">
                        ${el.width} x ${el.height} px
                    </div>
                </div>
            </div>

            <div class="property-group">
                <h3>位置 (像素格对齐)</h3>
                <div class="property-row">
                    <span class="property-label">X 坐标</span>
                    <div class="property-value coordinate-inputs">
                        <input type="number" id="prop-x" value="${el.x}" min="0" max="${CONFIG.CANVAS_WIDTH}" 
                            onchange="editor.updatePosition('x', this.value)">
                        <span style="color: #666; font-size: 12px;">px</span>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Y 坐标</span>
                    <div class="property-value coordinate-inputs">
                        <input type="number" id="prop-y" value="${el.y}" min="0" max="${CONFIG.CANVAS_HEIGHT}" 
                            onchange="editor.updatePosition('y', this.value)">
                        <span style="color: #666; font-size: 12px;">px</span>
                    </div>
                </div>
            </div>

            <div class="property-group">
                <h3>属性</h3>
                <div class="property-row">
                    <span class="property-label">锁定位置</span>
                    <div class="property-value">
                        <input type="checkbox" ${props.locked ? 'checked' : ''} 
                            onchange="editor.updateProperty('locked', this.checked)">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">固体 (碰撞)</span>
                    <div class="property-value">
                        <input type="checkbox" ${props.solid ? 'checked' : ''} 
                            onchange="editor.updateProperty('solid', this.checked)">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">可交互</span>
                    <div class="property-value">
                        <input type="checkbox" ${props.interactive ? 'checked' : ''} 
                            onchange="editor.updateProperty('interactive', this.checked)">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">渲染层级</span>
                    <div class="property-value">
                        <input type="number" value="${props.layer}" min="0" max="100" 
                            onchange="editor.updateProperty('layer', parseInt(this.value))">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">透明度</span>
                    <div class="property-value">
                        <input type="range" min="0" max="1" step="0.1" value="${props.opacity}" 
                            onchange="editor.updateProperty('opacity', parseFloat(this.value))">
                        <span style="color: #888; font-size: 11px; margin-left: 5px;">${props.opacity}</span>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">旋转</span>
                    <div class="property-value">
                        <input type="range" min="0" max="360" step="15" value="${props.rotation}" 
                            onchange="editor.updateProperty('rotation', parseInt(this.value))">
                        <span style="color: #888; font-size: 11px; margin-left: 5px;">${props.rotation}°</span>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">缩放</span>
                    <div class="property-value">
                        <input type="range" min="0.5" max="3" step="0.1" value="${props.scale}" 
                            onchange="editor.updateProperty('scale', parseFloat(this.value))">
                        <span style="color: #888; font-size: 11px; margin-left: 5px;">${props.scale}x</span>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">水平翻转</span>
                    <div class="property-value">
                        <input type="checkbox" ${(props.flipH) ? 'checked' : ''} 
                            onchange="editor.updateProperty('flipH', this.checked)">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">垂直翻转</span>
                    <div class="property-value">
                        <input type="checkbox" ${(props.flipV) ? 'checked' : ''} 
                            onchange="editor.updateProperty('flipV', this.checked)">
                    </div>
                </div>
            </div>

            <div class="property-group">
                <h3>碰撞边界 (${el.pixelBlocks.w}x${el.pixelBlocks.h} 格)</h3>
                <div class="collision-editor">
                    <h4>在画布上编辑碰撞</h4>
                    <p style="font-size: 12px; color: #888; margin-bottom: 10px;">点击工具栏「碰撞编辑」，在画布上直接点击元素内的格子切换碰撞区域。碰撞仅影响元素间碰撞检测，不影响选择。</p>
                    <div class="collision-legend">
                        <div class="legend-item">
                            <div class="legend-color" style="background: #e94560;"></div>
                            <span>碰撞</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-color" style="background: #2a2a40;"></div>
                            <span>空</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="btn-group">
                <button class="btn btn-danger" onclick="editor.deleteSelected()">删除元素</button>
                <button class="btn btn-secondary" onclick="editor.duplicateSelected()">复制</button>
            </div>
        `;
    }

    updateCoordinateInputs() {
        if (!this.selectedElement) return;
        const xInput = document.getElementById('prop-x');
        const yInput = document.getElementById('prop-y');
        if (xInput) xInput.value = Math.round(this.selectedElement.x);
        if (yInput) yInput.value = Math.round(this.selectedElement.y);
    }

    // ==================== 属性更新 ====================
    updateProperty(key, value) {
        if (!this.selectedElement) return;
        
        if (key === 'name') {
            this.selectedElement.name = value;
        } else {
            this.selectedElement.properties[key] = value;
        }
        
        this.updatePropertiesPanel();
    }

    updatePixelBlockSize(axis, value) {
        if (!this.selectedElement) return;
        const numValue = parseInt(value);
        
        if (axis === 'w') {
            this.selectedElement.updatePixelBlocks(numValue, this.selectedElement.pixelBlocks.h);
        } else {
            this.selectedElement.updatePixelBlocks(this.selectedElement.pixelBlocks.w, numValue);
        }
        
        this.updatePropertiesPanel();
    }

    updatePosition(axis, value) {
        if (!this.selectedElement) return;
        const numValue = parseInt(value);
        if (axis === 'x') {
            this.selectedElement.x = Math.max(0, Math.min(CONFIG.CANVAS_WIDTH - this.selectedElement.width, numValue));
        } else {
            this.selectedElement.y = Math.max(0, Math.min(CONFIG.CANVAS_HEIGHT - this.selectedElement.height, numValue));
        }
        this.selectedElement.snapToGrid();
        this.updatePropertiesPanel();
    }

    // ==================== 工具 ====================
    setTool(tool) {
        if (tool === 'collision') {
            this.collisionEditMode = !this.collisionEditMode;
            const btn = document.getElementById('tool-collision');
            if (btn) btn.classList.toggle('active', this.collisionEditMode);
            if (!this.collisionEditMode) {
                document.getElementById('tool-select').classList.add('active');
                this.currentTool = 'select';
            }
        } else {
            this.currentTool = tool;
            this.collisionEditMode = false;
            document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(`tool-${tool}`);
            if (toolBtn) toolBtn.classList.add('active');
        }
        
        const cursors = { select: 'default', move: 'move', erase: 'not-allowed', label: 'crosshair', grid: 'crosshair', gridEraser: 'cell', picker: 'crosshair', fill: 'crosshair' };
        this.canvas.style.cursor = this.collisionEditMode ? 'cell' : (cursors[this.currentTool] || 'default');
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
        document.getElementById('gridToggle').classList.toggle('active', this.showGrid);
    }

    clearMap() {
        if (confirm('确定要清空所有元素、区域标签和绘制层吗？')) {
            this.saveState();
            this.elements = [];
            this.regionLabels = [];
            this.selectedElement = null;
            this.selectedLabel = null;
            if (this.drawLayerCtx) {
                this.drawLayerCtx.clearRect(0, 0, this.drawLayer.width, this.drawLayer.height);
            }
            this.updatePropertiesPanel();
            this.updateUI();
        }
    }

    clearDrawLayer() {
        if (this.drawLayerCtx) {
            this.saveState();
            this.drawLayerCtx.clearRect(0, 0, this.drawLayer.width, this.drawLayer.height);
            this.showNotification('已清空绘制层');
        }
    }

    deleteSelected() {
        if (this.selectedElement) {
            this.deleteElement(this.selectedElement);
        }
    }

    duplicateSelected() {
        if (!this.selectedElement) return;
        this.saveState();
        const original = this.selectedElement;
        const newElement = new MapElement(
            this.nextId++,
            original.type,
            original.x + CONFIG.GRID_SIZE * 2,
            original.y + CONFIG.GRID_SIZE * 2,
            original.image,
            original.name + '_copy',
            { w: original.pixelBlocks.w, h: original.pixelBlocks.h }
        );
        
        newElement.properties = { ...original.properties };
        newElement.collisionBounds = original.collisionBounds.map(row => [...row]);
        
        this.elements.push(newElement);
        this.selectElement(newElement);
    }

    // ==================== 画布大小设置 ====================
    showCanvasSettings() {
        const newWidth = prompt('设置画布宽度 (像素):', CONFIG.CANVAS_WIDTH);
        if (newWidth === null) return;
        
        const newHeight = prompt('设置画布高度 (像素):', CONFIG.CANVAS_HEIGHT);
        if (newHeight === null) return;

        const width = parseInt(newWidth);
        const height = parseInt(newHeight);

        if (width < 200 || width > 3000 || height < 200 || height > 3000) {
            alert('画布尺寸必须在 200-3000 像素之间');
            return;
        }

        CONFIG.CANVAS_WIDTH = width;
        CONFIG.CANVAS_HEIGHT = height;
        
        this.canvas.width = width;
        this.canvas.height = height;
        this.resizeDrawLayer();
        
        // 移除超出边界的元素
        this.elements = this.elements.filter(el => 
            el.x + el.width <= width && el.y + el.height <= height
        );
        
        if (this.selectedElement && !this.elements.includes(this.selectedElement)) {
            this.selectedElement = null;
        }
        
        this.updateCanvasInfo();
        this.updatePropertiesPanel();
        this.showNotification(`画布大小已设置为 ${width}x${height}`);
    }

    updateCanvasInfo() {
        document.getElementById('canvasInfo').textContent = 
            `${CONFIG.CANVAS_WIDTH} x ${CONFIG.CANVAS_HEIGHT} px | 网格: ${CONFIG.GRID_SIZE}px`;
    }

    // ==================== 文件上传 ====================
    showUploadDialog() {
        document.getElementById('fileUpload').click();
    }

    handleFileUpload(event) {
        const files = event.target.files;
        if (!files.length) return;

        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const name = file.name.replace(/\.[^/.]+$/, '');
                    this.addCustomAsset(name, img, 'custom');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });

        event.target.value = '';
    }

    addCustomAsset(name, image, category) {
        // 对上传的图片也进行裁剪处理
        this.createTrimmedImage(image, name, category, null, true);
    }

    createTrimmedImage(originalImg, name, category, container, isCustom = false) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = originalImg.width;
        tempCanvas.height = originalImg.height;
        tempCtx.drawImage(originalImg, 0, 0);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;

        let minX = tempCanvas.width, minY = tempCanvas.height;
        let maxX = 0, maxY = 0;
        let hasVisiblePixel = false;

        for (let y = 0; y < tempCanvas.height; y++) {
            for (let x = 0; x < tempCanvas.width; x++) {
                const alpha = data[(y * tempCanvas.width + x) * 4 + 3];
                if (alpha > 10) {
                    hasVisiblePixel = true;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        const trimmedCanvas = document.createElement('canvas');
        const trimmedCtx = trimmedCanvas.getContext('2d');
        
        if (hasVisiblePixel) {
            const trimmedWidth = maxX - minX + 1;
            const trimmedHeight = maxY - minY + 1;
            trimmedCanvas.width = trimmedWidth;
            trimmedCanvas.height = trimmedHeight;
            trimmedCtx.drawImage(originalImg, -minX, -minY);
        } else {
            trimmedCanvas.width = originalImg.width;
            trimmedCanvas.height = originalImg.height;
            trimmedCtx.drawImage(originalImg, 0, 0);
        }

        const trimmedImg = new Image();
        trimmedImg.onload = () => {
            this.getImageWithCropOverride(name, trimmedImg, (finalImg) => {
            this.assets.set(name, { 
                image: finalImg, 
                originalImage: originalImg,
                category, 
                name,
                trimmed: true
            });

            if (isCustom) {
                // 添加到自定义类别
                let customContainer = document.getElementById('category-custom');
                if (!customContainer) {
                    const categoriesDiv = document.getElementById('assetCategories');
                    const categoryDiv = document.createElement('div');
                    categoryDiv.className = 'category';
                    categoryDiv.innerHTML = `
                        <div class="category-title">📤 自定义</div>
                        <div class="asset-grid" id="category-custom"></div>
                    `;
                    categoriesDiv.appendChild(categoryDiv);
                    customContainer = categoryDiv.querySelector('.asset-grid');
                }
                this.createAssetElement(name, finalImg, customContainer);
            } else if (container) {
                this.createAssetElement(name, finalImg, container);
            }
            });
        };
        trimmedImg.src = trimmedCanvas.toDataURL();
    }

    // ==================== 模板系统 ====================
    loadTemplates() {
        const builtIn = [
            'sales-department.json', 'rd-department.json', 'open-office.json',
            'meeting-room.json', 'startup-office.json'
        ];
        this.templates = [];
        const loadNext = (i) => {
            if (i >= builtIn.length) {
                const saved = JSON.parse(localStorage.getItem('mapEditorTemplates') || '[]');
                this.templates.push(...saved);
                this.renderTemplateList();
                return;
            }
            fetch(`presets/${builtIn[i]}`)
                .then(r => r.json())
                .then(data => {
                    this.templates.push({ name: data.name, elements: data.elements, builtIn: true });
                    loadNext(i + 1);
                })
                .catch(() => loadNext(i + 1));
        };
        loadNext(0);
    }

    renderTemplateList() {
        const container = document.getElementById('templateList');
        if (!container) return;
        container.innerHTML = this.templates.map((t, i) => `
            <div class="template-item" draggable="true" data-index="${i}"
                ondragstart="editor.handleTemplateDragStart(event, ${i})"
                ondragend="editor.handleTemplateDragEnd(event)">
                <span class="template-item-icon">📋</span>
                <div class="template-item-info">
                    <div class="template-item-name">${t.name || '未命名'}</div>
                    <div class="template-item-count">${(t.elements || []).length} 个元素</div>
                </div>
                <div class="template-item-actions">
                    <button class="template-item-btn" onclick="event.stopPropagation();editor.loadTemplate(${i})" title="加载到画布（替换）">加载</button>
                    ${t.builtIn ? '' : `<button class="template-item-btn" onclick="event.stopPropagation();editor.deleteTemplate(${i})" title="删除">删</button>`}
                </div>
            </div>
        `).join('');
    }

    handleTemplateDragStart(e, index) {
        e.dataTransfer.setData('template-index', String(index));
        e.dataTransfer.effectAllowed = 'copy';
        e.target.classList.add('dragging');
    }

    handleTemplateDragEnd(e) {
        e.target.classList.remove('dragging');
    }

    loadTemplate(index) {
        const t = this.templates[index];
        if (!t || !t.elements) return;
        this.loadFromConfig({ canvas: { width: CONFIG.CANVAS_WIDTH, height: CONFIG.CANVAS_HEIGHT, gridSize: CONFIG.GRID_SIZE }, elements: t.elements });
        this.showNotification(`已加载模板：${t.name}`);
    }

    placeTemplateAt(index, dropX, dropY) {
        const t = this.templates[index];
        if (!t || !t.elements || t.elements.length === 0) return;
        let minX = Infinity, minY = Infinity;
        t.elements.forEach(el => {
            minX = Math.min(minX, el.x);
            minY = Math.min(minY, el.y);
        });
        const offsetX = dropX - minX;
        const offsetY = dropY - minY;
        t.elements.forEach(elData => {
            const data = { ...elData, x: elData.x + offsetX, y: elData.y + offsetY };
            this.createElementFromPreset(data);
        });
        this.showNotification(`已放置模板：${t.name}`);
    }

    saveAsTemplate() {
        if (this.elements.length === 0) {
            this.showNotification('画布为空，无法保存为模板');
            return;
        }
        const name = prompt('模板名称：', '我的模板') || '未命名';
        const data = {
            name,
            elements: this.elements.map(el => ({
                assetKey: el.assetKey || el.type,
                x: el.x, y: el.y,
                pixelBlocks: el.pixelBlocks,
                name: el.name,
                properties: el.properties,
                collisionBounds: el.collisionBounds
            })),
            builtIn: false
        };
        const saved = JSON.parse(localStorage.getItem('mapEditorTemplates') || '[]');
        saved.push(data);
        localStorage.setItem('mapEditorTemplates', JSON.stringify(saved));
        this.templates.push(data);
        this.renderTemplateList();
        this.showNotification(`已保存模板：${name}`);
    }

    deleteTemplate(index) {
        const t = this.templates[index];
        if (t && t.builtIn) return;
        this.templates.splice(index, 1);
        const saved = this.templates.filter(x => !x.builtIn);
        localStorage.setItem('mapEditorTemplates', JSON.stringify(saved));
        this.renderTemplateList();
        this.showNotification('模板已删除');
    }

    loadFromConfig(data) {
        if (!data.canvas || !data.elements) return;
        CONFIG.CANVAS_WIDTH = data.canvas.width || 1000;
        CONFIG.CANVAS_HEIGHT = data.canvas.height || 750;
        CONFIG.GRID_SIZE = data.canvas.gridSize || 20;
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;
        this.resizeDrawLayer();

        this.elements = [];
        this.selectedElement = null;
        this.regionLabels = (data.regionLabels || []).map(l => ({ ...l }));
        this.selectedLabel = null;
        this.nextLabelId = data.regionLabels && data.regionLabels.length > 0
            ? Math.max(...data.regionLabels.map(l => l.id || 0)) + 1 : 1;
        this.nextId = 1;

        data.elements.forEach(elData => this.createElementFromPreset(elData));
        if (data.drawLayer && this.drawLayer && this.drawLayerCtx) {
            const img = new Image();
            img.onload = () => {
                this.drawLayerCtx.clearRect(0, 0, this.drawLayer.width, this.drawLayer.height);
                this.drawLayerCtx.drawImage(img, 0, 0);
            };
            img.src = data.drawLayer;
        }
        this.updateCanvasInfo();
        this.updatePropertiesPanel();
        this.showNotification(`已加载预设：${data.name || '场景'}`);
    }

    // ==================== 导出 ====================
    exportMap() {
        const exportData = this.getExportData();
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'map-config.json';
        a.click();
        
        URL.revokeObjectURL(url);
        
        this.showNotification('地图配置已导出');
    }

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

    updateUI() {}
}

// ==================== 初始化 ====================
let editor;

document.addEventListener('DOMContentLoaded', () => {
    editor = new MapEditor();
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
