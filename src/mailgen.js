/** Gmail：按正文与记忆生成一封回信。 */
import { generateText, importantStoryContext, memoryContext, userName } from './st.js';

export async function generateMailReply({ mail }) {
    const story = importantStoryContext(80, 320).map(line => (line.isUser ? userName() : line.name) + '：' + line.text).join('\n');
    const memory = memoryContext(12).map(item => String(item.text || '').slice(0, 500)).filter(Boolean).join('\n');
    const replies = (mail.replies || []).slice(-4).map(item => (item.mine ? userName() : mail.from) + '：' + item.text).join('\n');
    const system = '你在写一封故事世界里的邮件回信。用中文，口语但像邮件，2 到 4 段，不要写旁白和标题。';
    const prompt = [
        memory ? '记忆库 / 摘要：\n' + memory : '',
        story ? '最近剧情：\n' + story : '',
        '发件人：' + mail.from,
        '主题：' + mail.subject,
        '原邮件：\n' + String(mail.body || mail.preview || '').slice(0, 1200),
        replies ? '已经来回的内容：\n' + replies : '',
        '请以「' + mail.from + '」的身份写一封回信。',
    ].filter(Boolean).join('\n');
    try {
        const raw = await generateText({ system, prompt, length: 500 });
        const text = String(raw || '').replace(/^["「]|["」]$/g, '').trim();
        if (text) return text.slice(0, 1200);
    } catch { /* 兜底 */ }
    return '收到了。我这边最近有些事，等忙完再和你细说。';
}