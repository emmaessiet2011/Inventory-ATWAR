const DEFAULT_MAX_WIDTH = 640;
const DEFAULT_MAX_HEIGHT = 640;
const DEFAULT_QUALITY = 0.62;
const DEFAULT_MIN_QUALITY = 0.35;
const DEFAULT_QUALITY_STEP = 0.08;
const DEFAULT_TARGET_MAX_KB = 120;

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  minQuality?: number;
  qualityStep?: number;
  targetMaxKB?: number;
  format?: 'image/jpeg' | 'image/webp' | 'image/png';
  frameWidth?: number;
  frameHeight?: number;
  frameBackground?: string;
}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

const loadImage = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode image.'));
    image.src = source;
  });

const getContainedSize = (
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } => {
  if (width <= 0 || height <= 0) return { width: maxWidth, height: maxHeight };
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
};

const estimateDataUrlBytes = (dataUrl: string): number => {
  const payload = String(dataUrl || '').split(',')[1] || '';
  return Math.ceil((payload.length * 3) / 4);
};

const drawContainedImage = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  background?: string,
) => {
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  } else {
    context.clearRect(0, 0, width, height);
  }

  const fitted = getContainedSize(image.width, image.height, width, height);
  const x = Math.round((width - fitted.width) / 2);
  const y = Math.round((height - fitted.height) / 2);
  context.drawImage(image, x, y, fitted.width, fitted.height);
};

export const compressImageFileToDataUrl = async (
  file: File,
  options: ImageCompressionOptions = {},
): Promise<string> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Provided file is not an image.');
  }

  const originalDataUrl = await readFileAsDataUrl(file);
  if (file.type.includes('svg')) {
    return originalDataUrl;
  }

  const maxWidth = Math.max(1, options.maxWidth ?? DEFAULT_MAX_WIDTH);
  const maxHeight = Math.max(1, options.maxHeight ?? DEFAULT_MAX_HEIGHT);
  const targetMaxBytes = Math.max(1, (options.targetMaxKB ?? DEFAULT_TARGET_MAX_KB) * 1024);
  const format = options.format ?? 'image/webp';
  const minQuality = Math.max(0.1, Math.min(1, options.minQuality ?? DEFAULT_MIN_QUALITY));
  const qualityStep = Math.max(0.01, Math.min(0.5, options.qualityStep ?? DEFAULT_QUALITY_STEP));

  const image = await loadImage(originalDataUrl);
  const size = getContainedSize(image.width, image.height, maxWidth, maxHeight);
  const frameWidth = Math.max(1, Math.round(options.frameWidth ?? size.width));
  const frameHeight = Math.max(1, Math.round(options.frameHeight ?? size.height));
  const canvas = document.createElement('canvas');
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const context = canvas.getContext('2d');
  if (!context) return originalDataUrl;
  drawContainedImage(context, image, frameWidth, frameHeight, options.frameBackground);

  let quality = Math.max(minQuality, Math.min(1, options.quality ?? DEFAULT_QUALITY));
  let compressed = canvas.toDataURL(format, quality);

  while (estimateDataUrlBytes(compressed) > targetMaxBytes && quality > minQuality) {
    quality = Math.max(minQuality, quality - qualityStep);
    compressed = canvas.toDataURL(format, quality);
  }

  if (estimateDataUrlBytes(compressed) > estimateDataUrlBytes(originalDataUrl)) {
    return originalDataUrl;
  }
  return compressed;
};
