export class StarClusterDetector {
    constructor(epsilonArcmin = 2.0, minPts = 8) {
        this.epsilon = epsilonArcmin / 60.0;
        this.minPts = minPts;
    }

    dbscan(sources) {
        const n = sources.length;
        const labels = new Array(n).fill(-1);
        const visited = new Array(n).fill(false);
        let clusterId = 0;

        const spatialIndex = this._buildSpatialIndex(sources);

        for (let i = 0; i < n; i++) {
            if (visited[i]) continue;
            visited[i] = true;

            const neighbors = this._findNeighbors(i, sources, spatialIndex);

            if (neighbors.length < this.minPts) {
                labels[i] = -1;
            } else {
                this._expandCluster(i, neighbors, clusterId, labels, visited, sources, spatialIndex);
                clusterId++;
            }
        }

        const clusters = new Map();
        for (let i = 0; i < n; i++) {
            const cid = labels[i];
            if (!clusters.has(cid)) clusters.set(cid, []);
            clusters.get(cid).push(i);
        }

        const result = [];
        for (const [cid, indices] of clusters) {
            if (cid === -1) {
                result.push({ id: -1, name: '场星', indices, color: 0x888888, isField: true });
            } else {
                const center = this._computeClusterCenter(indices, sources);
                const name = `星团 ${String.fromCharCode(65 + cid)}`;
                const colors = [0xff66aa, 0x66ffaa, 0xffaa66, 0x66aaff, 0xaaff66, 0xaa66ff];
                result.push({
                    id: cid,
                    name,
                    indices,
                    color: colors[cid % colors.length],
                    center,
                    size: indices.length,
                    isField: false
                });
            }
        }

        result.sort((a, b) => {
            if (a.isField) return 1;
            if (b.isField) return -1;
            return b.size - a.size;
        });

        return {
            clusters: result,
            labels,
            nClusters: result.filter(c => !c.isField).length
        };
    }

    _buildSpatialIndex(sources) {
        const grid = new Map();
        const cellSize = this.epsilon * 2;

        for (let i = 0; i < sources.length; i++) {
            const s = sources[i];
            const cellX = Math.floor(s.ra / cellSize);
            const cellY = Math.floor((s.dec + 90) / cellSize);
            const key = `${cellX},${cellY}`;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(i);
        }

        return { grid, cellSize };
    }

    _findNeighbors(idx, sources, index) {
        const s = sources[idx];
        const neighbors = [];
        const cellX = Math.floor(s.ra / index.cellSize);
        const cellY = Math.floor((s.dec + 90) / index.cellSize);

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = `${cellX + dx},${cellY + dy}`;
                const cell = index.grid.get(key);
                if (!cell) continue;
                for (const j of cell) {
                    if (j === idx) continue;
                    const d = this._angularDistance(s.ra, s.dec, sources[j].ra, sources[j].dec);
                    if (d <= this.epsilon) neighbors.push(j);
                }
            }
        }

        return neighbors;
    }

    _expandCluster(idx, neighbors, clusterId, labels, visited, sources, spatialIndex) {
        labels[idx] = clusterId;
        let i = 0;

        while (i < neighbors.length) {
            const j = neighbors[i];
            if (!visited[j]) {
                visited[j] = true;
                const jNeighbors = this._findNeighbors(j, sources, spatialIndex);
                if (jNeighbors.length >= this.minPts) {
                    for (const k of jNeighbors) {
                        if (!neighbors.includes(k)) neighbors.push(k);
                    }
                }
            }
            if (labels[j] === -1) labels[j] = clusterId;
            i++;
        }
    }

    _angularDistance(ra1, dec1, ra2, dec2) {
        const d2r = Math.PI / 180;
        const sinDec1 = Math.sin(dec1 * d2r);
        const cosDec1 = Math.cos(dec1 * d2r);
        const sinDec2 = Math.sin(dec2 * d2r);
        const cosDec2 = Math.cos(dec2 * d2r);
        const cosDRA = Math.cos((ra1 - ra2) * d2r);
        const cosSep = sinDec1 * sinDec2 + cosDec1 * cosDec2 * cosDRA;
        return Math.acos(Math.max(-1, Math.min(1, cosSep))) * 180 / Math.PI;
    }

    _computeClusterCenter(indices, sources) {
        let sumX = 0, sumY = 0, sumZ = 0;
        const d2r = Math.PI / 180;
        for (const i of indices) {
            const s = sources[i];
            const ra = s.ra * d2r;
            const dec = s.dec * d2r;
            sumX += Math.cos(dec) * Math.cos(ra);
            sumY += Math.cos(dec) * Math.sin(ra);
            sumZ += Math.sin(dec);
        }
        const n = indices.length;
        const x = sumX / n;
        const y = sumY / n;
        const z = sumZ / n;
        const r = Math.sqrt(x * x + y * y + z * z);
        return {
            ra: Math.atan2(y, x) * 180 / Math.PI,
            dec: Math.asin(z / r) * 180 / Math.PI
        };
    }

    static generateClusteredCatalog(count, nClusters = 2, clusterRadius = 0.3) {
        const sources = [];
        const sourcesPerCluster = Math.floor(count * 0.3 / nClusters);
        const fieldCount = count - sourcesPerCluster * nClusters;

        const clusterCenters = [];
        for (let i = 0; i < nClusters; i++) {
            clusterCenters.push({
                ra: 160 + i * 40 + (Math.random() - 0.5) * 20,
                dec: 20 + (Math.random() - 0.5) * 30
            });
        }

        for (let i = 0; i < fieldCount; i++) {
            const ra = 120 + Math.random() * 120;
            const dec = -10 + Math.random() * 60;
            const gMag = 12 + Math.random() * 10;
            const bpRp = 0.2 + Math.random() * 1.5;
            sources.push({
                id: `Field-${i + 1}`,
                ra, dec,
                pmra: (Math.random() - 0.5) * 40,
                pmdec: (Math.random() - 0.5) * 40,
                epoch: 2000.0,
                mag: {
                    G: parseFloat(gMag.toFixed(3)),
                    BP: parseFloat((gMag + bpRp * 0.6).toFixed(3)),
                    RP: parseFloat((gMag - bpRp * 0.4).toFixed(3))
                },
                catalog: 'field',
                _isCluster: false,
                _clusterId: -1
            });
        }

        const clusterColors = [
            { bpRp: 0.5, spread: 0.2 },
            { bpRp: 1.2, spread: 0.3 }
        ];

        for (let c = 0; c < nClusters; c++) {
            const center = clusterCenters[c];
            const color = clusterColors[c % clusterColors.length];
            for (let i = 0; i < sourcesPerCluster; i++) {
                const r = clusterRadius * Math.sqrt(Math.random());
                const theta = Math.random() * Math.PI * 2;
                const ra = center.ra + r * Math.cos(theta) / Math.cos(center.dec * Math.PI / 180);
                const dec = center.dec + r * Math.sin(theta);

                const isMS = Math.random() < 0.85;
                const bpRp = color.bpRp + (Math.random() - 0.5) * color.spread;
                const baseMag = isMS ? 12 + bpRp * 4 : 10 + Math.random() * 2;
                const gMag = baseMag + (Math.random() - 0.5) * 2;

                sources.push({
                    id: `Cluster${String.fromCharCode(65 + c)}-${i + 1}`,
                    ra, dec,
                    pmra: (Math.random() - 0.5) * 10,
                    pmdec: (Math.random() - 0.5) * 10,
                    epoch: 2000.0,
                    mag: {
                        G: parseFloat(gMag.toFixed(3)),
                        BP: parseFloat((gMag + bpRp * 0.6).toFixed(3)),
                        RP: parseFloat((gMag - bpRp * 0.4).toFixed(3))
                    },
                    catalog: `cluster-${c}`,
                    _isCluster: true,
                    _clusterId: c
                });
            }
        }

        return sources;
    }
}
