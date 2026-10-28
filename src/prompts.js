/**
 * 提示词与解析：把手机里的聊天记录、人设、剧情拼成请求，
 * 再把模型回来的文字拆成一条条真实的消息。
 * 这里全部是纯函数，方便单独测试。
 */

const TAG_RE = /^[\[【]\s*(图片|照片|语音|红包|s?转账|转帐|位置|表情|video|语音通话|通话)[^\]】]*[\]】]\s*([\s\S]*)$/;
const NAME_RE = /^\s*(?:\*\*)?([^：:\n]{1,24}?)(?:\*\*)?\s*[：:]\s*([\s\S]+)$/;

export function trim(text, max) {
    const s = String(text || '').replace(/\r/g, '').trim();
    return s.length > max ? s.slice(0, max) + '…' : s;
}

export function secondsToClock(sec) {
    const s = Math.max(1, Math.round(Number(sec) || 1));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/** 模型偶尔会加 markdown 代码块或前后缀。 */
export function stripFence(text) {
    let out = String(text || '').trim();
    out = out.replace(/^\`\`\`[\w-]*\s*/i, '').replace(/\s*\`\`\`$/i, '');
    out = out.replace(/^<\/?[a-z][\w:-]*(?:\s[^>]*)?>/i, '').trim();
    return out;
}

export function stripQuotes(text) {
    let s = String(text || '').trim();
    for (let i = 0; i < 3; i++) {
        const before = s;
        s = s.replace(/^["'“”「『（(]+/, '').replace(/["'“”」』）)]+$/, '').trim();
        if (s === before) break;
    }
    return s;
}

function isEmojiOnly(text) {
    const s = String(text || '').trim();
    if (!s || s.length > 12) return false;
    try {
        return /^[\p{Extended_Pictographic}\u200d\uFE0F\s]+$/u.test(s);
    } catch {
        return /^[\u2600-\u27BF\s]+$/.test(s);
    }
}

/**
 * 把一行文字拆成 {type,text,meta}。
 * 支持：[图片] 描述 / [语音] 说的话 / [红包 ¥8.88] 祝福 / [转账 ¥52] 备注 / [位置] 地点 / [表情] 😊
 */
export function parseLine(line) {
    let raw = String(line || '').replace(/^\s*[-*•·]\s*/, '').trim();
    raw = raw.replace(/^\*\*(.*)\*\*$/s, '$1').trim();
    if (!raw) return null;

    const tag = raw.match(TAG_RE);
    if (tag) {
        let kind = tag[1];
        if (kind === 's转账' || kind === 's转帐' || kind === '转帐') kind = '转账';
        const rest = tag[2].trim();
        const inside = raw.match(/^[\[【]([^\]】]*)[\]】]/)?.[1] || '';
        if (kind === '图片' || kind === '照片') return { type: 'photo', text: stripQuotes(rest) || '一张照片', meta: { caption: stripQuotes(rest) } };
        if (kind === '语音' || kind === '语音通话' || kind === '通话') {
            const secs = Math.min(60, Math.max(2, Math.round((stripQuotes(rest).length || 8) * 0.35)));
            return { type: 'voice', text: stripQuotes(rest), meta: { sec: secs } };
        }
        if (kind === '红包') {
            const amount = Number((inside.match(/[¥￥]\s*([\d.]+)/) || inside.match(/([\d.]+)/) || [])[1] || 0);
            return { type: 'redpacket', text: stripQuotes(rest) || '恭喜发财，大吉大利', meta: { amount: amount > 0 ? amount : 6.66 } };
        }
        if (kind === '转账') {
            const amount = Number((inside.match(/[¥￥]\s*([\d.]+)/) || inside.match(/([\d.]+)/) || [])[1] || 0);
            return { type: 'transfer', text: stripQuotes(rest) || '转账', meta: { amount: amount > 0 ? amount : 20 } };
        }
        if (kind === '位置') return { type: 'location', text: stripQuotes(rest) || '某个地方', meta: {} };
        if (kind === '表情') return { type: 'sticker', text: stripQuotes(rest) || '😊', meta: {} };
    }

    const text = stripQuotes(raw);
    if (!text) return null;
    if (isEmojiOnly(text)) return { type: 'sticker', text, meta: {} };
    return { type: 'text', text, meta: {} };
}

/** 去掉行首的说话人前缀（群聊会用到）。返回 {name, body}。 */
export function splitSpeaker(line, members = []) {
    const raw = String(line || '').trim();
    const m = raw.match(NAME_RE);
    if (!m) return { name: '', body: raw };
    const candidate = m[1].replace(/^[「『【\[]|[」』】\]]$/g, '').trim();
    const hit = members.find(name => name === candidate)
        || members.find(name => candidate && (name.includes(candidate) || candidate.includes(name)));
    if (!hit && !/^(我|你|系统|旁白)$/.test(candidate)) return { name: '', body: raw };
    return { name: hit || candidate, body: m[2].trim() };
}

export function cleanReply(raw) {
    let text = stripFence(raw);
    text = text.replace(/^\s*\[不发\]\s*$/gm, '').trim();
    if (/^\[不发\]/.test(text)) return [];
    return text.split(/\n+/).map(l => l.trim()).filter(Boolean);
}

/**
 * 解析一段聊天回复。
 * members: 可选说话人（群聊）；fallbackSender: 没写名字时算谁说的。
 */
export function parseChatReply(raw, { members = [], fallbackSender = '', max = 8 } = {}) {
    const lines = cleanReply(raw);
    const out = [];
    for (const line of lines) {
        let body = line;
        let sender = fallbackSender || members[0] || '';
        if (members.length > 1) {
            const split = splitSpeaker(line, members);
            if (split.name) { sender = split.name; body = split.body; }
            // 没写名字的续行，沿用上一条的说话人
            else if (out.length) { sender = out[out.length - 1].sender; }
        } else {
            const split = splitSpeaker(line, members);
            if (!split.name) body = split.body;
        }
        const parsed = parseLine(body);
        if (!parsed) continue;
        if (parsed.type === 'text' && parsed.text.length > 900) parsed.text = parsed.text.slice(0, 900) + '…';
        out.push({ sender, ...parsed, ts: Date.now() });
        if (out.length >= max) break;
    }
    return out;
}

/** 从模型回复里抠出第一段 JSON。 */
export function extractJson(raw) {
    let text = String(raw || '').trim();
    text = text.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '');
    const start = text.indexOf('{');
    if (start < 0) return null;
    const body = text.slice(start);
    const end = body.lastIndexOf('}');
    const trimmed = end > 0 ? body.slice(0, end + 1) : body;

    // 1) 完整 JSON（后面还跟了说明文字也能用）
    for (const candidate of [trimmed, body]) {
        try { return JSON.parse(candidate); } catch { /* 继续 */ }
    }
    // 2) 常见的小毛病
    try { return JSON.parse(trimmed.replace(/,\s*([}\]])/g, '$1').replace(/“|”/g, '"')); } catch { /* 继续 */ }
    // 3) 被 max_tokens 截断：补全
    return repairJson(body) || repairJson(trimmed);
}

export function repairJson(text) {
    let s = String(text || '').trim();
    if (!s || (s[0] !== '{' && s[0] !== '[')) return null;

    const stack = [];
    let inString = false;
    let escaped = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') inString = true;
        else if (ch === '{' || ch === '[') stack.push(ch);
        else if (ch === '}' || ch === ']') stack.pop();
    }

    let candidate = s.replace(/[,\s]+$/, '');
    if (inString) candidate += '"';
    for (let i = stack.length - 1; i >= 0; i--) candidate += stack[i] === '{' ? '}' : ']';

    try { return JSON.parse(candidate); } catch { /* 最后的兜底 */ }

    // 再退一步：去掉最后一个不完整的对象，只保留已经完整的部分
    const cut = candidate.lastIndexOf('},');
    if (cut > 0) {
        try { return JSON.parse(candidate.slice(0, cut + 1) + ']}'); } catch { /* ignore */ }
    }
    return null;
}

export function parseMoments(raw, { contacts = [], user = '我', max = 5 } = {}) {
    const json = extractJson(raw);
    const posts = [];
    const push = (author, text, likes, comments) => {
        const body = String(text || '').trim();
        if (!body) return;
        const who = contacts.includes(author) || author === user ? author : (contacts[0] || author || '某人');
        posts.push({
            author: who,
            text: body.slice(0, 1200),
            likes: (Array.isArray(likes) ? likes : []).map(String).filter(n => n && n !== author).slice(0, 12),
            comments: (Array.isArray(comments) ? comments : []).map(c => ({
                by: String(c?.by || c?.author || '').trim() || '某人',
                text: String(c?.text || c?.content || '').trim().slice(0, 400),
            })).filter(c => c.text).slice(0, 10),
        });
    };
    if (json && Array.isArray(json.posts)) {
        for (const post of json.posts.slice(0, max)) push(post?.author, post?.text || post?.content, post?.likes, post?.comments);
    }
    if (!posts.length) {
        // 退化：按「作者：内容」逐行读，后半段的短行当评论
        for (const line of String(raw || '').split(/\n+/)) {
            const split = splitSpeaker(line, contacts);
            if (split.name && split.body) push(split.name, split.body, [], []);
        }
    }
    return posts;
}

/* ------------------------------- 提示词拼装 ------------------------------- */

export function personaBlock(name, card) {
    if (!card) return '';
    const parts = [];
    if (card.description) parts.push(trim(card.description, 1400));
    if (card.personality) parts.push('性格：' + trim(card.personality, 400));
    if (card.scenario) parts.push('场景：' + trim(card.scenario, 300));
    return parts.join('\n');
}

export function storyBlock(story, { each = 300, max = 6 } = {}) {
    if (!story || !story.length) return '';
    return story.slice(-max).map(line => (line.isUser ? 'TA' : line.name) + '：' + trim(line.text, each)).join('\n');
}

export function historyBlock(msgs, { user = '我', members = [], max = 24, each = 240 } = {}) {
    const list = (msgs || []).filter(m => m.from !== 'sys' && m.type !== 'call').slice(-max);
    return list.map(m => {
        const who = m.from === 'me' ? user : (m.sender || members[0] || '对方');
        if (m.type === 'voice') return who + '：[语音] ' + trim(m.text, each);
        if (m.type === 'photo') return who + '：[图片] ' + trim(m.text, each);
        if (m.type === 'redpacket') return who + '：[红包 ¥' + (m.meta?.amount || 0) + '] ' + trim(m.text, 60);
        if (m.type === 'transfer') return who + '：[转账 ¥' + (m.meta?.amount || 0) + '] ' + trim(m.text, 60);
        if (m.type === 'location') return who + '：[位置] ' + trim(m.text, 80);
        if (m.type === 'sticker') return who + '：' + trim(m.text, 20);
        return who + '：' + trim(m.text, each);
    }).join('\n');
}

/**
 * 手机聊天的系统提示。
 * person 是这个世界里的「人」，不是角色卡本身；world 是卡名，card 提供世界设定。
 */
export function chatSystemPrompt({ thread, person = null, world = '', card = null, settings, user, story, memory = [], reply = true }) {
    const members = thread.members || [];
    const who = person?.name || (members.length > 1 ? members.join('、') : members[0]);
    const lines = [];
    lines.push('你正在扮演「' + who + '」' + (world ? '，生活在《' + world + '》这个世界里' : '') + '，用手机聊天软件和「' + user + '」发消息。');
    if (members.length > 1) {
        lines.push('这是一个群聊，成员：' + members.join('、') + '。你可以只让其中一两个人说话，也可以几个人一起接话。');
        lines.push('每条消息写成「名字：内容」，用成员的名字开头。');
    }

    const personaParts = [];
    if (person?.role) personaParts.push('身份：' + person.role);
    if (person?.desc) personaParts.push(person.desc);
    if (person?.style) personaParts.push('说话方式：' + person.style);
    if (!personaParts.length) {
        const fallback = personaBlock(who, card);
        if (fallback) personaParts.push(fallback);
    }
    if (personaParts.length) lines.push('\n【你是谁】\n' + personaParts.join('\n'));

    const relation = thread.note || person?.relation || '';
    if (relation) lines.push('\n【你和 TA 的关系 / 备注】\n' + trim(relation, 500));

    if (card) {
        const worldParts = [];
        if (card.scenario) worldParts.push('场景：' + trim(card.scenario, 500));
        if (card.description) worldParts.push('世界设定：' + trim(card.description, 900));
        if (worldParts.length) lines.push('\n【这个世界】\n' + worldParts.join('\n'));
    }

    const storyText = storyBlock(story);
    if (storyText) lines.push('\n【最近发生的事（只作背景，不要复述）】\n' + storyText);
    const memoryText = (memory || []).map(item => String(item.text || '').slice(0, 600)).filter(Boolean).join('\n');
    if (memoryText) lines.push('\n【记忆库 / 长线摘要（只作背景，不要复述）】\n' + memoryText);
    lines.push('\n【说话方式】\n' + ((settings?.ai?.style || '').slice(0, 2500)));
    lines.push([
        '\n【手机消息格式】一行就是一条消息。可以直接写文字，也可以发这些：',
        '[图片] 画面里有什么',
        '[语音] 你想说的话',
        '[红包 ¥金额] 祝福语',
        '[转账 ¥金额] 备注',
        '[位置] 地点名',
        '[表情] 😊',
        '一轮可以发 1 到 5 条，按这个人此刻的心情决定；不要每轮都一样多。',
    ].join('\n'));
    if (!reply) lines.push('\n如果你此刻不想发消息，就只输出 [不发]。');
    lines.push('\n只输出消息本身。不要写旁白、动作、心理描写、时间戳，不要解释。');
    return lines.join('\n');
}

export function chatUserPrompt({ thread, user, limit = 24 }) {
    const members = thread.members || [];
    const history = historyBlock(thread.msgs, { user, members, max: limit });
    const last = thread.msgs?.[thread.msgs.length - 1];
    const lines = [];
    lines.push('这是你们最近的聊天记录：');
    lines.push(history || '（还没有聊过）');
    if (last?.from === 'me') lines.push('\n' + user + '刚刚发完最后一条，等你的回复。');
    else lines.push('\n接着往下聊。');
    lines.push('现在轮到你发消息。');
    return lines.join('\n');
}

/** 从当前聊天里找出这个世界里的人。 */
export function castSystemPrompt({ user }) {
    return [
        '你是一个聊天记录整理助手，要从「' + user + '」当前这段聊天里找出真实出现过的人。',
        '优先：聊天里说过话的人、被明确提到的人；不要只按角色卡设定凭空补人。',
        '如果聊天记录里只有一两个人，可以补充聊天里暗示存在的家人、同事、店主等，但不要编造大事件。',
        '人物要属于当前这个世界，不要混进上一段聊天或别的角色卡的人。',
        '如果给了长期记忆/摘要，优先从那里找人；没有记忆时再挑聊天里重要的内容。',
        '只输出 JSON，不要别的内容：',
        '{"people":[{"name":"名字","role":"身份（例如：修表匠 / 旧友 / 弟弟）","relation":"和' + user + '的关系","desc":"一两句人设","style":"说话方式"}]}',
    ].join('\n');
}

export function castUserPrompt({ card, story = [], user = '我' }) {
    const parts = [];
    if (story.length) {
        parts.push('当前聊天的最近内容（以此为准）：');
        parts.push(story.map(line => (line.isUser ? user : line.name) + '：' + trim(line.text, 840)).join('\n'));
    }
    if (card) {
        parts.push('\n角色卡资料（仅作背景参考，不要用卡里没出现过的人替换聊天里的人）：');
        parts.push('角色卡名：' + (card.name || '未命名'));
        if (card.description) parts.push('简介：' + trim(card.description, 600));
        if (card.scenario) parts.push('场景：' + trim(card.scenario, 400));
    }
    parts.push('\n请优先从上面的聊天记录里找出 4 到 8 个这个世界里的人。');
    return parts.join('\n');
}

export function momentsSystemPrompt({ contacts, user, story, memory = [] }) {
    const lines = [];
    lines.push('你在为一个故事世界生成「朋友圈」动态。作者的手机里有这些好友：' + contacts.join('、') + '。');
    const storyText = storyBlock(story, { each: 320, max: 6 });
    if (storyText) lines.push('\n最近发生的剧情（只作背景）：\n' + storyText);
    const memoryText = (memory || []).map(item => String(item.text || '').slice(0, 600)).filter(Boolean).join('\n');
    if (memoryText) lines.push('\n记忆库 / 长线摘要（只作背景，不要复述）：\n' + memoryText);
    lines.push([
        '\n像真人发朋友圈：一两句话到一小段，写日常、心情、见闻、吐槽，或者对最近发生的事的感受。',
        '口语、自然，可以带表情，不写旁白和动作描写。每个人的语气要符合人设，彼此不要雷同。',
        '不要复述剧情，不要替「' + user + '」发动态。好友之间会互相点赞、评论，评论简短口语。',
    ].join('\n'));
    lines.push([
        '\n只输出 JSON，不要别的内容：',
        '{"posts":[{"author":"作者名字","text":"正文","likes":["点赞的人"],"comments":[{"by":"评论的人","text":"评论"}]}]}',
    ].join('\n'));
    return lines.join('\n');
}

export function momentsUserPrompt({ count = 4, recent = [] }) {
    const hints = recent.length ? '不要和这些已经发过的动态重复：\n' + recent.map(t => '- ' + trim(t, 80)).join('\n') + '\n\n' : '';
    return hints + '生成 ' + count + ' 条新的朋友圈动态，作者从好友里选，尽量不同的人。';
}

export function commentSystemPrompt({ contacts, user, memory = [] }) {
    const memoryText = (memory || []).map(item => String(item.text || '').slice(0, 500)).filter(Boolean).join('\n');
    return [
        '你在为一个故事世界里的朋友圈生成互动。好友：' + contacts.join('、') + '。',
        '「' + user + '」刚发了一条动态，好友们会点赞、评论。评论要短、口语、符合各自人设，可以互相接话，也可以开玩笑。',
        memoryText ? '记住的长线剧情 / 摘要：\n' + memoryText : '',
        '只输出 JSON：{"likes":["名字"],"comments":[{"by":"名字","text":"评论"}]}',
    ].filter(Boolean).join('\n');
}

export function commentUserPrompt({ text, user }) {
    return user + ' 发的动态：\n「' + trim(text, 500) + '」\n\n生成 1 到 4 个点赞和 1 到 3 条评论。';
}

export function proactivePrompt({ thread, user, story }) {
    return [
        '现在是深夜或各自忙着自己的事，你们没有在聊天。',
        '根据最近的剧情和你们的聊天，判断「' + thread.members.join('、') + '」此刻会不会主动给「' + user + '」发消息。',
        storyBlock(story, { each: 260, max: 5 }) ? '\n最近剧情：\n' + storyBlock(story, { each: 260, max: 5 }) : '',
        '\n想发就按格式发 1 到 3 条；不想发就只输出 [不发]。不要解释。',
    ].filter(Boolean).join('\n');
}

/** 注入正文的手机状态摘要。 */
export function phoneStateSummary({ threads, user, hearts = [], selfProfile = null, worldProfile = null, extras = [], maxThreads = 5, maxMsgs = 4 }) {
    const lines = [];
    const sorted = [...(threads || [])].filter(t => t.msgs?.length).sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, maxThreads);
    for (const thread of sorted) {
        const name = thread.members.join('、');
        const msgs = thread.msgs.filter(m => m.from !== 'sys').slice(-maxMsgs);
        if (!msgs.length) continue;
        const body = msgs.map(m => {
            const who = m.from === 'me' ? user : (m.sender || thread.members[0]);
            const value = m.type === 'voice' ? '[语音]' + m.text : m.type === 'photo' ? '[图片]' + m.text : m.type === 'redpacket' ? '[红包]' : m.text;
            return who + '：' + trim(value, 40);
        }).join(' / ');
        lines.push('· 和「' + name + '」：' + body);
    }
    const parts = [];
    if (lines.length) {
        parts.push('【手机里的最近消息】');
        parts.push('以下只是手机聊天里已经发生的事实（发生在剧情里，你是知道的）：');
        parts.push(...lines);
        parts.push('把聊天内容当作已经发生的事来理解，可以自然体现；但正文里不要引用、复述或粘贴聊天原文，不要写「手机里说」「聊天记录」之类的话，也不要出现聊天界面。');
    }
    if (extras.length) {
        parts.push('【手机聊天里已经发生的事实】');
        parts.push('以下同样是剧情里发生过的事，只提取事实（谁做了什么、约定了什么），不要让正文出现聊天原文、聊天记录或「手机里说」之类表述：');
        parts.push(...extras);
    }
    const heartLines = [];
    for (const person of hearts.slice(0, 6)) {
        if (!person?.name) continue;
        const outfit = person.outfit && typeof person.outfit === 'object'
            ? [person.outfit.top, person.outfit.bottom, person.outfit.stockings, person.outfit.shoes].filter(Boolean).join('/')
            : String(person.outfit || '');
        const fields = [
            person.stage ? person.stage + (person.affection ? ' ' + person.affection + '%' : '') : '',
            person.sensitive?.length ? '敏感：' + person.sensitive.join('、') : '',
            person.likes?.length ? '喜欢：' + person.likes.join('、') : '',
            person.custom?.length ? '自定义：' + person.custom.join('、') : '',
            outfit ? '穿着：' + outfit : '',
            person.boundaries?.length ? '边界：' + person.boundaries.join('、') : '',
        ].filter(Boolean);
        if (fields.length) heartLines.push('· ' + person.name + '：' + trim(fields.join('｜'), 220));
    }
    if (heartLines.length) {
        parts.push('【你对这些人的了解（手机「心」里记录的，成年角色、双方自愿）】');
        parts.push(...heartLines);
        parts.push('聊到相关话题时可以自然带出，不要生硬复述。');
    }
    if (worldProfile && typeof worldProfile === 'object') {
        const worldFields = [
            worldProfile.name ? '名称：' + worldProfile.name : '',
            worldProfile.type ? '类型：' + worldProfile.type : '',
            worldProfile.scale ? '范围：' + worldProfile.scale : '',
            worldProfile.era ? '时代：' + worldProfile.era : '',
            worldProfile.rules ? '规则：' + worldProfile.rules : '',
            worldProfile.factions?.length ? '势力：' + worldProfile.factions.join('、') : '',
            worldProfile.places?.length ? '地点：' + worldProfile.places.join('、') : '',
            worldProfile.notes ? '补充：' + worldProfile.notes : '',
        ].filter(Boolean);
        if (worldFields.length) {
            parts.push('【这个世界（手机「世界」里填写的）】');
            parts.push('· ' + trim(worldFields.join('｜'), 700));
            parts.push('生成时保持世界设定一致，不要写进正文。');
        }
    }
    if (selfProfile && typeof selfProfile === 'object') {
        const selfFields = [
            selfProfile.appearance ? '颜值：' + selfProfile.appearance : '',
            selfProfile.personality ? '性格：' + selfProfile.personality : '',
            selfProfile.body ? '身体：' + selfProfile.body : '',
            selfProfile.family ? '家世：' + selfProfile.family : '',
            selfProfile.likes?.length ? '喜爱：' + selfProfile.likes.join('、') : '',
            selfProfile.dislikes?.length ? '厌恶：' + selfProfile.dislikes.join('、') : '',
            selfProfile.custom?.length ? '自定义：' + selfProfile.custom.join('、') : '',
        ].filter(Boolean);
        if (selfFields.length) {
            parts.push('【关于你（用户本人，手机「心」里填写的）】');
            parts.push('· ' + trim(selfFields.join('｜'), 500));
            parts.push('写用户的外貌、身体、家世、喜恶时可以据此保持一致，不要写进正文。');
        }
    }
    return parts.join('\n');
}

/** 带进剧情的一段话。 */
export function bringToStoryText({ thread, user }) {
    const msgs = (thread.msgs || []).filter(m => m.from !== 'sys').slice(-8);
    const lines = msgs.map(m => (m.from === 'me' ? user : (m.sender || thread.members[0])) + '：' + trim(m.text, 120));
    return [
        '【刚刚在手机上发生的对话】',
        '「' + user + '」和「' + thread.members.join('、') + '」在手机里聊了这些：',
        ...lines,
        '接下来的正文可以自然地承接、提到或回应这段对话，但不要原样复述。',
    ].join('\n');
}