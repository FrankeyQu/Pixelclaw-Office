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
            layer: 1,
            opacity: 1,
            rotation: 0,
            scale: 1
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

        this.init();
    }

    async init() {
        this.bindEvents();
        this.loadDefaultAssets();
        this.startRenderLoop();
        this.updateCanvasInfo();
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
    }

    loadDefaultAssets() {
        const categories = {
            furniture: ['desk', 'chair', 'monitor', 'meetingTable', 'receptionDesk', 'sofa'],
            people: ['personWorking', 'personStanding', 'receptionist', 'manager'],
            environment: ['glassWall', 'window', 'door', 'plant'],
            decorations: ['coffeeMachine', 'printer', 'filingCabinet']
        };

        const categoryNames = {
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
            items.forEach(item => this.loadAssetImage(item, cat, grid));
        });
        
        // 加载从点阵资产系统导出的资产
        this.loadDotMatrixAssets();
    }
    
    // 加载从点阵资产系统导出的资产
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
                        this.assets.set(assetName, {
                            image: img,
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
                    };
                    img.src = assetData.image;
                });
            }
        } catch (error) {
            console.error('加载点阵资产失败:', error);
        }
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

    // 创建裁剪后的图片（去除透明边框）
    createTrimmedImage(originalImg, name, category, container) {
        // 创建临时 canvas 来分析图片
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = originalImg.width;
        tempCanvas.height = originalImg.height;
        tempCtx.drawImage(originalImg, 0, 0);

        // 获取像素数据
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;

        // 找到非透明区域的边界
        let minX = tempCanvas.width, minY = tempCanvas.height;
        let maxX = 0, maxY = 0;
        let hasVisiblePixel = false;

        for (let y = 0; y < tempCanvas.height; y++) {
            for (let x = 0; x < tempCanvas.width; x++) {
                const alpha = data[(y * tempCanvas.width + x) * 4 + 3];
                if (alpha > 10) { // 透明度阈值
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
        
        const assetName = e.dataTransfer.getData('asset');
        if (!assetName || !this.assets.has(assetName)) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const asset = this.assets.get(assetName);
        this.createElement(asset, x, y);
    }

    createElement(asset, x, y) {
        // 使用默认像素块大小（4x4 = 80x80像素）
        const element = new MapElement(
            this.nextId++,
            asset.category,
            x - (CONFIG.DEFAULT_ELEMENT_WIDTH * CONFIG.GRID_SIZE) / 2,
            y - (CONFIG.DEFAULT_ELEMENT_HEIGHT * CONFIG.GRID_SIZE) / 2,
            asset.image,
            asset.name,
            { w: CONFIG.DEFAULT_ELEMENT_WIDTH, h: CONFIG.DEFAULT_ELEMENT_HEIGHT }
        );

        element.snapToGrid();
        this.elements.push(element);
        this.selectElement(element);
        this.updatePropertiesPanel();
    }

    handleMouseDown(e) {
        if (this.isResizingCanvas) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 碰撞编辑模式：在选中元素上点击切换碰撞格子
        if (this.collisionEditMode && this.selectedElement) {
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
                    el.collisionBounds[row][col] = !el.collisionBounds[row][col];
                    this.updatePropertiesPanel();
                }
            }
            return;
        }

        if (this.currentTool === 'erase') {
            const element = this.getElementAt(x, y);
            if (element) this.deleteElement(element);
            return;
        }

        const element = this.getElementAt(x, y);

        if (element) {
            this.selectElement(element);
            
            if (!this.collisionEditMode && (this.currentTool === 'move' || this.currentTool === 'select')) {
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
            this.updatePropertiesPanel();
        }

        this.updateUI();
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const gridX = Math.floor(x / CONFIG.GRID_SIZE);
        const gridY = Math.floor(y / CONFIG.GRID_SIZE);
        document.getElementById('canvasInfo').textContent = 
            `${Math.floor(x)}, ${Math.floor(y)} px | 网格: ${gridX}, ${gridY} | 画布: ${CONFIG.CANVAS_WIDTH}x${CONFIG.CANVAS_HEIGHT}`;

        if (this.dragState.isDragging && this.dragState.element) {
            const element = this.dragState.element;
            element.x = x - this.dragState.offsetX;
            element.y = y - this.dragState.offsetY;
            this.updateCoordinateInputs();
        }

        const hoverElement = this.getElementAt(x, y);
        if (this.collisionEditMode && this.selectedElement) {
            this.canvas.style.cursor = 'cell';
        } else if (this.currentTool === 'erase') {
            this.canvas.style.cursor = hoverElement ? 'not-allowed' : 'default';
        } else if (hoverElement) {
            this.canvas.style.cursor = this.currentTool === 'move' ? 'move' : 'pointer';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    handleMouseUp() {
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

    handleKeyDown(e) {
        if (e.key === 'Delete' && this.selectedElement) {
            this.deleteElement(this.selectedElement);
        }
    }

    // 点击选择使用元素完整边界，不依赖碰撞区域（碰撞仅用于元素间碰撞检测）
    getElementAt(x, y) {
        for (let i = this.elements.length - 1; i >= 0; i--) {
            const element = this.elements[i];
            const bounds = element.getBounds();
            if (x >= bounds.x && x < bounds.x + bounds.width &&
                y >= bounds.y && y < bounds.y + bounds.height) {
                return element;
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

    render() {
        // 清空画布
        this.ctx.fillStyle = '#2d2d44';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 渲染网格
        if (this.showGrid) {
            this.renderGrid();
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

        this.ctx.save();
        this.ctx.globalAlpha = properties.opacity;

        // 旋转
        if (properties.rotation !== 0) {
            this.ctx.translate(x + width / 2, y + height / 2);
            this.ctx.rotate(properties.rotation * Math.PI / 180);
            this.ctx.translate(-(x + width / 2), -(y + height / 2));
        }

        // 缩放
        if (properties.scale !== 1) {
            const scale = properties.scale;
            this.ctx.translate(x + width / 2, y + height / 2);
            this.ctx.scale(scale, scale);
            this.ctx.translate(-(x + width / 2), -(y + height / 2));
        }

        // 绘制图片（裁剪后的，无透明边框）
        if (image && image.complete) {
            this.ctx.drawImage(image, x, y, width, height);
        } else {
            this.ctx.fillStyle = '#555';
            this.ctx.fillRect(x, y, width, height);
        }

        // 绘制碰撞边界（选中时显示，碰撞仅用于元素间碰撞检测）
        if (element.selected) {
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

        if (!this.selectedElement) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div>选择一个元素以编辑属性</div>
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
        
        const cursors = { select: 'default', move: 'move', erase: 'not-allowed' };
        this.canvas.style.cursor = this.collisionEditMode ? 'cell' : (cursors[this.currentTool] || 'default');
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
        document.getElementById('gridToggle').classList.toggle('active', this.showGrid);
    }

    clearMap() {
        if (confirm('确定要清空所有元素吗？')) {
            this.elements = [];
            this.selectedElement = null;
            this.updatePropertiesPanel();
            this.updateUI();
        }
    }

    deleteSelected() {
        if (this.selectedElement) {
            this.deleteElement(this.selectedElement);
        }
    }

    duplicateSelected() {
        if (!this.selectedElement) return;
        
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
            this.assets.set(name, { 
                image: trimmedImg, 
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
                this.createAssetElement(name, trimmedImg, customContainer);
            } else if (container) {
                this.createAssetElement(name, trimmedImg, container);
            }
        };
        trimmedImg.src = trimmedCanvas.toDataURL();
    }

    // ==================== 导出 ====================
    exportMap() {
        const exportData = {
            canvas: {
                width: CONFIG.CANVAS_WIDTH,
                height: CONFIG.CANVAS_HEIGHT,
                gridSize: CONFIG.GRID_SIZE
            },
            elements: this.elements.map(el => ({
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
