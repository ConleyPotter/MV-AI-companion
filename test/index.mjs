import fetch from "node-fetch"; // If you're using Node 18+, this may be built-in
import dotenv from "dotenv";
dotenv.config();

const notionToken = process.env.NOTION_API_KEY;
const notionDbId = process.env.NOTION_DB_ID;

function extractTextField(page, fieldName) {
  const field = page.properties[fieldName];
  if (
    field &&
    field.type === "rich_text" &&
    Array.isArray(field.rich_text) &&
    field.rich_text.length > 0 &&
    field.rich_text[0].text &&
    field.rich_text[0].text.content
  ) {
    return field.rich_text[0].text.content;
  }
  return "";
}

async function fetchLatestEcho(notionToken, dbId) {
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sorts: [{ property: "Date", direction: "descending" }],
      page_size: 1,
    }),
  });

  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error("No echoes found");
  }

  const page = data.results[0];

  return {
    id: page.id,
    pastSelf: extractTextField(page, "Past Self"),
    presentSelf: extractTextField(page, "Present Self"),
    futureSelf: extractTextField(page, "Future Self"),
    temporalOffering: extractTextField(page, "Temporal Offering"),
  };
}

(async () => {
  try {
    const entry = await fetchLatestEcho(notionToken, notionDbId);
    console.log("✅ Entry fetched:");
    console.log(entry);

    const prompt = `
You are a poetic and emotionally intelligent AI companion tasked with reflecting deeply on a user's temporal journal entries...

- Past Self: ${entry.pastSelf}
- Present Self: ${entry.presentSelf}
- Future Self: ${entry.futureSelf}
- Temporal Offering: ${entry.temporalOffering}
`;

    console.log("📜 Prompt to send to OpenAI:");
    console.log(prompt);
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
