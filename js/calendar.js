// js/timetable.js

window.TimetableManager = {
    /**
     * バス停クリック時に、今日運行している便の時刻表を生成する
     */
    async showTimetable(stopId, companyId) {
        console.log(`🚏 バス停時刻表取得開始: ${stopId} (${companyId})`);
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) return;

        try {
            // 1. 今日有効な service_id を取得 (祝日・例外対応)
            const activeServiceIds = await this._getTodayServiceIds(company);
            if (activeServiceIds.length === 0) {
                this._renderNoData(stopId);
                return;
            }

            // 2. trips.txt から有効な service_id を持つ trip_id を抽出
            const validTripIds = await this._getValidTripIds(company, activeServiceIds);

            // 3. stop_times.txt から、このバス停かつ有効な trip_id の時刻を抽出
            const times = await this._getStopTimes(company, stopId, validTripIds);

            // 4. 表示
            this._renderTimetable(stopId, company.name, times);

        } catch (e) {
            console.error("時刻表生成エラー:", e);
            this._renderNoData(stopId);
        }
    },

    /**
     * [重要] 今日有効な service_id を判定するロジック
     */
    async _getTodayServiceIds(company) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}${m}${d}`; // "20260223"

        // Step A: 曜日による基本IDの取得
        let serviceIds = await this._getIdsByWeekday(company, now);

        // Step B: calendar_dates.txt による例外(祝日・特殊ID)の適用
        try {
            const res = await fetch(`${company.staticPath}calendar_dates.txt`);
            if (res.ok) {
                const text = await res.text();
                const lines = text.trim().split(/\r?\n/);
                const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                const sIdx = head.indexOf('service_id');
                const dIdx = head.indexOf('date');
                const eIdx = head.indexOf('exception_type');

                const idSet = new Set(serviceIds);

                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                    if (cols[dIdx] === todayStr) {
                        const sid = cols[sIdx];
                        if (cols[eIdx] === '1') {
                            idSet.add(sid);    // 祝日ダイヤや特殊IDを追加
                        } else if (cols[eIdx] === '2') {
                            idSet.delete(sid); // 平日ダイヤを削除
                        }
                    }
                }
                serviceIds = Array.from(idSet);
            }
        } catch (err) {
            console.warn("calendar_dates.txt が読み込めません:", err);
        }

        console.log(`📅 ${company.name} 今日の有効ID:`, serviceIds);
        return serviceIds;
    },

    async _getIdsByWeekday(company, dateObj) {
        try {
            const res = await fetch(`${company.staticPath}calendar.txt`);
            const text = await res.text();
            const lines = text.trim().split(/\r?\n/);
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const todayCol = dayNames[dateObj.getDay()];
            
            const sIdx = head.indexOf('service_id');
            const dIdx = head.indexOf(todayCol);
            
            const ids = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (cols[dIdx] === '1') ids.push(cols[sIdx]);
            }
            return ids;
        } catch (e) { return []; }
    },

    async _getValidTripIds(company, activeServiceIds) {
        const res = await fetch(`${company.staticPath}trips.txt`);
        const text = await res.text();
        const lines = text.trim().split(/\r?\n/);
        const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        const sIdx = head.indexOf('service_id');
        const tIdx = head.indexOf('trip_id');

        const validTrips = new Set();
        const activeSet = new Set(activeServiceIds);

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (activeSet.has(cols[sIdx])) {
                validTrips.add(cols[tIdx]);
            }
        }
        return validTrips;
    },

    async _getStopTimes(company, stopId, validTripIds) {
        const res = await fetch(`${company.staticPath}stop_times.txt`);
        const text = await res.text();
        const lines = text.trim().split(/\r?\n/);
        const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        const tIdx = head.indexOf('trip_id');
        const sIdx = head.indexOf('stop_id');
        const aIdx = head.indexOf('arrival_time');
        const hIdx = head.indexOf('stop_headsign');

        const results = [];
        for (let i = 1; i < lines.length; i++) {
            // 高速化のため、行の中に stopId と tripId の一部が含まれているか確認
            if (lines[i].includes(stopId)) {
                const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (cols[sIdx] === stopId && validTripIds.has(cols[tIdx])) {
                    results.push({
                        time: cols[aIdx].substring(0, 5),
                        headsign: cols[hIdx] || "運行便"
                    });
                }
            }
        }
        // 時刻順にソート
        return results.sort((a, b) => a.time.localeCompare(b.time));
    },

    _renderTimetable(stopId, companyName, times) {
        const container = document.querySelector(`.timetable-content-${stopId}`);
        if (!container) return;

        if (times.length === 0) {
            container.innerHTML = "<p>本日の運行予定はありません。</p>";
            return;
        }

        let html = `<div style="font-weight:bold; margin-bottom:5px; border-bottom:2px solid #333;">${companyName} 本日の時刻表</div>`;
        html += `<table style="width:100%; font-size:12px;">`;
        times.forEach(t => {
            html += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:4px 0; font-size:1.2em; font-weight:bold;">${t.time}</td>
                <td style="padding:4px 0; text-align:right; color:#666;">${t.headsign}</td>
            </tr>`;
        });
        html += `</table>`;
        container.innerHTML = html;
    },

    _renderNoData(stopId) {
        const container = document.querySelector(`.timetable-content-${stopId}`);
        if (container) container.innerHTML = "<p>時刻表データを取得できませんでした。</p>";
    }
};

console.log("✅ timetable.js (祝日・特殊ID対応版) 読み込み完了");
