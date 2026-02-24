/**
 * js/timetable.js
 */

window.TimetableManager = {
    async showTimetable(stopId, companyIds) {
        const safeId = String(stopId).replace(/\s+/g, '_');
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (!container) return;

        container.innerHTML = "<div class='loading'>時刻表を統合中...</div>";

        let combinedTimes = [];

        // 1. 全ての会社からデータを収集
        for (const companyId of companyIds) {
            const company = BUS_COMPANIES.find(c => c.id === companyId);
            if (!company) continue;

            try {
                const activeServiceIds = await window.CalendarManager.getActiveServiceIds(company);
                if (activeServiceIds.length === 0) continue;

                // 改良した getValidTripIds (Mapが返る)
                const tripInfoMap = await window.CalendarManager.getValidTripIds(company, activeServiceIds);

                // Vercel API から取得
                const times = await this._getStopTimes(company, stopId, tripInfoMap);
                combinedTimes = combinedTimes.concat(times);

            } catch (e) {
                console.error(`${companyId} 取得失敗:`, e);
            }
        }

        // 2. 全データを時刻順にソート
        combinedTimes.sort((a, b) => a.time.localeCompare(b.time));

        // 3. まとめて描画
        this._renderCombinedTimetable(safeId, combinedTimes);
    },

    async _getStopTimes(company, stopId, tripInfoMap) {
        const safeStopId = encodeURIComponent(stopId);
        const apiUrl = `${window.API_BASE_URL}/api/get-stop-timetable?company_id=${company.id}&stop_id=${safeStopId}`;
        try {
            const res = await fetch(apiUrl);
            const lines = await res.json(); 
            const results = [];
            lines.forEach(line => {
                const cols = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                const tripId = cols[0];
                
                if (tripInfoMap.has(tripId)) {
                    const info = tripInfoMap.get(tripId);
                    // --- routes.txt から情報を引く ---
                    const routeData = (window.routeLookup[company.id] || {})[info.routeId] || { shortName: "", longName: "不明な路線" };
                
                    results.push({
                        time: cols[1].substring(0, 5),
                        routeShort: routeData.shortName, // 系統番号
                        routeLong: routeData.longName,   // 路線名（行先）
                        companyId: company.id,
                        companyName: company.name
                    });
                }
            });
            return results;
        } catch (err) { return []; }
    },

    _renderCombinedTimetable(safeId, times) {
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (!container) return;

        if (times.length === 0) {
            container.innerHTML = "<p>本日の運行予定はありません。</p>";
            return;
        }

        let html = `<table style="width:100%; border-collapse:collapse; font-size:12px;">`;
        html += `<thead style="position:sticky; top:0; background:#f8f8f8; z-index:1;">
                    <tr style="border-bottom:2px solid #ddd; text-align:left;">
                        <th style="padding:5px;">時刻</th>
                        <th style="padding:5px;">系統</th>
                        <th style="padding:5px;">行先</th>
                    </tr>
                 </thead><tbody>`;

        times.forEach(t => {
            const config = window.APP_CONFIG.COMPANIES[t.companyId];
            const dotHtml = `<span style="display:inline-block; width:8px; height:8px; background:${config.color}; border-radius:50%; margin-right:4px;"></span>`;
    
            html += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:8px 5px; font-weight:bold; font-size:1.2em;">${t.time}</td>
                <td style="padding:8px 5px;">
                    <div style="font-size:10px; color:#777;">${dotHtml}${t.companyName}</div>
                    <div style="font-weight:bold; color:#333;">${t.routeShort}</div>
                </td>
                <td style="padding:8px 5px; vertical-align:middle;">
                    <div style="color:#000; font-weight:500;">${t.routeLong}</div>
                </td>
            </tr>`;
        });
        html += `</tbody></table>`;
        
        container.innerHTML = html;
    }
};
