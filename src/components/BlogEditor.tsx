import { createSignal, onCleanup, Show } from "solid-js"
import { Editor } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import BubbleMenu from "@tiptap/extension-bubble-menu"
import { Markdown } from "tiptap-markdown"

const API = "https://bbscience.duckdns.org/api/blog-edit"
const TOKEN_KEY = "blog-editor-token"

type Mode = "idle" | "auth" | "loading" | "editing" | "saving"

function splitFrontmatter(md: string): { fm: string; body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { fm: "", body: md }
  return { fm: m[1], body: m[2] }
}

function joinFrontmatter(fm: string, body: string): string {
  if (!fm) return body
  return `---\n${fm}\n---\n\n${body.replace(/^\n+/, "")}`
}

type Meta = { title: string; summary: string; date: string; draft: boolean; tags: string[] }

function unquote(s: string): string {
  s = s.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).replace(/\\"/g, '"')
  }
  return s
}

function quote(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`
}

function parseMeta(fm: string): Meta {
  const meta: Meta = { title: "", summary: "", date: "", draft: false, tags: [] }
  const lines = fm.split("\n")
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const m = line.match(/^([A-Za-z_]+):\s*(.*)$/)
    if (!m) { i++; continue }
    const [, key, rawVal] = m
    if (key === "tags") {
      const tags: string[] = []
      i++
      while (i < lines.length && lines[i].match(/^\s*-\s+/)) {
        tags.push(unquote(lines[i].replace(/^\s*-\s+/, "")))
        i++
      }
      meta.tags = tags
      continue
    }
    if (key === "title") meta.title = unquote(rawVal)
    else if (key === "summary") meta.summary = unquote(rawVal)
    else if (key === "date") meta.date = unquote(rawVal)
    else if (key === "draft") meta.draft = rawVal.trim() === "true"
    i++
  }
  return meta
}

function serializeMeta(meta: Meta): string {
  const lines = [
    `title: ${quote(meta.title)}`,
    `summary: ${quote(meta.summary)}`,
    `date: ${quote(meta.date)}`,
    `draft: ${meta.draft ? "true" : "false"}`,
    `tags:`,
    ...meta.tags.map((t) => `- ${t}`),
  ]
  return lines.join("\n")
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers = new Headers(init.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json")
  return fetch(`${API}${path}`, { ...init, headers })
}

type RewriteState = {
  visible: boolean
  loading: boolean
  from: number
  to: number
  original: string
  rewritten: string
  error: string
}

export default function BlogEditor(props: { slug: string; collection: string }) {
  const [mode, setMode] = createSignal<Mode>("idle")
  const [pw, setPw] = createSignal("")
  const [err, setErr] = createSignal("")
  const [meta, setMeta] = createSignal<Meta>({ title: "", summary: "", date: "", draft: false, tags: [] })
  const [tagsInput, setTagsInput] = createSignal("")
  const [rewrite, setRewrite] = createSignal<RewriteState>({
    visible: false, loading: false, from: 0, to: 0, original: "", rewritten: "", error: "",
  })
  let editor: Editor | null = null
  let editorEl: HTMLDivElement | undefined
  let bubbleEl: HTMLDivElement | undefined

  const articleEl = () =>
    document.querySelector<HTMLElement>("article")

  async function startEdit() {
    setErr("")
    if (localStorage.getItem(TOKEN_KEY)) {
      await loadAndOpen()
    } else {
      setMode("auth")
    }
  }

  async function submitPassword(e: Event) {
    e.preventDefault()
    setErr("")
    const r = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw() }),
    })
    if (!r.ok) {
      setErr("비번 틀림")
      return
    }
    const { token } = await r.json()
    localStorage.setItem(TOKEN_KEY, token)
    setPw("")
    await loadAndOpen()
  }

  async function loadAndOpen() {
    setMode("loading")
    const r = await api(`/post/${props.collection}/${props.slug}`)
    if (r.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      setMode("auth")
      setErr("세션 만료")
      return
    }
    if (!r.ok) {
      setMode("idle")
      setErr("로드 실패")
      return
    }
    const { content } = await r.json()
    const { fm, body } = splitFrontmatter(content)
    const m = parseMeta(fm)
    setMeta(m)
    setTagsInput(m.tags.join(", "))
    setMode("editing")
    queueMicrotask(() => mountEditor(body))
  }

  function mountEditor(body: string) {
    const art = articleEl()
    if (art) art.style.display = "none"
    if (!editorEl) return
    editor = new Editor({
      element: editorEl,
      extensions: [
        StarterKit,
        Image.configure({ inline: false }),
        Link.configure({ openOnClick: false }),
        Markdown.configure({ html: false, breaks: false, transformPastedText: true }),
        ...(bubbleEl ? [BubbleMenu.configure({ element: bubbleEl, options: { placement: "top" } })] : []),
      ],
      content: body,
      autofocus: "end",
    })
    ;(editor.storage as any).markdown.set(body)
  }

  async function save() {
    if (!editor) return
    setMode("saving")
    const md = (editor.storage as any).markdown.getMarkdown() as string
    const updated: Meta = {
      ...meta(),
      tags: tagsInput().split(",").map((t) => t.trim()).filter(Boolean),
    }
    const full = joinFrontmatter(serializeMeta(updated), md)
    const r = await api(`/post/${props.collection}/${props.slug}`, {
      method: "PUT",
      body: JSON.stringify({ content: full }),
    })
    if (r.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      setMode("auth")
      setErr("세션 만료, 다시 로그인")
      return
    }
    if (!r.ok) {
      setMode("editing")
      setErr("저장 실패")
      return
    }
    setErr("")
    setMode("idle")
    cleanup()
    alert("저장됨. 1~2분 뒤 사이트 반영됩니다.")
  }

  async function uploadImage(file: File): Promise<string | null> {
    const fd = new FormData()
    fd.append("file", file)
    const r = await api(`/post/${props.collection}/${props.slug}/image`, { method: "POST", body: fd })
    if (!r.ok) return null
    const { filename } = await r.json()
    return `./${filename}`
  }

  function onPaste(e: ClipboardEvent) {
    if (!editor || !e.clipboardData) return
    const file = Array.from(e.clipboardData.files)[0]
    if (!file || !file.type.startsWith("image/")) return
    e.preventDefault()
    uploadImage(file).then((src) => {
      if (src && editor) editor.chain().focus().setImage({ src }).run()
    })
  }

  function onDrop(e: DragEvent) {
    if (!editor || !e.dataTransfer) return
    const file = Array.from(e.dataTransfer.files)[0]
    if (!file || !file.type.startsWith("image/")) return
    e.preventDefault()
    uploadImage(file).then((src) => {
      if (src && editor) editor.chain().focus().setImage({ src }).run()
    })
  }

  async function requestRewrite() {
    if (!editor) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, "\n", "\n").trim()
    if (!text) return
    const fullMd = (editor.storage as any).markdown.getMarkdown() as string
    setRewrite({ visible: true, loading: true, from, to, original: text, rewritten: "", error: "" })
    try {
      const r = await api(`/rewrite`, {
        method: "POST",
        body: JSON.stringify({
          collection: props.collection,
          slug: props.slug,
          selection: text,
          context: fullMd,
        }),
      })
      if (!r.ok) {
        const msg = r.status === 504 ? "응답 지연 (다시 시도)" : `요청 실패 (${r.status})`
        setRewrite((s) => ({ ...s, loading: false, error: msg }))
        return
      }
      const { rewritten } = await r.json()
      setRewrite((s) => ({ ...s, loading: false, rewritten, error: "" }))
    } catch {
      setRewrite((s) => ({ ...s, loading: false, error: "네트워크 오류" }))
    }
  }

  function acceptRewrite() {
    if (!editor) return
    const s = rewrite()
    if (!s.rewritten) return
    editor.chain().focus().insertContentAt({ from: s.from, to: s.to }, s.rewritten).run()
    setRewrite({ visible: false, loading: false, from: 0, to: 0, original: "", rewritten: "", error: "" })
  }

  function cancelRewrite() {
    setRewrite({ visible: false, loading: false, from: 0, to: 0, original: "", rewritten: "", error: "" })
  }

  function cancel() {
    cleanup()
    setMode("idle")
    setErr("")
  }

  function cleanup() {
    if (editor) {
      editor.destroy()
      editor = null
    }
    const art = articleEl()
    if (art) art.style.display = ""
  }

  onCleanup(cleanup)

  return (
    <div>
      <Show when={mode() === "idle"}>
        <button
          onClick={startEdit}
          class="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 hover:text-black hover:dark:text-white blend"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          edit on website
        </button>
      </Show>

      <Show when={mode() === "auth"}>
        <form onSubmit={submitPassword} class="flex items-center gap-2">
          <input
            type="password"
            value={pw()}
            onInput={(e) => setPw(e.currentTarget.value)}
            placeholder="비밀번호"
            class="px-3 py-1 text-sm border rounded bg-transparent border-black/30 dark:border-white/30"
            autofocus
          />
          <button type="submit" class="px-3 py-1 text-sm border rounded border-black/30 dark:border-white/30">
            로그인
          </button>
          <button type="button" onClick={cancel} class="text-sm opacity-70">취소</button>
          <Show when={err()}>
            <span class="text-sm text-red-500">{err()}</span>
          </Show>
        </form>
      </Show>

      <Show when={mode() === "loading"}>
        <span class="text-sm opacity-70">로딩 중…</span>
      </Show>

      <Show when={mode() === "editing" || mode() === "saving"}>
        <div class="mb-6 grid gap-3 p-4 border rounded border-black/15 dark:border-white/20">
          <label class="grid gap-1 text-sm">
            <span class="opacity-70">제목</span>
            <input
              type="text"
              value={meta().title}
              onInput={(e) => setMeta({ ...meta(), title: e.currentTarget.value })}
              class="px-3 py-1.5 border rounded bg-transparent border-black/30 dark:border-white/30"
            />
          </label>
          <label class="grid gap-1 text-sm">
            <span class="opacity-70">요약 (summary)</span>
            <textarea
              rows={2}
              value={meta().summary}
              onInput={(e) => setMeta({ ...meta(), summary: e.currentTarget.value })}
              class="px-3 py-1.5 border rounded bg-transparent border-black/30 dark:border-white/30 resize-y"
            />
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="grid gap-1 text-sm">
              <span class="opacity-70">날짜 (예: Apr 28 2026)</span>
              <input
                type="text"
                value={meta().date}
                onInput={(e) => setMeta({ ...meta(), date: e.currentTarget.value })}
                class="px-3 py-1.5 border rounded bg-transparent border-black/30 dark:border-white/30"
              />
            </label>
            <label class="grid gap-1 text-sm">
              <span class="opacity-70">태그 (콤마로 구분)</span>
              <input
                type="text"
                value={tagsInput()}
                onInput={(e) => setTagsInput(e.currentTarget.value)}
                class="px-3 py-1.5 border rounded bg-transparent border-black/30 dark:border-white/30"
              />
            </label>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={meta().draft}
              onChange={(e) => setMeta({ ...meta(), draft: e.currentTarget.checked })}
            />
            <span>draft (공개 안 함)</span>
          </label>
        </div>
        <article>
          <div ref={editorEl} onPaste={onPaste} onDrop={onDrop} class="min-h-[400px] focus-within:outline-none" />
        </article>
        <div ref={bubbleEl} class="bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded shadow-lg flex">
          <button
            onMouseDown={(e) => { e.preventDefault(); requestRewrite() }}
            class="px-3 py-1.5 text-xs hover:bg-black/5 hover:dark:bg-white/10 flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              <path d="M2 2l7.586 7.586"/>
              <circle cx="11" cy="11" r="2"/>
            </svg>
            톤 다시 쓰기
          </button>
        </div>
        <div class="my-4 flex items-center gap-3">
          <button
            onClick={save}
            disabled={mode() === "saving"}
            class="px-4 py-1.5 text-sm border rounded border-black/30 dark:border-white/30 hover:bg-black/5 hover:dark:bg-white/10"
          >
            {mode() === "saving" ? "저장 중…" : "저장 & 배포"}
          </button>
          <button onClick={cancel} class="px-4 py-1.5 text-sm opacity-70">취소</button>
          <Show when={err()}>
            <span class="text-sm text-red-500">{err()}</span>
          </Show>
        </div>
      </Show>

      <Show when={rewrite().visible}>
        <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={cancelRewrite}>
          <div
            class="bg-white dark:bg-neutral-900 text-black dark:text-white rounded-lg shadow-xl max-w-2xl w-full p-5 grid gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="text-sm font-semibold opacity-70">톤 다시 쓰기</div>
            <div class="grid gap-2">
              <div class="text-xs opacity-60">원문</div>
              <div class="p-3 border rounded bg-black/5 dark:bg-white/5 text-sm whitespace-pre-wrap">{rewrite().original}</div>
            </div>
            <div class="grid gap-2">
              <div class="text-xs opacity-60">새 버전</div>
              <Show when={rewrite().loading}>
                <div class="p-3 border rounded text-sm opacity-70">생성 중… (5~30초)</div>
              </Show>
              <Show when={!rewrite().loading && rewrite().rewritten}>
                <div class="p-3 border rounded bg-green-500/5 border-green-500/30 text-sm whitespace-pre-wrap">
                  {rewrite().rewritten}
                </div>
              </Show>
              <Show when={rewrite().error}>
                <div class="text-sm text-red-500">{rewrite().error}</div>
              </Show>
            </div>
            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={cancelRewrite}
                class="px-3 py-1.5 text-sm opacity-70 hover:opacity-100"
              >
                취소
              </button>
              <button
                onClick={requestRewrite}
                disabled={rewrite().loading}
                class="px-3 py-1.5 text-sm border rounded border-black/30 dark:border-white/30 hover:bg-black/5 hover:dark:bg-white/10 disabled:opacity-40"
              >
                다시
              </button>
              <button
                onClick={acceptRewrite}
                disabled={rewrite().loading || !rewrite().rewritten}
                class="px-4 py-1.5 text-sm border rounded bg-green-600 text-white border-green-600 hover:bg-green-700 disabled:opacity-40"
              >
                채택
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
