export default {
  async fetch(request, env, ctx) {
    const notionToken = env.NOTION_API_KEY;
    const openaiKey = env.OPENAI_API_KEY;
    const notionDatabaseId = env.NOTION_DB_ID;

    const latestEntry = await fetchLatestEcho(notionToken, notionDatabaseId);
    const prompt = generatePrompt(latestEntry);

    const reflection = await getReflection(prompt, openaiKey);

    await writeReflectionToNotion(notionToken, latestEntry.id, reflection);

    return new Response("Reflection complete", { status: 200 });
  },
};

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
  const page = data.results[0];

  const content = page?.properties?.Notes?.rich_text?.[0]?.text?.content || "";
  const tags = page?.properties?.Tags?.multi_select?.map(t => t.name).join(", ") || "";

  return { id: page.id, content, tags };
}

function generatePrompt({ content, tags }) {
  return `You are a reflective AI companion designed to provide emotionally intelligent insights.
Here is the Echo journal entry:
"${content}"

The tags for this entry are: ${tags}

Return 2–3 insights or questions I may want to consider, and optionally suggest one or two new tags.`;
}

async function getReflection(prompt, apiKey) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a poetic and emotionally intelligent reflection companion.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function writeReflectionToNotion(token, pageId, reflection) {
  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        Reflection: {
          rich_text: [{ text: { content: reflection } }],
        },
      },
    }),
  });
}
