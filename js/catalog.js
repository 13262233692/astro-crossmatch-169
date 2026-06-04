export class CatalogLoader {
    static generateGaia(count, centerRA, centerDec, radiusDeg) {
        const sources = [];
        const radiusRad = radiusDeg * Math.PI / 180;
        const centerDecRad = centerDec * Math.PI / 180;
        const centerRARad = centerRA * Math.PI / 180;

        for (let i = 0; i < count; i++) {
            const r = radiusRad * Math.sqrt(Math.random());
            const phi = Math.random() * 2 * Math.PI;

            let dec = Math.asin(
                Math.sin(centerDecRad) * Math.cos(r) +
                Math.cos(centerDecRad) * Math.sin(r) * Math.cos(phi)
            );

            let ra = centerRARad + Math.atan2(
                Math.sin(phi) * Math.sin(r) * Math.cos(centerDecRad),
                Math.cos(r) - Math.sin(centerDecRad) * Math.sin(dec)
            );

            dec = dec * 180 / Math.PI;
            ra = ((ra * 180 / Math.PI) % 360 + 360) % 360;

            const gMag = 14 + Math.random() * 10;
            const bpMag = gMag + 0.2 + Math.random() * 0.8;
            const rpMag = gMag - 0.3 - Math.random() * 0.7;

            const hasHighPM = Math.random() < 0.08;
            let pmra, pmdec;
            if (hasHighPM) {
                pmra = (Math.random() - 0.5) * 600;
                pmdec = (Math.random() - 0.5) * 600;
            } else {
                pmra = (Math.random() - 0.5) * 40;
                pmdec = (Math.random() - 0.5) * 40;
            }

            sources.push({
                id: `Gaia-${i + 1}`,
                ra, dec,
                raJ2000: ra,
                decJ2000: dec,
                pmra: parseFloat(pmra.toFixed(3)),
                pmdec: parseFloat(pmdec.toFixed(3)),
                epoch: 2016.0,
                mag: {
                    G: parseFloat(gMag.toFixed(3)),
                    BP: parseFloat(bpMag.toFixed(3)),
                    RP: parseFloat(rpMag.toFixed(3))
                },
                catalog: 'gaia'
            });
        }

        return sources;
    }

    static generate2MASS(count, centerRA, centerDec, radiusDeg) {
        const sources = [];
        const radiusRad = radiusDeg * Math.PI / 180;
        const centerDecRad = centerDec * Math.PI / 180;
        const centerRARad = centerRA * Math.PI / 180;

        for (let i = 0; i < count; i++) {
            const r = radiusRad * Math.sqrt(Math.random());
            const phi = Math.random() * 2 * Math.PI;

            let dec = Math.asin(
                Math.sin(centerDecRad) * Math.cos(r) +
                Math.cos(centerDecRad) * Math.sin(r) * Math.cos(phi)
            );

            let ra = centerRARad + Math.atan2(
                Math.sin(phi) * Math.sin(r) * Math.cos(centerDecRad),
                Math.cos(r) - Math.sin(centerDecRad) * Math.sin(dec)
            );

            dec = dec * 180 / Math.PI;
            ra = ((ra * 180 / Math.PI) % 360 + 360) % 360;

            const jMag = 12 + Math.random() * 9;
            const hMag = jMag - 0.2 - Math.random() * 0.5;
            const kMag = jMag - 0.3 - Math.random() * 0.6;

            sources.push({
                id: `2MASS-${i + 1}`,
                ra, dec,
                pmra: 0,
                pmdec: 0,
                epoch: 2000.0,
                mag: {
                    J: parseFloat(jMag.toFixed(3)),
                    H: parseFloat(hMag.toFixed(3)),
                    K: parseFloat(kMag.toFixed(3))
                },
                catalog: '2mass'
            });
        }

        return sources;
    }

    static generateOverlap(gaiaSources, twomassSources, overlapFraction = 0.3) {
        const nOverlap = Math.floor(Math.min(gaiaSources.length, twomassSources.length) * overlapFraction);
        const nGaiaOverlap = Math.floor(nOverlap / 2);
        const n2MASSOverlap = nOverlap - nGaiaOverlap;

        const gaiaIndices = this._shuffle(Array.from({ length: gaiaSources.length }, (_, i) => i));
        const twomassIndices = this._shuffle(Array.from({ length: twomassSources.length }, (_, i) => i));

        for (let i = 0; i < nGaiaOverlap; i++) {
            const gIdx = gaiaIndices[i];
            const tIdx = twomassIndices[i];

            const raJ2000 = gaiaSources[gIdx].raJ2000;
            const decJ2000 = gaiaSources[gIdx].decJ2000;
            const offset = 0.1 / 3600;

            twomassSources[tIdx].ra = raJ2000 + (Math.random() - 0.5) * offset * 2;
            twomassSources[tIdx].dec = decJ2000 + (Math.random() - 0.5) * offset * 2;
            twomassSources[tIdx]._matchedGaiaId = gaiaSources[gIdx].id;
            gaiaSources[gIdx]._matched2MASSId = twomassSources[tIdx].id;
        }

        for (let i = 0; i < n2MASSOverlap; i++) {
            const gIdx = gaiaIndices[nGaiaOverlap + i];
            const tIdx = twomassIndices[nGaiaOverlap + i];
            if (gIdx !== undefined && tIdx !== undefined) {
                const offset = 0.3 / 3600;
                const raJ2000 = twomassSources[tIdx].ra + (Math.random() - 0.5) * offset * 2;
                const decJ2000 = twomassSources[tIdx].dec + (Math.random() - 0.5) * offset * 2;

                gaiaSources[gIdx].raJ2000 = raJ2000;
                gaiaSources[gIdx].decJ2000 = decJ2000;
                gaiaSources[gIdx]._matched2MASSId = twomassSources[tIdx].id;
                twomassSources[tIdx]._matchedGaiaId = gaiaSources[gIdx].id;
            }
        }

        this._applyProperMotionToGaia(gaiaSources);
    }

    static _applyProperMotionToGaia(sources) {
        for (const src of sources) {
            const dt = src.epoch - 2000.0;
            const decRad = src.decJ2000 * Math.PI / 180;
            const cosDec = Math.cos(decRad);
            const safeCosDec = Math.max(cosDec, 1e-10);

            src.ra = src.raJ2000 + (src.pmra / 3600000.0) * dt / safeCosDec;
            src.dec = src.decJ2000 + (src.pmdec / 3600000.0) * dt;

            src.ra = ((src.ra % 360) + 360) % 360;
            src.dec = Math.max(-90, Math.min(90, src.dec));
        }
    }

    static _shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}
