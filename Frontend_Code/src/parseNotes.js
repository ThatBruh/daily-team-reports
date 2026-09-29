import { supabase } from './supabaseClient'

export async function parseNotes(notes) {
  const { data, error } = await supabase.functions.invoke("parse-notes", {
    body: { notes },
  })

  if (error) {
    let details = null

    if (error.context instanceof Response) {
      const body = await error.context.clone().text()

      try {
        details = JSON.parse(body)
      } catch {
        details = body
      }
    }

    console.error("Parsing error details:", details ?? error)

    const message =
      details?.error?.error?.message ??
      details?.error?.message ??
      details?.message ??
      (typeof details?.error === "string" ? details.error : null) ??
      (typeof details === "string" ? details : null) ??
      error.message

    throw new Error(message)
  }

  return data
}