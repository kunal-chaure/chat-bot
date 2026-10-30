(() => {
  const $ = (selector) => document.querySelector(selector);

  const scroller = $("#scroller");
  const thread = $("#thread");
  const emptyState = $("#empty");
  const form = $("#composer");
  const input = $("#input");
  const sendBtn = $("#send");

  const SPARK_SVG =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.6 5.6 4.4 9.4 10 10-5.6.6-9.4 4.4-10 10-.6-5.6-4.4-9.4-10-10 5.6-.6 9.4-4.4 10-10z"/></svg>';

  let previousInteractionId = null; // lets Gemini remember the conversation server-side
  let busy = false;

  // ---------- helpers ----------
  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function scrollToBottom() {
    scroller.scrollTop = scroller.scrollHeight;
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 200) + "px";
  }

  function updateSendState() {
    sendBtn.disabled = busy || input.value.trim().length === 0;
  }

  // ---------- rendering ----------
  function renderMarkdown(text) {
    const html = DOMPurify.sanitize(marked.parse(text, { gfm: true, breaks: true }));
    const template = document.createElement("template");
    template.innerHTML = html;

    template.content.querySelectorAll("a").forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });

    template.content.querySelectorAll("pre").forEach((pre) => {
      const wrap = el("div", "codeblock");
      const btn = el("button", "copy");
      btn.type = "button";
      btn.textContent = "Copy";
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(pre.textContent);
          btn.textContent = "Copied";
        } catch {
          btn.textContent = "Copy failed";
        }
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      });
      pre.replaceWith(wrap);
      wrap.append(btn, pre);
    });

    return template.content;
  }

  function addUserMessage(text) {
    const row = el("div", "msg user");
    const bubble = el("div", "bubble");
    bubble.textContent = text;
    row.append(bubble);
    thread.append(row);
  }

  function assistantRow() {
    const row = el("div", "msg assistant");
    const avatar = el("div", "avatar");
    avatar.setAttribute("aria-hidden", "true");
    avatar.innerHTML = SPARK_SVG;
    const body = el("div", "prose");
    row.append(avatar, body);
    thread.append(row);
    return { row, body };
  }

  function addAssistantMessage(markdown) {
    const { body } = assistantRow();
    body.append(renderMarkdown(markdown));
  }

  function addTyping() {
    const { row, body } = assistantRow();
    const dots = el("div", "typing");
    dots.setAttribute("role", "status");
    dots.setAttribute("aria-label", "Gemini is typing");
    dots.innerHTML = "<span></span><span></span><span></span>";
    body.append(dots);
    return row;
  }

  function addError(message) {
    const { body } = assistantRow();
    const box = el("div", "error");
    box.setAttribute("role", "alert");
    box.textContent = message;
    body.append(box);
  }

  // ---------- chat ----------
  async function sendMessage(rawText) {
    const text = rawText.trim();
    if (!text || busy) return;

    busy = true;
    emptyState.hidden = true;
    addUserMessage(text);
    input.value = "";
    autosize();
    updateSendState();

    const typingRow = addTyping();
    scrollToBottom();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, previousInteractionId }),
      });
      const data = await res.json().catch(() => ({}));
      typingRow.remove();

      if (!res.ok) {
        if (data.code === "CONVERSATION_EXPIRED") previousInteractionId = null;
        addError(data.error || "Something went wrong. Please try again.");
      } else {
        previousInteractionId = data.interactionId;
        addAssistantMessage(data.reply);
      }
    } catch {
      typingRow.remove();
      addError("Can't reach the server. Check your connection and try again.");
    } finally {
      busy = false;
      updateSendState();
      input.focus();
      scrollToBottom();
    }
  }

  function newChat() {
    thread.replaceChildren();
    previousInteractionId = null;
    emptyState.hidden = false;
    input.value = "";
    autosize();
    updateSendState();
    input.focus();
  }

  // ---------- events ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener("input", () => {
    autosize();
    updateSendState();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => sendMessage(chip.dataset.prompt));
  });

  $("#newChat").addEventListener("click", newChat);

  $("#themeToggle").addEventListener("click", () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* storage may be blocked */ }
  });

  input.focus();
})();
