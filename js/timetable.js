/**
 * js/timetable.js
 * 役割: バス停クリック時に、Vercel APIを利用して「今日の」時刻表を表示する
 */

window.TimetableManager = {
    /**
     * メイン関数: バス停マーカーのクリック時に呼ばれる
     */
    async showTimetable(stopId, companyId) {
        // HTMLのクラス名用にスペースをアンダースコアに変換
        const safeId = String(stopId).replace(/\s+/g, '_');
        const containerSelector = `.timetable-content-${safeId}`;
        
        console.log(`🚏 時刻表取得開始: ID="${stopId}", Company="${companyId}"`);
        
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) {
            console.error("会社情報が見つかりません:", companyId);
            return;
        }

        try {
            // 1. 今日有効な service_id を判定 (calendar.txt, calendar_dates.txt を使用)
            const activeServiceIds = await this._getTodayServiceIds(company);
            if (activeServiceIds.length === 0) {
                this._renderNoData(safeId, "本日のサービス設定が見つかりません");
                return;
            }

            // 2. trips.txt を読み込み、今日運行している trip_id のセットを作る
            const validTripIds = await this._getValidTripIds(company, activeServiceIds);

            // 3. Vercel API を叩いて、このバス停の通過時刻を高速抽出
            const times = await this._getStopTimes(company, stopId, validTripIds);

            // 4. 結果を画面（ポップアップ内）に描画
            this._renderTimetable(safeId, company.name, times);

        } catch (e) {
            console.error("時刻表生成エラー:", e);
            this._renderNoData(safeId, "データの読み込みに失敗しました");
        }
    },

    /**
     * Vercel API から、特定のバス停の行だけを取得する
     */
    async _getStopTimes(company, stopId, validTripIds) {
        const safeStopId = encodeURIComponent(stopId);
        const apiUrl = `/api/get-stop-timetable?company_id=${company.id}&stop_id=${safeStopId}`;
        
        try {
            const res = await fetch(apiUrl);
            if (!res.ok) throw new Error("APIレスポンスエラー");
            
            const lines = await res.json(); 
            const results = [];

            lines.forEach(line => {
                const cols = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                
                // GTFS標準順序: 0:trip_id, 1:arrival_time
                const tripId = cols[0];
                const arrivalTime = cols[1];

                // trips.txtで確認した「今日運行する便」のみを採用
                if (validTripIds.has(tripId)) {
                    results.push({
                        time: arrivalTime.substring(0, 5), // "HH:MM:SS" -> "HH:MM"
                        headsign: "運行便" 
                    });
                }
            });

            // 時刻順に並び替え
            return results.sort((a, b) => a.time.localeCompare(b.time));
        } catch (err) {
            console.error("API fetch error:", err);
            return [];
        }
    },

    /**
     * 曜日と日付から今日有効な service_id のリストを取得
     */
    async _getTodayServiceIds(company) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}${m}${d}`;

        // 基本の曜日ID
        let serviceIds = await this._getIdsByWeekday(company, now);

        // 例外(祝日など)の適用
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
        } catch (err) { /* 無視 */ }

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

    _renderTimetable(safeId, companyName, times) {
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
                <td style="padding:4px 0; font-size:1.1em; font-weight:bold;">${t.time}</td>
                <td style="padding:4px 0; text-align:right; color:#666;">${t.headsign}</td>
            </tr>`;
        });
        html += `</table>`;
        container.innerHTML = html;
    },

    _renderNoData(safeId, msg) {
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (container) container.innerHTML = `<p>${msg}</p>`;
    }
};

console.log("✅ timetable.js (全コード更新完了)");
