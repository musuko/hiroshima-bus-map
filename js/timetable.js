// /**
//  * js/timetable.js
//  * 役割: 統合時刻表の表示とデータフローの追跡
//  */

window.TimetableManager = {
  async showTimetable(stopId, companyIds) {
    const safeId = String(stopId).replace(/\s+/g, "_");
    // const container = document.querySelector(`.timetable-content-${safeId}`);

    // if (!container) return;

    safeId.innerHTML =
      "<div class='loading' style='font-size:12px; padding:10px;'>データを照合中...</div>";
    // container.innerHTML = "<div class='loading' style='font-size:12px; padding:10px;'>データを照合中...</div>";

    let combinedTimes = [];

    for (const companyId of companyIds) {
      const company = window.BUS_COMPANIES.find((c) => c.id === companyId);
      if (!company) continue;

      try {
        // 【追跡ログ1】カレンダー判定
        const activeServiceIds =
          await window.CalendarManager.getActiveServiceIds(company);
        console.log(
          `🔍 ${company.name}: 有効なServiceId数 = ${activeServiceIds.length}`,
        );
        if (activeServiceIds.length === 0) continue;

        // 【追跡ログ2】Trip情報取得
        const tripInfoMap = await window.CalendarManager.getValidTripIds(
          company,
          activeServiceIds,
        );
        console.log(
          `🔍 ${company.name}: 今日の運行Trip数 = ${tripInfoMap.size}`,
        );
        if (tripInfoMap.size === 0) continue;

        // 【追跡ログ3】API通信
        const times = await this._getStopTimes(company, stopId, tripInfoMap);
        console.log(
          `🔍 ${company.name}: APIから届いた該当時刻 = ${times.length}件`,
        );

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

  async _getStopTimes(company, stopId, tripInfoMap) {
    const safeStopId = encodeURIComponent(stopId);
    const apiUrl = `${company.realtimeUrl}&stop_id=${safeStopId}`;
    // const apiUrl = `${window.API_BASE_URL}/api/get-all-timetable?company_id=${company.id}&stop_id=${safeStopId}`;
    // const apiUrl = `${window.API_BASE_URL}/api/get-stop-timetable?company_id=${company.id}&stop_id=${safeStopId}`;

    try {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`APIエラー: ${res.status}`);

      const data = await res.json();
      console.log("data", data);
      // 【重要：Vercelから何が届いているか生データを確認】
      console.log(`📡 API生データ (${company.id}):`, data.entity.slice(0, 2));

      const results = [];
      data.forEach((item) => {
        // Vercelから届くIDが tripId なのか tId なのかをここで吸収
        const tid = item.tripId || item.tId;
        console.log(tid);
        if (tripInfoMap.has(tid)) {
          const info = tripInfoMap.get(tid);
          const routeData = (window.routeLookup[company.id] || {})[
            info.routeId
          ] || { shortName: "", longName: "" };
          const destInfo = window.globalStopMap.get(item.destId);

          results.push({
            time: item.time.substring(0, 5),
            routeShort: routeData.shortName,
            destination: destInfo ? destInfo.name : "終点不明",
            companyId: company.id,
            companyName: company.name,
          });
        }
      });
      return results;
    } catch (err) {
      console.error("API fetch error:", err);
      return [];
    }
  },

  _renderCombinedTimetable(safeId, times) {
    // const container = document.querySelector(`.timetable-content-${safeId}`);
    // if (!container) return;

    if (times.length === 0) {
      safeId.innerHTML =
        "<p style='padding:10px; font-size:12px; color:#666;'>本日の運行予定はありません。<br><small>(データ照合結果 0件)</small></p>";
      // container.innerHTML = "<p style='padding:10px; font-size:12px; color:#666;'>本日の運行予定はありません。<br><small>(データ照合結果 0件)</small></p>";
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

    times.forEach((t) => {
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
    safeId.innerHTML = html;
    // container.innerHTML = html;
  },
};

// バス停クリック用エントリーポイント
window.showTimetableForStop = function (stopId) {
  const stopData = window.stopLookup[stopId];
  if (!stopData) {
    console.warn("stopDataが見つかりません:", stopId);
    return;
  }

  const companyIds = stopData.companies || [];

  if (companyIds.length === 0) {
    console.warn("会社情報なし:", stopId);
    return;
  }

  window.TimetableManager.showTimetable(stopId, companyIds);
};
