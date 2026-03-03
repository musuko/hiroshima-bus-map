window.loadCompanyGtfsData = async function(company) {
  if (company.isGtfsLoaded) return;

  console.log(`🚀 ${company.name} のGTFSデータをAPIから取得中...`);

  try {
    const res = await fetch(`https://hiroden-api.vercel.app/api/static?id=hiroden`);
    if (!res.ok) throw new Error("API error");

    const data = await res.json();

    // --- stops ---
    data.stops.forEach(row => {
      if (row.stop_id) {
        window.stopLookup[row.stop_id] = {
          name: row.stop_name || "名称不明"
        };
      }
    });

    // --- routes ---
    window.routeLookup[company.id] = {};
    data.routes.forEach(row => {
      if (row.route_id) {
        window.routeLookup[company.id][row.route_id] = {
          shortName: row.route_short_name || "",
          longName: row.route_long_name || ""
        };
      }
    });

    // --- trips ---
    data.trips.forEach(row => {
      if (row.trip_id && row.shape_id) {
        window.tripToShapeLookup[`${company.id}_${row.trip_id}`] = row.shape_id;
      }
    });

    company.isGtfsLoaded = true;

  } catch (e) {
    console.error("静的GTFS取得失敗:", e);
  }
};