/**
 * js/timetable.js
 * 役割: バス停クリック時の統合時刻表表示（ローカルGTFSから読み込み）
 * ★修正: trip_headsign が空の場合、対象バス停から見た「先の終点」を行先とする
 *        ループ/往復系統にも対応（対象バス停より後の最終バス停を特定）
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
                const activeServiceIds = await window.CalendarManager.getActiveServiceIds(company);
                console.log(`🔍 ${company.name}: 有効なServiceId数 = ${activeServiceIds.length}`);
                if (activeServiceIds.length === 0) continue;

                const tripInfoMap = await window.CalendarManager.getValidTripIds(company, activeServiceIds);
                console.log(`🔍 ${company.name}: 今日の運行Trip数 = ${tripInfoMap.size}`);
                if (tripInfoMap.size === 0) continue;

                const times = await this._getStopTimes(company, stopId, tripInfoMap);
                console.log(`🔍 ${company.name}: ローカルstop_times該当 = ${times.length}件`);

                combinedTimes = combinedTimes.concat(times);
            } catch (e) { 
                console.error(`${companyId} 取得失敗:`, e); 
            }
        }

        combinedTimes.sort((a, b) => a.time.localeCompare(b.time));
        console.log(`🏁 最終的な表示件数: ${combinedTimes.length}件`);

        this._renderCombinedTimetable(safeId, combinedTimes);
    },

    /**
     * ローカルの stop_times.txt を読み込んで時刻を抽出
     * ★trip_headsign が空の場合、対象バス停から見た「先の終点」を行先とする
     */
    async _getStopTimes(company, stopId, tripInfoMap) {
        const results = [];
        const safeStopId = String(stopId).trim();

        try {
            let res = await fetch(`${company.staticPath}stop_times.txt`);
            let files = [];

            if (res.ok) {
                files = [await res.text()];
            } else {
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

            // 全行をパースして配列に格納
            const allRows = [];
            let tIdx = -1, sIdx = -1, aIdx = -1, dIdx = -1, sqIdx = -1;

            for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
                const text = files[fileIndex];
                const lines = text.trim().split(/\r?\n/);

                if (lines.length === 0) continue;

                const firstLine = lines[0].toLowerCase();
                const hasHeader = (fileIndex === 0) || firstLine.includes('trip_id');

                if (hasHeader) {
                    const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                    tIdx = head.indexOf('trip_id');
                    sIdx = head.indexOf('stop_id');
                    aIdx = head.indexOf('arrival_time');
                    dIdx = head.indexOf('departure_time');
                    sqIdx = head.indexOf('stop_sequence');
                }

                if (tIdx === -1 || sIdx === -1) {
                    console.warn(`${company.name}: ヘッダー解析失敗`);
                    continue;
                }

                const timeIdx = aIdx >= 0 ? aIdx : dIdx;
                const startIndex = hasHeader ? 1 : 0;

                for (let i = startIndex; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.trim()) continue;

                    const cols = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                    if (cols.length <= Math.max(tIdx, sIdx)) continue;

                    const tripId = cols[tIdx];
                    const stopIdVal = cols[sIdx];
                    const sequence = sqIdx >= 0 ? parseInt(cols[sqIdx]) || 0 : 0;
                    const time = timeIdx >= 0 ? (cols[timeIdx] || "00:00:00").substring(0, 5) : "--:--";

                    allRows.push({ tripId, stopId: stopIdVal, sequence, time });
                }
            }

            // tripId ごとに行をグループ化（高速化のため）
            const tripRowsMap = new Map();
            allRows.forEach(row => {
                if (!tripRowsMap.has(row.tripId)) {
                    tripRowsMap.set(row.tripId, []);
                }
                tripRowsMap.get(row.tripId).push(row);
            });

            // 対象バス停の時刻を抽出
            allRows.forEach(row => {
                if (row.stopId !== safeStopId) return;
                if (!tripInfoMap.has(row.tripId)) return;

                const info = tripInfoMap.get(row.tripId);
                const routeData = (window.routeLookup[company.id] || {})[info.routeId] || { shortName: "", longName: "" };

                // 行先の決定
                let destination = info.tripHeadsign;
                if (!destination) {
                    const tripRows = tripRowsMap.get(row.tripId) || [];
                    // 対象バス停より後のバス停（sequenceが大きい）を取得
                    const laterStops = tripRows.filter(r => r.sequence > row.sequence);

                    if (laterStops.length > 0) {
                        // sequenceでソートして最後のバス停が「先の終点」
                        laterStops.sort((a, b) => a.sequence - b.sequence);
                        const lastStop = laterStops[laterStops.length - 1];
                        const stopInfo = window.stopLookup[lastStop.stopId];
                        destination = stopInfo ? stopInfo.name : "終点不明";
                    } else {
                        // 対象バス停が最終バス停の場合
                        destination = "終点";
                    }
                }

                results.push({
                    time: row.time,
                    routeShort: routeData.shortName,
                    destination: destination,
                    companyId: company.id,
                    companyName: company.name
                });
            });

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
