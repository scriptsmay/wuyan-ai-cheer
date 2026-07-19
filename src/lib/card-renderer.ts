import QRCode from 'qrcode';
import type { CheerRef, Checkin } from '../types';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1440;

export const FONT_ZCOOL_QINGKE_HUANGYOU = new FontFace(
  'ZCOOL QingKe HuangYou',
  'url(/fonts/ZCOOLQingKeHuangYou-Regular.ttf)',
);

interface CardInput {
  line: string;
  emojiCaption: string;
  refs: CheerRef[];
  sourceSnapshotAt: string;
  checkin?: Checkin;
  showQr?: boolean;
}

export interface RenderedCard {
  dataUrl: string;
  blob: Blob;
  filename: string;
}

export async function renderCheerCard(input: CardInput): Promise<RenderedCard> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器不支持 Canvas 导出');

  drawBackground(context);
  drawSignalHeader(context, input.checkin);
  drawMainCopy(context, input.line, input.emojiCaption);
  drawRefs(context, input.refs);
  await drawFooter(context, input);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('图片编码失败'))),
      'image/png',
    );
  });
  const date = formatDate(new Date());
  return {
    dataUrl: canvas.toDataURL('image/png'),
    blob,
    filename: `wuyan-cheer-${date}.png`,
  };
}

function drawBackground(context: CanvasRenderingContext2D) {
  context.fillStyle = '#0A0E1A';
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  context.save();
  context.globalAlpha = 0.12;
  context.strokeStyle = '#00D4FF';
  context.lineWidth = 2;
  for (let y = 80; y < CARD_HEIGHT; y += 48) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(CARD_WIDTH, y - 120);
    context.stroke();
  }
  context.restore();

  context.fillStyle = '#10192B';
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(780, 0);
  context.lineTo(570, 350);
  context.lineTo(0, 470);
  context.closePath();
  context.fill();

  context.fillStyle = '#FF9F4D';
  context.fillRect(78, 122, 16, 180);
  context.fillStyle = '#00D4FF';
  context.fillRect(106, 122, 5, 120);
}

function drawSignalHeader(
  context: CanvasRenderingContext2D,
  checkin?: Checkin,
) {
  context.fillStyle = '#DFFBFF';
  context.font = '400 66px "ZCOOL QingKe HuangYou"';
  context.fillText(checkin ? '每日加油信号' : '无言应援信号', 144, 190);
  context.fillStyle = '#7AA8B8';
  context.font = '500 28px "Noto Sans SC"';
  context.fillText('WUYAN / FAN SIGNAL STATION', 146, 238);

  if (checkin) {
    context.fillStyle = '#00D4FF';
    context.font = '700 32px "Noto Sans SC"';
    context.fillText(
      `${checkin.date}  ·  连续 ${checkin.streak} 天  ·  累计 ${checkin.total_days} 天`,
      146,
      300,
    );
  }
}

function drawMainCopy(
  context: CanvasRenderingContext2D,
  line: string,
  emojiCaption: string,
) {
  context.fillStyle = '#00D4FF';
  context.font = '500 24px "Noto Sans SC"';
  context.fillText('SIGNAL / 01', 92, 515);
  context.fillStyle = '#F5FBFF';
  context.font = '700 76px "ZCOOL QingKe HuangYou"';
  const rows = wrapText(context, line, 840);
  rows
    .slice(0, 4)
    .forEach((row, index) => context.fillText(row, 92, 620 + index * 106));

  context.fillStyle = '#FFB777';
  context.font = '500 34px "Noto Sans SC"';
  context.fillText(emojiCaption, 96, 1030);
}

function drawRefs(context: CanvasRenderingContext2D, refs: CheerRef[]) {
  const visible = refs.slice(0, 2);
  if (visible.length === 0) return;
  context.strokeStyle = '#25445A';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(92, 1094);
  context.lineTo(720, 1094);
  context.stroke();

  visible.forEach((ref, index) => {
    const x = 92 + index * 320;
    context.fillStyle = '#6F93A3';
    context.font = '500 22px "Noto Sans SC"';
    context.fillText(ref.label, x, 1142);
    context.fillStyle = '#00D4FF';
    context.font = '700 38px "Noto Sans SC"';
    context.fillText(ref.value, x, 1194);
  });
}

async function drawFooter(context: CanvasRenderingContext2D, input: CardInput) {
  if (input.showQr !== false) {
    const siteUrl = new URL(
      '/cheer',
      import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin,
    ).toString();
    const qrDataUrl = await QRCode.toDataURL(siteUrl, {
      width: 176,
      margin: 1,
      color: { dark: '#0A0E1AFF', light: '#F5FBFFFF' },
    });
    const qr = await loadImage(qrDataUrl);
    context.fillStyle = '#F5FBFF';
    context.fillRect(812, 1170, 188, 188);
    context.drawImage(qr, 818, 1176, 176, 176);
  }

  context.fillStyle = '#587483';
  context.font = '400 22px "Noto Sans SC"';
  context.fillText(`生成日期 ${formatDate(new Date())}`, 92, 1320);
  // context.fillText(`数据更新 ${formatDateTime(input.sourceSnapshotAt)}`, 92, 1355)
  context.fillStyle = '#FF9F4D';
  context.font = '700 22px "Noto Sans SC"';
  context.fillText(formatDateTime(Date.now()), 92, 1390);
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = '';
  for (const character of Array.from(text)) {
    const candidate = current + character;
    if (context.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('二维码绘制失败'));
    image.src = src;
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('/', '-');
}

export function formatDateTime(value: number | string): string {
  if (value === '' || value === null || value === undefined) return '-';

  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  if (Number.isNaN(timestamp)) return '-';

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}
