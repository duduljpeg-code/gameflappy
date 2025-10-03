        class Game {
            constructor() {
                this.canvas = document.getElementById('gameCanvas');
                this.ctx = this.canvas.getContext('2d');
                this.gameState = 'menu'; // menu, playing, gameover
                this.score = 0;
                this.highScore = parseInt(localStorage.getItem('flappyHighScore')) || 0;
                this.entities = [];
                this.keys = {};
                this.mouse = { x: 0, y: 0, pressed: false };
                this.touch = { x: 0, y: 0, active: false };
                this.lastTime = 0;
                this.pipeSpawnTimer = 0;
                this.pipeSpawnInterval = 1800; // milliseconds
                this.gapSize = 120;
                this.pipeWidth = 60;
                this.gameSpeed = 2;
                
                this.setupCanvas();
                this.setupInput();
                this.setupAudio();
                this.updateUI();
                this.gameLoop();
            }

            setupCanvas() {
                // Adjust canvas size for mobile
                const container = this.canvas.parentElement;
                const maxWidth = Math.min(400, window.innerWidth - 40);
                const scale = maxWidth / this.canvas.width;
                this.canvas.style.width = maxWidth + 'px';
                this.canvas.style.height = (this.canvas.height * scale) + 'px';
                
                // Set actual canvas dimensions for crisp rendering
                this.canvas.width = 320;
                this.canvas.height = 480;
            }

            setupInput() {
                // Keyboard input
                document.addEventListener('keydown', (e) => {
                    if (e.code === 'Space') {
                        e.preventDefault();
                        this.keys['Space'] = true;
                        this.jump();
                    }
                });

                document.addEventListener('keyup', (e) => {
                    if (e.code === 'Space') {
                        this.keys['Space'] = false;
                    }
                });

                // Mouse input
                this.canvas.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    this.mouse.pressed = true;
                    this.jump();
                });

                this.canvas.addEventListener('mouseup', (e) => {
                    this.mouse.pressed = false;
                });

                // Touch input
                this.canvas.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.touch.active = true;
                    this.jump();
                });

                this.canvas.addEventListener('touchend', (e) => {
                    this.touch.active = false;
                });

                // Button events
                document.getElementById('startBtn').addEventListener('click', () => {
                    this.startGame();
                });

                document.getElementById('restartBtn').addEventListener('click', () => {
                    this.restartGame();
                });
            }

            setupAudio() {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.sounds = {
                    jump: this.createSound(200, 0.1, 'sawtooth'),
                    score: this.createSound(800, 0.05, 'sine'),
                    hit: this.createSound(150, 0.2, 'square')
                };
            }

            createSound(frequency, duration, type) {
                return () => {
                    if (this.audioContext.state === 'suspended') {
                        this.audioContext.resume();
                    }
                    
                    const oscillator = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.audioContext.destination);
                    
                    oscillator.frequency.value = frequency;
                    oscillator.type = type;
                    
                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
                    
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + duration);
                };
            }

            jump() {
                if (this.gameState === 'playing') {
                    const bird = this.entities.find(e => e.type === 'bird');
                    if (bird) {
                        bird.velocity = -8;
                        this.sounds.jump();
                    }
                }
            }

            startGame() {
                this.gameState = 'playing';
                this.score = 0;
                this.entities = [];
                this.pipeSpawnTimer = 0;
                this.gameSpeed = 2;
                
                // Create bird
                this.entities.push({
                    type: 'bird',
                    x: 80,
                    y: this.canvas.height / 2,
                    width: 34,
                    height: 24,
                    velocity: 0,
                    gravity: 0.5,
                    rotation: 0
                });
                
                this.updateUI();
            }

            restartGame() {
                this.startGame();
            }

            update(deltaTime) {
                if (this.gameState !== 'playing') return;

                // Update bird
                const bird = this.entities.find(e => e.type === 'bird');
                if (bird) {
                    bird.velocity += bird.gravity;
                    bird.y += bird.velocity;
                    bird.rotation = Math.max(-0.5, Math.min(0.5, bird.velocity * 0.1));

                    // Ground and ceiling collision
                    if (bird.y <= 0) {
                        bird.y = 0;
                        bird.velocity = 0;
                    }
                    
                    if (bird.y + bird.height >= this.canvas.height) {
                        this.gameOver();
                        return;
                    }
                }

                // Update pipes
                this.entities = this.entities.filter(entity => {
                    if (entity.type === 'pipe') {
                        entity.x -= this.gameSpeed;
                        
                        // Remove pipes that are off screen
                        if (entity.x + entity.width < 0) {
                            return false;
                        }
                        
                        // Score when bird passes pipe
                        if (!entity.passed && entity.x + entity.width < bird.x) {
                            entity.passed = true;
                            this.score++;
                            this.sounds.score();
                            this.gameSpeed = Math.min(5, 2 + this.score * 0.1);
                            this.gapSize = Math.max(80, 120 - this.score * 2);
                        }
                    }
                    return true;
                });

                // Spawn new pipes
                this.pipeSpawnTimer += deltaTime;
                if (this.pipeSpawnTimer >= this.pipeSpawnInterval) {
                    this.spawnPipe();
                    this.pipeSpawnTimer = 0;
                }

                // Check collisions
                this.checkCollisions();
            }

            spawnPipe() {
                const minHeight = 50;
                const maxHeight = this.canvas.height - this.gapSize - minHeight;
                const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;
                
                // Top pipe
                this.entities.push({
                    type: 'pipe',
                    x: this.canvas.width,
                    y: 0,
                    width: this.pipeWidth,
                    height: topHeight,
                    passed: false
                });
                
                // Bottom pipe
                this.entities.push({
                    type: 'pipe',
                    x: this.canvas.width,
                    y: topHeight + this.gapSize,
                    width: this.pipeWidth,
                    height: this.canvas.height - topHeight - this.gapSize,
                    passed: false
                });
            }

            checkCollisions() {
                const bird = this.entities.find(e => e.type === 'bird');
                if (!bird) return;

                const pipes = this.entities.filter(e => e.type === 'pipe');
                
                for (const pipe of pipes) {
                    if (this.checkCollision(bird, pipe)) {
                        this.gameOver();
                        return;
                    }
                }
            }

            checkCollision(rect1, rect2) {
                return rect1.x < rect2.x + rect2.width &&
                       rect1.x + rect1.width > rect2.x &&
                       rect1.y < rect2.y + rect2.height &&
                       rect1.y + rect1.height > rect2.y;
            }

            gameOver() {
                this.gameState = 'gameover';
                this.sounds.hit();
                
                if (this.score > this.highScore) {
                    this.highScore = this.score;
                    localStorage.setItem('flappyHighScore', this.highScore.toString());
                }
                
                this.updateUI();
            }

            render() {
                // Clear canvas
                this.ctx.fillStyle = '#87CEEB';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

                // Draw background elements
                this.drawBackground();

                // Draw entities
                for (const entity of this.entities) {
                    this.drawEntity(entity);
                }

                // Draw ground
                this.drawGround();
            }

            drawBackground() {
                // Draw clouds
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.beginPath();
                this.ctx.arc(50, 80, 20, 0, Math.PI * 2);
                this.ctx.arc(70, 70, 25, 0, Math.PI * 2);
                this.ctx.arc(90, 80, 18, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.beginPath();
                this.ctx.arc(250, 120, 22, 0, Math.PI * 2);
                this.ctx.arc(270, 110, 28, 0, Math.PI * 2);
                this.ctx.arc(290, 120, 20, 0, Math.PI * 2);
                this.ctx.fill();
            }

            drawGround() {
                this.ctx.fillStyle = '#8B4513';
                this.ctx.fillRect(0, this.canvas.height - 20, this.canvas.width, 20);
                
                this.ctx.fillStyle = '#90EE90';
                this.ctx.fillRect(0, this.canvas.height - 20, this.canvas.width, 5);
            }

            drawEntity(entity) {
                this.ctx.save();
                
                if (entity.type === 'bird') {
                    // Draw bird body
                    this.ctx.translate(entity.x + entity.width / 2, entity.y + entity.height / 2);
                    this.ctx.rotate(entity.rotation);
                    
                    this.ctx.fillStyle = '#FFD700';
                    this.ctx.fillRect(-entity.width / 2, -entity.height / 2, entity.width, entity.height);
                    
                    // Draw bird eye
                    this.ctx.fillStyle = 'white';
                    this.ctx.beginPath();
                    this.ctx.arc(entity.width / 4, -entity.height / 6, 6, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    this.ctx.fillStyle = 'black';
                    this.ctx.beginPath();
                    this.ctx.arc(entity.width / 4 + 2, -entity.height / 6, 3, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // Draw bird beak
                    this.ctx.fillStyle = '#FF8C00';
                    this.ctx.beginPath();
                    this.ctx.moveTo(entity.width / 2, -2);
                    this.ctx.lineTo(entity.width / 2 + 10, 0);
                    this.ctx.lineTo(entity.width / 2, 2);
                    this.ctx.fill();
                    
                } else if (entity.type === 'pipe') {
                    // Draw pipe
                    this.ctx.fillStyle = '#228B22';
                    this.ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
                    
                    // Draw pipe cap
                    this.ctx.fillStyle = '#32CD32';
                    this.ctx.fillRect(entity.x - 3, entity.y, entity.width + 6, 20);
                }
                
                this.ctx.restore();
            }

            updateUI() {
                // Show/hide screens
                document.getElementById('menuScreen').classList.toggle('hidden', this.gameState !== 'menu');
                document.getElementById('gameOverScreen').classList.toggle('hidden', this.gameState !== 'gameover');
                document.getElementById('scoreDisplay').classList.toggle('hidden', this.gameState !== 'playing');
                document.getElementById('highScoreDisplay').classList.toggle('hidden', this.gameState !== 'playing');
                
                // Update scores
                document.getElementById('scoreDisplay').textContent = this.score;
                document.getElementById('highScoreDisplay').textContent = 'Best: ' + this.highScore;
                document.getElementById('finalScore').textContent = 'Score: ' + this.score;
                document.getElementById('bestScore').textContent = 'Best: ' + this.highScore;
            }

            gameLoop() {
                const currentTime = performance.now();
                const deltaTime = currentTime - this.lastTime;
                this.lastTime = currentTime;

                this.update(deltaTime);
                this.render();
                this.updateUI();

                requestAnimationFrame(() => this.gameLoop());
            }
        }

        // Initialize game when page loads
        window.addEventListener('load', () => {
            new Game();
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            const canvas = document.getElementById('gameCanvas');
            const container = canvas.parentElement;
            const maxWidth = Math.min(400, window.innerWidth - 40);
            const scale = maxWidth / 320;
            canvas.style.width = maxWidth + 'px';
            canvas.style.height = (480 * scale) + 'px';
        });