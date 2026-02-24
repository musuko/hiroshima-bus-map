/**
 * js/stops.js
 * 役割: バス停データを読み込み、地図にマーカーを配置する
 */

async function loadAndDisplayStops() {
    if (!window.map) {
        setTimeout(loadAndDisplayStops, 500);
        return;
    }

    console.log("📍 バス停の地図描画を開始します...");

    for (const company of BUS_COMPANIES) {
        try {
            const response = await fetch(`${company.staticPath}stops.txt`);
            if (!response.ok) continue;

            const text = await response.text();
            const lines = text.trim().split(/\r?\n/);
            // ヘッダーをきれいに掃除（目に見えない文字を削除）
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

            console.log(`${company.name} ヘッダー解析結果:`, headers);

            // 列の番号を探す（部分一致や小文字にも対応）
            const idIdx = headers.findIndex(h => h.includes('stop_id'));
            const nameIdx = headers.findIndex(h => h.includes('stop_name'));
            const latIdx = headers.findIndex(h => h.includes('stop_lat'));
            const lonIdx = headers.findIndex(h => h.includes('stop_lon'));

            // 必須の列（緯度・経度）が見つからない場合はスキップ
            if (latIdx === -1 || lonIdx === -1) {
                console.error(`❌ ${company.name}: 緯度(stop_lat)または経度(stop_lon)の列が見つかりません。ヘッダーを確認してください。`);
                continue;
            }

            const markerColor = (company.id === 'hirobus') ? '#FF0000' : '#ADFF2F';
            let successCount = 0;

            lines.slice(1).forEach((line, index) => {
                if (!line.trim()) return; // 空行は無視

                const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                
                // 列の数が足りない、またはデータが空の場合は無視
                if (cols.length <= Math.max(latIdx, lonIdx)) return;

                const lat = parseFloat(cols[latIdx]);
                const lon = parseFloat(cols[lonIdx]);
                const stopId = cols[idIdx];
                const stopName = cols[nameIdx];

                // 座標が正しい数字でない場合は無視（これが今回のエラー対策）
                if (isNaN(lat) || isNaN(lon)) {
                    // 最初の数件だけ警告を出す（ログが埋まらないように）
                    if (successCount < 1) console.warn(`データ不正(行 ${index+2}):`, line);
                    return;
                }

                // 地図に円形マーカーを追加（当たり判定を広く設定）
                const marker = L.circleMarker([lat, lon], {
                    radius: 6,
                    fillColor: markerColor,
                    color: 'rgba(0,0,0,0)', // 当たり判定用の透明な縁
                    weight: 15,             // タップしやすく
                    opacity: 0,             // 縁は見せない
                    fillOpacity: 1          // 中身はくっきり
                }).addTo(window.map);

                // 中央の小さな黒枠（見た目用）
                L.circleMarker([lat, lon], {
                    radius: 5,
                    color: '#000',
                    weight: 1,
                    fill: false,
                    interactive: false
                }).addTo(window.map);

                // クリックイベント
                marker.on('click', () => {
                    const safeId = String(stopId).replace(/\s+/g, '_');
                    const popupHtml = `
                        <div style="min-width:200px;">
                            <strong>${stopName}</strong><br>
                            <small style="color:#999;">ID: ${stopId}</small>
                            <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                            <div class="timetable-content-${safeId}">
                                <div class="loading" style="font-size:11px; color:#888;">時刻表を取得中...</div>
                            </div>
                        </div>`;
                    
                    marker.bindPopup(popupHtml).openPopup();
                    
                    if (window.TimetableManager && window.TimetableManager.showTimetable) {
                        window.TimetableManager.showTimetable(stopId, company.id);
                    }
                });
                successCount++;
            });

            console.log(`✅ ${company.name}: ${successCount} 件のバス停を描画しました。`);

        } catch (error) {
            console.error(`${company.name} 処理エラー:`, error);
        }
    }
}

loadAndDisplayStops();
