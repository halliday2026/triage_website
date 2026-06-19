"use client";

import { useState, FormEvent } from "react";

interface CaptureWidgetProps {
  ingestUrl: string;
  ingestKey: string;
  reporterEmail?: string;
  reporterUserId?: string;
  context?: Record<string, unknown>;
  onSuccess?: (ticket: { id: string }) => void;
  onError?: (error: string) => void;
}

type WidgetState = "closed" | "form" | "submitting" | "success" | "error";

export function CaptureWidget({
  ingestUrl,
  ingestKey,
  reporterEmail,
  reporterUserId,
  context,
  onSuccess,
  onError,
}: CaptureWidgetProps) {
  const [state, setState] = useState<WidgetState>("closed");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function resetForm() {
    setTitle("");
    setBody("");
    setErrorMessage("");
    setState("closed");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setState("submitting");

    const autoContext: Record<string, unknown> = {
      url: window.location.href,
      user_agent: navigator.userAgent,
      ...context,
    };

    try {
      const res = await fetch(ingestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingest_key: ingestKey,
          title: title.trim() || undefined,
          body: body.trim(),
          reporter_email: reporterEmail,
          reporter_user_id: reporterUserId,
          context: autoContext,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || `Request failed (${res.status})`;
        setErrorMessage(msg);
        setState("error");
        onError?.(msg);
        return;
      }

      const ticket = await res.json();
      setState("success");
      onSuccess?.(ticket);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorMessage(msg);
      setState("error");
      onError?.(msg);
    }
  }

  if (state === "closed") {
    return (
      <button
        onClick={() => setState("form")}
        className="fixed bottom-6 right-6 rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-blue-700"
      >
        Support
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 rounded-lg border border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <span className="text-sm font-semibold text-gray-900">
          {state === "success" ? "Submitted" : "Report an issue"}
        </span>
        <button
          onClick={resetForm}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {state === "success" ? (
        <div className="p-4 text-center">
          <p className="text-sm text-gray-700">
            Thanks! Your report has been submitted.
          </p>
          <button
            onClick={resetForm}
            className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Close
          </button>
        </div>
      ) : state === "error" ? (
        <div className="p-4 text-center">
          <p className="text-sm text-red-600">{errorMessage}</p>
          <button
            onClick={() => setState("form")}
            className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Try again
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-4">
          <input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={state === "submitting"}
            className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <textarea
            placeholder="Describe the issue..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={4}
            disabled={state === "submitting"}
            className="mb-3 w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={state === "submitting" || !body.trim()}
            className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {state === "submitting" ? "Sending..." : "Submit"}
          </button>
        </form>
      )}
    </div>
  );
}
