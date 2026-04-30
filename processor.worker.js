/**
 * Background Worker for Image Processing
 * Offloads heavy flood-fill and region detection from the main thread.
 */

self.onmessage = function(e) {
    const { imageData, width, height, targetCountStr } = e.data;
    const regions = findItemRegions(imageData, width, height, targetCountStr);
    self.postMessage({ regions });
};

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
                            // Check boundary wrapping
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

                if (pixelCount > 5) {
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
