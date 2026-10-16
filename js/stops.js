/**
 * js/stops.js
 * 役割: バス停の統合管理と地図描画
 */

window.globalStopMap = window.globalStopMap || new Map();

window.loadCompanyStops = async function(company) {
    if (company.isStopsLoaded) return;

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

            // 犯人1対策：安全な分割処理
            const cols =[];
            let inQuotes = false;
            let current = '';
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    cols.push(current.trim().replace(/^"|"$/g, ''));
                    current = '';
                } else {
                    current += char;
                }
            }
            cols.push(current.trim().replace(/^"|"$/g, ''));

            if (cols.length <= Math.max(latIdx, lonIdx)) return;

            const originalStopId = cols[idIdx];
            const lat = parseFloat(cols[latIdx]);
            const lon = parseFloat(cols[lonIdx]);
            const stopName = cols[nameIdx];

            if (isNaN(lat) || isNaN(lon)) return;

            // 同じIDでも座標が離れていたら別の「内部キー」を作る
            let mapKey = originalStopId;

            if (window.globalStopMap.has(mapKey)) {
                let existing = window.globalStopMap.get(mapKey);
                const isDifferentLocation = (entry, tLat, tLon) => {
                    return Math.abs(entry.lat - tLat) > 0.0002 || Math.abs(entry.lon - tLon) > 0.0002;
                };

                if (isDifferentLocation(existing, lat, lon)) {
                    let suffix = 2;
                    let foundClose = false;
                    while (window.globalStopMap.has(`${originalStopId}_${suffix}`)) {
                        existing = window.globalStopMap.get(`${originalStopId}_${suffix}`);
                        if (!isDifferentLocation(existing, lat, lon)) {
                            mapKey = `${originalStopId}_${suffix}`;
                            foundClose = true;
                            break;
                        }
                        suffix++;
                    }
                    if (!foundClose) mapKey = `${originalStopId}_${suffix}`;
                }
            }

            // マーカーの登録または更新
            if (window.globalStopMap.has(mapKey)) {
                const entry = window.globalStopMap.get(mapKey);
                if (!entry.companies.includes(company.id)) {
                    entry.companies.push(company.id);
                }
            } else {
                // ★いよいよ出番！「IDが違うのに座標が同じ」バス停を少しズラす魔法
                let finalLat = lat;
                let finalLon = lon;
                const offset = 0.00005; // 約5メートル
                
                // すでに登録されている全バス停の中で、位置が丸被りしているものがあればズラす
                while (Array.from(window.globalStopMap.values()).some(e => 
                    Math.abs(e.lat - finalLat) < 0.00001 && Math.abs(e.lon - finalLon) < 0.00001
                )) {
                    finalLat += offset;
                    finalLon += offset; // 少し右上にズラす
                }

                const marker = L.circleMarker([finalLat, finalLon], {
                    radius: 6, color: 'rgba(0,0,0,0)', weight: 15, opacity: 0, fillOpacity: 1
                });
                const centerMarker = L.circleMarker([finalLat, finalLon], {
                    radius: 5, color: '#000', weight: 1, fill: false, interactive: false
                });

                const entry = {
                    marker: marker, 
                    centerMarker: centerMarker, 
                    companies:[company.id], 
                    name: stopName,
                    lat: finalLat, // ズラした後の座標を保存する
                    lon: finalLon,
                    originalStopId: originalStopId 
                };

                marker.on('click', () => {
                    const safeId = String(originalStopId).replace(/\s+/g, '_');
                    const popupHtml = `
                        <div style="min-width:220px;">
                            <strong>${entry.name}</strong><br>
                            <small style="color:#999;">ID: ${originalStopId}</small>
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
                        window.TimetableManager.showTimetable(originalStopId, visibleCompanies);
                    }
                });

                window.globalStopMap.set(mapKey, entry);
            }
        });
    } catch (e) { console.error(e); }

    company.isStopsLoaded = true;
};

window.loadAndDisplayStops = async function() {
    if (!window.map) {
        setTimeout(window.loadAndDisplayStops, 500);
        return;
    }
    const promises = window.BUS_COMPANIES
        .filter(c => c.active && c.visible !== false)
        .map(c => window.loadCompanyStops(c));
    await Promise.all(promises);
    window.updateStopsDisplay();
};

window.updateStopsDisplay = function() {
    if (!window.map) return;
    const visibleCompanyIds = window.BUS_COMPANIES.filter(c => c.visible !== false).map(c => c.id);

    window.globalStopMap.forEach((entry, mapKey) => {
        const activeCompaniesForStop = entry.companies.filter(cid => visibleCompanyIds.includes(cid));

        if (activeCompaniesForStop.length === 0) {
            if (window.map.hasLayer(entry.marker)) {
                window.map.removeLayer(entry.marker);
                window.map.removeLayer(entry.centerMarker);
            }
        } else {
            if (!window.map.hasLayer(entry.marker)) {
                entry.marker.addTo(window.map);
                entry.centerMarker.addTo(window.map);
            }
            if (activeCompaniesForStop.length > 1) {
                entry.marker.setStyle({ fillColor: window.APP_CONFIG.COMPANIES.shared.color });
            } else {
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
