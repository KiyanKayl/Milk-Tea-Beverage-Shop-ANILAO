// Original, self-contained SVG drink illustrations. Run only when changing art.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(root, 'public/assets/images');
mkdirSync(directory, { recursive: true });
const drinks = [
    ['milk-tea', '#f0e8dc', '#ecd2b1', '#b18b64', '#5a3b24', true],
    ['brown-sugar', '#ece3d6', '#edcfa4', '#9c633c', '#4b3020', true],
    ['taro', '#efe8f4', '#d9c5e5', '#a98abf', '#51415a', true],
    ['matcha', '#e9eddf', '#ced7a2', '#8d9e6c', '#4e6040', true],
    ['peach', '#f7e9db', '#f3c88f', '#eaaa66', '#ad6f3f', false],
    ['strawberry', '#f5e6e2', '#efa5a0', '#d67473', '#8b4b4b', false],
    ['passion', '#f4eed9', '#f5da82', '#d4b54e', '#8d792f', false],
    ['coffee', '#eae1d9', '#d9b08b', '#976d51', '#624b36', false],
    ['americano', '#e9e3da', '#a98664', '#684a35', '#402e22', false],
    ['chocolate', '#ede4de', '#c19a79', '#8e674c', '#513a28', false],
    ['lemon', '#f0f0dc', '#e8e6a1', '#bdc266', '#788b43', false],
    ['strawberry-milk', '#f4e7e6', '#efc5c4', '#db999b', '#986568', false],
];
for (const [name, background, light, dark, accent, boba] of drinks) {
    const pearls = boba ? Array.from({ length: 18 }, (_, index) => `<circle cx="${105 + (index % 6) * 12}" cy="${184 + Math.floor(index / 6) * 11}" r="5.2" fill="${accent}" opacity=".94"/><circle cx="${103 + (index % 6) * 12}" cy="${182 + Math.floor(index / 6) * 11}" r="1.2" fill="#fff" opacity=".2"/>`).join('') : '';
    const swirls = name === 'brown-sugar' ? '<path d="M96 109q18 38 6 67m13-68q18 53 10 83m33-84q-18 39-9 71m25-65q-18 39-13 64" stroke="#855129" stroke-width="8" opacity=".4" fill="none"/>' : '';
    const fruit = !boba && !['coffee', 'americano', 'chocolate'].includes(name) ? `<circle cx="166" cy="170" r="17" fill="${light}" stroke="${dark}" stroke-width="2" opacity=".6"/><path d="m153 161 26 17m-24 0 22-18M165 154l1 32" stroke="${dark}" stroke-width="1" opacity=".6"/>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="250" viewBox="0 0 300 250">
<defs><linearGradient id="drink" x1="0" y1="0" x2="1" y2=".6"><stop stop-color="${light}"/><stop offset=".58" stop-color="${dark}"/><stop offset="1" stop-color="${light}"/></linearGradient><linearGradient id="glass" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#fff" stop-opacity=".55"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".9" stop-color="#fff" stop-opacity=".2"/></linearGradient><clipPath id="cup"><path d="M91 92h94l-11 115q-33 12-72 0z"/></clipPath><filter id="blur"><feGaussianBlur stdDeviation="4"/></filter></defs>
<path fill="${background}" d="M0 0h300v250H0z"/><circle cx="228" cy="46" r="75" fill="#fff" opacity=".2"/><circle cx="41" cy="228" r="61" fill="#fff" opacity=".17"/>
<ellipse cx="148" cy="222" rx="57" ry="8" fill="${accent}" opacity=".15" filter="url(#blur)"/>
<g transform="rotate(5 150 140)"><path d="m157 24 8 2-21 78-8-2z" fill="${accent}"/><path d="m157 24 3 1-20 77-3-1z" fill="#fff" opacity=".15"/>
<path d="M91 92h94l-11 115q-33 12-72 0z" fill="url(#drink)"/>
<g clip-path="url(#cup)"><path d="M88 94h102v24q-22-10-51-3t-51-5z" fill="${light}" opacity=".8"/>${swirls}${pearls}${fruit}<path d="M97 97h9l10 108h-11z" fill="#fff" opacity=".29"/><path d="M178 98h4l-10 106h-3z" fill="#fff" opacity=".35"/><path d="M115 103l16 2-3 13-17-2zM145 98l15 4-4 13-15-3zM165 104l14 3-3 12-14-2z" fill="#fff" opacity=".24"/></g>
<path d="M91 92h94l-11 115q-33 12-72 0z" fill="url(#glass)" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/>
<ellipse cx="138" cy="91" rx="50" ry="9" fill="${light}"/><ellipse cx="138" cy="89" rx="51" ry="8" fill="#fff" opacity=".72"/><ellipse cx="138" cy="88" rx="43" ry="5" fill="${light}" opacity=".75"/>
<path d="m145 80-2 9" stroke="${accent}" stroke-width="7"/>
<circle cx="140" cy="150" r="17" fill="#fff" opacity=".8"/><path d="M132 140h16l-2 18h-12zM130 139h20m-10-1 3-6" fill="none" stroke="${accent}" stroke-width="1.3" stroke-linecap="round"/><path d="M136 146h8" stroke="${accent}" stroke-width="1.2"/>
</g><path d="m228 173 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#fff" opacity=".7"/><circle cx="64" cy="73" r="3" fill="#fff" opacity=".7"/></svg>`;
    writeFileSync(resolve(directory, `${name}.svg`), svg, 'utf8');
}
writeFileSync(resolve(directory, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#315d48"/><path d="M9 10h14l-2 16H11zM8 10h16m-7 0 3-6M12 16h8" fill="none" stroke="#eef3e5" stroke-width="2" stroke-linecap="round"/></svg>');
console.log('Created 12 drink illustrations and favicon.');
