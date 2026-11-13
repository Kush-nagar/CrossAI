// Generates web/app/opengraph-image.jpg (1200x630), the link-preview image
// for iMessage/Slack/Discord/X/Google. Run from web/ when the brand changes:
//   node scripts/make-og-image.mjs
// Static on purpose: no runtime fonts or network needed at build time.
import sharp from "sharp";

const W = 1200, H = 630;
const PANEL_W = 470, PANEL_X = W - PANEL_W - 60, PANEL_Y = 60, PANEL_H = H - PANEL_Y;

// The fresco's central bay (arch + Plato and Aristotle), cropped to the panel.
const fresco = await sharp("public/landing/hero.jpg")
  .extract({ left: 720, top: 60, width: 1000, height: Math.round(1000 * (PANEL_H / PANEL_W)) })
  .resize(PANEL_W, PANEL_H)
  .toBuffer();
// Arched top, like the landing page's bay frame.
const r = PANEL_W / 2;
const archMask = Buffer.from(
  `<svg width="${PANEL_W}" height="${PANEL_H}"><path d="M0 ${r} A ${r} ${r} 0 0 1 ${PANEL_W} ${r} V ${PANEL_H} H 0 Z" fill="#fff"/></svg>`
);
const panel = await sharp(fresco).composite([{ input: archMask, blend: "dest-in" }]).png().toBuffer();

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#F2F1EC"/>
  <line x1="60" y1="${H - 60}" x2="${PANEL_X - 40}" y2="${H - 60}" stroke="#16181C" stroke-opacity="0.15"/>
  <text x="60" y="110" font-family="Liberation Serif, DejaVu Serif, serif" font-weight="700" font-size="44" fill="#16181C">Cross</text>
  <text font-family="Liberation Serif, DejaVu Serif, serif" font-weight="700" font-size="74" fill="#16181C" letter-spacing="-1.5">
    <tspan x="60" y="255">${esc("Argue like the")}</tspan>
    <tspan x="60" y="340">${esc("room is watching.")}</tspan>
  </text>
  <text font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="27" fill="#3a3f47">
    <tspan x="60" y="420">${esc("An AI debate coach that grades your speeches,")}</tspan>
    <tspan x="60" y="458">${esc("reads your judge, and finds the card.")}</tspan>
  </text>
  <text x="60" y="${H - 22}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="22" font-weight="700" fill="#2E5C8A">cross-ai.dev</text>
</svg>`);

await sharp(text)
  .composite([{ input: panel, left: PANEL_X, top: PANEL_Y }])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile("app/opengraph-image.jpg");
console.log("wrote app/opengraph-image.jpg");
