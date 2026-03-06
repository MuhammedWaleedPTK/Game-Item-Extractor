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
    const itemCountSelect = document.getElementById('itemCountSelect');
    const themeToggle = document.getElementById('themeToggle');
    const prefixInput = document.getElementById('prefixInput');
    const bgToggles = document.getElementById('bgToggles');
    const toast = document.getElementById('toast');
    const bgCanvas = document.getElementById('bgCanvas');
    const exportSizeSelect = document.getElementById('exportSizeSelect');
    const shadowToggle = document.getElementById('shadowToggle');
    const shadowDirection = document.getElementById('shadowDirection');
    const shadowSlider = document.getElementById('shadowSlider');
    const paddingSlider = document.getElementById('paddingSlider');
    const steps = [document.getElementById('step1'), document.getElementById('step2'), document.getElementById('step3')];
    const connectors = [document.getElementById('conn1'), document.getElementById('conn2')];

    // ─── Interactive Background ───
    const bgCtx = bgCanvas.getContext('2d');
    let particles = [];
    let mouse = { x: null, y: null, radius: 150 };

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.x;
        mouse.y = e.y;
    });

    class Particle {
        constructor() {
            this.x = Math.random() * bgCanvas.width;
            this.y = Math.random() * bgCanvas.height;
            this.size = Math.random() * 2 + 1;
            this.speedX = Math.random() * 1 - 0.5;
            this.speedY = Math.random() * 1 - 0.5;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            if (this.x > bgCanvas.width) this.x = 0;
            else if (this.x < 0) this.x = bgCanvas.width;
            if (this.y > bgCanvas.height) this.y = 0;
            else if (this.y < 0) this.y = bgCanvas.height;

            // Mouse interaction
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < mouse.radius) {
                if (mouse.x < this.x && this.x < bgCanvas.width - 50) this.x += 2;
                if (mouse.x > this.x && this.x > 50) this.x -= 2;
                if (mouse.y < this.y && this.y < bgCanvas.height - 50) this.y += 2;
                if (mouse.y > this.y && this.y > 50) this.y -= 2;
            }
        }
        draw() {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            bgCtx.fillStyle = isLight ? 'rgba(108, 92, 231, 0.4)' : 'rgba(162, 155, 254, 0.4)';
            bgCtx.beginPath();
            bgCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            bgCtx.fill();
        }
    }

    function initParticles() {
        particles = [];
        let count = (bgCanvas.width * bgCanvas.height) / 12000;
        for (let i = 0; i < count; i++) {
            particles.push(new Particle());
        }
    }

    function animateParticles() {
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();

            for (let j = i; j < particles.length; j++) {
                let dx = particles[i].x - particles[j].x;
                let dy = particles[i].y - particles[j].y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 120) {
                    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
                    bgCtx.strokeStyle = isLight ? `rgba(108, 92, 231, ${1 - distance / 120})` : `rgba(162, 155, 254, ${1 - distance / 120})`;
                    bgCtx.lineWidth = 0.5;
                    bgCtx.beginPath();
                    bgCtx.moveTo(particles[i].x, particles[i].y);
                    bgCtx.lineTo(particles[j].x, particles[j].y);
                    bgCtx.stroke();
                }
            }
        }
        requestAnimationFrame(animateParticles);
    }

    function resizeBg() {
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
        initParticles();
    }

    window.addEventListener('resize', resizeBg);
    resizeBg();
    animateParticles();

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
        const observer = new IntersectionObserver(
            ([e]) => {
                if (e.boundingClientRect.top < 21) {
                    settingsBar.classList.add('stuck');
                } else {
                    settingsBar.classList.remove('stuck');
                    settingsBar.classList.remove('expanded'); // Auto-collapse when un-sticking
                }
            },
            { threshold: [1], rootMargin: "-21px 0px 0px 0px" }
        );
        observer.observe(settingsAnchor);
    }

    // Toggle settings expansion when stuck
    const settingsToggleBtn = document.getElementById('settingsToggleBtn');
    if (settingsToggleBtn) {
        settingsToggleBtn.addEventListener('click', () => {
            if (settingsBar.classList.contains('stuck')) {
                settingsBar.classList.toggle('expanded');
            }
        });
    }

    // Apply persisted shadow settings
    const savedShadowEnabled = localStorage.getItem('spritecut_shadow_enabled') === 'true';
    const savedShadowBlur = localStorage.getItem('spritecut_shadow_blur') || '10';
    const savedShadowDir = localStorage.getItem('spritecut_shadow_dir') || 'bottom';

    // Apply persisted export size
    const savedExportSize = localStorage.getItem('spritecut_export_size') || '256';
    exportSizeSelect.value = savedExportSize;

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
    shadowSlider.value = savedShadowBlur;
    shadowDirection.value = savedShadowDir;

    shadowSlider.disabled = !savedShadowEnabled;
    shadowDirection.disabled = !savedShadowEnabled;

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

    // ─── Shadow Toggles & Slider ───
    function updateShadowVisuals() {
        const isEnabled = shadowToggle.checked;
        const blurNum = parseInt(shadowSlider.value, 10);
        const dir = shadowDirection.value;

        let filterString = 'none';
        if (isEnabled) {
            if (dir === 'bottom') {
                filterString = `drop-shadow(0px ${blurNum / 2}px ${blurNum}px rgba(0,0,0,0.6))`;
            } else {
                // Complete shadow (glow)
                filterString = `drop-shadow(0px 0px ${blurNum * 1.5}px rgba(0,0,0,0.7))`;
            }
        }

        // Update all canvases on screen instantly
        finalCanvases.forEach(canvas => {
            canvas.style.filter = filterString;
        });
    }

    shadowToggle.addEventListener('change', () => {
        const isEnabled = shadowToggle.checked;
        shadowSlider.disabled = !isEnabled;
        shadowDirection.disabled = !isEnabled;
        localStorage.setItem('spritecut_shadow_enabled', isEnabled);
        updateShadowVisuals();
    });

    shadowDirection.addEventListener('change', () => {
        localStorage.setItem('spritecut_shadow_dir', shadowDirection.value);
        updateShadowVisuals();
    });

    shadowSlider.addEventListener('input', () => {
        localStorage.setItem('spritecut_shadow_blur', shadowSlider.value);
        updateShadowVisuals();
    });

    // ─── Settings Auto-Update ───
    itemCountSelect.addEventListener('change', () => {
        if (currentFiles.length > 0) {
            processAllFiles(currentFiles);
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
        itemCountSelect.value = 'auto';
    });

    // ─── Bake Shadow function for Downloads ───
    function bakeShadowToCanvas(sourceCanvas) {
        const isEnabled = shadowToggle.checked;
        if (!isEnabled) return sourceCanvas; // Return original if no shadow

        const blurNum = parseInt(shadowSlider.value, 10);
        const dir = shadowDirection.value;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sourceCanvas.width;
        tempCanvas.height = sourceCanvas.height;
        const ctx = tempCanvas.getContext('2d');

        // Setup shadow
        if (dir === 'bottom') {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = blurNum;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = blurNum / 2;
        } else {
            // Complete glowing shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = blurNum * 1.5;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }

        // Draw image over shadow
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
            showToast("✨ Item copied to clipboard!");
        } catch (err) {
            console.error("Clipboard Error:", err);
            showToast("❌ Failed to copy image");
        }
    }

    // ─── Transparency detection ───
    function isAlreadyTransparent(imageData) {
        const data = imageData.data;
        const total = data.length / 4;
        let transparentCount = 0;
        for (let i = 0; i < total; i += 4) {
            if (data[i * 4 + 3] < 10) transparentCount++;
        }
        const ratio = transparentCount / (total / 4);
        return ratio > 0.15;
    }

    // ─── Bounding box finder ───
    function getBoundingBox(imageData, width, height) {
        const data = imageData.data;
        let minX = width, minY = height, maxX = 0, maxY = 0;
        let found = false;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const alpha = data[(y * width + x) * 4 + 3];
                if (alpha > 10) {
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

        const isOpaque = (idx) => data[idx * 4 + 3] > 10;

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
            const blurNum = parseInt(shadowSlider.value, 10);
            const dir = shadowDirection.value;
            if (dir === 'bottom') {
                mainCanvas.style.filter = `drop-shadow(0px ${blurNum / 2}px ${blurNum}px rgba(0,0,0,0.6))`;
            } else {
                mainCanvas.style.filter = `drop-shadow(0px 0px ${blurNum * 1.5}px rgba(0,0,0,0.7))`;
            }
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

        // Apply initial visual shadow state to the completely transparent canvas
        if (shadowToggle.checked) {
            const blurNum = parseInt(shadowSlider.value, 10);
            const dir = shadowDirection.value;
            if (dir === 'bottom') {
                mainCanvas.style.filter = `drop-shadow(0px ${blurNum / 2}px ${blurNum}px rgba(0,0,0,0.6))`;
            } else {
                mainCanvas.style.filter = `drop-shadow(0px 0px ${blurNum * 1.5}px rgba(0,0,0,0.7))`;
            }
        } else {
            mainCanvas.style.filter = 'none';
        }

        return true;
    }

    // ─── Process all files sequentially ───
    async function processAllFiles(files) {
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

            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                showMsg(`❌ Error processing ${file.name}. Continuing with remaining files...`, true);
                thumbs[fileIdx].classList.remove('processing');
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (globalItemCount === 0) {
            showMsg('❌ Could not detect any items in any of the uploaded images.', true);
        } else {
            const sizeSetting = document.getElementById('exportSizeSelect').value;
            const sizeText = sizeSetting === 'exact' ? 'exact-fit' : `${sizeSetting}×${sizeSetting}`;
            showMsg(`✅ Done! Extracted <strong>${globalItemCount}</strong> item${globalItemCount > 1 ? 's' : ''} from <strong>${files.length}</strong> image${files.length > 1 ? 's' : ''} as ${sizeText} transparent PNGs.`);
            if (globalItemCount > 1) downloadAllSection.classList.add('visible');

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
        const analyzeCtx = analyzeCanvas.getContext('2d');
        analyzeCtx.drawImage(img, 0, 0);
        const fullData = analyzeCtx.getImageData(0, 0, img.width, img.height);

        const alreadyTransparent = isAlreadyTransparent(fullData);
        setStep(0, 'done');

        // Step 2: Background removal (if needed)
        setStep(1, 'active');
        let processedImg;

        if (alreadyTransparent) {
            showMsg(`✅ ${prefix}Image already has transparency — skipping background removal!`);
            processedImg = img;
            await new Promise(r => setTimeout(r, 400));
        } else {
            showMsg(`<span class="spinner"></span> ${prefix}Removing background with AI...`);
            const imageUrl = URL.createObjectURL(file);
            const transparentBlob = await imglyRemoveBackground(imageUrl);
            const transparentUrl = URL.createObjectURL(transparentBlob);
            processedImg = new Image();
            processedImg.src = transparentUrl;
            await new Promise(resolve => processedImg.onload = resolve);
        }

        setStep(1, 'done');

        // Step 3: Split items
        setStep(2, 'active');
        showMsg(`<span class="spinner"></span> ${prefix}Detecting and splitting items...`);

        const mainCanvas = document.createElement('canvas');
        mainCanvas.width = processedImg.width;
        mainCanvas.height = processedImg.height;
        const mainCtx = mainCanvas.getContext('2d');
        mainCtx.drawImage(processedImg, 0, 0);

        const mainData = mainCtx.getImageData(0, 0, processedImg.width, processedImg.height);
        const targetCountStr = document.getElementById('itemCountSelect').value;
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
