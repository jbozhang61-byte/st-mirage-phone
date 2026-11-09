/**
 * 夜约：附近的人。独立私聊（不跟「消息」混用），资料全局保存，可切人群圈子。
 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { getData, getCast, saveNow, getSettings, getSelfProfile } from '../store.js';
import { userName } from '../st.js';
import { replyInChat, generateDatingBoard } from '../ai.js';
import { powerOf } from '../power.js';

const GROUPS = [
  { id: 'nearby', name: '附近的人', tier: 0, levels: ['学生', '店员', '自由职业', '上班族', '送货的'] },
  { id: 'nights', name: '夜店后巷', tier: 1, levels: ['调酒师', '夜班模特', '驻唱', '摄影师'] },
  { id: 'debutante', name: '名媛圈', tier: 2, levels: ['名媛', '千金', '新晋影后', '画廊主人'] },
  { id: 'noble', name: '贵族厅', tier: 3, levels: ['伯爵夫人', '世家继承人', '财阀独女', '公主'] },
];
const INTENTS = ['现在就要', '今晚有空', '先喝酒', '长期固定', '不聊只做'];
const NEEDS = [
  '今晚就要，别聊太久。要求身体好、时间长，磨叽的别来。',
  '想被抱着睡到天亮，体型看着舒服就行，别问东问西。',
  '只约固定的人，长期。要干净、会看眼色，别装。',
  '先喝一杯，看对眼再说。尺寸和体力能撑住就行，别的可以谈。',
  '凌晨有空，白天别找我。直接一点，别黏人。',
  '我不绕弯子。看得上就现在来，看不上别浪费我时间。',
];
const DEMANDS = [
  '身高 180 起，身材要有线条。时间短、磨叽的直接划走。',
  '不要太瘦，能抱得动我。洗澡干净，别一身烟味。',
  '尺寸和体力都得在线，做不到别来浪费我时间。',
  '长相要过得去，会收拾自己。不接受一边跟我一边跟别人。',
  '能开车来接。说话算数，别放我鸽子。',
];
const DESCS = [
  '在便利店上夜班，白天基本在睡。不太会讲话，但很直接。',
  '跑货运的，常年在路上。见面就见面，不拖。',
  '做设计的，一个人住，家里很干净。喜欢安静的人。',
  '开酒吧的，作息颠倒。想找个不用解释太多的人。',
  '刚毕业，租在旧城边上。有点怕生，但熟了很黏人。',
];

const pick = (list, index) => list[index % list.length];

function profile() {
  const settings = getSettings();
  if (!settings.dating || typeof settings.dating !== 'object') settings.dating = {};
  settings.dating.profile = settings.dating.profile || {};
  const me = settings.dating.profile;
  // 第一次进来自动从「心」里补：名字 + 自我描述
  if (!me.name) me.name = userName() || '我';
  if (!me.desc) {
    const intro = heartIntro();
    if (intro) me.desc = intro;
  }
  return me;
}

function state() {
  const data = getData();
  if (!data.dating || typeof data.dating !== 'object') data.dating = {};
  if (typeof data.dating.group !== 'string') data.dating.group = 'nearby';
  if (!data.dating.board || typeof data.dating.board !== 'object') data.dating.board = {};
  if (!data.dating.chats || typeof data.dating.chats !== 'object') data.dating.chats = {};
  if (!Array.isArray(data.dating.inbox)) data.dating.inbox = [];
  return data.dating;
}

/**
 * 读「心」里的自画像。
 * 注意：心里存的是 power 对象（颜值/谈吐/金钱/家境四维），不是单个数字，
 * 以前 Number(self.power) 得到 NaN → 永远 0 档，所以 9999 也显示"不够"。
 */
function heartScore() {
  try {
    const self = getSelfProfile() || {};
    return powerOf({ name: userName() || '我', desc: self.personality || '', power: self.power }).score;
  } catch { return 0; }
}

function powerTier() {
  const score = heartScore();
  if (score >= 900) return 3;
  if (score >= 500) return 2;
  if (score >= 250) return 1;
  return 0;
}

/** 把「心」里的自画像拼成一段自我简介，夜约这边没写的时候自动填。 */
function heartIntro() {
  try {
    const self = getSelfProfile() || {};
    const parts = [
      self.appearance ? '长相：' + self.appearance : '',
      self.body ? '身体：' + self.body : '',
      self.family ? '家世：' + self.family : '',
      self.personality ? '性格：' + self.personality : '',
      (self.custom || []).length ? '另外：' + self.custom.join('、') : '',
    ].filter(Boolean);
    return parts.join('；').slice(0, 400);
  } catch { return ''; }
}

/** 内置圈子 + 自己加的圈子。 */
function customGroups() {
  const settings = getSettings();
  if (!settings.dating || typeof settings.dating !== 'object') settings.dating = {};
  if (!Array.isArray(settings.dating.groups)) settings.dating.groups = [];
  return settings.dating.groups;
}

function allGroups() {
  return [...GROUPS, ...customGroups()];
}

const groupOf = id => allGroups().find(group => group.id === id) || GROUPS[0];

/** 新建一个自定义圈子：名字 + 门槛档位。 */
function addGroupSheet(onDone) {
  const name = h('input', { class: 'mp-input', type: 'text', placeholder: '圈子名字，比如「富婆群」' });
  const tiers = h('div', { class: 'mp-dt__chips' },
    ...GROUPS.map((group, index) => h('button', {
      type: 'button', class: 'mp-dt__chip' + (index === 0 ? ' on' : ''), text: '门槛 ' + group.name,
      onclick: event => {
        tiers.querySelectorAll('.mp-dt__chip').forEach(node => node.classList.remove('on'));
        event.currentTarget.classList.add('on');
        name.dataset.tier = String(index);
      },
    })));
  name.dataset.tier = '0';
  return sheet({
    title: '新建圈子',
    content: h('div', { class: 'mp-field-list' }, name, h('div', { class: 'mp-st-hint', text: '门槛越高，攻略力不够的人越看不到' }), tiers),
    actions: h('button', {
      class: 'mp-btn primary small', type: 'button', text: '创建',
      onclick: () => {
        const value = String(name.value || '').trim().slice(0, 12);
        if (!value) { toast('先起个名字'); return; }
        const list = customGroups();
        list.push({
          id: 'c-' + Date.now().toString(36),
          name: value,
          tier: Number(name.dataset.tier) || 0,
          levels: ['圈里人', '刚进来的', '老手'],
        });
        saveNow('settings');
        toast('圈子已创建');
        onDone?.();
      },
    }),
  });
}

function seedBoard(groupId, me) {
  const group = groupOf(groupId);
  const cast = getCast().map(person => person.name).filter(Boolean);
  const base = cast.length ? cast : ['白璃', '小林', '阿岚', '苏姐', '旧城的猫'];
  // 人少的时候补足到 8 个，别刷出来就一两个人
  const extra = ['阿澈', '小叙', '宁姐', '沈七', '唐棠', '老K', '林间', '程一'];
  const names = [...base];
  for (const name of extra) {
    if (names.length >= 8) break;
    if (!names.includes(name)) names.push(name);
  }
  const tier = Math.max(group.tier, Math.min(powerTier(), GROUPS.length - 1));
  const high = GROUPS[tier];
  return names.slice(0, 10).map((name, index) => ({
    id: 'dt-' + groupId + '-' + index,
    name,
    age: 20 + ((name.length * 3 + index) % 14),
    height: 155 + ((name.length * 7 + index * 3) % 30),
    build: ['匀称', '瘦', '有线条', '丰满'][index % 4],
    role: (getCast().find(person => person.name === name)?.role) || pick(group.levels, index + name.length),
    tierName: high.tier > group.tier ? high.name : group.name,
    intent: pick(INTENTS, index + name.length),
    when: ['现在', '今晚', '周末', '下班后'][index % 4],
    need: pick(NEEDS, index + name.length),
    demand: pick(DEMANDS, index + name.length + 1),
    desc: pick(DESCS, index + name.length),
    note: '别问太多，见面再说。',
    distance: (0.3 + index * 0.8).toFixed(1),
    now: index % 3 === 0,
    mine: !!(me?.published && me?.name && name === me.name),
  }));
}

export function mountDating(host, { nav }) {
  let tab = 'browse';
  let filter = '';
  let chatWith = '';
  let busy = false;

  /** AI 给的人不足 8 个时，用本地样例补足（名字不重复）。 */
  function padBoard(list, groupId, me) {
    const out = Array.isArray(list) ? list.slice() : [];
    if (out.length >= 8) return out.slice(0, 12);
    const seen = new Set(out.map(item => item.name));
    for (const person of seedBoard(groupId, me)) {
      if (out.length >= 8) break;
      if (seen.has(person.name)) continue;
      seen.add(person.name);
      out.push(person);
    }
    return out;
  }

  /** 先让模型按圈子写一批人（描述和需求都是它写的），失败再用本地样例。 */
  async function refreshBoard(data) {
    if (busy) return;
    busy = true;
    render();
    try {
      const group = groupOf(data.group);
      const me = profile();
      const self = {
        name: me.name || userName(),
        ...(getSelfProfile() || {}),
        intent: me.intent,
        need: me.need,
        demand: me.demand,
      };
      const list = await generateDatingBoard({ group: group.name, tier: group.tier, count: 10, self });
      const merged = padBoard(list, data.group, me);
      data.board[data.group] = merged;
      toast('来了 ' + merged.length + ' 个人');
    } catch (error) {
      data.board[data.group] = seedBoard(data.group, profile());
      toast('AI 没返回：' + String(error?.message || '未知').slice(0, 30), 3200);
    } finally {
      busy = false;
      saveNow('data');
      render();
    }
  }
  const el = h('div', { class: 'mp-dt' });
  const body = h('div', { class: 'mp-dt__body' });
  el.append(
    h('div', { class: 'mp-nav' },
      h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => (chatWith ? closeChat() : nav.home()) }, icon('back')),
      h('div', { class: 'mp-nav__title' }, '夜约', h('small', { text: 'NEARBY' })),
      h('div', { class: 'mp-nav__spacer' }),
    ),
    body,
  );
  host.appendChild(el);

  function render() {
    if (chatWith) return renderChat();
    const data = state();
    body.innerHTML = '';
    body.appendChild(h('div', { class: 'mp-dt__tabs' },
      ...[['browse', '附近的人'], ['me', '我的资料'], ['mail', '私信邮箱']].map(([id, label]) => h('button', {
        type: 'button', class: 'mp-dt__tab' + (tab === id ? ' on' : ''), text: label,
        onclick: () => { tab = id; render(); },
      }))));
    body.appendChild(h('div', { class: 'mp-dt__groups' }, ...allGroups().map(group => h('button', {
      type: 'button',
      class: 'mp-dt__group' + (data.group === group.id ? ' on' : '') + (powerTier() < group.tier ? ' locked' : ''),
      text: group.name + (powerTier() < group.tier ? ' 🔒' : ''),
      onclick: () => {
        if (powerTier() < group.tier) { toast('攻略力还不够，进不去' + group.name); return; }
        data.group = group.id;
        data.board[group.id] = seedBoard(group.id, profile());
        saveNow('data');
        render();
      },
    })), h('button', {
      type: 'button', class: 'mp-dt__group', text: '＋',
      onclick: () => addGroupSheet(() => render()),
    })));
    if (tab === 'me') return renderMe(data);
    if (tab === 'mail') return renderMail(data);
    renderBrowse(data);
  }

  function renderBrowse(data) {
    const input = h('input', { class: 'mp-input', type: 'text', placeholder: '搜名字 / 职业 / 想找什么', value: filter,
      oninput: event => { filter = event.target.value.trim(); renderList(); } });
    body.appendChild(h('div', { class: 'mp-dt__search' }, icon('search'), input));
    const list = h('div', { class: 'mp-dt__list' });
    body.appendChild(list);
    body.appendChild(h('div', { class: 'mp-dt__publish' },
      h('button', {
        class: 'mp-btn small', type: 'button', text: busy ? '正在找…' : '刷新附近的人',
        disabled: busy,
        onclick: () => refreshBoard(data),
      }),
      h('button', {
        class: 'mp-btn ghost small', type: 'button', text: '收件箱（' + data.inbox.length + '）',
        onclick: () => { tab = 'mail'; render(); },
      }),
    ));
    function renderList() {
      list.innerHTML = '';
      const board = data.board[data.group]?.length ? data.board[data.group] : (data.board[data.group] = seedBoard(data.group, profile()));
      const shown = filter ? board.filter(item => [item.name, item.role, item.intent].join(' ').includes(filter)) : board;
      if (!shown.length) list.appendChild(h('div', { class: 'mp-st-hint', text: '没搜到人，换个词试试。' }));
      for (const item of shown) {
        list.appendChild(h('div', { class: 'mp-dt__card', onclick: () => openDetail(item) },
          avatar({ name: item.name, size: 46, link: false }),
          h('div', { class: 'mp-dt__main' },
            h('div', { class: 'mp-dt__line' },
              h('span', { class: 'mp-dt__name', text: item.name }),
              item.mine ? h('span', { class: 'mp-dt__mine', text: '我' }) : null,
              item.now ? h('span', { class: 'mp-dt__now', text: '现在就要' }) : null,
              h('span', { class: 'mp-dt__dist', text: item.distance + ' km' })),
            h('div', { class: 'mp-dt__meta', text: [item.age + ' 岁', item.height + 'cm', item.build, item.role].join(' · ') }),
            h('div', { class: 'mp-dt__tags' },
              h('span', { class: 'mp-dt__tag', text: item.intent }),
              h('span', { class: 'mp-dt__tag', text: item.when })),
            item.need ? h('div', { class: 'mp-dt__need', text: '想要：' + item.need }) : null,
            item.demand ? h('div', { class: 'mp-dt__need', text: '要求：' + item.demand }) : null,
            item.desc ? h('div', { class: 'mp-dt__meta', text: item.desc }) : null,
          )));
      }
    }
    renderList();
  }

  function openDetail(item) {
    return sheet({
      title: item.name,
      content: h('div', { class: 'mp-field-list' },
        h('div', { class: 'mp-dt__detail' },
          avatar({ name: item.name, size: 60, link: false }),
          h('div', {}, h('div', { class: 'mp-dt__detail-name', text: item.name }),
            h('div', { class: 'mp-dt__meta', text: [item.age + ' 岁', item.height + 'cm', item.build, item.role].filter(Boolean).join(' · ') }),
            h('div', { class: 'mp-dt__meta', text: item.tierName || '' }))),
        item.desc ? h('div', { class: 'mp-dt__descbox' }, h('span', { class: 'mp-dt__needlabel', text: 'TA 的自我描述' }), h('div', { class: 'mp-me__bio', text: item.desc })) : null,
        item.need ? h('div', { class: 'mp-dt__needbox' }, h('span', { class: 'mp-dt__needlabel', text: 'TA 想要的' }), h('div', { class: 'mp-me__bio', text: item.need })) : null,
        item.demand ? h('div', { class: 'mp-dt__needbox' }, h('span', { class: 'mp-dt__needlabel', text: 'TA 的要求' }), h('div', { class: 'mp-me__bio', text: item.demand })) : null,
      ),
      actions: h('div', { style: { display: 'flex', gap: '8px' } },
        h('button', { class: 'mp-btn small', type: 'button', text: '私聊',
          onclick: () => { close(); openChatWith(item.name); } }),
        h('button', { class: 'mp-btn primary small', type: 'button', text: '约时间',
          onclick: () => { close(); openWhen(item); } }),
      ),
    });
    function close() { try { document.querySelector('.mp-sheet-backdrop')?.click(); } catch { /* ignore */ } }
  }

  function openWhen(item) {
    const when = h('input', { class: 'mp-input', type: 'text', placeholder: '什么时候', value: item.now ? '现在' : '' });
    const where = h('input', { class: 'mp-input', type: 'text', placeholder: '在哪儿见' });
    const extra = h('textarea', { class: 'mp-input', rows: '2', placeholder: '再说一句（可选）' });
    return sheet({
      title: '约 ' + item.name,
      content: h('div', { class: 'mp-field-list' }, when, where, extra),
      actions: h('button', {
        class: 'mp-btn primary small', type: 'button', text: '发过去',
        onclick: () => {
          const parts = [when.value.trim(), where.value.trim(), extra.value.trim()].filter(Boolean);
          openChatWith(item.name, parts.join(' · ') || '现在有空吗？');
        },
      }),
    });
  }

  function openChatWith(name, seedText = '') {
    const data = state();
    if (!data.chats[name]) data.chats[name] = { messages: [], at: Date.now() };
    if (seedText) data.chats[name].messages.push({ from: 'me', text: seedText, ts: Date.now() });
    saveNow('data');
    chatWith = name;
    render();
  }

  function closeChat() { chatWith = ''; render(); }

  function renderChat() {
    const data = state();
    const chat = data.chats[chatWith] || { messages: [] };
    if (!chat.messages) chat.messages = [];
    body.innerHTML = '';
    body.appendChild(h('div', { class: 'mp-dt__chat-head' },
      h('button', { type: 'button', class: 'mp-dt__chat-back', text: '‹ 返回', onclick: closeChat }),
      h('div', { class: 'mp-dt__chat-name', text: chatWith }),
      h('button', { type: 'button', class: 'mp-dt__chat-clear', text: '清空', onclick: () => {
        chat.messages = [];
        saveNow('data');
        render();
      } }),
    ));
    const list = h('div', { class: 'mp-dt__msgs' });
    for (const msg of chat.messages) {
      list.appendChild(h('div', { class: 'mp-dt__msg' + (msg.from === 'me' ? ' mine' : '') },
        h('div', { class: 'mp-dt__bubble', text: msg.text })));
    }
    body.appendChild(list);
    const input = h('input', { class: 'mp-input', type: 'text', placeholder: '说点什么…' });
    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      chat.messages.push({ from: 'me', text, ts: Date.now() });
      saveNow('data');
      render();
      const pending = { from: 'them', text: '…' };
      chat.messages.push(pending);
      render();
      try {
        const reply = await replyInChat({
          app: '夜约',
          chat: { name: chatWith },
          messages: chat.messages.map(m => ({ mine: m.from === 'me', text: m.text, name: m.from === 'me' ? userName() : chatWith })),
        });
        pending.text = reply || '……';
      } catch { pending.text = '……'; }
      saveNow('data');
      render();
    };
    body.appendChild(h('div', { class: 'mp-cm__composer' }, input,
      h('button', { type: 'button', class: 'mp-cm__send', onclick: send }, '发送')));
    requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  }

  function renderMail(data) {
    body.appendChild(h('div', { class: 'mp-group__label', text: '来约你的人（' + data.inbox.length + '）' }));
    if (!data.inbox.length) {
      body.appendChild(h('div', { class: 'mp-st-hint', text: '还没有人发邮件。去「我的资料」发布一下，会有人来约你。' }));
    }
    for (const mail of data.inbox) {
      body.appendChild(h('div', { class: 'mp-dt__invite', onclick: () => openChatWith(mail.name, '') },
        h('div', { class: 'mp-dt__line' },
          h('span', { class: 'mp-dt__name', text: mail.name }),
          h('span', { class: 'mp-dt__dist', text: '回 TA' })),
        mail.desc ? h('div', { class: 'mp-dt__need', text: mail.desc }) : null,
        mail.need ? h('div', { class: 'mp-dt__need', text: '需求：' + mail.need }) : null,
        h('div', { class: 'mp-dt__invite-text', text: mail.text }),
      ));
    }
  }

  /** 一键把《心》里的资料抄过来（长相/身体/家世/性格/自定义/喜好）。 */
  function fillFromHeart() {
    const me = profile();
    const self = getSelfProfile() || {};
    me.name = String(me.name || userName() || '我').slice(0, 20);
    const parts = [
      self.appearance ? '长相：' + self.appearance : '',
      self.body ? '身体：' + self.body : '',
      self.family ? '家世：' + self.family : '',
      self.personality ? '性格：' + self.personality : '',
      (self.custom || []).length ? '另外：' + self.custom.join('、') : '',
    ].filter(Boolean);
    if (parts.length) me.desc = parts.join('；').slice(0, 400);
    if (!me.need && (self.likes || []).length) me.need = '喜欢：' + self.likes.join('、');
    if (!me.demand && (self.dislikes || []).length) me.demand = '不接受：' + self.dislikes.join('、');
    saveNow('settings');
    return me;
  }

  function renderMe(data) {
    const me = profile();
    body.appendChild(h('div', { class: 'mp-dt__me-head' },
      avatar({ name: me.name || userName() || '我', size: 56, link: false }),
      h('div', {},
        h('div', { class: 'mp-dt__name', text: me.name || userName() || '我' }),
        h('div', { class: 'mp-dt__meta', text: [me.age, me.height && me.height + 'cm', me.build, me.role].filter(Boolean).join(' · ') || '还没填资料' })),
    ));
    const rows = h('div', { class: 'mp-field-list' });
    for (const [key, label, placeholder] of [['name', '昵称', userName() || '我'], ['age', '年龄', '23'], ['height', '身高', '170'], ['build', '体型', '匀称'], ['role', '职业', '学生']]) {
      const input = h('input', { class: 'mp-input', type: 'text', placeholder });
      input.value = me[key] || '';
      input.addEventListener('change', () => { me[key] = input.value.trim(); saveNow('settings'); });
      rows.append(h('div', { class: 'mp-group__label', text: label }), input);
    }
    rows.appendChild(h('div', { class: 'mp-group__label', text: '想找' }));
    rows.appendChild(h('div', { class: 'mp-dt__chips' }, ...INTENTS.map(value => h('button', {
      type: 'button', class: 'mp-dt__chip' + (me.intent === value ? ' on' : ''), text: value,
      onclick: () => { me.intent = value; saveNow('settings'); render(); },
    }))));
    for (const [key, label, placeholder] of [
      ['desc', '自我描述', '平时做什么、性格、身体情况，随便写'],
      ['need', '我想要什么', '想要什么样的人、什么身材、什么体验'],
      ['demand', '我的要求', '长相、身材、尺寸、时间、规矩，直接写'],
    ]) {
      const area = h('textarea', { class: 'mp-input', rows: '4', placeholder });
      area.value = me[key] || '';
      area.addEventListener('change', () => { me[key] = area.value.trim(); saveNow('settings'); });
      rows.append(h('div', { class: 'mp-group__label', text: label }), area);
    }
    body.appendChild(rows);
    body.appendChild(h('div', { class: 'mp-dt__publish' },
      h('button', {
        class: 'mp-btn small', type: 'button', text: '从《心》自动填入',
        onclick: () => {
          fillFromHeart();
          render();
          toast('已从心里填入资料');
        },
      }),
      h('button', {
        class: 'mp-btn primary small', type: 'button',
        text: me.published ? '已发布，等别人来约' : '发布，让别人来约我',
        onclick: () => {
          me.published = !me.published;
          me.name = me.name || userName() || '我';
          saveNow('settings');
          if (me.published) {
            const pool = seedBoard(data.group, me).filter(item => item.name !== me.name).slice(0, 3);
            data.inbox = pool.map((item, index) => ({
              id: 'iv-' + Date.now().toString(36) + index,
              name: item.name,
              desc: item.desc,
              need: item.need,
              text: ['看到你发的了，今晚有空吗？', '你的条件挺合适的，直接说时间吧。', '我这边随时可以，你定。'][index % 3],
              at: Date.now(),
            }));
            saveNow('data');
            toast('已发布，收件箱里有 ' + data.inbox.length + ' 封');
          } else {
            data.inbox = [];
            saveNow('data');
            toast('已撤下');
          }
          render();
        },
      }),
      h('button', {
        class: 'mp-btn ghost small', type: 'button',
        text: '心：攻略力 ' + heartScore() + ' · 当前 ' + groupOf(state().group).name,
        onclick: () => nav.go('heart'),
      }),
    ));
  }

  render();
  return { refresh: render };
}
