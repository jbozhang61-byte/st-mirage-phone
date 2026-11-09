/**
 * 夜约：附近的人。可以搜人，也可以发布自己的资料等人来约。
 * 资料完全自定义；发布后广场上会出现你的卡片。
 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { getData, getCast, saveNow, ensureThread, appendMessages } from '../store.js';
import { userName } from '../st.js';

const INTENTS = ['随便聊聊', '一起喝酒', '缺个伴', '今晚有空', '长期'];
const CARD_FIELDS = [
  ['age', '年龄', '23'],
  ['need', '我的需求', '今晚就想找人，不聊虚的'],
  ['height', '身高', '170'],
  ['build', '体型', '匀称'],
  ['role', '职业', '学生'],
  ['intent', '想找', '随便聊聊'],
  ['when', '时间', '周末晚上'],
  ['note', '一句话', '不装，直说'],
];

function store() {
  const data = getData();
  if (!data.dating || typeof data.dating !== 'object') data.dating = {};
  data.dating.profile = data.dating.profile || {};
  if (!Array.isArray(data.dating.board)) data.dating.board = [];
  if (!Array.isArray(data.dating.invites)) data.dating.invites = [];
  return data.dating;
}

function seedBoard(profile) {
  const cast = getCast().map(person => person.name).filter(Boolean);
  const names = cast.length ? cast.slice(0, 8) : ['白璃', '小林', '阿岚', '苏姐', '旧城的猫'];
  return names.map((name, index) => ({
    id: 'dt-' + index + '-' + name.length,
    name,
    age: 20 + ((name.length * 3 + index) % 14),
    height: 155 + ((name.length * 7 + index * 3) % 30),
    build: ['匀称', '瘦', '偏瘦', '有线条'][index % 4],
    role: ['学生', '店员', '自由职业', '上班族', '酒吧常客'][index % 5],
    intent: INTENTS[index % INTENTS.length],
    when: ['今晚', '周末', '随时', '下班后'][index % 4],
    need: ['今晚就要，别聊太久', '想被抱着睡一觉', '找个固定的人，长期', '先喝酒，再看感觉', '凌晨也有空'][index % 5],
    now: index % 3 === 0,
    note: '别问太多，见面再说。',
    distance: (0.4 + index * 0.7).toFixed(1),
    mine: !!profile?.published && profile?.name && name === profile.name,
  }));
}

export function mountDating(host, { nav }) {
  let tab = 'browse';
  let filter = '';
  const el = h('div', { class: 'mp-dt' });
  const body = h('div', { class: 'mp-dt__body' });
  el.append(
    h('div', { class: 'mp-nav' },
      h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
      h('div', { class: 'mp-nav__title' }, '夜约', h('small', { text: 'NEARBY' })),
      h('div', { class: 'mp-nav__spacer' }),
    ),
    body,
  );
  host.appendChild(el);

  function render() {
    const data = store();
    body.innerHTML = '';
    const bar = h('div', { class: 'mp-dt__tabs' },
      h('button', { type: 'button', class: 'mp-dt__tab' + (tab === 'browse' ? ' on' : ''), text: '附近的人', onclick: () => { tab = 'browse'; render(); } }),
      h('button', { type: 'button', class: 'mp-dt__tab' + (tab === 'me' ? ' on' : ''), text: '我的资料', onclick: () => { tab = 'me'; render(); } }),
    );
    body.appendChild(bar);
    if (tab === 'me') return renderMe(data);
    const input = h('input', { class: 'mp-input', type: 'text', placeholder: '搜名字 / 职业 / 想找什么', value: filter,
      oninput: event => { filter = event.target.value.trim(); renderList(); } });
    body.appendChild(h('div', { class: 'mp-dt__search' }, icon('search'), input));
    const list = h('div', { class: 'mp-dt__list' });
    body.appendChild(list);
    function renderList() {
      list.innerHTML = '';
      const board = data.board.length ? data.board : (data.board = seedBoard(data.profile));
      const shown = filter
        ? board.filter(item => [item.name, item.role, item.intent].join(' ').includes(filter))
        : board;
      if (!shown.length) list.appendChild(h('div', { class: 'mp-st-hint', text: '没搜到人，换个词试试。' }));
      for (const item of shown) list.appendChild(cardEl(item));
    }
    renderList();
  }

  function cardEl(item) {
    return h('div', { class: 'mp-dt__card', onclick: () => openDetail(item) },
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
        item.need ? h('div', { class: 'mp-dt__need', text: '需求：' + item.need }) : null,
      ),
    );
  }

  function openDetail(item) {
    const dialog = sheet({
      title: item.name,
      content: h('div', { class: 'mp-field-list' },
        h('div', { class: 'mp-dt__detail' },
          avatar({ name: item.name, size: 60, link: false }),
          h('div', {}, h('div', { class: 'mp-dt__detail-name', text: item.name }),
            h('div', { class: 'mp-dt__meta', text: [item.age + ' 岁', item.height + 'cm', item.build, item.role].join(' · ') }))),
        h('div', { class: 'mp-st-hint', text: '想找：' + item.intent + '　时间：' + item.when + '　距离：' + item.distance + ' km' }),
        item.need ? h('div', { class: 'mp-dt__needbox' }, h('span', { class: 'mp-dt__needlabel', text: 'TA 的需求' }), h('div', { class: 'mp-me__bio', text: item.need })) : null,
        h('div', { class: 'mp-me__bio', text: item.note || '' }),
      ),
      actions: item.mine
        ? h('button', { class: 'mp-btn small', type: 'button', text: '编辑我的资料', onclick: () => { dialog.close(); tab = 'me'; render(); } })
        : h('div', { style: { display: 'flex', gap: '8px' } },
            h('button', {
              class: 'mp-btn small', type: 'button', text: '先私聊',
              onclick: () => {
                dialog.close();
                const thread = ensureThread([item.name]);
                nav.go('chat', { threadId: thread.id });
              },
            }),
            h('button', {
              class: 'mp-btn primary small', type: 'button', text: '约时间',
              onclick: () => { dialog.close(); openWhen(item, nav); },
            }),
          ),
    });
    return dialog;
  }

  /** 约时间：填个时间和地点，直接把第一条消息发过去。 */
  function openWhen(item, navApi) {
    const when = h('input', { class: 'mp-input', type: 'text', placeholder: '什么时候？比如 今晚 11 点 / 现在', value: item.now ? '现在' : '' });
    const where = h('input', { class: 'mp-input', type: 'text', placeholder: '哪儿见？比如 我那儿 / 酒店 / 你家' });
    const extra = h('textarea', { class: 'mp-input', rows: '2', placeholder: '再说一句（可选）' });
    const dialog = sheet({
      title: '约 ' + item.name,
      content: h('div', { class: 'mp-field-list' }, when, where, extra,
        h('div', { class: 'mp-st-hint', text: '会开一个和 TA 的会话，把这条消息发出去。' })),
      actions: h('button', {
        class: 'mp-btn primary small', type: 'button', text: '发过去',
        onclick: () => {
          const parts = [];
          if (when.value.trim()) parts.push(when.value.trim());
          if (where.value.trim()) parts.push(where.value.trim());
          if (extra.value.trim()) parts.push(extra.value.trim());
          const text = parts.length ? parts.join(' · ') : '现在有空吗？';
          dialog.close();
          const thread = ensureThread([item.name]);
          appendMessages(thread.id, [{ from: 'me', type: 'text', text }]);
          navApi.go('chat', { threadId: thread.id });
          toast('已发过去，等 TA 回');
        },
      }),
    });
    return dialog;
  }

  function renderMe(data) {
    const profile = data.profile;
    const view = h('div', { class: 'mp-dt__me' });
    view.appendChild(h('div', { class: 'mp-dt__me-head' },
      avatar({ name: profile.name || userName() || '我', size: 56, link: false }),
      h('div', {},
        h('div', { class: 'mp-dt__name', text: profile.name || userName() || '我' }),
        h('div', { class: 'mp-dt__meta', text: [profile.age, profile.height && profile.height + 'cm', profile.build, profile.role].filter(Boolean).join(' · ') || '还没填资料' })),
    ));
    const rows = h('div', { class: 'mp-field-list' });
    for (const [key, label, placeholder] of CARD_FIELDS) {
      if (key === 'intent') {
        rows.appendChild(h('div', { class: 'mp-group__label', text: label }));
        rows.appendChild(h('div', { class: 'mp-dt__chips' }, ...INTENTS.map(value => h('button', {
          type: 'button', class: 'mp-dt__chip' + (profile.intent === value ? ' on' : ''), text: value,
          onclick: () => { profile.intent = value; saveNow('data'); render(); },
        }))));
        continue;
      }
      const isLong = key === 'need' || key === 'note';
      const input = isLong
        ? h('textarea', { class: 'mp-input', rows: key === 'need' ? '4' : '2', placeholder })
        : h('input', { class: 'mp-input', type: 'text', placeholder, value: profile[key] || '' });
      if (isLong) input.value = profile[key] || '';
      else input.value = profile[key] || '';
      input.addEventListener('change', () => { profile[key] = input.value.trim(); saveNow('data'); });
      if (key === 'need') {
        input.placeholder = '写详细一点：要求什么、不能接受什么、想怎么约';
        rows.append(h('div', { class: 'mp-group__label', text: label }),
          h('div', { class: 'mp-st-hint', text: '长要求也行，会完整显示在你卡片的详情里' }), input);
      } else {
        rows.append(h('div', { class: 'mp-group__label', text: label }), input);
      }
    }
    view.appendChild(rows);
    view.appendChild(h('div', { class: 'mp-dt__publish' },
      h('button', {
        class: 'mp-btn primary small', type: 'button',
        text: profile.published ? '已发布到广场' : '发布，让别人来约我',
        onclick: () => {
          profile.published = !profile.published;
          profile.name = profile.name || userName() || '我';
          const board = getData().dating.board;
          if (profile.published) {
            board.unshift({
              id: 'me-' + Date.now().toString(36),
              name: profile.name, age: Number(profile.age) || 0, height: Number(profile.height) || 0,
              build: profile.build || '', role: profile.role || '', intent: profile.intent || INTENTS[0],
              when: profile.when || '', note: profile.note || '', distance: '0.0', mine: true,
            });
          } else {
            getData().dating.board = board.filter(item => !item.mine);
          }
          saveNow('data');
          render();
          toast(profile.published ? '已发布，等别人来约' : '已从广场撤下');
        },
      }),
      h('button', { class: 'mp-btn ghost small', type: 'button', text: '刷新附近的人', onclick: () => {
        const data = store();
        data.board = seedBoard(data.profile);
        saveNow('data');
        render();
        toast('换了一批');
      } }),
    ));
    body.appendChild(view);
  }

  render();
  return { refresh: render };
}
