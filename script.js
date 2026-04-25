// ========== NEED FOR SPEED - FULL VERSION (GitHub Pages Ready) ==========
(function() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGame);
    } else {
        initGame();
    }
    
    // ========== KONFIGURASI GAMBAR ==========
    const IMAGES = {
        player: 'assets/trail.png',
        playerAccident: 'assets/trail-accident.png',
        enemyBgn: 'assets/bgn.png',
        enemyDamkar: 'assets/damkar.png',
        enemyMarinir: 'assets/marinir.png',
        enemyPolantas: 'assets/polantas.png',
        enemySabhara: 'assets/sabhara.png',
        stone: 'assets/pile-of-rocks.png',
        heart: 'assets/heart.png',
        shield: 'assets/shield-protection.png'
    };
    
    // ========== KONFIGURASI LEVEL ==========
    const LEVEL_CONFIG = {
        easy: {
            name: 'EASY',
            initialSpeed: 2.5,
            obstacleSpawnRate: 300,
            obstacleChance: 0.15,
            maxSpeed: 16
        },
        medium: {
            name: 'MEDIUM',
            initialSpeed: 3,
            obstacleSpawnRate: 200,
            obstacleChance: 0.25,
            maxSpeed: 18
        },
        hard: {
            name: 'HARD',
            initialSpeed: 3.5,
            obstacleSpawnRate: 120,
            obstacleChance: 0.4,
            maxSpeed: 20
        }
    };
    
    let currentLevel = 'medium';
    
    // ========== LOAD GAMBAR ==========
    function loadImages() {
        return new Promise((resolve) => {
            const images = {};
            let loadedCount = 0;
            const totalImages = Object.keys(IMAGES).length;
            
            for (const [key, src] of Object.entries(IMAGES)) {
                const img = new Image();
                img.onload = () => {
                    loadedCount++;
                    console.log(`Loaded: ${key} (${loadedCount}/${totalImages})`);
                    if (loadedCount === totalImages) resolve(images);
                };
                img.onerror = () => {
                    console.warn(`Failed to load: ${src}, using fallback`);
                    loadedCount++;
                    if (loadedCount === totalImages) resolve(images);
                };
                img.src = src;
                images[key] = img;
            }
        });
    }
    
    // ========== INIT GAME ==========
    async function initGame() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading';
        loadingDiv.innerHTML = '🖼️ Loading Gambar...';
        document.body.appendChild(loadingDiv);
        
        const gameImages = await loadImages();
        loadingDiv.remove();
        
        // DOM Elements
        const canvas = document.getElementById('raceCanvas');
        const ctx = canvas.getContext('2d');
        const posElem = document.getElementById('pos');
        const scoreElem = document.getElementById('score');
        const speedElem = document.getElementById('speed');
        const shieldTimeElem = document.getElementById('shieldTime');
        const shieldCard = document.getElementById('shieldCard');
        const livesValueElem = document.getElementById('livesValue');
        const startOverlay = document.getElementById('startOverlay');
        const resetBtn = document.getElementById('resetBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const startBtn = document.getElementById('startBtn');
        const levelSelect = document.getElementById('levelSelect');
        
        // HIGHSCORE dengan localStorage (tanpa PHP)
        let highscore = localStorage.getItem('highscore') ? parseInt(localStorage.getItem('highscore')) : 0;
        let currentLevelConfig = LEVEL_CONFIG.medium;
        
        // Tampilkan highscore jika ada elemennya (opsional)
        const highscoreElem = document.getElementById('highscore');
        if (highscoreElem) highscoreElem.innerText = highscore;
        
        // Game Variables
        let score = 0;
        let speed = currentLevelConfig.initialSpeed;
        let combo = 0;
        let gameRunning = false;
        let isPaused = false;
        let frameCount = 0;
        let enemiesPassed = 0;
        let animationId = null;
        
        // LIVES SYSTEM
        let lives = 3;
        let isRespawning = false;
        let respawnTimer = 0;
        let accidentDisplayTimer = 0;
        let invincibleFrames = 0;
        let lastAccidentX = 0, lastAccidentY = 0;
        
        // Shield
        let shieldActive = false;
        let shieldRemainingTime = 0;
        
        // Explosion
        let explosion = { active: false, x: 0, y: 0, frame: 0, maxFrame: 20 };
        
        // Player
        let player = {
            x: 0, y: 0,
            width: 70, height: 70,
            image: gameImages.player,
            accidentImage: gameImages.playerAccident
        };
        
        // Movement
        let moveLeft = false;
        let moveRight = false;
        
        // Game objects
        let enemies = [];
        let obstacles = [];
        let powerups = [];
        let lifePowerups = [];
        
        // Road animation
        let roadOffset = 0;
        let canvasWidth = 0, canvasHeight = 0;
        
        // ========== FUNGSI BANTU ==========
        function getImageDimensions(img, defaultSize = 65) {
            if (img && img.complete && img.naturalWidth > 0) {
                const aspectRatio = img.naturalHeight / img.naturalWidth;
                const width = defaultSize;
                const height = width * aspectRatio;
                return { width, height, aspectRatio };
            }
            return { width: defaultSize, height: defaultSize, aspectRatio: 1 };
        }
        
        function updateUI() {
            if (scoreElem) scoreElem.innerText = Math.floor(score);
            if (speedElem) speedElem.innerText = Math.floor(speed * 10) / 10;
            if (posElem) posElem.innerText = enemiesPassed;
            if (livesValueElem) livesValueElem.innerText = lives;
            if (highscoreElem) highscoreElem.innerText = highscore;
            
            if (speedElem) {
                if (speed >= 12) speedElem.classList.add('speed-warning');
                else speedElem.classList.remove('speed-warning');
            }
            
            // Update highscore ke localStorage
            if (Math.floor(score) > highscore) {
                highscore = Math.floor(score);
                localStorage.setItem('highscore', highscore);
                if (highscoreElem) highscoreElem.innerText = highscore;
            }
        }
        
        function updateShieldUI() {
            if (shieldCard && shieldTimeElem) {
                if (shieldActive && shieldRemainingTime > 0) {
                    const isBlinking = shieldRemainingTime <= 5;
                    if (isBlinking) {
                        if (Math.floor(Date.now() / 100) % 2 === 0) {
                            shieldCard.style.opacity = '1';
                            shieldCard.classList.add('shield-active');
                        } else {
                            shieldCard.style.opacity = '0.5';
                            shieldCard.classList.remove('shield-active');
                        }
                        shieldTimeElem.innerText = Math.ceil(shieldRemainingTime);
                    } else {
                        shieldCard.style.opacity = '1';
                        shieldCard.classList.add('shield-active');
                        shieldTimeElem.innerText = Math.ceil(shieldRemainingTime);
                    }
                } else {
                    shieldCard.style.opacity = '1';
                    shieldCard.classList.remove('shield-active');
                    shieldTimeElem.innerText = 0;
                    shieldActive = false;
                }
            }
        }
        
        function resizeCanvas() {
            const dashboard = document.querySelector('.dashboard');
            const dashboardHeight = dashboard ? dashboard.offsetHeight : 100;
            canvasWidth = window.innerWidth;
            canvasHeight = window.innerHeight - dashboardHeight - 60;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            
            const playerDim = getImageDimensions(player.image, Math.min(70, canvasWidth * 0.12));
            player.width = playerDim.width;
            player.height = playerDim.height;
            player.y = canvasHeight - player.height - 15;
            player.x = canvasWidth / 2 - player.width / 2;
        }
        
        function init() {
            enemies = [];
            obstacles = [];
            powerups = [];
            lifePowerups = [];
            score = 0;
            speed = currentLevelConfig.initialSpeed;
            combo = 0;
            enemiesPassed = 0;
            frameCount = 0;
            shieldActive = false;
            shieldRemainingTime = 0;
            explosion.active = false;
            moveLeft = false;
            moveRight = false;
            isPaused = false;
            
            lives = 3;
            isRespawning = false;
            respawnTimer = 0;
            accidentDisplayTimer = 0;
            invincibleFrames = 0;
            
            if (pauseBtn) {
                pauseBtn.innerText = '⏸️ PAUSE';
                pauseBtn.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
            }
            resizeCanvas();
            updateUI();
            updateShieldUI();
        }
        
        function setLevel(level) {
            currentLevel = level;
            currentLevelConfig = LEVEL_CONFIG[level];
            speed = currentLevelConfig.initialSpeed;
            updateUI();
        }
        
        // ========== SPAWN ENEMY DENGAN UKURAN MANUAL PER MUSUH ==========
        function spawnEnemy() {
            const enemyTypesList = [
                { 
                    name: 'BGN', 
                    image: gameImages.enemyBgn, 
                    color: '#555', 
                    agresif: false, 
                    speedBonus: 1, 
                    points: 10,
                    customWidth: 65,
                    customHeight: 60
                },
                { 
                    name: 'DAMKAR', 
                    image: gameImages.enemyDamkar, 
                    color: '#E74C3C', 
                    agresif: true, 
                    speedBonus: 1.25, 
                    points: 20,
                    customWidth: 100,
                    customHeight: 75
                },
                { 
                    name: 'MARINIR', 
                    image: gameImages.enemyMarinir, 
                    color: '#27AE60', 
                    agresif: false, 
                    speedBonus: 1, 
                    points: 15,
                    customWidth: 80,
                    customHeight: 50
                },
                { 
                    name: 'POLANTAS', 
                    image: gameImages.enemyPolantas, 
                    color: '#3498DB', 
                    agresif: false, 
                    speedBonus: 1, 
                    points: 15,
                    customWidth: 60,
                    customHeight: 65
                },
                { 
                    name: 'SABHARA', 
                    image: gameImages.enemySabhara, 
                    color: '#F39C12', 
                    agresif: false, 
                    speedBonus: 1, 
                    points: 12,
                    customWidth: 65,
                    customHeight: 62
                }
            ];
            
            const randomIndex = Math.floor(Math.random() * enemyTypesList.length);
            const enemy = enemyTypesList[randomIndex];
            
            let enemyWidth = enemy.customWidth;
            let enemyHeight = enemyWidth;

            if (enemy.image && enemy.image.complete && enemy.image.naturalWidth > 0) {
                const aspectRatio = enemy.image.naturalHeight / enemy.image.naturalWidth;
                enemyHeight = enemyWidth * aspectRatio;
            }
            
            // Batasan ukuran (MARINIR tidak dibatasi)
            const maxWidth = canvasWidth * 0.15;
            const minWidth = canvasWidth * 0.07;
            
            if (enemy.name !== 'MARINIR') {
                if (enemyWidth > maxWidth) enemyWidth = maxWidth;
                if (enemyWidth < minWidth) enemyWidth = minWidth;
                enemyHeight = (enemyHeight / enemy.customWidth) * enemyWidth;
            }
            
            const minX = 15;
            const maxX = canvasWidth - enemyWidth - 15;
            const randomX = Math.random() * (maxX - minX) + minX;
            
            enemies.push({
                x: randomX,
                y: -enemyHeight,
                width: enemyWidth,
                height: enemyHeight,
                type: {
                    name: enemy.name,
                    color: enemy.color,
                    agresif: enemy.agresif,
                    speedBonus: enemy.speedBonus,
                    points: enemy.points
                },
                image: enemy.image,
                agresifOffset: 0,
                customWidth: enemy.customWidth,
                customHeight: enemy.customHeight
            });
        }
        
        // ========== SPAWN OBSTACLE (BATU) ==========
        function spawnObstacle() {
            const stoneImg = gameImages.stone;
            const BATU_SIZE = 45;  // Ubah angka ini untuk mengubah ukuran batu
            const dims = getImageDimensions(stoneImg, BATU_SIZE);
            
            obstacles.push({
                x: Math.random() * (canvasWidth - dims.width - 40) + 20,
                y: -dims.height,
                width: dims.width,
                height: dims.height,
                image: stoneImg
            });
        }
        
        // ========== SPAWN POWERUP ==========
        function spawnPowerup() {
            powerups.push({
                x: Math.random() * (canvasWidth - 45 - 40) + 20,
                y: -45,
                size: 40
            });
        }
        
        function spawnLifePowerup() {
            lifePowerups.push({
                x: Math.random() * (canvasWidth - 45 - 40) + 20,
                y: -45,
                size: 40
            });
        }
        
        function activateShield(duration = 15) {
            shieldActive = true;
            shieldRemainingTime += duration;
            updateShieldUI();
        }
        
        function updateShieldTimer() {
            if (shieldActive && shieldRemainingTime > 0) {
                shieldRemainingTime -= 1 / 60;
                if (shieldRemainingTime <= 0) {
                    shieldActive = false;
                    shieldRemainingTime = 0;
                }
                updateShieldUI();
            }
        }
        
        // ========== ACCIDENT & RESPAWN ==========
        function handleAccident(colliderName = '') {
            if (shieldActive) return false;
            if (invincibleFrames > 0) return false;
            if (isRespawning) return false;
            
            lives--;
            updateUI();
            
            lastAccidentX = player.x;
            lastAccidentY = player.y;
            accidentDisplayTimer = 30;
            showExplosion(player.x, player.y);
            
            if (lives <= 0) {
                gameRunning = false;
                setTimeout(() => {
                    alert(`💥 GAME OVER!\nSkor akhir: ${Math.floor(score)}\nMusuh dilewati: ${enemiesPassed}`);
                    showStartOverlay();
                }, 500);
                return true;
            }
            
            isRespawning = true;
            respawnTimer = 45;
            invincibleFrames = 90;
            
            return false;
        }
        
        function doRespawn() {
            player.x = canvasWidth / 2 - player.width / 2;
            player.y = canvasHeight - player.height - 15;
            
            for (let i = 0; i < enemies.length; i++) {
                if (enemies[i].y > canvasHeight - 150) {
                    enemies.splice(i, 1);
                    i--;
                }
            }
            
            isRespawning = false;
        }
        
        function showExplosion(x, y) {
            explosion.active = true;
            explosion.x = x;
            explosion.y = y;
            explosion.frame = 0;
        }
        
        function drawExplosion() {
            if (!explosion.active) return;
            
            const centerX = explosion.x + player.width / 2;
            const centerY = explosion.y + player.height / 2;
            const progress = explosion.frame / explosion.maxFrame;
            const explosionSize = player.width * (1.2 + progress * 1.5);
            const alpha = Math.max(0, 1 - progress);
            
            ctx.save();
            ctx.shadowBlur = 15;
            
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                ctx.arc(centerX, centerY, explosionSize * (0.8 - i * 0.2), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, ${50 + i * 50}, 0, ${alpha * 0.7})`;
                ctx.fill();
            }
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, explosionSize * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.9})`;
            ctx.fill();
            
            for (let i = 0; i < 12; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = explosionSize * (0.3 + Math.random() * 0.7);
                const px = centerX + Math.cos(angle) * distance;
                const py = centerY + Math.sin(angle) * distance;
                ctx.beginPath();
                ctx.arc(px, py, 3 * (1 - progress), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, ${100 + Math.random() * 155}, 0, ${alpha * 0.8})`;
                ctx.fill();
            }
            
            ctx.restore();
            explosion.frame++;
            if (explosion.frame >= explosion.maxFrame) explosion.active = false;
        }
        
        // ========== DRAWING FUNCTIONS ==========
        function drawCharacter(img, x, y, width, height, isPlayer = false, type = null, isAccident = false) {
            const drawImg = (isAccident && gameImages.playerAccident) ? gameImages.playerAccident : img;
            
            if (drawImg && drawImg.complete && drawImg.naturalWidth > 0) {
                ctx.drawImage(drawImg, x, y, width, height);
            } else {
                ctx.fillStyle = isPlayer ? '#E74C3C' : (type ? type.color : '#3498DB');
                ctx.fillRect(x, y, width, height);
            }
            
            if (isPlayer && invincibleFrames > 0 && !isAccident) {
                if (Math.floor(Date.now() / 50) % 2 === 0) {
                    ctx.globalAlpha = 0.5;
                }
            }
            
            // Shield protection di player (efek transparan, motor tetap terlihat)
            if (isPlayer && shieldActive && !isRespawning && invincibleFrames <= 0) {
                const isBlinking = shieldRemainingTime <= 5;
                if (!isBlinking || Math.floor(Date.now() / 100) % 2 === 0) {
                    ctx.save();
                    
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = '#0088ff';
                    
                    ctx.beginPath();
                    ctx.arc(x + width / 2, y + height / 2, Math.max(width, height) / 1.2, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(0, 136, 255, 0.15)';
                    ctx.fill();
                    
                    ctx.beginPath();
                    ctx.arc(x + width / 2, y + height / 2, Math.max(width, height) / 1.6, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(0, 136, 255, 0.25)';
                    ctx.fill();
                    
                    const shieldImg = gameImages.shield;
                    if (shieldImg && shieldImg.complete && shieldImg.naturalWidth > 0) {
                        const iconSize = Math.max(width, height) * 0.4;
                        ctx.drawImage(shieldImg, 
                            x + width/2 - iconSize/2, 
                            y - iconSize/1.5,
                            iconSize, iconSize);
                    } else {
                        ctx.font = `${Math.max(16, width * 0.5)}px Arial`;
                        ctx.fillStyle = '#44aaff';
                        ctx.fillText('🛡️', x + width/2 - 12, y - 10);
                    }
                    
                    ctx.restore();
                }
            }
            
            // Lampu POLANTAS
            if (type && type.name === 'POLANTAS') {
                const blink = Math.floor(Date.now() / 150) % 2;
                ctx.fillStyle = blink ? '#FF0000' : '#0000FF';
                ctx.fillRect(x + 5, y - 5, 8, 4);
                ctx.fillRect(x + width - 13, y - 5, 8, 4);
            }
            
            // Lampu DAMKAR
            if (type && type.name === 'DAMKAR') {
                const blink = Math.floor(Date.now() / 100) % 2;
                ctx.fillStyle = blink ? '#FF6600' : '#FF0000';
                ctx.fillRect(x + width/2 - 7, y - 5, 14, 4);
            }
            
            ctx.globalAlpha = 1;
        }
        
        function drawObstacle(img, x, y, width, height) {
            if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, x, y, width, height);
            } else {
                ctx.fillStyle = '#7F8C8D';
                ctx.beginPath();
                ctx.ellipse(x + width/2, y + height/2, width/2, height/2, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        function drawShieldPowerup(x, y, size) {
            ctx.save();
            const pulse = Math.sin(Date.now() * 0.008) * 0.15 + 0.85;
            
            ctx.beginPath();
            ctx.arc(x + size/2, y + size/2, size/2 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 200, 255, 0.25)';
            ctx.fill();
            
            const shieldImg = gameImages.shield;
            if (shieldImg && shieldImg.complete && shieldImg.naturalWidth > 0) {
                const imgSize = size * 0.8;
                ctx.drawImage(shieldImg, x + size/2 - imgSize/2, y + size/2 - imgSize/2, imgSize, imgSize);
            } else {
                ctx.font = `${Math.floor(size * 0.6)}px Arial`;
                ctx.fillStyle = '#00aaff';
                ctx.fillText('🛡️', x + size/4, y + size/1.5);
            }
            
            ctx.restore();
        }
        
        function drawLifePowerup(x, y, size) {
            ctx.save();
            const pulse = Math.sin(Date.now() * 0.005) * 0.1 + 0.9;
            
            ctx.beginPath();
            ctx.arc(x + size/2, y + size/2, size/2 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 80, 120, 0.3)';
            ctx.fill();
            
            const heartImg = gameImages.heart;
            if (heartImg && heartImg.complete && heartImg.naturalWidth > 0) {
                const imgSize = size * 0.7;
                ctx.drawImage(heartImg, x + size/2 - imgSize/2, y + size/2 - imgSize/2, imgSize, imgSize);
            } else {
                ctx.font = `${Math.floor(size * 0.6)}px Arial`;
                ctx.fillStyle = '#ff4466';
                ctx.fillText('❤️', x + size/4, y + size/1.5);
            }
            
            ctx.restore();
        }
        
        function drawRoad() {
            const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
            gradient.addColorStop(0, '#2C3E50');
            gradient.addColorStop(1, '#1a252f');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            
            ctx.strokeStyle = '#F1C40F';
            ctx.lineWidth = Math.max(4, canvasWidth * 0.01);
            ctx.setLineDash([canvasWidth * 0.06, canvasWidth * 0.08]);
            ctx.beginPath();
            ctx.moveTo(canvasWidth / 2, 0);
            ctx.lineTo(canvasWidth / 2, canvasHeight);
            ctx.stroke();
            
            ctx.setLineDash([15, 30]);
            ctx.lineWidth = Math.max(2, canvasWidth * 0.005);
            ctx.strokeStyle = '#FFF';
            for (let i = -50; i < canvasHeight; i += 60) {
                ctx.beginPath();
                ctx.moveTo(canvasWidth * 0.05, i + roadOffset);
                ctx.lineTo(canvasWidth * 0.05, i + 40 + roadOffset);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(canvasWidth * 0.95, i + roadOffset);
                ctx.lineTo(canvasWidth * 0.95, i + 40 + roadOffset);
                ctx.stroke();
            }
            
            ctx.setLineDash([]);
            ctx.strokeStyle = '#95A5A6';
            ctx.lineWidth = 3;
            ctx.strokeRect(canvasWidth * 0.03, 0, canvasWidth * 0.94, canvasHeight);
        }
        
        // ========== GAME UPDATE ==========
        function update() {
            if (!gameRunning || isPaused) return;
            
            if (isRespawning) {
                respawnTimer--;
                if (respawnTimer <= 0) doRespawn();
                return;
            }
            
            if (invincibleFrames > 0) invincibleFrames--;
            updateShieldTimer();
            if (accidentDisplayTimer > 0) accidentDisplayTimer--;
            
            const moveSpeed = Math.min(10, canvasWidth * 0.02);
            if (moveLeft && player.x > canvasWidth * 0.03) player.x -= moveSpeed;
            if (moveRight && player.x < canvasWidth - player.width - canvasWidth * 0.03) player.x += moveSpeed;
            
            if (player.x < canvasWidth * 0.03) player.x = canvasWidth * 0.03;
            if (player.x > canvasWidth - player.width - canvasWidth * 0.03) player.x = canvasWidth - player.width - canvasWidth * 0.03;
            
            let spawnRate = Math.max(45, 110 - Math.floor(speed * 2));
            if (frameCount % spawnRate === 0) spawnEnemy();
            
            if (frameCount % currentLevelConfig.obstacleSpawnRate === 0 && Math.random() < currentLevelConfig.obstacleChance) {
                spawnObstacle();
            }
            
            if (frameCount % 500 === 0 && Math.random() < 0.25) spawnPowerup();
            if (frameCount % 400 === 0 && Math.random() < 0.2 && lives < 5) spawnLifePowerup();
            
            // Update enemies
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                let enemySpeed = speed + 2;
                
                if (enemy.type.agresif) {
                    enemySpeed = (speed + 2) * enemy.type.speedBonus;
                    if (enemy.y > canvasHeight / 2 && Math.random() < 0.02) {
                        const direction = player.x > enemy.x ? 1 : -1;
                        enemy.agresifOffset += direction * 2;
                        enemy.agresifOffset = Math.min(Math.max(enemy.agresifOffset, -25), 25);
                    }
                    enemy.x += enemy.agresifOffset * 0.3;
                    enemy.x = Math.min(Math.max(enemy.x, 15), canvasWidth - enemy.width - 15);
                }
                
                enemy.y += enemySpeed;
                
                if (!isRespawning && enemy.x < player.x + player.width &&
                    enemy.x + enemy.width > player.x &&
                    enemy.y < player.y + player.height &&
                    enemy.y + enemy.height > player.y) {
                    const isGameOver = handleAccident(enemy.type.name);
                    if (isGameOver) return;
                    enemies.splice(i, 1);
                    i--;
                    continue;
                }
                
                if (enemy.y > canvasHeight) {
                    enemies.splice(i, 1);
                    i--;
                    score += enemy.type.points;
                    enemiesPassed++;
                    combo++;
                    if (enemiesPassed % 5 === 0 && speed < currentLevelConfig.maxSpeed) {
                        speed = Math.min(currentLevelConfig.maxSpeed, speed + 0.5);
                    }
                    updateUI();
                }
            }
            
            // Update obstacles
            for (let i = 0; i < obstacles.length; i++) {
                obstacles[i].y += speed + 2;
                
                if (!isRespawning && obstacles[i].x < player.x + player.width &&
                    obstacles[i].x + obstacles[i].width > player.x &&
                    obstacles[i].y < player.y + player.height &&
                    obstacles[i].y + obstacles[i].height > player.y) {
                    const isGameOver = handleAccident('BATU');
                    if (isGameOver) return;
                    obstacles.splice(i, 1);
                    i--;
                    continue;
                }
                
                if (obstacles[i].y > canvasHeight) {
                    obstacles.splice(i, 1);
                    i--;
                }
            }
            
            // Update powerups
            for (let i = 0; i < powerups.length; i++) {
                powerups[i].y += speed + 2;
                if (powerups[i].x < player.x + player.width &&
                    powerups[i].x + powerups[i].size > player.x &&
                    powerups[i].y < player.y + player.height &&
                    powerups[i].y + powerups[i].size > player.y) {
                    activateShield(15);
                    powerups.splice(i, 1);
                    i--;
                    continue;
                }
                if (powerups[i].y > canvasHeight) {
                    powerups.splice(i, 1);
                    i--;
                }
            }
            
            // Update life powerups
            for (let i = 0; i < lifePowerups.length; i++) {
                lifePowerups[i].y += speed + 2;
                if (lifePowerups[i].x < player.x + player.width &&
                    lifePowerups[i].x + lifePowerups[i].size > player.x &&
                    lifePowerups[i].y < player.y + player.height &&
                    lifePowerups[i].y + lifePowerups[i].size > player.y) {
                    if (lives < 5) {
                        lives++;
                        updateUI();
                    }
                    lifePowerups.splice(i, 1);
                    i--;
                    continue;
                }
                if (lifePowerups[i].y > canvasHeight) {
                    lifePowerups.splice(i, 1);
                    i--;
                }
            }
            
            if (frameCount % 100 === 0 && frameCount > 0) {
                if (combo > 0) combo = Math.max(0, combo - 1);
                updateUI();
            }
            
            frameCount++;
            roadOffset = (roadOffset + speed) % 100;
        }

        //draw
        function draw() {
    if (!canvasWidth || !canvasHeight) return;
    drawRoad();
    
    for (let obs of obstacles) drawObstacle(obs.image, obs.x, obs.y, obs.width, obs.height);
    for (let power of powerups) drawShieldPowerup(power.x, power.y, power.size);
    for (let life of lifePowerups) drawLifePowerup(life.x, life.y, life.size);
    
    for (let enemy of enemies) {
    drawCharacter(enemy.image, enemy.x, enemy.y, enemy.width, enemy.height, false, enemy.type);
    // Teks nama musuh dihapus
}
    
    const showAccident = (accidentDisplayTimer > 0) && !isRespawning;
    if (showAccident) {
        drawCharacter(player.image, lastAccidentX, lastAccidentY, player.width, player.height, true, null, true);
    } else {
        drawCharacter(player.image, player.x, player.y, player.width, player.height, true);
    }
    
    drawExplosion();
    
    if (isRespawning) {
        ctx.font = `bold ${Math.max(18, canvasWidth * 0.04)}px Arial`;
        ctx.fillStyle = '#ffaa00';
        ctx.shadowBlur = 8;
        ctx.fillText('💔 RESPAWN...', canvasWidth / 2 - 70, canvasHeight / 2);
    }
    
    if (invincibleFrames > 0 && !isRespawning && !showAccident) {
        ctx.font = `bold ${Math.max(12, canvasWidth * 0.02)}px Arial`;
        ctx.fillStyle = '#aaffff';
        ctx.fillText('✨ INVINCIBLE ✨', canvasWidth / 2 - 55, 50);
    }
    
    if (speed > 10 && gameRunning && !isPaused && !isRespawning) {
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = `rgba(255, 100, 0, ${Math.random() * 0.5})`;
            ctx.fillRect(player.x - 10 - Math.random() * 20, player.y + Math.random() * player.height, 3, 6);
        }
    }
    
    if (isPaused && gameRunning) {
        ctx.font = `bold ${Math.max(20, canvasWidth * 0.05)}px Arial`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('⏸️ PAUSED', canvasWidth / 2 - 70, canvasHeight / 2);
    }
    
    // ========== SPEED & LEVEL DI POJOK KANAN ATAS ==========
    ctx.font = `bold ${Math.max(12, canvasWidth * 0.025)}px "Segoe UI"`;
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`⚡ ${Math.floor(speed * 10) / 10}`, canvasWidth - 55, 40);
    ctx.font = `bold ${Math.max(10, canvasWidth * 0.02)}px Arial`;
    ctx.fillStyle = '#aaa';
    ctx.fillText(`${currentLevelConfig.name}`, canvasWidth - 55, 65);
    
    if (shieldActive && shieldRemainingTime <= 5 && shieldRemainingTime > 0 && !isRespawning) {
        ctx.font = `bold ${Math.max(14, canvasWidth * 0.03)}px Arial`;
        ctx.fillStyle = '#ff4444';
        ctx.fillText('⚠️ SHIELD LOW! ⚠️', canvasWidth / 2 - 80, 70);
    }
    
    // ========== HIGHSCORE BOARD TRANSPARAN DI DALAM CANVAS ==========
    const highscoreValue = localStorage.getItem('highscore') ? parseInt(localStorage.getItem('highscore')) : 0;
    
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.88;
    
    // Background transparan (pojok kiri atas)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 78, 36, 6);
    ctx.fill();
    
    // Border tipis
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(8, 8, 78, 36, 6);
    ctx.stroke();
    
    // Teks "HIGHSCORE"
    ctx.font = `bold ${Math.max(8, canvasWidth * 0.016)}px "Segoe UI"`;
    ctx.fillStyle = '#ffd700';
    ctx.fillText('🏆 HIGHSCORE', 14, 22);
    
    // Nilai highscore
    ctx.font = `bold ${Math.max(14, canvasWidth * 0.022)}px "Segoe UI"`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(highscoreValue, 14 + 40, 38);
    
    ctx.restore();
}
        
        function gameLoop() {
            update();
            draw();
            animationId = requestAnimationFrame(gameLoop);
        }
        
        // ========== GAME CONTROL ==========
        function startGame() {
            setLevel(currentLevel);
            init();
            gameRunning = true;
            isPaused = false;
            moveLeft = false;
            moveRight = false;
            if (pauseBtn) {
                pauseBtn.innerText = '⏸️ PAUSE';
                pauseBtn.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
            }
            if (startOverlay) startOverlay.style.display = 'none';
            if (resetBtn) resetBtn.style.display = 'block';
            if (pauseBtn) pauseBtn.style.display = 'block';
            if (animationId) cancelAnimationFrame(animationId);
            gameLoop();
            setTimeout(() => createControlAreas(), 100);
        }
        
        function togglePause(e) {
            if (e) { e.stopPropagation(); e.preventDefault(); }
            if (!gameRunning) return;
            isPaused = !isPaused;
            if (pauseBtn) {
                if (isPaused) {
                    pauseBtn.innerText = '▶️ RESUME';
                    pauseBtn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
                } else {
                    pauseBtn.innerText = '⏸️ PAUSE';
                    pauseBtn.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
                }
            }
        }
        
        function resetGame() {
            if (animationId) cancelAnimationFrame(animationId);
            init();
            gameRunning = true;
            isPaused = false;
            moveLeft = false;
            moveRight = false;
            if (pauseBtn) {
                pauseBtn.innerText = '⏸️ PAUSE';
                pauseBtn.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
            }
            gameLoop();
            setTimeout(() => createControlAreas(), 100);
        }
        
        function manualReset() {
            if (confirm('Reset game?')) resetGame();
        }
        
        function showStartOverlay() {
            gameRunning = false;
            if (startOverlay) startOverlay.style.display = 'flex';
            if (resetBtn) resetBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (animationId) cancelAnimationFrame(animationId);
        }
        
        // ========== AREA KONTROL (KIRI/KANAN DI CANVAS) ==========
        let leftControlDiv = null, rightControlDiv = null;
        
        function createControlAreas() {
            if (leftControlDiv) leftControlDiv.remove();
            if (rightControlDiv) rightControlDiv.remove();
            if (!gameRunning) return;
            
            const canvasRect = canvas.getBoundingClientRect();
            if (canvasRect.width === 0) return;
            
            leftControlDiv = document.createElement('div');
            leftControlDiv.style.cssText = `position:fixed;left:${canvasRect.left}px;top:${canvasRect.top}px;width:${canvasRect.width/2}px;height:${canvasRect.height}px;background:transparent;pointer-events:auto;z-index:25;`;
            
            rightControlDiv = document.createElement('div');
            rightControlDiv.style.cssText = `position:fixed;left:${canvasRect.left+canvasRect.width/2}px;top:${canvasRect.top}px;width:${canvasRect.width/2}px;height:${canvasRect.height}px;background:transparent;pointer-events:auto;z-index:25;`;
            
            leftControlDiv.addEventListener('touchstart', (e) => { e.preventDefault(); moveLeft = true; });
            leftControlDiv.addEventListener('touchend', (e) => { e.preventDefault(); moveLeft = false; });
            leftControlDiv.addEventListener('mousedown', (e) => { e.preventDefault(); moveLeft = true; });
            leftControlDiv.addEventListener('mouseup', (e) => { e.preventDefault(); moveLeft = false; });
            
            rightControlDiv.addEventListener('touchstart', (e) => { e.preventDefault(); moveRight = true; });
            rightControlDiv.addEventListener('touchend', (e) => { e.preventDefault(); moveRight = false; });
            rightControlDiv.addEventListener('mousedown', (e) => { e.preventDefault(); moveRight = true; });
            rightControlDiv.addEventListener('mouseup', (e) => { e.preventDefault(); moveRight = false; });
            
            document.body.appendChild(leftControlDiv);
            document.body.appendChild(rightControlDiv);
        }
        
        // ========== EVENT LISTENERS ==========
        if (resetBtn) resetBtn.addEventListener('click', (e) => { e.stopPropagation(); manualReset(); });
        if (pauseBtn) pauseBtn.addEventListener('click', togglePause);
        if (startBtn) startBtn.addEventListener('click', (e) => { e.preventDefault(); startGame(); });
        if (levelSelect) {
            levelSelect.addEventListener('change', (e) => {
                currentLevel = e.target.value;
                setLevel(currentLevel);
            });
        }
        
        document.querySelectorAll('.level-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.level-opt').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                currentLevel = btn.dataset.level;
                setLevel(currentLevel);
                if (levelSelect) levelSelect.value = currentLevel;
            });
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') moveLeft = true;
            if (e.key === 'ArrowRight') moveRight = true;
            if (e.key === 'p' || e.key === 'P') togglePause(e);
        });
        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft') moveLeft = false;
            if (e.key === 'ArrowRight') moveRight = false;
        });
        
        window.addEventListener('resize', () => { 
            resizeCanvas();
            if (gameRunning) setTimeout(() => createControlAreas(), 50);
        });
        
        resizeCanvas();
        showStartOverlay();
        console.log("Game initialized with localStorage highscore!");
    }
})();
