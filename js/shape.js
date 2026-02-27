/**
 * js/shape.js
 * バスの運行ルート（shapes.txt）の描画管理
 */

window.ShapeManager = window.ShapeManager || {};
window.ShapeManager.cache = {}; // 一度読み込んだルートを記憶する場所
window.ShapeManager.currentLayer = null; // 現在地図に表示されているルート線

/**
 * 指定したバス会社の shape_id のルートを地図に描画する
 */
window.ShapeManager.drawShape = async function(companyId, shapeId) {
    if (!window.map || !shapeId) return;

    // 前のルート線が残っていたら消す
    if (this.currentLayer) {
        window.map.removeLayer(this.currentLayer);
        this.currentLayer = null;
    }

    const cacheKey = `${companyId}_${shapeId}`;
    let latlngs =[];

    // 1. キャッシュにあればそれを使う（一瞬で表示）
    if (this.cache[cacheKey]) {
        latlngs = this.cache[cacheKey];
    } else {
        // 2. なければ shapes.txt を fetch して、該当の shape_id だけを抜き出す
        console.log(`🗺️ ${companyId} の shape_id: ${shapeId} を抽出中...`);
        const company = window.BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) return;

        try {
            const res = await fetch(`${company.staticPath}shapes.txt`);
            if (!res.ok) throw new Error("shapes.txt not found");
            const text = (await res.text()).replace(/^\uFEFF/, '');
            const lines = text.trim().split(/\r?\n/);
            
            // const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            const head = lines[0]
                .split(',')
                .map(s => s.trim().replace(/^"|"$/g, ''));
            const sIdIdx = head.indexOf('shape_id');
            const latIdx = head.indexOf('shape_pt_lat');
            const lonIdx = head.indexOf('shape_pt_lon');
            const seqIdx = head.indexOf('shape_pt_sequence');

            let points =[];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length > Math.max(sIdIdx, latIdx, lonIdx)) {
                    const currentShapeId = cols[sIdIdx].trim().replace(/^"|"$/g, '');
                    if (currentShapeId === shapeId) {
                        points.push({
                            lat: parseFloat(cols[latIdx]),
                            lon: parseFloat(cols[lonIdx]),
                            seq: parseInt(cols[seqIdx] || 0)
                        });
                    }
                }
            }

            // sequence順に並び替えて、Leaflet用の配列にする
            points.sort((a, b) => a.seq - b.seq);
            latlngs = points.map(p =>[p.lat, p.lon]);
            
            // 次回のために記憶しておく
            this.cache[cacheKey] = latlngs;

        } catch (e) {
            console.error("Shape描画エラー:", e);
            return;
        }
    }

    // 3. 地図に線を描画する
    if (latlngs.length > 0) {
        const companyConfig = window.APP_CONFIG.COMPANIES[companyId];
        const routeColor = companyConfig ? companyConfig.color : '#3388ff';

        this.currentLayer = L.polyline(latlngs, {
            color: routeColor,
            weight: 5,
            opacity: 0.7,
            lineJoin: 'round'
        }).addTo(window.map);
    }
};

/**
 * ルート線を消す関数（地図の余白をクリックした時などに呼ぶと便利です）
 */
window.ShapeManager.clearShape = function() {
    if (this.currentLayer && window.map) {
        window.map.removeLayer(this.currentLayer);
        this.currentLayer = null;
    }
};
