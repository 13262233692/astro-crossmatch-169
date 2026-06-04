import { CatalogLoader } from './catalog.js';
import { CrossMatcher } from './crossmatch.js';
import { StarRenderer } from './renderer.js';
import { MagnitudePlot } from './magplot.js';
import { StarClusterDetector } from './cluster.js';

class App {
    constructor() {
        this.gaiaSources = [];
        this.twomassSources = [];
        this.matchResult = null;
        this.clusterResult = null;
        this.showClusterColors = true;
        this.renderer = null;
        this.magPlot = null;
        this._init();
    }

    _init() {
        this.renderer = new StarRenderer(document.getElementById('three-viewport'));
        this.magPlot = new MagnitudePlot('mag-canvas', 'sed-canvas', 'hr-canvas');

        this.renderer.onStarClick = (data) => this._onStarClick(data);
        this.renderer.onStarHover = (data) => this._onStarHover(data);

        this.magPlot.onHRPointClick = (source) => {
            if (source) {
                this.renderer.highlightStar(source);
                this._showStarDetail(source, null, source._clusterId !== undefined ? source._clusterId : -1);
            }
        };

        this._bindControls();
        this.magPlot.drawMagnitudes(null);
        this.magPlot.drawSED(null);
        this.magPlot.drawHRDiagram(null);
    }

    _bindControls() {
        const gaiaSlider = document.getElementById('gaia-count');
        const gaiaVal = document.getElementById('gaia-count-val');
        gaiaSlider.addEventListener('input', () => { gaiaVal.textContent = gaiaSlider.value; });

        const twomassSlider = document.getElementById('twomass-count');
        const twomassVal = document.getElementById('twomass-count-val');
        twomassSlider.addEventListener('input', () => { twomassVal.textContent = twomassSlider.value; });

        document.getElementById('btn-load').addEventListener('click', () => this._loadCatalogs());
        document.getElementById('btn-match').addEventListener('click', () => this._runCrossMatch());
        document.getElementById('btn-cluster').addEventListener('click', () => this._runClusterDetection());

        document.getElementById('show-gaia').addEventListener('change', (e) => {
            this.renderer.showGaia = e.target.checked;
            this.renderer.updateVisibility();
        });
        document.getElementById('show-twomass').addEventListener('change', (e) => {
            this.renderer.show2MASS = e.target.checked;
            this.renderer.updateVisibility();
        });
        document.getElementById('show-matched').addEventListener('change', (e) => {
            this.renderer.showMatched = e.target.checked;
            this.renderer.updateVisibility();
        });

        document.getElementById('show-cluster').addEventListener('change', (e) => {
            this.showClusterColors = e.target.checked;
            this._updateClusterDisplay();
        });

        document.getElementById('point-size').addEventListener('input', (e) => {
            this.renderer.updatePointSize(parseFloat(e.target.value));
        });

        document.getElementById('bg-color').addEventListener('input', (e) => {
            this.renderer.updateBackground(e.target.value);
        });

        const pmToggle = document.getElementById('apply-pm');
        const pmHint = document.getElementById('pm-hint');
        if (pmToggle) {
            pmToggle.addEventListener('change', (e) => {
                if (pmHint) {
                    pmHint.textContent = e.target.checked ? '✅ 已启用' : '⚠️ 高自行星可能丢失';
                    pmHint.className = e.target.checked ? 'pm-hint pm-on' : 'pm-hint pm-off';
                }
            });
        }
    }

    _loadCatalogs() {
        const gaiaCount = parseInt(document.getElementById('gaia-count').value);
        const twomassCount = parseInt(document.getElementById('twomass-count').value);
        const centerRA = parseFloat(document.getElementById('center-ra').value);
        const centerDec = parseFloat(document.getElementById('center-dec').value);
        const radius = parseFloat(document.getElementById('field-radius').value);

        this.renderer.centerRA = centerRA;
        this.renderer.centerDec = centerDec;
        this.renderer.radius = radius;
        this.renderer.rebuildGrid();

        this.gaiaSources = CatalogLoader.generateGaia(gaiaCount, centerRA, centerDec, radius);
        this.twomassSources = CatalogLoader.generate2MASS(twomassCount, centerRA, centerDec, radius);
        CatalogLoader.generateOverlap(this.gaiaSources, this.twomassSources, 0.3);

        this.matchResult = null;
        this.clusterResult = null;
        this._renderCatalogs();

        document.getElementById('stat-gaia').textContent = gaiaCount;
        document.getElementById('stat-twomass').textContent = twomassCount;
        document.getElementById('stat-matched').textContent = '-';
        document.getElementById('stat-rate').textContent = '-';
        document.getElementById('stat-time').textContent = '-';
        document.getElementById('stat-pm').textContent = '-';
        document.getElementById('stat-highpm').textContent = '-';
        document.getElementById('stats-info').textContent = `已加载: Gaia ${gaiaCount} (J2016.0) + 2MASS ${twomassCount} (J2000.0)`;

        document.getElementById('btn-match').disabled = false;
        document.getElementById('btn-cluster').disabled = false;
        document.getElementById('cluster-list').innerHTML =
            '<span class="cluster-hint">点击"识别星团"进行DBSCAN聚类</span>';

        this.magPlot.drawMagnitudes(null);
        this.magPlot.drawSED(null);
        this.magPlot.drawHRDiagram(this.gaiaSources, null, null);
    }

    _renderCatalogs() {
        this.renderer.clearStars();
        this.renderer.renderSources(this.gaiaSources, 'gaia');
        this.renderer.renderSources(this.twomassSources, '2mass');
    }

    _runClusterDetection() {
        if (this.gaiaSources.length === 0) return;

        const epsilon = parseFloat(document.getElementById('cluster-epsilon').value);
        const minPts = parseInt(document.getElementById('cluster-minpts').value);

        const detector = new StarClusterDetector(epsilon, minPts);
        this.clusterResult = detector.dbscan(this.gaiaSources);

        for (const cluster of this.clusterResult.clusters) {
            for (const idx of cluster.indices) {
                this.gaiaSources[idx]._clusterId = cluster.id;
                this.gaiaSources[idx]._clusterName = cluster.name;
                this.gaiaSources[idx]._clusterColor = cluster.color;
            }
        }

        this._updateClusterDisplay();

        const clusterListEl = document.getElementById('cluster-list');
        let clusterHtml = '';
        for (const cluster of this.clusterResult.clusters) {
            if (cluster.isField) continue;
            clusterHtml += `<div class="cluster-item" data-cid="${cluster.id}"
                style="border-left-color: ${'#' + cluster.color.toString(16).padStart(6, '0')}">
                <span class="cluster-name">${cluster.name}</span>
                <span class="cluster-size">${cluster.size} 星</span>
                </div>`;
        }
        if (clusterHtml === '') {
            clusterHtml = '<span class="cluster-hint">未检测到显著星团</span>';
        }
        clusterListEl.innerHTML = clusterHtml;

        clusterListEl.querySelectorAll('.cluster-item').forEach(item => {
            item.addEventListener('click', () => {
                const cid = parseInt(item.dataset.cid);
                this._highlightCluster(cid);
            });
        });

        document.getElementById('stats-info').textContent =
            `星团检测完成: ${this.clusterResult.nClusters} 个星团 / ${this.clusterResult.nClusters > 0 ? this.clusterResult.clusters.filter(c => !c.isField)[0].size : 0} 最大成员数`;
    }

    _updateClusterDisplay() {
        if (!this.clusterResult) {
            this._renderCatalogs();
            this.magPlot.drawHRDiagram(this.gaiaSources, null, null);
            return;
        }

        if (this.matchResult) {
            this._runCrossMatch();
        } else {
            this.renderer.clearStars();

            if (this.showClusterColors) {
                for (const cluster of this.clusterResult.clusters) {
                    const sources = cluster.indices.map(i => this.gaiaSources[i]);
                    this.renderer.renderSources(sources, cluster.isField ? 'gaia' : 'cluster-' + cluster.id);
                    const mesh = this.renderer.starMeshes[this.renderer.starMeshes.length - 1];
                    mesh._sourceData = sources.map(s => ({ source: s, type: cluster.isField ? 'gaia' : 'cluster' }));
                    mesh.material.color.setHex(cluster.color);
                }
            } else {
                this.renderer.renderSources(this.gaiaSources, 'gaia');
            }

            this.renderer.renderSources(this.twomassSources, '2mass');
        }

        this.magPlot.drawHRDiagram(this.gaiaSources, this.clusterResult.clusters, null);
    }

    _highlightCluster(clusterId) {
        const cluster = this.clusterResult.clusters.find(c => c.id === clusterId);
        if (!cluster || cluster.isField) return;

        if (cluster.indices.length > 0) {
            const firstSource = this.gaiaSources[cluster.indices[0]];
            this.renderer.highlightStar(firstSource);
            this._showStarDetail(firstSource, null, clusterId);
            this.magPlot.drawHRDiagram(this.gaiaSources, this.clusterResult.clusters, firstSource);
        }
    }

    _runCrossMatch() {
        if (this.gaiaSources.length === 0 || this.twomassSources.length === 0) return;

        const nside = parseInt(document.getElementById('healpix-nside').value);
        const radiusArcsec = parseFloat(document.getElementById('match-radius').value);
        const applyPM = document.getElementById('apply-pm').checked;

        const matcher = new CrossMatcher(nside, radiusArcsec, applyPM);
        this.matchResult = matcher.match(this.gaiaSources, this.twomassSources);

        this.renderer.clearStars();

        if (this.clusterResult && this.showClusterColors) {
            const unmatchedByCluster = new Map();
            for (const cluster of this.clusterResult.clusters) {
                unmatchedByCluster.set(cluster.id, []);
            }

            for (const src of this.matchResult.unmatchedGaia) {
                const cid = src._clusterId !== undefined ? src._clusterId : -1;
                if (unmatchedByCluster.has(cid)) {
                    unmatchedByCluster.get(cid).push(src);
                }
            }

            for (const cluster of this.clusterResult.clusters) {
                const sources = unmatchedByCluster.get(cluster.id) || [];
                if (sources.length > 0) {
                    this.renderer.renderSources(sources, cluster.isField ? 'gaia' : 'cluster-' + cluster.id);
                    const mesh = this.renderer.starMeshes[this.renderer.starMeshes.length - 1];
                    mesh._sourceData = sources.map(s => ({ source: s, type: cluster.isField ? 'gaia' : 'cluster' }));
                    mesh.material.color.setHex(cluster.color);
                }
            }
        } else {
            this.renderer.renderSources(this.matchResult.unmatchedGaia, 'gaia');
        }

        this.renderer.renderSources(this.matchResult.unmatched2MASS, '2mass');

        const matchedSources = this.matchResult.matches.map(m => ({
            ...m.gaia,
            ra: m.correctedRA || m.gaia.ra,
            dec: m.correctedDec || m.gaia.dec,
            mag: m.combinedMag,
            _match: m,
            _clusterId: m.gaia._clusterId,
            _clusterName: m.gaia._clusterName,
            _clusterColor: m.gaia._clusterColor
        }));

        if (this.clusterResult && this.showClusterColors) {
            const matchedByCluster = new Map();
            for (const cluster of this.clusterResult.clusters) {
                matchedByCluster.set(cluster.id, []);
            }
            for (const src of matchedSources) {
                const cid = src._clusterId !== undefined ? src._clusterId : -1;
                if (matchedByCluster.has(cid)) {
                    matchedByCluster.get(cid).push(src);
                }
            }

            let sourceIndex = 0;
            for (const cluster of this.clusterResult.clusters) {
                const sources = matchedByCluster.get(cluster.id) || [];
                if (sources.length > 0) {
                    this.renderer.renderSources(sources, 'matched-' + cluster.id);
                    const mesh = this.renderer.starMeshes[this.renderer.starMeshes.length - 1];
                    mesh._sourceData = sources.map(s => {
                        const match = this.matchResult.matches.find(m => m.gaia.id === s.id);
                        return { source: s, type: 'matched', match };
                    });
                    mesh.material.color.setHex(cluster.color);
                }
            }
        } else {
            this.renderer.renderSources(matchedSources, 'matched');
            const matchedMesh = this.renderer.starMeshes[this.renderer.starMeshes.length - 1];
            matchedMesh._sourceData = this.matchResult.matches.map((m, i) => ({
                source: matchedSources[i],
                type: 'matched',
                match: m
            }));
        }

        this.renderer.renderMatchLines(this.matchResult.matches);

        const stats = this.matchResult.stats;
        document.getElementById('stat-gaia').textContent = stats.nGaia;
        document.getElementById('stat-twomass').textContent = stats.n2MASS;
        document.getElementById('stat-matched').textContent = stats.nMatched;
        document.getElementById('stat-rate').textContent = stats.matchRate + '%';
        document.getElementById('stat-time').textContent = stats.elapsedMs + ' ms';
        document.getElementById('stat-pm').textContent = stats.pmApplied ?
            `✅ ${stats.nPMShifted}源修正至J${stats.targetEpoch.toFixed(1)}` : '❌ 未修正';
        document.getElementById('stat-highpm').textContent = stats.highPMRecovered;

        const pmStatus = stats.pmApplied ? '自行修正已启用' : '自行修正已关闭';
        document.getElementById('stats-info').textContent =
            `交叉证认完成: ${stats.nMatched} 匹配 / ${stats.matchRate}% 匹配率 [${pmStatus}]`;

        this.magPlot.drawHRDiagram(this.gaiaSources, this.clusterResult ? this.clusterResult.clusters : null, null);
    }

    _onStarClick(data) {
        if (!data) return;

        const source = data.source;
        const type = data.type;
        const match = data.match || source._match;
        const clusterId = source._clusterId;

        this.renderer.highlightStar(source);
        this._showStarDetail(source, type, clusterId, match);
        this.magPlot.drawHRDiagram(this.gaiaSources, this.clusterResult ? this.clusterResult.clusters : null, source);
    }

    _showStarDetail(source, type, clusterId, match) {
        let html = '';
        html += `<div class="detail-id">${source.id}</div>`;
        html += `<div class="detail-type type-${type || (source.catalog === '2mass' ? '2mass' : 'gaia')}">
            ${type === 'matched' ? '匹配源' : (source.catalog === '2mass' ? '2MASS' : 'Gaia')}
            </div>`;

        if (source._clusterName) {
            const colorHex = source._clusterColor ? '#' + source._clusterColor.toString(16).padStart(6, '0') : '#888888';
            html += `<div class="detail-cluster" style="border-left-color: ${colorHex}">
                <span style="color: ${colorHex}">●</span> ${source._clusterName}成员
                </div>`;
        }

        if (source.epoch) {
            html += `<div class="detail-coord">历元: J${source.epoch.toFixed(1)}</div>`;
        }

        html += `<div class="detail-coord">RA: ${source.ra.toFixed(5)}°</div>`;
        html += `<div class="detail-coord">Dec: ${source.dec.toFixed(5)}°</div>`;

        if (source.pmra !== undefined && source.pmdec !== undefined) {
            const pmTotal = Math.sqrt(source.pmra * source.pmra + source.pmdec * source.pmdec);
            const isHighPM = pmTotal > 50;
            html += `<div class="detail-pm ${isHighPM ? 'high-pm' : ''}">`;
            html += `<div>pmRA: ${source.pmra.toFixed(2)} mas/yr</div>`;
            html += `<div>pmDec: ${source.pmdec.toFixed(2)} mas/yr</div>`;
            html += `<div>总自行: ${pmTotal.toFixed(2)} mas/yr${isHighPM ? ' ⚡高自行' : ''}</div>`;
            html += '</div>';

            if (source.raJ2000 !== undefined && source.decJ2000 !== undefined) {
                html += '<div class="detail-pm-shift">';
                html += `<div>RA(J2000): ${source.raJ2000.toFixed(5)}°</div>`;
                html += `<div>Dec(J2000): ${source.decJ2000.toFixed(5)}°</div>`;
                const shiftRA = (source.ra - source.raJ2000) * 3600 * Math.cos(source.dec * Math.PI / 180);
                const shiftDec = (source.dec - source.decJ2000) * 3600;
                html += `<div>历元位移: ΔRA=${shiftRA.toFixed(3)}″ ΔDec=${shiftDec.toFixed(3)}″</div>`;
                html += '</div>';
            }
        }

        if (source.mag) {
            html += '<div class="detail-mags">';
            for (const [band, val] of Object.entries(source.mag)) {
                const color = ['G', 'BP', 'RP'].includes(band) ? '#4488ff' : '#ff6644';
                html += `<div class="mag-item"><span style="color:${color}">${band}</span>: ${val.toFixed(3)}</div>`;
            }
            html += '</div>';
        }

        if (match) {
            html += '<div class="detail-match">';
            html += `<div class="match-sep">角距: ${match.separation.toFixed(3)}″</div>`;
            if (match.pmShift && match.pmShift > 0.01) {
                html += `<div class="match-pm-shift">自行修正位移: ${match.pmShift.toFixed(3)}″</div>`;
            }
            html += `<div class="match-gaia">Gaia: ${match.gaia.id}</div>`;
            html += `<div class="match-twomass">2MASS: ${match.twomass.id}</div>`;
            html += '</div>';
        }

        document.getElementById('star-detail').innerHTML = html;

        this.magPlot.drawMagnitudes(source.mag || null, source.catalog);
        this.magPlot.drawSED(source.mag || null);
    }

    _onStarHover(data) {
        const hoverInfo = document.getElementById('hover-info');
        if (!data) {
            hoverInfo.textContent = '';
            return;
        }

        const source = data.source;
        const magStr = source.mag ? Object.entries(source.mag).map(([b, v]) => `${b}=${v.toFixed(2)}`).join(' ') : '';
        const pmStr = (source.pmra !== undefined && (source.pmra !== 0 || source.pmdec !== 0)) ?
            ` | μ=${Math.sqrt(source.pmra ** 2 + source.pmdec ** 2).toFixed(1)}mas/yr` : '';
        const clusterStr = source._clusterName ? ` | ${source._clusterName}` : '';
        hoverInfo.textContent = `${source.id} | RA=${source.ra.toFixed(4)}° Dec=${source.dec.toFixed(4)}° | ${magStr}${pmStr}${clusterStr}`;
    }
}

const app = new App();
