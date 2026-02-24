/**
 * js/timetable.js
 */

window.TimetableManager = {
    async showTimetable(stopId, companyIds) {
        const safeId = String(stopId).replace(/\s+/g, '_');
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (!container) return;

        container.innerHTML = "<div class='loading' style='font-size:12px; padding:10px;'>時刻表を統合中...</div>";

        let combinedTimes = [];

        for (const companyId of companyIds) {
            const company = BUS_COMPANIES.find(c => c.id === companyId);
            if (!company) continue;

            try {
                const activeServiceIds = await window.CalendarManager.getActiveServiceIds(company);
                const tripInfoMap = await window.CalendarManager.getValidTripIds(company, activeServiceIds);
                const times = await this._getStopTimes(company, stopId, tripInfoMap);
                combinedTimes = combinedTimes.concat(times);
            } catch (e) { console.error(e); }
        }

        combinedTimes.sort((a, b) => a.time.localeCompare(b.time));
        this._renderCombinedTimetable(safeId, combinedTimes);
    },

async _getStopTimes(company, stopId, validTripIds) {
        const safeStopId = encodeURIComponent(stopId);
        const apiUrl = `${window.API_BASE_URL}/api/get-stop-timetable?company_id=${company.id}&stop_id=${safeStopId}`;
        
        try {
            const res = await fetch(apiUrl);
            if (!res.ok) {
                console.error(`❌ APIエラー: ${res.status}`);
                return [];
            }
            const data = await res.json();
            
            // 【調査ログ1】APIから何件届いたか？
            console.log(`📡 API受信結果 (${company.id}): ${data.length}件届きました`, data.slice(0, 3));

            const results = [];
            data.forEach(item => {
                // 【調査ログ2】フィルタリングの成否を確認
                const hasTrip = validTripIds.has(item.tripId || item.tId); // プロパティ名が合っているか
                
                if (hasTrip) {
                    const info = tripInfoMap.get(item.tripId || item.tId);
                    // ... 略 ...
                    results.push({ ... });
                }
            });

            // 【調査ログ3】最終的に残った件数
            console.log(`✅ フィルタリング後 (${company.id}): ${results.length}件残りました`);
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

        let html = `<table style="width:100%; border-collapse:collapse; font-size:12px;">`;
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
        html += `</tbody></table>`;
        
        container.innerHTML = html;
    }
};
