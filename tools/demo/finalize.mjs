// Finish an existing Stagehand capture without browser access or paid services.
// Adds open captions, corrects prototype receipt wording, and produces 1080p MP4.
import { execFileSync } from 'node:child_process';
import { mkdir, copyFile, access, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const directory = resolve(process.argv[2] || 'output');
const run = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
let font = process.env.DEMO_FONT;
if (!font) {
  for (const candidate of ['/system/fonts/Roboto-Regular.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']) {
    try { await access(candidate); font = candidate; break; } catch {}
  }
}
if (!font) throw new Error('Set DEMO_FONT to a licensed local TrueType font.');
await mkdir(join(directory, 'fonts'), { recursive: true });
await copyFile(font, join(directory, 'fonts', 'Demo.ttf'));
const ids = ['intro', 'lineage', 'blocked', 'allowed', 'outro'];
for (const id of ids) {
  const filters = [];
  // These are explicit editorial disclosures, not modifications to gate outcomes.
  if (id === 'intro' || id === 'outro') {
    const y = id === 'intro' ? 598 : 552;
    filters.push(`drawbox=x=90:y=${y}:w=1400:h=55:color=0x102e29:t=fill`);
    filters.push(`drawtext=fontfile='${font}':text='Silent demo with captions | Title card - not app footage':x=100:y=${y + 10}:fontsize=20:fontcolor=white`);
  }
  if (id === 'allowed') {
    filters.push('drawbox=x=283:y=479:w=1035:h=65:color=0x102e29:t=fill');
    filters.push(`drawtext=fontfile='${font}':text='SIMULATION ONLY - no blockchain transaction was broadcast':x=300:y=495:fontsize=22:fontcolor=0xBBF0D2`);
  }
  // Reserve the lower caption rail for the complete transcript in the final pass.
  filters.push('drawbox=x=0:y=870:w=1600:h=130:color=0x102e29:t=fill');
  run(['-i', join(directory, `${id}.mp4`), '-vf', filters.join(','), '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p', join(directory, `${id}-finished.mp4`)]);
}
await writeFile(join(directory, 'finished-concat.txt'), ids.map(id => `file '${id}-finished.mp4'`).join('\n'));
run(['-f', 'concat', '-safe', '0', '-i', join(directory, 'finished-concat.txt'), '-c', 'copy', join(directory, 'finished-intermediate.mp4')]);
// Run from the output directory so subtitle paths are portable (and not filter syntax).
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'finished-intermediate.mp4',
  '-vf', "subtitles=narration.srt:fontsdir=fonts:force_style='FontName=Roboto,FontSize=14,PrimaryColour=&H00FFFFFF,Outline=0,Shadow=0,Alignment=2,MarginV=8,MarginL=20,MarginR=20',scale=1728:1080,pad=1920:1080:96:0:color=0x102e29,setsar=1",
  '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'PhishNet-hackathon-demo.mp4'], { cwd: directory, stdio: 'inherit' });
console.log(join(directory, 'PhishNet-hackathon-demo.mp4'));
