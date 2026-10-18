/**
 * js/timetable.js
 * 役割: バス停クリック時の統合時刻表表示（ローカルGTFSから読み込み）
 * ★修正: 
 *   - 行先は常に「対象バス停より後の最終バス停」とする（ループ判定を廃止）
 *   - 時刻表の各行をクリックすると、そのtripの全バス停時刻表を表示する
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
                if (activeServiceIds.length === 0) continue;

                const tripInfoMap = await window.CalendarManager.getValidTripIds(company, activeServiceIds);
                if (tripInfoMap.size === 0) continue;

                const times = await this._getStopTimes(company, stopId, tripInfoMap);
                combinedTimes = combinedTimes.concat(times);
            } catch (e) { 
                console.error(`${companyId} 取得失敗:`, e); 
            }
        }

        combinedTimes.sort((a, b) => a.time.localeCompare(b.time));

        this._renderCombinedTimetable(safeId, combinedTimes);
    },

    /**
     * ローカルの stop_times.txt を読み込んで時刻を抽出
     * ★行先は常に「対象バス停より後の最終バス停」とする
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
                return results;
            }

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

                if (tIdx === -1 || sIdx === -1) continue;

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

            // tripId ごとに行をグループ化（sequence順にソート）
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

                // ★行先は常に「対象バス停より後の最終バス停」とする
                let destination = info.tripHeadsign;
                if (!destination || destination.trim() === '') {
                    const tripRows = tripRowsMap.get(row.tripId) || [];
                    const laterStops = tripRows.filter(r => r.sequence > row.sequence);

                    if (laterStops.length > 0) {
                        const lastStop = laterStops[laterStops.length - 1];
                        const stopInfo = window.stopLookup[lastStop.stopId];
                        destination = stopInfo ? stopInfo.name : "終点不明";
                    } else {
                        destination = "終点";
                    }
                }

                results.push({
                    time: row.time,
                    routeShort: routeData.shortName,
                    destination: destination,
                    companyId: company.id,
                    companyName: company.name,
                    tripId: row.tripId  // ★追加: tripの時刻表表示用
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

        times.forEach((t, index) => {
            const config = window.APP_CONFIG.COMPANIES[t.companyId];
            const dotHtml = `<span style="display:inline-block; width:7px; height:7px; background:${config.color}; border-radius:50%; margin-right:3px; border:1px solid #999;"></span>`;

            // ★行に data-trip-id と data-company-id を付与し、クリック可能にする
            html += `<tr class="timetable-row" 
                          data-trip-id="${t.tripId}" 
                          data-company-id="${t.companyId}"
                          style="border-bottom:1px solid #eee; cursor:pointer;"
                          onmouseover="this.style.background='#f0f8ff'"
                          onmouseout="this.style.background=''">`;
            html += `
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

        // ★各行にクリックイベントを登録
        container.querySelectorAll('.timetable-row').forEach(row => {
            row.addEventListener('click', async () => {
                const tripId = row.getAttribute('data-trip-id');
                const companyId = row.getAttribute('data-company-id');
                if (tripId && companyId && window.getFullTimetableForTrip) {
                    console.log(`🚌 trip時刻表表示: tripId=${tripId}, companyId=${companyId}`);
                    const tripStops = await window.getFullTimetableForTrip(tripId, companyId);
                    this._showTripDetailModal(tripId, companyId, tripStops);
                }
            });
        });
    },

    /**
     * ★追加: tripの全バス停時刻表をモーダル表示
     */
    _showTripDetailModal(tripId, companyId, tripStops) {
        const company = window.BUS_COMPANIES.find(c => c.id === companyId);
        const companyName = company ? company.name : companyId;

        // 既存のモーダルがあれば削除
        const existingModal = document.getElementById('trip-detail-modal');
        if (existingModal) existingModal.remove();

        // モーダル要素作成
        const modal = document.createElement('div');
        modal.id = 'trip-detail-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
        `;

        let stopsHtml = '';
        if (tripStops && tripStops.length > 0) {
            stopsHtml = `<table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead style="background:#f5f5f5;">
                    <tr style="border-bottom:2px solid #ccc;">
                        <th style="padding:8px 6px; text-align:left;">時刻</th>
                        <th style="padding:8px 6px; text-align:left;">バス停</th>
                        <th style="padding:8px 6px; text-align:left;">順番</th>
                    </tr>
                </thead><tbody>`;
            tripStops.forEach((stop, idx) => {
                const bgStyle = idx % 2 === 0 ? 'background:#fff;' : 'background:#fafafa;';
                stopsHtml += `<tr style="border-bottom:1px solid #eee; ${bgStyle}">
                    <td style="padding:8px 6px; font-weight:bold;">${stop.time}</td>
                    <td style="padding:8px 6px;">${stop.stopName}</td>
                    <td style="padding:8px 6px; color:#666; font-size:11px;">${stop.sequence}</td>
                </tr>`;
            });
            stopsHtml += `</tbody></table>`;
        } else {
            stopsHtml = `<p style="padding:20px; color:#666;">時刻表情報を取得できませんでした。</p>`;
        }

        modal.innerHTML = `
            <div style="
                background: white; border-radius: 8px; max-width: 400px; width: 90%;
                max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
                <div style="padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:bold; font-size:16px;">${companyName}</div>
                        <div style="font-size:12px; color:#666;">trip: ${tripId.substring(0, 20)}...</div>
                    </div>
                    <button id="trip-modal-close" style="
                        background:none; border:none; font-size:24px; cursor:pointer; color:#999;
                    ">&times;</button>
                </div>
                <div style="padding:10px;">
                    ${stopsHtml}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 閉じるボタンのイベント
        document.getElementById('trip-modal-close').addEventListener('click', () => {
            modal.remove();
        });

        // 背景クックでも閉じる
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
};
