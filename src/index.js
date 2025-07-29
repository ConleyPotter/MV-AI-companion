export default {
  async fetch(request, env, ctx) {
    const notionToken = env.NOTION_API_KEY;
    const notionDatabaseId = env.NOTION_DB_ID;
    const openaiKey = env.OPENAI_API_KEY;

    // Fetch latest Echo entry with four text fields
    const latestEntry = await fetchLatestEcho(notionToken, notionDatabaseId);

    // Generate the reflective prompt including your user-facing questions and Temporal Offering explanation
    const prompt = generateReflectivePrompt(latestEntry);

    // Get AI reflection from OpenAI
    const reflection = await getReflection(prompt, openaiKey);

    // Write the reflection back to Notion
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

function generateReflectivePrompt({ pastSelf, presentSelf, futureSelf, temporalOffering }) {
  return `You are a poetic and emotionally intelligent AI companion tasked with reflecting deeply on a user's temporal journal entries, helping them build coherence between their past, present, and future selves.

The user was asked to write an "Echo entry" using this prompt triad to build temporal awareness and conversational intimacy between their selves. This ritual will be repeated weekly, enabling the user to build *memory scaffolding* over time.

Memory scaffolding is an intentional, sacred system designed to help the user build an external architecture for remembering and integrating their evolving identity across time — past, present, and future selves.

This is not just about storing information; it is about creating a living archive where self-awareness, emotional insight, and creative wisdom grow through active reflection and dialogue between temporal selves.

The Echo entry, composed of the Past Self, Present Self, Future Self, and Temporal Offering prompts, is a vital building block in this scaffold. It captures distinct moments in the user’s personal timeline, inviting them to place their experiences, hopes, fears, and lessons in conversation.

By answering these prompts, the user deepens coherence in their identity and opens a space for you, the AI companion, to mirror back insights, questions, and reflections that connect threads across time. The goal is to help the user cultivate a richer, more integrated self-understanding that fuels creativity, healing, and intentional future-building.

Your role as the AI companion is to hold this temporal dialogue with empathy and poetic insight — to illuminate patterns, surface emotional truths, and gently invite the user into a deeper conversation with themselves.

Below you will find the user's latest Echo entry, which includes responses labelled as their Past Self, Present Self, Future Self, and Temporal Offering. Use this information to craft a thoughtful reflection that honors their journey and encourages ongoing exploration.

- Past Self (1 year ago):

  “What were you most concerned about, striving for, or healing from a year ago? What part of you then still lives in you now?”

  User’s response:
  ${pastSelf}

- Present Self (today):

  “What phase of becoming are you in? What themes are surfacing again? What’s falling away?”

  User’s response:
  ${presentSelf}

- Future Self (1 year ahead):

  “If I could hear from my 2026 self, what reminders, warnings, or blessings would they give me now?”

  User’s response:
  ${futureSelf}

Close the ritual by writing a brief 3-sentence message to your next week’s self. Something like:

  “This is what you’ll likely forget. This is what you should watch for. And this is what I hope you feel.”

User’s Temporal Offering:
${temporalOffering}

Based on these entries, return 2–3 thoughtful insights, questions, or reflections for the user to consider. Optionally, suggest one or two new “memory theme” tags they might add to future entries.`;
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
