(function () {
  function extractOrderIdsFromHAR(harEntries) {
    const orderIds = new Set();

    for (let i = harEntries.length - 1; i >= 0; i--) {
      const entry = harEntries[i];
      const { method, url, postData } = entry.request || {};
      const responseText = entry.response?.content?.text || "";

      if (method !== "POST" || !url.includes("/jde/E1VirtualClient.mafService")) {
        console.log(`🔸 Skipping non-relevant request at index ${i}`);
        continue;
      }

      const postBody = parsePostData(postData?.text || "");

      if (postBody["0_cmd"]?.startsWith("gh")) {
        const cmd = postBody["0_cmd"];
        const parts = cmd.split(".");
        const gridId = parts[0].slice(2);
        const rowIndex = parseInt(parts[1], 10);

        let found = false;
        for (let j = i - 1; j >= 0; j--) {
          const prevEntry = harEntries[j];
          const prevText = prevEntry.response?.content?.text || "";
          if (
            prevEntry.request?.method === "POST" &&
            prevEntry.request?.url.includes("/jde/E1VirtualClient.mafService") &&
            new Date(prevEntry.startedDateTime) < new Date(entry.startedDateTime) &&
            prevText.includes(`ID:"${gridId}"`)
          ) {
            const rows = parseRows(prevText);
            for (const row of rows) {
              if (row.includes(`ROW:${rowIndex}`)) {
                const val = extractVal(row);
                const fields = val.split("\t");
                if (fields.length > 2) {
                  orderIds.add(fields[2]);
                  console.log(`🟢 Selected Order ID (row ${rowIndex}): ${fields[2]}`);
                  found = true;
                }
              }
            }
            break;
          }
        }

        if (!found) {
          console.warn(`⚠️ Could not find search response for selected row ${rowIndex} at index ${i}`);
        }
      } else if (responseText.includes("EVT:203")) {
        const rows = parseRows(responseText);
        let count = 0;
        for (const row of rows) {
          if (row.includes("EVT:203")) {
            const val = extractVal(row);
            const fields = val.split("\t");
            if (fields.length > 2) {
              orderIds.add(fields[2]);
              console.log(`🔍 Found Order ID in search: ${fields[2]}`);
              count++;
            }
          }
        }
        if (count === 0) {
          console.warn(`⚠️ No order rows found in search response at index ${i}`);
        }
      } else {
        console.warn(`⚠️ Skipping response at index ${i}: does not contain EVT:203`);
      }
    }

    return Array.from(orderIds);
  }

  function parsePostData(text) {
    const params = new URLSearchParams(text);
    const result = {};
    for (const [key, value] of params.entries()) {
      result[key] = value;
    }
    return result;
  }

  function parseRows(responseText) {
    return responseText.split("},{");
  }

  function extractVal(row) {
    const start = row.indexOf('VAL:\\"') + 6;
    const end = row.indexOf('\\",EVT:');
    if (start >= 6 && end > start) {
      return row.substring(start, end);
    }
    return "";
  }

  function waitForHARAndProcess() {
    const interval = setInterval(() => {
      if (window.HAR_ENTRIES?.length) {
        clearInterval(interval);
        console.log("🔄 Processing HAR entries...");
        const orderIds = extractOrderIdsFromHAR(window.HAR_ENTRIES);
        console.log("✅ Final Order IDs:", orderIds);
      }
    }, 1000);
  }

  waitForHARAndProcess();
})();
