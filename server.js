
const express = require("express");
const path = require("path");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

if (!API_KEY) {
  console.error("GROQ_API_KEY bulunamadı!");
  process.exit(1);
}

const SYSTEM_PROMPT = `
Sen MEBRU AI adlı Türkçe kişisel yapay zekâ asistanısın.

Kurallar:
- Türkçe konuş.
- Doğal ve anlaşılır cevap ver.
- Gereksiz uzun cevaplardan kaçın.
- Kullanıcıya saygılı davran.
- Bilmediğin konularda uydurma yapma.
- Matematik ve ders konularını açıklayarak çöz.
- Öğretilen bilgilerden gerektiğinde yararlan.
- Kendini MEBRU AI olarak tanıt.
- Cevaplarında gereksiz özel karakterler kullanma.
`;

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [], knowledge = [] } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Mesaj boş olamaz."
      });
    }

    const safeHistory = Array.isArray(history)
      ? history.slice(-20).filter(item =>
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string"
        )
      : [];

    const safeKnowledge = Array.isArray(knowledge)
      ? knowledge.slice(-50).filter(item =>
          item && typeof item.text === "string"
        )
      : [];

    const learnedText = safeKnowledge
      .map(item => item.text)
      .join("\n\n");

    const messages = [
      {
        role: "system",
        content: SYSTEM_PROMPT +
          "\n\nÖĞRETİLEN BİLGİLER:\n" +
          (learnedText || "Henüz bilgi öğretilmedi.")
      },
      ...safeHistory.map(item => ({
        role: item.role,
        content: item.content
      }))
    ];

    // Son kullanıcı mesajı geçmişte zaten bulunuyorsa
    // tekrar eklemiyoruz.
    const last = messages[messages.length - 1];

    if (!last || last.role !== "user" || last.content !== message) {
      messages.push({
        role: "user",
        content: message
      });
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 1024
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq hatası:", data);
      return res.status(response.status).json({
        error: data.error?.message || "Groq bağlantı hatası."
      });
    }

    const reply =
      data.choices?.[0]?.message?.content ||
      "Cevap oluşturulamadı.";

    res.json({ reply });

  } catch (error) {
    console.error("Sunucu hatası:", error.message);

    res.status(500).json({
      error: "Sunucuda bir hata oluştu."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("MEBRU AI çalışıyor. Port: " + PORT);
});
