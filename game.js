/**
 * STAR VANGUARD - 360° Sci-Fi Arena Space Shooter
 * Fully Polished Engine with:
 * - Fix: Exact round-by-round wave progression (no infinite loop, strictly 1 round at a time)
 * - Fix: Boss appears strictly on round 5, 10, 15... (no premature boss spawns)
 * - Feature: Difficulty scaling (HP, Speed, Fire Rate, Enemy Variety per round)
 * - Feature: 100% i-frames invulnerability during Dash (bullets and ramming do 0 damage)
 * - Feature: In-game shop accessible ANYTIME during battle via [B] key or HUD button
 * - Feature: 360-degree rotation (Mouse or Arrow Keys to aim & shoot)
 * - Feature: Post-boss 3-card Roguelike perk selection + Station shop
 * - Web Audio API Synthesizer & LocalStorage persistent save
 */

// --- CONFIGURATIONS ---
const SHIP_CONFIGS = {
    striker: {
        id: 'striker',
        name: 'Страйкер X-1',
        desc: 'Сбалансированный космический перехватчик флота Земли.',
        cost: 0,
        hpMult: 1.0,
        speedMult: 1.0,
        dmgMult: 1.0,
        shieldMult: 1.0,
        color: '#00f0ff',
        accent: '#0077ff',
        unlocked: true
    },
    phantom: {
        id: 'phantom',
        name: 'Призрак Небулы',
        desc: 'Сверхбыстрый стелс-штурмовик с высоким темпом огня.',
        cost: 300,
        hpMult: 0.85,
        speedMult: 1.35,
        dmgMult: 1.15,
        shieldMult: 1.1,
        color: '#a855f7',
        accent: '#ec4899',
        unlocked: false
    },
    juggernaut: {
        id: 'juggernaut',
        name: 'Джаггернаут MK-IV',
        desc: 'Тяжелый бронированный крейсер. Колоссальная мощь и броня.',
        cost: 750,
        hpMult: 1.8,
        speedMult: 0.8,
        dmgMult: 1.45,
        shieldMult: 1.5,
        color: '#ffaa00',
        accent: '#ff3300',
        unlocked: false
    },
    aurora: {
        id: 'aurora',
        name: 'Аврора Прайм',
        desc: 'Экспериментальный корабль пришельцев с мощными энерго-щитами.',
        cost: 1500,
        hpMult: 1.2,
        speedMult: 1.15,
        dmgMult: 1.3,
        shieldMult: 2.2,
        color: '#00ff9d',
        accent: '#00f0ff',
        unlocked: false
    }
};

// --- ROGUELIKE PERK CARDS (POST-ROUND 3-CARD SELECTION) ---
const PERK_POOL = [
    {
        id: 'triple_spread',
        name: 'Тройной шквал',
        icon: '🔱',
        rarity: 'rare',
        desc: '+2 дополнительных орудия веером на крыльях корабля.',
        apply: (game) => { game.player.multiShot = Math.min(5, game.player.multiShot + 1); }
    },
    {
        id: 'rapid_trigger',
        name: 'Сверхзатвор',
        icon: '⚡',
        rarity: 'rare',
        desc: '+35% к скорострельности плазменных орудий.',
        apply: (game) => { game.player.fireInterval *= 0.72; }
    },
    {
        id: 'hyper_shield',
        name: 'Гипер-щит',
        icon: '🛡️',
        rarity: 'epic',
        desc: '+30 к емкости щита и восстановление в 2 раза быстрее.',
        apply: (game) => {
            game.player.maxShield += 30;
            game.player.shield += 30;
            game.runBonuses.shieldRegenSpeed *= 2.0;
        }
    },
    {
        id: 'plasma_burst',
        name: 'Плазменный разрыв',
        icon: '💥',
        rarity: 'epic',
        desc: '+40% к урону всех орудий и снарядов.',
        apply: (game) => { game.player.damage *= 1.4; }
    },
    {
        id: 'escort_drone',
        name: 'Орбитальный страж',
        icon: '🤖',
        rarity: 'epic',
        desc: 'Призывает дополнительного боевого дрона прикрытия.',
        apply: (game) => { game.addDrone(); }
    },
    {
        id: 'critical_core',
        name: 'Критический калибр',
        icon: '🎯',
        rarity: 'legendary',
        desc: '25% шанс нанести тройной критический урон каждым выстрелом.',
        apply: (game) => { game.runBonuses.critChance += 0.25; }
    },
    {
        id: 'vampiric_nanites',
        name: 'Нано-вампиризм',
        icon: '🩸',
        rarity: 'legendary',
        desc: '15% шанс восстановить +3 HP за каждого сбитого врага.',
        apply: (game) => { game.runBonuses.vampirism = true; }
    },
    {
        id: 'super_magnet',
        name: 'Грави-вихрь',
        icon: '🧲',
        rarity: 'common',
        desc: '+120% к радиусу притяжения всех монеток и кристаллов.',
        apply: (game) => { game.player.magnetRange *= 2.2; }
    },
    {
        id: 'dash_nova',
        name: 'Вспышка рывка',
        icon: '✨',
        rarity: 'rare',
        desc: 'Рывок выпускает взрывную волну плазмы во всех врагов вокруг.',
        apply: (game) => { game.runBonuses.dashNova = true; }
    },
    {
        id: 'titan_hull',
        name: 'Титановый монолит',
        icon: '💖',
        rarity: 'rare',
        desc: '+50 к максимальной прочности корпуса и мгновенный ремонт.',
        apply: (game) => {
            game.player.maxHp += 50;
            game.player.hp = Math.min(game.player.maxHp, game.player.hp + 50);
        }
    }
];

// --- IN-GAME & POST-BOSS SHOP ITEMS ---
const STATION_SHOP_ITEMS = [
    {
        id: 'shield_5',
        title: '+5 Энерго-щит',
        icon: '🛡️',
        desc: 'Увеличивает макс. щит на 5 единиц и мгновенно восполняет его.',
        baseCost: 15,
        apply: (game) => {
            game.player.maxShield += 5;
            game.player.shield = Math.min(game.player.maxShield, game.player.shield + 5);
            game.runBonuses.shield += 5;
        }
    },
    {
        id: 'stamina_up',
        title: '+Стамина (Рывок)',
        icon: '⚡',
        desc: '+15 к макс. стамине и +25% к скорости ее перезарядки.',
        baseCost: 20,
        apply: (game) => {
            game.player.maxStamina += 15;
            game.player.staminaRegen += 6;
            game.runBonuses.staminaMax += 15;
        }
    },
    {
        id: 'hp_15',
        title: '+15 Броня корпуса',
        icon: '💖',
        desc: '+15 к макс. здоровью HP и ремонт корпуса на 15 HP.',
        baseCost: 15,
        apply: (game) => {
            game.player.maxHp += 15;
            game.player.hp = Math.min(game.player.maxHp, game.player.hp + 15);
            game.runBonuses.hp += 15;
        }
    },
    {
        id: 'repair_full',
        title: 'Нано-ремонт корпуса',
        icon: '🧪',
        desc: 'Мгновенно восстанавливает 100% прочности корабля.',
        baseCost: 25,
        apply: (game) => {
            game.player.hp = game.player.maxHp;
        }
    },
    {
        id: 'damage_up',
        title: '+15% Урон плазмы',
        icon: '💥',
        desc: 'Увеличивает убойную силу всех плазменных орудий.',
        baseCost: 25,
        apply: (game) => {
            game.player.damage *= 1.15;
            game.runBonuses.dmgMult *= 1.15;
        }
    },
    {
        id: 'speed_up',
        title: '+10% Скорость полета',
        icon: '🚀',
        desc: 'Повышает скорость передвижения и верткость корабля.',
        baseCost: 18,
        apply: (game) => {
            game.player.speed *= 1.10;
            game.runBonuses.speedMult *= 1.10;
        }
    },
    {
        id: 'magnet_up',
        title: '+35% Грави-магнит',
        icon: '🧲',
        desc: 'Увеличивает радиус автоматического сбора монеток.',
        baseCost: 12,
        apply: (game) => {
            game.player.magnetRange *= 1.35;
        }
    },
    {
        id: 'bomb_refill',
        title: 'Зарядка ЭМИ-бомбы',
        icon: '💣',
        desc: 'Мгновенно восполняет 100% заряда супербомбы.',
        baseCost: 30,
        apply: (game) => {
            game.bombCharge = 100;
        }
    },
    {
        id: 'add_drone',
        title: '+1 Боевой дрон',
        icon: '🤖',
        desc: 'Призывает орбитального дрона-стрелка для прикрытия.',
        baseCost: 45,
        apply: (game) => {
            game.addDrone();
        }
    }
];

const THEMES_DATA = {
    neon: {
        id: 'neon',
        name: 'КИБЕР-НЕОН',
        bg: '#04060e',
        grid: 'rgba(0, 240, 255, 0.05)',
        starColors: ['#00f0ff', '#a855f7', '#ffffff']
    },
    solar: {
        id: 'solar',
        name: 'СОЛНЦЕ',
        bg: '#0a0402',
        grid: 'rgba(255, 159, 28, 0.06)',
        starColors: ['#ff9f1c', '#ff5e57', '#ffd166', '#ffffff']
    },
    matrix: {
        id: 'matrix',
        name: 'МАТРИЦА',
        bg: '#020a06',
        grid: 'rgba(6, 214, 160, 0.06)',
        starColors: ['#06d6a0', '#70e000', '#ffffff']
    },
    cryo: {
        id: 'cryo',
        name: 'КРИО',
        bg: '#020712',
        grid: 'rgba(56, 189, 248, 0.06)',
        starColors: ['#38bdf8', '#818cf8', '#ffffff']
    },
    synthwave: {
        id: 'synthwave',
        name: 'СИНТВЕЙВ',
        bg: '#0a020e',
        grid: 'rgba(255, 42, 133, 0.06)',
        starColors: ['#ff2a85', '#c084fc', '#ffd166', '#ffffff']
    }
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.currentTheme = 'neon';
        this.bossWarningActive = false;
        this.bossPendingSpawn = false;

        // Mobile / Touch controls state
        this.joystick = { x: 0, y: 0, active: false };
        this.touchShooting = false;
        this.joystickTouchId = null;
        this.aimTouchId = null;

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('orientationchange', () => setTimeout(() => this.resizeCanvas(), 100));

        this.state = 'MENU'; // 'MENU', 'PLAYING', 'PAUSED', 'PERK_SELECT', 'STATION_SHOP', 'ROUND_CLEAR', 'GAMEOVER'
        this.credits = 100; // Coins
        this.highScore = 0;
        this.score = 0;
        this.wave = 1;
        this.enemiesKilled = 0;
        this.runCreditsCollected = 0;

        // Wave state guards (Prevents infinite loop!)
        this.isWaveTransitioning = false;
        this.autoWaveEnabled = false;
        this.shopOpenedFromGame = false;
        this.shopOpenedFromRoundClear = false;
        this.savedRun = null;

        this.selectedShipId = 'striker';
        this.ships = JSON.parse(JSON.stringify(SHIP_CONFIGS));

        // Run temporary bonuses
        this.runBonuses = {
            shield: 0,
            hp: 0,
            staminaMax: 0,
            staminaRegen: 1.0,
            shieldRegenSpeed: 1.0,
            dmgMult: 1.0,
            speedMult: 1.0,
            critChance: 0.0,
            vampirism: false,
            dashNova: false
        };

        // Inputs
        this.keys = {};
        this.mouse = { x: this.width / 2, y: this.height / 2, isDown: false, active: true };

        // Entities
        this.stars = [];
        this.player = null;
        this.enemies = [];
        this.playerBullets = [];
        this.enemyBullets = [];
        this.bossBeams = [];
        this.pickups = [];
        this.particles = [];
        this.floatingTexts = [];
        this.currentBoss = null;

        // Wave tracking
        this.waveEnemiesToSpawn = 8;
        this.waveEnemiesSpawned = 0;
        this.spawnTimer = 0;
        this.screenShake = 0;

        // Bomb
        this.bombCharge = 100;

        this.lastTime = performance.now();

        this.loadSave();
        this.initStarfield();
        this.bindEvents();
        this.initUI();

        requestAnimationFrame((t) => this.loop(t));
    }

    resizeCanvas() {
        const w = window.innerWidth || 960;
        const h = window.innerHeight || 720;
        this.width = w;
        this.height = h;
        this.canvas.width = w;
        this.canvas.height = h;

        if (this.stars && this.stars.length > 0) {
            this.stars.forEach(s => {
                if (s.x > w) s.x = Math.random() * w;
                if (s.y > h) s.y = Math.random() * h;
            });
        }
        if (this.player) {
            this.player.x = Math.max(30, Math.min(this.width - 30, this.player.x));
            this.player.y = Math.max(30, Math.min(this.height - 30, this.player.y));
        }
    }

    applyTheme(themeId, save = true) {
        if (!THEMES_DATA[themeId]) themeId = 'neon';
        this.currentTheme = themeId;
        document.body.dataset.theme = themeId;

        // Update active class on all theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            if (btn.dataset.theme === themeId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Re-colorize stars to match theme
        if (this.stars && this.stars.length > 0) {
            const colors = THEMES_DATA[themeId].starColors;
            this.stars.forEach(s => {
                s.color = colors[Math.floor(Math.random() * colors.length)];
            });
        }

        if (save) {
            try {
                localStorage.setItem('star_vanguard_theme', themeId);
            } catch (e) {}
        }
    }

    // --- SAVE / LOAD SYSTEM ---
    loadSave() {
        try {
            const savedTheme = localStorage.getItem('star_vanguard_theme');
            if (savedTheme && THEMES_DATA[savedTheme]) {
                this.currentTheme = savedTheme;
            }

            const saved = localStorage.getItem('star_vanguard_save_v1');
            if (saved) {
                const data = JSON.parse(saved);
                if (data.theme && THEMES_DATA[data.theme]) this.currentTheme = data.theme;
                if (data.credits !== undefined) this.credits = data.credits;
                if (data.highScore !== undefined) this.highScore = data.highScore;
                if (data.selectedShipId && this.ships[data.selectedShipId]) this.selectedShipId = data.selectedShipId;
                if (data.autoWaveEnabled !== undefined) this.autoWaveEnabled = !!data.autoWaveEnabled;
                if (data.soundEnabled !== undefined && window.soundManager) {
                    window.soundManager.enabled = !!data.soundEnabled;
                }
                if (data.unlockedShips) {
                    data.unlockedShips.forEach(id => {
                        if (this.ships[id]) this.ships[id].unlocked = true;
                    });
                }
                this.savedRun = data.savedRun || null;
            }
            this.applyTheme(this.currentTheme, false);
        } catch (e) {
            console.warn('Save load warning:', e);
        }
    }

    saveGame(saveCurrentRun = true) {
        try {
            const unlockedList = Object.keys(this.ships).filter(k => this.ships[k].unlocked);
            let runData = null;

            if (saveCurrentRun && (this.state === 'PLAYING' || this.state === 'ROUND_CLEAR' || this.state === 'PERK_SELECT' || this.state === 'STATION_SHOP' || this.state === 'PAUSED')) {
                if (this.player && this.player.hp > 0) {
                    runData = {
                        wave: this.wave,
                        score: this.score,
                        enemiesKilled: this.enemiesKilled,
                        runCreditsCollected: this.runCreditsCollected,
                        selectedShipId: this.selectedShipId,
                        player: {
                            hp: Math.round(this.player.hp),
                            maxHp: Math.round(this.player.maxHp),
                            shield: Math.round(this.player.shield),
                            maxShield: Math.round(this.player.maxShield),
                            speed: this.player.speed,
                            damage: this.player.damage,
                            fireInterval: this.player.fireInterval,
                            multiShot: this.player.multiShot,
                            droneCount: this.player.drones ? this.player.drones.length : 0,
                            magnetRange: this.player.magnetRange,
                            maxStamina: this.player.maxStamina,
                            staminaRegen: this.player.staminaRegen
                        },
                        runBonuses: { ...this.runBonuses }
                    };
                }
            } else if (!saveCurrentRun) {
                runData = null;
            } else if (this.savedRun) {
                runData = this.savedRun;
            }

            this.savedRun = runData;

            const data = {
                credits: this.credits,
                highScore: this.highScore,
                selectedShipId: this.selectedShipId,
                autoWaveEnabled: this.autoWaveEnabled,
                soundEnabled: window.soundManager ? window.soundManager.enabled : true,
                unlockedShips: unlockedList,
                theme: this.currentTheme,
                savedRun: runData
            };
            localStorage.setItem('star_vanguard_save_v1', JSON.stringify(data));
            this.updateContinueButton();
        } catch (e) {
            console.warn('Save failed:', e);
        }
    }

    updateContinueButton() {
        const btn = document.getElementById('btn-continue');
        const waveVal = document.getElementById('continue-wave-val');
        if (btn) {
            if (this.savedRun && this.savedRun.wave >= 1 && this.savedRun.player && this.savedRun.player.hp > 0) {
                btn.style.display = 'block';
                if (waveVal) waveVal.textContent = this.savedRun.wave;
                btn.innerHTML = `▶️ ПРОДОЛЖИТЬ (РАУНД ${this.savedRun.wave}, СЧЕТ: ${this.savedRun.score})`;
            } else {
                btn.style.display = 'none';
            }
        }
    }

    continueRun() {
        if (!this.savedRun) return;
        window.soundManager.init();
        window.soundManager.startAmbientMusic();

        this.hideAllModals();
        this.state = 'PLAYING';
        this.wave = this.savedRun.wave;
        this.score = this.savedRun.score;
        this.enemiesKilled = this.savedRun.enemiesKilled || 0;
        this.runCreditsCollected = this.savedRun.runCreditsCollected || 0;
        this.selectedShipId = this.savedRun.selectedShipId || this.selectedShipId;
        this.runBonuses = { ...this.savedRun.runBonuses };

        this.enemies = [];
        this.playerBullets = [];
        this.enemyBullets = [];
        this.bossBeams = [];
        this.pickups = [];
        this.particles = [];
        this.floatingTexts = [];
        this.currentBoss = null;
        this.bossWarningActive = false;
        this.bossPendingSpawn = false;
        this.bombCharge = 100;
        this.isWaveTransitioning = false;
        this.shopOpenedFromGame = false;
        this.shopOpenedFromRoundClear = false;

        this.initPlayer();
        const sp = this.savedRun.player;
        if (sp) {
            this.player.maxHp = sp.maxHp;
            this.player.hp = Math.min(sp.maxHp, sp.hp);
            this.player.maxShield = sp.maxShield;
            this.player.shield = Math.min(sp.maxShield, sp.shield);
            this.player.speed = sp.speed;
            this.player.damage = sp.damage;
            this.player.fireInterval = sp.fireInterval;
            this.player.multiShot = sp.multiShot;
            this.player.magnetRange = sp.magnetRange;
            if (sp.maxStamina) this.player.maxStamina = sp.maxStamina;
            if (sp.staminaRegen) this.player.staminaRegen = sp.staminaRegen;

            this.player.drones = [];
            for (let i = 0; i < (sp.droneCount || 0); i++) {
                this.addDrone();
            }
        }

        this.setupWave();
        this.updateHUDStats();
        this.updateVitalsHUD();

        window.soundManager.playWaveStart();
        this.addFloatingText(this.width / 2, this.height / 2, `ИГРА ВОЗОБНОВЛЕНА: РАУНД ${this.wave}`, '#06d6a0', 26);
    }

    // --- STARFIELD ---
    initStarfield() {
        this.stars = [];
        const count = Math.max(160, Math.min(320, Math.floor((this.width * this.height) / 4200)));
        const theme = THEMES_DATA[this.currentTheme] || THEMES_DATA.neon;
        const colors = theme.starColors;

        for (let i = 0; i < count; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 2.2 + 0.6,
                speedX: (Math.random() - 0.5) * 16,
                speedY: (Math.random() - 0.5) * 16,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: Math.random() * 0.7 + 0.3
            });
        }
    }

    updateStars(dt) {
        for (let star of this.stars) {
            star.x += star.speedX * dt;
            star.y += star.speedY * dt;
            if (star.x < 0) star.x = this.width;
            if (star.x > this.width) star.x = 0;
            if (star.y < 0) star.y = this.height;
            if (star.y > this.height) star.y = 0;
        }
    }

    drawStars() {
        const theme = THEMES_DATA[this.currentTheme] || THEMES_DATA.neon;
        this.ctx.fillStyle = theme.bg;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Center arena grid lines
        this.ctx.save();
        this.ctx.strokeStyle = theme.grid;
        this.ctx.lineWidth = 1;
        const gridSize = 70;
        for (let x = 0; x < this.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        for (let y = 0; y < this.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }

        // Ambient radial nebula
        const grad = this.ctx.createRadialGradient(
            this.width / 2, this.height / 2, 50,
            this.width / 2, this.height / 2,
            Math.max(this.width, this.height) * 0.68
        );
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.width, this.height);

        for (let star of this.stars) {
            this.ctx.fillStyle = star.color;
            this.ctx.globalAlpha = star.alpha;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    // --- INPUT HANDLING ---
    bindEvents() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            if (e.code === 'KeyP' || e.code === 'Escape') {
                if (this.state === 'PLAYING') this.togglePause();
                else if (this.state === 'STATION_SHOP') this.closeShopAndResume();
            }
            if ((e.code === 'KeyE' || e.code === 'KeyQ') && this.state === 'PLAYING') {
                this.useBomb();
            }
            if (e.code === 'KeyB') {
                if (this.state === 'PLAYING' || this.state === 'STATION_SHOP' || this.state === 'ROUND_CLEAR') {
                    this.toggleInGameShop();
                }
            }
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyF') {
                if (this.state === 'PLAYING') this.dashPlayer();
            }
            if (e.code === 'Space') {
                if (this.state === 'PLAYING') {
                    e.preventDefault();
                    const isMoving = this.keys['KeyW'] || this.keys['KeyA'] || this.keys['KeyS'] || this.keys['KeyD'];
                    if (isMoving && this.player && this.player.stamina >= 30) {
                        this.dashPlayer();
                    }
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        const getCanvasCoords = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: (e.clientX - rect.left) * (this.width / rect.width),
                y: (e.clientY - rect.top) * (this.height / rect.height)
            };
        };

        this.canvas.addEventListener('mousemove', (e) => {
            const pos = getCanvasCoords(e);
            this.mouse.x = pos.x;
            this.mouse.y = pos.y;
            this.mouse.active = true;
        });

        this.canvas.addEventListener('mousedown', (e) => {
            window.soundManager.init();
            if (e.button === 0) {
                this.mouse.isDown = true;
                this.mouse.active = true;
            } else if (e.button === 2) {
                e.preventDefault();
                this.useBomb();
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouse.isDown = false;
        });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // First touch activates touch mode and controls
        window.addEventListener('touchstart', () => {
            document.body.classList.add('touch-active');
            const wrapper = document.getElementById('game-wrapper');
            if (wrapper) wrapper.classList.add('touch-mode');
        }, { once: true, passive: true });

        // --- VIRTUAL JOYSTICK (LEFT THUMB) ---
        const joystickZone = document.getElementById('joystick-zone');
        const joystickBase = document.getElementById('joystick-base');
        const joystickKnob = document.getElementById('joystick-knob');

        const updateJoystick = (touch) => {
            if (!joystickBase || !joystickKnob) return;
            const rect = joystickBase.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            let dx = touch.clientX - centerX;
            let dy = touch.clientY - centerY;
            const maxRadius = Math.max(30, rect.width / 2 - 8);
            const dist = Math.hypot(dx, dy);

            if (dist > maxRadius) {
                dx = (dx / dist) * maxRadius;
                dy = (dy / dist) * maxRadius;
            }

            joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
            this.joystick = {
                x: dx / maxRadius,
                y: dy / maxRadius,
                active: true
            };
        };

        const resetJoystick = () => {
            if (joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
            this.joystick = { x: 0, y: 0, active: false };
            this.joystickTouchId = null;
        };

        if (joystickZone) {
            joystickZone.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.soundManager.init();
                const touch = e.changedTouches[0];
                this.joystickTouchId = touch.identifier;
                updateJoystick(touch);
            }, { passive: false });

            joystickZone.addEventListener('touchmove', (e) => {
                e.preventDefault();
                e.stopPropagation();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    if (t.identifier === this.joystickTouchId) {
                        updateJoystick(t);
                        break;
                    }
                }
            }, { passive: false });

            const endJoystick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === this.joystickTouchId) {
                        resetJoystick();
                        break;
                    }
                }
            };

            joystickZone.addEventListener('touchend', endJoystick, { passive: false });
            joystickZone.addEventListener('touchcancel', endJoystick, { passive: false });
        }

        // --- CANVAS TOUCH (RIGHT THUMB: AIM & CONTINUOUS FIRE) ---
        this.canvas.addEventListener('touchstart', (e) => {
            window.soundManager.init();
            if (this.state !== 'PLAYING') return;

            const rect = this.canvas.getBoundingClientRect();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier !== this.joystickTouchId) {
                    this.aimTouchId = t.identifier;
                    const canvasX = (t.clientX - rect.left) * (this.width / rect.width);
                    const canvasY = (t.clientY - rect.top) * (this.height / rect.height);
                    this.mouse.x = canvasX;
                    this.mouse.y = canvasY;
                    this.mouse.active = true;
                    this.mouse.isDown = true;
                    this.touchShooting = true;

                    if (this.player) {
                        this.player.angle = Math.atan2(canvasY - this.player.y, canvasX - this.player.x);
                    }
                    break;
                }
            }
        }, { passive: true });

        this.canvas.addEventListener('touchmove', (e) => {
            if (this.state !== 'PLAYING') return;
            const rect = this.canvas.getBoundingClientRect();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === this.aimTouchId) {
                    const canvasX = (t.clientX - rect.left) * (this.width / rect.width);
                    const canvasY = (t.clientY - rect.top) * (this.height / rect.height);
                    this.mouse.x = canvasX;
                    this.mouse.y = canvasY;
                    this.mouse.active = true;
                    this.mouse.isDown = true;
                    this.touchShooting = true;

                    if (this.player) {
                        this.player.angle = Math.atan2(canvasY - this.player.y, canvasX - this.player.x);
                    }
                    break;
                }
            }
        }, { passive: true });

        const endAimTouch = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.aimTouchId) {
                    this.aimTouchId = null;
                    this.touchShooting = false;
                    this.mouse.isDown = false;
                    break;
                }
            }
        };

        this.canvas.addEventListener('touchend', endAimTouch, { passive: true });
        this.canvas.addEventListener('touchcancel', endAimTouch, { passive: true });

        // --- MOBILE TOUCH BUTTONS ---
        const btnTouchDash = document.getElementById('btn-touch-dash');
        if (btnTouchDash) {
            btnTouchDash.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.state === 'PLAYING') this.dashPlayer();
            }, { passive: false });
            btnTouchDash.addEventListener('click', (e) => {
                if (this.state === 'PLAYING') this.dashPlayer();
            });
        }

        const btnTouchBomb = document.getElementById('btn-touch-bomb');
        if (btnTouchBomb) {
            btnTouchBomb.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.state === 'PLAYING') this.useBomb();
            }, { passive: false });
            btnTouchBomb.addEventListener('click', (e) => {
                if (this.state === 'PLAYING') this.useBomb();
            });
        }

        const btnTouchShop = document.getElementById('btn-touch-shop');
        if (btnTouchShop) {
            btnTouchShop.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleInGameShop();
            }, { passive: false });
            btnTouchShop.addEventListener('click', (e) => {
                this.toggleInGameShop();
            });
        }

        const btnTouchPause = document.getElementById('btn-touch-pause');
        if (btnTouchPause) {
            btnTouchPause.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.togglePause();
            }, { passive: false });
            btnTouchPause.addEventListener('click', (e) => {
                this.togglePause();
            });
        }
    }

    // --- UI SETUP ---
    initUI() {
        this.updateHUDStats();

        // Sync auto-wave checkboxes
        const chkHud = document.getElementById('chk-hud-autowave');
        const chkModal = document.getElementById('chk-modal-autowave');
        if (chkHud) chkHud.checked = !!this.autoWaveEnabled;
        if (chkModal) chkModal.checked = !!this.autoWaveEnabled;

        const setAutoWave = (val) => {
            this.autoWaveEnabled = val;
            if (chkHud) chkHud.checked = val;
            if (chkModal) chkModal.checked = val;
            this.saveGame();
            const msg = val ? 'Автостарт волн ВКЛЮЧЕН' : 'Автостарт волн ВЫКЛЮЧЕН';
            if (this.player && this.state === 'PLAYING') {
                this.addFloatingText(this.player.x, this.player.y - 20, msg, '#00f0ff', 16);
            }
        };

        if (chkHud) chkHud.addEventListener('change', (e) => setAutoWave(e.target.checked));
        if (chkModal) chkModal.addEventListener('change', (e) => setAutoWave(e.target.checked));

        document.getElementById('btn-play').addEventListener('click', () => {
            window.soundManager.init();
            window.soundManager.startAmbientMusic();
            this.startGame();
        });

        document.getElementById('btn-ships').addEventListener('click', () => {
            window.soundManager.init();
            this.openShipsModal();
        });

        document.getElementById('btn-guide').addEventListener('click', () => {
            window.soundManager.init();
            this.showModal('guide-modal');
        });

        // Round Clear / Intermission buttons
        const btnRcShop = document.getElementById('btn-rc-shop');
        if (btnRcShop) {
            btnRcShop.addEventListener('click', () => {
                this.toggleInGameShop(true);
            });
        }

        const btnRcNext = document.getElementById('btn-rc-next');
        if (btnRcNext) {
            btnRcNext.addEventListener('click', () => {
                this.hideModal('round-clear-modal');
                this.state = 'PLAYING';
                this.lastTime = performance.now();
                this.startNextWave();
            });
        }

        document.querySelectorAll('.modal-close, .btn-modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-overlay');
                if (modal) modal.classList.remove('active');
                if (this.state === 'MENU' || this.state === 'GAMEOVER') {
                    this.state = 'MENU';
                    this.showModal('menu-screen');
                }
            });
        });

        document.getElementById('btn-hud-bomb').addEventListener('click', () => this.useBomb());
        document.getElementById('btn-hud-pause').addEventListener('click', () => this.togglePause());

        // In-game shop button
        const hudShopBtn = document.getElementById('btn-hud-shop');
        if (hudShopBtn) {
            hudShopBtn.addEventListener('click', () => this.toggleInGameShop());
        }

        // Shop close buttons
        const shopCloseBtn = document.getElementById('btn-shop-close');
        if (shopCloseBtn) {
            shopCloseBtn.addEventListener('click', () => this.closeShopAndResume());
        }

        const nextWaveShopBtn = document.getElementById('btn-next-wave-shop');
        if (nextWaveShopBtn) {
            nextWaveShopBtn.addEventListener('click', () => this.closeShopAndResume(true));
        }

        const soundBtn = document.getElementById('btn-hud-sound');
        soundBtn.addEventListener('click', () => {
            window.soundManager.init();
            window.soundManager.enabled = !window.soundManager.enabled;
            soundBtn.textContent = window.soundManager.enabled ? '🔊' : '🔇';
        });

        document.getElementById('btn-restart').addEventListener('click', () => {
            this.hideAllModals();
            this.startGame();
        });

        const btnGoShips = document.getElementById('btn-gameover-ships');
        if (btnGoShips) {
            btnGoShips.addEventListener('click', () => {
                this.hideAllModals();
                this.openShipsModal();
            });
        }

        const btnContinue = document.getElementById('btn-continue');
        if (btnContinue) {
            btnContinue.addEventListener('click', () => {
                this.continueRun();
            });
        }

        document.getElementById('btn-resume').addEventListener('click', () => {
            this.togglePause();
        });

        const btnPauseSave = document.getElementById('btn-pause-save');
        if (btnPauseSave) {
            btnPauseSave.addEventListener('click', () => {
                this.saveGame(true);
                this.hideAllModals();
                this.state = 'MENU';
                this.showModal('menu-screen');
                this.updateContinueButton();
            });
        }

        document.getElementById('btn-pause-menu').addEventListener('click', () => {
            this.hideAllModals();
            this.state = 'MENU';
            this.showModal('menu-screen');
            this.updateContinueButton();
        });

        // Theme buttons listener
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.applyTheme(theme);
                window.soundManager.playUpgradeSuccess();
            });
        });

        this.updateContinueButton();
    }

    showModal(id) {
        document.getElementById(id).classList.add('active');
    }

    hideModal(id) {
        document.getElementById(id).classList.remove('active');
    }

    hideAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    }

    updateHUDStats() {
        document.querySelectorAll('.hud-credits-val').forEach(el => el.textContent = this.credits);
        document.querySelectorAll('.hud-score-val').forEach(el => el.textContent = this.score);
        document.querySelectorAll('.hud-wave-val').forEach(el => el.textContent = this.wave);
        const bestEl = document.getElementById('menu-best-score');
        if (bestEl) bestEl.textContent = this.highScore;

        const enemyBadge = document.getElementById('hud-enemies-val');
        if (enemyBadge) {
            if (this.wave % 5 === 0) {
                enemyBadge.textContent = this.currentBoss ? 'БОСС!' : 'ТРЕВОГА';
            } else {
                const remaining = Math.max(0, (this.waveEnemiesToSpawn - this.waveEnemiesSpawned) + this.enemies.length);
                enemyBadge.textContent = remaining;
            }
        }
    }

    // --- GAME INITIALIZATION ---
    startGame() {
        this.savedRun = null;
        this.saveGame(false);
        this.hideAllModals();
        this.state = 'PLAYING';
        this.score = 0;
        this.wave = 1;
        this.enemiesKilled = 0;
        this.runCreditsCollected = 0;
        this.bombCharge = 100;
        this.isWaveTransitioning = false;
        this.shopOpenedFromGame = false;
        this.shopOpenedFromRoundClear = false;

        this.runBonuses = {
            shield: 0,
            hp: 0,
            staminaMax: 0,
            staminaRegen: 1.0,
            shieldRegenSpeed: 1.0,
            dmgMult: 1.0,
            speedMult: 1.0,
            critChance: 0.0,
            vampirism: false,
            dashNova: false
        };

        this.enemies = [];
        this.playerBullets = [];
        this.enemyBullets = [];
        this.bossBeams = [];
        this.pickups = [];
        this.particles = [];
        this.floatingTexts = [];
        this.currentBoss = null;
        this.bossWarningActive = false;
        this.bossPendingSpawn = false;

        this.initPlayer();
        this.setupWave();
        this.updateHUDStats();
        this.updateVitalsHUD();

        this.addFloatingText(this.width / 2, this.height / 2, 'РАУНД 1: В БОЙ!', '#00f0ff', 28);
    }

    initPlayer() {
        const ship = this.ships[this.selectedShipId];
        const baseMaxHp = 100 * ship.hpMult;
        const baseShield = 25 * ship.shieldMult;
        const baseSpeed = 360 * ship.speedMult;
        const baseDmg = 12 * ship.dmgMult;
        const fireInterval = 0.22;
        const multiShotLevel = 1;
        const droneCount = 0;
        const magnetRange = 150;

        this.player = {
            x: this.width / 2,
            y: this.height / 2,
            radius: 20,
            angle: -Math.PI / 2,
            shipConfig: ship,
            maxHp: baseMaxHp,
            hp: baseMaxHp,
            maxShield: baseShield,
            shield: baseShield,
            shieldRegenCooldown: 0,
            maxStamina: 100,
            stamina: 100,
            staminaRegen: 32,
            isDashing: false,
            dashTimer: 0,
            dashVx: 0,
            dashVy: 0,
            speed: baseSpeed,
            damage: baseDmg,
            fireInterval: fireInterval,
            fireCooldown: 0,
            multiShot: multiShotLevel,
            droneCount: droneCount,
            magnetRange: magnetRange,
            invulnerableTimer: 2.0,
            overdriveTimer: 0,
            drones: []
        };

        this.player.drones = [];
        for (let i = 0; i < droneCount; i++) {
            this.addDrone();
        }
    }

    addDrone() {
        if (!this.player) return;
        const count = this.player.drones.length + 1;
        this.player.drones.push({
            angle: (count * (Math.PI * 2 / count)),
            fireCooldown: 0,
            radius: 46
        });
    }

    // --- DASH WITH 100% I-FRAMES ---
    dashPlayer() {
        const p = this.player;
        if (!p || p.isDashing || p.stamina < 30) return;

        p.stamina -= 30;
        p.isDashing = true;
        p.dashTimer = 0.28;
        p.invulnerableTimer = 0.35; // Guaranteed i-frames
        window.soundManager.playDash();

        let dx = 0, dy = 0;
        if (this.keys['KeyA']) dx -= 1;
        if (this.keys['KeyD']) dx += 1;
        if (this.keys['KeyW']) dy -= 1;
        if (this.keys['KeyS']) dy += 1;

        if (this.joystick && this.joystick.active && (this.joystick.x !== 0 || this.joystick.y !== 0)) {
            dx = this.joystick.x;
            dy = this.joystick.y;
        }

        if (dx === 0 && dy === 0) {
            dx = Math.cos(p.angle);
            dy = Math.sin(p.angle);
        } else {
            const len = Math.hypot(dx, dy);
            dx /= len;
            dy /= len;
        }

        const dashSpeed = p.speed * 3.4;
        p.dashVx = dx * dashSpeed;
        p.dashVy = dy * dashSpeed;

        // Visual dash burst
        for (let i = 0; i < 24; i++) {
            this.particles.push(new Particle(
                p.x + (Math.random() * 20 - 10),
                p.y + (Math.random() * 20 - 10),
                -dx * Math.random() * 220,
                -dy * Math.random() * 220,
                Math.random() * 4 + 2,
                p.shipConfig.color,
                0.35
            ));
        }

        // Perk: Dash Nova
        if (this.runBonuses.dashNova) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                this.playerBullets.push(new Bullet(
                    p.x, p.y,
                    Math.cos(a) * 550, Math.sin(a) * 550,
                    p.damage * 0.75,
                    '#ffd166',
                    4
                ));
            }
        }
    }

    useBomb() {
        if (this.state !== 'PLAYING' || !this.player || this.bombCharge < 100) return;
        this.bombCharge = 0;
        window.soundManager.playBomb();
        this.screenShake = 28;

        for (let i = 0; i < 90; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * 450 + 100;
            this.particles.push(new Particle(
                this.player.x, this.player.y,
                Math.cos(angle) * spd, Math.sin(angle) * spd,
                Math.random() * 5 + 3, '#a855f7', 1.0
            ));
        }

        this.enemyBullets = [];
        this.bossBeams = [];

        const bombDamage = 60;
        for (let enemy of [...this.enemies]) {
            enemy.takeDamage(bombDamage);
        }
        if (this.currentBoss) {
            this.currentBoss.takeDamage(bombDamage);
        }

        this.addFloatingText(this.player.x, this.player.y - 40, 'ЭМИ ВСПЫШКА [-60 HP]!', '#a855f7', 22);
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            this.showModal('pause-modal');
        } else if (this.state === 'PAUSED') {
            this.hideModal('pause-modal');
            this.state = 'PLAYING';
            this.lastTime = performance.now();

            // RESUME BOSS RECOVERY
            if (this.wave % 5 === 0) {
                if (!this.currentBoss && !this.isWaveTransitioning && (this.bossPendingSpawn || !this.bossWarningActive)) {
                    this.bossPendingSpawn = false;
                    this.spawnBoss();
                }
                if (this.currentBoss) {
                    const bossHud = document.getElementById('boss-hud');
                    if (bossHud) bossHud.classList.add('active');
                    this.updateBossHUD();
                }
            }
        }
    }

    // --- IN-GAME & POST-ROUND SHOP TOGGLE ---
    toggleInGameShop(fromRoundClear = false) {
        if (this.state === 'PLAYING') {
            this.shopOpenedFromGame = true;
            this.shopOpenedFromRoundClear = false;
            this.state = 'STATION_SHOP';
            const title = document.getElementById('shop-modal-title');
            const sub = document.getElementById('shop-modal-subtitle');
            const hint = document.getElementById('shop-modal-footer-hint');
            const btn = document.getElementById('btn-next-wave-shop');
            if (title) title.innerHTML = '🛰️ ВНУТРИИГРОВОЙ <span class="glow">МАГАЗИН</span>';
            if (sub) sub.textContent = 'Покупайте улучшения корабля прямо сейчас! [Игра на паузе]';
            if (hint) hint.textContent = 'Улучшения применяются моментально!';
            if (btn) btn.textContent = 'В БОЙ: ПРОДОЛЖИТЬ ➔';

            this.renderStationShopUI();
            this.showModal('shop-modal');
        } else if (this.state === 'ROUND_CLEAR' || fromRoundClear) {
            this.shopOpenedFromGame = false;
            this.shopOpenedFromRoundClear = true;
            this.hideModal('round-clear-modal');
            this.state = 'STATION_SHOP';
            const title = document.getElementById('shop-modal-title');
            const sub = document.getElementById('shop-modal-subtitle');
            const hint = document.getElementById('shop-modal-footer-hint');
            const btn = document.getElementById('btn-next-wave-shop');
            if (title) title.innerHTML = '🛰️ ОРБИТАЛЬНАЯ <span class="glow">СТАНЦИЯ</span>';
            if (sub) sub.textContent = 'Магазин предметов: прокачайте корабль перед следующей волной!';
            if (hint) hint.textContent = 'Готовы к следующему бою?';
            if (btn) btn.textContent = `В БОЙ: РАУНД ${this.wave + 1} ➔`;

            this.renderStationShopUI();
            this.showModal('shop-modal');
        } else if (this.state === 'STATION_SHOP') {
            this.closeShopAndResume();
        }
    }

    closeShopAndResume(startNext = false) {
        this.hideModal('shop-modal');
        if (this.shopOpenedFromRoundClear) {
            this.shopOpenedFromRoundClear = false;
            if (startNext) {
                this.state = 'PLAYING';
                this.lastTime = performance.now();
                this.startNextWave();
            } else {
                this.openRoundClearModal();
            }
        } else {
            // Opened during game
            this.shopOpenedFromGame = false;
            this.state = 'PLAYING';
            this.lastTime = performance.now();

            // RESUME BOSS RECOVERY: If in boss wave and boss was pending or active
            if (this.wave % 5 === 0) {
                if (!this.currentBoss && !this.isWaveTransitioning && (this.bossPendingSpawn || !this.bossWarningActive)) {
                    this.bossPendingSpawn = false;
                    this.spawnBoss();
                }
                if (this.currentBoss) {
                    const bossHud = document.getElementById('boss-hud');
                    if (bossHud) bossHud.classList.add('active');
                    this.updateBossHUD();
                }
            }
        }
    }

    // --- MAIN LOOP ---
    loop(currentTime) {
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        this.updateStars(dt);

        if (this.state === 'PLAYING') {
            this.update(dt);
        }

        this.render();
        requestAnimationFrame((t) => this.loop(t));
    }

    // --- UPDATE GAMEPLAY ---
    update(dt) {
        if (this.screenShake > 0) {
            this.screenShake = Math.max(0, this.screenShake - dt * 35);
        }

        if (this.bombCharge < 100) {
            this.bombCharge = Math.min(100, this.bombCharge + dt * 5);
            const btn = document.getElementById('btn-hud-bomb');
            if (btn) btn.disabled = (this.bombCharge < 100);
        }

        const touchBombBtn = document.getElementById('btn-touch-bomb');
        const touchBombPct = document.getElementById('touch-bomb-pct');
        if (touchBombBtn) {
            touchBombBtn.style.opacity = this.bombCharge >= 100 ? '1' : '0.6';
        }
        if (touchBombPct) {
            touchBombPct.textContent = `${Math.floor(this.bombCharge)}%`;
        }

        this.updatePlayer(dt);
        this.updateWave(dt);
        this.updatePlayerBullets(dt);
        this.updateEnemies(dt);
        this.updateEnemyBullets(dt);
        this.updateBossBeams(dt);
        this.updatePickups(dt);
        this.updateParticles(dt);
        this.updateFloatingTexts(dt);
        this.checkCollisions();
        this.updateVitalsHUD();
    }

    updatePlayer(dt) {
        const p = this.player;
        if (!p) return;

        if (p.invulnerableTimer > 0) p.invulnerableTimer -= dt;
        if (p.overdriveTimer > 0) p.overdriveTimer -= dt;

        if (p.stamina < p.maxStamina) {
            p.stamina = Math.min(p.maxStamina, p.stamina + (p.staminaRegen * this.runBonuses.staminaRegen) * dt);
        }

        if (p.shield < p.maxShield) {
            if (p.shieldRegenCooldown > 0) {
                p.shieldRegenCooldown -= dt;
            } else {
                p.shield = Math.min(p.maxShield, p.shield + (p.maxShield * 0.18 * this.runBonuses.shieldRegenSpeed) * dt);
            }
        }

        // --- DASH HANDLING ---
        if (p.isDashing) {
            p.dashTimer -= dt;
            p.x += p.dashVx * dt;
            p.y += p.dashVy * dt;

            // Ensure i-frames during dash
            p.invulnerableTimer = Math.max(p.invulnerableTimer, p.dashTimer);

            // Dash after-image particles
            this.particles.push(new Particle(p.x, p.y, 0, 0, 16, p.shipConfig.color, 0.15));

            if (p.dashTimer <= 0) {
                p.isDashing = false;
            }
        } else {
            // Normal 8-directional movement & Mobile Joystick
            let moveX = 0;
            let moveY = 0;

            if (this.keys['KeyA']) moveX -= 1;
            if (this.keys['KeyD']) moveX += 1;
            if (this.keys['KeyW']) moveY -= 1;
            if (this.keys['KeyS']) moveY += 1;

            if (this.joystick && this.joystick.active) {
                moveX = this.joystick.x;
                moveY = this.joystick.y;
            }

            if (moveX !== 0 || moveY !== 0) {
                const len = Math.hypot(moveX, moveY);
                const intensity = Math.min(1.0, len);
                p.x += (moveX / len) * p.speed * intensity * dt;
                p.y += (moveY / len) * p.speed * intensity * dt;

                const rearAngle = p.angle + Math.PI;
                this.particles.push(new Particle(
                    p.x + Math.cos(rearAngle) * 18 + (Math.random() * 6 - 3),
                    p.y + Math.sin(rearAngle) * 18 + (Math.random() * 6 - 3),
                    Math.cos(rearAngle) * 120 + (Math.random() * 40 - 20),
                    Math.sin(rearAngle) * 120 + (Math.random() * 40 - 20),
                    Math.random() * 3 + 2,
                    p.shipConfig.color,
                    0.25
                ));
            }
        }

        // --- 360-DEGREE ROTATION & AIMING ---
        let arrowX = 0, arrowY = 0;
        if (this.keys['ArrowLeft']) arrowX -= 1;
        if (this.keys['ArrowRight']) arrowX += 1;
        if (this.keys['ArrowUp']) arrowY -= 1;
        if (this.keys['ArrowDown']) arrowY += 1;

        let keyboardShooting = false;
        if (arrowX !== 0 || arrowY !== 0) {
            p.angle = Math.atan2(arrowY, arrowX);
            keyboardShooting = true;
        } else if (this.mouse.active) {
            p.angle = Math.atan2(this.mouse.y - p.y, this.mouse.x - p.x);
        }

        p.x = Math.max(30, Math.min(this.width - 30, p.x));
        p.y = Math.max(30, Math.min(this.height - 30, p.y));

        // --- SHOOTING ---
        const isShooting = this.mouse.isDown || this.keys['Space'] || this.keys['KeyJ'] || keyboardShooting || this.touchShooting;
        const currentInterval = p.overdriveTimer > 0 ? p.fireInterval * 0.45 : p.fireInterval;

        p.fireCooldown -= dt;
        if (isShooting && p.fireCooldown <= 0) {
            this.firePlayerWeapon();
            p.fireCooldown = currentInterval;
        }

        // --- DRONES ORBIT & ATTACK ---
        p.drones.forEach((drone) => {
            drone.angle += dt * 2.2;
            drone.fireCooldown -= dt;
            const droneX = p.x + Math.cos(drone.angle) * drone.radius;
            const droneY = p.y + Math.sin(drone.angle) * drone.radius;

            if (drone.fireCooldown <= 0 && (this.enemies.length > 0 || this.currentBoss)) {
                let target = this.currentBoss;
                let minDist = target ? Math.hypot(target.x - droneX, target.y - droneY) : 9999;

                for (let e of this.enemies) {
                    const dist = Math.hypot(e.x - droneX, e.y - droneY);
                    if (dist < minDist) {
                        minDist = dist;
                        target = e;
                    }
                }

                if (target && minDist < 480) {
                    const aimAngle = Math.atan2(target.y - droneY, target.x - droneX);
                    this.playerBullets.push(new Bullet(
                        droneX, droneY,
                        Math.cos(aimAngle) * 650, Math.sin(aimAngle) * 650,
                        p.damage * 0.45,
                        '#00ff9d',
                        3.5
                    ));
                    window.soundManager.playLaser(1.4, false);
                    drone.fireCooldown = 0.35;
                }
            }
        });
    }

    firePlayerWeapon() {
        const p = this.player;
        let dmg = p.damage;

        let isCrit = false;
        if (Math.random() < this.runBonuses.critChance) {
            dmg *= 3.0;
            isCrit = true;
        }

        window.soundManager.playLaser(1.0, false);
        const bulletSpeed = 860;
        const angle = p.angle;
        const noseX = p.x + Math.cos(angle) * 22;
        const noseY = p.y + Math.sin(angle) * 22;
        const bulletColor = isCrit ? '#ffd166' : p.shipConfig.color;

        switch (p.multiShot) {
            case 1:
                this.playerBullets.push(new Bullet(noseX, noseY, Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed, dmg, bulletColor, 4));
                break;
            case 2: {
                const perpX = Math.cos(angle + Math.PI / 2) * 10;
                const perpY = Math.sin(angle + Math.PI / 2) * 10;
                this.playerBullets.push(new Bullet(noseX + perpX, noseY + perpY, Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed, dmg * 0.9, bulletColor, 4));
                this.playerBullets.push(new Bullet(noseX - perpX, noseY - perpY, Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed, dmg * 0.9, bulletColor, 4));
                break;
            }
            case 3:
                this.playerBullets.push(new Bullet(noseX, noseY, Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed, dmg, bulletColor, 4));
                this.playerBullets.push(new Bullet(noseX, noseY, Math.cos(angle - 0.22) * bulletSpeed, Math.sin(angle - 0.22) * bulletSpeed, dmg * 0.85, bulletColor, 4));
                this.playerBullets.push(new Bullet(noseX, noseY, Math.cos(angle + 0.22) * bulletSpeed, Math.sin(angle + 0.22) * bulletSpeed, dmg * 0.85, bulletColor, 4));
                break;
            case 4:
                for (let a of [-0.25, -0.08, 0.08, 0.25]) {
                    this.playerBullets.push(new Bullet(noseX, noseY, Math.cos(angle + a) * bulletSpeed, Math.sin(angle + a) * bulletSpeed, dmg * 0.8, bulletColor, 4));
                }
                break;
            case 5:
            default:
                for (let a of [-0.35, -0.18, 0, 0.18, 0.35]) {
                    this.playerBullets.push(new Bullet(noseX, noseY, Math.cos(angle + a) * bulletSpeed, Math.sin(angle + a) * bulletSpeed, dmg * 0.75, bulletColor, 4));
                }
                break;
        }

        if (isCrit) {
            this.addFloatingText(noseX, noseY - 15, 'КРИТИЧЕСКИЙ!', '#ffd166', 15);
        }
    }

    // --- WAVE PROGRESSION (FIXED & SCALED) ---
    setupWave() {
        this.isWaveTransitioning = false;
        this.bossWarningActive = false;
        this.bossPendingSpawn = false;
        const isBossWave = (this.wave % 5 === 0);

        if (isBossWave) {
            this.waveEnemiesToSpawn = 0;
            this.waveEnemiesSpawned = 0;
            this.triggerBossWarning();
        } else {
            // Progressive, fixed addition per round: Round 1: 8, Round 2: 12, Round 3: 16...
            this.waveEnemiesToSpawn = 8 + (this.wave - 1) * 4;
            this.waveEnemiesSpawned = 0;
            this.spawnTimer = 0;
        }

        this.updateHUDStats();
    }

    updateWave(dt) {
        // Prevent multi-frame trigger loops
        if (this.isWaveTransitioning) return;

        if (this.currentBoss) {
            this.currentBoss.update(dt, this);
            this.updateBossHUD();
            if (this.currentBoss.isDead) {
                this.onBossDefeated();
            }
            return;
        }

        const isBossWave = (this.wave % 5 === 0);
        if (isBossWave) {
            // Failsafe recovery: if warning is finished and boss not spawned, spawn it!
            if (!this.bossWarningActive && !this.isWaveTransitioning && !this.currentBoss) {
                this.bossPendingSpawn = false;
                this.spawnBoss();
            }
            return;
        }

        // Regular waves: spawn enemies until quota reached
        if (this.waveEnemiesSpawned < this.waveEnemiesToSpawn) {
            this.spawnTimer += dt;
            const interval = Math.max(0.65, 2.0 - (this.wave * 0.08));
            if (this.spawnTimer >= interval) {
                this.spawnTimer = 0;
                this.spawnPerimeterEnemies();
            }
        } else if (this.enemies.length === 0) {
            // All wave enemies dead! Trigger single clear event
            this.isWaveTransitioning = true;
            this.onWaveClear();
        }

        this.updateHUDStats();
    }

    spawnPerimeterEnemies() {
        const count = Math.min(3, Math.floor(Math.random() * 2) + 1);

        // Difficulty progression: enemy variety increases per round
        const types = ['scout'];
        if (this.wave >= 2) types.push('asteroid');
        if (this.wave >= 3) types.push('interceptor');
        if (this.wave >= 4) types.push('kamikaze');
        if (this.wave >= 6) types.push('cruiser');

        for (let i = 0; i < count; i++) {
            if (this.waveEnemiesSpawned >= this.waveEnemiesToSpawn) break;

            const randType = types[Math.floor(Math.random() * types.length)];
            const pos = this.getRandomPerimeterPos();
            this.enemies.push(new Enemy(randType, pos.x, pos.y, this.wave));
            this.waveEnemiesSpawned++;
        }
    }

    getRandomPerimeterPos() {
        const edge = Math.floor(Math.random() * 4);
        const offset = 45;
        switch (edge) {
            case 0: return { x: Math.random() * this.width, y: -offset };
            case 1: return { x: Math.random() * this.width, y: this.height + offset };
            case 2: return { x: -offset, y: Math.random() * this.height };
            case 3: default: return { x: this.width + offset, y: Math.random() * this.height };
        }
    }

    triggerBossWarning() {
        this.bossWarningActive = true;
        this.bossPendingSpawn = false;
        window.soundManager.playBossWarning();
        const banner = document.getElementById('boss-warning-banner');
        let bossName = "ЭГИДА-ДРЕДНОУТ";
        if (this.wave === 10) bossName = "КИБЕР-ЛЕВИАФАН";
        if (this.wave >= 15) bossName = "ВЛАДЫКА ПУСТОТЫ";

        if (banner) {
            banner.innerHTML = `⚠️ ВНИМАНИЕ! БОСС ${this.wave} РАУНДА: ${bossName} ⚠️`;
            banner.style.display = 'block';
        }

        setTimeout(() => {
            if (banner) banner.style.display = 'none';
            this.bossWarningActive = false;
            if (!this.currentBoss) {
                if (this.state === 'PLAYING') {
                    this.spawnBoss();
                } else {
                    this.bossPendingSpawn = true;
                }
            }
        }, 2600);
    }

    spawnBoss() {
        if (this.currentBoss) return;
        this.currentBoss = new Boss(this.wave, this.width / 2, -120);
        const bossHud = document.getElementById('boss-hud');
        if (bossHud) bossHud.classList.add('active');
        document.getElementById('boss-name').textContent = this.currentBoss.name;
        this.updateBossHUD();
    }

    updateBossHUD() {
        if (!this.currentBoss) return;
        const fill = document.getElementById('boss-hp-fill');
        const pct = Math.max(0, (this.currentBoss.hp / this.currentBoss.maxHp) * 100);
        if (fill) fill.style.width = pct + '%';
    }

    onBossDefeated() {
        window.soundManager.playExplosion('boss');
        this.screenShake = 35;

        for (let i = 0; i < 45; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * 220 + 40;
            this.pickups.push(new Coin(
                this.currentBoss.x, this.currentBoss.y,
                Math.cos(angle) * spd, Math.sin(angle) * spd,
                2
            ));
        }

        this.pickups.push(new Powerup(this.currentBoss.x - 30, this.currentBoss.y, 'heal'));
        this.pickups.push(new Powerup(this.currentBoss.x + 30, this.currentBoss.y, 'overdrive'));

        this.addScore(5000 * Math.floor(this.wave / 5));
        this.currentBoss = null;
        this.bossWarningActive = false;
        this.bossPendingSpawn = false;
        const bossHud = document.getElementById('boss-hud');
        if (bossHud) bossHud.classList.remove('active');

        this.onWaveClear(true);
    }

    // --- POST-ROUND 3-CARD PERK SELECTION (EVERY ROUND) ---
    openPerkChoiceModal(isBoss = false) {
        this.state = 'PERK_SELECT';
        window.soundManager.playUpgradeSuccess();

        const subtitle = document.getElementById('perk-modal-subtitle');
        if (subtitle) {
            subtitle.textContent = isBoss
                ? `Победа над боссом раунда ${this.wave}! Выберите 1 мощное улучшение:`
                : `Раунд ${this.wave} завершен! Выберите 1 бесплатное улучшение перед следующим боем:`;
        }

        const container = document.getElementById('perk-cards-container');
        if (!container) return;
        container.innerHTML = '';

        const shuffled = [...PERK_POOL].sort(() => 0.5 - Math.random());
        const selectedPerks = shuffled.slice(0, 3);

        selectedPerks.forEach(perk => {
            const card = document.createElement('div');
            card.className = 'perk-choice-card';

            const rarityName = perk.rarity === 'legendary' ? 'ЛЕГЕНДАРНОЕ' : perk.rarity === 'epic' ? 'ЭПИЧЕСКОЕ' : perk.rarity === 'rare' ? 'РЕДКОЕ' : 'ОБЫЧНОЕ';

            card.innerHTML = `
                <div class="perk-rarity rarity-${perk.rarity}">${rarityName}</div>
                <div class="perk-icon">${perk.icon}</div>
                <div class="perk-name">${perk.name}</div>
                <div class="perk-desc">${perk.desc}</div>
                <button class="btn btn-primary btn-sm" style="width: 100%; margin-top: auto;">ВЫБРАТЬ</button>
            `;

            card.addEventListener('click', () => {
                perk.apply(this);
                window.soundManager.playPerkSelect();
                this.hideModal('perk-modal');
                this.addFloatingText(this.player.x, this.player.y - 30, `+ ${perk.name}!`, '#00f0ff', 20);
                this.updateVitalsHUD();
                this.updateHUDStats();
                this.saveGame(true); // Auto-save after perk choice

                if (this.autoWaveEnabled) {
                    this.state = 'PLAYING';
                    this.lastTime = performance.now();
                    this.addFloatingText(this.width / 2, this.height / 2 - 40, 'АВТОСТАРТ СЛЕДУЮЩЕЙ ВОЛНЫ...', '#ffd166', 22);
                    setTimeout(() => {
                        if (this.state === 'PLAYING') {
                            this.startNextWave();
                        }
                    }, 1200);
                } else {
                    setTimeout(() => {
                        this.openRoundClearModal();
                    }, 350);
                }
            });

            container.appendChild(card);
        });

        this.showModal('perk-modal');
    }

    openRoundClearModal() {
        this.state = 'ROUND_CLEAR';
        const title = document.getElementById('rc-title');
        const sub = document.getElementById('rc-subtitle');
        const score = document.getElementById('rc-score');
        const kills = document.getElementById('rc-kills');
        const credits = document.getElementById('rc-credits');
        const nextVal = document.getElementById('rc-next-val');
        const chkModal = document.getElementById('chk-modal-autowave');

        if (title) title.textContent = `РАУНД ${this.wave} ЗАВЕРШЕН! 🎉`;
        if (sub) sub.textContent = `Сектор очищен от врагов! Подготовьтесь к раунду ${this.wave + 1}.`;
        if (score) score.textContent = this.score;
        if (kills) kills.textContent = this.enemiesKilled;
        if (credits) credits.textContent = this.credits;
        if (nextVal) nextVal.textContent = `РАУНД ${this.wave + 1}`;
        if (chkModal) chkModal.checked = !!this.autoWaveEnabled;

        this.saveGame(true);
        this.showModal('round-clear-modal');
    }

    renderStationShopUI() {
        const container = document.getElementById('station-shop-container');
        if (!container) return;
        container.innerHTML = '';
        this.updateHUDStats();

        STATION_SHOP_ITEMS.forEach(item => {
            const card = document.createElement('div');
            card.className = 'station-item-card';

            card.innerHTML = `
                <div class="station-item-top">
                    <div class="station-item-icon">${item.icon}</div>
                    <div class="station-item-info">
                        <div class="station-item-title">${item.title}</div>
                        <div class="station-item-count">Магазин предметов</div>
                    </div>
                </div>
                <div class="station-item-desc">${item.desc}</div>
                <div class="station-item-action">
                    <span class="currency-badge" style="font-size: 14px;">💎 ${item.baseCost}</span>
                    <button class="btn btn-primary btn-sm btn-station-buy" ${this.credits < item.baseCost ? 'disabled' : ''} data-id="${item.id}">
                        КУПИТЬ
                    </button>
                </div>
            `;

            card.querySelector('.btn-station-buy').addEventListener('click', () => {
                if (this.credits >= item.baseCost) {
                    this.credits -= item.baseCost;
                    item.apply(this);
                    window.soundManager.playShopBuy();
                    this.updateVitalsHUD();
                    this.saveGame(true); // Auto-save on purchase
                    this.renderStationShopUI();
                }
            });

            container.appendChild(card);
        });
    }

    onWaveClear(isBoss = false) {
        this.isWaveTransitioning = true;
        this.enemyBullets = [];
        this.bossBeams = [];
        this.addScore(isBoss ? 2000 : 300 * this.wave);
        window.soundManager.playUpgradeSuccess();
        this.addFloatingText(this.width / 2, this.height / 2, isBoss ? 'БОСС ПОВЕРЖЕН!' : `РАУНД ${this.wave} ЗАВЕРШЕН!`, '#06d6a0', 28);
        this.saveGame(true); // Auto-save on round clear

        setTimeout(() => {
            if (this.state === 'PLAYING') {
                this.openPerkChoiceModal(isBoss);
            }
        }, 900);
    }

    startNextWave() {
        this.hideAllModals();
        this.state = 'PLAYING';
        this.isWaveTransitioning = false;
        this.wave++;
        this.setupWave();
        this.lastTime = performance.now();
        window.soundManager.playWaveStart();
        this.addFloatingText(this.width / 2, this.height / 2, `РАУНД ${this.wave}`, '#00f0ff', 32);
        this.saveGame(true);
    }

    // --- BULLET UPDATES ---
    updatePlayerBullets(dt) {
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const b = this.playerBullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;

            if (b.x < -60 || b.x > this.width + 60 || b.y < -60 || b.y > this.height + 60) {
                this.playerBullets.splice(i, 1);
            }
        }
    }

    updateEnemyBullets(dt) {
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const b = this.enemyBullets[i];
            b.update(dt, this.player);

            if (b.x < -60 || b.x > this.width + 60 || b.y < -60 || b.y > this.height + 60 || b.isDead) {
                this.enemyBullets.splice(i, 1);
            }
        }
    }

    updateBossBeams(dt) {
        for (let i = this.bossBeams.length - 1; i >= 0; i--) {
            const beam = this.bossBeams[i];
            beam.update(dt);
            if (beam.isFinished) {
                this.bossBeams.splice(i, 1);
            }
        }
    }

    // --- ENEMY UPDATES ---
    updateEnemies(dt) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(dt, this);

            if (enemy.isDead) {
                this.onEnemyKilled(enemy);
                this.enemies.splice(i, 1);
            }
        }
    }

    onEnemyKilled(enemy) {
        this.enemiesKilled++;
        this.addScore(enemy.scoreValue);
        window.soundManager.playExplosion(enemy.type === 'cruiser' ? 'medium' : 'small');
        this.screenShake = enemy.type === 'cruiser' ? 8 : 3;

        for (let i = 0; i < 16; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * 180 + 30;
            this.particles.push(new Particle(
                enemy.x, enemy.y,
                Math.cos(angle) * spd, Math.sin(angle) * spd,
                Math.random() * 3 + 2,
                enemy.color,
                0.4
            ));
        }

        const coinCount = enemy.coinCount || 2;
        for (let c = 0; c < coinCount; c++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * 140 + 20;
            this.pickups.push(new Coin(
                enemy.x, enemy.y,
                Math.cos(angle) * spd, Math.sin(angle) * spd,
                1
            ));
        }

        const pRoll = Math.random();
        if (pRoll < 0.08) {
            this.pickups.push(new Powerup(enemy.x, enemy.y, 'heal'));
        } else if (pRoll < 0.15) {
            this.pickups.push(new Powerup(enemy.x, enemy.y, 'overdrive'));
        } else if (pRoll < 0.20) {
            this.pickups.push(new Powerup(enemy.x, enemy.y, 'shield'));
        }

        if (this.runBonuses.vampirism && Math.random() < 0.15 && this.player) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 3);
            this.addFloatingText(this.player.x, this.player.y - 20, '+3 HP ВАМПИРИЗМ', '#06d6a0', 14);
        }
    }

    // --- PICKUPS (COINS & POWERUPS) ---
    updatePickups(dt) {
        const p = this.player;
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const item = this.pickups[i];
            item.update(dt, p);

            if (p && Math.hypot(item.x - p.x, item.y - p.y) < p.radius + item.radius) {
                this.collectPickup(item);
                this.pickups.splice(i, 1);
            }
        }
    }

    collectPickup(item) {
        if (item.isCoin) {
            this.credits += item.value;
            this.runCreditsCollected += item.value;
            this.bombCharge = Math.min(100, this.bombCharge + 3);
            window.soundManager.playCoin();
            this.addFloatingText(item.x, item.y, `+${item.value} 💎`, '#ffd166', 15);
            this.updateHUDStats();
            return;
        }

        switch (item.type) {
            case 'heal':
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35);
                window.soundManager.playPowerUp();
                this.addFloatingText(this.player.x, this.player.y - 20, '+35 HP РЕМОНТ', '#06d6a0', 16);
                break;
            case 'overdrive':
                this.player.overdriveTimer = 8.0;
                window.soundManager.playPowerUp();
                this.addFloatingText(this.player.x, this.player.y - 20, '⚡ ТУРБО-ОГОНЬ!', '#ffd166', 18);
                break;
            case 'shield':
                this.player.shield = this.player.maxShield;
                this.player.invulnerableTimer = 3.0;
                window.soundManager.playPowerUp();
                this.addFloatingText(this.player.x, this.player.y - 20, '🛡️ МАКС ЩИТ!', '#00f0ff', 18);
                break;
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.update(dt);
            if (pt.life <= 0) this.particles.splice(i, 1);
        }
    }

    updateFloatingTexts(dt) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.update(dt);
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    addFloatingText(x, y, text, color = '#fff', size = 16) {
        this.floatingTexts.push(new FloatingText(x, y, text, color, size));
    }

    addScore(pts) {
        this.score += pts;
        if (this.score > this.highScore) {
            this.highScore = this.score;
        }
        this.updateHUDStats();
    }

    // --- COLLISIONS WITH FULL DASH I-FRAMES ---
    checkCollisions() {
        const p = this.player;
        if (!p || p.hp <= 0) return;

        // 1. Player Bullets vs Enemies & Boss
        for (let b of this.playerBullets) {
            for (let e of this.enemies) {
                if (!e.isDead && Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
                    e.takeDamage(b.damage);
                    b.isDead = true;
                    this.createHitSparks(b.x, b.y, '#00f0ff');
                    break;
                }
            }

            if (this.currentBoss && !b.isDead) {
                if (Math.hypot(b.x - this.currentBoss.x, b.y - this.currentBoss.y) < b.radius + this.currentBoss.radius) {
                    this.currentBoss.takeDamage(b.damage);
                    b.isDead = true;
                    this.createHitSparks(b.x, b.y, '#ff0055');
                }
            }
        }
        this.playerBullets = this.playerBullets.filter(b => !b.isDead);

        // 2. Enemy Bullets vs Player (Completely blocked during Dash i-frames!)
        if (p.invulnerableTimer <= 0 && !p.isDashing) {
            for (let b of this.enemyBullets) {
                if (!b.isDead && Math.hypot(b.x - p.x, b.y - p.y) < b.radius + p.radius) {
                    this.damagePlayer(b.damage);
                    b.isDead = true;
                    this.createHitSparks(p.x, p.y, '#ff2e63');
                }
            }
        }

        // 3. Enemy Ramming vs Player
        for (let e of this.enemies) {
            if (!e.isDead && Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.radius) {
                if (p.isDashing) {
                    // Dash i-frame attack: Smash enemy with 85 damage and take 0 damage!
                    e.takeDamage(85);
                    this.createHitSparks(e.x, e.y, '#00f0ff');
                    this.screenShake = 6;
                    this.addFloatingText(e.x, e.y, 'ТАРАН РЫВКОМ!', '#00f0ff', 16);
                } else if (p.invulnerableTimer <= 0) {
                    this.damagePlayer(35);
                    e.takeDamage(999);
                    this.createHitSparks(p.x, p.y, '#ffaa00');
                }
            }
        }

        // 4. Boss Laser Beams (Completely blocked during Dash i-frames!)
        if (p.invulnerableTimer <= 0 && !p.isDashing) {
            for (let beam of this.bossBeams) {
                if (beam.isFired && Math.hypot(p.x - beam.x, p.y - beam.y) < beam.width / 2 + p.radius) {
                    this.damagePlayer(beam.damagePerSec * 0.05);
                    this.createHitSparks(p.x, p.y, '#ff0055');
                }
            }
        }

        this.enemyBullets = this.enemyBullets.filter(b => !b.isDead);
    }

    damagePlayer(amount) {
        const p = this.player;
        // Total i-frames safety guard
        if (!p || p.invulnerableTimer > 0 || p.isDashing) return;

        window.soundManager.playPlayerHit();
        this.screenShake = 12;
        p.shieldRegenCooldown = 3.5;

        if (p.shield > 0) {
            if (p.shield >= amount) {
                p.shield -= amount;
                amount = 0;
            } else {
                amount -= p.shield;
                p.shield = 0;
            }
        }

        if (amount > 0) {
            p.hp -= amount;
            if (p.hp <= 0) {
                p.hp = 0;
                this.gameOver();
            }
        }
    }

    createHitSparks(x, y, color) {
        for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * 80 + 30;
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * spd, Math.sin(angle) * spd,
                Math.random() * 2 + 1, color, 0.2
            ));
        }
    }

    updateVitalsHUD() {
        if (!this.player) return;
        const hpFill = document.getElementById('hp-fill');
        const shieldFill = document.getElementById('shield-fill');
        const staminaFill = document.getElementById('stamina-fill');
        const hpVal = document.getElementById('hp-val');
        const shieldVal = document.getElementById('shield-val');
        const staminaVal = document.getElementById('stamina-val');

        const hpPct = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
        const shieldPct = this.player.maxShield > 0 ? Math.max(0, (this.player.shield / this.player.maxShield) * 100) : 0;
        const staminaPct = Math.max(0, (this.player.stamina / this.player.maxStamina) * 100);

        if (hpFill) hpFill.style.width = hpPct + '%';
        if (shieldFill) shieldFill.style.width = shieldPct + '%';
        if (staminaFill) staminaFill.style.width = staminaPct + '%';

        if (hpVal) hpVal.textContent = Math.ceil(this.player.hp);
        if (shieldVal) shieldVal.textContent = Math.ceil(this.player.shield);
        if (staminaVal) staminaVal.textContent = Math.ceil(staminaPct) + '%';
    }

    // --- GAME OVER ---
    gameOver() {
        this.state = 'GAMEOVER';
        window.soundManager.playExplosion('boss');
        this.savedRun = null;
        this.saveGame(false);
        this.updateContinueButton();

        for (let i = 0; i < 60; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * 320 + 50;
            this.particles.push(new Particle(
                this.player.x, this.player.y,
                Math.cos(angle) * spd, Math.sin(angle) * spd,
                Math.random() * 4 + 2, this.player.shipConfig.color, 0.8
            ));
        }

        setTimeout(() => {
            document.getElementById('go-score').textContent = this.score;
            document.getElementById('go-wave').textContent = this.wave;
            document.getElementById('go-kills').textContent = this.enemiesKilled;
            document.getElementById('go-credits').textContent = this.runCreditsCollected;
            this.showModal('gameover-modal');
        }, 1200);
    }

    // --- RENDER PASS ---
    render() {
        this.ctx.save();

        if (this.screenShake > 0) {
            const dx = (Math.random() * 2 - 1) * this.screenShake;
            const dy = (Math.random() * 2 - 1) * this.screenShake;
            this.ctx.translate(dx, dy);
        }

        this.drawStars();

        for (let item of this.pickups) item.draw(this.ctx);
        for (let enemy of this.enemies) enemy.draw(this.ctx);
        if (this.currentBoss) this.currentBoss.draw(this.ctx);
        for (let beam of this.bossBeams) beam.draw(this.ctx);
        for (let b of this.playerBullets) b.draw(this.ctx);
        for (let b of this.enemyBullets) b.draw(this.ctx);

        if (this.player && this.player.hp > 0) {
            this.drawPlayer(this.ctx);
        }

        for (let p of this.particles) p.draw(this.ctx);
        for (let ft of this.floatingTexts) ft.draw(this.ctx);

        this.ctx.restore();
    }

    drawPlayer(ctx) {
        const p = this.player;

        // Flicker during non-dash i-frames
        if (!p.isDashing && p.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
            return;
        }

        ctx.save();
        ctx.translate(p.x, p.y);

        // Active Shield Sphere
        if (p.shield > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, p.radius + 14, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
            ctx.fill();
            ctx.restore();
        }

        // VISIBLE DASH I-FRAMES GLOW AURA
        if (p.isDashing) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, p.radius + 18, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 20;
            ctx.stroke();
            ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
            ctx.fill();
            ctx.restore();
        }

        // 360-DEGREE ROTATION
        ctx.rotate(p.angle + Math.PI / 2);

        ctx.shadowColor = p.shipConfig.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = p.shipConfig.color;
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        ctx.moveTo(0, -26);
        ctx.lineTo(16, 8);
        ctx.lineTo(26, 18);
        ctx.lineTo(10, 16);
        ctx.lineTo(5, 22);
        ctx.lineTo(-5, 22);
        ctx.lineTo(-10, 16);
        ctx.lineTo(-26, 18);
        ctx.lineTo(-16, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = p.overdriveTimer > 0 ? '#ffd166' : p.shipConfig.accent;
        ctx.beginPath();
        ctx.ellipse(0, -5, 4, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Drones
        p.drones.forEach(drone => {
            const dx = p.x + Math.cos(drone.angle) * drone.radius;
            const dy = p.y + Math.sin(drone.angle) * drone.radius;
            ctx.save();
            ctx.translate(dx, dy);
            ctx.fillStyle = '#00ff9d';
            ctx.shadowColor = '#00ff9d';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    // --- MODAL: SHIP SELECTION ---
    openShipsModal() {
        this.saveGame();
        this.renderShipsUI();
        this.showModal('ships-modal');
    }

    renderShipsUI() {
        const container = document.getElementById('ships-container');
        if (!container) return;
        container.innerHTML = '';
        this.updateHUDStats();

        for (let id in this.ships) {
            const ship = this.ships[id];
            const isSelected = this.selectedShipId === id;
            const isUnlocked = ship.unlocked;

            const card = document.createElement('div');
            card.className = `ship-card ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`;

            card.innerHTML = `
                <div class="ship-preview-box">
                    <svg width="70" height="70" viewBox="-30 -30 60 60">
                        <polygon points="0,-24 16,8 24,16 8,14 4,20 -4,20 -8,14 -24,16 -16,8" fill="#0f172a" stroke="${ship.color}" stroke-width="2.5" />
                        <ellipse cx="0" cy="-4" rx="4" ry="8" fill="${ship.accent}" />
                    </svg>
                </div>
                <div class="ship-name">${ship.name}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${ship.desc}</div>
                <div class="ship-stats">
                    <div class="stat-row"><span>Прочность:</span> <b>${Math.round(ship.hpMult * 100)}%</b></div>
                    <div class="stat-row"><span>Скорость:</span> <b>${Math.round(ship.speedMult * 100)}%</b></div>
                    <div class="stat-row"><span>Урон:</span> <b>${Math.round(ship.dmgMult * 100)}%</b></div>
                    <div class="stat-row"><span>Щиты:</span> <b>${Math.round(ship.shieldMult * 100)}%</b></div>
                </div>
                <button class="btn btn-sm ${isSelected ? 'btn-secondary' : isUnlocked ? 'btn-primary' : 'btn-danger'} btn-ship-action" style="width: 100%; margin-top: 6px;" data-id="${id}">
                    ${isSelected ? 'ВЫБРАН' : isUnlocked ? 'ВЫБРАТЬ' : `РАЗБЛОКИРОВАТЬ (💎 ${ship.cost})`}
                </button>
            `;

            container.appendChild(card);
        }

        container.querySelectorAll('.btn-ship-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const ship = this.ships[id];
                if (ship.unlocked) {
                    this.selectedShipId = id;
                    window.soundManager.playUpgradeSuccess();
                    this.saveGame();
                    this.renderShipsUI();
                } else if (this.credits >= ship.cost) {
                    this.credits -= ship.cost;
                    ship.unlocked = true;
                    this.selectedShipId = id;
                    window.soundManager.playUpgradeSuccess();
                    this.saveGame();
                    this.renderShipsUI();
                }
            });
        });
    }
}

// --- PROJECTILE CLASS ---
class Bullet {
    constructor(x, y, vx, vy, damage, color = '#00f0ff', radius = 3.5, isEnemy = false, isHoming = false) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.damage = damage;
        this.color = color;
        this.radius = radius;
        this.isEnemy = isEnemy;
        this.isHoming = isHoming;
        this.isDead = false;
        this.life = 4.5;
    }

    update(dt, playerTarget) {
        this.life -= dt;
        if (this.life <= 0) {
            this.isDead = true;
            return;
        }

        if (this.isHoming && playerTarget) {
            const angle = Math.atan2(playerTarget.y - this.y, playerTarget.x - this.x);
            this.vx += Math.cos(angle) * 350 * dt;
            this.vy += Math.sin(angle) * 350 * dt;
            const speed = Math.hypot(this.vx, this.vy);
            if (speed > 280) {
                this.vx = (this.vx / speed) * 280;
                this.vy = (this.vy / speed) * 280;
            }
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- 360-DEGREE ENEMY CLASS WITH SCALING ---
class Enemy {
    constructor(type, x, y, wave) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.wave = wave;
        this.level = wave;
        this.tier = Math.min(5, Math.ceil(wave / 2));
        this.isDead = false;
        this.time = Math.random() * 10;
        this.fireCooldown = Math.random() * 1.5;
        this.angle = 0;

        // Upgrade tier color
        if (wave <= 2) this.tierColor = '#00f0ff';       // Tier 1: Cyan (Базовый)
        else if (wave <= 4) this.tierColor = '#06d6a0';  // Tier 2: Green (Усиленный)
        else if (wave <= 6) this.tierColor = '#ffd166';  // Tier 3: Gold (Ветеран со щитом)
        else if (wave <= 9) this.tierColor = '#a855f7';  // Tier 4: Purple (Элитный флот)
        else this.tierColor = '#ff2e63';                 // Tier 5: Red (Кошмар пустоты)

        // Difficulty Progression per wave:
        // Scaled so that on wave 1-4 scouts (26..53 HP) are one-shot by 60 dmg bomb,
        // but on wave 5+ scouts (62+ HP) and heavier mobs survive the bomb!
        const hpScale = 1.0 + (wave - 1) * 0.35;
        const speedScale = 1.0 + Math.min(0.70, (wave - 1) * 0.055);
        const fireDelayScale = Math.max(0.5, 1.0 - (wave - 1) * 0.05);

        this.maxShield = 0;

        switch (type) {
            case 'scout':
                this.radius = 16;
                this.maxHp = 26 * hpScale;
                this.color = wave >= 5 ? '#ffd166' : '#00f0ff';
                this.speed = 150 * speedScale;
                this.scoreValue = Math.round(100 * (1 + (wave - 1) * 0.25));
                this.coinCount = 2 + Math.floor((wave - 1) / 3);
                this.fireRate = 1.9 * fireDelayScale;
                if (wave >= 5) this.maxShield = 15 + (wave - 5) * 6;
                break;
            case 'interceptor':
                this.radius = 20;
                this.maxHp = 50 * hpScale;
                this.color = '#a855f7';
                this.speed = 125 * speedScale;
                this.scoreValue = Math.round(200 * (1 + (wave - 1) * 0.25));
                this.coinCount = 4 + Math.floor((wave - 1) / 3);
                this.fireRate = 2.2 * fireDelayScale;
                if (wave >= 3) this.maxShield = 20 + (wave - 3) * 10;
                break;
            case 'cruiser':
                this.radius = 34;
                this.maxHp = 180 * hpScale;
                this.color = '#ffaa00';
                this.speed = 65 * speedScale;
                this.scoreValue = Math.round(450 * (1 + (wave - 1) * 0.25));
                this.coinCount = 10 + Math.floor((wave - 1) / 2);
                this.fireRate = 2.8 * fireDelayScale;
                this.maxShield = 60 + (wave - 6) * 20;
                break;
            case 'kamikaze':
                this.radius = 18;
                this.maxHp = 36 * hpScale;
                this.color = '#ff2e63';
                this.speed = 260 * speedScale;
                this.scoreValue = Math.round(250 * (1 + (wave - 1) * 0.25));
                this.coinCount = 3 + Math.floor((wave - 1) / 3);
                this.fireRate = 999;
                if (wave >= 6) this.maxShield = 15 + (wave - 6) * 8;
                break;
            case 'asteroid':
            default:
                this.radius = 24;
                this.maxHp = 65 * hpScale;
                this.color = '#94a3b8';
                this.speed = 85 * speedScale;
                this.scoreValue = Math.round(150 * (1 + (wave - 1) * 0.25));
                this.coinCount = 2 + Math.floor((wave - 1) / 3);
                this.fireRate = 999;
                this.driftAngle = Math.random() * Math.PI * 2;
                break;
        }

        this.hp = this.maxHp;
        this.shield = this.maxShield;
    }

    takeDamage(dmg, game = null) {
        if (this.shield > 0) {
            if (dmg <= this.shield) {
                this.shield -= dmg;
                dmg = 0;
            } else {
                dmg -= this.shield;
                this.shield = 0;
            }
            if (game) {
                for (let i = 0; i < 4; i++) {
                    game.particles.push(new Particle(
                        this.x, this.y,
                        (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80,
                        Math.random() * 3 + 2, '#00f0ff', 0.25
                    ));
                }
            }
        }
        if (dmg > 0) {
            this.hp -= dmg;
            if (this.hp <= 0) this.isDead = true;
        }
    }

    update(dt, game) {
        this.time += dt;
        const p = game.player;

        if (this.type === 'asteroid') {
            this.x += Math.cos(this.driftAngle) * this.speed * dt;
            this.y += Math.sin(this.driftAngle) * this.speed * dt;
            this.angle += dt * 1.5;
            if (this.x < -60) this.x = game.width + 50;
            if (this.x > game.width + 60) this.x = -50;
            if (this.y < -60) this.y = game.height + 50;
            if (this.y > game.height + 60) this.y = -50;
            return;
        }

        if (!p) return;

        const dx = p.x - this.x;
        const dy = p.y - this.y;
        const dist = Math.hypot(dx, dy);
        this.angle = Math.atan2(dy, dx);

        switch (this.type) {
            case 'scout':
                if (dist > 200) {
                    this.x += Math.cos(this.angle) * this.speed * dt;
                    this.y += Math.sin(this.angle) * this.speed * dt;
                } else {
                    const strafeAngle = this.angle + Math.PI / 2;
                    this.x += Math.cos(strafeAngle) * (this.speed * 0.8) * dt;
                    this.y += Math.sin(strafeAngle) * (this.speed * 0.8) * dt;
                }
                break;
            case 'interceptor':
                this.x += Math.cos(this.angle + Math.sin(this.time * 2.5) * 0.6) * this.speed * dt;
                this.y += Math.sin(this.angle + Math.sin(this.time * 2.5) * 0.6) * this.speed * dt;
                break;
            case 'cruiser':
                if (dist > 160) {
                    this.x += Math.cos(this.angle) * this.speed * dt;
                    this.y += Math.sin(this.angle) * this.speed * dt;
                }
                break;
            case 'kamikaze':
                const boost = (dist < 260) ? 1.35 : 1.0;
                this.x += Math.cos(this.angle) * (this.speed * boost) * dt;
                this.y += Math.sin(this.angle) * (this.speed * boost) * dt;
                game.particles.push(new Particle(
                    this.x, this.y,
                    -Math.cos(this.angle) * 70, -Math.sin(this.angle) * 70,
                    Math.random() * 3 + 2, '#ff2e63', 0.2
                ));
                break;
        }

        this.fireCooldown -= dt;
        if (this.fireCooldown <= 0 && dist < 580) {
            this.fire(game);
            this.fireCooldown = this.fireRate;
        }
    }

    fire(game) {
        window.soundManager.playLaser(0.8, true);
        const aimAngle = this.angle;
        const dmg = Math.round(14 * (1 + (this.wave - 1) * 0.12));

        if (this.type === 'scout') {
            if (this.wave >= 4) {
                // Double laser for high-level scouts
                game.enemyBullets.push(new Bullet(this.x, this.y, Math.cos(aimAngle - 0.1) * 330, Math.sin(aimAngle - 0.1) * 330, dmg * 0.85, '#00f0ff', 4, true));
                game.enemyBullets.push(new Bullet(this.x, this.y, Math.cos(aimAngle + 0.1) * 330, Math.sin(aimAngle + 0.1) * 330, dmg * 0.85, '#00f0ff', 4, true));
            } else {
                game.enemyBullets.push(new Bullet(this.x, this.y, Math.cos(aimAngle) * 320, Math.sin(aimAngle) * 320, dmg, '#ff2e63', 4, true));
            }
        } else if (this.type === 'interceptor') {
            if (this.wave >= 5) {
                // 3-way spread for veteran interceptors
                for (let a of [-0.2, 0, 0.2]) {
                    game.enemyBullets.push(new Bullet(this.x, this.y, Math.cos(aimAngle + a) * 350, Math.sin(aimAngle + a) * 350, dmg * 0.9, '#a855f7', 4, true));
                }
            } else {
                game.enemyBullets.push(new Bullet(this.x, this.y, Math.cos(aimAngle - 0.15) * 340, Math.sin(aimAngle - 0.15) * 340, dmg, '#ff2e63', 4, true));
                game.enemyBullets.push(new Bullet(this.x, this.y, Math.cos(aimAngle + 0.15) * 340, Math.sin(aimAngle + 0.15) * 340, dmg, '#ff2e63', 4, true));
            }
        } else if (this.type === 'cruiser') {
            const spreadAngles = this.wave >= 8 ? [-0.4, -0.2, 0, 0.2, 0.4] : [-0.3, 0, 0.3];
            for (let a of spreadAngles) {
                game.enemyBullets.push(new Bullet(
                    this.x, this.y,
                    Math.cos(aimAngle + a) * 310, Math.sin(aimAngle + a) * 310,
                    dmg * 1.3, '#ffaa00', 5, true
                ));
            }
            if (Math.random() < 0.5) {
                game.enemyBullets.push(new Bullet(
                    this.x, this.y,
                    Math.cos(aimAngle) * 190, Math.sin(aimAngle) * 190,
                    dmg * 1.8, '#ff0055', 7, true, true
                ));
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Shield Bubble Aura
        if (this.shield > 0) {
            ctx.save();
            ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 + Math.sin(this.time * 6) * 0.25})`;
            ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        ctx.rotate(this.angle + Math.PI / 2);

        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.fillStyle = '#0b0f19';

        if (this.type === 'asteroid') {
            ctx.beginPath();
            const pts = 8;
            for (let i = 0; i < pts; i++) {
                const a = (i / pts) * Math.PI * 2;
                const r = this.radius * (0.8 + ((i % 3) * 0.15));
                const px = Math.cos(a) * r;
                const py = Math.sin(a) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (this.type === 'cruiser') {
            ctx.beginPath();
            ctx.moveTo(0, -32);
            ctx.lineTo(24, -10);
            ctx.lineTo(32, 20);
            ctx.lineTo(16, 28);
            ctx.lineTo(-16, 28);
            ctx.lineTo(-32, 20);
            ctx.lineTo(-24, -10);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(0, 0, 7, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(0, -this.radius);
            ctx.lineTo(this.radius, this.radius);
            ctx.lineTo(0, this.radius * 0.4);
            ctx.lineTo(-this.radius, this.radius);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        // HP & Shield Bars (shown if damaged or in combat)
        const barW = this.radius * 2 + 8;
        const barY = this.radius + 8;

        // Health bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(-barW / 2, barY, barW, 4);
        ctx.fillStyle = '#ff2e63';
        ctx.fillRect(-barW / 2, barY, Math.max(0, barW * (this.hp / this.maxHp)), 4);

        // Shield bar (if maxShield > 0)
        if (this.maxShield > 0) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(-barW / 2, barY - 5, barW, 3);
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(-barW / 2, barY - 5, Math.max(0, barW * (this.shield / this.maxShield)), 3);
        }

        // Level Badge (Rendered upright above enemy)
        ctx.rotate(-(this.angle + Math.PI / 2));
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = this.tierColor;
        ctx.shadowColor = this.tierColor;
        ctx.shadowBlur = 6;
        ctx.fillText(`Ур.${this.level}`, 0, -this.radius - 8);

        ctx.restore();
    }
}

// --- BOSS CLASS (APPEARS STRICTLY ON ROUNDS MULTIPLES OF 5) ---
class Boss {
    constructor(wave, x, y) {
        this.wave = wave;
        this.x = x;
        this.y = y;
        this.targetY = 160;
        this.radius = 65;
        this.isDead = false;
        this.time = 0;
        this.attackTimer = 0;
        this.phase = 1;

        const baseHp = 1900 * (1 + (wave / 5 - 1) * 0.85);
        this.maxHp = baseHp;
        this.hp = baseHp;

        if (wave === 5) {
            this.name = 'ЭГИДА-ДРЕДНОУТ';
            this.color = '#ff0055';
        } else if (wave === 10) {
            this.name = 'КИБЕР-ЛЕВИАФАН';
            this.color = '#a855f7';
        } else {
            this.name = 'ВЛАДЫКА ПУСТОТЫ';
            this.color = '#ffaa00';
        }
    }

    takeDamage(dmg) {
        this.hp -= dmg;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
        }

        const hpPct = this.hp / this.maxHp;
        if (hpPct <= 0.35 && this.phase < 3) {
            this.phase = 3;
            window.soundManager.playBossWarning();
        } else if (hpPct <= 0.70 && this.phase < 2) {
            this.phase = 2;
        }
    }

    update(dt, game) {
        this.time += dt;
        this.attackTimer += dt;

        if (this.y < this.targetY) {
            this.y += 65 * dt;
        } else {
            const patrolRange = Math.min(260, game.width * 0.35);
            this.x = (game.width / 2) + Math.sin(this.time * 1.1) * patrolRange;
            this.y = this.targetY + Math.cos(this.time * 0.8) * 30;
        }

        const attackInterval = this.phase === 3 ? 1.3 : this.phase === 2 ? 1.8 : 2.4;
        if (this.attackTimer >= attackInterval && this.y >= this.targetY - 10) {
            this.attackTimer = 0;
            this.executeAttack(game);
        }
    }

    executeAttack(game) {
        const p = game.player;
        if (!p) return;

        window.soundManager.playHeavyLaser();

        if (this.phase === 1) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
                game.enemyBullets.push(new Bullet(
                    this.x, this.y,
                    Math.cos(a) * 310, Math.sin(a) * 310,
                    22, '#ff0055', 6, true
                ));
            }
        } else if (this.phase === 2) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
                game.enemyBullets.push(new Bullet(
                    this.x, this.y,
                    Math.cos(a + this.time * 2) * 280, Math.sin(a + this.time * 2) * 280,
                    20, '#a855f7', 5, true
                ));
            }
            game.enemyBullets.push(new Bullet(this.x - 50, this.y, -90, 160, 28, '#ffaa00', 7, true, true));
            game.enemyBullets.push(new Bullet(this.x + 50, this.y, 90, 160, 28, '#ffaa00', 7, true, true));
        } else if (this.phase === 3) {
            game.bossBeams.push(new BossBeam(this.x, this.y, game.height));
            if (game.enemies.length < 3) {
                game.enemies.push(new Enemy('scout', this.x - 90, this.y, this.wave));
                game.enemies.push(new Enemy('scout', this.x + 90, this.y, this.wave));
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.phase === 3 ? 30 : 16;
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3.5;

        ctx.beginPath();
        ctx.moveTo(0, 50);
        ctx.lineTo(35, 30);
        ctx.lineTo(65, 10);
        ctx.lineTo(75, -25);
        ctx.lineTo(40, -45);
        ctx.lineTo(15, -35);
        ctx.lineTo(0, -40);
        ctx.lineTo(-15, -35);
        ctx.lineTo(-40, -45);
        ctx.lineTo(-75, -25);
        ctx.lineTo(-65, 10);
        ctx.lineTo(-35, 30);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (this.phase === 3) {
            ctx.fillStyle = 'rgba(255, 0, 85, 0.25)';
            ctx.fill();
        }

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// --- BOSS MEGA BEAM ---
class BossBeam {
    constructor(x, y, endY) {
        this.x = x;
        this.y = y;
        this.endY = endY;
        this.width = 46;
        this.damagePerSec = 240;
        this.chargeTime = 0.8;
        this.fireTime = 1.0;
        this.elapsed = 0;
        this.isFired = false;
        this.isFinished = false;
    }

    update(dt) {
        this.elapsed += dt;
        if (this.elapsed >= this.chargeTime) this.isFired = true;
        if (this.elapsed >= this.chargeTime + this.fireTime) this.isFinished = true;
    }

    draw(ctx) {
        ctx.save();
        if (!this.isFired) {
            ctx.strokeStyle = `rgba(255, 0, 85, ${Math.sin(this.elapsed * 25) * 0.5 + 0.5})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x, this.endY);
            ctx.stroke();
        } else {
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 25;
            ctx.fillStyle = 'rgba(255, 0, 85, 0.45)';
            ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.endY - this.y);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(this.x - 8, this.y, 16, this.endY - this.y);
        }
        ctx.restore();
    }
}

// --- GOLDEN COINS WITH PHYSICS & MAGNET PULL ---
class Coin {
    constructor(x, y, vx = 0, vy = 0, value = 1) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.value = value;
        this.radius = 8;
        this.isCoin = true;
        this.spin = Math.random() * Math.PI * 2;
    }

    update(dt, player) {
        this.spin += dt * 6;

        this.vx *= 0.94;
        this.vy *= 0.94;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (player) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist < player.magnetRange && dist > 1) {
                const pull = 520 * (1 - dist / player.magnetRange);
                this.vx += (dx / dist) * pull * dt * 4;
                this.vy += (dy / dist) * pull * dt * 4;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 8;

        const scaleX = Math.cos(this.spin);
        ctx.scale(scaleX, 1);

        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.fillRect(-2, -4, 4, 8);

        ctx.restore();
    }
}

// --- POWERUPS ---
class Powerup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 12;
        this.isCoin = false;
        this.time = Math.random() * 5;
    }

    update(dt, player) {
        this.time += dt;
        if (player) {
            const dist = Math.hypot(player.x - this.x, player.y - this.y);
            if (dist < player.magnetRange && dist > 1) {
                const pull = 400 * (1 - dist / player.magnetRange);
                this.x += ((player.x - this.x) / dist) * pull * dt;
                this.y += ((player.y - this.y) / dist) * pull * dt;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.type === 'heal') {
            ctx.shadowColor = '#06d6a0';
            ctx.shadowBlur = 12;
            ctx.fillStyle = '#06d6a0';
            ctx.fillRect(-7, -2.5, 14, 5);
            ctx.fillRect(-2.5, -7, 5, 14);
        } else if (this.type === 'overdrive') {
            ctx.shadowColor = '#ffd166';
            ctx.shadowBlur = 14;
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.moveTo(1, -9);
            ctx.lineTo(-7, 1);
            ctx.lineTo(0, 1);
            ctx.lineTo(-2, 9);
            ctx.lineTo(7, -1);
            ctx.lineTo(0, -1);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'shield') {
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 12;
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }
}

// --- PARTICLE CLASS ---
class Particle {
    constructor(x, y, vx, vy, size, color, maxLife = 0.5) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = size;
        this.color = color;
        this.maxLife = maxLife;
        this.life = maxLife;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }

    draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- FLOATING TEXT CLASS ---
class FloatingText {
    constructor(x, y, text, color = '#fff', size = 16) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.size = size;
        this.life = 1.0;
        this.vy = -35;
    }

    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
    }

    draw(ctx) {
        const alpha = Math.max(0, this.life);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${this.size}px 'Segoe UI', sans-serif`;
        ctx.fillStyle = this.color;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.gameInstance = new Game();
});
