/**
 * Pixelclaw Office - 像素办公室可视化系统
 * 基于 HTML5 Canvas 的等距投影办公室场景
 */

// ==================== 配置常量 ====================
const CONFIG = {
    CANVAS_WIDTH: 1000,
    CANVAS_HEIGHT: 750,
    PIXEL_SIZE: 1,
    TILE_WIDTH: 64,
    TILE_HEIGHT: 32,
    AGENT_SIZE: 36,
    ANIMATION_FPS: 12,
    WALK_SPEED: 1.2,
    COLORS: {
        floor: '#4a4a5e',
        floorLight: '#5a5a6e',
        floorDark: '#3a3a4e',
        wall: '#2a2a3e',
        grid: 'rgba(255, 255, 255, 0.03)',
        selection: '#e94560',
        glass: 'rgba(135, 206, 235, 0.25)',
        glassBorder: 'rgba(135, 206, 235, 0.5)'
    }
};

// ==================== 数据面板 - DataProvider 抽象 ====================
// 对接真实 API 时：创建 OpenClawDataProvider 实现 fetchUsageData，并赋值给 pixelOffice.dataProvider

/**
 * 数据提供者接口：实现 fetchUsageData() 返回 { tokenUsage, cost, isLive }
 * - tokenUsage: 字符串，如 '12.4K'
 * - cost: 字符串，如 '¥0.02'
 * - isLive: 是否来自真实接口（影响 UI 提示文案）
 */
class MockDataProvider {
    async fetchUsageData() {
        return {
            tokenUsage: '12.4K',
            cost: '¥0.02',
            isLive: false
        };
    }
}

// 示例：接入 OpenClaw 时替换为真实实现
// class OpenClawDataProvider {
//     constructor(apiBase) { this.apiBase = apiBase; }
//     async fetchUsageData() {
//         const res = await fetch(`${this.apiBase}/usage`);
//         const data = await res.json();
//         return { tokenUsage: data.tokens, cost: data.cost, isLive: true };
//     }
// }

// ==================== Agent 类 ====================
class Agent {
    constructor(id, x, y, name = `Agent ${id}`) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.status = 'idle';
        this.direction = 1;
        this.channel = 'general';
        this.personality = '友好、乐于助人的办公室助手';
        this.config = {};
        this.deskId = null;
        this.animationFrame = 0;
        this.targetX = x;
        this.targetY = y;
        this.walkSpeed = CONFIG.WALK_SPEED;
        this.messages = [];
        this.color = this.generateColor();
        this.avatar = this.getRandomAvatar();
        this.model = 'personStanding';
        this.bobOffset = 0;
        this.lastUpdate = Date.now();
        this.speechBubble = null;
        this.speechTimer = null;
    }

    generateColor() {
        const colors = ['#e94560', '#00d9a3', '#ffa726', '#42a5f5', '#ab47bc', '#ec407a', '#26c6da'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    static AVATARS = ['👤', '👨‍💼', '👩‍💼', '👨‍💻', '👩‍💻', '🤖', '👾', '🦊', '🐱', '🐶', '🐼', '🦁', '🐸', '🐵', '👽', '🎭'];

    static PEOPLE_MODELS = [
        { key: 'personStanding', name: '站立' },
        { key: 'personWorking', name: '办公' },
        { key: 'receptionist', name: '前台' },
        { key: 'manager', name: '经理' }
    ];

    getRandomAvatar() {
        return Agent.AVATARS[Math.floor(Math.random() * Agent.AVATARS.length)];
    }

    update() {
        const now = Date.now();
        const deltaTime = now - this.lastUpdate;
        this.lastUpdate = now;

        this.animationFrame += deltaTime / (1000 / CONFIG.ANIMATION_FPS);

        switch (this.status) {
            case 'idle':
                this.updateIdle();
                break;
            case 'walking':
                this.updateWalking();
                break;
            case 'working':
                this.updateWorking();
                break;
            case 'talking':
                this.updateTalking();
                break;
            case 'error':
            case 'waiting':
                // error/waiting 保持静止，不做自动状态切换
                break;
        }

        this.bobOffset = Math.sin(this.animationFrame * 0.3) * 2;
    }

    updateIdle() {
        if (Math.random() < 0.003) {
            this.setRandomTarget();
            this.status = 'walking';
        }
    }

    updateWalking() {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.walkSpeed) {
            this.x = this.targetX;
            this.y = this.targetY;
            this.status = 'idle';
        } else {
            this.x += (dx / distance) * this.walkSpeed;
            this.y += (dy / distance) * this.walkSpeed;
            this.direction = dx > 0 ? 1 : -1;
        }
    }

    updateWorking() {
        // 工作中
    }

    updateTalking() {
        // 对话中
    }

    setRandomTarget() {
        const margin = 80;
        this.targetX = margin + Math.random() * (CONFIG.CANVAS_WIDTH - margin * 2);
        this.targetY = margin + Math.random() * (CONFIG.CANVAS_HEIGHT - margin * 2);
    }

    goToDesk(deskX, deskY) {
        this.targetX = deskX;
        this.targetY = deskY;
        this.status = 'walking';
    }

    addMessage(sender, content) {
        this.messages.push({ sender, content, timestamp: Date.now() });
        if (this.messages.length > 50) this.messages.shift();
    }

    showSpeech(text) {
        this.speechBubble = text;
        if (this.speechTimer) clearTimeout(this.speechTimer);
        this.speechTimer = setTimeout(() => {
            this.speechBubble = null;
        }, 3000);
    }

    getStatusText() {
        const statusMap = {
            idle: '待机', walking: '走动', working: '工作', talking: '对话',
            error: '错误', waiting: '等待'
        };
        return statusMap[this.status] || this.status;
    }

    getStatusClass() {
        return `status-${this.status}`;
    }
}

// ==================== PixelOffice 主类 ====================
class PixelOffice {
    constructor() {
        this.canvas = document.getElementById('officeCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;

        this.agents = [];
        this.selectedAgent = null;
        this.images = {};
        this.imagesLoaded = false;
        this.showGrid = false;
        this.cameraOffset = { x: 0, y: 0 };
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.hoverAgent = null;
        this.zoom = 1;

        // 办公室布局 - 参考图中的布局
        this.layout = {
            desks: [],
            meetingRooms: [],
            loungeAreas: [],
            coffeeArea: null,
            reception: null,
            walls: [],
            windows: [],
            plants: [],
            decorations: []
        };
        // 自定义地图（来自地图编辑器）
        this.currentMapImage = null;

        // 任务与数据
        this.tasks = [];
        this.panelTab = 'overview';
        this.nextTaskId = 1;

        // 数据面板：MockDataProvider 可替换为 OpenClawDataProvider
        this.dataProvider = new MockDataProvider();

        this.init();
    }

    loadCurrentMapImage() {
        try {
            const raw = localStorage.getItem('pixelOfficeCurrentMap');
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.renderedImage) {
                const img = new Image();
                img.onload = () => {
                    this.currentMapImage = img;
                    this.updateMapModeUI(true);
                };
                img.src = data.renderedImage;
            }
        } catch (e) { console.warn('加载当前地图失败', e); }
    }

    clearCurrentMap() {
        localStorage.removeItem('pixelOfficeCurrentMap');
        this.currentMapImage = null;
        this.updateMapModeUI(false);
    }

    updateMapModeUI(usingCustom) {
        const hint = document.getElementById('mapModeHint');
        const btn = document.getElementById('btnRestoreDefaultMap');
        if (hint) hint.style.display = usingCustom ? 'block' : 'none';
        if (btn) btn.style.display = usingCustom ? 'block' : 'none';
    }

    async init() {
        this.bindEvents();
        await this.loadImages();
        this.generateOfficeLayout();
        this.loadCurrentMapImage();
        this.createInitialAgents();
        this.hideLoading();
        this.startRenderLoop();
        this.updateUI();
        this.renderTasks();
        this.updateDataTab();
    }

    bindEvents() {
        this.agentListViewMode = localStorage.getItem('agentListViewMode') || 'list';
        this.projectName = localStorage.getItem('pixelOfficeProjectName') || 'Pixelclaw Office';
        this.sceneName = localStorage.getItem('pixelOfficeSceneName') || '亚信数字-销售部';
        this.loadTasks();
        this.updatePanelHeader();
        document.querySelectorAll('.agent-list-view-mode button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === this.agentListViewMode);
        });
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mouseup', () => this.handleCanvasMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.hideTooltip());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
    }

    async loadImages() {
        const imagePaths = {
            desk: 'assets/furniture/desk_isometric.png',
            chair: 'assets/furniture/chair_isometric.png',
            monitor: 'assets/furniture/monitor_isometric.png',
            keyboard: 'assets/furniture/keyboard_isometric.png',
            meetingTable: 'assets/furniture/meeting_table.png',
            receptionDesk: 'assets/furniture/reception_desk.png',
            filingCabinet: 'assets/furniture/filing_cabinet.png',
            sofa: 'assets/furniture/sofa_lounge.png',
            hangingChair: 'assets/furniture/hanging_chair.png',
            personWorking: 'assets/people/person_working.png',
            personStanding: 'assets/people/person_standing.png',
            receptionist: 'assets/people/receptionist.png',
            manager: 'assets/people/manager.png',
            glassWall: 'assets/environment/glass_wall.png',
            window: 'assets/environment/window.png',
            door: 'assets/environment/door.png',
            ceilingLight: 'assets/environment/ceiling_light.png',
            plant: 'assets/decorations/plant.png',
            coffeeMachine: 'assets/decorations/coffee_machine.png',
            microwave: 'assets/decorations/microwave.png',
            miniFridge: 'assets/decorations/mini_fridge.png',
            coffeeCup: 'assets/decorations/coffee_cup.png',
            printer: 'assets/decorations/printer.png'
        };

        const totalImages = Object.keys(imagePaths).length;
        let loadedCount = 0;

        const loadPromises = Object.entries(imagePaths).map(([key, path]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    loadedCount++;
                    this.updateLoadingProgress(loadedCount / totalImages * 100);
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load: ${path}`);
                    loadedCount++;
                    this.updateLoadingProgress(loadedCount / totalImages * 100);
                    resolve();
                };
                img.src = path;
                this.images[key] = img;
            });
        });

        await Promise.all(loadPromises);
        this.imagesLoaded = true;
    }

    updateLoadingProgress(percent) {
        const progressBar = document.getElementById('loadingProgressBar');
        if (progressBar) progressBar.style.width = `${percent}%`;
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => overlay.style.display = 'none', 500);
        }
    }

    generateOfficeLayout() {
        // 参考图中的布局 - 左侧工作站区域
        // 第一排
        for (let col = 0; col < 4; col++) {
            this.layout.desks.push({
                x: 80 + col * 160,
                y: 120,
                width: 140,
                height: 90,
                id: `D${col + 1}`,
                occupied: false
            });
        }
        // 第二排
        for (let col = 0; col < 4; col++) {
            this.layout.desks.push({
                x: 80 + col * 160,
                y: 240,
                width: 140,
                height: 90,
                id: `D${col + 5}`,
                occupied: false
            });
        }
        // 第三排
        for (let col = 0; col < 4; col++) {
            this.layout.desks.push({
                x: 80 + col * 160,
                y: 360,
                width: 140,
                height: 90,
                id: `D${col + 9}`,
                occupied: false
            });
        }

        // 玻璃会议室（中间偏右，参考图中的大玻璃房）
        this.layout.meetingRooms.push({
            x: 420,
            y: 180,
            width: 280,
            height: 180,
            isGlass: true,
            name: '会议室'
        });

        // 休息区（右上角）
        this.layout.loungeAreas.push({
            x: 780,
            y: 100,
            width: 180,
            height: 140
        });

        // 咖啡区（右下角）
        this.layout.coffeeArea = {
            x: 800,
            y: 480,
            width: 160,
            height: 140
        };

        // 前台（上方中间偏右）
        this.layout.reception = {
            x: 480,
            y: 40,
            width: 180,
            height: 70
        };

        // 窗户位置
        this.layout.windows = [
            { x: 100, y: 45, width: 60, height: 30 },
            { x: 180, y: 45, width: 60, height: 30 },
            { x: 680, y: 45, width: 60, height: 30 },
            { x: 760, y: 45, width: 60, height: 30 }
        ];

        // 装饰植物
        this.layout.plants = [
            { x: 50, y: 80 },
            { x: 720, y: 150 },
            { x: 750, y: 400 },
            { x: 120, y: 500 }
        ];

        // 打印机位置
        this.layout.decorations.push(
            { type: 'printer', x: 680, y: 380 },
            { type: 'filingCabinet', x: 720, y: 340 }
        );
    }

    createInitialAgents() {
        const initialAgents = [
            { x: 150, y: 160, name: '小明', status: 'working', deskId: 'D1' },
            { x: 310, y: 160, name: '小红', status: 'working', deskId: 'D2' },
            { x: 550, y: 260, name: '经理', status: 'talking' },
            { x: 850, y: 160, name: '前台', status: 'idle' }
        ];

        initialAgents.forEach((data, index) => {
            const agent = new Agent(index + 1, data.x, data.y, data.name);
            agent.status = data.status;
            if (data.deskId) agent.deskId = data.deskId;
            this.agents.push(agent);
        });
    }

    startRenderLoop() {
        const loop = () => {
            this.update();
            this.render();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    update() {
        this.agents.forEach(agent => agent.update());
    }

    render() {
        // 清空画布
        this.ctx.fillStyle = '#3d3d52';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.cameraOffset.x, this.cameraOffset.y);
        this.ctx.scale(this.zoom, this.zoom);

        if (this.currentMapImage && this.currentMapImage.complete) {
            this.ctx.drawImage(this.currentMapImage, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.renderFloor();
            this.renderOfficeLayout();
        }

        // 渲染 Agent
        this.renderAgents();

        // 渲染选中效果
        if (this.selectedAgent) {
            this.renderSelection(this.selectedAgent);
        }

        this.ctx.restore();

        if (this.showGrid) this.renderGrid();
    }

    renderFloor() {
        const floorPadding = 40;
        const floorX = floorPadding;
        const floorY = floorPadding;
        const floorW = CONFIG.CANVAS_WIDTH - floorPadding * 2;
        const floorH = CONFIG.CANVAS_HEIGHT - floorPadding * 2;

        // 主地板 - 渐变效果
        const gradient = this.ctx.createLinearGradient(0, floorY, 0, floorY + floorH);
        gradient.addColorStop(0, CONFIG.COLORS.floorLight);
        gradient.addColorStop(0.5, CONFIG.COLORS.floor);
        gradient.addColorStop(1, CONFIG.COLORS.floorDark);

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(floorX, floorY, floorW, floorH);

        // 地板边框
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(floorX, floorY, floorW, floorH);

        // 等距网格效果
        this.ctx.strokeStyle = CONFIG.COLORS.grid;
        this.ctx.lineWidth = 1;

        const gridSize = 40;
        for (let x = floorX; x <= floorX + floorW; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, floorY);
            this.ctx.lineTo(x, floorY + floorH);
            this.ctx.stroke();
        }
        for (let y = floorY; y <= floorY + floorH; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(floorX, y);
            this.ctx.lineTo(floorX + floorW, y);
            this.ctx.stroke();
        }
    }

    renderOfficeLayout() {
        // 渲染工作站
        this.layout.desks.forEach(desk => this.renderDesk(desk));

        // 渲染会议室
        this.layout.meetingRooms.forEach(room => this.renderMeetingRoom(room));

        // 渲染休息区
        this.layout.loungeAreas.forEach(area => this.renderLoungeArea(area));

        // 渲染咖啡区
        if (this.layout.coffeeArea) this.renderCoffeeArea(this.layout.coffeeArea);

        // 渲染前台
        if (this.layout.reception) this.renderReception(this.layout.reception);

        // 渲染窗户
        this.renderWindows();

        // 渲染装饰
        this.renderDecorations();
    }

    renderDesk(desk) {
        const { x, y, width, height, id } = desk;

        // 阴影
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        this.ctx.fillRect(x + 8, y + 8, width, height);

        // 工作站图片
        if (this.images.desk?.complete) {
            const scale = 1.3;
            const imgW = width * scale;
            const imgH = height * scale * 1.5;
            this.ctx.drawImage(
                this.images.desk,
                x + (width - imgW) / 2,
                y - (imgH - height) / 2,
                imgW,
                imgH
            );
        } else {
            // 备用绘制
            this.ctx.fillStyle = '#5a5a7a';
            this.ctx.fillRect(x, y, width, height);
            this.ctx.strokeStyle = '#6a6a8a';
            this.ctx.strokeRect(x, y, width, height);
        }

        // 显示器
        if (this.images.monitor?.complete) {
            const monSize = 45;
            this.ctx.drawImage(
                this.images.monitor,
                x + width / 2 - monSize / 2,
                y + 15,
                monSize,
                monSize
            );
        }

        // 编号
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.font = '10px Arial';
        this.ctx.fillText(id, x + 8, y + height - 8);
    }

    renderMeetingRoom(room) {
        const { x, y, width, height, isGlass, name } = room;

        // 地板
        this.ctx.fillStyle = 'rgba(100, 120, 140, 0.3)';
        this.ctx.fillRect(x, y, width, height);

        // 玻璃墙效果
        if (isGlass) {
            // 玻璃背景
            this.ctx.fillStyle = CONFIG.COLORS.glass;
            this.ctx.fillRect(x, y, width, height);

            // 玻璃边框
            this.ctx.strokeStyle = CONFIG.COLORS.glassBorder;
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x, y, width, height);

            // 玻璃高光
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x + 5, y + height - 5);
            this.ctx.lineTo(x + 5, y + 5);
            this.ctx.lineTo(x + width - 5, y + 5);
            this.ctx.stroke();
        }

        // 会议桌
        if (this.images.meetingTable?.complete) {
            const tableW = width * 0.8;
            const tableH = height * 0.6;
            this.ctx.drawImage(
                this.images.meetingTable,
                x + (width - tableW) / 2,
                y + (height - tableH) / 2,
                tableW,
                tableH
            );
        } else {
            this.ctx.fillStyle = '#6a5a4a';
            this.ctx.fillRect(x + 20, y + 30, width - 40, height - 60);
        }

        // 标签
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(name, x + width / 2, y - 8);
        this.ctx.textAlign = 'left';
    }

    renderLoungeArea(area) {
        const { x, y, width, height } = area;

        // 地毯
        this.ctx.fillStyle = 'rgba(200, 160, 120, 0.25)';
        this.ctx.fillRect(x, y, width, height);
        this.ctx.strokeStyle = 'rgba(200, 160, 120, 0.4)';
        this.ctx.strokeRect(x, y, width, height);

        // 沙发
        if (this.images.sofa?.complete) {
            this.ctx.drawImage(this.images.sofa, x + 10, y + 20, width - 20, height - 40);
        }

        // 吊椅
        if (this.images.hangingChair?.complete) {
            this.ctx.drawImage(this.images.hangingChair, x + width - 60, y + 10, 50, 60);
        }

        // 绿植
        if (this.images.plant?.complete) {
            this.ctx.drawImage(this.images.plant, x + 5, y + height - 40, 35, 35);
        }

        // 咖啡杯装饰
        if (this.images.coffeeCup?.complete) {
            this.ctx.drawImage(this.images.coffeeCup, x + width - 30, y + height - 30, 20, 20);
        }
    }

    renderCoffeeArea(area) {
        const { x, y, width, height } = area;

        // 区域标识
        this.ctx.fillStyle = 'rgba(150, 150, 150, 0.15)';
        this.ctx.fillRect(x, y, width, height);

        // 咖啡机
        if (this.images.coffeeMachine?.complete) {
            this.ctx.drawImage(this.images.coffeeMachine, x + 10, y + 10, 55, 55);
        }

        // 微波炉
        if (this.images.microwave?.complete) {
            this.ctx.drawImage(this.images.microwave, x + 70, y + 15, 45, 40);
        }

        // 迷你冰箱
        if (this.images.miniFridge?.complete) {
            this.ctx.drawImage(this.images.miniFridge, x + 10, y + 70, 50, 60);
        }

        // 标签
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.font = '11px Arial';
        this.ctx.fillText('☕ 咖啡区', x + 70, y + 100);
    }

    renderReception(reception) {
        const { x, y, width, height } = reception;

        // 前台接待台
        if (this.images.receptionDesk?.complete) {
            this.ctx.drawImage(this.images.receptionDesk, x, y, width, height);
        } else {
            this.ctx.fillStyle = '#7a6a5a';
            this.ctx.fillRect(x, y, width, height);
        }

        // 标签
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.font = 'bold 13px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('前台', x + width / 2, y + height / 2 + 4);
        this.ctx.textAlign = 'left';
    }

    renderWindows() {
        this.layout.windows.forEach(win => {
            if (this.images.window?.complete) {
                this.ctx.drawImage(this.images.window, win.x, win.y, win.width, win.height);
            } else {
                // 备用窗户
                this.ctx.fillStyle = 'rgba(135, 206, 235, 0.5)';
                this.ctx.fillRect(win.x, win.y, win.width, win.height);
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(win.x, win.y, win.width, win.height);
            }
        });
    }

    renderDecorations() {
        // 植物
        this.layout.plants.forEach(plant => {
            if (this.images.plant?.complete) {
                this.ctx.drawImage(this.images.plant, plant.x, plant.y, 35, 35);
            }
        });

        // 其他装饰
        this.layout.decorations.forEach(dec => {
            if (dec.type === 'printer' && this.images.printer?.complete) {
                this.ctx.drawImage(this.images.printer, dec.x, dec.y, 50, 50);
            }
            if (dec.type === 'filingCabinet' && this.images.filingCabinet?.complete) {
                this.ctx.drawImage(this.images.filingCabinet, dec.x, dec.y, 40, 50);
            }
        });

        // 门
        if (this.images.door?.complete) {
            this.ctx.drawImage(this.images.door, 850, 650, 70, 80);
        }

        // 天花板灯
        if (this.images.ceilingLight?.complete) {
            for (let x = 120; x < CONFIG.CANVAS_WIDTH - 100; x += 200) {
                for (let y = 80; y < CONFIG.CANVAS_HEIGHT - 100; y += 200) {
                    // 避开会议室上方
                    if (!(x > 400 && x < 700 && y > 150 && y < 360)) {
                        this.ctx.drawImage(this.images.ceilingLight, x, y, 45, 22);
                    }
                }
            }
        }
    }

    renderAgents() {
        // 按 Y 坐标排序
        const sortedAgents = [...this.agents].sort((a, b) => a.y - b.y);

        sortedAgents.forEach(agent => {
            this.renderAgent(agent);
        });
    }

    renderAgent(agent) {
        const x = agent.x;
        const y = agent.y + agent.bobOffset;
        const size = CONFIG.AGENT_SIZE;

        // 阴影
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        this.ctx.beginPath();
        this.ctx.ellipse(x + size / 2, agent.y + size - 2, size / 2.2, size / 4, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // 人物模型：优先使用 Agent 选择的模型，否则按状态/名称回退
        const modelKey = agent.model || 'personStanding';
        let img = this.images[modelKey];
        if (!img?.complete) {
            if (agent.status === 'working') img = this.images.personWorking;
            else if (agent.name.includes('前台')) img = this.images.receptionist;
            else if (agent.name.includes('经理')) img = this.images.manager;
            else img = this.images.personStanding;
        }

        // 绘制人物
        if (img?.complete) {
            this.ctx.save();
            if (agent.direction < 0) {
                this.ctx.translate(x + size, y);
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(img, 0, 0, size, size * 1.3);
            } else {
                this.ctx.drawImage(img, x, y, size, size * 1.3);
            }
            this.ctx.restore();
        } else {
            // 备用绘制
            this.ctx.fillStyle = agent.color;
            this.ctx.beginPath();
            this.ctx.arc(x + size / 2, y + size / 2, size / 2.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        // 状态指示器（含 error/waiting 增强可视化）
        const statusColors = {
            idle: '#42a5f5',
            walking: '#ffa726',
            working: '#00d9a3',
            talking: '#e94560',
            error: '#f44336',
            waiting: '#9e9e9e'
        };

        this.ctx.fillStyle = statusColors[agent.status] || '#888';
        this.ctx.beginPath();
        this.ctx.arc(x + size - 6, y + 6, 5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // 名称标签背景
        const nameWidth = this.ctx.measureText(agent.name).width + 16;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        this.ctx.beginPath();
        this.ctx.roundRect(x + size / 2 - nameWidth / 2, y - 24, nameWidth, 18, 4);
        this.ctx.fill();

        // 名称文字
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 11px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(agent.name, x + size / 2, y - 11);
        this.ctx.textAlign = 'left';

        // 对话气泡
        if (agent.speechBubble) {
            this.renderSpeechBubble(agent, x, y, agent.speechBubble);
        } else if (agent.status === 'talking') {
            this.renderSpeechBubble(agent, x, y, '💬 ...');
        }
    }

    renderSpeechBubble(agent, x, y, text) {
        const bubbleWidth = Math.max(60, text.length * 8 + 16);
        const bubbleHeight = 28;
        const bubbleX = x - bubbleWidth / 2 + CONFIG.AGENT_SIZE / 2;
        const bubbleY = y - bubbleHeight - 32;

        // 气泡背景
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.beginPath();
        this.ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 10);
        this.ctx.fill();

        // 气泡边框
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // 尖角
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.beginPath();
        this.ctx.moveTo(x + CONFIG.AGENT_SIZE / 2 - 8, bubbleY + bubbleHeight);
        this.ctx.lineTo(x + CONFIG.AGENT_SIZE / 2, bubbleY + bubbleHeight + 10);
        this.ctx.lineTo(x + CONFIG.AGENT_SIZE / 2 + 8, bubbleY + bubbleHeight);
        this.ctx.fill();

        // 文字
        this.ctx.fillStyle = '#333';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(text, bubbleX + bubbleWidth / 2, bubbleY + bubbleHeight / 2 + 4);
        this.ctx.textAlign = 'left';
    }

    renderSelection(agent) {
        const x = agent.x - 6;
        const y = agent.y - 6;
        const size = CONFIG.AGENT_SIZE + 12;

        // 选中框
        this.ctx.strokeStyle = CONFIG.COLORS.selection;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([6, 4]);
        this.ctx.strokeRect(x, y, size, size * 1.3);
        this.ctx.setLineDash([]);

        // 发光效果
        this.ctx.shadowColor = CONFIG.COLORS.selection;
        this.ctx.shadowBlur = 20;
        this.ctx.strokeRect(x, y, size, size * 1.3);
        this.ctx.shadowBlur = 0;
    }

    renderGrid() {
        this.ctx.strokeStyle = CONFIG.COLORS.grid;
        this.ctx.lineWidth = 1;

        const gridSize = 50;

        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    // ==================== 交互处理 ====================

    handleCanvasClick(e) {
        if (this.isDragging) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.cameraOffset.x) / this.zoom;
        const y = (e.clientY - rect.top - this.cameraOffset.y) / this.zoom;

        const clickedAgent = this.getAgentAt(x, y);

        if (clickedAgent) {
            this.selectAgent(clickedAgent);
            this.openConfigPanel();
        } else {
            this.selectedAgent = null;
            this.updateUI();
        }
    }

    handleCanvasMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.cameraOffset.x) / this.zoom;
        const y = (e.clientY - rect.top - this.cameraOffset.y) / this.zoom;

        if (this.isDragging) {
            const dx = e.clientX - this.lastMousePos.x;
            const dy = e.clientY - this.lastMousePos.y;
            this.cameraOffset.x += dx;
            this.cameraOffset.y += dy;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            return;
        }

        const hoverAgent = this.getAgentAt(x, y);
        if (hoverAgent !== this.hoverAgent) {
            this.hoverAgent = hoverAgent;
            if (hoverAgent) {
                this.showTooltip(e.clientX, e.clientY, `${hoverAgent.name} - ${hoverAgent.getStatusText()}`);
                this.canvas.style.cursor = 'pointer';
            } else {
                this.hideTooltip();
                this.canvas.style.cursor = 'default';
            }
        }

        if (this.hoverAgent) {
            this.updateTooltipPosition(e.clientX, e.clientY);
        }
    }

    handleCanvasMouseDown(e) {
        this.isDragging = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
    }

    handleCanvasMouseUp() {
        this.isDragging = false;
    }

    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom = Math.max(0.5, Math.min(2, this.zoom * delta));
    }

    getAgentAt(x, y) {
        for (let i = this.agents.length - 1; i >= 0; i--) {
            const agent = this.agents[i];
            const size = CONFIG.AGENT_SIZE;
            if (x >= agent.x && x <= agent.x + size &&
                y >= agent.y && y <= agent.y + size * 1.3) {
                return agent;
            }
        }
        return null;
    }

    showTooltip(x, y, text) {
        const tooltip = document.getElementById('tooltip');
        tooltip.textContent = text;
        tooltip.classList.add('active');
        this.updateTooltipPosition(x, y);
    }

    updateTooltipPosition(x, y) {
        const tooltip = document.getElementById('tooltip');
        tooltip.style.left = (x + 15) + 'px';
        tooltip.style.top = (y + 15) + 'px';
    }

    hideTooltip() {
        const tooltip = document.getElementById('tooltip');
        tooltip.classList.remove('active');
    }

    // ==================== Agent 管理 ====================

    addAgent() {
        const id = this.agents.length > 0 ? Math.max(...this.agents.map(a => a.id)) + 1 : 1;
        const x = 100 + Math.random() * (CONFIG.CANVAS_WIDTH - 200);
        const y = 100 + Math.random() * (CONFIG.CANVAS_HEIGHT - 200);
        const names = ['小明', '小红', '小李', '小王', '小张', '小刘', '小陈', '小林', '小黄', '小赵'];
        const name = names[Math.floor(Math.random() * names.length)];

        const agent = new Agent(id, x, y, name);
        this.agents.push(agent);
        this.selectAgent(agent);
        this.updateUI();
        this.showNotification(`Agent "${name}" 已创建`);
    }

    deleteAgent() {
        if (!this.selectedAgent) return;

        const index = this.agents.findIndex(a => a.id === this.selectedAgent.id);
        if (index > -1) {
            const name = this.agents[index].name;
            this.agents.splice(index, 1);
            this.selectedAgent = null;
            this.closeConfigModal();
            this.updateUI();
            this.showNotification(`Agent "${name}" 已删除`);
        }
    }

    clearAgents() {
        if (confirm('确定要清除所有 Agent 吗？')) {
            this.agents = [];
            this.selectedAgent = null;
            this.updateUI();
            this.showNotification('所有 Agent 已清除');
        }
    }

    selectAgent(agent) {
        this.selectedAgent = agent;
        this.updateUI();
    }

    updatePanelHeader() {
        const projectEl = document.getElementById('projectNameDisplay');
        const sceneEl = document.getElementById('sceneNameDisplay');
        const name = this.projectName || 'Pixelclaw Office';
        if (projectEl) projectEl.textContent = name;
        if (sceneEl) sceneEl.textContent = this.sceneName || '亚信数字-销售部';
        document.title = `${name} - 像素办公室可视化`;
    }

    startEditProjectName() {
        const display = document.getElementById('projectNameDisplay');
        const input = document.getElementById('projectNameInput');
        if (!display || !input) return;
        display.style.display = 'none';
        input.value = this.projectName || 'Pixelclaw Office';
        input.style.display = 'block';
        input.focus();
        input.select();
    }

    finishEditProjectName() {
        const display = document.getElementById('projectNameDisplay');
        const input = document.getElementById('projectNameInput');
        if (!display || !input) return;
        const val = input.value.trim() || 'Pixelclaw Office';
        this.projectName = val;
        localStorage.setItem('pixelOfficeProjectName', val);
        display.textContent = val;
        display.style.display = '';
        input.style.display = 'none';
        document.title = `${val} - 像素办公室可视化`;
    }

    handleProjectNameKeydown(e) {
        if (e.key === 'Enter') document.getElementById('projectNameInput').blur();
    }

    startEditSceneName() {
        const display = document.getElementById('sceneNameDisplay');
        const input = document.getElementById('sceneNameInput');
        if (!display || !input) return;
        display.style.display = 'none';
        input.value = this.sceneName || '亚信数字-销售部';
        input.style.display = 'block';
        input.focus();
        input.select();
    }

    finishEditSceneName() {
        const display = document.getElementById('sceneNameDisplay');
        const input = document.getElementById('sceneNameInput');
        if (!display || !input) return;
        const val = input.value.trim() || '亚信数字-销售部';
        this.sceneName = val;
        localStorage.setItem('pixelOfficeSceneName', val);
        display.textContent = val;
        display.style.display = '';
        input.style.display = 'none';
    }

    handleSceneNameKeydown(e) {
        if (e.key === 'Enter') document.getElementById('sceneNameInput').blur();
    }

    setAgentListViewMode(mode) {
        this.agentListViewMode = mode;
        localStorage.setItem('agentListViewMode', mode);
        document.querySelectorAll('.agent-list-view-mode button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        const agentList = document.getElementById('agentList');
        if (agentList) agentList.dataset.mode = mode;
    }

    setAllStatus(status) {
        this.agents.forEach(agent => {
            agent.status = status;
            if (status === 'walking') agent.setRandomTarget();
        });
        this.showNotification(`所有 Agent 已设置为 ${this.getStatusText(status)}`);
    }

    getStatusText(status) {
        const statusMap = {
            idle: '待机', walking: '走动', working: '工作', talking: '对话',
            error: '错误', waiting: '等待'
        };
        return statusMap[status] || status;
    }

    // ==================== UI 更新 ====================

    updateUI() {
        document.getElementById('agentCount').textContent = this.agents.length;
        document.getElementById('onlineCount').textContent = this.agents.filter(a => a.status !== 'idle').length;

        const agentList = document.getElementById('agentList');
        agentList.dataset.mode = this.agentListViewMode || 'list';
        agentList.innerHTML = '';

        this.agents.forEach(agent => {
            const item = document.createElement('div');
            item.className = `agent-item ${this.selectedAgent?.id === agent.id ? 'selected' : ''}`;
            item.onclick = () => {
                this.selectAgent(agent);
                this.openConfigPanel();
            };

            item.title = `${agent.name} - ${agent.getStatusText()}`;
            item.dataset.status = agent.status;
            item.innerHTML = `
                <div class="agent-avatar" style="background: ${agent.color}20; color: ${agent.color}">
                    ${agent.avatar}
                </div>
                <div class="agent-info">
                    <div class="agent-name">${agent.name}</div>
                    <div class="agent-status">
                        <span class="status-dot ${agent.getStatusClass()}"></span>
                        ${agent.getStatusText()}
                    </div>
                </div>
            `;

            agentList.appendChild(item);
        });
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #e94560, #c73e54);
            color: white;
            padding: 14px 24px;
            border-radius: 10px;
            font-size: 14px;
            z-index: 3000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 5px 20px rgba(233, 69, 96, 0.4);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2500);
    }

    // ==================== 模态框 ====================

    openConfigPanel() {
        if (!this.selectedAgent) return;

        document.getElementById('agentName').value = this.selectedAgent.name;
        document.getElementById('agentStatus').value = this.selectedAgent.status;
        document.getElementById('agentPersonality').value = this.selectedAgent.personality;
        document.getElementById('agentChannel').value = this.selectedAgent.channel;

        const picker = document.getElementById('agentAvatarPicker');
        if (picker) {
            picker.innerHTML = Agent.AVATARS.map((a, i) => {
                const sel = this.selectedAgent.avatar === a ? ' selected' : '';
                return `<button type="button" class="avatar-btn" data-index="${i}" style="font-size:24px;padding:8px;border:2px solid ${sel ? '#e94560' : '#444'};background:${sel ? 'rgba(233,69,96,0.2)' : '#2a2a40'};border-radius:8px;cursor:pointer;">${a}</button>`;
            }).join('');
            picker.querySelectorAll('.avatar-btn').forEach(btn => {
                btn.onclick = () => this.selectAgentAvatar(Agent.AVATARS[parseInt(btn.dataset.index, 10)]);
            });
        }
        const modelPicker = document.getElementById('agentModelPicker');
        if (modelPicker) {
            modelPicker.innerHTML = Agent.PEOPLE_MODELS.map(m => {
                const sel = this.selectedAgent.model === m.key;
                const img = this.images[m.key];
                const thumb = img?.complete ? `<img src="${img.src}" alt="${m.name}" style="width:36px;height:36px;object-fit:contain;display:block;">` : `<span style="font-size:14px;">${m.name}</span>`;
                return `<button type="button" class="model-btn" data-key="${m.key}" style="padding:6px;border:2px solid ${sel ? '#e94560' : '#444'};background:${sel ? 'rgba(233,69,96,0.2)' : '#2a2a40'};border-radius:8px;cursor:pointer;" title="${m.name}">${thumb}</button>`;
            }).join('');
            modelPicker.querySelectorAll('.model-btn').forEach(btn => {
                btn.onclick = () => this.selectAgentModel(btn.dataset.key);
            });
        }
        document.getElementById('configModal').classList.add('active');
    }

    selectAgentAvatar(avatar) {
        if (!this.selectedAgent) return;
        this.selectedAgent.avatar = avatar;
        const picker = document.getElementById('agentAvatarPicker');
        if (picker) {
            picker.querySelectorAll('.avatar-btn').forEach((btn, i) => {
                const isSel = Agent.AVATARS[i] === avatar;
                btn.style.borderColor = isSel ? '#e94560' : '#444';
                btn.style.background = isSel ? 'rgba(233,69,96,0.2)' : '#2a2a40';
            });
        }
    }

    selectAgentModel(modelKey) {
        if (!this.selectedAgent) return;
        this.selectedAgent.model = modelKey;
        const picker = document.getElementById('agentModelPicker');
        if (picker) {
            picker.querySelectorAll('.model-btn').forEach(btn => {
                const isSel = btn.dataset.key === modelKey;
                btn.style.borderColor = isSel ? '#e94560' : '#444';
                btn.style.background = isSel ? 'rgba(233,69,96,0.2)' : '#2a2a40';
            });
        }
    }

    closeConfigModal() {
        document.getElementById('configModal').classList.remove('active');
    }

    saveAgentConfig() {
        if (!this.selectedAgent) return;

        this.selectedAgent.name = document.getElementById('agentName').value;
        this.selectedAgent.status = document.getElementById('agentStatus').value;
        this.selectedAgent.personality = document.getElementById('agentPersonality').value;
        this.selectedAgent.channel = document.getElementById('agentChannel').value;

        this.closeConfigModal();
        this.updateUI();
        this.showNotification('配置已保存');
    }

    openChat() {
        if (!this.selectedAgent) return;

        this.closeConfigModal();
        document.getElementById('chatTitle').textContent = `与 ${this.selectedAgent.name} 对话`;
        document.getElementById('chatModal').classList.add('active');
        this.renderChatMessages();
        setTimeout(() => document.getElementById('chatInput').focus(), 100);
    }

    closeChatModal() {
        document.getElementById('chatModal').classList.remove('active');
    }

    renderChatMessages() {
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';

        if (this.selectedAgent.messages.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">开始与 Agent 对话...</div>';
            return;
        }

        this.selectedAgent.messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `chat-message ${msg.sender === 'user' ? 'user' : 'agent'}`;
            div.innerHTML = `
                <div class="sender">${msg.sender === 'user' ? '你' : this.selectedAgent.name}</div>
                <div>${msg.content}</div>
            `;
            container.appendChild(div);
        });

        container.scrollTop = container.scrollHeight;
    }

    handleChatKeypress(e) {
        if (e.key === 'Enter') this.sendMessage();
    }

    sendMessage() {
        const input = document.getElementById('chatInput');
        const content = input.value.trim();

        if (!content || !this.selectedAgent) return;

        this.selectedAgent.addMessage('user', content);
        this.selectedAgent.showSpeech(content);
        input.value = '';
        this.renderChatMessages();

        // 模拟回复
        setTimeout(() => {
            const responses = [
                '收到，我会处理的。', '好的，明白了！', '这是个好问题，让我想想...',
                '没问题，交给我吧。', '我需要先确认一下细节。', '明白了，正在处理中。',
                '好的，稍后给你回复。', '收到，马上处理！'
            ];
            const response = responses[Math.floor(Math.random() * responses.length)];
            this.selectedAgent.addMessage('agent', response);
            this.selectedAgent.showSpeech(response);
            this.renderChatMessages();
        }, 800 + Math.random() * 1000);
    }

    // ==================== 视图控制 ====================

    resetView() {
        this.cameraOffset = { x: 0, y: 0 };
        this.zoom = 1;
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
    }

    // ==================== 面板 Tab ====================

    switchPanelTab(tab) {
        this.panelTab = tab;
        document.querySelectorAll('.panel-tabs button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.querySelectorAll('.panel-tab-content').forEach(el => {
            el.classList.toggle('active', el.id === `tab-${tab}`);
        });
        if (tab === 'tasks') this.renderTasks();
        if (tab === 'data') this.updateDataTab();
    }

    // ==================== 任务面板 ====================

    loadTasks() {
        try {
            const raw = localStorage.getItem('pixelOfficeTasks');
            if (raw) {
                const data = JSON.parse(raw);
                this.tasks = data.tasks || [];
                const maxId = this.tasks.length ? Math.max(...this.tasks.map(t => t.id || 0)) : 0;
                this.nextTaskId = Math.max(1, maxId + 1);
            }
        } catch (e) { console.warn('加载任务失败', e); }
    }

    saveTasks() {
        localStorage.setItem('pixelOfficeTasks', JSON.stringify({ tasks: this.tasks }));
    }

    addTask() {
        const title = prompt('任务标题');
        if (!title || !title.trim()) return;
        const task = {
            id: this.nextTaskId++,
            title: title.trim(),
            status: 'todo',
            agentId: null,
            needInput: false,
            createdAt: Date.now()
        };
        this.tasks.push(task);
        this.saveTasks();
        this.renderTasks();
        this.showNotification('任务已添加');
    }

    setTaskStatus(taskId, status) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        task.status = status;
        this.saveTasks();
        this.renderTasks();
    }

    setTaskNeedInput(taskId, needInput) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        task.needInput = !!needInput;
        this.saveTasks();
        this.renderTasks();
    }

    linkTaskToAgent(taskId) {
        if (!this.selectedAgent) {
            this.showNotification('请先选择一名 Agent');
            return;
        }
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        task.agentId = this.selectedAgent.id;
        this.saveTasks();
        this.renderTasks();
        this.showNotification(`任务已关联到 ${this.selectedAgent.name}`);
    }

    focusAgentForTask(agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (agent) {
            this.selectAgent(agent);
            this.switchPanelTab('overview');
            this.openConfigPanel();
        }
    }

    deleteTask(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveTasks();
        this.renderTasks();
    }

    renderTasks() {
        const lists = {
            todo: document.getElementById('taskListTodo'),
            inprogress: document.getElementById('taskListInProgress'),
            needinput: document.getElementById('taskListNeedInput'),
            done: document.getElementById('taskListDone')
        };
        if (!lists.todo) return;

        ['todo', 'inprogress', 'needinput', 'done'].forEach(status => {
            lists[status].innerHTML = '';
        });

        this.tasks.forEach(task => {
            const listKey = task.status in lists ? task.status : 'todo';
            const list = lists[listKey];
            if (!list) return;

            const agentName = task.agentId ? (this.agents.find(a => a.id === task.agentId)?.name || `#${task.agentId}`) : '';
            const item = document.createElement('div');
            item.className = 'task-item';
            item.dataset.taskId = task.id;
            item.dataset.needinput = task.needInput ? 'true' : 'false';
            item.title = task.title + (agentName ? ` · ${agentName}` : '');
            item.innerHTML = `
                <span class="task-item-title">${task.title}</span>
                <span class="task-item-agent">${agentName || '-'}</span>
                <div class="task-item-actions">
                    ${task.status !== 'done' ? `<button type="button" title="下一状态" onclick="pixelOffice.cycleTaskStatus(${task.id})">→</button>` : ''}
                    <button type="button" title="需确认" onclick="pixelOffice.setTaskNeedInput(${task.id}, ${!task.needInput})">${task.needInput ? '✓' : '?'}</button>
                    <button type="button" title="关联Agent" onclick="pixelOffice.linkTaskToAgent(${task.id})">@</button>
                    <button type="button" title="删除" onclick="event.stopPropagation(); pixelOffice.deleteTask(${task.id})">×</button>
                </div>
            `;
            item.onclick = (e) => {
                if (e.target.closest('.task-item-actions')) return;
                if (task.agentId) this.focusAgentForTask(task.agentId);
            };
            list.appendChild(item);
        });
    }

    cycleTaskStatus(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        const order = ['todo', 'inprogress', 'needinput', 'done'];
        let idx = order.indexOf(task.status);
        if (idx < 0) idx = 0;
        const next = order[Math.min(idx + 1, order.length - 1)];
        this.setTaskStatus(taskId, next);
    }

    // ==================== 数据面板 ====================

    async updateDataTab() {
        const tokenEl = document.getElementById('dataTokenUsage');
        const costEl = document.getElementById('dataCost');
        const hintEl = document.getElementById('dataPanelHint');
        const tokenLabel = document.getElementById('dataTokenLabel');
        const costLabel = document.getElementById('dataCostLabel');

        if (tokenEl) tokenEl.textContent = '--';
        if (costEl) costEl.textContent = '--';

        try {
            const data = await this.dataProvider.fetchUsageData();
            if (tokenEl) tokenEl.textContent = data.tokenUsage ?? '--';
            if (costEl) costEl.textContent = data.cost ?? '--';
            if (hintEl) hintEl.textContent = data.isLive ? '数据来自 OpenClaw' : '接入 OpenClaw 后可显示真实数据';
            if (tokenLabel) tokenLabel.textContent = data.isLive ? 'Token 用量' : 'Token 用量（示例）';
            if (costLabel) costLabel.textContent = data.isLive ? '估算成本' : '估算成本（示例）';
        } catch (e) {
            console.warn('数据面板加载失败', e);
            if (hintEl) hintEl.textContent = '加载失败，请检查网络或 API 配置';
        }
    }

    /**
     * 检查是否拥有某付费元素（供地图/元素等调用）
     */
    hasLicenseProduct(productId) {
        return typeof License !== 'undefined' && License.hasProduct(productId);
    }
}

// ==================== 初始化 ====================
let pixelOffice;

document.addEventListener('DOMContentLoaded', () => {
    pixelOffice = new PixelOffice();
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
