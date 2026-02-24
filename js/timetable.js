/**
 * js/timetable.js
 */

window.TimetableManager = {
    async showTimetable(stopId, companyId) {
        // IDのスペースを置換（HTMLクラス名用）
        const safeId = String(stopId).replace(/\s+/g, '_');
        
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) return;

        try {
            // 1. カレンダー判定 (calendar.js を使用)
            const activeServiceIds = await window.CalendarManager.getActiveServiceIds(company);
            if (activeServiceIds.length === 0) {
                this._renderNoData(safeId, "本日の運行予定はありません(Service ID未定義)");
                return;
            }

            // 2. 有効な trip_id を抽出 (calendar.js を使用)
            const validTripIds = await window.CalendarManager.getValidTripIds(company, activeServiceIds);

            // 3. Vercel API からこのバス停の時刻を取得
            const times = await this._getStopTimes(company, stopId, validTripIds);

            // 4. 表示
            this._renderTimetable(safeId, company.name, times);

        } catch (e) {
            console.error("時刻表生成エラー:", e);
            this._renderNoData(safeId, "時刻表データの取得に失敗しました");
        }
    },

    /**
     * Vercel API 経由での時刻取得
     */
    async _getStopTimes(company, stopId, validTripIds) {
        const safeStopId = encodeURIComponent(stopId);
        const apiUrl = `${window.API_BASE_URL}/api/get-stop-timetable?company_id=${company.id}&stop_id=${safeStopId}`;
        
        try {
            const res = await fetch(apiUrl);
            if (!res.ok) throw new Error("APIエラー");
            const lines = await res.json(); 

            const results = [];
            lines.forEach(line => {
                const cols = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                const tripId = cols[0];
                const arrivalTime = cols[1];

                if (validTripIds.has(tripId)) {
                    results.push({
                        time: arrivalTime.substring(0, 5),
                        headsign: "運行便" 
                    });
                }
            });
            return results.sort((a, b) => a.time.localeCompare(b.time));
        } catch (err) {
            return [];
        }
    },

    _renderTimetable(safeId, companyName, times) {
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (!container) return;

        // config.js の設定を使用
        const maxHeight = window.APP_CONFIG.UI.TIMETABLE_MAX_HEIGHT;

        if (times.length === 0) {
            container.innerHTML = "<p>本日の運行予定はありません。</p>";
            return;
        }

        let html = `<div style="font-weight:bold; margin-bottom:5px; border-bottom:2px solid #333;">${companyName} 本日の時刻表</div>`;
        html += `<div style="max-height: ${maxHeight}; overflow-y: auto;">`;
        html += `<table style="width:100%; font-size:12px;">`;
        times.forEach(t => {
            html += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:4px 0; font-size:1.2em; font-weight:bold;">${t.time}</td>
                <td style="padding:4px 0; text-align:right; color:#666;">${t.headsign}</td>
            </tr>`;
        });
        html += `</table></div>`;
        container.innerHTML = html;
    },

    _renderNoData(safeId, msg) {
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (container) container.innerHTML = `<p>${msg || "データなし"}</p>`;
    }
};
