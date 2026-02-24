/**
 * js/timetable.js
 */

window.TimetableManager = {
    /**
     * @param {string} stopId 
     * @param {string[]} companyIds 会社IDの配列（共通バス停対応）
     */
    async showTimetable(stopId, companyIds) {
        const safeId = String(stopId).replace(/\s+/g, '_');
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (!container) return;

        container.innerHTML = ""; // 読み込み表示をクリア

        // 渡された会社リスト（1つまたは複数）を順番に取得
        for (const companyId of companyIds) {
            const company = BUS_COMPANIES.find(c => c.id === companyId);
            if (!company) continue;

            try {
                // 1. カレンダー判定
                const activeServiceIds = await window.CalendarManager.getActiveServiceIds(company);
                if (activeServiceIds.length === 0) continue;

                // 2. 有効な trip_id を抽出
                const validTripIds = await window.CalendarManager.getValidTripIds(company, activeServiceIds);

                // 3. Vercel API から取得
                const times = await this._getStopTimes(company, stopId, validTripIds);

                // 4. 表示（既存の表示に追加していく）
                this._renderTimetableSection(safeId, company, times);

            } catch (e) {
                console.error(`${companyId} の取得エラー:`, e);
            }
        }

        if (container.innerHTML === "") {
            container.innerHTML = "<p>本日の運行予定はありません。</p>";
        }
    },

    async _getStopTimes(company, stopId, validTripIds) {
        const safeStopId = encodeURIComponent(stopId);
        const apiUrl = `${window.API_BASE_URL}/api/get-stop-timetable?company_id=${company.id}&stop_id=${safeStopId}`;
        try {
            const res = await fetch(apiUrl);
            const lines = await res.json(); 
            const results = [];
            lines.forEach(line => {
                const cols = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (validTripIds.has(cols[0])) {
                    results.push({ time: cols[1].substring(0, 5), headsign: "運行便" });
                }
            });
            return results.sort((a, b) => a.time.localeCompare(b.time));
        } catch (err) { return []; }
    },

    /**
     * 各会社ごとの時刻表セクションを描画
     */
    _renderTimetableSection(safeId, company, times) {
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (!container || times.length === 0) return;

        const companyColor = window.APP_CONFIG.COMPANIES[company.id]?.textColor || "#333";

        let html = `<div style="font-weight:bold; margin-top:10px; border-bottom:2px solid ${companyColor}; color:${companyColor};">${company.name}</div>`;
        html += `<table style="width:100%; font-size:12px; margin-bottom:10px;">`;
        times.forEach(t => {
            html += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:4px 0; font-weight:bold; width:50px;">${t.time}</td>
                <td style="padding:4px 0; text-align:right; color:#666;">${t.headsign}</td>
            </tr>`;
        });
        html += `</table>`;
        
        container.innerHTML += html;
    }
};
