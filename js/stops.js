/**
 * js/stops.js
 * 役割: バス停の統合管理と地図描画
 */

// 後から表示切替できるように、バス停データをグローバルに保存する箱
window.globalStopMap = window.globalStopMap || new Map();

// ★1つの会社のバス停データだけを読み込む関数
window.loadCompanyStops = async function(company) {
    if (company.isStopsLoaded) return; // 既にロード済みならスキップ

    console.log(`📍 ${company.name} のバス停データを読み込み中...`);
    try {
        const response = await fetch(`${company.staticPath}stops.txt`);
        if (!response.ok) return;

        const text = await response.text();
        const lines = text.trim().split(/\r?\n/);
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

        const idIdx = headers.findIndex(h => h.includes('stop_id'));
        const nameIdx = headers.findIndex(h => h.includes('stop_name'));
        const latIdx = headers.findIndex(h => h.includes('stop_lat'));
        const lonIdx = headers.findIndex(h => h.includes('stop_lon'));

        lines.slice(1).forEach((line) => {
            if (!line.trim()) return;
            const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cols.length <= Math.max(latIdx, lonIdx)) return;

            const stopId = cols[idIdx];
            const lat = parseFloat(cols[latIdx]);
            const lon = parseFloat(cols[lonIdx]);
            const stopName = cols[nameIdx];

            if (isNaN(lat) || isNaN(lon)) return;

            if (window.globalStopMap.has(stopId)) {
                const entry = window.globalStopMap.get(stopId);
                if (!entry.companies.includes(company.id)) {
                    entry.companies.push(company.id);
                }
            } else {
                const marker = L.circleMarker([lat, lon], {
                    radius: 6, color: 'rgba(0,0,0,0)', weight: 15, opacity: 0, fillOpacity: 1
                });

                const centerMarker = L.circleMarker([lat, lon], {
                    radius: 5, color: '#000', weight: 1, fill: false, interactive: false
                });

                const entry = {
                    marker: marker, centerMarker: centerMarker, companies: [company.id], name: stopName
                };

                marker.on('click', () => {
                    const safeId = String(stopId).replace(/\s+/g, '_');
                    const popupHtml = `
                        <div style="min-width:220px;">
                            <strong>${entry.name}</strong><br>
                            <small style="color:#999;">ID: ${stopId}</small>
                            <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                            <div class="timetable-content-${safeId}" style="max-height: 250px; overflow-y: auto;">
                                <div class="loading">時刻表を準備中...</div>
                            </div>
                        </div>`;
                    marker.bindPopup(popupHtml).openPopup();
                    
                    const visibleCompanies = entry.companies.filter(cid => {
                        const c = window.BUS_COMPANIES.find(comp => comp.id === cid);
                        return c && c.visible !== false;
                    });
                    if (window.TimetableManager) {
                        window.TimetableManager.showTimetable(stopId, visibleCompanies);
                    }
                });

                window.globalStopMap.set(stopId, entry);
            }
        });
    } catch (e) { console.error(e); }

    company.isStopsLoaded = true; // 読み込み完了フラグを立てる
};

// ★起動時に呼び出される関数（表示ONの会社だけをロードする）
window.loadAndDisplayStops = async function() {
    if (!window.map) {
        setTimeout(window.loadAndDisplayStops, 500);
        return;
    }

    const promises = window.BUS_COMPANIES
        .filter(c => c.active && c.visible !== false) // 表示ONの会社のみ
        .map(c => window.loadCompanyStops(c));
    
    await Promise.all(promises);
    window.updateStopsDisplay();
};

/**
 * 会社選択のチェック状態に応じて、バス停の表示・非表示・色を即座に更新する関数
 */
window.updateStopsDisplay = function() {
    if (!window.map) return;

    // 現在「表示」になっている会社のIDリストを作成
    const visibleCompanyIds = window.BUS_COMPANIES.filter(c => c.visible !== false).map(c => c.id);

    window.globalStopMap.forEach((entry, stopId) => {
        // このバス停に停車する会社のうち、表示ONになっている会社のリスト
        const activeCompaniesForStop = entry.companies.filter(cid => visibleCompanyIds.includes(cid));

        if (activeCompaniesForStop.length === 0) {
            // 表示ONの会社が一つもない → 地図から消す
            if (window.map.hasLayer(entry.marker)) {
                window.map.removeLayer(entry.marker);
                window.map.removeLayer(entry.centerMarker);
            }
        } else {
            // 表示ONの会社がある → 地図に出す
            if (!window.map.hasLayer(entry.marker)) {
                entry.marker.addTo(window.map);
                entry.centerMarker.addTo(window.map);
            }

            // ★色の決定（魔法の部分）
            if (activeCompaniesForStop.length > 1) {
                // 複数社の表示がONになっているので「紫色」
                entry.marker.setStyle({ fillColor: window.APP_CONFIG.COMPANIES.shared.color });
            } else {
                // 1社しか表示ONになっていないので「その会社の色（単色）」に戻す
                const singleCompanyId = activeCompaniesForStop[0];
                const markerColor = window.APP_CONFIG.COMPANIES[singleCompanyId] 
                                    ? window.APP_CONFIG.COMPANIES[singleCompanyId].color 
                                    : '#000';
                entry.marker.setStyle({ fillColor: markerColor });
            }
        }
    });
};

loadAndDisplayStops();
