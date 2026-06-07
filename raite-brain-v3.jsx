import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "raite_brain_v3";

const TEMPLATE = {
  brand: {
    mission: "例）読者が自分の状態を言語化できるようにする",
    vision: "例）AIと人間が対話しながら思考を深める文化をつくる",
    tone: "例）乾いたトーン。観察者視点。断定しない。余白を残す。実務的。",
    forbidden: "例）成功法則を語らない。ポジティブ強要しない。診断しない。",
  },
  aiRoles: {
    common: `RAIteは「日常の違和感に言葉を渡す」メディアです。
観察者視点を保ち、断定せず、余白を残してください。
答えを出しすぎず、読者が自分で考える余地を必ず残してください。`,
    claude: `あなたはClaudeです。
役割：実装・設計・世界観構築を担う。
実際に作る前提で考える。保守性と実装難易度を考慮する。
機能追加を提案しすぎない。完成を急がない。思想を実装へ落とし込む。`,
    chappy: `あなたはChatGPT（チャッピー）です。
役割：相談役。構造整理・壁打ち・アイデア検証を担う。
問いかけで思考を深める。答えより問いを重視する。
ユーザーの言葉を引き出すことを優先する。`,
    gemini: `あなたはGeminiです。
役割：参謀。市場視点・外部観点・戦略立案を担う。
客観的な視点を保つ。感情より構造を優先する。
ユーザーの盲点を指摘することを恐れない。`,
  },
};

const defaultData = {
  apiKey: "",
  theme: "light",
  phase: "探索",
  initialized: false,
  brand: { mission: "", vision: "", tone: "", forbidden: "" },
  aiRoles: {
    common: { title: "共通", subtitle: "全AIへの共通前提", content: "" },
    claude:  { title: "Claude", subtitle: "実装・設計・世界観", content: "" },
    chappy:  { title: "チャッピー", subtitle: "壁打ち・構造整理", content: "" },
    gemini:  { title: "Gemini", subtitle: "参謀・戦略", content: "" },
  },
  memos: [],
  stocks: [],
  publishHistory: [],
  drafts: [],
};

function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...defaultData,
        initialized: true,
        brand: { ...TEMPLATE.brand },
        aiRoles: {
          common: { title: "共通", subtitle: "全AIへの共通前提", content: TEMPLATE.aiRoles.common },
          claude:  { title: "Claude", subtitle: "実装・設計・世界観", content: TEMPLATE.aiRoles.claude },
          chappy:  { title: "チャッピー", subtitle: "壁打ち・構造整理", content: TEMPLATE.aiRoles.chappy },
          gemini:  { title: "Gemini", subtitle: "参謀・戦略", content: TEMPLATE.aiRoles.gemini },
        },
      };
    }
    return deepMerge(defaultData, JSON.parse(raw));
  } catch { return defaultData; }
}

function persist(data) {
  try {
    const exportData = { ...data, apiKey: "" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data }));
  } catch {}
}

const PHASES = ["探索", "整理", "実装", "発信"];
const STOCK_TYPES = ["発信済み", "ドラフト", "メモ"];
const AI_KEYS = ["common", "claude", "chappy", "gemini"];

const LIGHT = {
  bg: "#f6f7f9", card: "#ffffff", border: "#e8eaed",
  text: "#1f2328", muted: "#6e7781", muted2: "#b0b7c3",
  inputBg: "#ffffff", codeBg: "#f3f4f6", codeText: "#6e7781",
  btnPrimary: "#1f2328", btnPrimaryText: "#fff",
  btnGhost: "#ffffff", btnGhostText: "#1f2328", btnGhostBorder: "#e8eaed",
  btnDanger: "#fff1f1", btnDangerText: "#ef4444", btnDangerBorder: "#fee2e2",
  btnSuccess: "#f0fdf4", btnSuccessText: "#166534", btnSuccessBorder: "#bbf7d0",
  accent: "#3b82f6", tabActive: "#1f2328", tabBorder: "#1f2328",
  toastBg: "#1f2328", toastText: "#fff",
  headerBg: "#ffffff", headerBorder: "#e8eaed",
  divider: "#e8eaed", tagActive: "#1f2328", tagActiveText: "#fff",
  stepActive: "#1f2328", stepDone: "#10b981", stepInactive: "#e8eaed",
  statBg: "#f6f7f9", statText: "#1f2328", statMuted: "#6e7781",
};

const DARK = {
  bg: "#0d1117", card: "#161b22", border: "#30363d",
  text: "#e6edf3", muted: "#7d8590", muted2: "#484f58",
  inputBg: "#21262d", codeBg: "#161b22", codeText: "#7d8590",
  btnPrimary: "#e6edf3", btnPrimaryText: "#0d1117",
  btnGhost: "#21262d", btnGhostText: "#c9d1d9", btnGhostBorder: "#30363d",
  btnDanger: "#2d1a1a", btnDangerText: "#f87171", btnDangerBorder: "#4a2020",
  btnSuccess: "#0d2818", btnSuccessText: "#3fb950", btnSuccessBorder: "#1a4731",
  accent: "#58a6ff", tabActive: "#e6edf3", tabBorder: "#e6edf3",
  toastBg: "#e6edf3", toastText: "#0d1117",
  headerBg: "#161b22", headerBorder: "#30363d",
  divider: "#30363d", tagActive: "#e6edf3", tagActiveText: "#0d1117",
  stepActive: "#e6edf3", stepDone: "#3fb950", stepInactive: "#30363d",
  statBg: "#21262d", statText: "#e6edf3", statMuted: "#7d8590",
};

async function callClaude(apiKey, systemPrompt, userMessage) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.map(c => c.text || "").join("") || "";
}

const ff = "'DM Sans', 'Noto Sans JP', system-ui, sans-serif";

function Input({ value, onChange, placeholder, style, T }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", border: `1px solid ${T.border}`, borderRadius: 8,
        padding: "10px 14px", fontSize: 13, color: T.text, background: T.inputBg,
        outline: "none", fontFamily: ff, boxSizing: "border-box", ...style }} />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3, style, T }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: "100%", border: `1px solid ${T.border}`, borderRadius: 8,
        padding: "12px 14px", fontSize: 13, color: T.text, background: T.inputBg,
        outline: "none", fontFamily: ff, boxSizing: "border-box", resize: "vertical",
        lineHeight: 1.8, ...style }} />
  );
}

function Btn({ children, onClick, variant = "primary", size = "md", disabled, style, T }) {
  const base = { border: "none", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: ff, fontWeight: 500, transition: "opacity 0.15s",
    opacity: disabled ? 0.4 : 1, fontSize: size === "sm" ? 12 : 13,
    padding: size === "sm" ? "5px 10px" : "9px 16px" };
  const v = {
    primary: { background: T.btnPrimary, color: T.btnPrimaryText },
    ghost: { background: T.btnGhost, color: T.btnGhostText, border: `1px solid ${T.btnGhostBorder}` },
    accent: { background: T.accent, color: "#fff" },
    danger: { background: T.btnDanger, color: T.btnDangerText, border: `1px solid ${T.btnDangerBorder}` },
    success: { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
  };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...v[variant], ...style }}>{children}</button>;
}

function Label({ children, T }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: "0.06em",
    textTransform: "uppercase", marginBottom: 6 }}>{children}</div>;
}

function Divider({ T }) {
  return <div style={{ borderTop: `1px solid ${T.divider}`, margin: "16px 0" }} />;
}

function Tag({ children, active, onClick, T }) {
  return (
    <button onClick={onClick} style={{ padding: "4px 10px", borderRadius: 6,
      border: `1px solid ${active ? T.tagActive : T.border}`,
      background: active ? T.tagActive : "transparent",
      color: active ? T.tagActiveText : T.muted,
      fontSize: 11, fontFamily: ff, cursor: "pointer", fontWeight: active ? 500 : 400 }}>
      {children}
    </button>
  );
}

function Toast({ message, T }) {
  if (!message) return null;
  return (
    <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      background: T.toastBg, color: T.toastText, padding: "8px 18px", borderRadius: 8,
      fontSize: 12, zIndex: 999, whiteSpace: "nowrap", pointerEvents: "none" }}>
      {message}
    </div>
  );
}

function Dots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[0,1,2].map(i => (
        <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor",
          animation: `rb 1s ease-in-out ${i*0.15}s infinite` }} />
      ))}
      <style>{`@keyframes rb{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}`}</style>
    </span>
  );
}

function XCount({ text, url, T }) {
  const count = (text + (url ? "\n" + url : "")).length;
  const over = count > 140;
  return (
    <span style={{ fontSize: 11, color: over ? "#ef4444" : T.muted, fontWeight: over ? 600 : 400 }}>
      {count}/140{over ? " ⚠" : ""}
    </span>
  );
}

// ── Stock Item ────────────────────────────────────────────
function StockItem({ stock, data, set, copy, sendToPublish, T, cardStyle }) {
  const [expanded, setExpanded] = useState(false);
  const preview = stock.content.split("\n")[0].slice(0, 50);
  return (
    <div key={stock.id} style={cardStyle}>
      <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
            <Tag T={T} active={false}>{stock.type}</Tag>
            <span style={{ fontSize: 11, color: T.muted2 }}>{stock.date}</span>
          </div>
          <div style={{ fontSize: 13, color: T.text, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis" }}>{preview}</div>
        </div>
        <span style={{ color: T.muted, fontSize: 12, marginLeft: 8, flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>
      {expanded && (
        <>
          <div style={{ padding: "0 14px", fontSize: 13, color: T.text, lineHeight: 1.7,
            marginBottom: 10, whiteSpace: "pre-wrap", borderTop: `1px solid ${T.border}`,
            paddingTop: 10 }}>{stock.content}</div>
          <div style={{ padding: "0 14px 12px", display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn T={T} size="sm" variant="ghost" onClick={() => copy(stock.content)}>コピー</Btn>
            <Btn T={T} size="sm" variant="ghost" onClick={() => sendToPublish(stock.content)}>発信へ送る</Btn>
            {stock.type !== "発信済み" && (
              <Btn T={T} size="sm" variant="success"
                onClick={() => set("stocks", data.stocks.map(x => x.id === stock.id ? { ...x, type: "発信済み" } : x))}>
                発信済みにする
              </Btn>
            )}
            <Btn T={T} size="sm" variant="danger"
              onClick={() => set("stocks", data.stocks.filter(x => x.id !== stock.id))}>削除</Btn>
          </div>
        </>
      )}
    </div>
  );
}

// ── Step Indicator ────────────────────────────────────────
function StepBar({ current, T }) {
  const steps = ["入力", "確認・編集", "保存"];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600,
              background: i < current ? "#dcfce7" : i === current ? T.btnPrimary : T.border,
              color: i < current ? "#166534" : i === current ? T.btnPrimaryText : T.muted,
            }}>
              {i < current ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 10, color: i === current ? T.text : T.muted, whiteSpace: "nowrap" }}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 1, background: i < current ? "#bbf7d0" : T.border,
              margin: "0 6px", marginBottom: 18 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function RAIteBrainInner({ onSwitch }) {
  const [data, setData] = useState(load);
  const [tab, setTab] = useState("home");
  const [toast, setToast] = useState("");
  const toastRef = useRef(null);

  const T = data.theme === "dark" ? DARK : LIGHT;

  // Base
  const [editingRole, setEditingRole] = useState(null);
  const [optimizing, setOptimizing] = useState(null);
  const [memoTarget, setMemoTarget] = useState("common");
  const [memoText, setMemoText] = useState("");
  const [merging, setMerging] = useState(null);
  const [showSync, setShowSync] = useState(false);

  // Create tab
  const [createStep, setCreateStep] = useState(0);
  const [ideaText, setIdeaText] = useState("");
  const [creating, setCreating] = useState(false);
  const [draftTitles, setDraftTitles] = useState([]);
  const [draftBody, setDraftBody] = useState("");
  const [selectedTitle, setSelectedTitle] = useState("");
  const [customTitle, setCustomTitle] = useState("");

  // Publish
  const [articleText, setArticleText] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingPast, setGeneratingPast] = useState(false);

  // Stock
  const [stockText, setStockText] = useState("");
  const [stockType, setStockType] = useState("発信済み");
  const [stockSearch, setStockSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("");

  useEffect(() => { persist(data); }, [data]);

  // 週1バックアップ通知
  useEffect(() => {
    const lastExport = localStorage.getItem("raite_last_export");
    if (!lastExport) return;
    const diff = Date.now() - parseInt(lastExport);
    if (diff > 7 * 24 * 60 * 60 * 1000) {
      showToast("週次バックアップの時期です。設定からエクスポートを！");
    }
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 2500);
  };

  const set = (path, value) => {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const copy = (text) => navigator.clipboard.writeText(text).then(() => showToast("コピーしました"));

  const buildPrompt = (aiKey) => {
    const b = data.brand;
    const roles = data.aiRoles;
    const names = { common: "共通", claude: "Claude", chappy: "チャッピー", gemini: "Gemini" };
    const brand = [
      b.mission && `ミッション：${b.mission}`,
      b.vision && `ビジョン：${b.vision}`,
      b.tone && `トーン：${b.tone}`,
      b.forbidden && `禁止：${b.forbidden}`,
    ].filter(Boolean).join("\n");
    return [
      "【RAIte共通定義】",
      brand || "（未設定）",
      `フェーズ：${data.phase}`,
      roles.common.content && `\n【共通指示】\n${roles.common.content}`,
      aiKey !== "common" && roles[aiKey].content && `\n【${names[aiKey]}への指示】\n${roles[aiKey].content}`,
      `\nあなたは${aiKey === "common" ? "RAIteのAIアシスタント" : names[aiKey]}です。`,
    ].filter(Boolean).join("\n");
  };

  // ── 記事化 ──
  const createArticle = async () => {
    if (!data.apiKey) { showToast("APIキーを設定してください"); setTab("settings"); return; }
    if (!ideaText.trim()) { showToast("気づきを入力してください"); return; }
    setCreating(true);
    const b = data.brand;
    const brandContext = [
      b.mission && `ミッション：${b.mission}`,
      b.tone && `トーン：${b.tone}`,
      b.forbidden && `禁止：${b.forbidden}`,
    ].filter(Boolean).join("\n");
    try {
      const result = await callClaude(
        data.apiKey,
        `あなたはRAIteのコンテンツライターです。
以下のブランド仕様に従い、気づきメモを記事ドラフトに変換してください。

【ブランド仕様】
${brandContext || "（未設定）"}
フェーズ：${data.phase}

【記事化のルール】
- 観察者視点で構造化する。断定しない。余白を残す。
- 読者が「自分のことかも」と思えるような普遍性を持たせる
- 本文は「8割ドラフト」として出力する（人間が最後に手を入れる前提）
- タイトル候補を3つ生成する（20文字以内、問いや違和感を含む）
- 本文は600〜1200文字程度

【出力形式】
以下のJSONのみ返すこと。前置き・説明・マークダウン不要。
{"titles":["タイトル1","タイトル2","タイトル3"],"body":"本文"}`,
        `以下の気づきを記事ドラフトにしてください：\n\n${ideaText}`
      );
      const clean = result.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setDraftTitles(parsed.titles || []);
      setDraftBody(parsed.body || "");
      setSelectedTitle(parsed.titles?.[0] || "");
      setCreateStep(1);
    } catch (e) {
      showToast("エラー: " + e.message);
    }
    setCreating(false);
  };

  // ── SNS生成 ──
  const generateSNS = async () => {
    if (!data.apiKey) { showToast("APIキーを設定してください"); setTab("settings"); return; }
    if (!articleText.trim()) { showToast("記事本文を入力してください"); return; }
    setGenerating(true);
    try {
      const result = await callClaude(data.apiKey,
        `あなたはRAIteのSNS投稿文ライターです。
以下のルールに従い、X用とThreads用の投稿文を生成してください。

【RAIteのトーン】
乾いた・観察者視点・断定しない・余白を残す・答えを出しきらない

【X投稿文ルール】
・記事を読んで湧いた「問い」や「違和感」を起点にする
・記事に書いていない問いでも構わない
・読んでいない人が「何それ？」と立ち止まる一行を作る
・答えは出しきらない
・140文字以内・URLなし

【Threads投稿文ルール】
・2〜4行でチラ見せ
・答えを出しきらない
・URLなし

【出力形式】
以下のJSONのみ返すこと。前置き・説明・マークダウン不要。
{"x": "X投稿文", "threads": "Threads投稿文"}`,
        `記事：\n${articleText}`);
      const parsed = JSON.parse(result.replace(/```json|```/g, "").trim());
      const entry = { id: Date.now(), date: new Date().toLocaleDateString("ja-JP"),
        articlePreview: articleText.slice(0, 60) + (articleText.length > 60 ? "..." : ""),
        url: articleUrl, x: parsed.x, threads: parsed.threads };
      set("publishHistory", [entry, ...data.publishHistory].slice(0, 10));
    } catch (e) { showToast("エラー: " + e.message); }
    setGenerating(false);
  };

  // ── 過去記事から投稿候補生成 ──
  const generateFromPast = async () => {
    if (!data.apiKey) { showToast("APIキーを設定してください"); return; }
    const published = data.stocks.filter(s => s.type === "発信済み");
    if (published.length === 0) { showToast("発信済み記事がありません"); return; }
    setGeneratingPast(true);
    const target = published[Math.floor(Math.random() * published.length)];
    try {
      const result = await callClaude(data.apiKey,
        `あなたはRAIteのSNS投稿文ライターです。
過去の発信済み記事を再活用するX投稿文を1つ生成してください。

【RAIteのトーン】
乾いた・観察者視点・断定しない・余白を残す

【ルール】
・記事を読んで湧いた「問い」や「違和感」を起点にする
・初めて読む人が「何それ？」と立ち止まる一行
・答えは出しきらない・140文字以内

JSONのみ返す：{"x":"投稿文","preview":"使用した記事の冒頭30文字"}`,
        `記事：\n${target.content}`);
      const parsed = JSON.parse(result.replace(/```json|```/g, "").trim());
      const entry = { id: Date.now(), date: new Date().toLocaleDateString("ja-JP"),
        articlePreview: `[過去記事] ${parsed.preview || target.content.slice(0, 30)}`,
        url: "", x: parsed.x, threads: "" };
      set("publishHistory", [entry, ...data.publishHistory].slice(0, 10));
    } catch (e) { showToast("エラー: " + e.message); }
    setGeneratingPast(false);
  };

  const sendToPublish = (content) => {
    setArticleText(content);
    setTab("publish");
    showToast("発信タブにセットしました");
  };

  const saveDraft = () => {
    const title = customTitle || selectedTitle;
    if (!title || !draftBody) return;
    const stock = { id: Date.now(), type: "ドラフト", title,
      content: `${title}\n\n${draftBody}`, date: new Date().toLocaleDateString("ja-JP") };
    set("stocks", [stock, ...data.stocks]);
    showToast("ドラフトとして保存しました");
    setCreateStep(2);
  };

  const optimizeRole = async (aiKey) => {
    if (!data.apiKey) { showToast("APIキーを設定してください"); setTab("settings"); return; }
    const current = data.aiRoles[aiKey].content;
    if (!current.trim()) { showToast("内容が空です"); return; }
    setOptimizing(aiKey);
    const backup = current;
    try {
      const result = await callClaude(data.apiKey,
        "システムプロンプト最適化の専門家。与えられたテキストを簡潔なシステムプロンプトに変換。冗長部分を削除。変換後のプロンプトのみ返す。",
        `以下をシステムプロンプトとして最適化：\n\n${current}`);
      set(`aiRoles.${aiKey}.content`, result.trim());
      showToast("最適化しました");
    } catch (e) {
      set(`aiRoles.${aiKey}.content`, backup);
      showToast("エラーが発生しました。元の内容に戻しました。");
    }
    setOptimizing(null);
  };

  const mergeMemo = async (memo) => {
    if (!data.apiKey) { showToast("APIキーを設定してください"); return; }
    setMerging(memo.id);
    const backupRole = data.aiRoles[memo.target].content;
    try {
      const result = await callClaude(data.apiKey,
        "AIへの指示文を管理する専門家。既存のシステムプロンプトに新しい情報を統合し、重複を排除して簡潔に最適化。統合後のプロンプトのみ返す。",
        `既存：\n${backupRole || "（空）"}\n\n追加：\n${memo.content}\n\n統合・最適化してください。`);
      set(`aiRoles.${memo.target}.content`, result.trim());
      set("memos", data.memos.filter(m => m.id !== memo.id));
      showToast("統合しました");
    } catch (e) {
      set(`aiRoles.${memo.target}.content`, backupRole);
      showToast("エラーが発生しました。元の内容に戻しました。");
    }
    setMerging(null);
  };

  const filteredStocks = data.stocks.filter(s => {
    if (stockFilter && s.type !== stockFilter) return false;
    if (stockSearch) return (s.content + (s.title || "")).toLowerCase().includes(stockSearch.toLowerCase());
    return true;
  });

  const TABS = [
    { id: "home", label: "ホーム", icon: "⌂" },
    { id: "create", label: "作成", icon: "✍" },
    { id: "publish", label: "発信", icon: "📢" },
    { id: "stock", label: "保存", icon: "📁" },
    { id: "settings", label: "設定", icon: "⚙" },
  ];

  const s = {
    page: { maxWidth: 480, margin: "0 auto", padding: "16px 16px 0" },
    card: { border: `1px solid ${T.border}`, borderRadius: 12, background: T.card, overflow: "hidden" },
    sec: { marginBottom: 20 },
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: ff, paddingBottom: 90, color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Noto+Sans+JP:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: ${T.muted2}; }
        input:focus, textarea:focus { border-color: ${T.text} !important; box-shadow: 0 0 0 2px ${T.text}18; }
        button:active { opacity: 0.7 !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ background: T.headerBg, borderBottom: `1px solid ${T.headerBorder}`,
        padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: "-0.01em" }}>Multi AI Brain</div>
          <div style={{ fontSize: 10, color: T.muted2, marginTop: 1 }}>v3 · CREATE · PUBLISH · STOCK</div>
        </div>
        <button onClick={onSwitch} style={{ background: "none", border: `1px solid ${T.border}`,
          color: T.muted, fontSize: 11, padding: "5px 10px", borderRadius: 6,
          fontFamily: ff, cursor: "pointer" }}>
          Unaへ切替
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {PHASES.map(p => (
            <button key={p} onClick={() => set("phase", p)} style={{ padding: "3px 8px", borderRadius: 5,
              border: `1px solid ${data.phase === p ? T.tagActive : T.border}`,
              background: data.phase === p ? T.tagActive : "transparent",
              color: data.phase === p ? T.tagActiveText : T.muted,
              fontSize: 9, fontFamily: ff, cursor: "pointer" }}>{p}</button>
          ))}
        </div>
      </div>

      <div style={s.page}>

        {/* ── HOME ── */}
        {tab === "home" && (
          <div>
            <div style={{ ...s.sec }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                こんにちは 👋
              </div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
                今日も気づきを言葉にしていきましょう。
              </div>
            </div>

            {/* 今日の気づきクイック入力 */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 8 }}>今日の気づき</div>
                <Textarea T={T} value={ideaText} onChange={setIdeaText}
                  placeholder="思ったこと、違和感、アイデアなどを自由に書いてください"
                  rows={3} />
                <Btn T={T} onClick={() => { setTab("create"); }}
                  disabled={!ideaText.trim()} style={{ width: "100%", marginTop: 10 }}>
                  記事化する →
                </Btn>
              </div>
            </div>

            {/* クイックサマリー */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[
                { label: "作成した記事", value: data.stocks.filter(s => s.type === "ドラフト" || s.type === "発信済み").length, unit: "本" },
                { label: "未投稿", value: data.publishHistory.length, unit: "件" },
                { label: "保存済み", value: data.stocks.length, unit: "合計" },
              ].map((stat, i) => (
                <div key={i} style={{ flex: 1, background: T.statBg, border: `1px solid ${T.border}`,
                  borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: T.statText, lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: 9, color: T.statMuted, marginTop: 4, lineHeight: 1.4 }}>
                    {stat.label}<br />{stat.unit}
                  </div>
                </div>
              ))}
            </div>

            {/* 最近の記事 */}
            {data.stocks.length > 0 && (
              <div style={s.sec}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <Label T={T}>最近の保存記事</Label>
                  <button onClick={() => setTab("stock")} style={{ background: "none", border: "none",
                    color: T.accent, fontSize: 11, cursor: "pointer", fontFamily: ff }}>
                    すべて見る
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.stocks.slice(0, 3).map(stock => (
                    <div key={stock.id} style={{ ...s.card, cursor: "pointer" }}
                      onClick={() => { sendToPublish(stock.content); }}>
                      <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: T.text, fontWeight: 500,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {stock.title || stock.content.split("\n")[0].slice(0, 30)}
                          </div>
                          <div style={{ fontSize: 10, color: T.muted2, marginTop: 3 }}>{stock.date}</div>
                        </div>
                        <span style={{ color: T.muted, fontSize: 11, marginLeft: 8 }}>›</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ショートカット */}
            <Divider T={T} />
            <Label T={T}>ショートカット</Label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn T={T} variant="ghost" onClick={() => setTab("create")} style={{ flex: 1 }}>✍ 記事を作る</Btn>
              <Btn T={T} variant="ghost" onClick={() => setTab("publish")} style={{ flex: 1 }}>📢 SNSに投稿</Btn>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <Btn T={T} variant="ghost" onClick={() => setTab("base_hidden")} style={{ flex: 1 }}>⚙ ブランド設定</Btn>
            </div>
          </div>
        )}

        {/* ── BASE ── */}
        {tab === "base_hidden" && (
          <div>
            <div style={s.sec}>
              <Label T={T}>ブランド仕様</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { key: "mission", ph: "ミッション" },
                  { key: "vision", ph: "ビジョン" },
                  { key: "tone", ph: "トーン・スタイル" },
                  { key: "forbidden", ph: "禁止事項" },
                ].map(f => (
                  <Input key={f.key} T={T} value={data.brand[f.key]}
                    onChange={v => set(`brand.${f.key}`, v)} placeholder={f.ph} />
                ))}
              </div>
            </div>

            <Divider T={T} />

            <div style={s.sec}>
              <Label T={T}>AI 役割定義</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {AI_KEYS.map(key => {
                  const role = data.aiRoles[key];
                  const isEditing = editingRole === key;
                  return (
                    <div key={key} style={s.card}>
                      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center",
                        justifyContent: "space-between", borderBottom: isEditing ? `1px solid ${T.border}` : "none" }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{role.title}</span>
                          <span style={{ fontSize: 11, color: T.muted2, marginLeft: 8 }}>{role.subtitle}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Btn T={T} size="sm" variant="ghost" onClick={() => setEditingRole(isEditing ? null : key)}>
                            {isEditing ? "閉じる" : "編集"}
                          </Btn>
                          <Btn T={T} size="sm" variant="ghost" onClick={() => optimizeRole(key)} disabled={!!optimizing}>
                            {optimizing === key ? <Dots /> : "最適化"}
                          </Btn>
                        </div>
                      </div>
                      {isEditing && (
                        <div style={{ padding: 12 }}>
                          <Textarea T={T} value={role.content}
                            onChange={v => set(`aiRoles.${key}.content`, v)}
                            placeholder={`${role.title}への指示・役割定義...`} rows={4} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Divider T={T} />

            <div style={s.sec}>
              <Label T={T}>追加メモ</Label>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, lineHeight: 1.6 }}>
                会話中に生まれたプロンプトを一時保存。「統合」でAIの役割定義に最適化して追加。
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                {AI_KEYS.map(k => (
                  <Tag key={k} T={T} active={memoTarget === k} onClick={() => setMemoTarget(k)}>
                    {data.aiRoles[k].title}
                  </Tag>
                ))}
              </div>
              <Textarea T={T} value={memoText} onChange={setMemoText}
                placeholder="貼り付けたいプロンプトや気づき..." rows={3} />
              <Btn T={T} variant="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => {
                if (!memoText.trim()) return;
                const m = { id: Date.now(), target: memoTarget, content: memoText,
                  date: new Date().toLocaleDateString("ja-JP") };
                set("memos", [m, ...data.memos]);
                setMemoText("");
                showToast("保存しました");
              }}>保存</Btn>

              {data.memos.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.memos.map(memo => (
                    <div key={memo.id} style={s.card}>
                      <div style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{data.aiRoles[memo.target]?.title}</span>
                        <span style={{ fontSize: 11, color: T.muted2 }}>{memo.date}</span>
                      </div>
                      <div style={{ padding: "0 12px", fontSize: 12, color: T.muted, lineHeight: 1.6, marginBottom: 10 }}>
                        {memo.content}
                      </div>
                      <div style={{ padding: "0 12px 12px", display: "flex", gap: 6 }}>
                        <Btn T={T} size="sm" variant="ghost"
                          onClick={() => set("memos", data.memos.filter(m => m.id !== memo.id))}>削除</Btn>
                        <Btn T={T} size="sm" onClick={() => mergeMemo(memo)} disabled={!!merging}>
                          {merging === memo.id ? <Dots /> : "統合して最適化"}
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Divider T={T} />

            {/* コンテキスト同期（折りたたみ） */}
            <div style={s.sec}>
              <button onClick={() => setShowSync(!showSync)} style={{ background: "none", border: "none",
                color: T.muted, fontSize: 12, cursor: "pointer", fontFamily: ff,
                display: "flex", alignItems: "center", gap: 6, padding: 0, marginBottom: 8 }}>
                <span>{showSync ? "▾" : "▸"}</span> AI コンテキスト同期
              </button>
              {showSync && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 4, lineHeight: 1.6 }}>
                    ブランド仕様・AI役割定義から自動生成。各AIに貼り付けて使う。
                  </div>
                  {AI_KEYS.map(key => {
                    const role = data.aiRoles[key];
                    const prompt = buildPrompt(key);
                    return (
                      <div key={key} style={s.card}>
                        <div style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{role.title}</span>
                            <span style={{ fontSize: 11, color: T.muted2, marginLeft: 8 }}>{role.subtitle}</span>
                          </div>
                          <Btn T={T} size="sm" onClick={() => copy(prompt)}>コピー</Btn>
                        </div>
                        <div style={{ padding: "0 12px 10px" }}>
                          <div style={{ background: T.codeBg, borderRadius: 6, padding: "8px 10px",
                            fontSize: 10, color: T.codeText, lineHeight: 1.7, maxHeight: 56, overflow: "hidden" }}>
                            {prompt || "（未設定）"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CREATE ── */}
        {tab === "create" && (
          <div>
            <StepBar current={createStep} T={T} />

            {/* STEP 0: 入力 */}
            {createStep === 0 && (
              <div style={s.card}>
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>気づきを入力</div>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, lineHeight: 1.6 }}>
                    違和感・メモ・思ったことをざっと書く。箇条書きでも断片でもOK。
                  </div>
                  <Textarea T={T} value={ideaText} onChange={setIdeaText}
                    placeholder={"例）\n・現場でAIを導入しようとすると、技術の話より人の話になる\n・「誰のため？」が曖昧なまま進むプロジェクトは止まる\n・正しいことを言っても動かない理由がある気がする"}
                    rows={7} />
                  <Btn T={T} onClick={createArticle} disabled={creating || !ideaText.trim()}
                    style={{ width: "100%", marginTop: 12 }}>
                    {creating ? <><Dots /> 記事化しています...</> : "記事化する →"}
                  </Btn>
                </div>
              </div>
            )}

            {/* STEP 1: 確認・編集 */}
            {createStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={s.card}>
                  <div style={{ padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>タイトルを選ぶ</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {draftTitles.map((t, i) => (
                        <button key={i} onClick={() => { setSelectedTitle(t); setCustomTitle(""); }}
                          style={{ padding: "10px 14px", borderRadius: 8, textAlign: "left",
                            border: `1px solid ${selectedTitle === t && !customTitle ? T.tagActive : T.border}`,
                            background: selectedTitle === t && !customTitle ? `${T.tagActive}10` : T.card,
                            color: T.text, fontSize: 13, fontFamily: ff, cursor: "pointer",
                            fontWeight: selectedTitle === t && !customTitle ? 600 : 400 }}>
                          {t}
                        </button>
                      ))}
                    </div>
                    <Input T={T} value={customTitle} onChange={v => { setCustomTitle(v); setSelectedTitle(""); }}
                      placeholder="または手動で入力..." style={{ marginTop: 10 }} />
                  </div>
                </div>

                <div style={s.card}>
                  <div style={{ padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>本文を確認・編集</div>
                    <Textarea T={T} value={draftBody} onChange={setDraftBody} rows={12} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <Btn T={T} variant="ghost" onClick={() => setCreateStep(0)} style={{ flex: 1 }}>← やり直す</Btn>
                  <Btn T={T} variant="ghost" onClick={() => { saveDraft(); }} style={{ flex: 1 }}
                    disabled={!draftBody || (!selectedTitle && !customTitle)}>
                    ドラフト保存
                  </Btn>
                  <Btn T={T} onClick={() => {
                    const title = customTitle || selectedTitle;
                    sendToPublish(`${title}\n\n${draftBody}`);
                  }} style={{ flex: 1 }} disabled={!draftBody || (!selectedTitle && !customTitle)}>
                    発信へ →
                  </Btn>
                </div>
              </div>
            )}

            {/* STEP 2: 完了 */}
            {createStep === 2 && (
              <div style={s.card}>
                <div style={{ padding: 24, textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>ドラフトを保存しました</div>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 20, lineHeight: 1.6 }}>
                    ストックタブの「ドラフト」に保存されています。
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <Btn T={T} variant="ghost" onClick={() => {
                      setCreateStep(0); setIdeaText(""); setDraftTitles([]);
                      setDraftBody(""); setSelectedTitle(""); setCustomTitle("");
                    }}>新しく作る</Btn>
                    <Btn T={T} onClick={() => setTab("stock")}>保存へ</Btn>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PUBLISH ── */}
        {tab === "publish" && (
          <div>
            <div style={s.sec}>
              <Label T={T}>記事</Label>
              <Textarea T={T} value={articleText} onChange={setArticleText}
                placeholder="記事本文を貼り付ける..." rows={5} />
              <Input T={T} value={articleUrl} onChange={setArticleUrl}
                placeholder="note URL（任意）" style={{ marginTop: 8 }} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Btn T={T} onClick={generateSNS} disabled={generating || !articleText.trim()} style={{ flex: 2 }}>
                  {generating ? <><Dots /> 生成中...</> : "投稿文を生成 →"}
                </Btn>
                <Btn T={T} variant="ghost" onClick={generateFromPast} disabled={generatingPast} style={{ flex: 1 }}>
                  {generatingPast ? <Dots /> : "過去記事から"}
                </Btn>
              </div>
            </div>

            {data.publishHistory.length > 0 && (
              <>
                <Divider T={T} />
                <Label T={T}>生成履歴</Label>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {data.publishHistory.map((entry, i) => (
                    <div key={entry.id} style={s.card}>
                      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
                        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: T.muted2 }}>
                          {i === 0 ? "最新" : `${i + 1}件前`} · {entry.date}
                        </span>
                        <Btn T={T} size="sm" variant="danger"
                          onClick={() => set("publishHistory", data.publishHistory.filter(h => h.id !== entry.id))}>
                          削除
                        </Btn>
                      </div>
                      <div style={{ padding: "8px 14px 4px", fontSize: 11, color: T.muted2 }}>
                        {entry.articlePreview}
                      </div>

                      <div style={{ padding: "8px 14px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, letterSpacing: "0.1em" }}>X</div>
                          <XCount T={T} text={entry.x} url={entry.url} />
                        </div>
                        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7, marginBottom: 6 }}>{entry.x}</div>
                        {entry.url && <div style={{ fontSize: 11, color: T.accent, marginBottom: 8 }}>{entry.url}</div>}
                        <div style={{ display: "flex", gap: 6 }}>
                          <Btn T={T} size="sm" variant="ghost"
                            onClick={() => copy(entry.url ? `${entry.x}\n${entry.url}` : entry.x)}>コピー</Btn>
                          <Btn T={T} size="sm" variant="accent"
                            onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(entry.url ? `${entry.x}\n${entry.url}` : entry.x)}`, "_blank")}>
                            Xで開く
                          </Btn>
                        </div>
                      </div>

                      {entry.threads && (
                        <div style={{ padding: "8px 14px 12px", borderTop: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, letterSpacing: "0.1em", marginBottom: 6 }}>Threads</div>
                          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7, marginBottom: 8, whiteSpace: "pre-wrap" }}>
                            {entry.threads}
                          </div>
                          <Btn T={T} size="sm" variant="ghost"
                            onClick={() => copy(entry.url ? `${entry.threads}\n${entry.url}` : entry.threads)}>コピー</Btn>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STOCK ── */}
        {tab === "stock" && (
          <div>
            <div style={s.sec}>
              <Label T={T}>追加</Label>
              <Textarea T={T} value={stockText} onChange={setStockText}
                placeholder={"記事・メモ・発信済みテキストなど...\nプロンプトには反映されません"} rows={4} />
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {STOCK_TYPES.map(t => <Tag key={t} T={T} active={stockType === t} onClick={() => setStockType(t)}>{t}</Tag>)}
              </div>
              <Btn T={T} style={{ width: "100%", marginTop: 10 }} onClick={() => {
                if (!stockText.trim()) return;
                const s = { id: Date.now(), type: stockType, content: stockText, title: stockText.split("\n")[0].slice(0, 40),
                  date: new Date().toLocaleDateString("ja-JP") };
                set("stocks", [s, ...data.stocks]);
                setStockText("");
                showToast("保存しました");
              }}>保存</Btn>
            </div>

            <Divider T={T} />

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <Input T={T} value={stockSearch} onChange={setStockSearch} placeholder="検索..." style={{ flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              <Tag T={T} active={stockFilter === ""} onClick={() => setStockFilter("")}>すべて</Tag>
              {STOCK_TYPES.map(t => <Tag key={t} T={T} active={stockFilter === t} onClick={() => setStockFilter(t)}>{t}</Tag>)}
            </div>

            <div style={{ fontSize: 11, color: T.muted2, marginBottom: 10 }}>{filteredStocks.length}件</div>

            {filteredStocks.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: T.muted, fontSize: 13 }}>
                ストックはまだありません
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredStocks.map(stock => (
                <StockItem key={stock.id} stock={stock} data={data} set={set}
                  copy={copy} sendToPublish={sendToPublish} T={T} cardStyle={s.card} />
              ))}
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === "settings" && (
          <div>
            <div style={s.sec}>
              <Label T={T}>Claude API Key</Label>
              <div style={{ background: T.theme === "dark" ? "#1a2a1a" : "#f0fdf4",
                border: `1px solid ${T.theme === "dark" ? "#2a4a2a" : "#bbf7d0"}`,
                borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: T.theme === "dark" ? "#86efac" : "#166534",
                  fontWeight: 600, marginBottom: 4 }}>🔒 APIキーは安全に保存されます</div>
                <div style={{ fontSize: 11, color: T.theme === "dark" ? "#6ee7b7" : "#15803d", lineHeight: 1.7 }}>
                  入力されたAPIキーはお使いのデバイス内（localStorage）にのみ保存されます。
                  開発者を含む外部のサーバーには一切送信されません。
                </div>
              </div>
              <Input T={T} value={data.apiKey} onChange={v => set("apiKey", v)}
                placeholder="sk-ant-..." style={{ fontFamily: "monospace", fontSize: 12 }} />
              <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.6 }}>
                取得：console.anthropic.com
              </div>
            </div>

            <Divider T={T} />

            <div style={s.sec}>
              <Label T={T}>表示モード</Label>
              <div style={{ display: "flex", gap: 8 }}>
                <Tag T={T} active={data.theme === "light"} onClick={() => set("theme", "light")}>ライト</Tag>
                <Tag T={T} active={data.theme === "dark"} onClick={() => set("theme", "dark")}>ダーク</Tag>
              </div>
            </div>

            <Divider T={T} />

            <div style={s.sec}>
              <Label T={T}>テンプレートをリセット</Label>
              <Btn T={T} variant="ghost" style={{ width: "100%" }} onClick={() => {
                if (!confirm("テンプレートに戻しますか？現在の内容は上書きされます。")) return;
                set("brand", { ...TEMPLATE.brand });
                set("aiRoles", {
                  common: { title: "共通", subtitle: "全AIへの共通前提", content: TEMPLATE.aiRoles.common },
                  claude:  { title: "Claude", subtitle: "実装・設計・世界観", content: TEMPLATE.aiRoles.claude },
                  chappy:  { title: "チャッピー", subtitle: "壁打ち・構造整理", content: TEMPLATE.aiRoles.chappy },
                  gemini:  { title: "Gemini", subtitle: "参謀・戦略", content: TEMPLATE.aiRoles.gemini },
                });
                showToast("テンプレートに戻しました");
              }}>テンプレートに戻す</Btn>
            </div>

            <Divider T={T} />

            <div style={s.sec}>
              <Label T={T}>バックアップ</Label>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, lineHeight: 1.6 }}>
                データが消えた場合に備えて定期的にバックアップを取ってください。
              </div>
              <div style={{ marginBottom: 10 }}>
                <Btn T={T} variant="ghost" style={{ width: "100%" }} onClick={() => {
                  const exportData = { ...data, apiKey: "" };
                  copy(JSON.stringify(exportData, null, 2));
                  localStorage.setItem("raite_last_export", Date.now().toString());
                }}>全データをテキストでコピー（APIキー除く）</Btn>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>テキストから復元</div>
                <Textarea T={T} value="" onChange={v => {
                  if (!v.trim()) return;
                  try {
                    const parsed = JSON.parse(v);
                    if (parsed.stocks) {
                      parsed.stocks = parsed.stocks.map(s => ({
                        ...s,
                        type: s.type === "下書き" ? "ドラフト" : s.type,
                        title: s.title || s.content?.split("\n")[0]?.slice(0, 40) || ""
                      }));
                    }
                    setData(deepMerge(defaultData, parsed));
                    showToast("復元しました");
                  } catch { showToast("データの形式が正しくありません"); }
                }} placeholder="バックアップテキストをここに貼り付け..." rows={2} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn T={T} variant="ghost" style={{ flex: 1 }} onClick={() => {
                  const exportData = { ...data, apiKey: "" };
                  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `multiai_${new Date().toISOString().slice(0,10)}.json`; a.click();
                  URL.revokeObjectURL(url);
                  localStorage.setItem("raite_last_export", Date.now().toString());
                }}>JSONで保存</Btn>
                <label style={{ flex: 1, display: "block" }}>
                  <Btn T={T} variant="ghost" style={{ width: "100%", pointerEvents: "none" }}>JSONを読み込む</Btn>
                  <input type="file" accept=".json" style={{ display: "none" }} onChange={e => {
                    const file = e.target.files[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      try {
                        const parsed = JSON.parse(ev.target.result);
                        // v2のデータ互換対応（下書き→ドラフト）
                        if (parsed.stocks) {
                          parsed.stocks = parsed.stocks.map(s => ({
                            ...s,
                            type: s.type === "下書き" ? "ドラフト" : s.type,
                            title: s.title || s.content?.split("\n")[0]?.slice(0, 40) || ""
                          }));
                        }
                        setData(deepMerge(defaultData, parsed));
                        showToast("インポートしました");
                      } catch { showToast("JSONの形式が正しくありません"); }
                    };
                    reader.readAsText(file); e.target.value = "";
                  }} />
                </label>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.headerBg,
        borderTop: `1px solid ${T.headerBorder}`, display: "flex", zIndex: 100,
        paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "10px 4px 8px",
              border: "none", background: "none", cursor: "pointer", fontFamily: ff,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 18, color: active ? T.tabActive : T.muted, lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: 9, color: active ? T.tabActive : T.muted,
                fontWeight: active ? 600 : 400, letterSpacing: "0.06em" }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      <Toast message={toast} T={T} />
    </div>
  );
}

// ═══════════════════════════════════════════════
// Una SNS発信ツール
// ═══════════════════════════════════════════════

const UNA_STORAGE_KEY = "una_brain_v1";

const unaDefaultData = {
  apiKey: "",
  theme: "light",
  brands: [
    {
      id: 1,
      name: "Una",
      url: "https://unaapp.vercel.app",
      mission: "障害・発達障害のある子を持つ親が、体験や情報を「置いていける場所」を作る",
      vision: "療育の方針が違っても、就学先が違っても、誰もが自分の経験を持ち寄れるコミュニティ",
      tone: "温かみのある観察者視点。共感するが断定しない。押しつけない。余白を残す。ユーザーの体験を尊重する。「寄り添い」「支援」は使わない。",
      forbidden: "福祉・支援サービスを匂わせる表現。「寄り添います」「一緒に頑張りましょう」「安心して相談できます」。医療・専門的助言を装う表現。数字・成果・効果を断言する表現。",
    },
  ],
  activeBrandId: 1,
  history: [],
};

function loadUna() {
  try {
    const raw = localStorage.getItem(UNA_STORAGE_KEY);
    if (!raw) return unaDefaultData;
    const stored = JSON.parse(raw);
    // v1→v2マイグレーション: brand(単一) → brands(配列)
    if (stored.brand && !stored.brands) {
      stored.brands = [{ id: 1, name: "Una", url: "https://unaapp.vercel.app", ...stored.brand }];
      stored.activeBrandId = 1;
      delete stored.brand;
    }
    return deepMerge(unaDefaultData, stored);
  } catch { return unaDefaultData; }
}

function persistUna(data) {
  try { localStorage.setItem(UNA_STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export function UnaApp({ onSwitch }) {
  const [data, setData] = useState(loadUna);
  const [unaTab, setUnaTab] = useState("home");
  const [toast, setToast] = useState("");
  const toastRef = useRef(null);

  const T = data.theme === "dark" ? DARK : LIGHT;

  // Home
  const [keyword, setKeyword] = useState("");
  const [includeUrl, setIncludeUrl] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);

  // Brand management
  const [brandForm, setBrandForm] = useState(null); // null | brand object

  const activeBrand = data.brands.find(b => b.id === data.activeBrandId) || data.brands[0];
  const setBrandField = (k, v) => setBrandForm(prev => ({ ...prev, [k]: v }));

  useEffect(() => { persistUna(data); }, [data]);

  const showToast = (msg) => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 2500);
  };

  const setU = (path, value) => {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const copy = (text) => navigator.clipboard.writeText(text).then(() => showToast("コピーしました"));

  // 過去履歴サマリー
  const historyContext = data.history.slice(0, 5).map(h => `・${h.x}`).join("\n");

  const generate = async () => {
    if (!data.apiKey) { showToast("APIキーを設定してください"); setUnaTab("settings"); return; }
    if (!keyword.trim()) { showToast("キーワードを入力してください"); return; }
    setGenerating(true);
    setPreview(null);

    const b = activeBrand;

    try {
      const result = await callClaude(data.apiKey,
        `あなたは${b.name}のSNS投稿文ライターです。

【${b.name}について】
ミッション：${b.mission}
ビジョン：${b.vision}
トーン：${b.tone}
禁止：${b.forbidden}

【投稿文のルール】
・温かみのある観察者視点で書く
・断定しない。押しつけない。余白を残す
・「寄り添い」「支援」「一緒に頑張りましょう」は絶対に使わない
・${b.name}を「ソーシャルプラットフォーム」として紹介する
・URLは含めない（後で自動付与）
${historyContext ? `\n【過去の発信（被り防止に参照）】\n${historyContext}` : ""}

【出力形式】
JSONのみ返すこと。前置き・説明・マークダウン不要。
{"x":"X用140文字以内","threads":"Threads用500文字以内"}`,
        `以下のキーワードで${b.name}のSNS投稿文を生成してください：\n\n${keyword}`
      );

      const parsed = JSON.parse(result.replace(/```json|```/g, "").trim());
      const xText = includeUrl ? `${parsed.x}\n${b.url}` : parsed.x;
      const threadsText = includeUrl ? `${parsed.threads}\n${b.url}` : parsed.threads;

      setPreview({ x: xText, threads: threadsText, rawX: parsed.x, rawThreads: parsed.threads });
    } catch (e) { showToast("エラー: " + e.message); }
    setGenerating(false);
  };

  const saveHistory = () => {
    if (!preview) return;
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString("ja-JP"),
      keyword,
      x: preview.rawX,
      threads: preview.rawThreads,
      brandUrl: includeUrl ? activeBrand.url : "",
    };
    setU("history", [entry, ...data.history].slice(0, 30));
    showToast("履歴に保存しました");
  };

  const UNA_TABS = [
    { id: "home", label: "投稿", icon: "✦" },
    { id: "history", label: "履歴", icon: "≡" },
    { id: "settings", label: "設定", icon: "⚙" },
  ];

  const s = {
    page: { maxWidth: 480, margin: "0 auto", padding: "16px 16px 0" },
    card: { border: `1px solid ${T.border}`, borderRadius: 12, background: T.card, overflow: "hidden" },
    sec: { marginBottom: 20 },
  };

  // Una固有のアクセントカラー
  const unaAccent = "#10b981";

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: ff, paddingBottom: 90, color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Noto+Sans+JP:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: ${T.muted2}; }
        input:focus, textarea:focus { border-color: ${unaAccent} !important; box-shadow: 0 0 0 2px ${unaAccent}20; }
        button:active { opacity: 0.7 !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ background: T.headerBg, borderBottom: `1px solid ${T.headerBorder}`,
        padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: "-0.01em" }}>
            <span style={{ color: unaAccent }}>{activeBrand.name}</span> 発信ツール
          </div>
          <div style={{ fontSize: 10, color: T.muted2, marginTop: 1 }}>SNS PUBLISH · X · THREADS</div>
        </div>
        <button onClick={onSwitch} style={{ background: "none", border: `1px solid ${T.border}`,
          color: T.muted, fontSize: 11, padding: "5px 10px", borderRadius: 6,
          fontFamily: ff, cursor: "pointer" }}>
          RAIteへ切替
        </button>
      </div>

      <div style={s.page}>

        {/* ── HOME ── */}
        {unaTab === "home" && (
          <div>
            <div style={s.sec}>
              <Label T={T}>キーワード入力</Label>
              <Textarea T={T} value={keyword} onChange={setKeyword}
                placeholder={"例）\n・療育に通いはじめた\n・就学先の選択で迷っている親向けに\n・Unaのことを知ってほしい"} rows={4} />

              {/* URL toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10,
                padding: "10px 12px", background: T.statBg, borderRadius: 8 }}>
                <button onClick={() => setIncludeUrl(!includeUrl)} style={{
                  width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
                  background: includeUrl ? unaAccent : T.border,
                  position: "relative", transition: "background 0.2s", flexShrink: 0,
                }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    position: "absolute", top: 2, transition: "left 0.2s",
                    left: includeUrl ? 18 : 2 }} />
                </button>
                <div>
                  <div style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>URLを含める</div>
                  <div style={{ fontSize: 10, color: T.muted }}>{activeBrand.url}</div>
                </div>
              </div>

              <button onClick={generate} disabled={generating || !keyword.trim()} style={{
                width: "100%", marginTop: 12, padding: "11px",
                background: generating || !keyword.trim() ? T.border : unaAccent,
                color: generating || !keyword.trim() ? T.muted : "#fff",
                border: "none", borderRadius: 8, fontSize: 13, fontFamily: ff,
                fontWeight: 600, cursor: generating || !keyword.trim() ? "not-allowed" : "pointer",
              }}>
                {generating ? <><Dots /> 生成中...</> : "X・Threads投稿文を生成 →"}
              </button>
            </div>

            {/* プレビュー */}
            {preview && (
              <>
                <Divider T={T} />
                <Label T={T}>生成結果</Label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                  {/* X */}
                  <div style={s.card}>
                    <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
                      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>X</span>
                      <XCount T={T} text={preview.x} url="" />
                    </div>
                    <div style={{ padding: "12px 14px", fontSize: 13, color: T.text,
                      lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 6 }}>
                      {preview.x}
                    </div>
                    <div style={{ padding: "0 14px 12px", display: "flex", gap: 6 }}>
                      <Btn T={T} size="sm" variant="ghost" onClick={() => copy(preview.x)}>コピー</Btn>
                      <button onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(preview.x)}`, "_blank")}
                        style={{ padding: "5px 10px", borderRadius: 6, border: "none",
                          background: "#1d9bf0", color: "#fff", fontSize: 12, fontFamily: ff, cursor: "pointer" }}>
                        Xで開く
                      </button>
                    </div>
                  </div>

                  {/* Threads */}
                  <div style={s.card}>
                    <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>Threads</span>
                    </div>
                    <div style={{ padding: "12px 14px", fontSize: 13, color: T.text,
                      lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 6 }}>
                      {preview.threads}
                    </div>
                    <div style={{ padding: "0 14px 12px" }}>
                      <Btn T={T} size="sm" variant="ghost" onClick={() => copy(preview.threads)}>コピー</Btn>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn T={T} variant="ghost" onClick={generate} style={{ flex: 1 }}>再生成</Btn>
                    <button onClick={saveHistory} style={{ flex: 1, padding: "9px",
                      background: unaAccent, color: "#fff", border: "none", borderRadius: 8,
                      fontSize: 13, fontFamily: ff, fontWeight: 500, cursor: "pointer" }}>
                      履歴に保存
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── HISTORY ── */}
        {unaTab === "history" && (
          <div>
            <div style={{ fontSize: 11, color: T.muted2, marginBottom: 12 }}>{data.history.length}件</div>
            {data.history.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: T.muted, fontSize: 13 }}>
                まだ履歴がありません
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.history.map(entry => (
                <div key={entry.id} style={s.card}>
                  <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>
                      {entry.keyword.split("\n")[0].slice(0, 24)}
                    </span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: T.muted2 }}>{entry.date}</span>
                      <Btn T={T} size="sm" variant="danger"
                        onClick={() => setU("history", data.history.filter(h => h.id !== entry.id))}>
                        削除
                      </Btn>
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px 6px" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, letterSpacing: "0.1em", marginBottom: 4 }}>X</div>
                    <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7, marginBottom: 8 }}>{entry.x}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, letterSpacing: "0.1em", marginBottom: 4 }}>Threads</div>
                    <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7, marginBottom: 10, whiteSpace: "pre-wrap" }}>{entry.threads}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn T={T} size="sm" variant="ghost" onClick={() => copy(entry.brandUrl ? `${entry.x}\n${entry.brandUrl}` : entry.x)}>X用コピー</Btn>
                      <Btn T={T} size="sm" variant="ghost" onClick={() => copy(entry.brandUrl ? `${entry.threads}\n${entry.brandUrl}` : entry.threads)}>Threads用コピー</Btn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {unaTab === "settings" && (
          <div>
            <div style={s.sec}>
              <Label T={T}>Claude API Key</Label>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#166534", fontWeight: 600, marginBottom: 4 }}>
                  🔒 APIキーは安全に保存されます
                </div>
                <div style={{ fontSize: 11, color: "#15803d", lineHeight: 1.7 }}>
                  入力されたAPIキーはお使いのデバイス内にのみ保存されます。外部には送信されません。
                </div>
              </div>
              <Input T={T} value={data.apiKey} onChange={v => setU("apiKey", v)}
                placeholder="sk-ant-..." style={{ fontFamily: "monospace", fontSize: 12 }} />
              <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
                取得：console.anthropic.com
              </div>
            </div>

            <Divider T={T} />

            <div style={s.sec}>
              <Label T={T}>表示モード</Label>
              <div style={{ display: "flex", gap: 8 }}>
                <Tag T={T} active={data.theme === "light"} onClick={() => setU("theme", "light")}>ライト</Tag>
                <Tag T={T} active={data.theme === "dark"} onClick={() => setU("theme", "dark")}>ダーク</Tag>
              </div>
            </div>

            <Divider T={T} />

            {/* ブランド管理 */}
            <div style={s.sec}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Label T={T}>ブランド管理</Label>
                <Btn T={T} size="sm" variant="ghost" onClick={() => {
                  setBrandForm({ id: 0, name: "", url: "", mission: "", vision: "", tone: "", forbidden: "" });
                }}>+ 追加</Btn>
              </div>

              {/* ブランドリスト */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {data.brands.map(br => {
                  const isActive = br.id === data.activeBrandId;
                  return (
                    <div key={br.id} style={{ ...s.card, border: `1px solid ${isActive ? unaAccent : T.border}` }}>
                      <div style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? unaAccent : T.text }}>
                              {br.name}
                            </span>
                            {isActive && (
                              <span style={{ fontSize: 9, background: unaAccent, color: "#fff",
                                padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>使用中</span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: T.muted2, marginTop: 2 }}>{br.url || "（URL未設定）"}</div>
                        </div>
                        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                          {!isActive && (
                            <Btn T={T} size="sm" variant="ghost" onClick={() => setU("activeBrandId", br.id)}>選択</Btn>
                          )}
                          <Btn T={T} size="sm" variant="ghost" onClick={() => setBrandForm({ ...br })}>編集</Btn>
                          {data.brands.length > 1 && (
                            <Btn T={T} size="sm" variant="danger" onClick={() => {
                              const next = data.brands.filter(b => b.id !== br.id);
                              setU("brands", next);
                              if (isActive) setU("activeBrandId", next[0].id);
                            }}>削除</Btn>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 編集・追加フォーム */}
              {brandForm && (
                <div style={{ ...s.card, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 12 }}>
                    {brandForm.id === 0 ? "新規ブランドを追加" : `「${brandForm.name}」を編集`}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <Label T={T}>ブランド名</Label>
                      <Input T={T} value={brandForm.name} onChange={v => setBrandField("name", v)} placeholder="ブランド名" />
                    </div>
                    <div style={{ flex: 2 }}>
                      <Label T={T}>URL</Label>
                      <Input T={T} value={brandForm.url} onChange={v => setBrandField("url", v)} placeholder="https://example.com" />
                    </div>
                  </div>
                  {[
                    { key: "mission", ph: "ミッション" },
                    { key: "vision", ph: "ビジョン" },
                    { key: "tone", ph: "トーン・スタイル" },
                    { key: "forbidden", ph: "禁止事項" },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: 8 }}>
                      <Label T={T}>{f.ph}</Label>
                      <Textarea T={T} value={brandForm[f.key]} onChange={v => setBrandField(f.key, v)}
                        placeholder={f.ph} rows={2} />
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <Btn T={T} variant="ghost" style={{ flex: 1 }} onClick={() => setBrandForm(null)}>キャンセル</Btn>
                    <Btn T={T} style={{ flex: 1 }} onClick={() => {
                      if (!brandForm.name.trim()) return;
                      if (brandForm.id === 0) {
                        const newBrand = { ...brandForm, id: Date.now() };
                        setU("brands", [...data.brands, newBrand]);
                        setU("activeBrandId", newBrand.id);
                      } else {
                        setU("brands", data.brands.map(b => b.id === brandForm.id ? brandForm : b));
                      }
                      setBrandForm(null);
                      showToast(brandForm.id === 0 ? "ブランドを追加しました" : "保存しました");
                    }}>保存</Btn>
                  </div>
                </div>
              )}
            </div>

            <Divider T={T} />

            <div style={s.sec}>
              <Label T={T}>バックアップ</Label>
              <Btn T={T} variant="ghost" style={{ width: "100%" }} onClick={() => {
                copy(JSON.stringify({ ...data, apiKey: "" }, null, 2));
              }}>全データをテキストでコピー</Btn>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.headerBg,
        borderTop: `1px solid ${T.headerBorder}`, display: "flex", zIndex: 100,
        paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {UNA_TABS.map(t => {
          const active = unaTab === t.id;
          return (
            <button key={t.id} onClick={() => setUnaTab(t.id)} style={{ flex: 1, padding: "10px 4px 8px",
              border: "none", background: "none", cursor: "pointer", fontFamily: ff,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 18, color: active ? unaAccent : T.muted, lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: 9, color: active ? unaAccent : T.muted,
                fontWeight: active ? 600 : 400, letterSpacing: "0.06em" }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      <Toast message={toast} T={T} />
    </div>
  );
}

// ═══════════════════════════════════════════════
// アカウント切り替えラッパー
// ═══════════════════════════════════════════════

const ACCOUNT_KEY = "multi_ai_brain_account";

export default function App() {
  const [account, setAccount] = useState(() => {
    return localStorage.getItem(ACCOUNT_KEY) || "raite";
  });

  const switchTo = (name) => {
    localStorage.setItem(ACCOUNT_KEY, name);
    setAccount(name);
  };

  if (account === "una") {
    return <UnaApp onSwitch={() => switchTo("raite")} />;
  }

  return <RAIteBrainInner onSwitch={() => switchTo("una")} />;
}
