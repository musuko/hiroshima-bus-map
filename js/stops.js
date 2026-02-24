/**
 * js/stops.js
 * 役割: 静的な stops.txt を読み込み、地図上にバス停マーカーを配置する
 */

async function loadAndDisplayStops() {
    console.log("📍 バス停の読み込みを開始します...");

    for (const company of BUS_COMPANIES) {
        try {
            const response = await fetch(`${company.staticPath}stops.txt`);
            if (!response.ok) continue;

            const text = await response.text();
            const lines = text.trim().split(/\r?\n/);
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

            // 列のインデックスを取得
            const idIdx = headers.indexOf('stop_id');
            const nameIdx = headers.indexOf('stop_name');
            const latIdx = headers.indexOf('stop_lat');
            const lonIdx = headers.indexOf('stop_lon');

            // 会社ごとの色設定
            const markerColor = (company.id === 'hirobus') ? '#FF0000' : '#ADFF2F'; // 広バス: 赤 / 広電: 黄緑

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                if (cols.length <= latIdx) continue;

                const stop = {
                    stopId: cols[idIdx],
                    name: cols[nameIdx],
                    lat: parseFloat(cols[latIdx]),
                    lon: parseFloat(cols[lonIdx]),
                    companyId: company.id
                };

                if (isNaN(stop.lat) || isNaN(stop.lon)) continue;

                // 地図上にマーカー（円形）を作成
                const marker = L.circleMarker([stop.lat, stop.lon], {
                    radius: 6,
                    fillColor: markerColor,
                    color: "#000",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(window.map);

                // --- クリックイベントの設定 ---
                marker.on('click', async () => {
                    // 1. HTMLのID/クラス名用にスペースをアンダースコアに置換
                    const safeId = String(stop.stopId).replace(/\s+/g, '_');
                    
                    // 2. ポップアップのHTML構成を作成
                    const popupHtml = `
                        <div style="min-width:200px; max-height:300px; overflow-y:auto;">
                            <strong style="color:${markerColor === '#FF0000' ? '#e60012' : '#008000'}">${stop.name}</strong><br>
                            <small style="color:#999;">停留所ID: ${stop.stopId}</small>
                            <div style="font-size:10px; color:#ccc;">${company.name}</div>
                            <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                            <div class="timetable-content-${safeId}">
                                <div class="loading" style="font-size:11px; color:#888;">時刻表を生成中...</div>
                            </div>
                        </div>`;
                    
                    // ポップアップを表示
                    marker.bindPopup(popupHtml).openPopup();
                    
                    // 3. timetable.js の時刻表生成エンジンを呼び出す
                    if (window.TimetableManager && window.TimetableManager.showTimetable) {
                        // 第1引数: スペース入りの元のID, 第2引数: 会社ID
                        window.TimetableManager.showTimetable(stop.stopId, stop.companyId);
                    } else {
                        console.error("TimetableManager が見つかりません。jsの読み込み順序を確認してください。");
                    }
                });
            }
            console.log(`✅ ${company.name} のバス停配置完了 (${lines.length - 1}件)`);

        } catch (error) {
            console.error(`${company.name} のバス停読み込みに失敗:`, error);
        }
    }
    console.log(`✅ すべてのバス停の色分け・配置が完了しました`);
}

// マップが初期化された後に実行するように設定（main.jsから呼ばれる想定）
// もしmain.jsで呼んでいない場合は、ここに window.addEventListener('load', ...) を追加します
