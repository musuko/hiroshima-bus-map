/**
 * js/timetable.js
 * 役割: バス停クリック時の統合時刻表表示（ローカルGTFSから読み込み）
 * ★修正: trip_headsign が空の場合、ループ/往復系統に対応
 *        - 対象バス停が前半（折り返し点前）なら折り返し点の直前のバス停を行先とする
 *        - 対象バス停が後半（折り返し点後）なら最終バス停を行先とする
 *        - 通常系統: 対象バス停より後の最終バス停を行先とする
 */

window.TimetableManager = {
    async showTimetable(stopId, companyIds) {
        const safeId = String(stopId).replace(/\s+/g, '_');
        const container = document.querySelector(`.timetable-content-${safeId}`);
        if (!container) return;

        container.innerHTML = "<div class='loading' style='font-size:12px; padding:10px;'>データを照合...</div>";

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
     * ★trip_headsign が空の場合、ループ/往復系統に対応した行先判定
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

            // tripId とに行をグループ化（sequence順にソート）
            const tripRowsMap = new Map();
            allRows.forEach(row => {
                if (!tripRowsMap.has(row.tripId)) {
                    tripRowsMap.set(row.tripId, []);
                }
                tripRowsMap.get(row.tripId).push(row);
            });

            tripRowsMap.forEach(rows => {
                rows.sort((a, b) => a.sequence - b.sequence);
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
                    const laterStops = tripRows.filter(r => r.sequence > row.sequence);

                    if (laterStops.length > 0) {
                        // trip内で stop_id が重複するかチェック（ループ/往復判定）
                        const stopIdOccurrences = new Map();
                        tripRows.forEach(r => {
                            stopIdOccurrences.set(r.stopId, (stopIdOccurrences.get(r.stopId) || 0) + 1);
                        });
                        const duplicateStopIds = Array.from(stopIdOccurrences.entries())
                            .filter(([id, count]) => count >= 2)
                            .map(([id]) => id);
                        const hasDuplicates = duplicateStopIds.length > 0;

                        if (hasDuplicates) {
                            // ★ループ/往復系統の行先判定
                            // 重複stop_idの2回目の出現位置（ループの折り返し後）を特定
                            const turnaroundInfo = this._findTurnaroundPoint(tripRows, duplicateStopIds);

                            if (turnaroundInfo) {
                                const turnaroundSeq = turnaroundInfo.secondOccurrenceSeq;

                                if (row.sequence < turnaroundSeq) {
                                    // ★対象バス停が前半（折り返し点前）
                                    // 折り返し点の直前のバス停を行先とする
                                    const turnaroundStop = turnaroundInfo.stopBeforeSecondOccurrence;
                                    const stopInfo = window.stopLookup[turnaroundStop.stopId];
                                    destination = stopInfo ? stopInfo.name : "終点不明";
                                } else {
                                    // ★対象バス停が後半（折り返し点後）
                                    // 最終バス停を行先とする
                                    const lastStop = laterStops[laterStops.length - 1];
                                    const stopInfo = window.stopLookup[lastStop.stopId];
                                    destination = stopInfo ? stopInfo.name : "終点不明";
                                }
                            } else {
                                const lastStop = laterStops[laterStops.length - 1];
                                const stopInfo = window.stopLookup[lastStop.stopId];
                                destination = stopInfo ? stopInfo.name : "終点不明";
                            }
                        } else {
                            // ★通常の片道系統: 最終バス停を行先とする
                            const lastStop = laterStops[laterStops.length - 1];
                            const stopInfo = window.stopLookup[lastStop.stopId];
                            destination = stopInfo ? stopInfo.name : "終点不明";
                        }
                    } else {
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

    /**
     * ループ/往復系統の折り返し点を特定
     * @param {Array} tripRows - sequence順にソートされたtripの行リスト
     * @param {Array} duplicateStopIds - 重複しているstop_idのリスト
     * @returns {Object|null} - 折り返し点情報（secondOccurrenceSeq, stopBeforeSecondOccurrence）
     */
    _findTurnaroundPoint(tripRows, duplicateStopIds) {
        if (!tripRows || tripRows.length === 0 || duplicateStopIds.length === 0) {
            return null;
        }

        // 重複stop_idのうち、最初に2回目が出現する位置を特定
        let earliestSecondOccurrence = -1;
        let targetStopId = null;

        for (const dupId of duplicateStopIds) {
            let firstFound = false;
            for (let i = 0; i < tripRows.length; i++) {
                if (tripRows[i].stopId === dupId) {
                    if (!firstFound) {
                        firstFound = true;
                    } else {
                        // 2回目の出現
                        if (earliestSecondOccurrence === -1 || i < earliestSecondOccurrence) {
                            earliestSecondOccurrence = i;
                            targetStopId = dupId;
                        }
                        break;
                    }
                }
            }
        }

        if (earliestSecondOccurrence <= 0) {
            return null;
        }

        // 2回目の出現の直前のバス停が折り返し点
        const stopBeforeSecondOccurrence = tripRows[earliestSecondOccurrence - 1];
        const secondOccurrenceSeq = tripRows[earliestSecondOccurrence].sequence;

        return {
            secondOccurrenceSeq: secondOccurrenceSeq,
            stopBeforeSecondOccurrence: stopBeforeSecondOccurrence,
            turnaroundStopId: targetStopId
        };
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
