import Papa from 'papaparse';

async function run() {
  const SPREADSHEET_ID = "1lMwrFdf-VKmmWWZ_UU_XGkvhUWvH-t16ZL4lSjDbPRU";
  const sheetName = "ANOMALI";
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  try {
    const res = await fetch(url);
    const text = await res.text();
    const rows = Papa.parse(text, { header: false }).data as string[][];

    console.log("Analyzing columns for URLs in the ANOMALI sheet...");
    let foundUrlCount = 0;
    
    rows.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        const val = String(cell || "").trim();
        if (val.startsWith("http://") || val.startsWith("https://")) {
          foundUrlCount++;
          if (foundUrlCount <= 10) {
            console.log(`Row ${rIdx}, Col ${cIdx} has URL: "${val}"`);
          }
        }
      });
    });

    console.log(`Total URLs found in sheet:`, foundUrlCount);
  } catch (err) {
    console.error(err);
  }
}

run();
