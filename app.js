// ==========================================
// Geodemia AI - Application Logic Engine & Router
// ==========================================

let map;
let datasetIndex = [];
let activeLayerId = null;
let activeSourceId = null;
let currentPreviewGeoJSON = null;
let mapInitialized = false;

// Categories configuration for UI mapping
const CATEGORY_MAP = {
    "local_converted_shapefiles": "boundaries",
    "india_topo_maps": "maps", "american_world_topo_maps": "maps", "russian_world_topo_maps": "maps",
    "indian_buildings": "buildings", "google_buildings_india": "buildings", "ms_buildings_india": "buildings", 
    "essd_copernicus_building_heights_india": "buildings",
    "indian_admin_boundaries": "boundaries", "indian_land_features": "boundaries", 
    "indian_water_features": "boundaries", "indian_railways": "boundaries", "indian_transport": "boundaries", 
    "indian_power_infra": "boundaries", "indian_cadastrals": "boundaries", "overture_places_india": "boundaries",
    "opendata": "scrapers", "indian_gazettes": "scrapers", "india-environmental-approvals": "scrapers", 
    "india_natural_disasters": "scrapers", "indian_facilities": "scrapers", "indian_communications": "scrapers",
    "myanmar_survey_maps": "maps", "nepal_survey_maps": "maps",
    "captchabreaker": "tools", "duckdb-wasm": "tools", "josm-gcs-imagery-enabler": "tools", 
    "josm-webp-plugin": "tools", "nisaba": "tools", "nisaba-tools": "tools"
};

const CATEGORY_NAMES = {
    "maps": "Topo Maps & Imagery",
    "buildings": "Building Footprints",
    "boundaries": "GIS & Boundaries",
    "scrapers": "Open Data Scrapers",
    "tools": "Software & Tools"
};

// ==========================================
// 1. Client-Side Hash Router
// ==========================================
function initRouter() {
    const handleRoute = () => {
        const hash = window.location.hash || '#/';
        
        // Hide all views
        document.querySelectorAll('.view-container').forEach(view => {
            view.classList.remove('active');
        });

        if (hash === '#/' || hash === '') {
            document.getElementById('landing-view').classList.add('active');
        } else if (hash === '#/login') {
            document.getElementById('login-view').classList.add('active');
        } else if (hash === '#/app') {
            document.getElementById('app-view').classList.add('active');
            
            // Initialize map on first entering the app dashboard
            if (!mapInitialized) {
                initMap();
                loadCatalog();
                mapInitialized = true;
            } else if (map) {
                // Resize map to fit layout correctly if it was hidden
                setTimeout(() => map.resize(), 100);
            }
        }
    };

    window.addEventListener('hashchange', handleRoute);
    // Trigger router check on load
    handleRoute();
}

// ==========================================
// 2. Interactive Background Particle System
// ==========================================
class ParticleAnimator {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.time = 0;
        this.stars = [];
        this.galaxies = [];
        this.diskParticles = [];
        this.mouse = { x: null, y: null, active: false };
        this.blackHoleScale = 1; // externally animated for page transitions
        this.canvasId = canvasId;
        this.resize();
        this.init();
        this.bindEvents();
        this.animate();
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width  = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    getR() {
        return Math.min(this.canvas.width, this.canvas.height) * 0.22 * this.blackHoleScale;
    }

    // t ∈ [0,1]:  0 = innermost (white-hot)  →  1 = outermost (cool copper)
    diskColor(t) {
        if (t < 0.25) {
            const f = t / 0.25;
            return [255, Math.round(245 - f * 80), Math.round(210 - f * 170)];
        } else if (t < 0.55) {
            const f = (t - 0.25) / 0.30;
            return [255, Math.round(165 - f * 65), Math.round(40 - f * 30)];
        } else {
            const f = (t - 0.55) / 0.45;
            return [Math.round(255 - f * 100), Math.round(100 - f * 60), 10];
        }
    }

    // ── Initialisation ────────────────────────────────────────────────────────

    init() {
        const W = this.canvas.width, H = this.canvas.height;
        const cx = W / 2, cy = H / 2;
        const R  = this.getR();

        /* Background stars */
        this.stars = Array.from({ length: 700 }, () => ({
            x:  Math.random() * W,
            y:  Math.random() * H,
            r:  Math.random() * 1.1 + 0.2,
            op: Math.random() * 0.32 + 0.06,
            tw: Math.random() * Math.PI * 2,
            ts: Math.random() * 0.018 + 0.005
        }));

        /* Galaxies that spiral into the BH */
        this.galaxies = [
            { name: 'India',      colors: ['255,153,51','70,50,218','18,136,37'],  radius: 65, rot: 0, speed: 0.0015 },
            { name: 'Andromeda',  colors: ['180,100,255','100,120,255'],            radius: 80, rot: 0, speed: 0.0008 },
            { name: 'Triangulum', colors: ['6,217,250','70,50,218'],               radius: 70, rot: 0, speed: 0.0012 },
        ];
        this.galaxies.forEach((g, i) => {
            const a = (i / this.galaxies.length) * Math.PI * 2 + 0.4;
            const d = Math.max(W, H) * (0.38 + i * 0.11);
            g.x = cx + Math.cos(a) * d;
            g.y = cy + Math.sin(a) * d;
            g.stars = Array.from({ length: 90 }, () => ({
                r:     (Math.random() ** 1.3) * g.radius,
                theta: Math.random() * Math.PI * 2,
                speed: 0.004 + Math.random() * 0.003,
                size:  Math.random() * 1.0 + 0.3,
                col:   g.colors[Math.floor(Math.random() * g.colors.length)]
            }));
        });

        /* Accretion disk particles */
        const COLS = [
            [255, 245, 200], [255, 210, 70], [255, 148, 38], [218, 78, 8], [155, 42, 5]
        ];
        this.diskParticles = Array.from({ length: 2400 }, () => {
            const r = R * 1.32 + (Math.random() ** 1.8) * R * 3.9;
            return {
                angle: Math.random() * Math.PI * 2,
                r,
                speed: 0.060 * Math.pow(R / r, 0.5),   // Keplerian
                size:  Math.random() * 2.1 + 0.5,
                col:   COLS[Math.floor(Math.random() * COLS.length)]
            };
        });
    }

    bindEvents() {
        window.addEventListener('mousemove', e => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
            this.mouse.active = true;
        });
        window.addEventListener('mouseleave', () => { this.mouse.active = false; });
        window.addEventListener('resize', () => { this.resize(); this.init(); });
    }

    // ── Main Loop ─────────────────────────────────────────────────────────────

    animate() {
        if (!this.canvas?.parentElement?.classList.contains('active')) {
            requestAnimationFrame(() => this.animate());
            return;
        }
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.time += 0.012;

        const cx = canvas.width  / 2;
        const cy = canvas.height / 2;
        const R  = this.getR();

        // Disk inclination: small angle from edge-on = Interstellar Gargantua style
        // tilt=0 → perfectly edge-on (thin line), tilt=π/2 → face-on (circle)
        // ~12 degrees from edge-on gives sinT ≈ 0.21 — the iconic barely-tilted ring
        let tilt = 0.21;
        let yaw  = 0;
        if (this.mouse.active) {
            tilt += (this.mouse.y - cy) / canvas.height * 0.09;
            yaw  += (this.mouse.x - cx) / canvas.width  * 0.18;
        }
        const sinT = Math.sin(tilt), cosT = Math.cos(tilt);
        const sinY = Math.sin(yaw),  cosY = Math.cos(yaw);

        this.drawStars(cx, cy, R);
        this.drawGalaxies(cx, cy, R);
        this.drawAmbientGlow(cx, cy, R, sinT);
        this.renderBlackHole(cx, cy, R, sinT, cosT, sinY, cosY);

        requestAnimationFrame(() => this.animate());
    }

    // ── Sub-renderers ─────────────────────────────────────────────────────────

    drawStars(cx, cy, R) {
        const ctx = this.ctx;
        this.stars.forEach(s => {
            s.tw += s.ts;
            const op = s.op * (0.75 + 0.25 * Math.sin(s.tw));
            const dx = s.x - cx, dy = s.y - cy;
            const dist = Math.hypot(dx, dy);
            let wx = s.x, wy = s.y;
            if (dist > 0 && dist < R * 5.5) {
                const w = (R * 0.8) / Math.max(6, dist - R * 0.9);
                wx += (dx / dist) * w * 24;
                wy += (dy / dist) * w * 24;
            }
            ctx.globalAlpha = op;
            ctx.beginPath();
            ctx.arc(wx, wy, s.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(55,70,110,1)';
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    drawGalaxies(cx, cy, R) {
        const ctx = this.ctx;
        this.galaxies.forEach(gal => {
            // Spiral toward the black hole
            const dx = cx - gal.x, dy = cy - gal.y;
            const dist = Math.hypot(dx, dy);
            if (dist > R * 1.6) {
                gal.x += (dx / dist) * 0.52;
                gal.y += (dy / dist) * 0.52;
                const sa = 0.002, rx = gal.x - cx, ry = gal.y - cy;
                gal.x = cx + rx * Math.cos(sa) - ry * Math.sin(sa);
                gal.y = cy + rx * Math.sin(sa) + ry * Math.cos(sa);
            } else {
                // Swallowed — respawn far away
                const a = Math.random() * Math.PI * 2;
                const d = Math.max(this.canvas.width, this.canvas.height) * (0.48 + Math.random() * 0.22);
                gal.x = cx + Math.cos(a) * d;
                gal.y = cy + Math.sin(a) * d;
            }
            gal.rot += gal.speed;

            // Soft glow
            const rg = ctx.createRadialGradient(gal.x, gal.y, 0, gal.x, gal.y, gal.radius * 0.55);
            rg.addColorStop(0, `rgba(${gal.colors[0]},0.12)`);
            rg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.beginPath();
            ctx.arc(gal.x, gal.y, gal.radius * 0.55, 0, Math.PI * 2);
            ctx.fillStyle = rg;
            ctx.fill();

            // Name label
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = '#475569';
            ctx.font = '500 9px "Varela Round"';
            ctx.fillText(gal.name, gal.x + 10, gal.y + 3);
            ctx.globalAlpha = 1;

            // Galaxy star cloud
            gal.stars.forEach(s => {
                s.theta += s.speed;
                const lx = s.r * Math.cos(s.theta + gal.rot);
                const ly = s.r * Math.sin(s.theta + gal.rot);
                const sx = gal.x + lx, sy = gal.y + ly;
                const sd = Math.hypot(sx - cx, sy - cy);
                let wx = sx, wy = sy;
                if (sd > 0 && sd < R * 4) {
                    const w = (R * 0.5) / Math.max(6, sd - R);
                    wx += ((sx - cx) / sd) * w * 10;
                    wy += ((sy - cy) / sd) * w * 10;
                }
                ctx.beginPath();
                ctx.arc(wx, wy, s.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${s.col},0.65)`;
                ctx.fill();
            });
        });
    }

    drawAmbientGlow(cx, cy, R, sinT) {
        const ctx = this.ctx;
        // The glow is an orange ellipse matching the disk inclination
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, Math.max(0.08, sinT * 2.8));
        const g = ctx.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 6.2);
        g.addColorStop(0,    'rgba(251,146,60,0.30)');
        g.addColorStop(0.18, 'rgba(220,80,15,0.18)');
        g.addColorStop(0.45, 'rgba(160,45,5,0.08)');
        g.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(0, 0, R * 6.2, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
    }

    renderBlackHole(cx, cy, R, sinT, cosT, sinY, cosY) {
        const ctx = this.ctx;
        const RINGS  = 55;
        const innerR = R * 1.30;
        const outerR = R * 5.0;

        // ── Project all disk particles into 2D screen space ───────────────
        const pts = this.diskParticles.map(p => {
            p.angle += p.speed;

            // 3D position on disk plane (disk lies in XZ plane, y_3d = 0)
            const x3 = p.r * Math.cos(p.angle);
            const z3 = p.r * Math.sin(p.angle);

            // Yaw rotation (mouse horizontal tilt)
            const xY = x3 * cosY - z3 * sinY;
            const zY = x3 * sinY + z3 * cosY;

            // Pitch: tilt disk toward camera
            //   depth > 0 → particle is in FRONT of BH → appears BELOW center on screen
            //   depth < 0 → particle is BEHIND BH → appears above, lensed OVER the top
            let   x2    = xY;
            let   y2    = zY * sinT;       // front → positive → down on screen
            const depth = zY * cosT;

            // Gravitational lensing: back-half photons bent upward over BH shadow
            if (depth < 0) {
                const pd = Math.hypot(x2, y2);
                if (pd < R * 3.5 && pd > 0) {
                    const strength = Math.max(0, 1 - pd / (R * 3.5));
                    const lens = R * 0.48 * strength * Math.pow(R / Math.max(pd, R * 0.75), 1.25);
                    y2 -= lens;            // push upward
                }
            }

            // Doppler brightening (approaching side brighter)
            const doppler = 0.40 + 0.60 * Math.cos(p.angle);
            // Fade-in so particles don't pop right at the event horizon edge
            const fade    = Math.min(1, (p.r - R * 1.32) / (R * 0.42));

            return {
                x: cx + x2, y: cy + y2,
                depth,
                size: p.size,
                col:  p.col,
                alpha: Math.max(0, (0.36 + 0.55 * doppler) * fade)
            };
        });

        // Back-to-front sort so far particles are overdrawn by near ones
        pts.sort((a, b) => a.depth - b.depth);

        // ════════════════════════════════════════════════════════════════════
        // PASS 1 — BACK HALF  (depth < 0)
        // These are the particles/rings that travel BEHIND the event horizon.
        // Gravitational lensing bends their light OVER the top — forming the
        // iconic bright arc you see above the black sphere in Interstellar.
        // ════════════════════════════════════════════════════════════════════

        // 1A: Smooth arc rings — back half (top semicircle, lensed/squashed)
        for (let i = 0; i < RINGS; i++) {
            const t  = i / RINGS;
            const r  = innerR + t * (outerR - innerR);
            const [ri, gi, bi] = this.diskColor(t);
            const al = Math.pow(1 - t, 0.55) * 0.52;
            const lw = Math.max(0.3, 2.1 * (1 - t) + 0.45);

            // Back arc is more squashed than front (lensed thin arc over the top)
            // and lifted upward so it crests above the event horizon
            const backSin = sinT * 0.38;                      // extra vertical squash
            const lift    = R * 0.08 * (1 - t * 0.55);       // inner rings lifted more

            ctx.save();
            ctx.translate(cx, cy - lift);
            ctx.scale(1, backSin);
            ctx.beginPath();
            // arc from π→2π in squashed space = top semicircle on screen
            ctx.arc(0, 0, r, Math.PI, Math.PI * 2);
            ctx.lineWidth   = lw;
            ctx.strokeStyle = `rgba(${ri},${gi},${bi},${al * 0.60})`;
            ctx.stroke();
            ctx.restore();
        }

        // 1B: Back-half particles
        ctx.globalCompositeOperation = 'source-over';
        pts.forEach(p => {
            if (p.depth >= 0) return;
            ctx.globalAlpha = p.alpha * 0.80;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${p.col[0]},${p.col[1]},${p.col[2]})`;
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // ════════════════════════════════════════════════════════════════════
        // EVENT HORIZON
        // Drawn between the two passes so the back disk is hidden behind it
        // while the front disk renders on top of it.
        // ════════════════════════════════════════════════════════════════════

        // Photon ring — the razor-thin bright boundary of the shadow sphere
        // This is a smooth radial gradient painted as a full circle.
        const photonRing = ctx.createRadialGradient(cx, cy, R * 0.76, cx, cy, R * 1.45);
        photonRing.addColorStop(0,    'rgba(0,0,0,0)');
        photonRing.addColorStop(0.58, 'rgba(0,0,0,0)');
        photonRing.addColorStop(0.72, 'rgba(255,218,80, 0.94)');   // white-gold ring
        photonRing.addColorStop(0.80, 'rgba(255,130,28, 0.72)');   // orange halo
        photonRing.addColorStop(0.92, 'rgba(180,58,4,   0.22)');   // copper fade
        photonRing.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.45, 0, Math.PI * 2);
        ctx.fillStyle = photonRing;
        ctx.fill();

        // Solid black event horizon void
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.975, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();

        // ════════════════════════════════════════════════════════════════════
        // PASS 2 — FRONT HALF  (depth >= 0)
        // These particles are between us and the black hole.
        // They form the bright, thick glowing band at the BOTTOM of the sphere.
        // ════════════════════════════════════════════════════════════════════

        // 2A: Smooth arc rings — front half (bottom semicircle, full sinT squash)
        for (let i = 0; i < RINGS; i++) {
            const t  = i / RINGS;
            const r  = innerR + t * (outerR - innerR);
            const [ri, gi, bi] = this.diskColor(t);
            const al = Math.pow(1 - t, 0.50) * 0.75;
            const lw = Math.max(0.4, 2.5 * (1 - t) + 0.6);

            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(1, sinT);
            ctx.beginPath();
            // arc from 0→π in squashed space = bottom semicircle on screen
            ctx.arc(0, 0, r, 0, Math.PI);
            ctx.lineWidth   = lw;
            ctx.strokeStyle = `rgba(${ri},${gi},${bi},${al})`;
            ctx.stroke();
            ctx.restore();
        }

        // 2B: Front-half particles
        pts.forEach(p => {
            if (p.depth < 0) return;
            ctx.globalAlpha = p.alpha * 0.92;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${p.col[0]},${p.col[1]},${p.col[2]})`;
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Final solid black re-stamp — ensures the event horizon is never
        // contaminated by front particles that overshoot slightly inside.
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.965, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();
    }
}

// ==========================================
// 3. Initialize MapLibre GL Map
// ==========================================
function initMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [78.9629, 22.5937],
        zoom: 4.5,
        minZoom: 2,
        maxZoom: 18
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
}

// ==========================================
// 4. Fetch Dataset Catalog Index
// ==========================================
async function loadCatalog() {
    try {
        const response = await fetch('data_index.json');
        if (!response.ok) throw new Error("Local fetch failed");
        
        datasetIndex = await response.json();
        filterDatasets();
    } catch (error) {
        console.error('Failed to load local dataset search index:', error);
        document.getElementById('dataset-cards-container').innerHTML = `
            <div class="empty-state">
                <i class="fa fa-exclamation-triangle"></i>
                <p>Failed to load the local dataset catalog.</p>
                <button class="btn-outline" onclick="location.reload()" style="margin-top: 10px; padding: 6px 12px; font-size: 11px;">Retry</button>
            </div>
        `;
    }
}

// ==========================================
// 5. Render Card List
// ==========================================
function renderDatasetList(files) {
    const container = document.getElementById('dataset-cards-container');
    if (files.length === 0) {
        const query = document.getElementById('dataset-search').value.trim();
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa fa-search-minus"></i>
                <p>No matching files found in local index.</p>
                ${query ? `
                    <p style="font-size: 11px; margin-top: 8px; color: #a0aec0;">
                        Let our AI Agent Scraper pull this data dynamically for you!
                    </p>
                    <button class="run-scraper-btn" onclick="triggerAIScraperFromSearch('${query.replace(/'/g, "\\'")}')" style="margin-top: 12px; padding: 8px 16px; font-size: 12px;">
                        <i class="fa fa-robot"></i> Scrape "${query}" with AI Agent
                    </button>
                ` : ''}
            </div>
        `;
        return;
    }

    container.innerHTML = files.map(file => {
        const cat = CATEGORY_MAP[file.repoName] || 'tools';
        const catName = CATEGORY_NAMES[cat] || 'Tools';
        const isGeoJSON = file.name.toLowerCase().endsWith('.geojson') || file.name.toLowerCase().endsWith('.json');
        
        return `
            <div class="dataset-card file-card" onclick="openDetails('${file.repoName}')">
                <div class="card-header">
                    <h3 title="${file.name}">${file.name}</h3>
                    <span class="card-badge ${file.format.toLowerCase()}">${file.format.toUpperCase()}</span>
                </div>
                <p class="card-desc">
                    Dataset: <strong>${file.repoName}</strong><br/>
                    <span style="font-size:11px; color: var(--text-secondary);">${file.repoDesc ? file.repoDesc.slice(0, 80) + '...' : ''}</span>
                </p>
                <div class="card-footer">
                    <span class="footer-stat">
                        <i class="fa fa-hdd"></i> ${file.sizeStr}
                    </span>
                    <div class="card-actions">
                        ${isGeoJSON ? `
                            <button class="card-action-btn preview-btn" onclick="event.stopPropagation(); previewLayer('${file.downloadUrl}', '${file.name}')">
                                <i class="fa fa-eye"></i> Preview
                            </button>
                        ` : ''}
                        <a href="${file.downloadUrl}" target="_blank" class="card-action-btn download-btn-mini" onclick="event.stopPropagation();">
                            <i class="fa fa-download"></i> Get File
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Global hook to bridge search failures directly to the AI Scraper Agent
window.triggerAIScraperFromSearch = function(query) {
    // Switch to scraper tab
    switchSidebarTab('scraper');
    // Set query value
    const input = document.getElementById('ai-scraper-query');
    if (input) input.value = `Scrape ${query} boundary coordinates and information`;
    // Scroll to input
    input.focus();
};

// File-level Search Engine (Agentic Brain)
function filterDatasets() {
    const query = document.getElementById('dataset-search').value.toLowerCase().trim();
    const activeCategory = document.querySelector('.category-pills .pill.active').dataset.category;
    const activeFormat = document.getElementById('format-select').value;
    const sortBy = document.getElementById('sort-select').value;

    // 1. Flatten all file assets across all repos
    let allFiles = [];
    datasetIndex.forEach(repo => {
        const repoName = repo.name;
        const repoDesc = repo.description || '';
        const cat = CATEGORY_MAP[repoName] || 'tools';
        
        if (repo.assets && repo.assets.length > 0) {
            repo.assets.forEach(asset => {
                const name = asset.name;
                const size = asset.size;
                const sizeMb = size / (1024 * 1024);
                const sizeStr = size === 0 ? 'N/A' : (sizeMb < 1024 ? `${sizeMb.toFixed(1)} MB` : `${(sizeMb/1024).toFixed(1)} GB`);
                
                // Determine format
                let format = 'other';
                if (name.toLowerCase().endsWith('.pmtiles')) format = 'pmtiles';
                else if (name.toLowerCase().endsWith('.geojson') || name.toLowerCase().endsWith('.json')) format = 'geojson';
                else if (name.toLowerCase().endsWith('.zip') || name.toLowerCase().endsWith('.7z') || name.toLowerCase().endsWith('.tar.gz')) format = 'zip';
                else if (name.toLowerCase().endsWith('.py') || name.toLowerCase().endsWith('.sh') || name.toLowerCase().endsWith('.js')) format = 'code';

                allFiles.push({
                    name,
                    size,
                    sizeStr,
                    downloadUrl: asset.download_url,
                    releaseName: asset.release_name,
                    repoName,
                    repoDesc,
                    category: cat,
                    format
                });
            });
        }
    });

    // 2. Filter matches using the agentic criteria
    let filtered = allFiles.filter(file => {
        // Query matches either the file name, dataset name or dataset description
        const matchesQuery = !query || 
                             file.name.toLowerCase().includes(query) || 
                             file.repoName.toLowerCase().includes(query) ||
                             file.repoDesc.toLowerCase().includes(query);
        
        // Category filtering
        const matchesCategory = activeCategory === 'all' || file.category === activeCategory;

        // Format filtering
        const matchesFormat = activeFormat === 'all' || file.format === activeFormat;

        return matchesQuery && matchesCategory && matchesFormat;
    });

    // 3. Sort results
    filtered.sort((a, b) => {
        if (sortBy === 'name') {
            return a.name.localeCompare(b.name);
        } else if (sortBy === 'size') {
            return b.size - a.size;
        }
        return 0;
    });

    // 4. Cap results to top 150 items to keep rendering snappy
    const totalCount = filtered.length;
    const capped = filtered.slice(0, 150);

    renderDatasetList(capped);
    updateResultsCount(totalCount, capped.length);
}

function updateResultsCount(total, shown) {
    const el = document.getElementById('results-count');
    if (el) {
        if (total === shown) {
            el.innerText = `Showing ${total} file(s)`;
        } else {
            el.innerText = `Showing top ${shown} of ${total} files`;
        }
    }
}

// ==========================================
// 7. Open Dataset Details Drawer
// ==========================================
function openDetails(repoName) {
    const repo = datasetIndex.find(r => r.name === repoName);
    if (!repo) return;

    document.querySelectorAll('.dataset-card').forEach(card => {
        card.classList.remove('active');
        if (card.dataset.repoName === repoName) {
            card.classList.add('active');
        }
    });

    const cat = CATEGORY_MAP[repo.name] || 'tools';
    const catName = CATEGORY_NAMES[cat] || 'Tools';
    const fileCount = repo.assets ? repo.assets.length : 0;

    let totalSize = 0;
    if (repo.assets) {
        totalSize = repo.assets.reduce((acc, curr) => acc + curr.size, 0);
    }
    const sizeMb = totalSize / (1024 * 1024);
    const sizeStr = sizeMb === 0 ? 'N/A' : (sizeMb < 1024 ? `${sizeMb.toFixed(1)} MB` : `${(sizeMb/1024).toFixed(1)} GB`);

    const drawerContent = document.getElementById('drawer-content');
    
    let assetsHtml = '';
    if (repo.assets && repo.assets.length > 0) {
        assetsHtml = repo.assets.map(asset => {
            const size = asset.size / (1024 * 1024);
            const sizeString = size < 1024 ? `${size.toFixed(2)} MB` : `${(size/1024).toFixed(2)} GB`;
            const isGeoJSON = asset.name.toLowerCase().endsWith('.geojson') || asset.name.toLowerCase().endsWith('.json');
            
            return `
                <div class="asset-item-card">
                    <div class="asset-title">${asset.name}</div>
                    <div class="asset-meta">
                        <span><i class="fa fa-weight-hanging"></i> ${sizeString}</span>
                        <span><i class="fa fa-tag"></i> ${asset.release_name}</span>
                    </div>
                    <div class="download-options">
                        <a href="${asset.download_url}" target="_blank" class="download-btn btn-primary">
                            <i class="fa fa-download"></i> Direct Download
                        </a>
                        ${isGeoJSON ? `
                            <button onclick="previewLayer('${asset.download_url}', '${asset.name}')" class="download-btn btn-outline">
                                <i class="fa fa-eye"></i> Map Preview
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        assetsHtml = `
            <div class="empty-state">
                <i class="fa fa-box-open"></i>
                <p>No files uploaded in releases yet.</p>
                <p style="font-size:11px; margin-top:5px;">Source code and scripts are available in the Git repository.</p>
            </div>
        `;
    }

    drawerContent.innerHTML = `
        <div class="detail-header">
            <span class="category">${catName}</span>
            <h2>${repo.name}</h2>
            <div class="detail-meta-tags">
                <span class="meta-tag"><i class="fa fa-folder-open"></i> ${fileCount} files</span>
                <span class="meta-tag"><i class="fa fa-database"></i> ${sizeStr}</span>
                <span class="meta-tag"><i class="fab fa-git-alt"></i> Public repo</span>
            </div>
        </div>
        
        <p class="detail-desc">${repo.description || 'No description provided.'}</p>
        
        <div class="assets-section">
            <h3>Download Files</h3>
            <div class="asset-items">
                ${assetsHtml}
            </div>
        </div>
    `;

    document.getElementById('drawer-backdrop').classList.add('active');
    document.getElementById('details-drawer').classList.add('active');
}

function closeDrawer() {
    document.getElementById('drawer-backdrop').classList.remove('active');
    document.getElementById('details-drawer').classList.remove('active');
    document.querySelectorAll('.dataset-card').forEach(c => c.classList.remove('active'));
}

// ==========================================
// 8. Map Layer Preview & Styling
// ==========================================
async function previewLayer(geojsonUrl, fileName) {
    const statusText = document.getElementById('preview-status');
    const legend = document.getElementById('legend-container');
    const legendLabel = document.getElementById('legend-label');
    
    statusText.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Downloading and plotting spatial layer...`;
    
    clearPreviewLayer();

    try {
        // Bypass GitHub CORS policy using a public proxy
        const proxiedUrl = geojsonUrl.includes('github') 
            ? `https://corsproxy.io/?${encodeURIComponent(geojsonUrl)}` 
            : geojsonUrl;

        const response = await fetch(proxiedUrl);
        if (!response.ok) throw new Error("CORS or request issue fetching GeoJSON");
        
        const data = await response.json();
        currentPreviewGeoJSON = data;

        activeSourceId = 'preview-source';
        activeLayerId = 'preview-layer';

        map.addSource(activeSourceId, {
            type: 'geojson',
            data: data
        });

        const features = data.features || (data.type === 'Feature' ? [data] : []);
        if (features.length === 0) {
            throw new Error("Empty GeoJSON file");
        }

        const firstGeomType = features[0].geometry ? features[0].geometry.type : '';
        
        if (firstGeomType.includes('Polygon')) {
            map.addLayer({
                id: activeLayerId,
                type: 'fill',
                source: activeSourceId,
                paint: {
                    'fill-color': '#06D9FA',
                    'fill-opacity': 0.35,
                    'fill-outline-color': '#4632DA'
                }
            });
        } else if (firstGeomType.includes('LineString')) {
            map.addLayer({
                id: activeLayerId,
                type: 'line',
                source: activeSourceId,
                paint: {
                    'line-color': '#06D9FA',
                    'line-width': 3,
                    'line-opacity': 0.8
                }
            });
        } else {
            map.addLayer({
                id: activeLayerId,
                type: 'circle',
                source: activeSourceId,
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#06D9FA',
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': '#4632DA'
                }
            });
        }

        fitMapToBounds(data);

        statusText.innerHTML = `Loaded: <strong>${fileName}</strong><br/>
            <button onclick="downloadAsKML('${fileName}')" class="btn-outline" style="margin-top: 8px; font-size:10px; padding: 4px 8px; border-radius:4px; cursor:pointer;">
                <i class="fa fa-file-code"></i> Export as KML
            </button>
            <button onclick="clearPreviewLayer()" class="btn-outline" style="margin-top: 8px; font-size:10px; padding: 4px 8px; border-radius:4px; cursor:pointer; margin-left: 6px; color:#ef4444; border-color: rgba(239, 68, 68, 0.2);">
                Clear Map
            </button>
        `;
        legend.style.display = 'flex';
        legendLabel.innerText = fileName;

    } catch (error) {
        console.error("Preview error:", error);
        statusText.innerHTML = `<span style="color:#f87171;"><i class="fa fa-exclamation-circle"></i> Error displaying preview. Direct download the file below to view in QGIS.</span>`;
        legend.style.display = 'none';
    }
}

function clearPreviewLayer() {
    if (map && map.getLayer(activeLayerId)) map.removeLayer(activeLayerId);
    if (map && map.getSource(activeSourceId)) map.removeSource(activeSourceId);
    
    activeLayerId = null;
    activeSourceId = null;
    currentPreviewGeoJSON = null;

    const el = document.getElementById('preview-status');
    if (el) el.innerText = "Select a vector dataset to overlay it on the map.";
    const leg = document.getElementById('legend-container');
    if (leg) leg.style.display = 'none';
}

function fitMapToBounds(geojson) {
    let coordinates = [];
    
    function extractCoords(geom) {
        if (!geom) return;
        if (geom.type === 'Point') {
            coordinates.push(geom.coordinates);
        } else if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
            coordinates.push(...geom.coordinates);
        } else if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
            geom.coordinates.forEach(ring => coordinates.push(...ring));
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach(poly => poly.forEach(ring => coordinates.push(...ring)));
        } else if (geom.type === 'GeometryCollection') {
            geom.geometries.forEach(extractCoords);
        }
    }

    if (geojson.type === 'FeatureCollection') {
        geojson.features.forEach(f => extractCoords(f.geometry));
    } else if (geojson.type === 'Feature') {
        extractCoords(geojson.geometry);
    } else {
        extractCoords(geojson);
    }

    if (coordinates.length === 0) return;

    let bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
    }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

    map.fitBounds(bounds, {
        padding: 60,
        maxZoom: 14
    });
}

// ==========================================
// 9. Client-Side KML Converter Engine
// ==========================================
function downloadAsKML(fileName) {
    if (!currentPreviewGeoJSON) return;
    
    const kmlName = fileName.replace(/\.[^/.]+$/, "") + ".kml";
    
    function serializeCoords(coords, type) {
        if (type === 'Point') {
            return `${coords[0]},${coords[1]},0`;
        } else if (type === 'LineString' || type === 'MultiPoint') {
            return coords.map(c => `${c[0]},${c[1]},0`).join(' ');
        } else if (type === 'Polygon') {
            return coords[0].map(c => `${c[0]},${c[1]},0`).join(' ');
        }
        return '';
    }

    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${kmlName}</name>
    <Style id="geodemia-style">
      <LineStyle>
        <color>ffda3246</color>
        <width>3</width>
      </LineStyle>
      <PolyStyle>
        <color>7fda3246</color>
      </PolyStyle>
    </Style>
`;

    const features = currentPreviewGeoJSON.type === 'FeatureCollection' ? currentPreviewGeoJSON.features : [currentPreviewGeoJSON];
    
    features.forEach((f, idx) => {
        if (!f.geometry) return;
        
        const type = f.geometry.type;
        const coords = f.geometry.coordinates;
        const nameVal = f.properties && (f.properties.name || f.properties.id) ? f.properties.name || f.properties.id : `Feature ${idx + 1}`;
        
        kml += `    <Placemark>
      <name>${nameVal}</name>
      <styleUrl>#geodemia-style</styleUrl>
`;

        if (type === 'Point') {
            kml += `      <Point>
        <coordinates>${serializeCoords(coords, type)}</coordinates>
      </Point>\n`;
        } else if (type === 'LineString') {
            kml += `      <LineString>
        <coordinates>${serializeCoords(coords, type)}</coordinates>
      </LineString>\n`;
        } else if (type === 'Polygon') {
            kml += `      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${serializeCoords(coords, type)}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>\n`;
        } else if (type === 'MultiPolygon') {
            kml += `      <MultiGeometry>\n`;
            coords.forEach(poly => {
                kml += `        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${serializeCoords(poly, 'Polygon')}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>\n`;
            });
            kml += `      </MultiGeometry>\n`;
        } else if (type === 'MultiLineString') {
            kml += `      <MultiGeometry>\n`;
            coords.forEach(line => {
                kml += `        <LineString>
          <coordinates>${serializeCoords(line, 'LineString')}</coordinates>
        </LineString>\n`;
            });
            kml += `      </MultiGeometry>\n`;
        }
        
        kml += `    </Placemark>\n`;
    });

    kml += `  </Document>
</kml>`;

    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = kmlName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ==========================================
// 10. Event Listeners Initialization
// ==========================================
function initEvents() {
    // Search Box Listener
    const searchInput = document.getElementById('dataset-search');
    const clearBtn = document.getElementById('clear-search');

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (searchInput.value.trim().length > 0) {
                clearBtn.style.display = 'block';
            } else {
                clearBtn.style.display = 'none';
            }
            filterDatasets();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            filterDatasets();
        });
    }

    // Category Pills Listener
    const pills = document.querySelectorAll('.category-pills .pill');
    pills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            pills.forEach(p => p.classList.remove('active'));
            e.currentTarget.classList.add('active');
            filterDatasets();
        });
    });

    // Dropdown filters
    const formatSel = document.getElementById('format-select');
    const sortSel = document.getElementById('sort-select');
    if (formatSel) formatSel.addEventListener('change', filterDatasets);
    if (sortSel) sortSel.addEventListener('change', filterDatasets);

    // Drawer close buttons
    const drawerCl = document.getElementById('drawer-close');
    const drawerBack = document.getElementById('drawer-backdrop');
    if (drawerCl) drawerCl.addEventListener('click', closeDrawer);
    if (drawerBack) drawerBack.addEventListener('click', closeDrawer);

    // Login Form Submit (Redirects to App)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            window.location.hash = '#/app';
        });
    }

    // OAuth logins mock
    const googleLogin = document.getElementById('btn-google-login');
    const githubLogin = document.getElementById('btn-github-login');
    if (googleLogin) googleLogin.addEventListener('click', () => window.location.hash = '#/app');
    if (githubLogin) githubLogin.addEventListener('click', () => window.location.hash = '#/app');

    // Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.location.hash = '#/';
        });
    }

    // AI Scraper suggestion pills click
    document.querySelectorAll('.suggestion-pills .sugg-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            const query = e.currentTarget.dataset.query;
            const input = document.getElementById('ai-scraper-query');
            if (input) input.value = query;
        });
    });

    // Run Scraper Button
    const runScraperBtn = document.getElementById('btn-run-scraper');
    if (runScraperBtn) {
        runScraperBtn.addEventListener('click', runAIScraperAgent);
    }
}

// ==========================================
// 10B. AI Agent Scraper & Geocoding Logic
// ==========================================

// Switch sidebar tabs
window.switchSidebarTab = function(tabName) {
    document.querySelectorAll('.sidebar-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.sidebar-tab-content').forEach(pane => {
        pane.classList.remove('active');
    });

    if (tabName === 'catalog') {
        document.getElementById('tab-btn-catalog').classList.add('active');
        document.getElementById('tab-content-catalog').classList.add('active');
    } else if (tabName === 'scraper') {
        document.getElementById('tab-btn-scraper').classList.add('active');
        document.getElementById('tab-content-scraper').classList.add('active');
    }
};

// Log printer inside the console terminal
function printConsoleLine(consoleId, text, type = 'info') {
    const consoleBody = document.getElementById(consoleId);
    if (!consoleBody) return;
    
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.innerHTML = `[${new Date().toLocaleTimeString()}] ${text}`;
    consoleBody.appendChild(line);
    consoleBody.scrollTop = consoleBody.scrollHeight;
}

// Mock databases matching suggestions and queries
const MOCK_SCRAPE_DATA = {
    "delhi": {
        name: "NCT of Delhi State Boundary",
        description: "Scraped official administrative boundary of National Capital Territory (NCT) of Delhi, India. Sourced from Survey of India database.",
        area: "1,484 Sq Km",
        confidence: "100% (Verified State Boundary)",
        source: "Survey of India Spatial Portal (GeoGov)",
        geojson: {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [77.20, 28.41],
                            [77.10, 28.42],
                            [77.05, 28.48],
                            [76.85, 28.53],
                            [76.83, 28.65],
                            [76.92, 28.80],
                            [77.08, 28.85],
                            [77.18, 28.88],
                            [77.22, 28.75],
                            [77.33, 28.63],
                            [77.31, 28.58],
                            [77.25, 28.45],
                            [77.20, 28.41]
                        ]]
                    },
                    "properties": {
                        "name": "NCT of Delhi State Boundary",
                        "country": "India",
                        "type": "Union Territory",
                        "capital": "New Delhi",
                        "districts": "11",
                        "population": "~19,000,000"
                    }
                }
            ]
        }
    },
    "metro": {
        name: "Delhi Metro Line 3 Stations & Track",
        description: "Scraped coordinate mapping of Delhi Metro Blue Line (Line 3) stations and tracks, including ridership and transit metadata.",
        area: "N/A (Linear corridor)",
        confidence: "99% (Verified)",
        source: "OpenStreetMap + Delhi Metro Rail Corp (DMRC)",
        geojson: {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [77.2183, 28.6304], // Rajiv Chowk
                            [77.2081, 28.6347], // RK Ashram Marg
                            [77.1990, 28.6385], // Jhandewalan
                            [77.1887, 28.6432], // Karol Bagh
                            [77.1783, 28.6425], // Rajendra Place
                            [77.1558, 28.6517]  // Shadipur
                        ]
                    },
                    "properties": {
                        "name": "Blue Line Track",
                        "color": "#00a0e9",
                        "width": 5
                    }
                },
                { "type": "Feature", "geometry": { "type": "Point", "coordinates": [77.2183, 28.6304] }, "properties": { "name": "Rajiv Chowk Station", "ridership": "2.4M/day", "line": "Blue / Yellow interchange" } },
                { "type": "Feature", "geometry": { "type": "Point", "coordinates": [77.1887, 28.6432] }, "properties": { "name": "Karol Bagh Station", "ridership": "800K/day", "line": "Blue" } },
                { "type": "Feature", "geometry": { "type": "Point", "coordinates": [77.1783, 28.6425] }, "properties": { "name": "Rajendra Place Station", "ridership": "650K/day", "line": "Blue" } }
            ]
        }
    },
    "taj": {
        name: "Taj Mahal Complex Sanctuary Bounds",
        description: "Protected UNESCO World Heritage outer walls and spatial footprint of the Taj Mahal mausoleum, Yamuna river edge, and Mughal gardens in Agra.",
        area: "0.28 Sq Km",
        confidence: "98% (High)",
        source: "Archaeological Survey of India (ASI) spatial geoportals",
        geojson: {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [78.0400, 27.1730],
                            [78.0440, 27.1730],
                            [78.0440, 27.1770],
                            [78.0400, 27.1770],
                            [78.0400, 27.1730]
                        ]]
                    },
                    "properties": {
                        "name": "Taj Mahal Outer Complex Boundary",
                        "class": "Heritage Zone",
                        "height_limit": "200m radius buffer"
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [78.0421, 27.1750]
                    },
                    "properties": {
                        "name": "Taj Mahal Dome",
                        "elevation": "171m",
                        "built_by": "Shah Jahan"
                    }
                }
            ]
        }
    },
    "gir": {
        name: "Gir National Park Boundary Sanctuary",
        description: "Evolutionary spatial boundary outlines of Gir National Park and Wildlife Sanctuary, Gujarat. The primary habitat of Asiatic Lions.",
        area: "1,412 Sq Km",
        confidence: "95% (Geocoded)",
        source: "Ministry of Environment & Forests (MoEF) geospatial layer",
        geojson: {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [70.4500, 21.0500],
                            [70.8500, 21.0100],
                            [70.9200, 21.2800],
                            [70.5800, 21.3200],
                            [70.4500, 21.0500]
                        ]]
                    },
                    "properties": {
                        "name": "Gir Forest Reserve Zone",
                        "lions_count": "~674 (2020 census)",
                        "vegetation": "Teak dominated dry deciduous forest"
                    }
                }
            ]
        }
    },
    "bangalore": {
        name: "Bangalore Tech Hubs & IT Parks",
        description: "Scraped spatial footprints representing Manyata Tech Park, ITPL Whitefield, and Electronic City IT Corridor in Bengaluru, Karnataka.",
        area: "42 Sq Km (Combined)",
        confidence: "96% (Multi-source geocoded)",
        source: "Bruhat Bengaluru Mahanagara Palike (BBMP) Open Spatial Hub",
        geojson: {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [77.6180, 13.0420],
                            [77.6260, 13.0420],
                            [77.6260, 13.0480],
                            [77.6180, 13.0480],
                            [77.6180, 13.0420]
                        ]]
                    },
                    "properties": {
                        "name": "Manyata Embassy Business Park",
                        "companies": "Cognizant, IBM, Target, Rolls Royce",
                        "employees": "~150,000"
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [77.7340, 12.9830],
                            [77.7400, 12.9830],
                            [77.7400, 12.9890],
                            [77.7340, 12.9890],
                            [77.7340, 12.9830]
                        ]]
                    },
                    "properties": {
                        "name": "International Tech Park Bangalore (ITPL)",
                        "companies": "TCS, Oracle, SAP, General Motors",
                        "employees": "~80,000"
                    }
                }
            ]
        }
    }
};

const CITY_COORDS = {
    "delhi": [77.2090, 28.6139],
    "mumbai": [72.8777, 19.0760],
    "kolkata": [88.3639, 22.5726],
    "chennai": [80.2707, 13.0827],
    "hyderabad": [78.4867, 17.3850],
    "pune": [73.8567, 18.5204],
    "bangalore": [77.5946, 12.9716],
    "bengaluru": [77.5946, 12.9716],
    "agra": [78.0081, 27.1767],
    "gujarat": [71.1924, 22.2587]
};

// Run the Agent Scraper Loop (Step-by-step console simulation)
async function runAIScraperAgent() {
    const queryInput = document.getElementById('ai-scraper-query');
    const runBtn     = document.getElementById('btn-run-scraper');
    const consoleDiv = document.getElementById('scraper-console');
    const consoleBody = document.getElementById('scraper-console-lines');

    if (!queryInput || !queryInput.value.trim()) {
        alert("Please enter what you want the AI Agent to scrape.");
        return;
    }

    const query = queryInput.value.trim().toLowerCase();
    
    // Disable inputs during scraping run
    runBtn.disabled = true;
    queryInput.disabled = true;
    consoleDiv.style.display = 'block';
    consoleBody.innerHTML = ''; // clear logs

    printConsoleLine('scraper-console-lines', `Initializing Geodemia Scraper LLM agent...`, 'info');
    
    // Sequence of steps to display
    const steps = [
        { text: `Analyzing scrape target: "${query}"`, delay: 800, type: 'info' },
        { text: `Activating LLM Geocoder & Scraping Planner...`, delay: 1500, type: 'info' },
        { text: `Searching OpenStreetMap api & scraping spatial coordinates...`, delay: 2400, type: 'info' },
        { text: `Resolving boundary topology matching tag criteria...`, delay: 3200, type: 'info' },
        { text: `Scraping Wikipedia metadata & geocoded attributes...`, delay: 4000, type: 'info' },
        { text: `Compiling parsed coordinate pairs into geojson structure...`, delay: 4800, type: 'info' },
        { text: `Agent Finished. 1 GeoJSON feature collection compiled.`, delay: 5400, type: 'success' }
    ];

    for (const step of steps) {
        await new Promise(resolve => setTimeout(resolve, step.delay - (steps.indexOf(step) > 0 ? steps[steps.indexOf(step)-1].delay : 0)));
        printConsoleLine('scraper-console-lines', step.text, step.type);
    }

    // Determine spatial payload matching query keywords
    let matchedKey = 'fallback';
    if (query.includes('metro') || query.includes('station') || query.includes('rail')) matchedKey = 'metro';
    else if (query.includes('delhi')) matchedKey = 'delhi';
    else if (query.includes('taj') || query.includes('mahal') || query.includes('agra')) matchedKey = 'taj';
    else if (query.includes('gir') || query.includes('sanctuary') || query.includes('lion')) matchedKey = 'gir';
    else if (query.includes('bangalore') || query.includes('tech') || query.includes('it park') || query.includes('bengaluru')) matchedKey = 'bangalore';

    let resultPayload = null;

    if (matchedKey !== 'fallback') {
        resultPayload = MOCK_SCRAPE_DATA[matchedKey];
    } else {
        // Fallback geocoder based on city names
        let center = [78.9629, 20.5937]; // India center
        let matchedCity = "India Custom Area";
        for (const city in CITY_COORDS) {
            if (query.includes(city)) {
                center = CITY_COORDS[city];
                matchedCity = city.charAt(0).toUpperCase() + city.slice(1);
                break;
            }
        }

        // Generate a 5-sided polygon centered there
        const polyCoords = [];
        const numSides = 5;
        const radius = 0.035; // approx 3-4 km size
        for (let i = 0; i <= numSides; i++) {
            const angle = (i / numSides) * Math.PI * 2;
            const x = center[0] + Math.cos(angle) * radius * 1.3;
            const y = center[1] + Math.sin(angle) * radius;
            polyCoords.push([x, y]);
        }

        resultPayload = {
            name: `Scraped: ${query.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
            description: `Real-time AI agent scrape of boundaries matching: "${query}". Located in/near ${matchedCity}, geocoded via global spatial references.`,
            area: "~14.8 Sq Km",
            confidence: "91% (Estimated coordinates)",
            source: "AI Geocoder scraper + GeoNames spatial database",
            geojson: {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [polyCoords]
                        },
                        "properties": {
                            "name": `${query} Scraped Boundary`,
                            "scraped_on": new Date().toISOString().split('T')[0],
                            "geocoder": "Gemini-spatial-v1.2"
                        }
                    }
                ]
            }
        };
    }

    // Plot spatial boundary on Map
    clearPreviewLayer();

    try {
        const data = resultPayload.geojson;
        currentPreviewGeoJSON = data;
        activeSourceId = 'preview-source';
        activeLayerId = 'preview-layer';

        map.addSource(activeSourceId, {
            type: 'geojson',
            data: data
        });

        const firstGeomType = data.features[0].geometry ? data.features[0].geometry.type : '';
        
        if (firstGeomType.includes('Polygon')) {
            map.addLayer({
                id: activeLayerId,
                type: 'fill',
                source: activeSourceId,
                paint: {
                    'fill-color': '#FF9933', // saffron glow for scraped boundaries
                    'fill-opacity': 0.32,
                    'fill-outline-color': '#138808' // green boundary outline
                }
            });
        } else if (firstGeomType.includes('LineString')) {
            map.addLayer({
                id: activeLayerId,
                type: 'line',
                source: activeSourceId,
                paint: {
                    'line-color': '#FF9933',
                    'line-width': 4,
                    'line-opacity': 0.85
                }
            });
        } else {
            map.addLayer({
                id: activeLayerId,
                type: 'circle',
                source: activeSourceId,
                paint: {
                    'circle-radius': 8,
                    'circle-color': '#FF9933',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#138808'
                }
            });
        }

        // Fit map bounds
        fitMapToBounds(data);

        // Open details drawer displaying the scraped properties
        openScrapedDrawer(resultPayload);

        // Update status text on overlay card
        const statusText = document.getElementById('preview-status');
        const legend = document.getElementById('legend-container');
        const legendLabel = document.getElementById('legend-label');
        
        if (statusText) {
            statusText.innerHTML = `Loaded: <strong>${resultPayload.name}</strong><br/>
                <button onclick="clearPreviewLayer()" class="btn-outline" style="margin-top: 8px; font-size:10px; padding: 4px 8px; border-radius:4px; cursor:pointer; color:#ef4444; border-color: rgba(239, 68, 68, 0.2);">
                    Clear Map
                </button>
            `;
        }
        if (legend) {
            legend.style.display = 'flex';
            legendLabel.innerText = resultPayload.name;
        }

    } catch(err) {
        console.error("Agent boundary plotting error:", err);
    }

    // Re-enable inputs
    runBtn.disabled = false;
    queryInput.disabled = false;
}

// Display scraped properties in drawer
function openScrapedDrawer(payload) {
    const drawerContent = document.getElementById('drawer-content');
    if (!drawerContent) return;

    // Convert GeoJSON properties to beautiful key-value table
    const props = payload.geojson.features[0].properties || {};
    let propsHtml = '';
    for (const key in props) {
        const readableKey = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        propsHtml += `
            <div class="property-row">
                <span class="prop-key">${readableKey}</span>
                <span class="prop-val">${props[key]}</span>
            </div>
        `;
    }

    drawerContent.innerHTML = `
        <div class="detail-header" style="border-bottom-color: rgba(255, 153, 51, 0.2);">
            <span class="category" style="background: rgba(255, 153, 51, 0.15); color: #FF9933; border: 1px solid rgba(255, 153, 51, 0.3);">
                🤖 AI Agent Scrape
            </span>
            <h2>${payload.name}</h2>
            <div class="detail-meta-tags">
                <span class="meta-tag"><i class="fa fa-chart-area"></i> Area: ${payload.area}</span>
                <span class="meta-tag"><i class="fa fa-info-circle"></i> Confidence: ${payload.confidence}</span>
            </div>
        </div>
        
        <p class="detail-desc">${payload.description}</p>
        
        <div class="scraped-meta-section">
            <h3>Scrape Metadata</h3>
            <div class="meta-grid">
                <div class="meta-grid-item">
                    <span class="meta-label">Scraped Source</span>
                    <span class="meta-value">${payload.source}</span>
                </div>
                <div class="meta-grid-item">
                    <span class="meta-label">Scraper Engine</span>
                    <span class="meta-value">Gemini OpenStreetMap Crawler v1.2</span>
                </div>
            </div>
        </div>

        <div class="properties-section" style="margin-top: 24px;">
            <h3>Boundaries Geocoded Attributes</h3>
            <div class="properties-table">
                ${propsHtml}
            </div>
        </div>

        <div class="drawer-actions-panel" style="margin-top: 30px;">
            <button onclick="downloadGeoJSONDirect('${payload.name}')" class="download-btn btn-primary" style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 8px;">
                <i class="fa fa-file-export"></i> Download Scraped GeoJSON
            </button>
        </div>
    `;

    document.getElementById('drawer-backdrop').classList.add('active');
    document.getElementById('details-drawer').classList.add('active');
}

// Direct downloader for dynamic scraped GeoJSON
window.downloadGeoJSONDirect = function(fileName) {
    if (!currentPreviewGeoJSON) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentPreviewGeoJSON, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${fileName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.geojson`);
    dlAnchorElem.click();
};


// ==========================================
// 11. Startup Launch
// ==========================================

window._landingAnimator = null; // globally accessible for transition code

function startApp() {
    console.log("Geodemia AI logic engine starting...");
    initRouter();
    initEvents();

    // Start Interactive Particle Systems
    window._landingAnimator = new ParticleAnimator('particles-canvas');
    new ParticleAnimator('login-particles');

    initLandingHoverEffects();
    initBlackHoleTransition();
}

// ─── Hover micro-interactions ────────────────────────────────────────────────
function initLandingHoverEffects() {
    const landing    = document.getElementById('landing-view');
    const heroCard   = document.querySelector('.hero-content');
    const ctaBtns    = document.querySelectorAll('.cta-btn');
    const connectBtn = document.querySelector('.connect-btn');

    if (!landing) return;

    // 1. Cursor spotlight via CSS custom properties
    landing.addEventListener('mousemove', e => {
        const rect = landing.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1) + '%';
        const my = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1) + '%';
        landing.style.setProperty('--mx', mx);
        landing.style.setProperty('--my', my);

        // 2. Hero card 3D parallax tilt (max ±4°) — relative to screen center (where BH is)
        if (heroCard) {
            const cx = rect.width  / 2;
            const cy = rect.height / 2;
            const dx = (e.clientX - rect.left - cx) / cx;
            const dy = (e.clientY - rect.top  - cy) / cy;
            // Card tilts slightly toward the black hole center
            heroCard.style.transform =
                `perspective(700px) rotateX(${(-dy * 2.5).toFixed(2)}deg) rotateY(${(dx * 2.5).toFixed(2)}deg) translateZ(6px)`;
        }
    });

    landing.addEventListener('mouseleave', () => {
        if (heroCard) heroCard.style.transform =
            'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0)';
    });

    // 3. Magnetic button drift
    function addMagnetic(btn) {
        if (!btn) return;
        btn.addEventListener('mousemove', e => {
            const r  = btn.getBoundingClientRect();
            const bx = e.clientX - (r.left + r.width  / 2);
            const by = e.clientY - (r.top  + r.height / 2);
            btn.style.transform = `translate(${bx * 0.22}px, ${by * 0.22}px) scale(1.04)`;
        });
        btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    }
    ctaBtns.forEach(addMagnetic);
    addMagnetic(connectBtn);

    // 4. Nav ripple on click
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.addEventListener('click', function() {
            const ripple = document.createElement('span');
            ripple.style.cssText = `position:absolute;border-radius:50%;pointer-events:none;
                width:6px;height:6px;background:rgba(70,50,218,0.35);
                top:50%;left:50%;transform:translate(-50%,-50%) scale(0);
                animation:rippleOut 0.5s ease forwards;`;
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });

    if (!document.getElementById('ripple-style')) {
        const s = document.createElement('style');
        s.id = 'ripple-style';
        s.textContent = `@keyframes rippleOut{to{transform:translate(-50%,-50%) scale(22);opacity:0;}}`;
        document.head.appendChild(s);
    }
}

// ─── Cinematic black-hole-swallow page transition ────────────────────────────
function initBlackHoleTransition() {
    // Inject overlay CSS once
    if (!document.getElementById('bh-transition-style')) {
        const s = document.createElement('style');
        s.id = 'bh-transition-style';
        s.textContent = `
            #bh-swallow-overlay {
                position: fixed;
                inset: 0;
                z-index: 9999;
                pointer-events: none;
                opacity: 0;
            }
            #bh-swallow-overlay.active { pointer-events: all; }
            #bh-swallow-circle {
                position: absolute;
                border-radius: 50%;
                left: 50%; top: 50%;
                transform: translate(-50%, -50%) scale(0);
                transform-origin: center center;
                will-change: transform;
                background: radial-gradient(circle at 50% 50%,
                    #000000 0%,
                    #000000 52%,
                    rgba(255, 218, 80,  0.95) 59%,
                    rgba(255, 130, 30,  0.70) 67%,
                    rgba(200,  60,  5,  0.30) 76%,
                    transparent 86%
                );
                box-shadow:
                    0 0 60px 20px rgba(255,200,60,0.18),
                    0 0 180px 60px rgba(251,146,60,0.07);
            }
        `;
        document.head.appendChild(s);
    }

    // Build overlay element
    let overlay = document.getElementById('bh-swallow-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'bh-swallow-overlay';
        const circle = document.createElement('div');
        circle.id    = 'bh-swallow-circle';
        overlay.appendChild(circle);
        document.body.appendChild(overlay);
    }

    // Intercept "Launch Application" button (href="#/login")
    const launchBtn = document.querySelector('a.btn-glowing[href="#/login"]');
    if (!launchBtn) return;

    launchBtn.addEventListener('click', function(e) {
        e.preventDefault();

        const circle = document.getElementById('bh-swallow-circle');
        const diag   = Math.hypot(window.innerWidth, window.innerHeight) * 2.4;

        // Start size = current black hole diameter
        const R = window._landingAnimator ? window._landingAnimator.getR() : 100;
        const startPx = R * 2;

        // Reset to black hole size
        circle.style.transition = 'none';
        circle.style.width  = startPx + 'px';
        circle.style.height = startPx + 'px';
        circle.style.transform = 'translate(-50%, -50%) scale(1)';
        overlay.style.opacity = '1';
        overlay.style.transition = 'none';
        overlay.classList.add('active');

        requestAnimationFrame(() => requestAnimationFrame(() => {

            // Step 1 — implode to a singularity (200ms)
            circle.style.transition =
                'transform 0.20s cubic-bezier(0.55,0,1,0.45)';
            circle.style.transform = 'translate(-50%, -50%) scale(0.04)';

            setTimeout(() => {
                // Step 2 — EXPLODE outward engulfing the screen (500ms)
                circle.style.transition =
                    'transform 0.50s cubic-bezier(0.22,1,0.36,1), width 0.50s, height 0.50s';
                circle.style.width  = diag + 'px';
                circle.style.height = diag + 'px';
                circle.style.transform = 'translate(-50%, -50%) scale(1)';

                setTimeout(() => {
                    // Step 3 — Navigate
                    window.location.hash = '#/login';

                    // Step 4 — Fade overlay out
                    setTimeout(() => {
                        overlay.style.transition = 'opacity 0.3s ease';
                        overlay.style.opacity = '0';
                        setTimeout(() => {
                            overlay.classList.remove('active');
                            circle.style.transition = 'none';
                            circle.style.transform  = 'translate(-50%, -50%) scale(0)';
                            circle.style.width  = startPx + 'px';
                            circle.style.height = startPx + 'px';
                        }, 320);
                    }, 120);

                }, 480);
            }, 210);

        }));
    });
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
