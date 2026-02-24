/**
 * js/calendar.js
 * 役割: GTFSデータの有効期限チェック、および今日運行する service_id / trip_id の判定
 */

window.CalendarManager = {
    /**
     * 今日有効な service_id を取得し、データの期限切れもチェックする
     */
    async getActiveServiceIds(company) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}${m}${d}`; // "20260224"
        const todayNum = parseInt(todayStr);

        console.log(`📅 ${company.name} カレンダー判定開始: 今日=${todayStr}`);

        // 1. calendar.txt から基本IDとデータの有効期間を取得
        const { serviceIds, minStartDate, maxEndDate } = await this._getIdsByWeekday(company, now);

        // 2. データ有効期限の警告チェック
        if (minStartDate > 0 && maxEndDate > 0) {
            if (todayNum < minStartDate || todayNum > maxEndDate) {
                console.warn(`⚠️ 【データ期限切れ警告】${company.name} のデータ有効期間(${minStartDate}〜${maxEndDate})外です。`);
                // 必要であればここでユーザー向けのフラグを立てることも可能
            }
        }

        // 3. calendar_dates.txt による例外(祝日・特殊ダイヤ)の適用
        const finalServiceIds = await this._applyExceptions(company, serviceIds, todayStr);

        return finalServiceIds;
    },

    /**
     * 曜日による基本IDの取得と、ファイル全体の有効期間の抽出
     */
    async _getIdsByWeekday(company, dateObj) {
        try {
            const res = await fetch(`${company.staticPath}calendar.txt`);
            if (!res.ok) return { serviceIds: [], minStartDate: 0, maxEndDate: 0 };

            const text = await res.text();
            const lines = text.trim().split(/\r?\n/);
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));

            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const todayCol = dayNames[dateObj.getDay()];
            
            const sIdx = head.indexOf('service_id');
            const dIdx = head.indexOf(todayCol);
            const startIdx = head.indexOf('start_date');
            const endIdx = head.indexOf('end_date');
            
            const ids = [];
            let minStart = 99999999;
            let maxEnd = 0;

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (cols.length < head.length) continue;

                const start = parseInt(cols[startIdx]);
                const end = parseInt(cols[endIdx]);

                // 全データの中での最小開始日と最大終了日を記録
                if (start < minStart) minStart = start;
                if (end > maxEnd) maxEnd = end;

                // 今日の曜日に該当するかチェック
                if (cols[dIdx] === '1') {
                    ids.push(cols[sIdx]);
                }
            }
            return { serviceIds: ids, minStartDate: minStart, maxEndDate: maxEnd };
        } catch (e) {
            console.error("calendar.txt 読み込み失敗:", e);
            return { serviceIds: [], minStartDate: 0, maxEndDate: 0 };
        }
    },

    /**
     * 特殊日（祝日・代休など）の適用
     */
    async _applyExceptions(company, serviceIds, todayStr) {
        try {
            const res = await fetch(`${company.staticPath}calendar_dates.txt`);
            if (!res.ok) return serviceIds;

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
                    if (cols[eIdx] === '1') idSet.add(sid);    // 追加
                    else if (cols[eIdx] === '2') idSet.delete(sid); // 削除
                }
            }
            return Array.from(idSet);
        } catch (err) {
            return serviceIds;
        }
    },

    /**
     * 有効な service_id を持つ trip_id を抽出
     */
    async getValidTripIds(company, activeServiceIds) {
        try {
            const res = await fetch(`${company.staticPath}trips.txt`);
            const text = await res.text();
            const lines = text.trim().split(/\r?\n/);
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            
            const sIdx = head.indexOf('service_id');
            const tIdx = head.indexOf('trip_id');
            const rIdx = head.indexOf('route_id'); // 系統ID
            const hIdx = head.indexOf('trip_headsign'); // 行先

            const validTripsMap = new Map(); // Set から Map に変更
            const activeSet = new Set(activeServiceIds);

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (activeSet.has(cols[sIdx])) {
                    // trip_id をキーにして、系統と行先を保存
                    validTripsMap.set(cols[tIdx], {
                        routeId: cols[rIdx] || "",
                        headsign: cols[hIdx] || "運行便"
                    });
                }
            }
            return validTripsMap;
        } catch (e) {
            console.error("trips.txt 読み込み失敗:", e);
            return new Map();
        }
    }
};

console.log("✅ calendar.js (有効期限チェック機能付き) ロード完了");
