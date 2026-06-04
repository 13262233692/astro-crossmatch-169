export class HEALPix {
    constructor(nside) {
        this.nside = nside;
        this.npix = 12 * nside * nside;
        this.order = Math.round(Math.log2(nside));
        this.ncap = 2 * nside * (nside - 1);
        this.jrll = new Int32Array([2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4]);
        this.jpll = new Int32Array([1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7]);
    }

    ang2pix(raDeg, decDeg) {
        const theta = (90.0 - decDeg) * Math.PI / 180.0;
        const phi = raDeg * Math.PI / 180.0;
        const z = Math.cos(theta);
        const nside = this.nside;
        const fact1 = 12.0 * nside * nside / (4.0 * Math.PI);
        const phiNorm = phi < 0 ? phi + 2 * Math.PI : phi;
        const tt = phiNorm / (Math.PI * 0.5);
        const za = Math.abs(z);

        let ring, iphi;

        if (za <= 2.0 / 3.0) {
            const temp1 = nside * (0.5 + tt);
            const temp2 = nside * z * 1.5;
            const jp = Math.floor(temp1 - temp2);
            const jm = Math.floor(temp1 + temp2);

            ring = jp - jm + 1;
            if (ring < 1) ring += 1;
            if (ring > 2 * nside) ring = 2 * nside;

            iphi = (jm + nside - ring + 1) >> 1;
            if (iphi < 0) iphi += 4 * nside;
            if (iphi >= 4 * nside) iphi -= 4 * nside;
        } else {
            const tp = tt - Math.floor(tt);
            const tmp = nside * Math.sqrt(3.0 * (1.0 - za));

            let jp = Math.floor(tp * tmp);
            let jm = Math.floor((1.0 - tp) * tmp);

            jp = Math.min(Math.max(jp, 0), nside - 1);
            jm = Math.min(Math.max(jm, 0), nside - 1);

            if (z >= 0) {
                ring = nside - jm;
                iphi = nside - jp - 1;
            } else {
                ring = 3 * nside + jm + 1;
                iphi = jp;
            }
        }

        return this._ring2nest(ring, iphi);
    }

    _ring2nest(ring, iphi) {
        const nside = this.nside;

        if (ring < 1 || ring > 4 * nside) return 0;

        let face, ix, iy;

        if (ring <= nside) {
            const f = Math.min(Math.floor(iphi / ring), 3);
            const row = ring;
            const fc = 0.5 * (f + 1) * row;
            ix = iphi - Math.floor(fc);
            iy = row - ix - 1;
            face = f;
        } else if (ring <= 3 * nside) {
            const f = Math.floor((iphi - nside + ring - 1) / nside);
            const fc = f * nside + (ring - nside + 1) * 0.5 - 0.5;
            ix = iphi - Math.floor(fc) - 1;
            iy = 2 * nside - ring + ix + 1;
            face = f + 4;
        } else {
            const f = Math.min(Math.floor(iphi / (4 * nside - ring + 1)), 3);
            const row = 4 * nside - ring + 1;
            const fc = 0.5 * (f + 1) * row;
            ix = iphi - Math.floor(fc);
            iy = row - ix - 1;
            face = f + 8;
        }

        return this._xy2pix(face, ix, iy);
    }

    _xy2pix(face, ix, iy) {
        const rt = ix & ((1 << this.order) - 1);
        const ru = iy & ((1 << this.order) - 1);
        return (face << (2 * this.order)) + (spread_bits(rt) << this.order) + spread_bits(ru);
    }

    _pix2xy(pix) {
        const face = pix >> (2 * this.order);
        const raw = pix & ((1 << (2 * this.order)) - 1);
        const ix = compress_bits(raw >> this.order);
        const iy = compress_bits(raw & ((1 << this.order) - 1));
        return { face, ix, iy };
    }

    pix2ang(pix) {
        const { face, ix, iy } = this._pix2xy(pix);
        const nside = this.nside;
        const jr = this.jrll[face] * nside - ix - iy - 1;

        let z, phi;
        if (jr < nside) {
            const nr = jr + 1;
            z = 1.0 - nr * nr / (3.0 * nside * nside);
            const tmp = this.jpll[face] * nr + ix - iy;
            phi = (tmp >= 0 ? tmp : tmp + 8 * nside) * Math.PI / (4.0 * nr);
        } else if (jr <= 3 * nside) {
            const kshift = (jr - nside) & 1;
            z = (2 * nside - jr) / (1.5 * nside);
            const tmp = this.jpll[face] * nside + ix - iy + (1 - kshift) * 0.5;
            phi = (tmp >= 0 ? tmp : tmp + 8 * nside) * Math.PI / (4.0 * nside);
        } else {
            const nr = 4 * nside - jr;
            z = -1.0 + nr * nr / (3.0 * nside * nside);
            const tmp = this.jpll[face] * nr + ix - iy;
            phi = (tmp >= 0 ? tmp : tmp + 8 * nside) * Math.PI / (4.0 * nr);
        }

        const theta = Math.acos(Math.max(-1, Math.min(1, z)));
        const dec = 90.0 - theta * 180.0 / Math.PI;
        let ra = phi * 180.0 / Math.PI;
        if (ra < 0) ra += 360;
        return { ra, dec };
    }

    neighbors(pix) {
        const { face, ix, iy } = this._pix2xy(pix);
        const nside = this.nside;
        const result = [];

        const dirs = [
            [1, 0], [0, 1], [-1, 0], [0, -1],
            [1, 1], [-1, 1], [-1, -1], [1, -1]
        ];

        for (const [di, dj] of dirs) {
            const ni = ix + di;
            const nj = iy + dj;

            if (ni >= 0 && ni < nside && nj >= 0 && nj < nside) {
                result.push(this._xy2pix(face, ni, nj));
            } else {
                const ang = this.pix2ang(pix);
                const pixelSize = Math.sqrt(4 * Math.PI / this.npix) * 180 / Math.PI;
                const nbPix = this.ang2pix(ang.ra + di * pixelSize * 0.5, ang.dec + dj * pixelSize * 0.5);
                result.push(nbPix);
            }
        }

        return result;
    }

    buildIndex(sources) {
        const index = new Map();
        for (let i = 0; i < sources.length; i++) {
            const pix = this.ang2pix(sources[i].ra, sources[i].dec);
            if (!index.has(pix)) {
                index.set(pix, []);
            }
            index.get(pix).push(i);
        }
        return index;
    }

    queryDisk(ra, dec, radiusArcsec, index) {
        const result = [];
        const centerPix = this.ang2pix(ra, dec);

        const searchPixels = new Set([centerPix]);
        for (const nb of this.neighbors(centerPix)) {
            searchPixels.add(nb);
            for (const nb2 of this.neighbors(nb)) {
                searchPixels.add(nb2);
            }
        }

        for (const pix of searchPixels) {
            if (index.has(pix)) {
                for (const srcIdx of index.get(pix)) {
                    result.push(srcIdx);
                }
            }
        }

        return result;
    }

    static angularSeparation(ra1, dec1, ra2, dec2) {
        const ra1R = ra1 * Math.PI / 180;
        const dec1R = dec1 * Math.PI / 180;
        const ra2R = ra2 * Math.PI / 180;
        const dec2R = dec2 * Math.PI / 180;

        const sinDec1 = Math.sin(dec1R);
        const cosDec1 = Math.cos(dec1R);
        const sinDec2 = Math.sin(dec2R);
        const cosDec2 = Math.cos(dec2R);

        const deltaRa = ra1R - ra2R;
        const cosDeltaRa = Math.cos(deltaRa);

        const cosSep = sinDec1 * sinDec2 + cosDec1 * cosDec2 * cosDeltaRa;
        const clamped = Math.max(-1, Math.min(1, cosSep));

        return Math.acos(clamped) * 180.0 / Math.PI * 3600.0;
    }
}

function spread_bits(v) {
    let x = v & 0xffff;
    x = ((x & 0x5555) << 1) | ((x >> 1) & 0x5555);
    x = ((x & 0x3333) << 2) | ((x >> 2) & 0x3333);
    x = ((x & 0x0f0f) << 4) | ((x >> 4) & 0x0f0f);
    return x;
}

function compress_bits(v) {
    let x = v & 0xffff;
    x = ((x >> 1) & 0x5555) | (x & 0x5555);
    x = ((x >> 2) & 0x3333) | (x & 0x3333);
    x = ((x >> 4) & 0x0f0f) | (x & 0x0f0f);
    x = ((x >> 8) & 0x00ff) | (x & 0x00ff);
    return x;
}
