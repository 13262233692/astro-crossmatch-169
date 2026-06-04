export class MagnitudePlot {
    constructor(canvasId, sedCanvasId, hrCanvasId) {
        this.canvas = document.getElementById(canvasId);
        this.sedCanvas = document.getElementById(sedCanvasId);
        this.ctx = this.canvas.getContext('2d');
        this.sedCtx = this.sedCanvas.getContext('2d');
        this.hrCanvas = hrCanvasId ? document.getElementById(hrCanvasId) : null;
        this.hrCtx = this.hrCanvas ? this.hrCanvas.getContext('2d') : null;
        this.hrData = null;
        this.selectedPoint = null;
        this.onHRPointClick = null;
        if (this.hrCanvas) {
            this.hrCanvas.addEventListener('click', (e) => this._handleHRClick(e));
        }
    }

    _handleHRClick(e) {
        if (!this.hrData || !this.onHRPointClick) return;
        const rect = this.hrCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const margin = { top: 40, right: 20, bottom: 50, left: 55 };
        const plotW = this.hrCanvas.width - margin.left - margin.right;
        const plotH = this.hrCanvas.height - margin.top - margin.bottom;
        const bpRp = margin.left + (x - margin.left) / plotW * (this.hrData.maxBP - this.hrData.minBP) + this.hrData.minBP;
        const gMag = margin.top + (y - margin.top) / plotH * (this.hrData.maxG - this.hrData.minG) + this.hrData.minG;
        let minDist = Infinity;
        let closestIdx = -1;
        for (let i = 0; i < this.hrData.points.length; i++) {
            const p = this.hrData.points[i];
            const d = Math.sqrt((p.bpRp - bpRp) ** 2 + (p.gMag - gMag) ** 2);
            if (d < minDist) { minDist = d; closestIdx = i; }
        }
        if (minDist < 1.0 && closestIdx >= 0) {
            this.onHRPointClick(this.hrData.points[closestIdx].source);
        }
    }

    drawMagnitudes(magData, catalog) {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, W, H);

        if (!magData) {
            ctx.fillStyle = '#666';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('无星等数据', W / 2, H / 2);
            return;
        }

        const bands = Object.keys(magData);
        const values = Object.values(magData);
        if (bands.length === 0) return;

        const margin = { top: 30, right: 20, bottom: 40, left: 50 };
        const plotW = W - margin.left - margin.right;
        const plotH = H - margin.top - margin.bottom;

        const minMag = Math.floor(Math.min(...values)) - 1;
        const maxMag = Math.ceil(Math.max(...values)) + 1;
        const magRange = maxMag - minMag;

        ctx.strokeStyle = '#1c2a3a';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = margin.top + (plotH * i / 5);
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(margin.left + plotW, y);
            ctx.stroke();

            const magVal = maxMag - (magRange * i / 5);
            ctx.fillStyle = '#8899aa';
            ctx.font = '10px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(magVal.toFixed(1), margin.left - 5, y + 3);
        }

        ctx.fillStyle = '#aabbcc';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('多波段星等', W / 2, 18);

        ctx.save();
        ctx.translate(14, margin.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#8899aa';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('星等 (mag)', 0, 0);
        ctx.restore();

        const barWidth = Math.min(plotW / bands.length * 0.6, 40);
        const gap = plotW / bands.length;

        const bandColors = {
            G: '#4488ff', BP: '#66aaff', RP: '#2266dd',
            J: '#ff6644', H: '#ff8866', K: '#dd4422'
        };

        for (let i = 0; i < bands.length; i++) {
            const x = margin.left + gap * i + gap / 2;
            const magVal = values[i];
            const barH = ((magVal - minMag) / magRange) * plotH;
            const barY = margin.top + plotH - barH;

            const color = bandColors[bands[i]] || '#44ff88';
            const grad = ctx.createLinearGradient(x - barWidth / 2, barY, x - barWidth / 2, margin.top + plotH);
            grad.addColorStop(0, color);
            grad.addColorStop(1, color + '44');

            ctx.fillStyle = grad;
            ctx.fillRect(x - barWidth / 2, barY, barWidth, barH);

            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - barWidth / 2, barY, barWidth, barH);

            ctx.fillStyle = '#ccddee';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(bands[i], x, margin.top + plotH + 15);

            ctx.fillStyle = '#ffffff';
            ctx.font = '10px monospace';
            ctx.fillText(magVal.toFixed(2), x, barY - 5);
        }
    }

    drawSED(magData) {
        const ctx = this.sedCtx;
        const W = this.sedCanvas.width;
        const H = this.sedCanvas.height;

        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, W, H);

        if (!magData) {
            ctx.fillStyle = '#666';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('无SED数据', W / 2, H / 2);
            return;
        }

        const bands = Object.keys(magData);
        const values = Object.values(magData);
        if (bands.length === 0) return;

        const margin = { top: 30, right: 20, bottom: 40, left: 50 };
        const plotW = W - margin.left - margin.right;
        const plotH = H - margin.top - margin.bottom;

        const wavelengths = {
            BP: 0.505, G: 0.585, RP: 0.770,
            J: 1.235, H: 1.662, K: 2.159
        };

        const gaiaBands = ['BP', 'G', 'RP'];
        const twomassBands = ['J', 'H', 'K'];

        const points = bands
            .filter(b => wavelengths[b])
            .map(b => ({
                band: b,
                wavelength: wavelengths[b],
                mag: magData[b],
                flux: Math.pow(10, -0.4 * magData[b])
            }))
            .sort((a, b) => a.wavelength - b.wavelength);

        if (points.length === 0) return;

        const minFlux = Math.min(...points.map(p => p.flux));
        const maxFlux = Math.max(...points.map(p => p.flux));
        const fluxRange = maxFlux / minFlux;

        const xScale = (wl) => {
            const minWL = 0.3;
            const maxWL = 3.0;
            return margin.left + ((Math.log10(wl) - Math.log10(minWL)) / (Math.log10(maxWL) - Math.log10(minWL))) * plotW;
        };

        const yScale = (flux) => {
            const logMin = Math.log10(minFlux) - 0.3;
            const logMax = Math.log10(maxFlux) + 0.3;
            return margin.top + plotH - ((Math.log10(flux) - logMin) / (logMax - logMin)) * plotH;
        };

        ctx.strokeStyle = '#1c2a3a';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = margin.top + (plotH * i / 4);
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(margin.left + plotW, y);
            ctx.stroke();
        }

        ctx.fillStyle = '#aabbcc';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('光谱能量分布 (SED)', W / 2, 18);

        ctx.fillStyle = '#8899aa';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        for (const p of points) {
            const x = xScale(p.wavelength);
            ctx.fillText(p.band, x, margin.top + plotH + 15);
        }

        ctx.save();
        ctx.translate(14, margin.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#8899aa';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('log(Flux)', 0, 0);
        ctx.restore();

        ctx.fillStyle = '#667';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('λ (μm)', W / 2, H - 5);

        const gaiaPoints = points.filter(p => gaiaBands.includes(p.band));
        const twomassPoints = points.filter(p => twomassBands.includes(p.band));

        const drawCurve = (pts, color) => {
            if (pts.length < 2) return;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
                const x = xScale(pts[i].wavelength);
                const y = yScale(pts[i].flux);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        };

        drawCurve(gaiaPoints, '#4488ff');
        drawCurve(twomassPoints, '#ff6644');

        for (const p of points) {
            const x = xScale(p.wavelength);
            const y = yScale(p.flux);
            const color = gaiaBands.includes(p.band) ? '#4488ff' : '#ff6644';

            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        const legendY = margin.top + 12;
        ctx.fillStyle = '#4488ff';
        ctx.fillRect(margin.left + 5, legendY - 6, 12, 12);
        ctx.fillStyle = '#ccddee';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Gaia', margin.left + 22, legendY + 4);

        ctx.fillStyle = '#ff6644';
        ctx.fillRect(margin.left + 65, legendY - 6, 12, 12);
        ctx.fillStyle = '#ccddee';
        ctx.fillText('2MASS', margin.left + 82, legendY + 4);
    }

    drawHRDiagram(sources, clusters = null, highlightSource = null) {
        if (!this.hrCtx) return;
        const ctx = this.hrCtx;
        const W = this.hrCanvas.width;
        const H = this.hrCanvas.height;

        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, W, H);

        if (!sources || sources.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('无HR图数据', W / 2, H / 2);
            return;
        }

        const margin = { top: 40, right: 20, bottom: 50, left: 55 };
        const plotW = W - margin.left - margin.right;
        const plotH = H - margin.top - margin.bottom;

        const hrPoints = sources
            .filter(s => s.mag && s.mag.G !== undefined && s.mag.BP !== undefined && s.mag.RP !== undefined)
            .map(s => ({
                source: s,
                bpRp: s.mag.BP - s.mag.RP,
                gMag: s.mag.G,
                clusterId: s._clusterId !== undefined ? s._clusterId : -1
            }));

        if (hrPoints.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('无BP/RP波段数据', W / 2, H / 2);
            return;
        }

        let minBPRp = Math.min(...hrPoints.map(p => p.bpRp)) - 0.2;
        let maxBPRp = Math.max(...hrPoints.map(p => p.bpRp)) + 0.2;
        const minG = Math.min(...hrPoints.map(p => p.gMag)) - 0.5;
        const maxG = Math.max(...hrPoints.map(p => p.gMag)) + 0.5;

        minBPRp = Math.max(0, minBPRp);
        maxBPRp = Math.min(3.0, maxBPRp);

        this.hrData = { points: hrPoints, minBP: minBPRp, maxBP: maxBPRp, minG, maxG };

        const xScale = (bpRp) => margin.left + ((bpRp - minBPRp) / (maxBPRp - minBPRp)) * plotW;
        const yScale = (gMag) => margin.top + plotH - ((gMag - minG) / (maxG - minG)) * plotH;

        ctx.strokeStyle = '#1c2a3a';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = margin.top + (plotH * i / 5);
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(margin.left + plotW, y);
            ctx.stroke();

            const gVal = maxG - ((maxG - minG) * i / 5);
            ctx.fillStyle = '#8899aa';
            ctx.font = '10px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(gVal.toFixed(1), margin.left - 5, y + 3);
        }

        for (let i = 0; i <= 5; i++) {
            const x = margin.left + (plotW * i / 5);
            ctx.strokeStyle = '#1c2a3a';
            ctx.beginPath();
            ctx.moveTo(x, margin.top);
            ctx.lineTo(x, margin.top + plotH);
            ctx.stroke();

            const bpVal = minBPRp + ((maxBPRp - minBPRp) * i / 5);
            ctx.fillStyle = '#8899aa';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(bpVal.toFixed(1), x, margin.top + plotH + 18);
        }

        ctx.fillStyle = '#aabbcc';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('赫罗图 (HR Diagram)', W / 2, 18);

        ctx.fillStyle = '#8899aa';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BP - RP (色指数)', W / 2, H - 5);

        ctx.save();
        ctx.translate(16, margin.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#8899aa';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('G 星等 (mag)', 0, 0);
        ctx.restore();

        this._drawIsochrone(ctx, xScale, yScale, minBPRp, maxBPRp, minG, maxG);

        const clusterColors = {
            '-1': '#888888',
            0: '#ff66aa', 1: '#66ffaa', 2: '#ffaa66',
            3: '#66aaff', 4: '#aaff66', 5: '#aa66ff'
        };

        const byCluster = new Map();
        for (const p of hrPoints) {
            const cid = p.clusterId || -1;
            if (!byCluster.has(cid)) byCluster.set(cid, []);
            byCluster.get(cid).push(p);
        }

        for (const [cid, pts] of byCluster) {
            const color = clusterColors[cid] || '#4488ff';
            for (const p of pts) {
                const x = xScale(p.bpRp);
                const y = yScale(p.gMag);
                if (x < margin.left || x > margin.left + plotW || y < margin.top || y > margin.top + plotH) continue;

                ctx.beginPath();
                ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.7;
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }

        if (highlightSource && highlightSource.mag && highlightSource.mag.G && highlightSource.mag.BP && highlightSource.mag.RP) {
            const bpRp = highlightSource.mag.BP - highlightSource.mag.RP;
            const x = xScale(bpRp);
            const y = yScale(highlightSource.mag.G);

            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.9;
            ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffff00';
            ctx.fill();
        }

        this._drawHRLegend(ctx, margin, clusters);
    }

    _drawIsochrone(ctx, xScale, yScale, minBPRp, maxBPRp, minG, maxG) {
        const pts = [];
        for (let bpRp = 0.2; bpRp <= 2.0; bpRp += 0.05) {
            let gMag;
            if (bpRp < 0.6) {
                gMag = 12 + bpRp * 6;
            } else if (bpRp < 1.2) {
                gMag = 14 + (bpRp - 0.6) * 4;
            } else {
                gMag = 16.4 + (bpRp - 1.2) * 2;
            }
            if (bpRp >= minBPRp && bpRp <= maxBPRp && gMag >= minG && gMag <= maxG) {
                pts.push({ x: xScale(bpRp), y: yScale(gMag) });
            }
        }

        if (pts.length >= 2) {
            ctx.strokeStyle = '#44ff88';
            ctx.globalAlpha = 0.4;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                ctx.lineTo(pts[i].x, pts[i].y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        const giantPts = [];
        for (let bpRp = 1.0; bpRp <= 2.0; bpRp += 0.05) {
            const gMag = 10 + (bpRp - 1.0) * 3;
            if (bpRp >= minBPRp && bpRp <= maxBPRp && gMag >= minG && gMag <= maxG) {
                giantPts.push({ x: xScale(bpRp), y: yScale(gMag) });
            }
        }

        if (giantPts.length >= 2) {
            ctx.strokeStyle = '#ff8844';
            ctx.globalAlpha = 0.4;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            ctx.moveTo(giantPts[0].x, giantPts[0].y);
            for (let i = 1; i < giantPts.length; i++) {
                ctx.lineTo(giantPts[i].x, giantPts[i].y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }
    }

    _drawHRLegend(ctx, margin, clusters) {
        let y = margin.top + 15;
        const x = margin.left + 10;

        ctx.fillStyle = '#44ff88';
        ctx.fillRect(x, y - 4, 16, 2);
        ctx.fillStyle = '#ccddee';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('主序', x + 22, y + 2);

        y += 16;
        ctx.fillStyle = '#ff8844';
        ctx.fillRect(x, y - 4, 16, 2);
        ctx.fillText('巨星支', x + 22, y + 2);

        y += 20;
        ctx.fillStyle = '#888888';
        ctx.fillRect(x, y - 5, 10, 10);
        ctx.fillText('场星', x + 16, y + 3);

        if (clusters) {
            const clusterColors = ['#ff66aa', '#66ffaa', '#ffaa66', '#66aaff', '#aaff66', '#aa66ff'];
            for (let i = 0; i < Math.min(clusters.length, 6); i++) {
                y += 15;
                const c = clusters[i];
                if (c.isField) continue;
                ctx.fillStyle = clusterColors[i];
                ctx.fillRect(x, y - 5, 10, 10);
                ctx.fillText(c.name, x + 16, y + 3);
            }
        }
    }
}

