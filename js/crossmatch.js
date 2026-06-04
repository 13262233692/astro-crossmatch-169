import { HEALPix } from './healpix.js';

export class CrossMatcher {
    constructor(nside, radiusArcsec, applyPM = true) {
        this.nside = nside;
        this.radiusArcsec = radiusArcsec;
        this.applyPM = applyPM;
        this.healpix = new HEALPix(nside);
    }

    static propagateToEpoch(source, targetEpoch) {
        const srcEpoch = source.epoch || 2000.0;
        if (Math.abs(targetEpoch - srcEpoch) < 1e-6) return { ra: source.ra, dec: source.dec };

        const pmra = source.pmra || 0;
        const pmdec = source.pmdec || 0;
        if (pmra === 0 && pmdec === 0) return { ra: source.ra, dec: source.dec };

        let baseRA, baseDec;
        if (source.raJ2000 !== undefined && source.decJ2000 !== undefined) {
            baseRA = source.raJ2000;
            baseDec = source.decJ2000;
        } else {
            const dtUndo = 2000.0 - srcEpoch;
            const decRad0 = source.dec * Math.PI / 180;
            const cosDec0 = Math.max(Math.cos(decRad0), 1e-10);
            baseRA = source.ra + (pmra / 3600000.0) * dtUndo / cosDec0;
            baseDec = source.dec + (pmdec / 3600000.0) * dtUndo;
        }

        const dt = targetEpoch - 2000.0;
        const decRad = baseDec * Math.PI / 180;
        const cosDec = Math.max(Math.cos(decRad), 1e-10);

        let newRA = baseRA + (pmra / 3600000.0) * dt / cosDec;
        let newDec = baseDec + (pmdec / 3600000.0) * dt;

        newRA = ((newRA % 360) + 360) % 360;
        newDec = Math.max(-90, Math.min(90, newDec));

        return { ra: newRA, dec: newDec };
    }

    match(catalogA, catalogB) {
        const t0 = performance.now();

        let correctedA, correctedB;
        let targetEpoch;

        if (this.applyPM) {
            const epochA = catalogA.length > 0 ? (catalogA[0].epoch || 2000.0) : 2000.0;
            const epochB = catalogB.length > 0 ? (catalogB[0].epoch || 2000.0) : 2000.0;
            targetEpoch = epochB;

            correctedA = catalogA.map(src => {
                if (src.epoch && Math.abs(src.epoch - targetEpoch) > 0.01 && (src.pmra !== 0 || src.pmdec !== 0)) {
                    const corrected = CrossMatcher.propagateToEpoch(src, targetEpoch);
                    return { ...src, ra: corrected.ra, dec: corrected.dec, _pmApplied: true, _originalRA: src.ra, _originalDec: src.dec };
                }
                return src;
            });

            correctedB = catalogB;
        } else {
            correctedA = catalogA;
            correctedB = catalogB;
            targetEpoch = null;
        }

        const indexB = this.healpix.buildIndex(correctedB);
        const matches = [];
        const matchedA = new Set();
        const matchedB = new Set();

        for (let i = 0; i < correctedA.length; i++) {
            const srcA = correctedA[i];
            const candidates = this.healpix.queryDisk(srcA.ra, srcA.dec, this.radiusArcsec, indexB);

            let bestJ = -1;
            let bestSep = Infinity;

            for (const j of candidates) {
                if (matchedB.has(j)) continue;
                const srcB = correctedB[j];
                const sep = HEALPix.angularSeparation(srcA.ra, srcA.dec, srcB.ra, srcB.dec);
                if (sep <= this.radiusArcsec && sep < bestSep) {
                    bestSep = sep;
                    bestJ = j;
                }
            }

            if (bestJ >= 0) {
                const srcB = correctedB[bestJ];
                const originalA = catalogA[i];
                const pmShiftArcsec = (originalA.pmra !== 0 || originalA.pmdec !== 0) ?
                    HEALPix.angularSeparation(originalA.ra, originalA.dec, srcA.ra, srcA.dec) : 0;

                matches.push({
                    gaia: catalogA[i],
                    twomass: srcB,
                    separation: bestSep,
                    pmShift: pmShiftArcsec,
                    correctedRA: srcA.ra,
                    correctedDec: srcA.dec,
                    combinedMag: { ...catalogA[i].mag, ...srcB.mag }
                });
                matchedA.add(i);
                matchedB.add(bestJ);
            }
        }

        const unmatchedA = catalogA.filter((_, i) => !matchedA.has(i));
        const unmatchedB = catalogB.filter((_, i) => !matchedB.has(i));

        const elapsed = performance.now() - t0;

        const nPMShifted = correctedA.filter(s => s._pmApplied).length;

        return {
            matches,
            unmatchedGaia: unmatchedA,
            unmatched2MASS: unmatchedB,
            stats: {
                nGaia: catalogA.length,
                n2MASS: catalogB.length,
                nMatched: matches.length,
                matchRate: (matches.length / Math.min(catalogA.length, catalogB.length) * 100).toFixed(2),
                elapsedMs: elapsed.toFixed(1),
                pmApplied: this.applyPM,
                targetEpoch: targetEpoch,
                nPMShifted: nPMShifted,
                highPMRecovered: matches.filter(m => m.pmShift > 0.5).length
            }
        };
    }
}
