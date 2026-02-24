/**
 * js/timetable.js
 * 修正点: 文法エラーの解消と Vercel API (destId) 連携
 */

window.TimetableManager = {
    async showTimetable(stopId, companyIds) {
        const safeId = String(stopId).replace(/\s+/g, '_');
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (!container) return;

        container.innerHTML = "<div class='loading' style='font-size:12px; padding:10px;'>時刻表を統合中...</div>";

        let combinedTimes = [];

        for (const companyId of companyIds) {
            const company = window.BUS_COMPANIES.find(c => c.id === companyId);
            if (!company) continue;

            try {
                // 1. カレンダー判定
                const activeServiceIds = await window.CalendarManager.getActiveServiceIds(company);
                if (activeServiceIds.length === 0) continue;

                // 2. 有効な trip_id 情報を取得 (Mapが返る)
                const tripInfoMap = await window.CalendarManager.getValidTripIds(company, activeServiceIds);

                // 3. Vercel API から取得
                const times = await this._getStopTimes(company, stopId, tripInfoMap);
                combinedTimes = combinedTimes.concat(times);
            } catch (e) { 
                console.error(`${companyId} 取得失敗:`, e); 
            }
        }

        combinedTimes.sort((a, b) => a.time.localeCompare(b.time));
        this._renderCombinedTimetable(safeId, combinedTimes);
    },

    async _getStopTimes(company, stopId, tripInfoMap) {
        const safeStopId = encodeURIComponent(stopId);
        const apiUrl = `${window.API_BASE_URL}/api/get-stop-timetable?company_id=${company.id}&stop_id=${safeStopId}`;
        
        try {
            const res = await fetch(apiUrl);
            if (!res.ok) throw new Error("API通信エラー");
            const data = await res.json(); 
            
            const results = [];
            data.forEach(item => {
                // Vercelからのキー名 (tripId) が tripInfoMap にあるか確認
                if (tripInfoMap.has(item.tripId)) {
                    const info = tripInfoMap.get(item.tripId);
                    
                    // routes.txt から系統情報を引く
                    const routeData = (window.routeLookup[company.id] || {})[info.routeId] || { shortName: "", longName: "" };
                    
                    // stopLookup から終点IDの名前を引く
                    const destInfo = window.stopLookup[item.destId];
                    const destinationName = destInfo ? destInfo.name : "終点不明";

                    results.push({
                        time: item.time.substring(0, 5),
                        routeShort: routeData.shortName,
                        destination: destinationName,
                        companyId: company.id,
                        companyName: company.name
                    });
                }
            });
            return results;
        } catch (err) {
            console.error("fetch error:", err);
            return [];
        }
    },

    _renderCombinedTimetable(safeId, times) {
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (!container) return;

        if (times.length === 0) {
            container.innerHTML = "<p style='padding:10px;'>本日の運行予定はありません。</p>";
            return;
        }

        const maxHeight = window.APP_CONFIG.UI.TIMETABLE_MAX_HEIGHT || "250px";

        let html = `<div style="max-height:${maxHeight}; overflow-y:auto;">`;
        html += `<table style="width:100%; border-collapse:collapse; font-size:12px;">`;
        html += `<thead style="position:sticky; top:0; background:#eee; z-index:1;">
                    <tr style="text-align:left; border-bottom:2px solid #ccc;">
                        <th style="padding:6px 4px;">時刻</th>
                        <th style="padding:6px 4px;">系統</th>
                        <th style="padding:6px 4px;">行先</th>
                    </tr>
                 </thead><tbody>`;

        times.forEach(t => {
            const config = window.APP_CONFIG.COMPANIES[t.companyId];
            const dotHtml = `<span style="display:inline-block; width:7px; height:7px; background:${config.color}; border-radius:50%; margin-right:3px; border:1px solid #999;"></span>`;

            html += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 4px; font-weight:bold; font-size:1.2em; vertical-align:middle;">${t.time}</td>
                <td style="padding:10px 4px; vertical-align:middle;">
                    <div style="font-size:9px; color:#666; white-space:nowrap;">${dotHtml}${t.companyName}</div>
                    <div style="font-weight:bold; font-size:1.1em; color:#333;">${t.routeShort}</div>
                </td>
                <td style="padding:10px 4px; vertical-align:middle;">
                    <div style="font-weight:bold; color:#000;">${t.destination} <span style="font-weight:normal; font-size:0.8em; color:#666;">行</span></div>
                </td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }
};

console.log("✅ timetable.js 修正完了");
