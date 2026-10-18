/**
 * js/timetable.js
 * 役割: バス停クリック時の統合時刻表表示（ローカルGTFSから読み込み）
 * ★外部APIは使用せず、stop_times.txt を直接読み込む
 */

window.TimetableManager = {
    async showTimetable(stopId, companyIds) {
        const safeId = String(stopId).replace(/\s+/g, '_');
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (!container) return;

        container.innerHTML = "<div class='loading' style='font-size:12px; padding:10px;'>データを照合中...</div>";

        let combinedTimes = [];

        for (const companyId of companyIds) {
            const company = window.BUS_COMPANIES.find(c => c.id === companyId);
            if (!company) continue;

            try {
                // 【追跡ログ1】カレンダー判定
                const activeServiceIds = await window.CalendarManager.getActiveServiceIds(company);
                console.log(`🔍 ${company.name}: 有効なServiceId数 = ${activeServiceIds.length}`);
                if (activeServiceIds.length === 0) continue;

                // 【追跡ログ2】Trip情報取得
                const tripInfoMap = await window.CalendarManager.getValidTripIds(company, activeServiceIds);
                console.log(`🔍 ${company.name}: 今日の運行Trip数 = ${tripInfoMap.size}`);
                if (tripInfoMap.size === 0) continue;

                // 【追跡ログ3】★ローカル stop_times.txt から時刻を読み込み
                const times = await this._getStopTimes(company, stopId, tripInfoMap);
                console.log(`🔍 ${company.name}: ローカルstop_times該当 = ${times.length}件`);

                combinedTimes = combinedTimes.concat(times);
            } catch (e) { 
                console.error(`${companyId} 取得失敗:`, e); 
            }
        }

        // 全体ソート
        combinedTimes.sort((a, b) => a.time.localeCompare(b.time));
        console.log(`🏁 最終的な表示件数: ${combinedTimes.length}件`);

        this._renderCombinedTimetable(safeId, combinedTimes);
    },

    /**
     * ★ローカルの stop_times.txt を直接読み込んで時刻を抽出
     */
    async _getStopTimes(company, stopId, tripInfoMap) {
        const results = [];
        const safeStopId = String(stopId).trim();

        try {
            // まず通常の stop_times.txt を読み込む
            let res = await fetch(`${company.staticPath}stop_times.txt`);
            let files = [];

            if (res.ok) {
                files = [await res.text()];
            } else {
                // 分割ファイルを順番に読み込む
                let fileIndex = 1;
                while (true) {
                    const splitRes = await fetch(`${company.staticPath}stop_times_${fileIndex}.txt`);
                    if (!splitRes.ok) break;
                    files.push(await splitRes.text());
                    fileIndex++;
                }
            }

            if (files.length === 0) {
                console.warn(`${company.name}: stop_times.txt が見つかりません (${company.staticPath})`);
                return results;
            }

            let tIdx = -1, sIdx = -1, aIdx = -1, dIdx = -1;

            for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
                const text = files[fileIndex];
                const lines = text.trim().split(/\r?\n/);

                if (lines.length === 0) continue;

                // ヘッダー行の解析
                const firstLine = lines[0].toLowerCase();
                const hasHeader = (fileIndex === 0) || firstLine.includes('trip_id');

                if (hasHeader) {
                    const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                    tIdx = head.indexOf('trip_id');
                    sIdx = head.indexOf('stop_id');
                    aIdx = head.indexOf('arrival_time');
                    dIdx = head.indexOf('departure_time');
                }

                if (tIdx === -1 || sIdx === -1) {
                    console.warn(`${company.name}: ヘッダー解析失敗 (trip_id=${tIdx}, stop_id=${sIdx})`);
                    continue;
                }

                const timeIdx = aIdx >= 0 ? aIdx : dIdx;
                const startIndex = hasHeader ? 1 : 0;

                for (let i = startIndex; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.includes(safeStopId)) continue;

                    const cols = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                    if (cols.length <= Math.max(tIdx, sIdx, timeIdx)) continue;
                    if (cols[sIdx] !== safeStopId) continue;

                    const tripId = cols[tIdx];
                    if (!tripInfoMap.has(tripId)) continue;

                    const info = tripInfoMap.get(tripId);
                    const routeData = (window.routeLookup[company.id] || {})[info.routeId] || { shortName: "", longName: "" };
                    const destination = info.tripHeadsign || "終点不明";

                    results.push({
                        time: (cols[timeIdx] || "00:00:00").substring(0, 5),
                        routeShort: routeData.shortName,
                        destination: destination,
                        companyId: company.id,
                        companyName: company.name
                    });
                }
            }

            return results;
        } catch (err) {
            console.error(`${company.name} stop_times読込エラー:`, err);
            return [];
        }
    },

    _renderCombinedTimetable(safeId, times) {
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (!container) return;

        if (times.length === 0) {
            container.innerHTML = "<p style='padding:10px; font-size:12px; color:#666;'>本日の運行予定はありません。<br><small>(データ照合結果 0件)</small></p>";
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
