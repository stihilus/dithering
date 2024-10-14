// Global variables
let originalImageData;
let canvas, ctx;

const colorPalettes = {
    'bw': ['#ffffff', '#000000'],
    'obra-dinn': ['#333319', '#e5ffff'],
    'cga': ['#ffffff', '#000000', '#58FFFB', '#EF2AF8', '#58FF4E', '#EE374B', '#FDFF52'],
    'amiga': ['#000020', '#D02020', '#0050A0', '#F0F0F0', '#F08000'],
    'rgb-dither': ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000'],
    'cmyk-dither': ['#00ffff', '#ff00ff', '#ffff00', '#000000'],
    '3-bit-dither': ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'],
    'gameboy': ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
    'teletext': ['#000000', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'],
    'apple-ii': ['#000000', '#722640', '#40337f', '#e434fe', '#0e5940', '#808080', '#1b9afe', '#bfbfbf', '#404c00', '#dd6f57', '#808080', '#f1a6bf', '#1bcb01', '#bfcc80', '#85d2e3', '#ffffff'],
    'commodore-64': ['#000000', '#626262', '#898989', '#adadad', '#ffffff', '#9f4e44', '#cb7e75', '#6d5412', '#a1683c', '#c9d487', '#9ae29b', '#5cab5e', '#6abfc6', '#887ecb', '#50459b', '#a057a3'],
    'zx-spectrum': ['#000000', '#0000D7', '#D70000', '#D700D7', '#00D700', '#00D7D7', '#D7D700', '#D7D7D7'],
    '6-bit-rgb': ['#000000', '#0000AA', '#00AA00', '#00AAAA', '#AA0000', '#AA00AA', '#AA5500', '#AAAAAA', '#555555', '#5555FF', '#55FF55', '#55FFFF', '#FF5555', '#FF55FF', '#FFFF55', '#FFFFFF'],
    'vaporwave': ['#FF6AD5', '#C774E8', '#AD8CFF', '#8795E8', '#94D0FF'],
    'hacker': ['#000000', '#00FF00']
};

document.getElementById('image-input').addEventListener('change', handleImageUpload);
document.getElementById('dithering-filter').addEventListener('change', applySelectedFilter);
document.getElementById('color-palette').addEventListener('change', applySelectedFilter);
document.getElementById('dithering-size').addEventListener('input', applySelectedFilter);
document.getElementById('brightness').addEventListener('input', applySelectedFilter);
document.getElementById('contrast').addEventListener('input', applySelectedFilter);
document.getElementById('export-button').addEventListener('click', exportImage);
document.getElementById('reset-button').addEventListener('click', resetSettings);

// Add these new event listeners
document.getElementById('upload-button').addEventListener('click', () => document.getElementById('image-input').click());
document.getElementById('paste-button').addEventListener('click', pasteFromClipboard);
document.getElementById('image-container').addEventListener('dragover', handleDragOver);
document.getElementById('image-container').addEventListener('drop', handleDrop);

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        processImage(file);
    }
}

function pasteFromClipboard() {
    navigator.clipboard.read().then(items => {
        for (const item of items) {
            if (item.types.includes('image/png') || item.types.includes('image/jpeg')) {
                item.getType(item.types[0]).then(blob => {
                    processImage(blob);
                });
                break;
            }
        }
    }).catch(err => {
        console.error('Failed to read clipboard contents: ', err);
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dt = e.dataTransfer;
    const file = dt.files[0];
    processImage(file);
}

function processImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function() {
            canvas = document.createElement('canvas');
            ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            document.getElementById('original-image').src = e.target.result;
            document.getElementById('original-container').classList.remove('hidden');
            document.getElementById('upload-area').style.display = 'none';
            applySelectedFilter();
        };
    };
    reader.readAsDataURL(file);
}

function applySelectedFilter() {
    if (!originalImageData) return;

    const loadingIndicator = document.getElementById('loading-indicator');
    loadingIndicator.classList.remove('hidden');

    setTimeout(() => {
        const filterType = document.getElementById('dithering-filter').value;
        const colorPalette = document.getElementById('color-palette').value;
        const ditheringSize = parseInt(document.getElementById('dithering-size').value);
        const brightness = parseInt(document.getElementById('brightness').value);
        const contrast = parseInt(document.getElementById('contrast').value);

        let imageData = new ImageData(
            new Uint8ClampedArray(originalImageData.data),
            originalImageData.width,
            originalImageData.height
        );

        // Apply brightness and contrast
        applyBrightnessContrast(imageData, brightness, contrast);

        // Apply selected dithering filter
        switch (filterType) {
            case 'floyd-steinberg':
                applyFloydSteinbergDithering(imageData, colorPalettes[colorPalette], ditheringSize);
                break;
            case 'ordered':
                applyOrderedDithering(imageData, colorPalettes[colorPalette], ditheringSize);
                break;
            case 'atkinson':
                applyAtkinsonDithering(imageData, colorPalettes[colorPalette], ditheringSize);
                break;
        }

        ctx.putImageData(imageData, 0, 0);
        document.getElementById('result-image').src = canvas.toDataURL();
        loadingIndicator.classList.add('hidden');
    }, 0);
}

function applyBrightnessContrast(imageData, brightness, contrast) {
    const data = imageData.data;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
        for (let j = 0; j < 3; j++) {
            data[i + j] = factor * (data[i + j] - 128 + brightness) + 128;
        }
    }
}

function applyFloydSteinbergDithering(imageData, palette, ditheringSize) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    for (let y = 0; y < height; y += ditheringSize) {
        for (let x = 0; x < width; x += ditheringSize) {
            const idx = (y * width + x) * 4;
            const oldR = data[idx];
            const oldG = data[idx + 1];
            const oldB = data[idx + 2];
            
            const [newR, newG, newB] = findClosestColor(oldR, oldG, oldB, palette);
            
            for (let dy = 0; dy < ditheringSize && y + dy < height; dy++) {
                for (let dx = 0; dx < ditheringSize && x + dx < width; dx++) {
                    const currentIdx = ((y + dy) * width + (x + dx)) * 4;
                    data[currentIdx] = newR;
                    data[currentIdx + 1] = newG;
                    data[currentIdx + 2] = newB;
                }
            }

            const errR = oldR - newR;
            const errG = oldG - newG;
            const errB = oldB - newB;

            if (x + ditheringSize < width) {
                data[idx + 4 * ditheringSize] = Math.min(255, Math.max(0, data[idx + 4 * ditheringSize] + errR * 7 / 16));
                data[idx + 4 * ditheringSize + 1] = Math.min(255, Math.max(0, data[idx + 4 * ditheringSize + 1] + errG * 7 / 16));
                data[idx + 4 * ditheringSize + 2] = Math.min(255, Math.max(0, data[idx + 4 * ditheringSize + 2] + errB * 7 / 16));
            }
            if (x - ditheringSize >= 0 && y + ditheringSize < height) {
                data[idx + width * 4 * ditheringSize - 4 * ditheringSize] = Math.min(255, Math.max(0, data[idx + width * 4 * ditheringSize - 4 * ditheringSize] + errR * 3 / 16));
                data[idx + width * 4 * ditheringSize - 4 * ditheringSize + 1] = Math.min(255, Math.max(0, data[idx + width * 4 * ditheringSize - 4 * ditheringSize + 1] + errG * 3 / 16));
                data[idx + width * 4 * ditheringSize - 4 * ditheringSize + 2] = Math.min(255, Math.max(0, data[idx + width * 4 * ditheringSize - 4 * ditheringSize + 2] + errB * 3 / 16));
            }
            if (y + ditheringSize < height) {
                data[idx + width * 4 * ditheringSize] = Math.min(255, Math.max(0, data[idx + width * 4 * ditheringSize] + errR * 5 / 16));
                data[idx + width * 4 * ditheringSize + 1] = Math.min(255, Math.max(0, data[idx + width * 4 * ditheringSize + 1] + errG * 5 / 16));
                data[idx + width * 4 * ditheringSize + 2] = Math.min(255, Math.max(0, data[idx + width * 4 * ditheringSize + 2] + errB * 5 / 16));
            }
            if (x + ditheringSize < width && y + ditheringSize < height) {
                data[idx + width * 4 * ditheringSize + 4 * ditheringSize] = Math.min(255, Math.max(0, data[idx + width * 4 * ditheringSize + 4 * ditheringSize] + errR * 1 / 16));
                data[idx + width * 4 * ditheringSize + 4 * ditheringSize + 1] = Math.min(255, Math.max(0, data[idx + width * 4 * ditheringSize + 4 * ditheringSize + 1] + errG * 1 / 16));
                data[idx + width * 4 * ditheringSize + 4 * ditheringSize + 2] = Math.min(255, Math.max(0, data[idx + width * 4 * ditheringSize + 4 * ditheringSize + 2] + errB * 1 / 16));
            }
        }
    }
}

function applyOrderedDithering(imageData, palette, ditheringSize) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const threshold = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
    ];

    for (let y = 0; y < height; y += ditheringSize) {
        for (let x = 0; x < width; x += ditheringSize) {
            const idx = (y * width + x) * 4;
            const thresholdValue = threshold[(y / ditheringSize) % 4][(x / ditheringSize) % 4] / 16;

            const r = data[idx] / 255;
            const g = data[idx + 1] / 255;
            const b = data[idx + 2] / 255;

            const newR = r > thresholdValue ? 255 : 0;
            const newG = g > thresholdValue ? 255 : 0;
            const newB = b > thresholdValue ? 255 : 0;

            const [finalR, finalG, finalB] = findClosestColor(newR, newG, newB, palette);

            for (let dy = 0; dy < ditheringSize && y + dy < height; dy++) {
                for (let dx = 0; dx < ditheringSize && x + dx < width; dx++) {
                    const currentIdx = ((y + dy) * width + (x + dx)) * 4;
                    data[currentIdx] = finalR;
                    data[currentIdx + 1] = finalG;
                    data[currentIdx + 2] = finalB;
                }
            }
        }
    }
}

function applyAtkinsonDithering(imageData, palette, ditheringSize) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    for (let y = 0; y < height; y += ditheringSize) {
        for (let x = 0; x < width; x += ditheringSize) {
            const idx = (y * width + x) * 4;
            const oldR = data[idx];
            const oldG = data[idx + 1];
            const oldB = data[idx + 2];
            
            const [newR, newG, newB] = findClosestColor(oldR, oldG, oldB, palette);
            
            for (let dy = 0; dy < ditheringSize && y + dy < height; dy++) {
                for (let dx = 0; dx < ditheringSize && x + dx < width; dx++) {
                    const currentIdx = ((y + dy) * width + (x + dx)) * 4;
                    data[currentIdx] = newR;
                    data[currentIdx + 1] = newG;
                    data[currentIdx + 2] = newB;
                }
            }

            const errR = (oldR - newR) / 8;
            const errG = (oldG - newG) / 8;
            const errB = (oldB - newB) / 8;

            const neighbors = [
                [1, 0], [2, 0],
                [-1, 1], [0, 1], [1, 1],
                [0, 2]
            ];

            for (const [dx, dy] of neighbors) {
                const nx = x + dx * ditheringSize;
                const ny = y + dy * ditheringSize;
                if (nx >= 0 && nx < width && ny < height) {
                    const nidx = (ny * width + nx) * 4;
                    data[nidx] = Math.min(255, Math.max(0, data[nidx] + errR));
                    data[nidx + 1] = Math.min(255, Math.max(0, data[nidx + 1] + errG));
                    data[nidx + 2] = Math.min(255, Math.max(0, data[nidx + 2] + errB));
                }
            }
        }
    }
}

function findClosestColor(r, g, b, palette) {
    let minDistance = Infinity;
    let closestColor = palette[0];

    for (const color of palette) {
        const [pr, pg, pb] = hexToRgb(color);
        const distance = Math.sqrt((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2);
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = color;
        }
    }

    return hexToRgb(closestColor);
}

function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function resetSettings() {
    document.getElementById('dithering-filter').value = 'ordered';
    document.getElementById('color-palette').value = 'obra-dinn';
    document.getElementById('dithering-size').value = 1;
    document.getElementById('brightness').value = 0;
    document.getElementById('contrast').value = 0;
    applySelectedFilter();
}

function exportImage() {
    const link = document.createElement('a');
    link.download = 'dithered_image.png';
    link.href = canvas.toDataURL();
    link.click();
}

// Initialize with default settings
document.getElementById('dithering-filter').value = 'ordered';
document.getElementById('dithering-size').value = 3;
document.getElementById('color-palette').value = 'obra-dinn';
applySelectedFilter();