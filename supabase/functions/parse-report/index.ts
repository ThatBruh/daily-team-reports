import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")
const MODEL = "gemini-3.1-flash-lite"

const SYSTEM_PROMPT = `You extract structured standup data from a team's daily report.
The report lists team members and, for each, what they completed and what is pending or planned for the day, along with any issues/blockers and collaboration.
Rules:
- Return one entry per person per date. Combine repeated mentions of the same person and date into a single entry.
- "completed" holds finished work (done, finished, completed, yesterday).
- "today" holds pending, planned or in-progress work (today, pending, in progress, to do).
- Use the person's name exactly as written in the report.
- Rewrite each field as a clean, short professional phrase (one sentence). Do not invent details that are not in the report.
- If a field is not mentioned, use "N/A".
- "issue_blocker" is only for genuine problems or blockers.
- "collaboration" is only for working with or supporting other people.
- "date" is the date the entry refers to, as YYYY-MM-DD. If a date has no year, use the year from the current date given. If the report gives no date for that entry, use an empty string.`

const SECTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    activity: { type: "STRING" },
    progress: { type: "STRING" },
    issue_blocker: { type: "STRING" },
    collaboration: { type: "STRING" },
  },
  required: ["activity", "progress", "issue_blocker", "collaboration"],
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    entries: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          member: { type: "STRING" },
          date: { type: "STRING" },
          completed: SECTION_SCHEMA,
          today: SECTION_SCHEMA,
        },
        required: ["member", "date", "completed", "today"],
      },
    },
  },
  required: ["entries"],
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { text, pdf, today } = await req.json()
    if (!text && !pdf) return json({ error: "Send either 'text' or 'pdf'" }, 400)

    const currentDate = today || new Date().toISOString().slice(0, 10)
    const instruction = `Current date: ${currentDate}. Extract the standup entries from this report.`

    const parts = pdf
      ? [{ inline_data: { mime_type: "application/pdf", data: pdf } }, { text: instruction }]
      : [{ text: `${instruction}\n\n${String(text).slice(0, 60000)}` }]

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      }
    )

    const data = await response.json()
    if (!response.ok) return json({ error: data }, response.status)

    const output = data.candidates?.[0]?.content?.parts?.[0]?.text
    return json(JSON.parse(output))
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})