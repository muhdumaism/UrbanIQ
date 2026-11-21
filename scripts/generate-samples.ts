/**
 * Renders ILLUSTRATIVE sample photos (stylised SVG scenes, clearly watermarked) for the demo,
 * and records their fingerprints so the demo triage adapter can recognise them.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const W = 1200;
const H = 900;
const mark = `<g><rect x="24" y="${H - 64}" width="420" height="40" rx="6" fill="rgba(0,0,0,.55)"/><text x="40" y="${H - 37}" font-family="Arial, sans-serif" font-size="20" fill="#fff">ILLUSTRATIVE SAMPLE — not a real photo</text></g>`;
const sky = (a: string, b: string) =>
  `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#sky)"/>`;

const scenes: Record<string, string> = {
  "flooded-pothole": `${sky("#b9c7cf", "#e3e7e4")}
    <polygon points="0,420 1200,420 1200,900 0,900" fill="#4d5156"/>
    <polygon points="560,420 640,420 760,900 440,900" fill="none"/>
    <rect x="0" y="400" width="1200" height="24" fill="#8d9196"/>
    <line x1="600" y1="430" x2="600" y2="900" stroke="#e8e2b0" stroke-width="10" stroke-dasharray="60 50"/>
    <ellipse cx="380" cy="660" rx="260" ry="110" fill="#3a3326"/>
    <ellipse cx="380" cy="655" rx="235" ry="92" fill="#6f7b78" opacity=".95"/>
    <ellipse cx="330" cy="640" rx="90" ry="18" fill="#a8b7b8" opacity=".6"/>
    <polygon points="700,620 730,520 760,620" fill="#f26a1b"/><rect x="694" y="615" width="72" height="14" fill="#222"/>
    <rect x="980" y="180" width="12" height="240" fill="#555"/>
    <polygon points="930,120 1040,120 1040,230 930,230" fill="#f2c94c" stroke="#333" stroke-width="4"/>
    <text x="985" y="185" text-anchor="middle" font-family="Arial" font-size="26" font-weight="bold" fill="#222">SCHOOL</text>
    <rect x="60" y="250" width="320" height="150" fill="#c9b79c"/><rect x="90" y="290" width="60" height="60" fill="#7a8a99"/><rect x="190" y="290" width="60" height="60" fill="#7a8a99"/><rect x="290" y="290" width="60" height="60" fill="#7a8a99"/>`,
  "sparking-wire": `${sky("#9aa6b2", "#d7dcdf")}
    <polygon points="0,560 1200,560 1200,900 0,900" fill="#6b6e72"/>
    <rect x="0" y="540" width="1200" height="24" fill="#a3a6a9"/>
    <rect x="160" y="80" width="26" height="480" fill="#5b4a3a"/>
    <path d="M173,120 C 380,180 470,300 520,470 C 540,540 560,600 600,640" stroke="#111" stroke-width="7" fill="none"/>
    <path d="M173,120 C 600,140 900,140 1200,130" stroke="#111" stroke-width="6" fill="none"/>
    <rect x="720" y="360" width="360" height="200" fill="none" stroke="#3d4a55" stroke-width="10"/>
    <rect x="730" y="370" width="340" height="18" fill="#3d4a55"/>
    <rect x="760" y="420" width="140" height="100" fill="#d9e4ea" opacity=".7"/>
    <text x="900" y="350" text-anchor="middle" font-family="Arial" font-size="28" font-weight="bold" fill="#1e2a33">BUS STOP</text>`,
  "overflowing-bin": `${sky("#c4cdd2", "#ebece8")}
    <polygon points="0,600 1200,600 1200,900 0,900" fill="#b7b2a6"/>
    <rect x="460" y="330" width="260" height="300" rx="14" fill="#2f6b3f"/>
    <rect x="440" y="310" width="300" height="34" rx="8" fill="#245332"/>
    <ellipse cx="590" cy="300" rx="170" ry="70" fill="#3b3b3b"/>
    <ellipse cx="520" cy="270" rx="70" ry="45" fill="#565656"/><ellipse cx="660" cy="265" rx="80" ry="50" fill="#2b2b2b"/>
    <ellipse cx="360" cy="700" rx="90" ry="40" fill="#333"/><ellipse cx="820" cy="720" rx="110" ry="45" fill="#444"/>
    <rect x="250" y="760" width="60" height="30" fill="#d9c27a" transform="rotate(-12 280 775)"/>
    <rect x="900" y="640" width="50" height="26" fill="#c94f4f" transform="rotate(18 925 653)"/>
    <circle cx="700" cy="780" r="16" fill="#9fb3c8"/>`,
  "fallen-tree": `${sky("#a9bcc8", "#e2e8e6")}
    <polygon points="0,480 1200,480 1200,900 0,900" fill="#55595e"/>
    <line x1="0" y1="690" x2="1200" y2="690" stroke="#e8e2b0" stroke-width="10" stroke-dasharray="60 50"/>
    <polygon points="80,640 1100,560 1110,600 90,690" fill="#5a4030"/>
    <ellipse cx="1000" cy="520" rx="200" ry="120" fill="#3d6b35"/><ellipse cx="860" cy="560" rx="160" ry="100" fill="#4c7d40"/>
    <ellipse cx="1100" cy="600" rx="140" ry="90" fill="#355f2e"/>
    <ellipse cx="90" cy="660" rx="60" ry="70" fill="#6b4e38"/>`,
};

const META = {
  "flooded-pothole": {
    subtype: "pothole",
    observations: [
      "Large pothole filled with muddy water across most of one traffic lane",
      "A traffic cone has been placed beside the pothole",
      "School warning sign visible beside the road",
    ],
    factors: [
      { factor: "significant_hazard", detail: "Photo shows a large water-filled pothole in the carriageway" },
      { factor: "major_obstruction", detail: "Photo shows the pothole occupying most of one lane" },
      { factor: "vulnerable_location", detail: "Photo shows a school warning sign nearby" },
    ],
    locationClues: ["School warning sign"],
  },
  "sparking-wire": {
    subtype: "downed_wire",
    observations: [
      "A cable hangs from a utility pole down to footpath level",
      "A bus shelter is a few metres from the cable end",
      "The photo cannot show whether the cable is live",
    ],
    factors: [
      { factor: "electrical_contact_risk", detail: "Photo shows a cable hanging to footpath level; live status not visible" },
      { factor: "vulnerable_location", detail: "Photo shows a bus shelter next to the cable" },
    ],
    locationClues: ["Bus shelter"],
  },
  "overflowing-bin": {
    subtype: "overflowing_bin",
    observations: ["Public waste bin overflowing with bags", "Bags and litter spilling across part of the footpath"],
    factors: [{ factor: "public_space_affected", detail: "Photo shows waste spilling across part of the footpath" }],
    locationClues: [],
  },
  "fallen-tree": {
    subtype: "fallen_tree",
    observations: ["A large tree lies across the road", "Both lanes appear blocked by the trunk and canopy"],
    factors: [{ factor: "major_obstruction", detail: "Photo shows a fallen tree across both lanes" }],
    locationClues: [],
  },
} as const;

async function main() {
  const outDir = path.join(process.cwd(), "public", "samples");
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = [];
  for (const [name, body] of Object.entries(scenes)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}${mark}</svg>`;
    const jpg = await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
    fs.writeFileSync(path.join(outDir, `${name}.jpg`), jpg);
    manifest.push({
      file: `/samples/${name}.jpg`,
      sha256: crypto.createHash("sha256").update(jpg).digest("hex"),
      ...META[name as keyof typeof META],
    });
  }
  fs.writeFileSync(path.join(process.cwd(), "data", "sample-photos.json"), JSON.stringify(manifest, null, 1));
  console.log(`Wrote ${manifest.length} sample photos`);
}
main();
