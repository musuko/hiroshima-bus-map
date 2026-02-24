/**
 * js/timetable.js
 * 
 * 役割: バス停クリック時に、今日の運行スケジュールを抽出して表示する
 * 変更点: 巨大な stop_times.txt の読み込みを廃止し、Vercel API 経由で取得する
 */

window.TimetableManager = {
    /**
     * バス停クリック時のメインエントリーポイント
     */
    async showTimetable(stopId, companyId) {
        // セレクター作成（IDにスペースがある場合はアンダースコアに置換）
        const safeIdForSelector = stopId.replace(/\s+/g, '_');
        const containerSelector = `.timetable-content-${safeIdForSelector}`;
        
        console.log(`🚏 時刻表取得開始: ID=${stopId}, Company=${companyId}`);
        
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) return;

        try {
            // 1. 今日有効な service_id を取得 (calendar.txt, calendar_dates.txt を使用)
            // ※これは trips.txt をフィルタリングするために必要
            const activeServiceIds = await this._getTodayServiceIds(company);
            if (activeServiceIds.length === 0) {
                this._renderNoData(stopId, "本日のサービス設定が見つかりません");
                return;
            }

            // 2. trips.txt から、今日運行している trip_id のリストを作る
            const validTripIds = await this._getValidTripIds(company, activeServiceIds);

            // 3. Vercel API を叩いて、このバス停の時刻データだけを取得する
            const times = await this._getStopTimes(company, stopId, validTripIds);

            // 4. 画面に表示
            this._renderTimetable(stopId, company.name, times);

        } catch (e) {
            console.error("時刻表生成エラー:", e);
            this._renderNoData(stopId, "データの読み込みに失敗しました");
        }
    },

    /**
     * [修正点] Vercel API を使用して、特定のバス停のデータだけを取得する
     */
    async _getStopTimes(company, stopId, validTripIds) {
        // スペースを含むIDを安全にURLに含める
        const safeStopId = encodeURIComponent(stopId);
        const apiUrl = `/api/get-stop-timetable?company_id=${company.id}&stop_id=${safeStopId}`;
        
        try {
            const res = await fetch(apiUrl);
            if (!res.ok) throw new Error("APIレスポンスエラー");
            
            const lines = await res.json(); // Vercelから抽出された行が届く
            const results = [];

            lines.forEach(line => {
                const cols = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                
                // GTFSの列順序: 0:trip_id, 1:arrival_time, 2:departure_time, 3:stop_id
                const tripId = cols[0];
                const arrivalTime = cols[1];

                // 今日の運行便(validTripIds)に含まれている場合のみ採用
                if (validTripIds.has(tripId)) {
                    results.push({
                        time: arrivalTime.substring(0, 5), // "10:30:00" -> "10:30"
                        headsign: "運行便" // 必要に応じて route_id などから取得可能
                    });
                }
            });

            // 時刻順にソート
            return results.sort((a, b) => a.time.localeCompare(b.time));
        } catch (err) {
            console.error("API fetch error:", err);
            return [];
        }
    },

    /**
     * 今日有効な service_id を判定 (これは静的な calendar.txt を使う)
     */
    async _getTodayServiceIds(company) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}${m}${d}`;

        let serviceIds = await this._getIdsByWeekday(company, now);

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
                        if (cols[eIdx] === '1') idSet.add(cols[sIdx]);
                        else if (cols[eIdx] === '2') idSet.delete(cols[sIdx]);
                    }
                }
                serviceIds = Array.from(idSet);
            }
        } catch (err) { console.warn("例外カレンダーなし"); }

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
            if (activeSet.has(cols[sIdx])) validTrips.add(cols[tIdx]);
        }
        return validTrips;
    },

    _renderTimetable(stopId, companyName, times) {
        const safeId = stopId.replace(/\s+/g, '_');
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (!container) return;

        if (times.length === 0) {
            container.innerHTML = "<p>本日の運行予定はありません。</p>";
            return;
        }

        let html = `<div style="font-weight:bold; margin-bottom:5px; border-bottom:2px solid #333;">${companyName}</div>`;
        html += `<table style="width:100%; font-size:12px;">`;
        times.forEach(t => {
            html += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:4px 0; font-weight:bold;">${t.time}</td>
                <td style="padding:4px 0; text-align:right; color:#666;">${t.headsign}</td>
            </tr>`;
        });
        html += `</table>`;
        container.innerHTML = html;
    },

    _renderNoData(stopId, msg) {
        const safeId = stopId.replace(/\s+/g, '_');
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (container) container.innerHTML = `<p>${msg}</p>`;
    }
};

console.log("✅ timetable.js (Vercel API抽出版) ロード完了");
