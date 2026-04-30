(async function () {
    const { removeBackground: imglyRemoveBackground } = await import("https://esm.sh/@imgly/background-removal@1.7.0");
    const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");

    // ─── DOM refs ───
    const imageUpload = document.getElementById('imageUpload');
    const uploadZone = document.getElementById('uploadZone');
    const previewSection = document.getElementById('previewSection');
    const previewStrip = document.getElementById('previewStrip');
    const progressSection = document.getElementById('progressSection');
    const progressMsg = document.getElementById('progressMsg');
    const resultsDiv = document.getElementById('results');
    const downloadAllSection = document.getElementById('downloadAllSection');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const resetSection = document.getElementById('resetSection');
    const resetBtn = document.getElementById('resetBtn');
    const qualityToggle = document.getElementById('qualityToggle');
    const itemCountToggle = document.getElementById('itemCountToggle');
    const itemCountManual = document.getElementById('itemCountManual');
    const itemCountCustomBtn = document.getElementById('itemCountCustomBtn');
    const themeToggle = document.getElementById('themeToggle');
    const prefixInput = document.getElementById('prefixInput');
    const bgToggles = document.getElementById('bgToggles');
    const toast = document.getElementById('toast');
    const bgCanvas = document.getElementById('bgCanvas');
    const exportSizeSelect = document.getElementById('exportSizeSelect');
    const removeBgToggle = document.getElementById('removeBgToggle');
    const shadowToggle = document.getElementById('shadowToggle');
    const shadowColor = document.getElementById('shadowColor');
    const shadowOpacity = document.getElementById('shadowOpacity');
    const shadowAngle = document.getElementById('shadowAngle');
    const shadowDistance = document.getElementById('shadowDistance');
    const shadowSpread = document.getElementById('shadowSpread');
    const shadowSize = document.getElementById('shadowSize');
    const shadowSubControls = document.getElementById('shadowSubControls');
    const paddingSlider = document.getElementById('paddingSlider');
    const steps = [document.getElementById('step1'), document.getElementById('step2'), document.getElementById('step3')];
    const connectors = [document.getElementById('conn1'), document.getElementById('conn2')];
    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    const closeModal = document.getElementById('closeModal');
    const gotItBtn = document.getElementById('gotItBtn');
    const reportLink = document.getElementById('reportLink');
    const reportModal = document.getElementById('reportModal');
    const closeReportModal = document.getElementById('closeReportModal');
    const progressBarFill = document.getElementById('progressBarFill');
    const snakeToggle = document.getElementById('snakeToggle');

    // ─── Interactive Background State ───
    let isSnakeEnabled = localStorage.getItem('spritecut_snake_enabled') !== 'false';
    if (!isSnakeEnabled && snakeToggle) {
        snakeToggle.classList.add('off');
    }

    // ─── Interactive Background (Neon Snake) ───
    const bgCtx = bgCanvas.getContext('2d');
    let mouse = { x: null, y: null, active: false, down: false };

    let snake = {
        head: { x: 0, y: 0 },
        angle: 0,
        speed: 4,
        length: 40,    // How many history points to keep
        history: [],   // Array of {x, y}
        thickness: 8
    };

    // ─── Favicon Animation ───
    function initFaviconAnimation() {
        const favicon = document.querySelector('link[rel="icon"]');
        if (!favicon) return;

        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.src = 'logo.png';

        img.onload = () => {
            let angle = 0;
            function animate() {
                ctx.clearRect(0, 0, 32, 32);
                ctx.save();
                ctx.translate(16, 16);
                
                // Subtle pulse + very slow rotation
                const scale = 0.9 + Math.sin(Date.now() / 1000) * 0.1;
                ctx.scale(scale, scale);
                ctx.rotate(Math.sin(Date.now() / 2000) * 0.2); 
                
                // Draw image (assuming black background is handled by mix-blend-mode or just drawn)
                // Since it's a favicon, we draw it normally.
                ctx.drawImage(img, -16, -16, 32, 32);
                ctx.restore();

                favicon.href = canvas.toDataURL('image/png');
                setTimeout(() => requestAnimationFrame(animate), 100); // 10fps is enough for favicon
            }
            animate();
        };
    }
    initFaviconAnimation();

    let food = [];
    let particles = [];
    let score = 0;

    const neonColors = [
        '255, 0, 100', // Hot Pink
        '0, 255, 255', // Cyan
        '100, 255, 0', // Lime Green
        '255, 200, 0', // Gold/Yellow
        '150, 0, 255', // Purple
        '255, 50, 50'  // Bright Red
    ];
    function getRandomColor() {
        return neonColors[Math.floor(Math.random() * neonColors.length)];
    }

    document.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
    });

    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.item-card, .upload-zone, #settingsBar, #downloadAllSection, #resetSection, .modal, button, a, input, select, textarea')) {
            mouse.down = true;
        }
    });

    document.addEventListener('mouseup', () => {
        mouse.down = false;
    });

    document.addEventListener('mouseleave', () => {
        mouse.active = false;
        mouse.down = false;
    });

    // Helper for Rainbow Mode
    function hslToRgb(h, s, l) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color);
        };
        return `${f(0)}, ${f(8)}, ${f(4)}`;
    }

    function spawnFood() {
        let x, y;
        let valid = false;
        let maxAttempts = 30;

        for (let i = 0; i < maxAttempts; i++) {
            x = Math.random() * (bgCanvas.width - 100) + 50;
            y = Math.random() * (bgCanvas.height - 100) + 50;

            // Check what element is at this screen position
            let el = document.elementFromPoint(x, y);

            // If it hits the body, html, canvas, or main container, it's an empty background space
            if (!el ||
                el === document.body ||
                el === document.documentElement ||
                el.id === 'bgCanvas' ||
                (el.classList && el.classList.contains('container'))) {
                valid = true;
                break;
            }
        }

        // Fallback to purely random if screen is somehow completely covered
        if (!valid) {
            x = Math.random() * (bgCanvas.width - 100) + 50;
            y = Math.random() * (bgCanvas.height - 100) + 50;
        }

        food.push({
            x: x,
            y: y,
            pulse: Math.random() * Math.PI * 2,
            color: getRandomColor(),
            age: 0
        });
    }

    function spawnSparks(x, y, colorStr, count) {
        for (let i = 0; i < count; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 5 + 1;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                color: colorStr
            });
        }
    }

    function resetSnake() {
        snake.head = { x: bgCanvas.width / 2, y: bgCanvas.height / 2 };
        snake.angle = Math.random() * Math.PI * 2;
        snake.history = []; // Start empty so it slithers out naturally
        snake.length = 40;
        snake.color = getRandomColor();
    }

    function initBackground() {
        resetSnake();
        score = 0;
        food = [];
        particles = [];
        for (let i = 0; i < 5; i++) spawnFood();
    }

    function animateBackground() {
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        if (!isSnakeEnabled) {
            requestAnimationFrame(animateBackground);
            return;
        }
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';

        let isRainbow = score >= 100;
        let themePrimary = snake.color || '0, 255, 255';
        if (isRainbow) {
            let hue = (Date.now() / 15) % 360;
            themePrimary = hslToRgb(hue, 100, isLight ? 45 : 60);
        }

        let themeDeath = '255, 50, 100'; // Death sparks (bright red)
        let dynamicThickness = Math.min(snake.thickness + Math.floor(score / 50) * 2, 24);

        // --- 1. Snake Movement ---
        if (mouse.active && mouse.x !== null) {
            // Turn towards mouse
            let dx = mouse.x - snake.head.x;
            let dy = mouse.y - snake.head.y;
            let targetAngle = Math.atan2(dy, dx);

            // Smooth interpolation
            let diff = targetAngle - snake.angle;
            // Normalize diff to -PI to PI
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            snake.angle += diff * 0.1; // Turn speed
        } else {
            // Wander aimlessly if mouse is off screen
            snake.angle += (Math.random() - 0.5) * 0.1;
        }

        let currentSpeed = mouse.down ? snake.speed * 2 : snake.speed;
        snake.head.x += Math.cos(snake.angle) * currentSpeed;
        snake.head.y += Math.sin(snake.angle) * currentSpeed;

        if (mouse.down && Math.random() < 0.3) {
            spawnSparks(snake.head.x, snake.head.y, themePrimary, 1);
        }

        // Screen wrapping
        if (snake.head.x < 0) snake.head.x = bgCanvas.width;
        if (snake.head.x > bgCanvas.width) snake.head.x = 0;
        if (snake.head.y < 0) snake.head.y = bgCanvas.height;
        if (snake.head.y > bgCanvas.height) snake.head.y = 0;

        // Update body history
        snake.history.unshift({ x: snake.head.x, y: snake.head.y });
        while (snake.history.length > snake.length) {
            snake.history.pop();
        }

        // --- 2. Food Collision ---
        for (let i = food.length - 1; i >= 0; i--) {
            let f = food[i];
            let dx = snake.head.x - f.x;
            let dy = snake.head.y - f.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 15) { // Eat radius
                score += 10;
                snake.length += 5; // Grow tail
                spawnSparks(f.x, f.y, f.color, 15); // Sparks match food color!
                food.splice(i, 1);
                spawnFood();
            }
        }

        // --- 3. Self Collision (Death) ---
        // Only check far enough back on the body that we don't instantly hit ourselves
        for (let i = 20; i < snake.history.length; i++) {
            let seg = snake.history[i];
            let dx = snake.head.x - seg.x;
            let dy = snake.head.y - seg.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < dynamicThickness * 0.8) {
                // Death!
                spawnSparks(snake.head.x, snake.head.y, themeDeath, 30);
                score = 0;
                resetSnake();
                break; // Stop checking
            }
        }

        // --- 4. Update Particles ---
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95; // Friction
            p.vy *= 0.95;
            p.life -= 0.03;
            if (p.life <= 0) particles.splice(i, 1);
        }

        // ═══════════════════════════════
        // ───  RENDER  ───
        // ═══════════════════════════════

        // Interactive Pulsing Grid
        let gridSpacing = 40;
        let gridRadius = 250;
        let minX = Math.floor((snake.head.x - gridRadius) / gridSpacing) * gridSpacing;
        let maxX = Math.ceil((snake.head.x + gridRadius) / gridSpacing) * gridSpacing;
        let minY = Math.floor((snake.head.y - gridRadius) / gridSpacing) * gridSpacing;
        let maxY = Math.ceil((snake.head.y + gridRadius) / gridSpacing) * gridSpacing;

        for (let x = minX; x <= maxX; x += gridSpacing) {
            for (let y = minY; y <= maxY; y += gridSpacing) {
                let dist = Math.sqrt((x - snake.head.x) ** 2 + (y - snake.head.y) ** 2);
                if (dist < gridRadius) {
                    let alpha = ((gridRadius - dist) / gridRadius) * 0.3; // Fades out with distance
                    bgCtx.fillStyle = `rgba(${themePrimary}, ${alpha})`;
                    bgCtx.beginPath();
                    bgCtx.arc(x, y, 1.5, 0, Math.PI * 2);
                    bgCtx.fill();
                }
            }
        }

        // Draw Snake Body Trails
        if (snake.history.length > 1) {
            bgCtx.beginPath();
            bgCtx.moveTo(snake.history[0].x, snake.history[0].y);

            for (let i = 1; i < snake.history.length; i++) {
                // To handle screen wrap nicely in drawing, break line if distance is huge
                let p1 = snake.history[i - 1];
                let p2 = snake.history[i];
                let dx = p2.x - p1.x;
                let dy = p2.y - p1.y;
                let dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 100) {
                    bgCtx.moveTo(p2.x, p2.y);
                } else {
                    bgCtx.lineTo(p2.x, p2.y);
                }
            }

            bgCtx.lineCap = 'round';
            bgCtx.lineJoin = 'round';
            bgCtx.lineWidth = dynamicThickness;
            bgCtx.strokeStyle = `rgba(${themePrimary}, 1)`;
            bgCtx.shadowColor = `rgba(${themePrimary}, 1)`;
            bgCtx.shadowBlur = 25; // Brighter glow
            bgCtx.stroke();
            bgCtx.shadowBlur = 0;

            // Draw a brighter inner core
            bgCtx.lineWidth = dynamicThickness * 0.4;
            bgCtx.strokeStyle = `rgba(255, 255, 255, 0.9)`;
            bgCtx.stroke();
        }

        // Draw Snake Head
        bgCtx.fillStyle = '#fff';
        bgCtx.shadowColor = `rgba(${themePrimary}, 1)`; // Match glow to body color
        bgCtx.shadowBlur = 20;
        bgCtx.beginPath();
        bgCtx.arc(snake.head.x, snake.head.y, dynamicThickness * 0.8, 0, Math.PI * 2);
        bgCtx.fill();
        bgCtx.shadowBlur = 0;

        // Draw Food
        for (let i = 0; i < food.length; i++) {
            let f = food[i];
            f.age++;
            let scale = Math.min(f.age / 15, 1); // 0 to 1 over 15 frames
            f.pulse += 0.05;

            let currentFoodColor = isRainbow ? themePrimary : f.color;
            let r = (6 + Math.sin(f.pulse) * 2) * scale;

            bgCtx.fillStyle = `rgba(${currentFoodColor}, 0.9)`;
            bgCtx.shadowColor = `rgba(${currentFoodColor}, 1)`;
            bgCtx.shadowBlur = 20 * scale; // Extra glow
            bgCtx.beginPath();
            bgCtx.arc(f.x, f.y, r, 0, Math.PI * 2);
            bgCtx.fill();

            // Bright inner core
            bgCtx.shadowBlur = 0;
            bgCtx.fillStyle = `rgba(255, 255, 255, 0.8)`;
            bgCtx.beginPath();
            bgCtx.arc(f.x, f.y, r * 0.4, 0, Math.PI * 2);
            bgCtx.fill();
        }
        bgCtx.shadowBlur = 0;

        // Draw Particles
        for (let i = 0; i < particles.length; i++) {
            let p = particles[i];
            bgCtx.fillStyle = `rgba(${p.color}, ${p.life})`;
            bgCtx.shadowColor = `rgba(${p.color}, ${p.life})`;
            bgCtx.shadowBlur = 8;
            bgCtx.beginPath();
            bgCtx.arc(p.x, p.y, 2 * p.life + 1, 0, Math.PI * 2);
            bgCtx.fill();
        }
        bgCtx.shadowBlur = 0;

        // Draw Score
        if (score > 0) {
            bgCtx.font = 'bold 20px "Inter", sans-serif';
            bgCtx.fillStyle = `rgba(${themePrimary}, 0.8)`;
            bgCtx.fillText(`SCORE: ${score}`, 20, 40);
        }

        requestAnimationFrame(animateBackground);
    }


    function resizeBg() {
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
        initBackground();
    }

    window.addEventListener('resize', resizeBg);
    resizeBg();
    animateBackground();

    // ─── Settings State & Persistence ───
    let finalCanvases = [];
    let currentQuality = localStorage.getItem('spritecut_quality') || 'off';
    let currentPrefix = localStorage.getItem('spritecut_prefix') || 'item_';
    let currentFiles = [];

    // Apply persisted prefix
    prefixInput.value = currentPrefix;
    prefixInput.addEventListener('input', () => {
        currentPrefix = prefixInput.value;
        localStorage.setItem('spritecut_prefix', currentPrefix);

        // Live-update existing card titles and download filenames
        const cards = resultsDiv.querySelectorAll('.item-card');
        cards.forEach((card, i) => {
            const idx = i + 1;
            const titleInput = card.querySelector('.item-title-input');
            if (titleInput) titleInput.value = `${currentPrefix}${idx}`;
        });
    });

    // ─── Sticky Settings Bar Observer ───
    const settingsAnchor = document.getElementById('settingsAnchor');
    const settingsBar = document.getElementById('settingsBar');

    if (settingsAnchor && settingsBar) {
        let stuckDebounce = null;
        const observer = new IntersectionObserver(
            ([e]) => {
                clearTimeout(stuckDebounce);
                const shouldStick = e.boundingClientRect.top < 21;
                stuckDebounce = setTimeout(() => {
                    if (shouldStick) {
                        settingsBar.classList.add('stuck');
                        settingsBar.classList.remove('collapsed');
                    } else {
                        settingsBar.classList.remove('stuck');
                        // If it wasn't expanded while stuck, return to collapsed state at top
                        if (!settingsBar.classList.contains('expanded')) {
                            settingsBar.classList.add('collapsed');
                        }
                        settingsBar.classList.remove('expanded');
                    }
                }, 50);
            },
            { threshold: [1], rootMargin: "-21px 0px 0px 0px" }
        );
        observer.observe(settingsAnchor);
    }

    // Toggle settings expansion when stuck
    const settingsToggleBtn = document.getElementById('settingsToggleBtn');
    let isToggling = false; // Flag to prevent scroll jumping from triggering collapse

    const toggleSettings = (e) => {
        if (e) e.stopPropagation();
        isToggling = true;
        if (settingsBar.classList.contains('stuck')) {
            settingsBar.classList.toggle('expanded');
        } else {
            settingsBar.classList.toggle('collapsed');
        }
        setTimeout(() => {
            isToggling = false;
        }, 400);
    };

    if (settingsToggleBtn) {
        settingsToggleBtn.addEventListener('click', toggleSettings);
    }

    if (settingsBar) {
        settingsBar.addEventListener('click', (e) => {
            const isCollapsed = settingsBar.classList.contains('collapsed');
            const isCompactStuck = settingsBar.classList.contains('stuck') && !settingsBar.classList.contains('expanded');
            if (isCollapsed || isCompactStuck) {
                toggleSettings(e);
            }
        });
    }

    // Auto-collapse on scroll (with threshold to prevent layout shift glitches)
    let expandScrollY = 0;
    window.addEventListener('scroll', () => {
        if (isToggling) {
            expandScrollY = window.scrollY;
            return;
        }

        if (settingsBar.classList.contains('expanded')) {
            const delta = Math.abs(window.scrollY - expandScrollY);
            if (delta > 20) { // Only collapse if they actually scrolled a bit
                settingsBar.classList.remove('expanded');
            }
        }
    });

    // Auto-collapse on clicking outside
    document.addEventListener('click', (e) => {
        if (settingsBar.classList.contains('expanded') && !settingsBar.contains(e.target)) {
            settingsBar.classList.remove('expanded');
        }
    });

    // Snake Game Toggle
    if (snakeToggle) {
        snakeToggle.addEventListener('click', () => {
            isSnakeEnabled = !isSnakeEnabled;
            snakeToggle.classList.toggle('off', !isSnakeEnabled);
            localStorage.setItem('spritecut_snake_enabled', isSnakeEnabled);
            if (isSnakeEnabled) {
                initBackground();
            }
        });
    }

    // Apply persisted shadow settings
    const savedShadowEnabled = localStorage.getItem('spritecut_shadow_enabled') === 'true';
    const savedShadowColorVal = localStorage.getItem('spritecut_shadow_color') || '#000000';
    const savedShadowOpacity = localStorage.getItem('spritecut_shadow_opacity') || '60';
    const savedShadowAngle = localStorage.getItem('spritecut_shadow_angle') || '135';
    const savedShadowDistance = localStorage.getItem('spritecut_shadow_distance') || '8';
    const savedShadowSpread = localStorage.getItem('spritecut_shadow_spread') || '0';
    const savedShadowSize = localStorage.getItem('spritecut_shadow_size') || '10';

    // Apply persisted export size
    const savedExportSize = localStorage.getItem('spritecut_export_size') || '256';
    exportSizeSelect.value = savedExportSize;

    // Apply persisted remove bg toggle
    const savedRemoveBg = localStorage.getItem('spritecut_remove_bg');
    if (savedRemoveBg !== null) {
        removeBgToggle.checked = savedRemoveBg === 'true';
    }

    // Apply persisted padding
    const savedPadding = localStorage.getItem('spritecut_padding') || '10';
    if (paddingSlider) {
        paddingSlider.value = savedPadding;
        const paddingValue = document.getElementById('paddingValue');
        if (paddingValue) paddingValue.innerText = savedPadding + '%';
        paddingSlider.addEventListener('input', () => {
            if (paddingValue) paddingValue.innerText = paddingSlider.value + '%';
            localStorage.setItem('spritecut_padding', paddingSlider.value);

            // Redraw existing canvases dynamically without full file re-processing
            const cards = resultsDiv.querySelectorAll('.item-card');
            cards.forEach(card => {
                if (card._sourceCanvas && card._sourceCtx && card._region) {
                    const newCanvas = extractItemToCanvas(card._sourceCanvas, card._sourceCtx, card._region, currentQuality);
                    if (newCanvas && card._mainCanvas) {
                        // Apply filters to new canvas
                        newCanvas.style.filter = card._mainCanvas.style.filter;

                        // Replace in DOM
                        card._mainCanvas.parentNode.replaceChild(newCanvas, card._mainCanvas);

                        // Update references
                        const idx = finalCanvases.indexOf(card._mainCanvas);
                        if (idx > -1) finalCanvases[idx] = newCanvas;
                        card._mainCanvas = newCanvas;

                        // Re-bind click to copy
                        newCanvas.parentNode.addEventListener('click', () => {
                            copyToClipboard(newCanvas);
                        });
                    }
                }
            });
        });
    }

    shadowToggle.checked = savedShadowEnabled;
    shadowColor.value = savedShadowColorVal;
    shadowOpacity.value = savedShadowOpacity;
    shadowAngle.value = savedShadowAngle;
    shadowDistance.value = savedShadowDistance;
    shadowSpread.value = savedShadowSpread;
    shadowSize.value = savedShadowSize;

    // Update value labels
    document.getElementById('shadowOpacityVal').value = savedShadowOpacity;
    document.getElementById('shadowAngleVal').value = savedShadowAngle;
    document.getElementById('shadowDistanceVal').value = savedShadowDistance;
    document.getElementById('shadowSpreadVal').value = savedShadowSpread;
    document.getElementById('shadowSizeVal').value = savedShadowSize;

    // Enable/disable all sub-controls
    const allShadowInputs = shadowSubControls.querySelectorAll('input');
    allShadowInputs.forEach(inp => inp.disabled = !savedShadowEnabled);

    // Apply persisted quality
    qualityToggle.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.dataset.quality === currentQuality);
    });

    // Apply persisted theme
    const savedTheme = localStorage.getItem('spritecut_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.innerText = savedTheme === 'light' ? '☀️' : '🌙';

    // ─── Theme Toggle ───
    themeToggle.addEventListener('click', () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const newTheme = isLight ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('spritecut_theme', newTheme);
        themeToggle.innerText = newTheme === 'light' ? '☀️' : '🌙';
    });

    // ─── Help Modal Logic ───
    if (helpBtn && helpModal) {
        helpBtn.addEventListener('click', () => {
            helpModal.classList.add('visible');
            if (window.clarity) clarity("event", "open_help");
        });

        const hideModal = () => helpModal.classList.remove('visible');
        closeModal.addEventListener('click', hideModal);
        gotItBtn.addEventListener('click', hideModal);
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) hideModal();
        });
    }

    // ─── Report Modal Logic ───
    if (reportLink && reportModal) {
        const showReport = (e) => {
            if (e) e.preventDefault();
            reportModal.classList.add('visible');
            if (window.clarity) clarity("event", "open_report");
        };
        const hideReport = () => reportModal.classList.remove('visible');

        reportLink.addEventListener('click', showReport);
        closeReportModal.addEventListener('click', hideReport);
        reportModal.addEventListener('click', (e) => {
            if (e.target === reportModal) hideReport();
        });

        // Delegate listener for the dynamic "Detection failed" link
        progressMsg.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'failReportLink') {
                showReport(e);
            }
        });
    }

    // ─── Quality Toggle ───
    qualityToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        qualityToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentQuality = btn.dataset.quality;
        localStorage.setItem('spritecut_quality', currentQuality);
        if (currentFiles.length > 0) processAllFiles(currentFiles);
    });

    // ─── Background Toggles ───
    bgToggles.addEventListener('click', (e) => {
        const swatch = e.target.closest('.bg-swatch');
        if (!swatch) return;

        bgToggles.querySelectorAll('.bg-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');

        const type = swatch.dataset.bg;
        const colorMap = {
            checkered: '',
            black: '#000',
            white: '#fff',
            green: '#00ff00'
        };

        const canvasContainers = resultsDiv.querySelectorAll('.canvas-container');
        canvasContainers.forEach(container => {
            if (type === 'checkered') {
                container.style.background = '';
            } else {
                container.style.background = colorMap[type];
            }
        });
    });

    // ─── Shadow Controls ───
    function hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    }

    function getShadowParams() {
        const color = hexToRgb(shadowColor.value);
        const opacity = parseInt(shadowOpacity.value, 10) / 100;
        const angleDeg = parseInt(shadowAngle.value, 10);
        const distance = parseInt(shadowDistance.value, 10);
        const spread = parseInt(shadowSpread.value, 10);
        const size = parseInt(shadowSize.value, 10);

        // Convert angle to offset (Photoshop: 0° = right, goes counter-clockwise; CSS: we use standard math)
        const angleRad = (angleDeg * Math.PI) / 180;
        const offsetX = Math.round(Math.cos(angleRad) * distance);
        const offsetY = Math.round(Math.sin(angleRad) * distance);

        return { color, opacity, angleDeg, distance, spread, size, offsetX, offsetY };
    }

    function updateShadowVisuals() {
        const isEnabled = shadowToggle.checked;

        let filterString = 'none';
        if (isEnabled) {
            const p = getShadowParams();
            // CSS drop-shadow doesn't support spread, so we just use offset + blur + color
            const blurVal = Math.max(p.size, 0);
            filterString = `drop-shadow(${p.offsetX}px ${p.offsetY}px ${blurVal}px rgba(${p.color.r},${p.color.g},${p.color.b},${p.opacity}))`;
        }

        // Update all canvases on screen instantly
        finalCanvases.forEach(canvas => {
            canvas.style.filter = filterString;
        });
    }

    function setShadowControlsEnabled(enabled) {
        const allShadowInputs = shadowSubControls.querySelectorAll('input');
        allShadowInputs.forEach(inp => inp.disabled = !enabled);
    }

    shadowToggle.addEventListener('change', () => {
        const isEnabled = shadowToggle.checked;
        setShadowControlsEnabled(isEnabled);
        localStorage.setItem('spritecut_shadow_enabled', isEnabled);
        updateShadowVisuals();
    });

    // Individual control listeners with bidirectional sync
    shadowColor.addEventListener('input', () => {
        localStorage.setItem('spritecut_shadow_color', shadowColor.value);
        updateShadowVisuals();
    });

    function syncSliderAndInput(slider, input, storageKey) {
        slider.addEventListener('input', () => {
            input.value = slider.value;
            localStorage.setItem(storageKey, slider.value);
            updateShadowVisuals();
        });
        input.addEventListener('input', () => {
            let val = parseInt(input.value, 10);
            if (isNaN(val)) return;
            val = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), val));
            slider.value = val;
            input.value = val;
            localStorage.setItem(storageKey, val);
            updateShadowVisuals();
        });
    }

    syncSliderAndInput(shadowOpacity, document.getElementById('shadowOpacityVal'), 'spritecut_shadow_opacity');
    syncSliderAndInput(shadowAngle, document.getElementById('shadowAngleVal'), 'spritecut_shadow_angle');
    syncSliderAndInput(shadowDistance, document.getElementById('shadowDistanceVal'), 'spritecut_shadow_distance');
    syncSliderAndInput(shadowSpread, document.getElementById('shadowSpreadVal'), 'spritecut_shadow_spread');
    syncSliderAndInput(shadowSize, document.getElementById('shadowSizeVal'), 'spritecut_shadow_size');

    // ─── Settings Auto-Update ───
    removeBgToggle.addEventListener('change', () => {
        localStorage.setItem('spritecut_remove_bg', removeBgToggle.checked);
        if (currentFiles.length > 0) {
            processAllFiles(currentFiles);
        }
    });

    itemCountToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        // If clicking the custom button
        if (btn === itemCountCustomBtn) {
            itemCountToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            itemCountCustomBtn.style.display = 'none';
            itemCountManual.style.display = 'inline-block';
            itemCountManual.focus();
            return;
        }

        // Standard preset button
        itemCountToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Hide manual input if visible
        itemCountManual.style.display = 'none';
        itemCountCustomBtn.style.display = 'inline-block';

        if (currentFiles.length > 0) {
            processAllFiles(currentFiles);
        }
    });

    itemCountManual.addEventListener('change', () => {
        if (currentFiles.length > 0) {
            processAllFiles(currentFiles);
        }
    });

    itemCountManual.addEventListener('blur', () => {
        if (itemCountManual.value === '') {
            itemCountManual.style.display = 'none';
            itemCountCustomBtn.style.display = 'inline-block';
        }
    });

    exportSizeSelect.addEventListener('change', () => {
        localStorage.setItem('spritecut_export_size', exportSizeSelect.value);
        if (currentFiles.length > 0) {
            processAllFiles(currentFiles);
        }
    });

    // ─── Drag & Drop ───
    uploadZone.addEventListener('click', () => imageUpload.click());

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });

    // ─── Dynamic Mouse-Tracking Glow ───
    let glowTargetX = 0, glowTargetY = 0;
    let glowCurrentX = 0, glowCurrentY = 0;
    let isGlowAnimating = false;

    function animateGlow() {
        // Lerp factor (lower is smoother/more delayed, e.g., 0.08)
        const lerpFactor = 0.08;
        glowCurrentX += (glowTargetX - glowCurrentX) * lerpFactor;
        glowCurrentY += (glowTargetY - glowCurrentY) * lerpFactor;

        uploadZone.style.setProperty('--x', `${glowCurrentX}px`);
        uploadZone.style.setProperty('--y', `${glowCurrentY}px`);

        if (Math.abs(glowTargetX - glowCurrentX) > 0.5 || Math.abs(glowTargetY - glowCurrentY) > 0.5) {
            requestAnimationFrame(animateGlow);
        } else {
            isGlowAnimating = false;
        }
    }

    uploadZone.addEventListener('mouseenter', (e) => {
        const rect = uploadZone.getBoundingClientRect();
        // Snap to initial position on enter so it doesn't fly in from 0,0
        glowCurrentX = glowTargetX = e.clientX - rect.left;
        glowCurrentY = glowTargetY = e.clientY - rect.top;
        uploadZone.style.setProperty('--x', `${glowCurrentX}px`);
        uploadZone.style.setProperty('--y', `${glowCurrentY}px`);
    });

    uploadZone.addEventListener('mousemove', (e) => {
        const rect = uploadZone.getBoundingClientRect();
        glowTargetX = e.clientX - rect.left;
        glowTargetY = e.clientY - rect.top;

        if (!isGlowAnimating) {
            isGlowAnimating = true;
            requestAnimationFrame(animateGlow);
        }
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            currentFiles = files;
            processAllFiles(files);
        }
    });

    imageUpload.addEventListener('change', (e) => {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            currentFiles = files;
            processAllFiles(files);
        }
    });

    // ─── Clipboard Paste (Ctrl+V) ───
    window.addEventListener('paste', (e) => {
        const items = e.clipboardData.items;
        const files = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                files.push(file);
            }
        }
        if (files.length > 0) {
            currentFiles = files;
            processAllFiles(files);
            showToast("📸 Processing pasted image...");
        }
    });

    // ─── Reset ───
    resetBtn.addEventListener('click', () => {
        resultsDiv.innerHTML = '';
        finalCanvases = [];
        currentFiles = [];
        previewStrip.innerHTML = '';
        previewSection.classList.remove('visible');
        progressSection.classList.remove('visible');
        downloadAllSection.classList.remove('visible');
        resetSection.classList.remove('visible');
        bgToggles.style.display = 'none';
        uploadZone.style.display = '';
        progressMsg.className = 'progress-message';
        steps.forEach(s => { s.classList.remove('active', 'done'); });
        connectors.forEach(c => c.classList.remove('done'));
        imageUpload.value = '';
        
        // Reset Item Count
        itemCountToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        itemCountToggle.querySelector('[data-value="auto"]').classList.add('active');
        itemCountManual.value = '';
        itemCountManual.style.display = 'none';
        itemCountCustomBtn.style.display = 'inline-block';

        if (window.clarity) clarity("event", "reset_workspace");
    });

    // ─── Bake Shadow function for Downloads ───
    function bakeShadowToCanvas(sourceCanvas) {
        const isEnabled = shadowToggle.checked;
        if (!isEnabled) return sourceCanvas; // Return original if no shadow

        const p = getShadowParams();

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sourceCanvas.width;
        tempCanvas.height = sourceCanvas.height;
        const ctx = tempCanvas.getContext('2d');

        // Setup shadow using all parameters
        ctx.shadowColor = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.opacity})`;
        ctx.shadowBlur = p.size;
        ctx.shadowOffsetX = p.offsetX;
        ctx.shadowOffsetY = p.offsetY;

        // Simulate spread by drawing shadow multiple times with decreasing blur
        if (p.spread > 0) {
            const passes = Math.ceil(p.spread / 20); // 1-5 extra passes
            for (let i = 0; i < passes; i++) {
                ctx.shadowBlur = Math.max(p.size - (i * 2), 1);
                ctx.drawImage(sourceCanvas, 0, 0);
            }
        }

        // Final draw with full settings
        ctx.shadowBlur = p.size;
        ctx.drawImage(sourceCanvas, 0, 0);
        return tempCanvas;
    }

    downloadAllBtn.addEventListener('click', async () => {
        const originalText = downloadAllBtn.innerHTML;
        downloadAllBtn.disabled = true;
        downloadAllBtn.innerHTML = '<span class="spinner"></span> Packing ZIP...';

        try {
            const zip = new JSZip();
            const cards = Array.from(resultsDiv.querySelectorAll('.item-card'));
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                if (!card._mainCanvas) continue;
                const titleInput = card.querySelector('.item-title-input');
                const filename = titleInput ? titleInput.value : `${currentPrefix}${i + 1}`;
                const bakedCanvas = bakeShadowToCanvas(card._mainCanvas);
                const dataUrl = bakedCanvas.toDataURL('image/png');
                const base64 = dataUrl.split(',')[1];
                zip.file(`${filename}.png`, base64, { base64: true });
            }
            const blob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${currentPrefix}pack.zip`;
            link.click();
            URL.revokeObjectURL(link.href);
        } finally {
            if (window.clarity) clarity("event", "download_all");
            downloadAllBtn.disabled = false;
            downloadAllBtn.innerHTML = originalText;
        }
    });

    // ─── Progress helpers ───
    function setStep(stepIndex, state) {
        if (state === 'active') {
            steps[stepIndex].classList.add('active');
            steps[stepIndex].classList.remove('done');
        } else if (state === 'done') {
            steps[stepIndex].classList.remove('active');
            steps[stepIndex].classList.add('done');
            if (stepIndex < connectors.length) connectors[stepIndex].classList.add('done');
        }
    }

    function resetSteps() {
        steps.forEach(s => s.classList.remove('active', 'done'));
        connectors.forEach(c => c.classList.remove('done'));
    }

    function showMsg(msg, isError = false) {
        progressMsg.innerHTML = msg;
        progressMsg.className = isError ? 'progress-message error' : 'progress-message';
    }

    function updateProgressBar(percent) {
        if (progressBarFill) {
            progressBarFill.style.width = `${percent}%`;
        }
    }

    function showToast(text) {
        toast.innerText = text;
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 2000);
    }

    async function copyToClipboard(canvas) {
        try {
            const bakedCanvas = bakeShadowToCanvas(canvas);
            const blob = await new Promise(resolve => bakedCanvas.toBlob(resolve));
            const item = new ClipboardItem({ [blob.type]: blob });
            await navigator.clipboard.write([item]);
            if (window.clarity) clarity("event", "copy_item");
            showToast("✨ Item copied to clipboard!");
        } catch (err) {
            console.error("Clipboard Error:", err);
            showToast("❌ Failed to copy image");
        }
    }

    // ─── Transparency detection ───
    function isAlreadyTransparent(imageData) {
        const data = imageData.data;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 255) return true;
        }
        return false;
    }

    // ─── Bounding box finder ───
    function getBoundingBox(imageData, width, height) {
        const data = imageData.data;
        let minX = width, minY = height, maxX = 0, maxY = 0;
        let found = false;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const alpha = data[(y * width + x) * 4 + 3];
                if (alpha > 0) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    found = true;
                }
            }
        }

        if (!found) return null;
        return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    }

    // ─── True 2D Connected Components Detection (Flood Fill) ───
    function findItemRegions(imageData, width, height, targetCountStr) {
        const data = imageData.data;
        const visited = new Uint8Array(width * height);
        const components = [];

        const isOpaque = (idx) => data[idx * 4 + 3] > 0;

        // Iterative flood fill
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (!visited[idx] && isOpaque(idx)) {
                    let minX = width, minY = height, maxX = 0, maxY = 0;
                    let pixelCount = 0;

                    const stack = [idx];
                    visited[idx] = 1;

                    while (stack.length > 0) {
                        const curr = stack.pop();
                        const cx = curr % width;
                        const cy = Math.floor(curr / width);

                        if (cx < minX) minX = cx;
                        if (cx > maxX) maxX = cx;
                        if (cy < minY) minY = cy;
                        if (cy > maxY) maxY = cy;
                        pixelCount++;

                        const neighbors = [
                            curr - width,
                            curr + width,
                            curr - 1,
                            curr + 1
                        ];

                        for (const n of neighbors) {
                            if (n >= 0 && n < width * height && !visited[n]) {
                                const nx = n % width;
                                if ((curr % width === 0 && nx === width - 1) || (curr % width === width - 1 && nx === 0)) {
                                    continue;
                                }
                                if (isOpaque(n)) {
                                    visited[n] = 1;
                                    stack.push(n);
                                }
                            }
                        }
                    }

                    if (pixelCount > 50 && (pixelCount / (width * height)) > 0.001) {
                        components.push({
                            x: minX,
                            y: minY,
                            width: maxX - minX + 1,
                            height: maxY - minY + 1,
                            pixelCount: pixelCount
                        });
                    }
                }
            }
        }

        // Sort by X then Y for logical reading order
        components.sort((a, b) => {
            if (Math.abs(a.y - b.y) < height * 0.1) {
                return a.x - b.x;
            }
            return a.y - b.y;
        });

        if (components.length === 0) return [];
        if (targetCountStr === 'auto') return components;

        const targetCount = parseInt(targetCountStr, 10);
        if (isNaN(targetCount)) return components;

        if (components.length === targetCount) return components;

        // Merge closest components if too many
        while (components.length > targetCount) {
            let minDist = Infinity;
            let mergeI = -1;
            let mergeJ = -1;

            for (let i = 0; i < components.length; i++) {
                for (let j = i + 1; j < components.length; j++) {
                    const c1 = components[i];
                    const c2 = components[j];

                    const cx1 = c1.x + c1.width / 2;
                    const cy1 = c1.y + c1.height / 2;
                    const cx2 = c2.x + c2.width / 2;
                    const cy2 = c2.y + c2.height / 2;
                    const dist = Math.sqrt((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2);

                    if (dist < minDist) {
                        minDist = dist;
                        mergeI = i;
                        mergeJ = j;
                    }
                }
            }

            const c1 = components[mergeI];
            const c2 = components[mergeJ];
            const nx = Math.min(c1.x, c2.x);
            const ny = Math.min(c1.y, c2.y);
            const nMaxX = Math.max(c1.x + c1.width, c2.x + c2.width);
            const nMaxY = Math.max(c1.y + c1.height, c2.y + c2.height);

            components[mergeI] = {
                x: nx,
                y: ny,
                width: nMaxX - nx,
                height: nMaxY - ny,
                pixelCount: c1.pixelCount + c2.pixelCount
            };

            components.splice(mergeJ, 1);
        }

        // Split largest component if too few
        while (components.length < targetCount) {
            let largestIdx = 0;
            let maxArea = 0;
            for (let i = 0; i < components.length; i++) {
                const area = components[i].width * components[i].height;
                if (area > maxArea) {
                    maxArea = area;
                    largestIdx = i;
                }
            }

            const toSplit = components[largestIdx];

            if (toSplit.width > toSplit.height) {
                const half1Width = Math.floor(toSplit.width / 2);
                const r1 = { x: toSplit.x, y: toSplit.y, width: half1Width, height: toSplit.height };
                const r2 = { x: toSplit.x + half1Width, y: toSplit.y, width: toSplit.width - half1Width, height: toSplit.height };
                components.splice(largestIdx, 1, r1, r2);
            } else {
                const half1Height = Math.floor(toSplit.height / 2);
                const r1 = { x: toSplit.x, y: toSplit.y, width: toSplit.width, height: half1Height };
                const r2 = { x: toSplit.x, y: toSplit.y + half1Height, width: toSplit.width, height: toSplit.height - half1Height };
                components.splice(largestIdx, 1, r1, r2);
            }
        }

        return components;
    }


    // ─── Build canvas from a 2D bounding box ───
    function extractItemToCanvas(sourceCanvas, sourceCtx, region, quality) {
        if (!region) return null;

        const sizeSetting = document.getElementById('exportSizeSelect').value;
        const isExact = sizeSetting === 'exact';
        const targetSize = isExact ? 0 : parseInt(sizeSetting, 10);

        const finalCanvas = document.createElement('canvas');
        if (isExact) {
            finalCanvas.width = region.width;
            finalCanvas.height = region.height;
        } else {
            finalCanvas.width = targetSize;
            finalCanvas.height = targetSize;
        }

        const finalCtx = finalCanvas.getContext('2d');

        if (quality === 'off') {
            finalCtx.imageSmoothingEnabled = false;
        } else {
            finalCtx.imageSmoothingEnabled = true;
            finalCtx.imageSmoothingQuality = quality;
        }

        const itemCanvas = document.createElement('canvas');
        itemCanvas.width = region.width;
        itemCanvas.height = region.height;
        const itemCtx = itemCanvas.getContext('2d');
        itemCtx.putImageData(
            sourceCtx.getImageData(region.x, region.y, region.width, region.height),
            0, 0
        );

        if (isExact) {
            // Draw without scaling or padding
            finalCtx.drawImage(itemCanvas, 0, 0);
        } else {
            // Scale and center into the target resolution based on padding slider
            const paddingSlider = document.getElementById('paddingSlider');
            const paddingPct = paddingSlider ? parseInt(paddingSlider.value, 10) : 10;
            const scaleFactor = 1 - ((paddingPct * 2) / 100);
            const maxFit = targetSize * (scaleFactor > 0 ? scaleFactor : 0.1);
            const scale = Math.min(maxFit / region.width, maxFit / region.height);
            // If the item is very small, we might not want to blur it up too much.
            // But it's usually preferred to unify sizing. Check quality setting to determine if we allow upscale blurring.
            let effectiveScale = quality === 'off' ? Math.ceil(scale) : scale;
            if (quality === 'off' && effectiveScale > scale) effectiveScale = Math.floor(scale);
            if (effectiveScale < 1 && quality === 'off') effectiveScale = 1; // Basic pixel perfect rounding fallback
            if (quality !== 'off') effectiveScale = scale;

            const newW = region.width * effectiveScale;
            const newH = region.height * effectiveScale;
            const dx = (targetSize - newW) / 2;
            const dy = (targetSize - newH) / 2;

            finalCtx.drawImage(itemCanvas, 0, 0, region.width, region.height, dx, dy, newW, newH);
        }
        return finalCanvas;
    }

    // ─── Create Individual Item Card ───
    function createItemCard(sourceCanvas, sourceCtx, region, globalIndex, imageGroup) {
        if (region.width < 10 || region.height < 10) return false;
        const card = document.createElement('div');
        card.className = 'item-card';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-item-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Remove from export';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            const index = finalCanvases.indexOf(card._mainCanvas);
            if (index > -1) finalCanvases.splice(index, 1);
            card.remove();
        };
        card.appendChild(deleteBtn);

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'item-title-input';
        titleInput.value = `${currentPrefix}${globalIndex}`;
        titleInput.onclick = (e) => e.stopPropagation();
        card.appendChild(titleInput);

        const mainCanvas = extractItemToCanvas(sourceCanvas, sourceCtx, region, currentQuality);
        if (!mainCanvas) return false;

        // Click-to-copy wrapper
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'canvas-container';
        const copyOverlay = document.createElement('div');
        copyOverlay.className = 'copy-overlay';
        copyOverlay.innerText = '📋 Click to Copy';

        canvasContainer.appendChild(copyOverlay);
        canvasContainer.appendChild(mainCanvas);

        canvasContainer.addEventListener('click', () => {
            copyToClipboard(mainCanvas);
        });

        card.appendChild(canvasContainer);

        // Animation delay for staggering
        card.style.animationDelay = `${(globalIndex % 6) * 0.1}s`;

        // Apply initial visual shadow state
        if (shadowToggle.checked) {
            const p = getShadowParams();
            const blurVal = Math.max(p.size, 0);
            mainCanvas.style.filter = `drop-shadow(${p.offsetX}px ${p.offsetY}px ${blurVal}px rgba(${p.color.r},${p.color.g},${p.color.b},${p.opacity}))`;
        } else {
            mainCanvas.style.filter = 'none';
        }

        // Download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';
        downloadBtn.innerHTML = '📥 Download PNG';
        downloadBtn.onclick = () => {
            const bakedCanvas = bakeShadowToCanvas(mainCanvas);
            const link = document.createElement('a');
            link.download = `${titleInput.value}.png`;
            link.href = bakedCanvas.toDataURL('image/png');
            link.click();
        };
        card.appendChild(downloadBtn);

        // Store internal data for dynamic redrawing
        card._sourceCanvas = sourceCanvas;
        card._sourceCtx = sourceCtx;
        card._region = region;

        // Store canvas ref for reactive updates
        card._mainCanvas = mainCanvas;

        imageGroup.appendChild(card);
        finalCanvases.push(mainCanvas);

        // Apply background from current active toggle to the CONTAINER, not the canvas
        const activeSwatch = bgToggles.querySelector('.bg-swatch.active');
        if (activeSwatch && activeSwatch.dataset.bg !== 'checkered') {
            const colorMap = { black: '#000', white: '#fff', green: '#00ff00' };
            canvasContainer.style.background = colorMap[activeSwatch.dataset.bg];
        }

        return true;
    }

    // ─── Process all files sequentially ───
    async function processAllFiles(files) {
        if (window.clarity) clarity("event", "process_start");
        resultsDiv.innerHTML = '';
        finalCanvases = [];
        previewStrip.innerHTML = '';
        downloadAllSection.classList.remove('visible');
        resetSection.classList.remove('visible');

        const thumbs = [];
        for (const file of files) {
            const url = URL.createObjectURL(file);
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.className = 'preview-thumb';
            thumb.alt = file.name;
            previewStrip.appendChild(thumb);
            thumbs.push(thumb);
        }
        previewSection.classList.add('visible');
        bgToggles.style.display = 'flex';

        uploadZone.style.display = 'none';
        progressSection.classList.add('visible');

        let globalItemCount = 0;

        for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
            const file = files[fileIdx];

            thumbs.forEach(t => t.classList.remove('processing'));
            thumbs[fileIdx].classList.add('processing');

            let imageGroup = null;

            if (files.length > 0) {
                const header = document.createElement('div');
                header.className = 'image-group-header';
                // Only show "1 of X" if there are multiple images uploaded
                if (files.length > 1) {
                    header.innerHTML = `<h3>📷 Image ${fileIdx + 1} of ${files.length}</h3>`;
                } else {
                    header.innerHTML = `<h3>📷 Extracted Items</h3>`;
                }
                resultsDiv.appendChild(header);

                imageGroup = document.createElement('div');
                imageGroup.className = 'image-group';

                // Add the source image container
                const sourceContainer = document.createElement('div');
                sourceContainer.className = 'source-container';
                const sourceImg = document.createElement('img');
                sourceImg.src = URL.createObjectURL(file);
                sourceImg.className = 'source-thumb';
                const sourceLabel = document.createElement('div');
                sourceLabel.className = 'source-label';
                sourceLabel.innerText = 'Original';
                sourceContainer.appendChild(sourceImg);
                sourceContainer.appendChild(sourceLabel);

                const arrow = document.createElement('div');
                arrow.className = 'arrow-divider';
                arrow.innerText = '➔';

                const itemsContainer = document.createElement('div');
                itemsContainer.className = 'extracted-items';

                imageGroup.appendChild(sourceContainer);
                imageGroup.appendChild(arrow);
                imageGroup.appendChild(itemsContainer);

                // Pass the itemsContainer to processSingleFile instead of the root group
                resultsDiv.appendChild(imageGroup);
            }

            resetSteps();

            try {
                // We pass itemsContainer to be populated by createItemCard
                const itemsContainer = imageGroup ? imageGroup.querySelector('.extracted-items') : null;
                const itemsFound = await processSingleFile(file, fileIdx, files.length, itemsContainer, (count) => {
                    globalItemCount += count;
                });

                thumbs[fileIdx].classList.remove('processing');
                thumbs[fileIdx].classList.add('done');

                // Update progress bar
                const overallPercent = Math.round(((fileIdx + 1) / files.length) * 100);
                updateProgressBar(overallPercent);

            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                showMsg(`❌ Error processing ${file.name}. Continuing with remaining files...`, true);
                thumbs[fileIdx].classList.remove('processing');
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (globalItemCount === 0) {
            showMsg('❌ Detection failed? <a href="#" id="failReportLink" style="color: var(--accent-light); text-decoration: underline; cursor: pointer;">Click here to send us the image so we can fix it</a>.', true);
        } else {
            const sizeSetting = document.getElementById('exportSizeSelect').value;
            const sizeText = sizeSetting === 'exact' ? 'exact-fit' : `${sizeSetting}×${sizeSetting}`;
            showMsg(`✅ Done! Extracted <strong>${globalItemCount}</strong> item${globalItemCount > 1 ? 's' : ''} from <strong>${files.length}</strong> image${files.length > 1 ? 's' : ''} as ${sizeText} transparent PNGs.`);
            
            if (globalItemCount > 1) {
                downloadAllSection.classList.add('visible');
                downloadAllBtn.classList.add('highlight-download');
                // Remove highlight after some time or on interaction? 
                // Let's keep it until they download.
            }

            // Hide progress and preview sections to bring results to the top
            previewSection.classList.remove('visible');
            progressSection.classList.remove('visible');

            // Auto-scroll to the first result row
            setTimeout(() => {
                const firstResult = resultsDiv.querySelector('.image-group');
                if (firstResult) {
                    const y = firstResult.getBoundingClientRect().top + window.scrollY - 100; // Account for sticky settings bar
                    window.scrollTo({ top: y, behavior: 'smooth' });
                }
            }, 100);
        }
        resetSection.classList.add('visible');
    }

    // ─── Process a single file ───
    async function processSingleFile(file, fileIdx, totalFiles, imageGroup, onItemsFound) {
        const prefix = totalFiles > 1 ? `[Image ${fileIdx + 1}/${totalFiles}] ` : '';

        // Step 1: Analyze transparency
        setStep(0, 'active');
        showMsg(`<span class="spinner"></span> ${prefix}Analyzing image for transparency...`);

        const previewUrl = URL.createObjectURL(file);
        const img = new Image();
        img.src = previewUrl;
        await new Promise(resolve => img.onload = resolve);

        const analyzeCanvas = document.createElement('canvas');
        analyzeCanvas.width = img.width;
        analyzeCanvas.height = img.height;
        const analyzeCtx = analyzeCanvas.getContext('2d', { willReadFrequently: true });
        analyzeCtx.drawImage(img, 0, 0);
        const fullData = analyzeCtx.getImageData(0, 0, img.width, img.height);

        const alreadyTransparent = isAlreadyTransparent(fullData);
        setStep(0, 'done');

        // Step 2: Background removal (if needed)
        setStep(1, 'active');
        let processedImg;

        if (!removeBgToggle.checked) {
            showMsg(`✅ ${prefix}Background removal disabled, skipping...`);
            processedImg = img;
            await new Promise(r => setTimeout(r, 400));
        } else if (alreadyTransparent) {
            showMsg(`✅ ${prefix}Image already has transparency — skipping background removal!`);
            processedImg = img;
            await new Promise(r => setTimeout(r, 400));
        } else {
            showMsg(`<span class="spinner"></span> ${prefix}Removing background with AI...`);
            const imageUrl = URL.createObjectURL(file);
            const blob = await imglyRemoveBackground(imageUrl, {
                progress: (key, current, total) => {
                    if (key === 'compute:inference') return;
                    const percent = Math.round((current / total) * 100) || 0;
                    showMsg(`<span class="spinner"></span> ${prefix}Loading AI model... ${percent}%`);
                }
            });
            const bgUrl = URL.createObjectURL(blob);
            processedImg = new Image();
            processedImg.src = bgUrl;
            await new Promise(resolve => processedImg.onload = resolve);
            URL.revokeObjectURL(imageUrl);
        }

        setStep(1, 'done');

        // Step 3: Split items
        setStep(2, 'active');
        showMsg(`<span class="spinner"></span> ${prefix}Detecting and splitting items...`);

        const mainCanvas = document.createElement('canvas');
        mainCanvas.width = processedImg.width;
        mainCanvas.height = processedImg.height;
        const mainCtx = mainCanvas.getContext('2d', { willReadFrequently: true });
        mainCtx.drawImage(processedImg, 0, 0);

        const mainData = mainCtx.getImageData(0, 0, processedImg.width, processedImg.height);
        
        // Get target count from new UI
        let targetCountStr = 'auto';
        const activeBtn = itemCountToggle.querySelector('button.active');
        if (activeBtn) {
            targetCountStr = activeBtn.dataset.value || 'auto';
        } else if (itemCountManual.style.display !== 'none' && itemCountManual.value) {
            targetCountStr = itemCountManual.value;
        }

        const regions = findItemRegions(mainData, processedImg.width, processedImg.height, targetCountStr);

        let itemCount = 0;
        const startIndex = finalCanvases.length;
        for (let i = 0; i < regions.length; i++) {
            const success = createItemCard(mainCanvas, mainCtx, regions[i], startIndex + itemCount + 1, imageGroup);
            if (success) itemCount++;
        }

        setStep(2, 'done');
        onItemsFound(itemCount);

        URL.revokeObjectURL(previewUrl);
        return itemCount;
    }



})();
