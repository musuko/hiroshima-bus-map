/**
 * stopLookup を使って地図に描画する
 * データ取得は行わない
 */

window.globalStopMap = window.globalStopMap || L.layerGroup();
window.renderStops = function() {
    console.log("stopLookup件数:", Object.keys(window.stopLookup).length);
    console.log("サンプル:", Object.values(window.stopLookup)[0]);

    if (!window.map) {
        console.warn("⚠ map が未初期化です");
        return;
    }
        // 既存のバス停をクリア
    window.globalStopMap.clearLayers();

    const STOP_RADIUS = window.APP_CONFIG.MAP.STOP_RADIUS;
    const STOP_WEIGHT = window.APP_CONFIG.MAP.STOP_WEIGHT;

    Object.entries(window.stopLookup).forEach(([stopId, stopData]) => {
        // 緯度経度がない場合は描画しない
        if (stopData.lat == null || stopData.lon == null) return;

        const companies = stopData.companies || [];

        // ===== 色の決定 =====
        let color;

        if (companies.length >= 2) {
            // 会社衝突 → shared（紫）
            color = window.APP_CONFIG.COMPANIES.shared.color;
        } else if (companies.length === 1) {
            const companyId = companies[0];
            color =
                window.APP_CONFIG.COMPANIES[companyId]?.color ||
                "#333333";
        } else {
            color = "#999999";
        }

        // ===== バス停描画 =====
        const marker = L.circleMarker(
            [parseFloat(stopData.lat), parseFloat(stopData.lon)],
            {
                radius: STOP_RADIUS,
                color: color,
                weight: 1,
                fillColor: color,
                fillOpacity: 0.9
            }
        );

        // ===== クリック時：時刻表表示 =====
        marker.on("click", () => {
            if (window.showTimetableForStop) {
                window.showTimetableForStop(stopId);
                console.log("stopId", stopId);
            } else {
                console.warn("showTimetableForStop が存在しません");
            }
        });

        // marker.bindTooltip(stopData.name, {
        //     direction: "top",
        //     offset: [0, -5]
        // });
    

        window.globalStopMap.addLayer(marker);
    });

    window.globalStopMap.addTo(window.map);

    console.log("🚌 バス停描画完了");
};